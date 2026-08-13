import { Crown, Gem, HeartHandshake, X, Zap } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RequiredPlan = "dating" | "soulmate";

interface Props {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  featureName: string;
  requiredPlan: RequiredPlan;
}

const PLAN_META: Record<RequiredPlan, {
  label: string;
  price: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  gradient: string;
  perks: string[];
}> = {
  dating: {
    label: "Dating",
    price: "₹1/mo",
    icon: HeartHandshake,
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    gradient: "from-primary/5 to-primary/10",
    perks: ["Voice messages", "Emoji reactions", "10 GB shared storage", "Unlimited uploads"],
  },
  soulmate: {
    label: "Soulmate",
    price: "₹99/mo",
    icon: Gem,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    gradient: "from-primary/8 to-primary/15",
    perks: ["Everything in Dating", "50 GB shared storage", "All future features", "Priority support"],
  },
};

export function UpgradeGateModal({ open, onClose, onUpgrade, featureName, requiredPlan }: Props) {
  const meta = PLAN_META[requiredPlan];
  const Icon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="grid max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-sm grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl [&>button:last-child]:hidden">
        {/* Hero gradient strip */}
        <div className={cn("relative bg-gradient-to-br px-5 pb-4 pt-5 sm:p-6 sm:pb-5", meta.gradient)}>
          <DialogClose asChild>
            <button
              type="button"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/40 hover:text-foreground focus:outline-none focus-visible:bg-background/50 sm:right-4 sm:top-4"
              aria-label="Close upgrade dialog"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </DialogClose>

          <div className={cn("mb-3 flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-primary/20 sm:mb-4 sm:h-12 sm:w-12", meta.iconBg)}>
            <Icon className={cn("h-6 w-6", meta.iconColor)} strokeWidth={1.5} />
          </div>

          <DialogTitle className="pr-8 text-lg font-bold font-heading text-foreground leading-snug">
            Unlock {featureName}
          </DialogTitle>
          <DialogDescription className="mt-1 pr-2 text-sm leading-relaxed text-muted-foreground">
            This feature is part of the{" "}
            <span className="font-semibold text-foreground">{meta.label}</span> plan
            and above.
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="space-y-4 overflow-y-auto overscroll-contain bg-card px-5 py-4 sm:px-6 sm:py-5">
          {/* Perks */}
          <ul className="space-y-2">
            {meta.perks.map(perk => (
              <li key={perk} className="flex items-center gap-2.5 text-sm text-foreground">
                <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="h-3 w-3 text-primary" />
                </span>
                {perk}
              </li>
            ))}
          </ul>

          {/* Pricing note */}
          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            One subscription covers <strong>both partners</strong> — starting at{" "}
            <span className="font-semibold text-foreground">{meta.price}</span>.
          </p>

          {/* CTA */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="min-w-0 rounded-xl px-2" onClick={onClose}>
              Maybe later
            </Button>
            <Button
              className="min-w-0 gap-1.5 rounded-xl px-2 font-semibold"
              onClick={() => { onClose(); onUpgrade(); }}
            >
              <Crown className="h-4 w-4" />
              Upgrade
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
