/**
 * Client-side AES-256-GCM encryption for messages and notes.
 *
 * Strategy:
 *  - A per-couple symmetric key is derived deterministically from the
 *    couple_id using PBKDF2 (100 000 iterations, SHA-256).
 *  - The derived CryptoKey is cached in memory so derivation only
 *    happens once per session per couple.
 *  - Each encrypt call produces a fresh 96-bit IV; the wire format is
 *    base64( iv[12] || ciphertext ).
 *  - This protects database content at rest: even a full DB dump
 *    exposes no plaintext without knowing the couple_id + app salt.
 */

// App-level salt — not secret, just domain-separation.
const APP_SALT = "kunalkalynai-v1-couple-key";

// In-memory cache: coupleId → CryptoKey
const keyCache = new Map<string, CryptoKey>();

async function deriveKey(coupleId: string): Promise<CryptoKey> {
  if (keyCache.has(coupleId)) return keyCache.get(coupleId)!;

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(coupleId),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(APP_SALT),
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  keyCache.set(coupleId, key);
  return key;
}

/** Encrypt plaintext → base64(iv || ciphertext) */
export async function encryptText(plaintext: string, coupleId: string): Promise<string> {
  const key = await deriveKey(coupleId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  // Combine iv + ciphertext into a single Uint8Array
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  // Encode as base64 with a prefix so we can detect encrypted payloads
  return "enc:" + btoa(String.fromCharCode(...combined));
}

/** Decrypt base64(iv || ciphertext) → plaintext */
export async function decryptText(cipherBase64: string, coupleId: string): Promise<string> {
  // If not encrypted (legacy messages or plain text), return as-is
  if (!cipherBase64.startsWith("enc:")) return cipherBase64;

  try {
    const key = await deriveKey(coupleId);
    const binary = atob(cipherBase64.slice(4));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plainBuffer);
  } catch {
    // Decryption failed (wrong key or corrupt data) — surface a safe fallback
    return "🔒 Encrypted message";
  }
}

/** Convenience: decrypt an array of messages in parallel */
export async function decryptMessages<T extends { content: string }>(
  messages: T[],
  coupleId: string
): Promise<T[]> {
  return Promise.all(
    messages.map(async (m) => ({
      ...m,
      content: await decryptText(m.content, coupleId),
    }))
  );
}
