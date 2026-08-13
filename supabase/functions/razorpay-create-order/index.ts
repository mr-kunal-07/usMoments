import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isBillingPlan, PLAN_CONFIG } from "../_shared/billing.ts";
import { getCorsHeaders, isAllowedOrigin } from "../_shared/cors.ts";

const json = (req: Request, data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(req, "POST, OPTIONS"), "Content-Type": "application/json" },
  });

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
      console.error("razorpay-create-order is missing Supabase server configuration");
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
      console.error("razorpay-create-order is missing Razorpay server configuration");
      return json(req, { error: "Payment service is not configured" }, 503);
    }

    const body = await req.json().catch(() => null) as { plan?: unknown } | null;
    if (!isBillingPlan(body?.plan)) return json(req, { error: "Invalid billing plan" }, 400);

    const plan = body.plan;
    const pricing = PLAN_CONFIG[plan];
    const credentials = btoa(`${keyId}:${keySecret}`);
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: pricing.amount,
        currency: pricing.currency,
        receipt: `receipt_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id: user.id,
          plan,
          description: pricing.description,
        },
      }),
    });

    const order = await orderResponse.json();
    if (!orderResponse.ok) {
      console.error("Razorpay order creation failed", { status: orderResponse.status });
      return json(req, { error: "Unable to create payment order" }, 502);
    }

    return json(req, {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      plan,
      description: pricing.description,
    });
  } catch (error) {
    console.error("razorpay-create-order failed", error);
    return json(req, { error: "Unable to create payment order" }, 500);
  }
});
