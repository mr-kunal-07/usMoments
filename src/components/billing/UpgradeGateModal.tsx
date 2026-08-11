import { Crown, Gem, HeartHandshake, X, Zap } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
    price: "₹29/mo",
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
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
        {/* Hero gradient strip */}
        <div className={cn("relative bg-gradient-to-br p-6 pb-5", meta.gradient)}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center mb-4 ring-1 ring-primary/20", meta.iconBg)}>
            <Icon className={cn("h-6 w-6", meta.iconColor)} strokeWidth={1.5} />
          </div>

          <h2 className="text-lg font-bold font-heading text-foreground leading-snug">
            Unlock {featureName}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            This feature is part of the{" "}
            <span className="font-semibold text-foreground">{meta.label}</span> plan
            and above.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 bg-card space-y-4">
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
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
              Maybe later
            </Button>
            <Button
              className="flex-1 rounded-xl gap-1.5 font-semibold"
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
