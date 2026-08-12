import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { appConfig } from "@/lib/config";
import { APP_PATHS } from "@/app/router/paths";

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

class CheckoutError extends Error {
  constructor(
    message: string,
    readonly title = "Payment failed",
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

async function readOrderResponse(response: Response) {
  const data = await response.json().catch(() => null) as {
    error?: string;
    order_id?: string;
    amount?: number;
    currency?: string;
    key_id?: string;
    description?: string;
  } | null;

  if (response.status === 503) {
    throw new CheckoutError(
      "Payments are temporarily unavailable. Please try again later.",
      "Payments unavailable",
    );
  }
  if (!response.ok || data?.error) {
    throw new CheckoutError(data?.error || "Unable to start checkout");
  }
  if (!data?.order_id || !data.amount || !data.currency || !data.key_id) {
    throw new CheckoutError("The payment service returned an incomplete order");
  }

  return data as Required<Pick<typeof data, "order_id" | "amount" | "currency" | "key_id">> & typeof data;
}

export function useRazorpayCheckout() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const checkout = async (plan: BillingPlan) => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new CheckoutError("Sign in again before starting checkout", "Session expired");

      const orderRes = await fetch(
        `${appConfig.functionsUrl}/razorpay-create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan }),
        }
      );

      const orderData = await readOrderResponse(orderRes);
      await loadRazorpayScript();

      const returnTo = `${window.location.origin}${APP_PATHS.paymentReturn}`;
      const callbackUrl = new URL(`${appConfig.functionsUrl}/razorpay-payment-return`);
      callbackUrl.searchParams.set("return_to", returnTo);

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
      if (!(err instanceof CheckoutError)) console.error("Checkout error:", err);
      toast({
        title: err instanceof CheckoutError ? err.title : "Payment failed",
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
