import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useAuth,
  ephemeralStorage,
  JOIN_REDIRECT_KEY,
  normalisePartnerCode,
  isValidPartnerCode,
  PARTNER_CODE_KEY,
} from "@/hooks/useAuth";
import { useMyCouple, useAcceptInvite } from "@/hooks/useCouple";
import { Heart, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const codeFromQuery = searchParams.get("code")?.toUpperCase() ?? "";
  const storedCode = normalisePartnerCode(ephemeralStorage.get(PARTNER_CODE_KEY) ?? "");
  const code = codeFromQuery || (isValidPartnerCode(storedCode) ? storedCode : "");
  const navigate = useNavigate();
  const { user, bootstrapping } = useAuth();
  const { data: couple, isLoading: coupleLoading } = useMyCouple();
  const acceptInvite = useAcceptInvite();
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-attempt join once auth + couple state is ready
  useEffect(() => {
    if (bootstrapping || coupleLoading) return;
    if (!user) {
      if (code) ephemeralStorage.set(PARTNER_CODE_KEY, code);
      // After login, return to /join (invite code is carried via PARTNER_CODE_KEY)
      ephemeralStorage.set(JOIN_REDIRECT_KEY, "/join");
      navigate("/auth", { replace: true });
      return;
    }
    if (couple?.status === "active") {
      setStatus("done");
      return;
    }
    if (!code || status !== "idle") return;

    setStatus("joining");
    acceptInvite.mutateAsync(code)
      .then(() => setStatus("done"))
      .catch((e: Error) => { setStatus("error"); setErrorMsg(e.message); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, bootstrapping, couple, coupleLoading, code]);

  if (bootstrapping || coupleLoading || status === "joining") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Linking your hearts…</p>
      </div>
    );
  }

  if (status === "done" || couple?.status === "active") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <div className="h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center">
          <Heart className="h-10 w-10 text-primary fill-primary animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text mb-2">You're connected! 💕</h1>
          <p className="text-muted-foreground text-sm max-w-xs">
            Your accounts are now linked forever. You both share the vault — one love, one vault.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground border border-primary/20 rounded-full px-4 py-1.5 bg-primary/5">
          <Lock className="h-3 w-3 text-primary" />
          This bond is permanent and cannot be undone
        </div>
        <Button onClick={() => navigate("/dashboard")} className="w-full max-w-xs gap-2">
          <Heart className="h-4 w-4" /> Open Our Vault
        </Button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <span className="text-3xl">💔</span>
        </div>
        <div>
          <h1 className="text-xl font-bold mb-2">Couldn't link accounts</h1>
          <p className="text-muted-foreground text-sm max-w-xs">{errorMsg || "The invite link is invalid or has already been used."}</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/profile")}>Go to Profile</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
