import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { isBillingPlan, PLAN_CONFIG } from "../_shared/billing.ts";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";

const json = (req: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req, "POST, OPTIONS"), "Content-Type": "application/json" },
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
  const corsHeaders = getCorsHeaders(req, "POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: isAllowedOrigin(req.headers.get("Origin")) ? 204 : 403, headers: corsHeaders });
  }
  if (!isAllowedOrigin(req.headers.get("Origin"))) return json(req, { error: "Origin not allowed" }, 403);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("razorpay-verify-payment is missing Supabase server configuration");
      return json(req, { error: "Service is not configured" }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(req, { error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json(req, { error: "Unauthorized" }, 401);

    const keyId = Deno.env.get("RAZORPAY_KEY_ID");
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      console.error("razorpay-verify-payment is missing Razorpay server configuration");
      return json(req, { error: "Payment service is not configured" }, 503);
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const orderId = typeof body?.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    const paymentId = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
    const signature = typeof body?.razorpay_signature === "string" ? body.razorpay_signature : "";
    if (!orderId || !paymentId || !signature) return json(req, { error: "Missing payment details" }, 400);

    const expectedSignature = await hmacSha256(keySecret, `${orderId}|${paymentId}`);
    if (!signaturesMatch(signature, expectedSignature)) {
      return json(req, { error: "Payment signature verification failed" }, 400);
    }

    const credentials = btoa(`${keyId}:${keySecret}`);
    const orderResponse = await fetch(
      `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`,
      { headers: { Authorization: `Basic ${credentials}` } },
    );
    if (!orderResponse.ok) {
      console.error("Razorpay order lookup failed", { status: orderResponse.status });
      return json(req, { error: "Unable to validate payment order" }, 502);
    }

    const order = await orderResponse.json() as RazorpayOrder;
    const activePlan = order.notes?.plan;
    if (!isBillingPlan(activePlan) || order.notes?.user_id !== user.id) {
      return json(req, { error: "Payment order does not belong to this account" }, 403);
    }

    const expectedPlan = PLAN_CONFIG[activePlan];
    const isFullyPaid =
      order.id === orderId &&
      order.status === "paid" &&
      order.currency === expectedPlan.currency &&
      order.amount === expectedPlan.amount &&
      order.amount_paid === expectedPlan.amount;
    if (!isFullyPaid) return json(req, { error: "Payment order is not fully paid" }, 400);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

    const { data: subscription, error: upsertError } = await supabase.from("subscriptions").upsert(
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
    ).select().single();
    if (upsertError) throw upsertError;

    return json(req, {
      success: true,
      plan: activePlan,
      period_end: periodEnd.toISOString(),
      subscription,
    });
  } catch (error) {
    console.error("razorpay-verify-payment failed", error);
    return json(req, { error: "Unable to verify payment" }, 500);
  }
});
