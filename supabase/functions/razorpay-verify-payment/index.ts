import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { isBillingPlan, PLAN_CONFIG } from "../_shared/billing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function signaturesMatch(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

interface RazorpayOrder {
  id: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!keyId || !keySecret || !supabaseUrl || !serviceRoleKey) {
      console.error("razorpay-verify-payment is missing required server secrets");
      return json({ error: "Payment service is not configured" }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const orderId = typeof body?.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    const paymentId = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
    const signature = typeof body?.razorpay_signature === "string" ? body.razorpay_signature : "";
    if (!orderId || !paymentId || !signature) return json({ error: "Missing payment details" }, 400);

    const expectedSignature = await hmacSha256(keySecret, `${orderId}|${paymentId}`);
    if (!signaturesMatch(signature, expectedSignature)) {
      return json({ error: "Payment signature verification failed" }, 400);
    }

    const credentials = btoa(`${keyId}:${keySecret}`);
    const orderResponse = await fetch(
      `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,
      { headers: { Authorization: `Basic ${credentials}` } },
    );
    if (!orderResponse.ok) {
      console.error("Razorpay order lookup failed", { status: orderResponse.status });
      return json({ error: "Unable to validate payment order" }, 502);
    }

    const order = await orderResponse.json() as RazorpayOrder;
    const activePlan = order.notes?.plan;
    if (!isBillingPlan(activePlan) || order.notes?.user_id !== user.id) {
      return json({ error: "Payment order does not belong to this account" }, 403);
    }

    const expectedPlan = PLAN_CONFIG[activePlan];
    const isFullyPaid =
      order.id === orderId &&
      order.status === "paid" &&
      order.currency === expectedPlan.currency &&
      order.amount === expectedPlan.amount &&
      order.amount_paid === expectedPlan.amount;
    if (!isFullyPaid) return json({ error: "Payment order is not fully paid" }, 400);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

    const { error: upsertError } = await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan: activePlan,
        status: "active",
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_subscription_id: null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (upsertError) throw upsertError;

    return json({ success: true, plan: activePlan, period_end: periodEnd.toISOString() });
  } catch (error) {
    console.error("razorpay-verify-payment failed", error);
    return json({ error: "Unable to verify payment" }, 500);
  }
});
