import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  Crown,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Heart,
  Loader2,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Save,
  Sun,
} from "lucide-react";
import { APP_PATHS } from "@/app/router/paths";
import { useAuth } from "@/hooks/useAuth";
import { useMyCouple } from "@/hooks/useCouple";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/hooks/useProfile";
import { usePlan, type Plan } from "@/hooks/useSubscription";
import { useTheme, type Theme } from "@/hooks/useTheme";
import {
  APP_LOCK_EVENT,
  clearBiometricCredentialId,
  clearPin,
  getLockMethod,
  hasConfiguredPin,
  saveBiometricCredentialId,
  savePin,
  setStoredLockMethod,
} from "@/hooks/useAppLock";
import { useToast } from "@/hooks/useToast";
import { enablePushNotifications, pushSupportState } from "@/hooks/usePushNotifications";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { PartnerConnect } from "@/components/couples/PartnerConnect";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Props {
  onNavigateBilling: () => void;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-border/70 pb-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function SettingRow({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-md px-1 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </button>
  ) : (
    <div className="flex min-h-14 items-center gap-3 px-1 py-2">{content}</div>
  );
}

function StatusPill({ children, positive = false }: { children: ReactNode; positive?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
        positive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {positive && <Check className="h-3 w-3" />}
      {children}
    </span>
  );
}

function getPlanCopy(plan: Plan) {
  if (plan === "soulmate") return { name: "Soulmate", detail: "Full access" };
  if (plan === "dating") return { name: "Dating", detail: "Premium plan" };
  return { name: "Single", detail: "Free plan" };
}

export function SettingsView({ onNavigateBilling }: Props) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const { data: couple } = useMyCouple();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { canInstall, install, isIOS, isInstalled, isInstalling } = usePWAInstall();
  const plan = usePlan();
  const planCopy = getPlanCopy(plan);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fallbackName = user?.email?.split("@")[0] ?? "";
  const [displayName, setDisplayName] = useState(fallbackName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showPartnerSetup, setShowPartnerSetup] = useState(false);

  const [lockMethod, setLockMethod] = useState<"pin" | "biometric" | null>(() => getLockMethod());
  const [hasPin, setHasPin] = useState(() => hasConfiguredPin());
  const [pinSetupMode, setPinSetupMode] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const biometricSupported = typeof window !== "undefined" && "PublicKeyCredential" in window;

  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">(
    () => pushSupportState().permission,
  );
  const [isEnablingPush, setIsEnablingPush] = useState(false);

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.display_name]);

  useEffect(() => {
    const syncLockState = () => {
      setLockMethod(getLockMethod());
      setHasPin(hasConfiguredPin());
    };
    window.addEventListener("storage", syncLockState);
    window.addEventListener(APP_LOCK_EVENT, syncLockState);
    return () => {
      window.removeEventListener("storage", syncLockState);
      window.removeEventListener(APP_LOCK_EVENT, syncLockState);
    };
  }, []);

  const currentAvatarUrl = avatarUrl ?? profile?.avatar_url ?? null;
  const currentName = profile?.display_name ?? (fallbackName || "User");
  const initials = currentName.slice(0, 2).toUpperCase();
  const normalizedDisplayName = displayName.trim();
  const profileChanged = normalizedDisplayName.length > 0 && normalizedDisplayName !== currentName.trim();

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5 MB", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadAvatar.mutateAsync(file);
      setAvatarUrl(url);
      await updateProfile.mutateAsync({ avatarUrl: url });
      toast({ title: "Profile photo updated" });
    } catch {
      toast({ title: "Could not update photo", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!normalizedDisplayName) return;
    try {
      await updateProfile.mutateAsync({ displayName: normalizedDisplayName });
      toast({ title: "Profile saved" });
    } catch {
      toast({ title: "Could not save profile", variant: "destructive" });
    }
  };

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    try {
      const result = await enablePushNotifications();
      setPushPermission(pushSupportState().permission);
      if (result === "granted") {
        toast({ title: "Notifications enabled" });
      } else if (result === "denied") {
        toast({ title: "Notifications are blocked in browser settings", variant: "destructive" });
      } else if (result === "unsupported") {
        toast({ title: "Notifications are not supported on this device", variant: "destructive" });
      } else {
        toast({ title: "Install usMoments before enabling notifications" });
      }
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleInstall = async () => {
    const outcome = await install();
    if (outcome === "accepted") toast({ title: "Installing usMoments" });
    if (outcome === "error") toast({ title: "Could not start installation", variant: "destructive" });
  };

  const resetPinForm = () => {
    setPinSetupMode(false);
    setPinInput("");
    setPinConfirm("");
    setShowPin(false);
  };

  const handleSavePin = async () => {
    if (pinInput.length < 4) {
      toast({ title: "Use at least 4 digits", variant: "destructive" });
      return;
    }
    if (pinInput !== pinConfirm) {
      toast({ title: "PINs do not match", variant: "destructive" });
      return;
    }
    await savePin(pinInput);
    setStoredLockMethod("pin");
    setHasPin(true);
    setLockMethod("pin");
    resetPinForm();
    toast({ title: "PIN lock enabled" });
  };

  const handleRemovePin = () => {
    clearPin();
    const nextMethod = lockMethod === "biometric" ? "biometric" : null;
    setStoredLockMethod(nextMethod);
    setHasPin(false);
    setLockMethod(nextMethod);
    resetPinForm();
    toast({ title: "PIN removed" });
  };

  const handleEnableBiometric = async () => {
    if (!biometricSupported) return;
    try {
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "usMoments", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(user?.id ?? "user"),
            name: user?.email ?? "user",
            displayName: profile?.display_name ?? "User",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!credential) return;

      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      saveBiometricCredentialId(credentialId);
      setStoredLockMethod("biometric");
      setLockMethod("biometric");
      toast({ title: "Biometric lock enabled" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast({ title: "Biometric setup cancelled" });
      } else {
        toast({ title: "Biometric lock is unavailable", variant: "destructive" });
      }
    }
  };

  const handleDisableBiometric = () => {
    clearBiometricCredentialId();
    const nextMethod = hasConfiguredPin() ? "pin" : null;
    setStoredLockMethod(nextMethod);
    setLockMethod(nextMethod);
    toast({ title: "Biometric lock disabled" });
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate(APP_PATHS.auth);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-4 sm:px-5 sm:pb-10 sm:pt-6">
      <main className="space-y-8">
          <section className="space-y-4">
            <SectionHeading
              title="Account"
              description="Your profile, partner connection, and plan."
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex items-center gap-3 sm:block">
                <div className="relative shrink-0">
                  <Avatar className="h-14 w-14 border border-border sm:h-16 sm:w-16">
                    {currentAvatarUrl && <AvatarImage src={currentAvatarUrl} alt={currentName} />}
                    <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:opacity-60"
                    aria-label="Change profile photo"
                  >
                    {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
                <p className="text-[11px] text-muted-foreground sm:mt-1.5 sm:max-w-16 sm:text-center">JPG or PNG, max 5 MB</p>
              </div>

              <div className="grid min-w-0 flex-1 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="settings-display-name" className="text-xs">Display name</Label>
                  <Input
                    id="settings-display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={50}
                    autoComplete="name"
                    className="h-9"
                  />
                </div>
                <div className="flex min-w-0 items-center gap-3 py-1 text-xs">
                  <span className="shrink-0 text-muted-foreground">Email</span>
                  <span className="min-w-0 truncate font-medium text-foreground">{user?.email}</span>
                </div>
                {profileChanged && (
                  <Button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    disabled={updateProfile.isPending}
                    size="sm"
                    className="h-9 w-full sm:w-fit"
                  >
                    {updateProfile.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                    Save changes
                  </Button>
                )}
              </div>
            </div>

            <div className="divide-y divide-border/70 border-y border-border/70">
              <SettingRow
                icon={<Heart className="h-4 w-4" />}
                title="Partner"
                description={couple?.status === "active" ? "Connected to your shared vault" : "Invite or join your partner"}
                action={couple?.status === "active"
                  ? <StatusPill positive>Connected</StatusPill>
                  : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                onClick={couple?.status === "active" ? undefined : () => setShowPartnerSetup((value) => !value)}
              />
              <SettingRow
                icon={<Crown className="h-4 w-4" />}
                title={`${planCopy.name} plan`}
                description={planCopy.detail}
                action={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                onClick={onNavigateBilling}
              />
            </div>

            {showPartnerSetup && couple?.status !== "active" && (
              <div className="rounded-md border border-border bg-muted/20 p-3 sm:p-4">
                <PartnerConnect />
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeading
              title="Preferences"
              description="Choose how usMoments looks and alerts you."
            />

            <div>
              <p className="mb-2 text-xs font-medium text-foreground">Appearance</p>
              <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1" role="group" aria-label="App theme">
                {([
                  { id: "light", label: "Light", icon: Sun },
                  { id: "dim", label: "Dim", icon: Monitor },
                  { id: "dark", label: "Dark", icon: Moon },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id as Theme)}
                    aria-pressed={theme === id}
                    className={cn(
                      "flex h-10 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      theme === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-y border-border/70">
              <SettingRow
                icon={<Bell className="h-4 w-4" />}
                title="Push notifications"
                description={
                  pushPermission === "granted"
                    ? "Enabled on this device"
                    : pushPermission === "denied"
                      ? "Blocked in browser settings"
                      : pushPermission === "unsupported"
                        ? "Not supported on this device"
                        : "Get messages, calls, and memory alerts"
                }
                action={pushPermission === "granted" ? (
                  <StatusPill positive>On</StatusPill>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleEnablePush();
                    }}
                    disabled={isEnablingPush || pushPermission === "unsupported"}
                  >
                    {isEnablingPush ? <Loader2 className="animate-spin" /> : "Enable"}
                  </Button>
                )}
              />
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading
              title="Privacy"
              description="Protect access to your shared memories on this device."
            />

            <div className="divide-y divide-border/70 border-y border-border/70">
              <SettingRow
                icon={<Fingerprint className="h-4 w-4" />}
                title="Face ID or fingerprint"
                description={biometricSupported ? "Use your device security to unlock" : "Not available on this device"}
                action={
                  <Switch
                    checked={lockMethod === "biometric"}
                    onCheckedChange={(checked) => checked ? void handleEnableBiometric() : handleDisableBiometric()}
                    disabled={!biometricSupported}
                    aria-label="Use biometric app lock"
                  />
                }
              />
              <SettingRow
                icon={<Lock className="h-4 w-4" />}
                title="PIN lock"
                description={hasPin ? "A PIN is configured on this device" : "Set a secure 4 to 6 digit PIN"}
                action={
                  <Switch
                    checked={lockMethod === "pin"}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        handleRemovePin();
                        return;
                      }
                      if (hasPin) {
                        setStoredLockMethod("pin");
                        setLockMethod("pin");
                        toast({ title: "PIN lock enabled" });
                        return;
                      }
                      setPinSetupMode(true);
                    }}
                    aria-label="Use PIN app lock"
                  />
                }
              />
            </div>

            {pinSetupMode && (
              <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3 sm:p-4">
                <div>
                  <p className="text-sm font-semibold">Set a PIN</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Use 4 to 6 digits you can remember.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="relative">
                    <Input
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="Enter PIN"
                      value={pinInput}
                      onChange={(event) => setPinInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="pr-11"
                      aria-label="Enter PIN"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((value) => !value)}
                      className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground"
                      aria-label={showPin ? "Hide PIN" : "Show PIN"}
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Confirm PIN"
                    value={pinConfirm}
                    onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    aria-label="Confirm PIN"
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={resetPinForm}>Cancel</Button>
                  <Button type="button" onClick={() => void handleSavePin()} disabled={pinInput.length < 4 || pinConfirm.length < 4}>
                    <Lock /> Save PIN
                  </Button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <SectionHeading
              title="App"
              description="Installation and session controls for this device."
            />

            <div className="border-y border-border/70">
              <SettingRow
                icon={<Download className="h-4 w-4" />}
                title="Install usMoments"
                description={
                  isInstalled
                    ? "Installed and ready on this device"
                    : canInstall
                      ? "Add the app for faster access"
                      : isIOS
                        ? "In Safari, use Share then Add to Home Screen"
                        : "Use Chrome or Edge to install the app"
                }
                action={isInstalled ? (
                  <StatusPill positive>Installed</StatusPill>
                ) : canInstall ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleInstall()} disabled={isInstalling}>
                    {isInstalling ? <Loader2 className="animate-spin" /> : "Install"}
                  </Button>
                ) : null}
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-14 w-full items-center gap-3 rounded-md px-1 py-2 text-left text-destructive transition-colors hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-destructive/10">
                    <LogOut className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">Sign out</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">End this session on the current device</span>
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-md p-5">
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out of usMoments?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will need to sign in again to access your shared vault on this device.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isSigningOut}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();
                      void handleSignOut();
                    }}
                    disabled={isSigningOut}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isSigningOut && <Loader2 className="animate-spin" />}
                    Sign out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
      </main>
    </div>
  );
}
