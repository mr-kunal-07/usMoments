import { useCallback, useRef, useState } from "react";
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

const ORDER_TIMEOUT_MS = 15_000;
const SDK_TIMEOUT_MS = 12_000;

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

async function createOrder(plan: BillingPlan, accessToken: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ORDER_TIMEOUT_MS);

  try {
    return await fetch(`${appConfig.functionsUrl}/razorpay-create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ plan }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CheckoutError("The payment service took too long to respond. Please retry.", "Checkout timed out");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function useRazorpayCheckout() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const checkoutInProgress = useRef(false);

  const checkout = useCallback(async (plan: BillingPlan) => {
    if (!user || checkoutInProgress.current) return;
    checkoutInProgress.current = true;
    setLoading(true);

    try {
      if (!session) throw new CheckoutError("Sign in again before starting checkout", "Session expired");

      const [orderRes] = await Promise.all([
        createOrder(plan, session.access_token),
        loadRazorpayScript(),
      ]);
      const orderData = await readOrderResponse(orderRes);

      const returnTo = `${window.location.origin}${APP_PATHS.paymentReturn}`;
      const callbackUrl = new URL(`${appConfig.functionsUrl}/razorpay-payment-return`);
      callbackUrl.searchParams.set("return_to", returnTo);

      await new Promise<void>((resolve) => {
        const rzp = new window.Razorpay({
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "usMoments",
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
              checkoutInProgress.current = false;
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
      checkoutInProgress.current = false;
      setLoading(false);
    }
  }, [session, toast, user]);

  return { checkout, loading };
}

let razorpayScriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    const timeoutId = window.setTimeout(() => {
      script.remove();
      razorpayScriptPromise = null;
      reject(new CheckoutError("Razorpay could not load on this connection. Please retry.", "Checkout timed out"));
    }, SDK_TIMEOUT_MS);
    script.onload = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeoutId);
      razorpayScriptPromise = null;
      reject(new CheckoutError("Razorpay could not load. Check your connection and retry."));
    };
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}
