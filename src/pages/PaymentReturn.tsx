import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

function getErrorMessage(search: URLSearchParams) {
  return (
    search.get("error.description") ||
    search.get("error[description]") ||
    search.get("error_description") ||
    search.get("error.reason") ||
    search.get("error[reason]") ||
    search.get("error_reason")
  );
}

export default function PaymentReturn() {
  const { session, bootstrapping } = useAuth();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const didRun = useRef(false);

  useEffect(() => {
    if (bootstrapping || didRun.current) return;
    didRun.current = true;

    const finish = (title: string, description: string, destructive = false) => {
      toast({
        title,
        description,
        variant: destructive ? "destructive" : "default",
      });
      navigate("/dashboard/billing", { replace: true });
    };

    if (!session) {
      finish("Sign in required", "Please sign in again to complete payment verification.", true);
      navigate("/auth", { replace: true });
      return;
    }

    const razorpay_order_id = search.get("razorpay_order_id");
    const razorpay_payment_id = search.get("razorpay_payment_id");
    const razorpay_signature = search.get("razorpay_signature");
    const plan = search.get("plan") === "soulmate" ? "soulmate" : "dating";
    const paymentError = getErrorMessage(search);

    if (paymentError) {
      finish("Payment not completed", paymentError, true);
      return;
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      finish("Payment not completed", "We could not read the payment response from Razorpay.", true);
      return;
    }

    void (async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const verifyRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/razorpay-verify-payment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
              plan,
            }),
          }
        );

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || verifyData.error) {
          throw new Error(verifyData.error || "Payment verification failed");
        }

        await queryClient.invalidateQueries({ queryKey: ["subscription"] });
        await supabase.auth.getSession();

        const planLabel = plan === "soulmate" ? "Soulmate" : "Dating";
        finish(`${planLabel} plan activated`, "Payment verified. Welcome back.");
      } catch (error) {
        finish(
          "Verification failed",
          error instanceof Error ? error.message : "Something went wrong while verifying the payment.",
          true
        );
      }
    })();
  }, [bootstrapping, navigate, queryClient, search, session, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-sm w-full rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Returning to usMoments</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We are confirming your payment and bringing you back to billing.
        </p>
      </div>
    </div>
  );
}
