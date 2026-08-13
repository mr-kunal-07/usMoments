import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Check, ChevronRight, Heart, Loader2, Save } from "lucide-react";
import { PartnerConnect } from "@/components/couples/PartnerConnect";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useMyCouple } from "@/hooks/useCouple";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/hooks/useProfile";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";

const MAX_DISPLAY_NAME_LENGTH = 40;
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
  }
  return (parts[0] ?? "U").slice(0, 2).toUpperCase();
}

function getUserDisplayName(
  profileName: string | null | undefined,
  metadata: Record<string, unknown> | undefined,
  email: string | undefined,
): string {
  const metadataName = metadata?.display_name ?? metadata?.full_name ?? metadata?.name;
  return profileName?.trim() || (typeof metadataName === "string" ? metadataName.trim() : "") || email?.split("@")[0] || "";
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: couple } = useMyCouple();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasEditedName = useRef(false);

  const [displayName, setDisplayName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPartnerSetup, setShowPartnerSetup] = useState(false);

  useEffect(() => {
    if (hasEditedName.current) return;
    const name = getUserDisplayName(profile?.display_name, user?.user_metadata, user?.email);
    setDisplayName(name);
    setSavedName(name);
  }, [profile?.display_name, user?.email, user?.user_metadata]);

  const currentAvatarUrl = localAvatarUrl ?? profile?.avatar_url ?? null;
  const trimmedName = displayName.trim();
  const profileChanged = Boolean(trimmedName) && trimmedName !== savedName.trim();
  const partnerConnected = couple?.status === "active";
  const partnerSetupVisible = couple?.status === "pending" || showPartnerSetup;

  const handleAvatarChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast({ title: "Image is too large", description: "Choose an image smaller than 5 MB.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const avatarUrl = await uploadAvatar.mutateAsync(file);
      await updateProfile.mutateAsync({ avatarUrl });
      setLocalAvatarUrl(avatarUrl);
      toast({ title: "Photo updated" });
    } catch (error) {
      console.error("[profile] avatar upload failed", error);
      toast({ title: "Photo could not be updated", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }, [toast, updateProfile, uploadAvatar]);

  const handleSave = useCallback(async () => {
    if (!profileChanged || isSaving) return;
    setIsSaving(true);
    try {
      await updateProfile.mutateAsync({ displayName: trimmedName });
      const { error } = await supabase.auth.updateUser({ data: { display_name: trimmedName } });
      if (error) console.warn("[profile] auth metadata sync failed", error);
      setDisplayName(trimmedName);
      setSavedName(trimmedName);
      hasEditedName.current = false;
      toast({ title: "Profile saved" });
    } catch (error) {
      console.error("[profile] save failed", error);
      toast({ title: "Profile could not be saved", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, profileChanged, toast, trimmedName, updateProfile]);

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && profileChanged) void handleSave();
  };

  return (
    <div className="min-h-screen bg-background">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleAvatarChange}
        aria-label="Choose profile photo"
      />

      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-2xl items-center gap-2 px-3 sm:h-14 sm:px-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-sm font-semibold text-foreground">Profile</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-8 px-3 pb-12 pt-5 sm:px-5 sm:pt-7">
        <section className="space-y-4">
          <div className="border-b border-border/70 pb-3">
            <h2 className="text-base font-semibold text-foreground">Your details</h2>
            <p className="mt-1 text-xs text-muted-foreground">This is how your name and photo appear to your partner.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16 border border-border">
                {currentAvatarUrl && <AvatarImage src={currentAvatarUrl} alt={trimmedName || "Profile"} />}
                <AvatarFallback className="font-semibold">{getInitials(trimmedName || user?.email || "U")}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                aria-label="Change profile photo"
              >
                {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Profile photo</p>
              <p className="mt-0.5 text-xs text-muted-foreground">JPG or PNG, max 5 MB</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="profile-display-name" className="text-xs">Display name</Label>
              <span className="text-[11px] text-muted-foreground">{displayName.length}/{MAX_DISPLAY_NAME_LENGTH}</span>
            </div>
            <Input
              id="profile-display-name"
              value={displayName}
              onChange={(event) => {
                hasEditedName.current = true;
                setDisplayName(event.target.value);
              }}
              onKeyDown={handleNameKeyDown}
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              autoComplete="name"
              className="h-9"
            />
          </div>

          <div className="flex min-w-0 items-center gap-3 py-1 text-xs">
            <span className="shrink-0 text-muted-foreground">Email</span>
            <span className="min-w-0 truncate font-medium text-foreground">{user?.email}</span>
          </div>

          {profileChanged && (
            <Button type="button" size="sm" className="h-9 w-full sm:w-fit" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>
          )}
        </section>

        <section className="space-y-4">
          <div className="border-b border-border/70 pb-3">
            <h2 className="text-base font-semibold text-foreground">Partner</h2>
            <p className="mt-1 text-xs text-muted-foreground">Share one private vault with your person.</p>
          </div>

          <button
            type="button"
            onClick={() => !partnerConnected && setShowPartnerSetup((value) => !value)}
            disabled={partnerConnected}
            className="flex min-h-14 w-full items-center gap-3 border-y border-border/70 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Heart className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">
                {partnerConnected ? "Partner connected" : couple?.status === "pending" ? "Invitation pending" : "Connect your partner"}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {partnerConnected ? "Your shared vault is active" : couple?.status === "pending" ? "Share your code or enter theirs" : "Invite them or enter their invite code"}
              </span>
            </span>
            {partnerConnected ? <Check className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </button>

          {partnerSetupVisible && !partnerConnected && (
            <div className="rounded-md border border-border bg-muted/20 p-3 sm:p-4">
              <PartnerConnect />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
