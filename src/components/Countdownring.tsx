import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { RING_MAX_DAYS } from "@/lib/Milestoneutils";

interface CountdownRingProps {
    days: number;
}

/**
 * Circular SVG countdown ring.
 * Ring fills proportionally based on how close the date is (relative to RING_MAX_DAYS).
 * Color shifts: gray → amber (≤30d) → rose (≤7d) → primary (today).
 */
export function CountdownRing({ days }: CountdownRingProps) {
    const pct = Math.max(0, Math.min(1, 1 - days / RING_MAX_DAYS));
    const r = 22;
    const circ = 2 * Math.PI * r;
    const dash = circ * pct;

    const isToday = days === 0;
    const isSoon = days <= 7;
    const isNear = days <= 30;

    const ringColor =
        isToday ? "hsl(var(--primary))"
            : isSoon ? "#f87171"
                : isNear ? "#fbbf24"
                    : "hsl(var(--muted-foreground))";

    const textColor =
        isToday ? "text-primary"
            : isSoon ? "text-rose-400"
                : isNear ? "text-amber-400"
                    : "text-muted-foreground";

    return (
        <div
            className="relative w-14 h-14 shrink-0 flex items-center justify-center"
            aria-label={isToday ? "Today!" : `${days} days away`}
            role="img"
        >
            <svg width="56" height="56" className="-rotate-90" viewBox="0 0 56 56" aria-hidden>
                <circle
                    cx="28" cy="28" r={r}
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="3"
                />
                <circle
                    cx="28" cy="28" r={r}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="3"
                    strokeDasharray={`${dash} ${circ}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.6s ease" }}
                />
            </svg>

            <div className={cn("absolute inset-0 flex flex-col items-center justify-center", textColor)}>
                {isToday ? (
                    <Heart className="h-4 w-4 fill-current" aria-hidden />
                ) : (
                    <>
                        <span className="text-[11px] font-bold leading-none">{days}</span>
                        <span className="text-[8px] opacity-70 leading-none mt-0.5">days</span>
                    </>
                )}
            </div>
        </div>
    );
}