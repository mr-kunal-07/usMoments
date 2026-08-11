import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  authLog,
  ephemeralStorage,
  isValidPartnerCode,
  JOIN_REDIRECT_KEY,
  normalisePartnerCode,
  PARTNER_CODE_KEY,
  sanitiseRedirect,
} from "@/hooks/useAuth";
import { QK } from "@/lib/queryKeys";

const DEFAULT_DEST = "/";
const CALLBACK_TIMEOUT_MS = 8000;

export default function AuthCallback() {
    const navigate = useNavigate();
    const qc = useQueryClient();
    const didRun = useRef(false);
    const didComplete = useRef(false);

    useEffect(() => {
        if (didRun.current) return;
        didRun.current = true;

        const applyPendingPartnerInvite = async () => {
            const raw = ephemeralStorage.get(PARTNER_CODE_KEY);
            if (!raw) return;

            const code = normalisePartnerCode(raw);
            if (!isValidPartnerCode(code)) {
                ephemeralStorage.remove(PARTNER_CODE_KEY);
                authLog.warn("Discarded invalid partner code (callback)", { raw });
                return;
            }

            try {
                const { data, error } = await supabase
                    .rpc("accept_couple_invite", { _invite_code: code });

                if (error) {
                    // Likely transient (schema cache, grants, network). Keep the code so post-auth retry can happen.
                    authLog.error("accept_couple_invite failed (callback)", { err: error });
                    return;
                }
                const result = data as { error?: string; success?: boolean } | null;

                if (result?.error) {
                    // Non-transient: don't keep retrying forever.
                    ephemeralStorage.remove(PARTNER_CODE_KEY);
                    authLog.warn("Partner invite rejected (callback)", { code, error: result.error });
                    return;
                }

                ephemeralStorage.remove(PARTNER_CODE_KEY);
                qc.invalidateQueries({ queryKey: QK.myCouple() });
                qc.invalidateQueries({ queryKey: QK.profilesAll() });
                qc.invalidateQueries({ queryKey: QK.mediaAll() });
                qc.invalidateQueries({ queryKey: QK.folders() });
                authLog.info("Partner invite accepted (callback)", { code });
            } catch (err) {
                // Likely transient (schema cache, grants, network). Keep the code so post-auth retry can happen.
                authLog.error("accept_couple_invite failed (callback)", { err });
            }
        };

        const redirect = () => {
            const raw = ephemeralStorage.get(JOIN_REDIRECT_KEY);
            const safePath = sanitiseRedirect(raw);
            if (raw) ephemeralStorage.remove(JOIN_REDIRECT_KEY);
            const dest = safePath ?? DEFAULT_DEST;
            authLog.info("callback redirect", { dest });
            navigate(dest, { replace: true });
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            authLog.info("callback event", { event, userId: session?.user.id });

            if (event === "PASSWORD_RECOVERY") {
                clearTimeout(timeoutId);
                navigate("/reset-password", { replace: true });
                return;
            }

            if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
                if (didComplete.current) return;
                didComplete.current = true;
                clearTimeout(timeoutId);
                (async () => {
                    await applyPendingPartnerInvite();
                    redirect();
                })();
            }
        });

        const timeoutId = setTimeout(() => {
            authLog.warn("Auth callback timed out — no session received");
            navigate("/auth?error=callback_timeout", { replace: true });
        }, CALLBACK_TIMEOUT_MS);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timeoutId);
        };
    }, [navigate, qc]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">Completing sign in…</p>
        </div>
    );
}
