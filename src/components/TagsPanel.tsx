import { useState } from "react";
import { Plus, X, Tag as TagIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  useTags, useMediaTags, useCreateTag, useAddTagToMedia,
  useRemoveTagFromMedia, TAG_COLORS, Tag,
} from "@/hooks/useTags";
import { cn } from "@/lib/utils";

interface Props {
  mediaId: string;
}

export function TagsPanel({ mediaId }: Props) {
  const { data: allTags = [] } = useTags();
  const { data: mediaTags = [], isLoading } = useMediaTags(mediaId);
  const createTag = useCreateTag();
  const addTag = useAddTagToMedia();
  const removeTag = useRemoveTagFromMedia();

  const [newName, setNewName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[5]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const appliedTagIds = new Set(mediaTags.map(mt => mt.tag_id));
  const availableTags = allTags.filter(t => !appliedTagIds.has(t.id));

  const handleCreateAndAdd = async () => {
    if (!newName.trim()) return;
    const tag = await createTag.mutateAsync({ name: newName.trim(), color: selectedColor });
    await addTag.mutateAsync({ mediaId, tagId: tag.id });
    setNewName("");
    setPopoverOpen(false);
  };

  const handleAddExisting = async (tag: Tag) => {
    await addTag.mutateAsync({ mediaId, tagId: tag.id });
    setPopoverOpen(false);
  };

  const handleRemove = (tagId: string) => {
    removeTag.mutate({ mediaId, tagId });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Tags</span>
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}

        {mediaTags.map(mt => (
          <Badge
            key={mt.id}
            variant="secondary"
            className="gap-1 pl-2 pr-1 h-6 text-xs font-normal cursor-default"
            style={{ backgroundColor: mt.tag?.color + "22", borderColor: mt.tag?.color + "55", color: mt.tag?.color }}
          >
            {mt.tag?.name ?? "…"}
            <button
              onClick={() => handleRemove(mt.tag_id)}
              className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity rounded"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}

        {/* Add tag popover */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1 rounded-full border-dashed">
              <Plus className="h-3 w-3" /> Add tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 space-y-3" align="start">
            {/* Existing tags */}
            {availableTags.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Existing tags</p>
                <div className="flex flex-wrap gap-1">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => handleAddExisting(tag)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors hover:opacity-80"
                      style={{ backgroundColor: tag.color + "22", borderColor: tag.color + "55", color: tag.color }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create new tag */}
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Create new tag</p>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Tag name…"
                className="h-8 text-sm"
                onKeyDown={e => { if (e.key === "Enter") handleCreateAndAdd(); }}
              />
              <div className="flex gap-1 flex-wrap">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-transform",
                      selectedColor === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleCreateAndAdd}
                disabled={!newName.trim() || createTag.isPending}
              >
                {createTag.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Create & Add"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
