import { useState, useEffect, useRef, useCallback } from "react";
import {
  Check, X, HardDrive, Mic, Upload, Crown, Sparkles, Zap, Heart,
  Sprout, HeartHandshake, Gem, ShieldCheck, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription, usePlan, useIsSharedPlan, Plan } from "@/hooks/useSubscription";
import { useRazorpayCheckout, BillingPlan } from "@/hooks/useRazorpayCheckout";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface FeatureRow {
  icon: React.ElementType;
  text: string;
  hint?: string;
  single: boolean | string;
  dating: boolean | string;
  soulmate: boolean | string;
}

const PLAN_ORDER: Plan[] = ["single", "dating", "soulmate"];

const FEATURES: FeatureRow[] = [
  { icon: HardDrive, text: "Shared storage", hint: "Both partners share the pool", single: "1 GB", dating: "10 GB", soulmate: "50 GB" },
  { icon: Upload, text: "Monthly uploads", hint: "You + Partner combined", single: "50 + 50", dating: "Unlimited", soulmate: "Unlimited" },
  { icon: Heart, text: "Partner access", single: true, dating: true, soulmate: true },
  { icon: Mic, text: "Voice messages", single: false, dating: true, soulmate: true },
  { icon: Zap, text: "Reactions", single: false, dating: true, soulmate: true },
  { icon: Sparkles, text: "Love Story Card", hint: "Generate & share your story", single: true, dating: true, soulmate: true },
  { icon: Crown, text: "All new features", single: false, dating: false, soulmate: true },
  { icon: Crown, text: "Priority support", single: false, dating: false, soulmate: true },
];

const PLAN_META: Record<Plan, {
  label: string;
  tagline: string;
  price: string | null;
  period: string;
  badge: string | null;
}> = {
  single: { label: "Single", tagline: "Explore the platform.", price: null, period: "forever free", badge: null },
  dating: { label: "Dating", tagline: "Unlock more experiences together.", price: "Rs29", period: "/ month", badge: "Best value" },
  soulmate: { label: "Soulmate", tagline: "Everything for the perfect connection.", price: "Rs99", period: "/ month", badge: "Most popular" },
};

const PLAN_ICON_CONFIG: Record<Plan, {
  Icon: React.ElementType;
  bg: string;
  ring: string;
  iconColor: string;
  glow?: string;
}> = {
  single: { Icon: Sprout, bg: "bg-muted/60", ring: "ring-1 ring-border", iconColor: "text-muted-foreground" },
  dating: { Icon: HeartHandshake, bg: "bg-primary/10", ring: "ring-1 ring-primary/20", iconColor: "text-primary" },
  soulmate: {
    Icon: Gem, bg: "bg-primary/15", ring: "ring-1 ring-primary/40", iconColor: "text-primary",
    glow: "shadow-[0_0_18px_hsl(var(--primary)/0.35)]",
  },
};

function PlanIcon({ planId, active }: { planId: Plan; active: boolean }) {
  const { Icon, bg, ring, iconColor, glow } = PLAN_ICON_CONFIG[planId];
  return (
    <div className={cn(
      "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-all",
      bg, ring, glow, active && "scale-105"
    )}>
      <Icon className={cn("h-5 w-5", iconColor)} strokeWidth={1.75} />
    </div>
  );
}

function FeatureValue({ val }: { val: boolean | string }) {
  if (val === false) return <X className="h-3.5 w-3.5 text-muted-foreground/25 mx-auto" />;
  if (val === true) return <Check className="h-3.5 w-3.5 text-primary mx-auto" />;
  return <span className="text-xs font-semibold text-foreground">{val}</span>;
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/10 border border-primary/20 text-sm">
        {children}
      </div>
    </div>
  );
}

function FeatureListItem({ row, planId }: { row: FeatureRow; planId: Plan }) {
  const { icon: Icon, text, hint } = row;
  const val = row[planId];
  const active = val !== false;
  return (
    <li className={cn("flex items-start gap-2.5 text-xs", active ? "text-foreground" : "text-muted-foreground/40")}>
      <div className={cn("h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-px", active ? "bg-primary/10" : "bg-muted/30")}>
        <Icon className={cn("h-3 w-3", active ? "text-primary" : "text-muted-foreground/40")} />
      </div>
      <div className="flex-1 min-w-0">
        <span>{text}</span>
        {hint && <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-tight">{hint}</p>}
      </div>
      <span className="shrink-0">
        <FeatureValue val={val} />
      </span>
    </li>
  );
}

function MobilePlanDots({
  scrollRef,
  planCount,
  initialIdx,
}: {
  scrollRef: React.RefObject<HTMLDivElement>;
  planCount: number;
  initialIdx: number;
}) {
  const [activeIdx, setActiveIdx] = useState(initialIdx);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const cards = Array.from(scrollEl.children) as HTMLElement[];
    const observers: IntersectionObserver[] = cards.map((card, i) => {
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting && entry.intersectionRatio >= 0.5) setActiveIdx(i); },
        { root: scrollEl, threshold: 0.5 }
      );
      obs.observe(card);
      return obs;
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [scrollRef]);

  return (
    <div className="flex sm:hidden items-center justify-center gap-1.5 mt-3" aria-hidden>
      {Array.from({ length: planCount }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-full transition-all duration-300",
            i === activeIdx ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

function PlanCard({
  planId,
  currentPlan,
  currentPlanIndex,
  onCheckout,
  checkingOut,
}: {
  planId: Plan;
  currentPlan: Plan;
  currentPlanIndex: number;
  onCheckout: (p: BillingPlan) => Promise<void>;
  checkingOut: BillingPlan | null;
}) {
  const meta = PLAN_META[planId];
  const isCurrent = currentPlan === planId;
  const isDowngrade = PLAN_ORDER.indexOf(planId) < currentPlanIndex;
  const isBilling = planId === "dating" || planId === "soulmate";
  const isHighlight = planId === "soulmate";
  const isLoading = checkingOut === planId;

  return (
    <div className={cn(
      "snap-center shrink-0 w-[82vw] sm:w-auto",
      "relative flex flex-col rounded-2xl p-5 sm:p-6 transition-all duration-200 bg-card border",
      isHighlight ? "border-primary/40 shadow-[0_0_40px_hsl(var(--primary)/0.08)]"
        : isCurrent ? "border-primary/30"
          : "border-border",
    )}>
      {meta.badge && (
        <div className="absolute -top-3.5 inset-x-0 flex justify-center">
          <Badge className="bg-primary text-primary-foreground text-[11px] font-semibold px-3 py-1 rounded-full shadow-md">
            {meta.badge}
          </Badge>
        </div>
      )}

      <div className="mb-5">
        <div className="flex items-center gap-3 mb-3">
          <PlanIcon planId={planId} active={isCurrent} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold font-heading text-base text-foreground">{meta.label}</span>
              {isCurrent && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Active</Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{meta.tagline}</p>
          </div>
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className={cn("font-bold font-heading tracking-tight text-foreground", meta.price ? "text-4xl" : "text-3xl")}>
            {meta.price ?? "Free"}
          </span>
          {meta.price
            ? <span className="text-sm text-muted-foreground">{meta.period}</span>
            : <p className="text-xs text-muted-foreground mt-0.5">{meta.period}</p>
          }
        </div>
      </div>

      <ul className="space-y-2.5 flex-1 mb-6">
        {FEATURES.map((row) => (
          <FeatureListItem key={row.text} row={row} planId={planId} />
        ))}
      </ul>

      {isCurrent ? (
        <Button variant="outline" className="w-full rounded-xl" disabled>
          Current plan
        </Button>
      ) : isDowngrade ? (
        <Button variant="ghost" className="w-full rounded-xl text-muted-foreground text-xs" disabled>
          Downgrade
        </Button>
      ) : isBilling ? (
        <>
          <Button
            className="w-full rounded-xl gap-2 font-semibold"
            variant={isHighlight ? "default" : "outline"}
            onClick={() => onCheckout(planId as BillingPlan)}
            disabled={checkingOut !== null}
            size="lg"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <>
                {isHighlight ? <Crown className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
                {`Pay with UPI · ${meta.price}`}
              </>
            )}
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function BillingView() {
  const plan = usePlan();
  const isShared = useIsSharedPlan();
  const { data: subscription } = useSubscription();
  const { checkout } = useRazorpayCheckout();
  const [checkingOut, setCheckingOut] = useState<BillingPlan | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentPlanIndex = PLAN_ORDER.indexOf(plan);
  const initialScrollIdx = Math.max(0, currentPlanIndex);

  const handleCheckout = useCallback(async (p: BillingPlan) => {
    setCheckingOut(p);
    try {
      await checkout(p);
    } finally {
      setCheckingOut(null);
    }
  }, [checkout]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10 px-1">
      <div className="text-center space-y-1 pt-3">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-primary">
          Plans & Pricing
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold font-heading tracking-tight text-foreground">
          Choose your story
        </h2>
        <p className="text-[13px] text-muted-foreground max-w-xs mx-auto">
          One plan covers both of you. Pay with UPI and unlock premium together.
        </p>
      </div>

      {isShared && (
        <InfoBanner>
          <Users className="h-4 w-4 text-primary shrink-0" />
          <span className="text-foreground font-medium">Your partner covers this plan</span>
        </InfoBanner>
      )}

      {!isShared && plan !== "single" && subscription?.current_period_end && (
        <InfoBanner>
          <PlanIcon planId={plan} active />
          <span className="font-medium text-foreground">{PLAN_META[plan].label} plan active</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            Renews {format(new Date(subscription.current_period_end), "MMM d, yyyy")}
          </span>
        </InfoBanner>
      )}

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground">Plans are shared between partners</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            If either of you upgrades, both of you enjoy the same benefits instantly.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">UPI checkout</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          On supported Android mobile browsers, Razorpay can hand off to Google Pay or PhonePe. On desktop it can show a UPI QR that also works with Paytm and other UPI apps.
        </p>
      </div>

      <div className="relative">
        <div
          ref={scrollRef}
          className={cn(
            "flex sm:grid sm:grid-cols-3 gap-4 sm:gap-5",
            "overflow-x-auto sm:overflow-visible",
            "snap-x snap-mandatory sm:snap-none",
            "-mx-3 px-3 sm:mx-0 sm:px-0",
            "pb-3 sm:pb-0",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {PLAN_ORDER.map((planId) => (
            <PlanCard
              key={planId}
              planId={planId}
              currentPlan={plan}
              currentPlanIndex={currentPlanIndex}
              onCheckout={handleCheckout}
              checkingOut={checkingOut}
            />
          ))}
        </div>

        <MobilePlanDots
          scrollRef={scrollRef}
          planCount={PLAN_ORDER.length}
          initialIdx={initialScrollIdx}
        />
      </div>

      <div className="hidden sm:block rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <h3 className="text-sm font-semibold font-heading text-foreground">Full feature comparison</h3>
          <span className="text-xs text-muted-foreground">applies to both partners</span>
        </div>

        <div className="grid grid-cols-4 border-b border-border">
          <div className="px-6 py-3" />
          {PLAN_ORDER.map((planId) => (
            <div key={planId} className={cn("px-4 py-3 text-center", plan === planId && "bg-primary/5")}>
              <div className="flex flex-col items-center gap-1.5">
                <PlanIcon planId={planId} active={plan === planId} />
                <p className={cn("text-xs font-semibold", plan === planId ? "text-primary" : "text-muted-foreground")}>
                  {PLAN_META[planId].label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {FEATURES.map(({ icon: Icon, text, hint, ...vals }, i) => (
          <div
            key={text}
            className={cn(
              "grid grid-cols-4 border-b border-border/50 last:border-0",
              i % 2 !== 0 && "bg-muted/20",
            )}
          >
            <div className="px-6 py-3.5 flex items-start gap-2.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-xs text-muted-foreground">{text}</span>
                {hint && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{hint}</p>}
              </div>
            </div>
            {PLAN_ORDER.map((planId) => (
              <div key={planId} className={cn("px-4 py-3.5 flex items-center justify-center", plan === planId && "bg-primary/5")}>
                <FeatureValue val={vals[planId as keyof typeof vals] as boolean | string} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h4 className="text-sm font-semibold text-foreground font-heading">Good to know</h4>
        <ul className="space-y-2 text-xs text-muted-foreground">
          {[
            "One subscription covers both partners - only one of you needs to pay.",
            "Free plan gives 50 uploads/month each (You + Partner = 100 total).",
            "Storage is shared - both partners' uploads count towards the same pool.",
            "UPI checkout supports mobile intent where available and shows QR on desktop.",
          ].map((note) => (
            <li key={note} className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-2 flex items-center justify-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5" />
        End-to-end encrypted storage.
      </p>
    </div>
  );
}
