import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

// ---------------------------------------------------------------------------
// Minimal Web Push implementation (no external deps needed)
// Uses VAPID JWT + encrypted payload per RFC 8291 / RFC 8292
// ---------------------------------------------------------------------------

async function importPrivateKey(rawB64u: string): Promise<CryptoKey> {
  const raw = base64urlToUint8Array(rawB64u);
  // Convert raw 32-byte EC private key to PKCS#8
  const pkcs8 = buildPkcs8(raw);
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function importPublicKey(rawB64u: string): Promise<CryptoKey> {
  const raw = base64urlToUint8Array(rawB64u);
  return crypto.subtle.importKey("raw", raw, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
}

function buildPkcs8(rawPrivate: Uint8Array): ArrayBuffer {
  // DER sequence for P-256 private key: ECPrivateKey wrapper without public key
  const prefix = new Uint8Array([
    0x30, 0x41, // SEQUENCE, length 65
    0x02, 0x01, 0x00, // INTEGER 0 (version)
    0x30, 0x13, // SEQUENCE (AlgorithmIdentifier)
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, // OID ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID P-256
    0x04, 0x27, // OCTET STRING, length 39
    0x30, 0x25, // SEQUENCE ECPrivateKey, length 37
    0x02, 0x01, 0x01, // INTEGER 1 (version)
    0x04, 0x20, // OCTET STRING, length 32
  ]);
  const buf = new Uint8Array(prefix.length + 32);
  buf.set(prefix);
  buf.set(rawPrivate.slice(0, 32), prefix.length);
  return buf.buffer;
}

async function makeVapidJwt(audience: string, subject: string, privateKeyB64u: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };
  const enc = (obj: object) => base64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  const signing = `${enc(header)}.${enc(payload)}`;
  const key = await importPrivateKey(privateKeyB64u);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signing));
  return `${signing}.${base64urlEncode(new Uint8Array(sig))}`;
}

// ---------------------------------------------------------------------------
// Key agreement + message encryption (RFC 8291 + HKDF)
// ---------------------------------------------------------------------------

async function encryptPayload(
  endpoint: string,
  p256dhB64u: string,
  authB64u: string,
  plaintext: string
): Promise<{ body: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const receiverPublicKey = await crypto.subtle.importKey(
    "raw",
    base64urlToUint8Array(p256dhB64u),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );

  const serverKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeyPair.publicKey));

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: receiverPublicKey },
    serverKeyPair.privateKey,
    256
  );

  const authBytes = base64urlToUint8Array(authB64u);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF-extract + expand following RFC 8291
  const prk = await hkdf(new Uint8Array(sharedBits), authBytes,
    concat(label("Content-Encoding: auth\0"), serverPublicKeyRaw, base64urlToUint8Array(p256dhB64u)), 32);

  const contentEncKey = await hkdf(prk, salt,
    concat(label("Content-Encoding: aesgcm\0"), serverPublicKeyRaw, base64urlToUint8Array(p256dhB64u)), 16);

  const nonce = await hkdf(prk, salt,
    concat(label("Content-Encoding: nonce\0"), serverPublicKeyRaw, base64urlToUint8Array(p256dhB64u)), 12);

  const encKey = await crypto.subtle.importKey("raw", contentEncKey, "AES-GCM", false, ["encrypt"]);
  const paddedPlaintext = new Uint8Array([0, 0, ...new TextEncoder().encode(plaintext)]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, encKey, paddedPlaintext));

  return { body: ciphertext, salt, serverPublicKey: serverPublicKeyRaw };
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt, "HKDF", false, ["deriveBits"]);
  const prk = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: ikm }, key, 256);

  const prkKey = await crypto.subtle.importKey("raw", prk, "HMAC", false, ["sign"]);
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, concat(info, new Uint8Array([1]))));
  return okm.slice(0, length);
}

function label(str: string): Uint8Array { return new TextEncoder().encode(str); }
function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}
function base64urlToUint8Array(b64u: string): Uint8Array {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64u.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
function base64urlEncode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ---------------------------------------------------------------------------
// Send a single Web Push notification
// ---------------------------------------------------------------------------

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  authKey: string,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidEmail: string
): Promise<void> {
  const { body, salt, serverPublicKey } = await encryptPayload(endpoint, p256dh, authKey, JSON.stringify(payload));

  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await makeVapidJwt(audience, `mailto:${vapidEmail}`, vapidPrivateKey);

  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aesgcm",
    "Encryption": `salt=${base64urlEncode(salt)}`,
    "Crypto-Key": `dh=${base64urlEncode(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
    "Authorization": `WebPush ${jwt}`,
    "TTL": "86400",
  };

  const res = await fetch(endpoint, { method: "POST", headers, body });
  if (!res.ok && res.status !== 201) {
    const text = await res.text().catch(() => "");
    console.error(`Push failed ${res.status}:`, text);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // GET /send-push → return VAPID public key for the client
  if (req.method === "GET") {
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    return new Response(JSON.stringify({ publicKey }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST /send-push → send push to the caller's partner
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("send-push auth config missing", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return new Response("Server configuration error", { status: 500, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(accessToken);
    if (authErr || !user) {
      console.error("send-push auth failed", {
        message: authErr?.message ?? "No user returned",
      });
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const {
      title,
      body,
      url: clickUrl,
      icon,
      badge,
      tag,
      requireInteraction,
      renotify,
      vibrate,
      actions,
      data,
    } = await req.json();

    // Use service role client to read partner subscriptions
    // Get partner id
    const { data: partnerRow } = await adminClient.rpc("get_partner_id", { _user_id: user.id });
    const partnerId = partnerRow as string | null;
    if (!partnerId) return new Response("No partner", { status: 200, headers: corsHeaders });

    // Get all push subscriptions for partner
    const { data: subs } = await adminClient
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key")
      .eq("user_id", partnerId);

    if (!subs?.length) return new Response("No subscriptions", { status: 200, headers: corsHeaders });

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidEmail = Deno.env.get("VAPID_EMAIL") ?? "support@usmoment.in";

    const payload = {
      title: title ?? "usMoment",
      body: body ?? "You have a new notification",
      icon: icon ?? "/pwa-icon-192.png",
      badge: badge ?? "/pwa-icon-192.png",
      url: clickUrl ?? "/dashboard",
      tag: tag ?? "usmoment-notification",
      requireInteraction: requireInteraction ?? false,
      renotify: renotify ?? false,
      vibrate: vibrate ?? [200, 100, 200],
      actions: Array.isArray(actions) ? actions : [],
      data: data && typeof data === "object" ? data : {},
    };

    await Promise.allSettled(
      subs.map(s => sendWebPush(s.endpoint, s.p256dh, s.auth_key, payload, vapidPublicKey, vapidPrivateKey, vapidEmail))
    );

    return new Response(JSON.stringify({ sent: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
