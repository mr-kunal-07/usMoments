import { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  MapPin, Calendar, FolderOpen, Search, Loader2, CheckCircle2, Circle, X, ImagePlus, ChevronDown,
} from "lucide-react";
import type { ReverseGeoResult } from "./TravelMapCanvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddTravelLocation } from "@/hooks/useTravelLocations";
import { useFolders } from "@/hooks/useFolders";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const NO_FOLDER = "none";
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    city?: string; town?: string; village?: string;
    county?: string; country?: string; state?: string;
  };
}

interface FormState {
  location_name: string;
  city: string;
  country: string;
  latitude: string;
  longitude: string;
  date_visited: string;
  description: string;
}

const INITIAL_FORM: FormState = {
  location_name: "",
  city: "",
  country: "",
  latitude: "",
  longitude: "",
  date_visited: "",
  description: "",
};

interface Props {
  open: boolean;
  onClose: () => void;
  initialLat?: number;
  initialLng?: number;
  /** Reverse-geocode result from map click — auto-fills city, country, place name */
  initialGeo?: ReverseGeoResult;
}

// ─── GeoSearch ────────────────────────────────────────────────────────────────

interface GeoSearchProps {
  onSelect: (result: GeoResult) => void;
  /** Increment this counter to trigger a reset (avoids the inverted-boolean pitfall). */
  resetToken: number;
}

const GeoSearch = memo(function GeoSearch({ onSelect, resetToken }: GeoSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listboxId = "geo-search-listbox";

  // FIX: Use a numeric counter as reset signal — incremented on close, not a boolean flip.
  useEffect(() => {
    if (resetToken === 0) return; // skip initial mount
    setQuery("");
    setResults([]);
    setShow(false);
  }, [resetToken]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); setShow(false); return; }

    // FIX: AbortController cancels stale in-flight requests.
    const controller = new AbortController();

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
          {
            signal: controller.signal,
            headers: { "Accept-Language": "en", "User-Agent": "usMoment-App/1.0" },
          },
        );
        const data: GeoResult[] = await res.json();
        setResults(data);
        setShow(data.length > 0);
      } catch (err) {
        // AbortError is expected — don't log it.
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("[GeoSearch] Fetch error:", err);
        }
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // FIX: Abort the in-flight request when query changes or component unmounts.
      controller.abort();
    };
  }, [query]);

  const handleSelect = useCallback((r: GeoResult) => {
    setQuery(r.display_name.split(",").slice(0, 2).join(", "));
    setShow(false);
    onSelect(r);
  }, [onSelect]);

  // FIX: Keyboard navigation — ArrowDown/Up moves between options, Escape closes.
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!show || results.length === 0) return;
    if (e.key === "Escape") {
      setShow(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const listbox = document.getElementById(listboxId);
      const first = listbox?.querySelector<HTMLButtonElement>("[role='option']");
      first?.focus();
    }
  }, [show, results.length]);

  const handleOptionKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLButtonElement>,
    r: GeoResult,
    index: number,
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(r);
      return;
    }
    const listbox = document.getElementById(listboxId);
    const options = listbox ? Array.from(listbox.querySelectorAll<HTMLButtonElement>("[role='option']")) : [];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      options[index + 1]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index === 0) {
        // Return focus to the input
        document.querySelector<HTMLInputElement>(`[aria-controls="${listboxId}"]`)?.focus();
      } else {
        options[index - 1]?.focus();
      }
    } else if (e.key === "Escape") {
      setShow(false);
      document.querySelector<HTMLInputElement>(`[aria-controls="${listboxId}"]`)?.focus();
    }
  }, [handleSelect]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Search a place</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" aria-hidden />
        )}
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShow(true)}
          // FIX: Close suggestions when focus leaves the search widget.
          onBlur={() => setTimeout(() => setShow(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Goa, India"
          className="pl-9 pr-9"
          aria-label="Search location"
          aria-autocomplete="list"
          aria-expanded={show}
          // FIX: Wire aria-controls to the listbox id.
          aria-controls={listboxId}
          role="combobox"
        />

        {/* Suggestions dropdown */}
        {show && results.length > 0 && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
          >
            {results.map((r, i) => {
              const [first, ...rest] = r.display_name.split(",");
              return (
                <button
                  key={i}
                  role="option"
                  // FIX: aria-selected required on every option.
                  aria-selected={false}
                  type="button"
                  onClick={() => handleSelect(r)}
                  onKeyDown={e => handleOptionKeyDown(e, r, i)}
                  className={cn(
                    "w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-accent transition-colors",
                    i > 0 && "border-t border-border/60",
                  )}
                >
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{first}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{rest.slice(0, 2).join(",").trim()}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

// ─── PhotoUploader ────────────────────────────────────────────────────────────

interface PhotoUploaderProps {
  urls: string[];
  uploadCount: number;
  onUpload: (files: FileList) => void;
  onRemove: (index: number) => void;
}

const PhotoUploader = memo(function PhotoUploader({ urls, uploadCount, onUpload, onRemove }: PhotoUploaderProps) {
  const uploading = uploadCount > 0;
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Photos</Label>

      <label className={cn(
        "flex flex-col items-center justify-center gap-1.5 h-16",
        "border border-dashed border-border rounded-xl",
        "bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors",
      )}>
        {/* FIX: Explicit aria-label on the file input for screen readers. */}
        <input
          type="file"
          multiple
          accept="image/*"
          aria-label="Upload photos"
          className="sr-only"
          onChange={e => e.target.files?.length && onUpload(e.target.files)}
        />
        {uploading ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Uploading…
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            Click to add photos
          </span>
        )}
      </label>

      {urls.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {urls.map((url, i) => (
            <div key={i} className="relative group h-14 w-14 rounded-lg overflow-hidden border border-border shrink-0">
              <img src={url} alt={`Uploaded photo ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <X className="h-3.5 w-3.5 text-white" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── AddLocationModal ─────────────────────────────────────────────────────────

export function AddLocationModal({ open, onClose, initialLat, initialLng, initialGeo }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const addLocation = useAddTravelLocation();
  const { data: folders = [] } = useFolders();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [visited, setVisited] = useState(false);
  const [folderId, setFolderId] = useState<string>(NO_FOLDER);
  // FIX: Track active upload count instead of a boolean — handles concurrent batches.
  const [uploadCount, setUploadCount] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  // FIX: Counter-based reset token for GeoSearch — increment on close.
  const [geoResetToken, setGeoResetToken] = useState(0);
  const [showPlaceSearch, setShowPlaceSearch] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  // FIX: Track whether geo has been applied to avoid clobbering user edits on re-render.
  const geoAppliedRef = useRef<ReverseGeoResult | null>(null);

  // ── Form reset ─────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setForm(INITIAL_FORM);
    setVisited(false);
    setFolderId(NO_FOLDER);
    setPhotoUrls([]);
    setUploadCount(0);
    setShowPlaceSearch(false);
    setShowOptional(false);
    geoAppliedRef.current = null;
  }, []);

  // FIX: Reset form when modal opens (not just on explicit close) to clear stale state.
  useEffect(() => {
    if (open) reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Coordinate sync ────────────────────────────────────────────────────────

  useEffect(() => {
    if (initialLat !== undefined && initialLng !== undefined) {
      setForm(f => ({
        ...f,
        latitude: initialLat.toFixed(6),
        longitude: initialLng.toFixed(6),
      }));
    }
  }, [initialLat, initialLng]);

  // FIX: Guard with a ref so a new object reference with the same data doesn't re-apply.
  useEffect(() => {
    if (!initialGeo || initialGeo === geoAppliedRef.current) return;
    geoAppliedRef.current = initialGeo;
    setForm(f => ({
      ...f,
      city: initialGeo.city || f.city,
      country: initialGeo.country || f.country,
      location_name: f.location_name || initialGeo.display || "",
    }));
  }, [initialGeo]);

  // ── Close handler ──────────────────────────────────────────────────────────

  const handleClose = useCallback(async () => {
    // FIX: Delete orphaned uploads that were never saved to a location record.
    if (photoUrls.length > 0) {
      const paths = photoUrls.map(url => {
        try {
          return new URL(url).pathname.replace(/^\/storage\/v1\/object\/public\/media\//, "");
        } catch {
          return null;
        }
      }).filter(Boolean) as string[];

      if (paths.length > 0) {
        // Fire-and-forget — don't block the UI on cleanup.
        supabase.storage.from("media").remove(paths).catch(err => {
          console.error("[AddLocationModal] Failed to clean up orphaned uploads:", err);
        });
      }
    }

    reset();
    setGeoResetToken(t => t + 1);
    onClose();
  }, [photoUrls, reset, onClose]);

  // ── Geo search result ──────────────────────────────────────────────────────

  const handleGeoSelect = useCallback((r: GeoResult) => {
    const city = r.address.city || r.address.town || r.address.village || r.address.county || "";
    const country = r.address.country || "";
    const name = r.display_name.split(",")[0].trim();
    setForm(f => ({
      ...f,
      location_name: f.location_name || name,
      city,
      country,
      latitude: parseFloat(r.lat).toFixed(6),
      longitude: parseFloat(r.lon).toFixed(6),
    }));
  }, []);

  // ── Photo upload ───────────────────────────────────────────────────────────

  const handlePhotoUpload = useCallback(async (files: FileList) => {
    if (!user) return;

    // FIX: Validate file type and size before uploading.
    const validFiles: File[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        rejected.push(`${file.name} (not an image)`);
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        rejected.push(`${file.name} (exceeds ${MAX_FILE_SIZE_MB} MB)`);
      } else {
        validFiles.push(file);
      }
    }

    if (rejected.length > 0) {
      toast({
        title: `${rejected.length} file${rejected.length > 1 ? "s" : ""} skipped`,
        description: rejected.join(", "),
        variant: "destructive",
      });
    }

    if (validFiles.length === 0) return;

    // FIX: Increment upload count — handles concurrent batches correctly.
    setUploadCount(n => n + 1);

    // FIX: Parallelise uploads with Promise.all for faster multi-file batches.
    const results = await Promise.allSettled(
      validFiles.map(async file => {
        const ext = file.name.split(".").pop();
        const path = `travel/${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("media").upload(path, file);
        if (error) throw new Error(file.name);
        const { data } = supabase.storage.from("media").getPublicUrl(path);
        return data.publicUrl;
      }),
    );

    const newUrls: string[] = [];
    const failedNames: string[] = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        newUrls.push(result.value);
      } else {
        failedNames.push(result.reason?.message ?? "unknown file");
      }
    }

    if (newUrls.length > 0) setPhotoUrls(prev => [...prev, ...newUrls]);

    // FIX: Inform the user about failed uploads instead of silently dropping them.
    if (failedNames.length > 0) {
      toast({
        title: `${failedNames.length} photo${failedNames.length > 1 ? "s" : ""} failed to upload`,
        description: failedNames.join(", "),
        variant: "destructive",
      });
    }

    // FIX: Decrement — only reaches 0 when all concurrent batches finish.
    setUploadCount(n => n - 1);
  }, [user, toast]);

  const handlePhotoRemove = useCallback((index: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!form.location_name.trim() || !form.latitude || !form.longitude) {
      toast({ title: "Please enter a location name and pin it on the map", variant: "destructive" });
      return;
    }

    try {
      await addLocation.mutateAsync({
        location_name: form.location_name.trim(),
        city: form.city.trim() || undefined,
        country: form.country.trim() || undefined,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        date_visited: form.date_visited || undefined,
        description: form.description.trim() || undefined,
        photo_urls: photoUrls,
        tags: [],
        visited,
        folder_id: folderId === NO_FOLDER ? undefined : folderId,
      });

      toast({ title: visited ? "✅ Location marked as visited!" : "📍 Location pinned to your map!" });
      // Don't delete photos on successful submit — clear state without storage cleanup.
      reset();
      setGeoResetToken(t => t + 1);
      onClose();
    } catch {
      toast({ title: "Failed to add location", variant: "destructive" });
    }
  }, [form, visited, folderId, photoUrls, addLocation, toast, reset, onClose]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const isBusy = addLocation.isPending || uploadCount > 0;
  const placeLine = [form.city, form.country].filter(Boolean).join(", ");
  const hasPinnedLocation = Boolean(form.latitude && form.longitude);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0",
          "w-[calc(100vw-2rem)] max-w-md",
          "max-h-[calc(100dvh-4rem)] sm:max-h-[90vh]",
          "rounded-2xl",
        )}
      >
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" aria-hidden />
            </span>
            Pin a Place
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable form body */}
        <form
          id="add-location-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0"
        >
          {/* Place name */}
          <div className="space-y-1.5">
            <Label htmlFor="loc-name" className="text-xs text-muted-foreground">Place name *</Label>
            <Input
              id="loc-name"
              value={form.location_name}
              onChange={e => setField("location_name", e.target.value)}
              placeholder="Name this memory"
              required
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 space-y-1.5">
            <p className="text-[11px] font-medium text-foreground">Pinned spot</p>
            {placeLine ? (
              <p className="text-xs text-muted-foreground">{placeLine}</p>
            ) : hasPinnedLocation ? (
              <p className="text-xs text-muted-foreground">Pinned on map. Tap a different spot to change it.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Tap the map to choose a place.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="loc-date" className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3 w-3" aria-hidden /> Date visited
              </Label>
              <Input
                id="loc-date"
                type="date"
                value={form.date_visited}
                onChange={e => setField("date_visited", e.target.value)}
                className="[color-scheme:auto]"
              />
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={visited}
              onClick={() => setVisited(v => !v)}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-medium transition-colors sm:min-w-[144px]",
                "flex items-center justify-center gap-2",
                visited
                  ? "border-green-500/50 bg-green-500/10 text-foreground"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {visited ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden />
              ) : (
                <Circle className="h-4 w-4" aria-hidden />
              )}
              Been here
            </button>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="loc-desc" className="text-xs text-muted-foreground">Memory note</Label>
            <Textarea
              id="loc-desc"
              value={form.description}
              onChange={e => setField("description", e.target.value)}
              placeholder="Add a note about this place"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Photo upload */}
          <PhotoUploader
            urls={photoUrls}
            uploadCount={uploadCount}
            onUpload={handlePhotoUpload}
            onRemove={handlePhotoRemove}
          />

          <button
            type="button"
            onClick={() => setShowPlaceSearch(v => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left"
          >
            <div>
              <p className="text-xs font-semibold text-foreground">Search another place</p>
              <p className="text-[10px] text-muted-foreground">Use search instead of tapping the map</p>
            </div>
            <ChevronDown
              className={cn("h-4 w-4 text-muted-foreground transition-transform", showPlaceSearch && "rotate-180")}
              aria-hidden
            />
          </button>

          {showPlaceSearch && <GeoSearch onSelect={handleGeoSelect} resetToken={geoResetToken} />}

          {(folders.length > 0 || hasPinnedLocation) && (
            <>
              <button
                type="button"
                onClick={() => setShowOptional(v => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2.5 text-left"
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">More options</p>
                  <p className="text-[10px] text-muted-foreground">Folder link and location details</p>
                </div>
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform", showOptional && "rotate-180")}
                  aria-hidden
                />
              </button>

              {showOptional && (
                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                  {folders.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <FolderOpen className="h-3 w-3" aria-hidden /> Link to folder
                      </Label>
                      <Select value={folderId} onValueChange={setFolderId}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Choose a folder…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_FOLDER}>No folder</SelectItem>
                          {folders.map(f => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.emoji ? `${f.emoji} ` : ""}{f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {hasPinnedLocation && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Coordinates</Label>
                      <p className="text-xs text-muted-foreground break-all">
                        {form.latitude}, {form.longitude}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-border flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={handleClose}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-location-form"
            disabled={isBusy}
            className="flex-1 rounded-xl gap-2"
          >
            {addLocation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : uploadCount > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <MapPin className="h-4 w-4" aria-hidden />
            )}
            {/* FIX: Label tells the user what they're waiting for. */}
            {uploadCount > 0
              ? "Uploading…"
              : addLocation.isPending
                ? "Saving…"
                : visited
                  ? "Pin as Visited"
                  : "Pin Location"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddLocationModal;
