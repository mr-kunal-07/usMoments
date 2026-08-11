import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLoveNotes, useAddLoveNote, useDeleteLoveNote, useMediaReactions, useToggleReaction } from "@/hooks/useLoveNotes";
import { useAllProfiles } from "@/hooks/useProfile";
import { sendNotification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Trash2, Send, MessageCircleHeart, MessageSquareHeart } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const REACTION_EMOJIS = ["❤️", "😍", "🥰", "😘", "💕", "🔥", "✨", "💯"];

interface Props {
  mediaId: string;
  showReactions?: boolean;
}

export function LoveNotesPanel({ mediaId, showReactions = true }: Props) {
  const { user } = useAuth();
  const { data: notes = [], isLoading } = useLoveNotes(mediaId);
  const { data: reactions = [] } = useMediaReactions(mediaId);
  const { data: profiles = [] } = useAllProfiles();
  const addNote = useAddLoveNote();
  const deleteNote = useDeleteLoveNote();
  const toggleReaction = useToggleReaction();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.display_name ?? "You"]));
  const allUserIds = profiles.map(p => p.user_id);
  const myName = profileMap[user?.id ?? ""] ?? "Your partner";

  // Group reactions by emoji
  const reactionCounts: Record<string, { count: number; mine: boolean }> = {};
  reactions.forEach(r => {
    if (!reactionCounts[r.emoji]) reactionCounts[r.emoji] = { count: 0, mine: false };
    reactionCounts[r.emoji].count++;
    if (r.user_id === user?.id) reactionCounts[r.emoji].mine = true;
  });

  const handleSubmit = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    try {
      await addNote.mutateAsync({ mediaId, content });
      setText("");
      // Notify partner
      if (user && allUserIds.length > 1) {
        await sendNotification({
          actorId: user.id,
          allUserIds,
          type: "love_note",
          mediaId,
          message: `${myName} left a love note 💌: "${content.slice(0, 60)}${content.length > 60 ? "…" : ""}"`,
        });
      }
    } catch {
      toast({ title: "Couldn't add note", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNote.mutateAsync({ id, mediaId });
    } catch {
      toast({ title: "Couldn't delete note", variant: "destructive" });
    }
  };

  const handleReaction = async (emoji: string) => {
    const wasReacted = reactionCounts[emoji]?.mine;
    try {
      await toggleReaction.mutateAsync({ mediaId, emoji });
      // Notify only when adding (not removing)
      if (!wasReacted && user && allUserIds.length > 1) {
        await sendNotification({
          actorId: user.id,
          allUserIds,
          type: "reaction",
          mediaId,
          message: `${myName} reacted ${emoji} to a photo`,
        });
      }
    } catch {
      toast({ title: "Couldn't react", variant: "destructive" });
    }
  };

  return (
    <div className="border-t border-border/50 pt-4 space-y-4">
      {showReactions && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <Heart className="h-3 w-3" /> React
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REACTION_EMOJIS.map(emoji => {
              const info = reactionCounts[emoji];
              return (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-sm border transition-all duration-150",
                    info?.mine
                      ? "bg-primary/15 border-primary/40 shadow-sm scale-105"
                      : "bg-muted/50 border-border/40 hover:bg-muted hover:scale-105"
                  )}
                >
                  <span>{emoji}</span>
                  {info?.count ? <span className="text-xs text-muted-foreground font-medium">{info.count}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes section */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
          <MessageSquareHeart className="h-4 w-5" /> Love Notes
        </p>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic py-2">No notes yet — leave the first one 💌</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {notes.map(note => {
              const isMe = note.author_id === user?.id;
              return (
                <div
                  key={note.id}
                  className={cn(
                    "group relative rounded-xl px-3.5 py-2.5 text-sm",
                    isMe
                      ? "bg-primary/10 border border-primary/20 ml-4"
                      : "bg-muted/60 border border-border/40 mr-4"
                  )}
                >
                  <p className="text-xs font-medium text-primary mb-0.5">
                    {isMe ? "You" : profileMap[note.author_id] ?? "Them"} ·{" "}
                    <span className="text-muted-foreground font-normal">
                      {format(new Date(note.created_at), "MMM d, h:mm a")}
                    </span>
                  </p>
                  <p className="text-foreground/90 leading-relaxed">{note.content}</p>
                  {isMe && (
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add note input */}
        <div className="mt-3 flex gap-2">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write a love note… 💌"
            className="resize-none text-sm h-9 min-h-9 py-2 bg-background/50 border-border/50 focus:border-primary/50"
            rows={1}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={handleSubmit}
            disabled={!text.trim() || addNote.isPending}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
