import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Crown,
  Gem,
  HardDrive,
  Heart,
  HeartHandshake,
  Loader2,
  Mic,
  ShieldCheck,
  Sparkles,
  Sprout,
  Upload,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRazorpayCheckout, type BillingPlan } from "@/hooks/useRazorpayCheckout";
import { useBillingSummary, type Plan } from "@/hooks/useSubscription";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";

interface Feature {
  icon: React.ElementType;
  label: string;
  values: Record<Plan, string | boolean>;
}

interface PlanMeta {
  label: string;
  price: string;
  period: string;
  description: string;
  badge?: string;
  Icon: React.ElementType;
}

const PLAN_ORDER: Plan[] = ["single", "dating", "soulmate"];

const PLAN_META: Record<Plan, PlanMeta> = {
  single: {
    label: "Single",
    price: "Free",
    period: "forever",
    description: "Start your shared space.",
    Icon: Sprout,
  },
  dating: {
    label: "Dating",
    price: "Rs 1",
    period: "per month",
    description: "More ways to stay close.",
    badge: "Best value",
    Icon: HeartHandshake,
  },
  soulmate: {
    label: "Soulmate",
    price: "Rs 99",
    period: "per month",
    description: "The complete usMoments experience.",
    badge: "Everything included",
    Icon: Gem,
  },
};

const FEATURES: Feature[] = [
  { icon: HardDrive, label: "Shared storage", values: { single: "1 GB", dating: "10 GB", soulmate: "50 GB" } },
  { icon: Upload, label: "Monthly uploads", values: { single: "50 each", dating: "Unlimited", soulmate: "Unlimited" } },
  { icon: Heart, label: "Partner access", values: { single: true, dating: true, soulmate: true } },
  { icon: Mic, label: "Voice messages", values: { single: false, dating: true, soulmate: true } },
  { icon: Zap, label: "Emoji reactions", values: { single: false, dating: true, soulmate: true } },
  { icon: Sparkles, label: "Love Story Card", values: { single: true, dating: true, soulmate: true } },
  { icon: Crown, label: "All future features", values: { single: false, dating: false, soulmate: true } },
  { icon: ShieldCheck, label: "Priority support", values: { single: false, dating: false, soulmate: true } },
];

function getRecommendedPlan(currentPlan: Plan): Plan {
  if (currentPlan === "single") return "dating";
  if (currentPlan === "dating") return "soulmate";
  return "soulmate";
}

function getRenewalLabel(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : ` - renews ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date)}`;
}

function FeatureItem({ feature, plan }: { feature: Feature; plan: Plan }) {
  const Icon = feature.icon;
  const value = feature.values[plan];
  const available = value !== false;

  return (
    <li className={cn("flex min-h-8 items-center gap-2.5 text-sm", !available && "text-muted-foreground/45")}>
      <span className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
        available ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground/40",
      )}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">{feature.label}</span>
      {typeof value === "string" ? (
        <span className="shrink-0 text-xs font-semibold text-foreground">{value}</span>
      ) : available ? (
        <Check className="h-4 w-4 shrink-0 text-primary" aria-label="Included" />
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground/50">Not included</span>
      )}
    </li>
  );
}

interface PlanCardProps {
  planId: Plan;
  currentPlan: Plan;
  checkingOut: BillingPlan | null;
  onCheckout: (plan: BillingPlan) => Promise<void>;
  featured?: boolean;
}

function PlanCard({ planId, currentPlan, checkingOut, onCheckout, featured }: PlanCardProps) {
  const meta = PLAN_META[planId];
  const Icon = meta.Icon;
  const isCurrent = planId === currentPlan;
  const isPaid = planId !== "single";
  const isDowngrade = PLAN_ORDER.indexOf(planId) < PLAN_ORDER.indexOf(currentPlan);
  const isLoading = checkingOut === planId;

  return (
    <section className={cn(
      "relative flex min-w-0 flex-col overflow-hidden rounded-md border bg-card",
      featured ? "border-primary/45" : "border-border",
      isCurrent && "border-primary/35",
    )} aria-label={`${meta.label} plan`}>
      <div className="border-b border-border/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md ring-1",
            planId === "single"
              ? "bg-muted/60 text-muted-foreground ring-border"
              : "bg-primary/10 text-primary ring-primary/20",
          )}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-heading text-base font-bold text-foreground">{meta.label}</h3>
              {isCurrent && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">Current</Badge>}
              {!isCurrent && meta.badge && <Badge className="h-5 px-1.5 text-[10px]">{meta.badge}</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
          </div>
        </div>

        <div className="mt-4 flex items-end gap-1.5">
          <span className="font-heading text-3xl font-bold tracking-tight text-foreground">{meta.price}</span>
          <span className="pb-1 text-xs text-muted-foreground">{meta.period}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <ul className="flex-1 space-y-1.5">
          {FEATURES.map((feature) => <FeatureItem key={feature.label} feature={feature} plan={planId} />)}
        </ul>

        <div className="mt-5">
          {isCurrent ? (
            <Button variant="outline" className="h-10 w-full rounded-md" disabled>
              Current plan
            </Button>
          ) : isDowngrade || !isPaid ? (
            <Button variant="ghost" className="h-10 w-full rounded-md text-muted-foreground" disabled>
              {isDowngrade ? "Downgrade unavailable" : "Free plan"}
            </Button>
          ) : (
            <Button
              className="h-10 w-full gap-2 rounded-md font-semibold"
              variant={featured ? "default" : "outline"}
              onClick={() => onCheckout(planId)}
              disabled={checkingOut !== null}
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Starting checkout</>
              ) : (
                <><Crown className="h-4 w-4" /> Choose {meta.label}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

export function BillingView() {
  const isMobile = useIsMobile();
  const { currentPlan, isShared, subscription } = useBillingSummary();
  const { checkout } = useRazorpayCheckout();
  const [checkingOut, setCheckingOut] = useState<BillingPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan>(() => getRecommendedPlan(currentPlan));

  useEffect(() => {
    setSelectedPlan(getRecommendedPlan(currentPlan));
  }, [currentPlan]);

  const handleCheckout = useCallback(async (plan: BillingPlan) => {
    setCheckingOut(plan);
    try {
      await checkout(plan);
    } finally {
      setCheckingOut(null);
    }
  }, [checkout]);

  return (
    <div className="mx-auto w-full max-w-5xl pb-6 sm:pb-10">
      <div className="border-b border-border/70 px-1 pb-4 pt-1 sm:pb-5 sm:pt-2">
        <h2 className="font-heading text-xl font-bold text-foreground sm:text-2xl">Choose your plan</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          One subscription covers both partners. Secure UPI payment through Razorpay.
        </p>
        <p className="mt-2 text-xs font-medium text-primary">
          Current: {PLAN_META[currentPlan].label}
          {isShared ? " - shared by your partner" : getRenewalLabel(subscription?.current_period_end)}
        </p>
      </div>

      {isMobile && <div className="mt-4">
        <div className="grid grid-cols-3 gap-1 rounded-md bg-muted/70 p-1" aria-label="Choose a plan">
          {PLAN_ORDER.map((planId) => (
            <button
              key={planId}
              type="button"
              onClick={() => setSelectedPlan(planId)}
              aria-pressed={selectedPlan === planId}
              className={cn(
                "min-w-0 rounded-md px-1 py-2.5 text-xs font-semibold transition-colors",
                selectedPlan === planId
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {PLAN_META[planId].label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <PlanCard
            planId={selectedPlan}
            currentPlan={currentPlan}
            checkingOut={checkingOut}
            onCheckout={handleCheckout}
            featured={selectedPlan === getRecommendedPlan(currentPlan)}
          />
        </div>
      </div>}

      {!isMobile && <div className="mt-7 grid grid-cols-3 items-stretch gap-4 lg:gap-5">
        {PLAN_ORDER.map((planId) => (
          <PlanCard
            key={planId}
            planId={planId}
            currentPlan={currentPlan}
            checkingOut={checkingOut}
            onCheckout={handleCheckout}
            featured={planId === getRecommendedPlan(currentPlan)}
          />
        ))}
      </div>}

      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Private storage - one payment covers both partners
      </p>
    </div>
  );
}
