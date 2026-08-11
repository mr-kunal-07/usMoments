import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_CONFIG = {
    dating: {
        amount: 100, // ₹29 in paise
        description: "Dating Plan - Monthly",
        plan_id: Deno.env.get("RAZORPAY_DATING_PLAN_ID") ?? "",
    },
    soulmate: {
        amount: 9900, // ₹99 in paise
        description: "Soulmate Plan - Monthly",
        plan_id: Deno.env.get("RAZORPAY_SOULMATE_PLAN_ID") ?? "",
    },
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Auth check
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Missing authorization" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Parse body
        const { plan } = await req.json();
        if (!plan || !PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]) {
            return new Response(JSON.stringify({ error: "Invalid plan" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG];
        const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
        const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
        const credentials = btoa(`${keyId}:${keySecret}`);

        // Create Razorpay subscription
        const razorpayRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${credentials}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                plan_id: planConfig.plan_id,
                total_count: 12, // 12 months
                quantity: 1,
                customer_notify: 1,
                notes: {
                    user_id: user.id,
                    plan,
                },
            }),
        });

        const subscription = await razorpayRes.json();

        if (!razorpayRes.ok || subscription.error) {
            console.error("Razorpay error:", subscription);
            return new Response(
                JSON.stringify({ error: subscription.error?.description ?? "Failed to create subscription" }),
                {
                    status: 500,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                }
            );
        }

        return new Response(
            JSON.stringify({
                key_id: keyId,
                subscription_id: subscription.id,
                amount: planConfig.amount,
                currency: "INR",
                description: planConfig.description,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );

    } catch (err) {
        console.error("Unexpected error:", err);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});