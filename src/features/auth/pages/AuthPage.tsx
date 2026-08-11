import { useState, useCallback, useId, useEffect } from "react";
import { Navigate, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import {
  useAuth,
  JOIN_REDIRECT_KEY,
  PARTNER_CODE_KEY,
  ephemeralStorage,
  normalisePartnerCode,
  isValidPartnerCode,
} from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/useToast";
import {
  Eye, EyeOff, Heart, Loader2, Mail, Lock,
  User, ArrowRight, ArrowLeft, Link2,
  CheckCircle2, XCircle, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { appConfig } from "@/lib/config";
import { APP_PATHS, sanitiseRedirect } from "@/app/router/paths";

type Mode = "signin" | "signup" | "forgot";

type CodeValidationResult = {
  ok: boolean;
  reason: "valid" | "committed" | "missing" | "error";
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = {
  email: (v: string) => !v.trim() ? "Email is required." : !EMAIL_RE.test(v) ? "Please enter a valid email address." : null,
  password: (v: string) => !v ? "Password is required." : v.length < 6 ? "Password must be at least 6 characters." : null,
  displayName: (v: string) => !v.trim() ? "Please enter your name." : v.trim().length < 2 ? "Name must be at least 2 characters." : null,
};

async function validatePartnerCode(code: string): Promise<CodeValidationResult> {
  const { data, error, count } = await supabase
    .from("couples")
    .select("user2_id", { count: "exact" })
    .eq("invite_code", code)
    .maybeSingle();

  // Hard Supabase/network error
  if (error) {
    return { ok: false, reason: "error", message: "Unable to verify partner code. Please try again." };
  }

  // count === 0 means the row genuinely does not exist (deleted/expired)
  // data === null with count === null means RLS silently blocked the read —
  // treat as a transient error so the user can still proceed rather than
  // being incorrectly sent to /invite-expired
  if (count === 0) {
    return { ok: false, reason: "error", message: "Invite not found." };
  }
  if (!data) {
    // RLS blocked — can't confirm either way, let user attempt submission
    return { ok: false, reason: "error", message: "Unable to verify partner code. Please try again." };
  }

  // Row found — check if partner slot is already taken
  if (data.user2_id !== null) {
    return { ok: false, reason: "committed" };
  }

  return { ok: true, reason: "valid" };
}

async function validatePartnerCodeRpc(code: string): Promise<CodeValidationResult> {
  const { data, error } = await supabase.rpc("check_couple_invite", { _invite_code: code });

  if (error) {
    return { ok: false, reason: "error", message: "Unable to verify partner code. Please try again." };
  }

  const result = data as { ok?: boolean; reason?: string } | null;
  const reason = result?.reason ?? "error";

  if (reason === "valid") return { ok: true, reason: "valid" };
  if (reason === "committed") return { ok: false, reason: "committed" };
  if (reason === "missing") return { ok: false, reason: "missing", message: "Invite not found." };

  return { ok: false, reason: "error", message: "Unable to verify partner code. Please try again." };
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
}

function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">{label}</Label>
      {children}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1 mt-1" role="alert">
          <XCircle className="h-3 w-3 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {!error && hint && <div className="mt-1">{hint}</div>}
    </div>
  );
}

interface InputIconProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ReactNode;
  suffix?: React.ReactNode;
  error?: boolean;
}

function InputIcon({ icon, suffix, error, className, ...rest }: InputIconProps) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-3 text-white/45 pointer-events-none select-none">{icon}</span>
      <Input
        {...rest}
        aria-invalid={error ? "true" : "false"}
        className={cn(
          "h-11 pl-10 bg-white/5 text-white placeholder:text-white/30 transition-all ring-offset-0",
          error ? "border-destructive focus-visible:ring-destructive/40" : "border-white/15 focus-visible:ring-[#5865ff]/40",
          suffix ? "pr-10" : "pr-3",
          className,
        )}
      />
      {suffix && <span className="absolute right-3 flex items-center">{suffix}</span>}
    </div>
  );
}

function GoogleBtn({ loading, onClick, label = "Continue with Google", disabled }: {
  loading: boolean; onClick: () => void; label?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      aria-busy={loading}
      className={cn(
        "w-full flex items-center justify-center gap-2.5 h-11 rounded-lg",
        "border border-white/10 bg-white/5 text-sm font-semibold text-white",
        "hover:bg-white/10 active:scale-[0.98] transition-all",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865ff]",
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
      {label}
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 py-5">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-xs text-white/40 select-none">or</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

function SubmitBtn({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      className={cn(
        "w-full flex items-center justify-center gap-2 h-11 rounded-lg mt-2",
        "bg-[#4a55f5] text-white text-sm font-semibold",
        "hover:bg-[#5865ff] active:scale-[0.98] transition-all",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865ff]",
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Hide password" : "Show password"}
      className="text-white/45 hover:text-white transition-colors focus-visible:outline-none"
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-bold font-heading text-white">{title}</h2>
      <p className="text-sm text-white/55 mt-1">{subtitle}</p>
    </div>
  );
}

function ModeSwitch({ question, action, onSwitch }: { question: string; action: string; onSwitch: () => void }) {
  return (
    <p className="mt-5 text-center text-sm text-white/50">
      {question}{" "}
      <button
        type="button"
        onClick={onSwitch}
        className="text-[#7f8cff] hover:text-[#a8b0ff] font-medium transition-colors focus-visible:outline-none focus-visible:underline"
      >
        {action}
      </button>
    </p>
  );
}

function passwordStrength(pw: string) {
  if (!pw) return { score: 0, label: "", colour: "bg-border" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: "Weak", colour: "bg-destructive" },
    { label: "Fair", colour: "bg-orange-500" },
    { label: "Good", colour: "bg-yellow-500" },
    { label: "Strong", colour: "bg-green-500" },
    { label: "Great", colour: "bg-emerald-500" },
  ];
  return { score, ...map[score] };
}

function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, colour } = passwordStrength(password);
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn("h-1 flex-1 rounded-full transition-all duration-300", i < score ? colour : "bg-border/50")} />
        ))}
      </div>
      <p className="text-[11px] text-white/45">{label}</p>
    </div>
  );
}

function PasswordMatchHint({ password, confirm }: { password: string; confirm: string }) {
  if (!confirm) return null;
  const match = password === confirm;
  return (
    <p className={cn("text-xs flex items-center gap-1 mt-1", match ? "text-green-600" : "text-destructive")} aria-live="polite">
      {match
        ? <><CheckCircle2 className="h-3 w-3" aria-hidden />Passwords match</>
        : <><XCircle className="h-3 w-3" aria-hidden />Passwords don't match</>}
    </p>
  );
}

export default function Auth() {
  const { session, bootstrapping, actionLoading, signIn, signUp, resetPasswordForEmail, signInWithOAuth } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectAfterAuth = sanitiseRedirect(searchParams.get("redirect"));

  const initialMode = (() => {
    const state = (location.state ?? {}) as { mode?: Mode };
    if (state.mode === "signup" || state.mode === "forgot" || state.mode === "signin") return state.mode;
    return "signin";
  })();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [showAuthPanel, setShowAuthPanel] = useState(initialMode !== "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [partnerCode, setPartnerCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});

  const signingIn = !!actionLoading.signIn;
  const signingUp = !!actionLoading.signUp;
  const resetting = !!actionLoading.resetPassword;
  const oauthLoading = !!actionLoading.googleOAuth;
  const anyLoading = signingIn || signingUp || resetting || oauthLoading;

  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;

  // On mount: if ?code= is present, immediately show the signup form
  // with the code pre-filled — don't wait for DB validation.
  // Validation still runs in the background; if committed it redirects.
  // This way the form appears instantly with no loading delay.
  useEffect(() => {
    if (redirectAfterAuth) ephemeralStorage.set(JOIN_REDIRECT_KEY, redirectAfterAuth);
  }, [redirectAfterAuth]);

  useEffect(() => {
    const invite = searchParams.get("invite");
    if (!invite) return;

    const normalised = normalisePartnerCode(invite);

    // ❌ invalid format
    if (!isValidPartnerCode(normalised)) {
      navigate(APP_PATHS.inviteExpired, { replace: true });
      return;
    }

    // ✅ show signup instantly
    setPartnerCode(normalised);
    setMode("signup");
    setShowAuthPanel(true);

    // ✅ background validation
    (async () => {
      const result = await validatePartnerCodeRpc(normalised);

      if (result.reason === "committed" || result.reason === "missing") {
        navigate(APP_PATHS.inviteExpired, { replace: true });
      }
    })();
  }, [searchParams, navigate]);

  const resetForm = useCallback(() => {
    setPassword(""); setConfirmPassword(""); setDisplayName("");
    setPartnerCode(""); setShowPassword(false); setErrors({});
  }, []);

  const switchMode = useCallback((next: Mode) => {
    resetForm();
    setMode(next);
    setShowAuthPanel(true);
  }, [resetForm]);

  const addError = (key: string, msg: string) => setErrors(prev => ({ ...prev, [key]: msg }));

  const showError = useCallback((title: string, description?: string) => {
    toast({ title, description, variant: "destructive" });
  }, [toast]);

  const handlePartnerCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPartnerCode(normalisePartnerCode(e.target.value));
  }, []);

  const runCodePreflight = useCallback(async (): Promise<boolean> => {
    if (!partnerCode || !isValidPartnerCode(partnerCode)) return true;

    const result = await validatePartnerCodeRpc(partnerCode);

    if (result.reason === "committed") {
      navigate(APP_PATHS.inviteExpired, { replace: true });
      return false;
    }

    if (result.reason === "missing") {
      setErrors(prev => ({ ...prev, partnerCode: result.message ?? "Invite not found." }));
      return false;
    }

    // Important: don't block signup/OAuth if we can't validate due to RLS/network.
    // The partner link is applied after auth via `accept_couple_invite`.
    return true;
  }, [partnerCode, navigate]);

  const handleGoogleSignIn = useCallback(async () => {
    const passed = await runCodePreflight();
    if (!passed) return;

    if (partnerCode && isValidPartnerCode(partnerCode)) {
      ephemeralStorage.set(PARTNER_CODE_KEY, partnerCode);
    }

    const { error } = await signInWithOAuth("google");
    if (error) showError("Google sign-in failed", error.message);
  }, [partnerCode, runCodePreflight, signInWithOAuth, showError]);

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading…" />
      </div>
    );
  }

  if (session) return <Navigate to={redirectAfterAuth ?? APP_PATHS.dashboard} replace />;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const emailErr = validate.email(email);
    const passErr = validate.password(password);
    if (emailErr) addError("email", emailErr);
    if (passErr) addError("password", passErr);
    if (emailErr || passErr) return;
    const { error } = await signIn(email, password);
    if (error) showError("Sign in failed", error.message);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const nameErr = validate.displayName(displayName);
    const emailErr = validate.email(email);
    const passErr = validate.password(password);
    const confirmErr = password !== confirmPassword ? "Passwords don't match." : null;
    const formatErr = partnerCode && !isValidPartnerCode(partnerCode)
      ? "Partner code must be 6–8 characters (letters and numbers only)." : null;

    if (nameErr) addError("displayName", nameErr);
    if (emailErr) addError("email", emailErr);
    if (passErr) addError("password", passErr);
    if (confirmErr) addError("confirmPassword", confirmErr);
    if (formatErr) addError("partnerCode", formatErr);
    if (nameErr || emailErr || passErr || confirmErr || formatErr) return;

    const passed = await runCodePreflight();
    if (!passed) return;

    const { error } = await signUp(email, password, displayName.trim());
    if (error) { showError("Sign up failed", error.message); return; }

    if (partnerCode && isValidPartnerCode(partnerCode)) {
      ephemeralStorage.set(PARTNER_CODE_KEY, partnerCode);
    }

    toast({
      title: "Account created! 🎉",
      description: partnerCode
        ? "Check your email to verify. Your partner code will be applied automatically."
        : "Check your email to verify your account.",
    });
    switchMode("signin");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const emailErr = validate.email(email);
    if (emailErr) { addError("email", emailErr); return; }
    const { error } = await resetPasswordForEmail(email);
    if (error) {
      showError("Failed to send reset email", error.message);
    } else {
      toast({ title: "Check your email", description: "A password reset link has been sent." });
      switchMode("signin");
    }
  };

  const passwordType = showPassword ? "text" : "password";
  const passwordToggle = <PasswordToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />;

  return (
    <div className="auth-theme relative min-h-screen overflow-hidden bg-[#080c11] text-white">
      <header className="flex h-[61px] items-center justify-between border-b border-white/10 px-4">

        <button
          type="button"
          onClick={() => { setMode("signin"); setShowAuthPanel(false); }}
          className="font-heading text-[22px] font-semibold leading-none flex items-center gap-1.5 tracking-tight text-white"
        >
          <img src="/logo.png" alt="" width={34} height={34} aria-hidden />
          usMoments
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setMode("signin"); setShowAuthPanel(true); }}
            className="text-xs font-semibold text-[#a7b0ff] transition hover:text-white focus-visible:outline-none focus-visible:underline"
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setShowAuthPanel(true)}
            disabled={anyLoading}
            className="flex h-9 min-w-20 items-center justify-center rounded-md bg-[#4a55f5] px-4 text-xs font-bold text-white transition hover:bg-[#5865ff] active:scale-[0.98] disabled:opacity-60"
          >
            {oauthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open app"}
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100svh-61px)] w-full max-w-[420px] flex-col px-6 pb-8 pt-4">
        <section className={cn(
          "flex flex-1 flex-col items-center",
          showAuthPanel ? "justify-start pt-10 sm:pt-14" : "justify-center pb-20 sm:pb-28",
        )}>
          <div className="flex flex-col items-center text-center">
            <h1
              className="text-[36px] font-semibold leading-none tracking-normal text-white sm:text-[40px]"
              style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
            >
              usMoments
            </h1>
            <p className="mt-6 max-w-[340px] text-balance text-[20px] font-semibold leading-snug tracking-normal text-white sm:mt-8 sm:text-[22px]">
              Keep{" "}
              <span className="bg-gradient-to-r from-[#ff4545] via-[#d724d9] to-[#7b61ff] bg-clip-text text-transparent">
                everything Private
              </span>{" "}
              with your closest person.
            </p>
          </div>

          {!showAuthPanel && (
            <div className="mt-7 w-full space-y-5">
              <button
                type="button"
                onClick={() => setShowAuthPanel(true)}
                disabled={anyLoading}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-[#4a55f5] text-sm font-bold text-white transition hover:bg-[#5865ff] active:scale-[0.98] disabled:opacity-60"
              >
                {oauthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open usMoments"}
              </button>
              <button
                type="button"
                onClick={() => setShowAuthPanel(true)}
                className="mx-auto block text-sm font-semibold text-[#7f8cff] transition hover:text-[#a8b0ff] focus-visible:outline-none focus-visible:underline"
              >
                Log in or sign up
              </button>
            </div>
          )}

          {showAuthPanel && (
            <div className="mt-8 w-full sm:mt-9">

              {mode === "signin" && (
                <>
                  <Header title="Welcome back" subtitle="Sign in to your account" />
                  {appConfig.googleAuthEnabled && (
                    <>
                      <GoogleBtn loading={oauthLoading} onClick={handleGoogleSignIn} disabled={anyLoading && !oauthLoading} />
                      <Divider />
                    </>
                  )}
                  <form onSubmit={handleSignIn} noValidate className="space-y-4">
                    <Field label="Email" htmlFor={id("si-email")} error={errors.email}>
                      <InputIcon id={id("si-email")} icon={<Mail className="h-4 w-4" />} type="email"
                        placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)}
                        autoComplete="email" required error={!!errors.email} />
                    </Field>
                    <Field label="Password" htmlFor={id("si-password")} error={errors.password}
                      hint={
                        <button type="button" onClick={() => switchMode("forgot")}
                          className="text-xs text-[#7f8cff] hover:text-[#a8b0ff] transition-colors">
                          Forgot password?
                        </button>
                      }>
                      <InputIcon id={id("si-password")} icon={<Lock className="h-4 w-4" />} type={passwordType}
                        placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password" required suffix={passwordToggle} error={!!errors.password} />
                    </Field>
                    <SubmitBtn loading={signingIn}>Sign in <ArrowRight className="h-4 w-4" /></SubmitBtn>
                  </form>
                  <ModeSwitch question="Don't have an account?" action="Create one" onSwitch={() => switchMode("signup")} />
                </>
              )}

              {mode === "signup" && (
                <>
                  <Header title="Create account" subtitle="Join your private couple space" />
                  {appConfig.googleAuthEnabled && (
                    <>
                      <GoogleBtn loading={oauthLoading} onClick={handleGoogleSignIn} label="Sign up with Google" disabled={anyLoading && !oauthLoading} />
                      <Divider />
                    </>
                  )}
                  <form onSubmit={handleSignUp} noValidate className="space-y-4">
                    <Field label="Your Name" htmlFor={id("su-name")} error={errors.displayName}>
                      <InputIcon id={id("su-name")} icon={<User className="h-4 w-4" />} type="text"
                        placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)}
                        autoComplete="name" required error={!!errors.displayName} />
                    </Field>
                    <Field label="Email" htmlFor={id("su-email")} error={errors.email}>
                      <InputIcon id={id("su-email")} icon={<Mail className="h-4 w-4" />} type="email"
                        placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)}
                        autoComplete="email" required error={!!errors.email} />
                    </Field>
                    <Field label="Password" htmlFor={id("su-password")} error={errors.password}>
                      <InputIcon id={id("su-password")} icon={<Lock className="h-4 w-4" />} type={passwordType}
                        placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)}
                        autoComplete="new-password" required suffix={passwordToggle} error={!!errors.password} />
                      <PasswordStrengthBar password={password} />
                    </Field>
                    <Field label="Confirm Password" htmlFor={id("su-confirm")} error={errors.confirmPassword}>
                      <InputIcon id={id("su-confirm")} icon={<Lock className="h-4 w-4" />} type={passwordType}
                        placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        autoComplete="new-password" required suffix={passwordToggle} error={!!errors.confirmPassword} />
                      <PasswordMatchHint password={password} confirm={confirmPassword} />
                    </Field>
                    <Field label="Partner's Invite Code" htmlFor={id("su-partner")} error={errors.partnerCode}
                      hint={<p className="text-[11px] text-white/45">Have a code from your partner? Enter it here to connect on signup.</p>}>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none">
                          <Link2 className="h-4 w-4" />
                        </span>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <span className="text-[10px] text-white/45 select-none">Optional</span>
                        </div>
                        <Input id={id("su-partner")} type="text" placeholder="e.g. AB12CD34"
                          value={partnerCode} onChange={handlePartnerCodeChange}
                          maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false}
                          aria-invalid={!!errors.partnerCode}
                          className={cn(
                            "h-11 bg-white/5 pl-10 pr-20 font-mono uppercase tracking-widest text-white placeholder:text-white/30 ring-offset-0",
                            errors.partnerCode
                              ? "border-destructive focus-visible:ring-destructive/40"
                              : "border-white/15 focus-visible:ring-[#5865ff]/40",
                          )} />
                      </div>
                    </Field>
                    <SubmitBtn loading={signingUp}>
                      {partnerCode
                        ? <><Heart className="h-4 w-4" />Create &amp; Connect</>
                        : <>Create account <ArrowRight className="h-4 w-4" /></>}
                    </SubmitBtn>
                  </form>
                  <ModeSwitch question="Already have an account?" action="Sign in" onSwitch={() => switchMode("signin")} />
                </>
              )}

              {mode === "forgot" && (
                <>
                  <button type="button" onClick={() => switchMode("signin")}
                    className="flex items-center gap-1.5 text-sm text-white/55 hover:text-white transition-colors mb-5 focus-visible:outline-none focus-visible:underline">
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                    Back to sign in
                  </button>
                  <Header title="Reset password" subtitle="We'll send a reset link to your email" />
                  <form onSubmit={handleForgot} noValidate className="space-y-4">
                    <Field label="Email" htmlFor={id("fp-email")} error={errors.email}>
                      <InputIcon id={id("fp-email")} icon={<Mail className="h-4 w-4" />} type="email"
                        placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)}
                        autoComplete="email" required error={!!errors.email} />
                    </Field>
                    <SubmitBtn loading={resetting}>Send reset link <ArrowRight className="h-4 w-4" /></SubmitBtn>
                  </form>
                </>
              )}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-white/35 select-none">
          Private. Secure. Just for us.
        </p>
      </main>
    </div>
  );
}
