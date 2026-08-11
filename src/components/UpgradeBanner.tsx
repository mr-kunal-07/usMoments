import { useState } from "react";
import { X, Zap, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan, PLAN_UPLOAD_LIMIT } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

function useThisMonthUploadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["uploads-this-month", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("uploaded_by", user!.id)
        .gte("created_at", start.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });
}

interface Props {
  onUpgrade: () => void;
  selectedView?: string;
}

export function UpgradeBanner({ onUpgrade, selectedView }: Props) {
  const plan = usePlan();
  const [dismissed, setDismissed] = useState(false);
  const { data: usedCount = 0 } = useThisMonthUploadCount();

  // Only show for free (single) users on media views, not on non-media views
  const NON_MEDIA_VIEWS = ["chat", "activity", "billing", "settings", "recently-deleted", "timeline", "anniversaries", "stats", "bucket-list"];
  const limit = PLAN_UPLOAD_LIMIT.single!;
  const remaining = Math.max(0, limit - usedCount);
  if (plan !== "single" || dismissed || remaining > 10 || (selectedView && NON_MEDIA_VIEWS.includes(selectedView))) return null;

  const pct = Math.min(100, (usedCount / limit) * 100);

  const isWarning = remaining <= 10;
  const isEmpty = remaining === 0;

  return (
    <div
      className={cn(
        "mx-4 sm:mx-6 mt-3 mb-0 flex items-center gap-3 rounded-xl border px-4 py-3 transition-all",
        isEmpty
          ? "border-destructive/30 bg-destructive/5"
          : isWarning
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-primary/20 bg-primary/5"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
          isEmpty ? "bg-destructive/15" : isWarning ? "bg-amber-500/15" : "bg-primary/15"
        )}
      >
        <Upload
          className={cn(
            "h-4 w-4",
            isEmpty ? "text-destructive" : isWarning ? "text-amber-500" : "text-primary"
          )}
        />
      </div>

      {/* Text + bar */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground leading-tight">
          {isEmpty
            ? "You've used all your uploads this month 😔"
            : `${remaining} upload${remaining !== 1 ? "s" : ""} left this month`}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[160px]">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isEmpty ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {usedCount} / {limit}
          </span>
        </div>
      </div>

      {/* CTA */}
      <Button
        size="sm"
        onClick={onUpgrade}
        className={cn(
          "shrink-0 gap-1.5 text-xs",
          isEmpty || isWarning
            ? "bg-amber-500 hover:bg-amber-600 text-white border-0"
            : ""
        )}
      >
        <Zap className="h-3.5 w-3.5" />
        Upgrade
      </Button>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
