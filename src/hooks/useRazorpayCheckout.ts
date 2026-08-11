import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler?: (response: RazorpayResponse) => void;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
  callback_url?: string;
  redirect?: boolean;
  config?: {
    display?: {
      blocks?: Record<string, { name: string; instruments: Array<{ method: string }> }>;
      hide?: Array<{ method: string }>;
      sequence?: string[];
      preferences?: { show_default_blocks?: boolean };
    };
  };
}

interface RazorpayInstance {
  open: () => void;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export type BillingPlan = "dating" | "soulmate";

export function useRazorpayCheckout() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const checkout = async (plan: BillingPlan) => {
    if (!user) return;
    setLoading(true);

    try {
      await loadRazorpayScript();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const orderRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/razorpay-create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan }),
        }
      );

      const orderData = await orderRes.json();
      if (!orderRes.ok || orderData.error) {
        throw new Error(orderData.error || "Failed to create order");
      }

      const returnTo = `${window.location.origin}/payment-return`;
      const callbackUrl = new URL(`https://${projectId}.supabase.co/functions/v1/razorpay-payment-return`);
      callbackUrl.searchParams.set("return_to", returnTo);
      callbackUrl.searchParams.set("plan", plan);

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "CoupleVault",
          description: orderData.description,
          order_id: orderData.order_id,
          prefill: { email: user.email },
          theme: { color: "#d4b896" },
          callback_url: callbackUrl.toString(),
          redirect: true,
          config: {
            display: {
              blocks: {
                upi: {
                  name: "Pay via UPI",
                  instruments: [{ method: "upi" }],
                },
              },
              hide: [
                { method: "card" },
                { method: "netbanking" },
                { method: "wallet" },
                { method: "emi" },
                { method: "paylater" },
              ],
              sequence: ["block.upi"],
              preferences: {
                show_default_blocks: false,
              },
            },
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
              resolve();
            },
          },
        });
        rzp.open();
      });
    } catch (err) {
      console.error("Checkout error:", err);
      toast({
        title: "Payment failed",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return { checkout, loading };
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(script);
  });
}
