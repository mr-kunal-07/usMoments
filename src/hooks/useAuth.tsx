import {
  createContext, useContext, useEffect, useRef,
  useState, useCallback, useReducer,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  type User,
  type Session,
  type AuthError,
  type AuthChangeEvent,
  type Provider,
} from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { QK } from "@/lib/queryKeys";
import { clearChatMediaCaches } from "@/lib/swChatMediaCache";

// ─── Logger ───────────────────────────────────────────────────────────────────

type LogCtx = Record<string, unknown>;

export const authLog = {
  info: (msg: string, ctx?: LogCtx) => {
    if (process.env.NODE_ENV !== "production") console.info(`[auth] ${msg}`, ctx ?? "");
  },
  warn: (msg: string, ctx?: LogCtx) => console.warn(`[auth] ${msg}`, ctx ?? ""),
  error: (msg: string, ctx?: LogCtx) => console.error(`[auth] ${msg}`, ctx ?? ""),
};

// ─── Environment ──────────────────────────────────────────────────────────────

export const isBrowser = typeof window !== "undefined";
export const getOrigin = () => (isBrowser ? window.location.origin : "");
export const getPathname = () => (isBrowser ? window.location.pathname : "/");

// ─── Safe Storage ─────────────────────────────────────────────────────────────

type SafeStore = {
  get: (k: string) => string | null;
  set: (k: string, v: string) => void;
  remove: (k: string) => void;
};

function makeSafeStorage(pick: () => Storage | null): SafeStore {
  const store = (): Storage | null => {
    try { return isBrowser ? pick() : null; } catch { return null; }
  };
  return {
    get: k => { try { return store()?.getItem(k) ?? null; } catch { return null; } },
    set: (k, v) => { try { store()?.setItem(k, v); } catch { /* ignore */ } },
    remove: k => { try { store()?.removeItem(k); } catch { /* ignore */ } },
  };
}

export const ephemeralStorage = makeSafeStorage(() => window.sessionStorage);
export const PARTNER_CODE_KEY = "usMoment:pending_partner_code";
export const JOIN_REDIRECT_KEY = "usMoment:join_redirect";

// ─── Redirect Sanitisation ────────────────────────────────────────────────────

const REDIRECT_ALLOWLIST = ["/chat", "/memories", "/map", "/profile", "/join", "/"] as const;

export function sanitiseRedirect(raw: string | null): string | null {
  if (!raw || !isBrowser) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const allowed = REDIRECT_ALLOWLIST.some(
      p => url.pathname === p || url.pathname.startsWith(`${p}/`)
    );
    return allowed ? url.pathname : null;
  } catch {
    return null;
  }
}

// ─── Retry Helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 600): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (err) {
      lastError = err;
      if (i < attempts - 1)
        await new Promise(r => setTimeout(r, baseDelayMs * 2 ** i));
    }
  }
  throw lastError;
}

// ─── Partner Code ─────────────────────────────────────────────────────────────

const PARTNER_CODE_RE = /^[A-Z0-9]{6,8}$/;

export const normalisePartnerCode = (raw: string) =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);

export const isValidPartnerCode = (code: string) => PARTNER_CODE_RE.test(code);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthResult<D = Session | null> {
  data: D | null;
  error: AuthError | null;
}

export type AuthActionKey =
  | "signIn" | "signUp" | "signOut" | "resetPassword" | "googleOAuth";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  bootstrapping: boolean;
  sessionExpired: boolean;
  actionLoading: Partial<Record<AuthActionKey, boolean>>;
  authError: AuthError | null;
  clearAuthError: () => void;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, displayName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<AuthResult<null>>;
  signInWithOAuth: (provider: Provider) => Promise<AuthResult<null>>;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  session: Session | null;
  bootstrapping: boolean;
  sessionExpired: boolean;
}

type ReducerAction =
  | { type: "BOOTSTRAP"; session: Session | null }
  | { type: "SIGNED_IN"; session: Session }
  | { type: "TOKEN_REFRESHED"; session: Session }
  | { type: "USER_UPDATED"; session: Session }
  | { type: "SIGNED_OUT"; expired: boolean }
  | { type: "PASSWORD_RECOVERY" };

function authReducer(state: AuthState, action: ReducerAction): AuthState {
  switch (action.type) {
    case "BOOTSTRAP":
      return { user: action.session?.user ?? null, session: action.session, bootstrapping: false, sessionExpired: false };
    case "SIGNED_IN":
    case "TOKEN_REFRESHED":
    case "USER_UPDATED":
      return { ...state, user: action.session.user, session: action.session, sessionExpired: false };
    case "SIGNED_OUT":
      return { user: null, session: null, bootstrapping: false, sessionExpired: action.expired };
    case "PASSWORD_RECOVERY":
      return state;
    default:
      return state;
  }
}

// ─── Post-Auth Actions ────────────────────────────────────────────────────────

function usePostAuthActions() {
  const qc = useQueryClient();
  const done = useRef(new Set<string>());

  const run = useCallback(async (session: Session): Promise<void> => {
    const userId = session.user.id;
    if (done.current.has(userId)) return;
    done.current.add(userId);

    const rawCode = ephemeralStorage.get(PARTNER_CODE_KEY);
    if (rawCode) {
      const code = normalisePartnerCode(rawCode);
      if (isValidPartnerCode(code)) {
        try {
          await withRetry(async () => {
            await supabase
              .rpc("accept_couple_invite", { _invite_code: code })
              .throwOnError();
          });
          ephemeralStorage.remove(PARTNER_CODE_KEY);
          qc.invalidateQueries({ queryKey: QK.myCouple() });
          qc.invalidateQueries({ queryKey: QK.profilesAll() });
          qc.invalidateQueries({ queryKey: QK.mediaAll() });
          qc.invalidateQueries({ queryKey: QK.folders() });
          authLog.info("Partner invite accepted", { userId });
        } catch (err) {
          authLog.error("accept_couple_invite failed", { err });
        }
      } else {
        ephemeralStorage.remove(PARTNER_CODE_KEY);
        authLog.warn("Discarded invalid partner code", { rawCode });
      }
    }

    const rawRedirect = ephemeralStorage.get(JOIN_REDIRECT_KEY);
    if (rawRedirect) {
      ephemeralStorage.remove(JOIN_REDIRECT_KEY);
      const safePath = sanitiseRedirect(rawRedirect);
      if (safePath && isBrowser) {
        authLog.info("Post-auth redirect", { safePath });
        window.location.replace(safePath);
      }
    }
  }, [qc]);

  const clearForUser = useCallback((userId: string) => {
    done.current.delete(userId);
  }, []);

  return { run, clearForUser };
}

// ─── Auth Provider ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null, session: null, bootstrapping: true, sessionExpired: false,
  });
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const [actionLoading, setActionLoading] = useState<Partial<Record<AuthActionKey, boolean>>>({});
  const inFlight = useRef<Partial<Record<AuthActionKey, boolean>>>({});
  const hadSession = useRef(false);

  const { run: runPostAuth, clearForUser } = usePostAuthActions();

  if (state.session) hadSession.current = true;

  useEffect(() => {
    let bootstrapped = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        authLog.info("auth event", { event, userId: session?.user.id });

        switch (event) {
          case "INITIAL_SESSION":
            bootstrapped = true;
            dispatch({ type: "BOOTSTRAP", session });
            if (session) runPostAuth(session);
            break;
          case "SIGNED_IN":
            dispatch({ type: "SIGNED_IN", session: session! });
            runPostAuth(session!);
            break;
          case "TOKEN_REFRESHED":
            dispatch({ type: "TOKEN_REFRESHED", session: session! });
            break;
          case "USER_UPDATED":
            dispatch({ type: "USER_UPDATED", session: session! });
            break;
          case "SIGNED_OUT": {
            const expired = hadSession.current && !inFlight.current.signOut;
            dispatch({ type: "SIGNED_OUT", expired });
            break;
          }
          case "PASSWORD_RECOVERY":
            dispatch({ type: "PASSWORD_RECOVERY" });
            break;
        }
      }
    );

    const timeout = setTimeout(() => {
      if (!bootstrapped) {
        authLog.warn("INITIAL_SESSION did not fire — forcing bootstrap");
        dispatch({ type: "BOOTSTRAP", session: null });
      }
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [runPostAuth]);

  // ─── Action Helpers ───────────────────────────────────────────────────────

  const startAction = useCallback((key: AuthActionKey) => {
    inFlight.current[key] = true;
    setActionLoading(p => ({ ...p, [key]: true }));
    setAuthError(null);
  }, []);

  const endAction = useCallback((key: AuthActionKey, err: AuthError | null) => {
    inFlight.current[key] = false;
    setActionLoading(p => ({ ...p, [key]: false }));
    if (err) setAuthError(err);
  }, []);

  const isInFlight = (key: AuthActionKey) => !!inFlight.current[key];
  const clearAuthError = useCallback(() => setAuthError(null), []);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (isInFlight("signIn")) return { data: null, error: null };
    startAction("signIn");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      endAction("signIn", error);
      return { data: data.session, error };
    } catch (e) {
      const err = e as AuthError;
      endAction("signIn", err);
      return { data: null, error: err };
    }
  }, [startAction, endAction]);

  const signUp = useCallback(async (email: string, password: string, displayName: string): Promise<AuthResult> => {
    if (isInFlight("signUp")) return { data: null, error: null };
    startAction("signUp");
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${getOrigin()}/auth/callback`,
        },
      });
      endAction("signUp", error);
      return { data: data.session, error };
    } catch (e) {
      const err = e as AuthError;
      endAction("signUp", err);
      return { data: null, error: err };
    }
  }, [startAction, endAction]);

  const signOut = useCallback(async (): Promise<void> => {
    if (isInFlight("signOut")) return;
    startAction("signOut");
    if (state.user?.id) clearForUser(state.user.id);

    // OPTIMIZATION: Clear chat media caches on logout
    try {
      await clearChatMediaCaches();
    } catch (e) {
      console.warn("[signOut] Failed to clear chat caches:", e);
      // Don't fail the logout if cache clearing fails
    }

    try {
      await supabase.auth.signOut();
    } catch (e) {
      endAction("signOut", e as AuthError);
      return;
    }
    endAction("signOut", null);
  }, [startAction, endAction, clearForUser, state.user?.id]);

  const resetPasswordForEmail = useCallback(async (email: string): Promise<AuthResult<null>> => {
    if (isInFlight("resetPassword")) return { data: null, error: null };
    startAction("resetPassword");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getOrigin()}/auth/callback`,
      });
      endAction("resetPassword", error);
      return { data: null, error };
    } catch (e) {
      const err = e as AuthError;
      endAction("resetPassword", err);
      return { data: null, error: err };
    }
  }, [startAction, endAction]);

  const signInWithOAuth = useCallback(async (provider: Provider): Promise<AuthResult<null>> => {
    if (isInFlight("googleOAuth")) return { data: null, error: null };
    startAction("googleOAuth");
    const current = getPathname();
    if (current && current !== "/auth") {
      ephemeralStorage.set(JOIN_REDIRECT_KEY, current);
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${getOrigin()}/auth/callback` },
      });
      if (error) { endAction("googleOAuth", error); return { data: null, error }; }
      return { data: null, error: null };
    } catch (e) {
      const err = e as AuthError;
      endAction("googleOAuth", err);
      return { data: null, error: err };
    }
  }, [startAction, endAction]);

  const value: AuthContextType = {
    user: state.user,
    session: state.session,
    bootstrapping: state.bootstrapping,
    sessionExpired: state.sessionExpired,
    actionLoading,
    authError,
    clearAuthError,
    signIn,
    signUp,
    signOut,
    resetPasswordForEmail,
    signInWithOAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("[useAuth] must be called inside <AuthProvider>.");
  return ctx;
}

export function useAuthOptional(): AuthContextType | undefined {
  return useContext(AuthContext);
}

export function useRequireAuth(loginPath = "/auth"): AuthContextType {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.bootstrapping) return;
    if (!auth.session) {
      const current = getPathname();
      if (current !== loginPath) ephemeralStorage.set(JOIN_REDIRECT_KEY, current);
      navigate(loginPath, { replace: true });
    }
  }, [auth.bootstrapping, auth.session, navigate, loginPath]);

  return auth;
}

export function useSessionExpired(): boolean {
  return useAuthOptional()?.sessionExpired ?? false;
}
