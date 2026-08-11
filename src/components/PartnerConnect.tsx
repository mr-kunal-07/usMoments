import { useState, useCallback } from "react";
import { useMyCouple, useCreateInvite, useAcceptInvite } from "@/hooks/useCouple";
import { useAllProfiles } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Heart, Copy, Check, Link2, Loader2, Lock,
  Share2, UserCheck, Sparkles, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "invite" | "join";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function CopyButton({
  value,
  label,
  successLabel = "Copied!",
  className,
}: {
  value: string;
  label: React.ReactNode;
  successLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed — try manually", variant: "destructive" });
    }
  }, [value, toast]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded",
        copied ? "text-green-600" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? successLabel : label}
    </button>
  );
}

function TabBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-xl">
      {(["invite", "join"] as const).map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={cn(
            "py-2.5 text-xs font-medium rounded-lg transition-all duration-150",
            mode === t
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t === "invite" ? "📤 Invite Partner" : "📥 Enter Code"}
        </button>
      ))}
    </div>
  );
}

function PermanentWarning() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-3">
      <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground font-medium">This connection is permanent.</strong>{" "}
        Once linked, you share one vault — one love, forever.
      </p>
    </div>
  );
}

function LinkedState({
  partnerProfile,
}: {
  partnerProfile: { display_name?: string | null; avatar_url?: string | null };
}) {
  const name = partnerProfile.display_name ?? "Your Partner";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <div className="relative">
          <Avatar className="h-12 w-12 ring-2 ring-primary/30">
            {partnerProfile.avatar_url && <AvatarImage src={partnerProfile.avatar_url} />}
            <AvatarFallback className="text-sm font-semibold bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-1 -right-1 text-sm">💑</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Forever partner</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
          <Heart className="h-3 w-3 text-primary fill-primary" />
          <span className="text-xs font-medium text-primary">Linked</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <UserCheck className="h-3.5 w-3.5 text-primary" />
          You both have admin access to your shared memories.
        </div>
        <ul className="text-xs text-muted-foreground space-y-1.5 pl-5 list-none">
          {[
            "Upload, edit and delete any photo or video",
            "Create and manage memory folders",
            "Share love notes and anniversaries",
          ].map(item => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-primary mt-px">✦</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-3">
        <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground font-medium">This bond is permanent 🔒</strong>
          {" "}— one vault, one love, always.
        </p>
      </div>
    </div>
  );
}

function PendingState({
  inviteCode,
  inviteLink,
  onAccept,
  isAccepting,
}: {
  inviteCode: string;
  inviteLink: string;
  onAccept: (code: string) => Promise<void>;
  isAccepting: boolean;
}) {
  const { toast } = useToast();
  const [enteredCode, setEnteredCode] = useState("");

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join our vault 💕",
          text: "Hey love! Join our shared memory vault ❤️",
          url: inviteLink,
        });
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(inviteLink);
        toast({ title: "Link copied!" });
      } catch {
        toast({ title: "Copy failed — try manually", variant: "destructive" });
      }
    }
  }, [inviteLink, toast]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Share with your partner:</p>

        <div className="relative flex items-center justify-between gap-3 px-4 py-4 bg-background rounded-xl border border-border group">
          <span className="font-mono text-2xl sm:text-3xl font-bold tracking-[.3em] text-foreground">
            {inviteCode}
          </span>
          <CopyButton value={inviteCode} label="Copy" className="shrink-0" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleShare}
            className={cn(
              "flex items-center justify-center gap-1.5 h-9 rounded-lg",
              "bg-primary text-primary-foreground text-xs font-medium",
              "hover:bg-primary/90 active:scale-[0.98] transition-all",
            )}
          >
            <Share2 className="h-3.5 w-3.5" />
            Share Link
          </button>
          <CopyButton
            value={inviteLink}
            label={<span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" />Copy Link</span>}
            successLabel="Link copied!"
            className={cn(
              "h-9 rounded-lg border border-border justify-center",
              "hover:bg-accent transition-colors px-3",
            )}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        Waiting for your partner to accept…
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
        <p className="text-xs font-medium text-muted-foreground">
          Got a code from your partner instead?
        </p>
        <div className="flex gap-2">
          <input
            value={enteredCode}
            onChange={e => setEnteredCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            placeholder="XXXXXXXX"
            maxLength={8}
            className={cn(
              "flex-1 font-mono tracking-widest text-center text-sm uppercase h-10",
              "rounded-lg border border-border bg-background px-3",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              "placeholder:text-muted-foreground/50 placeholder:tracking-normal",
            )}
          />
          <button
            type="button"
            onClick={() => onAccept(enteredCode)}
            disabled={enteredCode.length < 6 || isAccepting}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-4 h-10 rounded-lg",
              "bg-primary text-primary-foreground text-xs font-medium",
              "hover:bg-primary/90 active:scale-[0.98] transition-all",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
            )}
          >
            {isAccepting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><Heart className="h-3.5 w-3.5" />Join</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteTab({
  onGenerate,
  isGenerating,
}: {
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/30 p-5 flex flex-col items-center text-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Invite your partner</p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
            Generate an 8-character code and shareable link. Your partner just taps to join — takes seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating}
          className={cn(
            "w-full flex items-center justify-center gap-2 h-11 rounded-xl",
            "bg-primary text-primary-foreground text-sm font-medium",
            "hover:bg-primary/90 active:scale-[0.98] transition-all",
            "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
          )}
        >
          {isGenerating
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Link2 className="h-4 w-4" />Generate Invite</>}
        </button>
      </div>
      <PermanentWarning />
    </div>
  );
}

function JoinTab({
  onAccept,
  isAccepting,
}: {
  onAccept: (code: string) => Promise<void>;
  isAccepting: boolean;
}) {
  const [code, setCode] = useState("");

  const extractInviteCode = useCallback((input: string): string => {
    const raw = input.trim();
    if (!raw) return "";

    // Try parsing as a URL first (works for full invite links).
    try {
      const url = new URL(raw);
      const qp = url.searchParams.get("invite") ?? url.searchParams.get("code");
      if (qp) return qp.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    } catch {
      // ignore
    }

    // Match query-string style fragments if user pasted a partial URL.
    const m = raw.match(/[?&](invite|code)=([A-Z0-9]{6,8})/i);
    if (m) return m[2].toUpperCase();

    // Fallback: find the last 6–8 char alnum chunk (avoids grabbing "HTTPSWWW").
    const chunks = raw.toUpperCase().match(/[A-Z0-9]{6,8}/g) ?? [];
    return (chunks[chunks.length - 1] ?? "").slice(0, 8);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(extractInviteCode(e.target.value));
  }, [extractInviteCode]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">Enter your partner's code</p>
          <p className="text-xs text-muted-foreground">8-character code, or paste the full invite link</p>
        </div>

        <input
          value={code}
          onChange={handleChange}
          placeholder="A B C D 1 2 3 4"
          maxLength={8}
          className={cn(
            "w-full font-mono tracking-[.4em] text-center text-xl sm:text-2xl font-bold",
            "h-16 rounded-xl border-2 border-border bg-background",
            "focus:outline-none focus:border-primary transition-colors",
            "placeholder:text-muted-foreground/30 placeholder:tracking-[.2em] placeholder:text-base",
          )}
        />

        <div className="flex justify-center gap-1.5" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all duration-200",
                i < code.length ? "bg-primary scale-110" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => onAccept(code)}
          disabled={code.length < 6 || isAccepting}
          className={cn(
            "w-full flex items-center justify-center gap-2 h-11 rounded-xl",
            "bg-primary text-primary-foreground text-sm font-medium",
            "hover:bg-primary/90 active:scale-[0.98] transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
          )}
        >
          {isAccepting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><Heart className="h-4 w-4 fill-primary-foreground" />Join Vault Forever<ArrowRight className="h-4 w-4 ml-1" /></>}
        </button>
      </div>
      <PermanentWarning />
    </div>
  );
}

export function PartnerConnect() {
  const { user } = useAuth();
  const { data: couple, isLoading } = useMyCouple();
  const { data: profiles = [] } = useAllProfiles();
  const createInvite = useCreateInvite();
  const acceptInvite = useAcceptInvite();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("invite");

  const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));
  const partnerId = couple
    ? (couple.user1_id === user?.id ? couple.user2_id : couple.user1_id)
    : null;
  const partnerProfile = partnerId ? profileMap[partnerId] : null;
  const isLinked = couple?.status === "active";
  const isPending = couple?.status === "pending";
  const inviteCode = couple?.invite_code ?? "";

  // Fixed: points to /auth so Auth.tsx picks up ?code= on arrival
  const inviteLink = inviteCode
    ? `${window.location.origin}/auth?invite=${inviteCode}`
    : "";

  const handleAccept = useCallback(async (code: string) => {
    if (!code.trim()) return;
    try {
      await acceptInvite.mutateAsync(code.trim());
      toast({ title: "🎉 You're connected forever! 💕" });
    } catch (e: unknown) {
      toast({
        title: "Invalid code",
        description: getErrorMessage(e, "Please check the code and try again."),
        variant: "destructive",
      });
    }
  }, [acceptInvite, toast]);

  const handleGenerateCode = useCallback(async () => {
    try {
      await createInvite.mutateAsync();
    } catch (e: unknown) {
      toast({ title: getErrorMessage(e, "Failed to create invite"), variant: "destructive" });
    }
  }, [createInvite, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (isLinked && partnerProfile) {
    return <LinkedState partnerProfile={partnerProfile} />;
  }

  if (isPending && couple?.user1_id === user?.id) {
    return (
      <PendingState
        inviteCode={inviteCode}
        inviteLink={inviteLink}
        onAccept={handleAccept}
        isAccepting={acceptInvite.isPending}
      />
    );
  }

  return (
    <div className="space-y-3">
      <TabBar mode={mode} onChange={setMode} />
      {mode === "invite" ? (
        <InviteTab onGenerate={handleGenerateCode} isGenerating={createInvite.isPending} />
      ) : (
        <JoinTab onAccept={handleAccept} isAccepting={acceptInvite.isPending} />
      )}
    </div>
  );
}
