import { format } from "date-fns";
import { Clock, Trash2 } from "lucide-react";
import { Milestone } from "@/hooks/useMilestones";
import { getPublicUrl } from "@/hooks/useMedia";
import { MediaMap } from "@/lib/Milestoneutils";

interface MilestoneTimelineCardProps {
    milestone: Milestone;
    mediaMap: MediaMap;
    onDelete: () => void;
    canDelete: boolean;
    /**
     * When true, the connector line below the dot is omitted so the last
     * item in the timeline doesn't have a dangling line.
     */
    isLast: boolean;
}

export function MilestoneTimelineCard({
    milestone,
    mediaMap,
    onDelete,
    canDelete,
    isLast,
}: MilestoneTimelineCardProps) {
    const photo = milestone.media_id ? mediaMap[milestone.media_id] : null;
    const dateObj = new Date(milestone.date);

    return (
        <div className="relative group">
            {/* Timeline dot — connector line omitted on last item */}
            <div className="absolute -left-6 top-4 flex flex-col items-center">
                <div
                    className="h-2.5 w-2.5 rounded-full border-2 border-amber-400 bg-background z-10"
                    aria-hidden
                />
                {/* FIX: only render the connecting line when this is NOT the last item */}
                {!isLast && (
                    <div className="w-px flex-1 min-h-[12px] bg-border/60 mt-0.5" aria-hidden />
                )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden transition-all hover:border-amber-400/30 hover:bg-card/80">
                <div className="flex items-stretch">
                    {/* Photo strip */}
                    {photo && (
                        <div className="w-16 shrink-0">
                            <img
                                src={getPublicUrl(photo.file_path)}
                                alt={photo.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}

                    <div className="flex-1 flex items-center gap-3 px-4 py-3.5 min-w-0">
                        {!photo && (
                            <div
                                className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 text-base"
                                aria-hidden
                            >
                                ⭐
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <p className="font-semibold font-heading text-sm text-foreground truncate">
                                {milestone.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                <Clock className="h-3 w-3 opacity-50" aria-hidden />
                                {format(dateObj, "MMMM d, yyyy")}
                            </p>
                            {milestone.description && (
                                <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                                    {milestone.description}
                                </p>
                            )}
                        </div>

                        {canDelete && (
                            <button
                                onClick={onDelete}
                                aria-label={`Delete ${milestone.title}`}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
                            >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}