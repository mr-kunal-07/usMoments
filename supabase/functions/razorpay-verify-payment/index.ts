import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hmacSHA256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const json = (data: unknown, status = 200, extra = corsHeaders) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...extra, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RAZORPAY_KEY_SECRET) throw new Error("RAZORPAY_KEY_SECRET not configured");
    if (!SUPABASE_URL) throw new Error("SUPABASE_URL not configured");
    if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const {
      razorpay_payment_id,
      razorpay_signature,
      razorpay_subscription_id, // subscription flow
      razorpay_order_id,        // fallback one-time order flow
      plan,
    } = await req.json();

    if (!razorpay_payment_id || !razorpay_signature) {
      return json({ error: "Missing payment details" }, 400);
    }

    const validPlans = ["dating", "soulmate"];
    const activePlan = validPlans.includes(plan) ? plan : "dating";

    // Signature message differs between subscription and order flows
    const message = razorpay_subscription_id
      ? `${razorpay_payment_id}|${razorpay_subscription_id}`
      : `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = await hmacSHA256(RAZORPAY_KEY_SECRET, message);

    if (expectedSignature !== razorpay_signature) {
      return json({ error: "Payment signature verification failed" }, 400);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan: activePlan,
          status: "active",
          razorpay_order_id: razorpay_order_id ?? null,
          razorpay_payment_id,
          razorpay_subscription_id: razorpay_subscription_id ?? null,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) throw new Error(`Failed to activate subscription: ${upsertError.message}`);

    return json({ success: true, plan: activePlan, period_end: periodEnd.toISOString() });

  } catch (err) {
    console.error("razorpay-verify-payment error:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
});
