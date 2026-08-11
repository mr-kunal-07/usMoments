import { useMemo } from "react";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { Upload, MessageCircleHeart, Smile, Trophy, Activity, Video } from "lucide-react";
import { useActivityFeed, ActivityItem } from "@/hooks/useActivityFeed";
import { useAllProfiles } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { getPublicUrl } from "@/hooks/useMedia";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* ── Constants ───────────────────────────────────────────────────── */

const ICON_CONFIG = {
  upload: { icon: Upload, bg: "bg-primary/10", color: "text-primary" },
  note: { icon: MessageCircleHeart, bg: "bg-pink-500/10", color: "text-pink-500" },
  reaction: { icon: Smile, bg: "bg-yellow-500/10", color: "text-yellow-500" },
  milestone: { icon: Trophy, bg: "bg-amber-500/10", color: "text-amber-500" },
} as const satisfies Record<ActivityItem["type"], { icon: React.ComponentType<{ className?: string }>; bg: string; color: string }>;

/* ── Helpers ─────────────────────────────────────────────────────── */

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
}

function groupByDay(items: ActivityItem[]): { day: string; items: ActivityItem[] }[] {
  return items.reduce<{ day: string; items: ActivityItem[] }[]>((groups, item) => {
    const day = format(new Date(item.created_at), "yyyy-MM-dd");
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
    return groups;
  }, []);
}

function getDescription(item: ActivityItem): string {
  switch (item.type) {
    case "upload":
      return `uploaded "${item.media_title ?? "a file"}"`;
    case "note":
      return `left a note on "${item.media_title ?? "a photo"}"`;
    case "reaction":
      return `reacted ${item.emoji ?? ""} to "${item.media_title ?? "a photo"}"`;
    case "milestone":
      return `added ${item.milestone_type === "anniversary" ? "an anniversary" : "a milestone"} "${item.milestone_title ?? ""}"`;
    default:
      return "";
  }
}

/* ── Sub-components ──────────────────────────────────────────────── */

function ActivityIconBubble({ type }: { type: ActivityItem["type"] }) {
  const cfg = ICON_CONFIG[type];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <div className={cn("h-8 w-8 sm:h-7 sm:w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5", cfg.bg)}>
      <Icon className={cn("h-4 w-4 sm:h-3.5 sm:w-3.5", cfg.color)} />
    </div>
  );
}

function MediaThumbnail({ filePath, fileType }: { filePath: string; fileType?: string | null }) {
  if (fileType === "video") {
    return (
      <div className="h-11 w-11 sm:h-10 sm:w-10 rounded-xl bg-muted flex items-center justify-center border border-border/50 shrink-0">
        <Video className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={getPublicUrl(filePath)}
      alt=""
      className="h-11 w-11 sm:h-10 sm:w-10 rounded-xl object-cover border border-border/50 shrink-0"
      loading="lazy"
      decoding="async"
    />
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
      <div className="flex-1 h-px bg-border/60" />
      <span className="text-[11px] text-muted-foreground font-medium px-1 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-border/60" />
    </div>
  );
}

function ActivityRow({
  item,
  profileMap,
  currentUserId,
}: {
  item: ActivityItem;
  profileMap: Record<string, string>;
  currentUserId: string | undefined;
}) {
  const isMe = item.actor_id === currentUserId;
  const actorName = isMe ? "You" : (profileMap[item.actor_id] ?? "Partner");
  const description = getDescription(item);
  const time = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
  const hasThumbnail =
    (item.type === "upload" || item.type === "note" || item.type === "reaction") &&
    !!item.media_file_path;

  return (
    <div className="flex items-start gap-3 py-3 sm:py-2.5">
      <ActivityIconBubble type={item.type} />

      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">
          <span className="font-semibold">{actorName}</span>{" "}
          <span className="text-muted-foreground">{description}</span>
        </p>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">{time}</p>
      </div>

      {hasThumbnail && (
        <MediaThumbnail
          filePath={item.media_file_path!}
          fileType={item.media_file_type}
        />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 max-w-2xl">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 sm:h-7 sm:w-7 rounded-full shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
        <Activity className="h-6 w-6 text-muted-foreground opacity-50" />
      </div>
      <div>
        <p className="font-semibold text-foreground">No activity yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a photo or leave a note to get started.
        </p>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────── */

export function ActivityFeed() {
  const { user } = useAuth();
  const { data: activityItems = [], isLoading } = useActivityFeed();
  const { data: profiles = [] } = useAllProfiles();

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.user_id, p.display_name ?? "Partner"])),
    [profiles]
  );

  const groups = useMemo(() => groupByDay(activityItems), [activityItems]);

  if (isLoading) return <LoadingSkeleton />;
  if (activityItems.length === 0) return <EmptyState />;

  return (
    <div className="max-w-2xl w-full">
      {groups.map((group) => (
        <div key={group.day}>
          <DaySeparator label={formatDay(group.items[0].created_at)} />
          <div className="divide-y divide-border/40">
            {group.items.map((item) => (
              <ActivityRow
                key={item.id}
                item={item}
                profileMap={profileMap}
                currentUserId={user?.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}