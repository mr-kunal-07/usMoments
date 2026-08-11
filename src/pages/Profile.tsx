
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
  type ElementType,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
} from "@/hooks/useProfile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Save,
  Heart,
  Mail,
  CheckCircle2,
  Sparkles,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PartnerConnect } from "@/components/PartnerConnect";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const SAVED_FEEDBACK_DURATION_MS = 2500;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Derive initials from a display name or email. */
function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return value.slice(0, 2).toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

// ── Section ──────────────────────────────────────────────────────────────────

interface SectionProps {
  icon?: ElementType;
  title?: string;
  description?: string;
  children?: ReactNode;
  accent?: boolean;
  className?: string;
}

function Section({
  icon: Icon,
  title,
  description,
  children,
  accent = false,
  className,
}: SectionProps) {
  const hasHeader = Icon || title || description;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden shadow-sm",
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "p-3 sm:px-6 sm:py-5 border-b border-border flex items-start gap-3",
            accent && "bg-gradient-to-r from-primary/5 to-transparent"
          )}
        >
          {Icon && (
            <div
              className={cn(
                " flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                accent
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
              aria-hidden="true"
            >
              <Icon className="h-4 w-4" />
            </div>
          )}

          {(title || description) && (
            <div>
              {title && (
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {title}
                </p>
              )}
              {description && (
                <p className="text-xs  text-muted-foreground leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {children && (
        <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      )}
    </div>
  );
}

// ── Field ────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  rightLabel?: ReactNode;
}

function Field({ label, hint, htmlFor, children, rightLabel }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={htmlFor}
          className="text-xs font-medium text-foreground/70 uppercase tracking-wide"
        >
          {label}
        </Label>
        {rightLabel && (
          <span className="text-xs text-muted-foreground">{rightLabel}</span>
        )}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── SaveButton ───────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved";

interface SaveButtonProps {
  state: SaveState;
  onClick: () => void;
}

function SaveButton({ state, onClick }: SaveButtonProps) {
  const isDisabled = state === "saving" || state === "saved";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-label={
        state === "saving"
          ? "Saving profile…"
          : state === "saved"
            ? "Profile saved"
            : "Save profile changes"
      }
      className={cn(
        "w-full h-10 rounded-lg flex items-center justify-center gap-2",
        "text-sm font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        state === "saved"
          ? "bg-green-500/10 text-green-600 border border-green-200 dark:border-green-900/50"
          : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
        isDisabled && "cursor-not-allowed opacity-80"
      )}
    >
      {state === "saving" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Saving…
        </>
      )}
      {state === "saved" && (
        <>
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Saved!
        </>
      )}
      {state === "idle" && (
        <>
          <Save className="h-4 w-4" aria-hidden="true" />
          Save Changes
        </>
      )}
    </button>
  );
}

// ── AvatarHero ────────────────────────────────────────────────────────────────

type AvatarSize = "sm" | "md" | "lg";

const avatarSizeMap: Record<AvatarSize, string> = {
  sm: "h-16 w-16",
  md: "h-20 w-20 sm:h-24 sm:w-24",
  lg: "h-24 w-24 lg:h-28 lg:w-28",
};

interface AvatarHeroProps {
  avatarUrl: string | null;
  initials: string;
  displayName: string;
  email: string;
  isUploading: boolean;
  onCameraClick: () => void;
  size?: AvatarSize;
}

function AvatarHero({
  avatarUrl,
  initials,
  displayName,
  email,
  isUploading,
  onCameraClick,
  size = "md",
}: AvatarHeroProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative">
        <Avatar
          className={cn(
            avatarSizeMap[size],
            "ring-4 ring-background shadow-xl"
          )}
        >
          {avatarUrl && <AvatarImage src={avatarUrl} alt="Your profile photo" />}
          <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>

        <button
          type="button"
          onClick={onCameraClick}
          disabled={isUploading}
          aria-label={isUploading ? "Uploading photo…" : "Change profile photo"}
          className={cn(
            "absolute bottom-0 right-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full shadow-lg",
            "bg-primary text-primary-foreground",
            "flex items-center justify-center",
            "ring-2 ring-background",
            "transition-all hover:scale-110 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          )}
        >
          {isUploading ? (
            <Loader2
              className="h-3 w-3 sm:h-3.5 sm:w-3.5 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug truncate max-w-[200px]">
          {displayName || (
            <span className="text-muted-foreground italic">No name set</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
          {email}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Local state ──────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState<string>("");
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // Tracks whether the user has manually edited the field this session.
  // Prevents the async profile re-fetch from overwriting a live edit.
  const userHasEdited = useRef(false);

  // Sync display name from the server exactly once when data first arrives.
  // Priority: profiles table -> auth user_metadata -> email prefix.
  // This covers two Supabase patterns:
  //   1. display_name stored in a `profiles` table  (useProfile)
  //   2. display_name stored in auth user_metadata  (set during signUp)
  useEffect(() => {
    if (userHasEdited.current) return; // never clobber a live edit

    const fromProfile = profile?.display_name;
    const fromMeta = user?.user_metadata?.display_name as string | undefined;
    const fromEmail = user?.email?.split("@")[0];

    const resolved = fromProfile || fromMeta || fromEmail || "";
    if (resolved) setDisplayName(resolved);
  }, [profile?.display_name, user?.user_metadata?.display_name, user?.email]);

  // ── Derived values ───────────────────────────────────────────────────────
  // initials are computed at the call site from live `displayName` state
  // so the avatar card always reflects what the user is currently typing.
  const currentAvatarUrl = localAvatarUrl ?? profile?.avatar_url ?? null;
  const remainingChars = MAX_DISPLAY_NAME_LENGTH - displayName.length;

  // ── Avatar upload ────────────────────────────────────────────────────────
  const handleAvatarChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input early so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";

      if (file.size > MAX_AVATAR_SIZE_BYTES) {
        toast({
          title: "Image too large",
          description: "Please choose a file under 5 MB.",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      try {
        // Upload file → get URL → persist to profile (atomic)
        const url = await uploadAvatar.mutateAsync(file);
        setLocalAvatarUrl(url);
        await updateProfile.mutateAsync({ avatarUrl: url });
        toast({
          title: "Photo updated",
          description: "Your profile photo has been saved.",
        });
      } catch (err) {
        console.error("[Profile] Avatar upload failed:", err);
        toast({
          title: "Upload failed",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [uploadAvatar, updateProfile, toast]
  );

  // ── Save profile ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaveState("saving");
    const trimmed = displayName.trim();

    try {
      // 1. Persist to your profiles table (or wherever useUpdateProfile writes).
      await updateProfile.mutateAsync({ displayName: trimmed || undefined });

      // 2. Also update Supabase auth user_metadata so the name survives a
      //    hard refresh even if the profiles table query hasn't re-fetched yet.
      //    This is a no-op if your backend already mirrors the two sources.
      if (trimmed) {
        const { error: metaErr } = await supabase.auth.updateUser({
          data: { display_name: trimmed },
        });
        if (metaErr) console.warn("[Profile] user_metadata sync failed:", metaErr);
      }

      setSaveState("saved");
      toast({ title: "Profile saved", description: "Your changes have been applied." });
      setTimeout(() => setSaveState("idle"), SAVED_FEEDBACK_DURATION_MS);
    } catch (err) {
      console.error("[Profile] Save failed:", err);
      setSaveState("idle");
      toast({
        title: "Save failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  }, [displayName, updateProfile, toast]);

  // ── Keyboard shortcut on input ───────────────────────────────────────────
  const handleNameKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSave();
    },
    [handleSave]
  );

  // ── Open file picker ─────────────────────────────────────────────────────
  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── Hidden file input ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleAvatarChange}
      />

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              "text-muted-foreground hover:bg-accent hover:text-foreground transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <h1 className="text-sm font-semibold text-foreground">
            Profile Settings
          </h1>
        </div>
      </header>

      {/* ── Page body ── */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8 pb-16">
        {/*
         * Layout:
         *   Mobile  (<lg): single column
         *   Desktop (≥lg): fixed sidebar [280px] + fluid main content
         */}
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-6 xl:grid-cols-[300px_1fr] xl:gap-8">

          {/* ═══ LEFT SIDEBAR ═══════════════════════════════════════════════ */}
          <aside className="space-y-4 mb-5 lg:mb-0">

            {/* Avatar card */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              {/* Decorative gradient band */}
              <div
                className="h-20 sm:h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent relative"
                aria-hidden="true"
              >
                <Sparkles className="absolute top-3 right-3 h-4 w-4 text-primary/40" />
              </div>

              {/* Avatar — overlaps the gradient */}
              <div className="px-5 pb-5 -mt-10 sm:-mt-12 flex flex-col items-center gap-3">
                <AvatarHero
                  avatarUrl={currentAvatarUrl}
                  initials={getInitials(displayName || user?.email || "U")}
                  displayName={displayName}
                  email={user?.email ?? ""}
                  isUploading={isUploading}
                  onCameraClick={openFilePicker}
                  size="lg"
                />
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  Tap the camera icon to update your photo
                </p>
              </div>
            </div>
          </aside>

          {/* ═══ RIGHT CONTENT ══════════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* ── Profile form ── */}
            <Section
              icon={User}
              title="Personal Info"
              description="Update your display name and profile photo"
            >
              <div className="space-y-5">

                {/* Display name */}
                <Field
                  label="Display Name"
                  htmlFor="display-name"
                  rightLabel={
                    <span
                      className={cn(
                        remainingChars <= 10
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {remainingChars} left
                    </span>
                  }
                >
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(e) => {
                      userHasEdited.current = true;
                      setDisplayName(e.target.value);
                    }}
                    onKeyDown={handleNameKeyDown}
                    placeholder="Enter your display name"
                    maxLength={MAX_DISPLAY_NAME_LENGTH}
                    autoComplete="name"
                    className="h-10"
                  />
                </Field>

                {/* Email (read-only) */}
                <Field label="Email" htmlFor="email">
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
                      aria-hidden="true"
                    />
                    <Input
                      id="email"
                      value={user?.email ?? ""}
                      disabled
                      readOnly
                      aria-label="Email address (cannot be changed)"
                      className="pl-9 h-10 text-muted-foreground bg-muted/40 cursor-not-allowed"
                    />
                  </div>
                </Field>

                {/* Save button */}
                <SaveButton state={saveState} onClick={handleSave} />
              </div>
            </Section>

            {/* ── Partner connect ── */}
            <Section
              icon={Heart}
              title="Partner Access"
              description="Link your partner's account to share this private vault and chat space"
              accent
            >
              <PartnerConnect />
            </Section>

          </div>
        </div>
      </main>
    </div>
  );
}