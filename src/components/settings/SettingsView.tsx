import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { APP_PATHS } from "@/app/router/paths";
import {
  Bell,
  Camera,
  Crown,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  Heart,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Moon,
  Save,
  ShieldCheck,
  Smartphone,
  Sun,
  Monitor,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyCouple } from "@/hooks/useCouple";
import { useProfile, useUpdateProfile, useUploadAvatar } from "@/hooks/useProfile";
import { usePlan } from "@/hooks/useSubscription";
import { useTheme } from "@/hooks/useTheme";
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
import { PartnerConnect } from "@/components/couples/PartnerConnect";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { enablePushNotifications, pushSupportState } from "@/hooks/usePushNotifications";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Props {
  onNavigateBilling: () => void;
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
  const rawPlan = usePlan();
  const plan = rawPlan as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? user?.email?.split("@")[0] ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [lockMethod, setLockMethod] = useState<"pin" | "biometric" | null>(() => getLockMethod());
  const [hasPin, setHasPin] = useState(() => hasConfiguredPin());
  const [pinSetupMode, setPinSetupMode] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [showPin, setShowPin] = useState(false);
  const biometricSupported = typeof window !== "undefined" && "PublicKeyCredential" in window;

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">(() => pushSupportState().permission);
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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
  const initials = (profile?.display_name ?? user?.email ?? "U").slice(0, 2).toUpperCase();

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadAvatar.mutateAsync(file);
      setAvatarUrl(url);
      await updateProfile.mutateAsync({ avatarUrl: url });
      toast({ title: "Avatar updated" });
    } catch {
      toast({ title: "Error uploading avatar", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({ displayName: displayName.trim() || undefined });
      toast({ title: "Profile saved" });
    } catch {
      toast({ title: "Error saving profile", variant: "destructive" });
    }
  };

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    try {
      const result = await enablePushNotifications();
      const { permission } = pushSupportState();
      setPushPermission(permission);

      if (result === "granted") {
        toast({ title: "Notifications enabled", description: "Push notifications are now active on this device." });
      } else if (result === "denied") {
        toast({ title: "Notifications blocked", description: "Browser notification permission is denied for this app.", variant: "destructive" });
      } else if (result === "unsupported") {
        toast({ title: "Not supported", description: "Push notifications are not supported on this device/browser.", variant: "destructive" });
      } else {
        toast({ title: "Open the installed app first", description: "Install usMoments to your home screen before enabling push notifications." });
      }
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleInstall = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  const resetPinForm = () => {
    setPinSetupMode(false);
    setPinInput("");
    setPinConfirm("");
    setShowPin(false);
  };

  const handleSavePin = async () => {
    if (pinInput.length < 4) {
      toast({ title: "PIN must be at least 4 digits", variant: "destructive" });
      return;
    }

    if (pinInput !== pinConfirm) {
      toast({ title: "PINs don't match", variant: "destructive" });
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
    toast({ title: "PIN lock removed" });
  };

  const handleEnableBiometric = async () => {
    if (!biometricSupported) {
      toast({ title: "Biometrics not supported on this device", variant: "destructive" });
      return;
    }

    try {
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "usMomentss", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(user?.id ?? "user"),
            name: user?.email ?? "user",
            displayName: profile?.display_name ?? "User",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;

      if (!credential) return;

      const credIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      saveBiometricCredentialId(credIdBase64);
      setStoredLockMethod("biometric");
      setLockMethod("biometric");
      toast({ title: "Biometric lock enabled" });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast({ title: "Biometric setup cancelled" });
      } else {
        toast({ title: "Biometric not available on this device", variant: "destructive" });
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

  return (
    <div className="mx-auto max-w-lg space-y-5 p-4 pb-24 sm:p-6 sm:pb-8">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Profile</CardTitle>
          <CardDescription className="text-xs">Manage your display name and avatar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16 ring-2 ring-border">
                {currentAvatarUrl && <AvatarImage src={currentAvatarUrl} alt="Avatar" />}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
              >
                {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="flex-1 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Display Name</Label>
                <Input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={user?.email ?? ""} disabled className="h-8 text-sm text-muted-foreground" />
              </div>
            </div>
          </div>

          <Button onClick={() => void handleSave()} disabled={updateProfile.isPending} size="sm" className="w-full">
            {updateProfile.isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-2 h-3.5 w-3.5" />
            )}
            Save Profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4 fill-primary text-primary" /> Partner
          </CardTitle>
          <CardDescription className="text-xs">Link your partner so you share the vault together</CardDescription>
        </CardHeader>
        <CardContent>
          {couple?.status === "active" ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/8 px-3 py-2.5">
              <Heart className="h-4 w-4 shrink-0 fill-primary text-primary" />
              <span className="text-sm font-medium text-foreground">Partner connected</span>
            </div>
          ) : (
            <PartnerConnect />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            {theme === "light" ? (
              <Sun className="mt-0.5 h-4 w-4 text-muted-foreground" />
            ) : theme === "dim" ? (
              <Monitor className="mt-0.5 h-4 w-4 text-muted-foreground" />
            ) : (
              <Moon className="mt-0.5 h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Choose the look for the whole app</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={theme === "light" ? "default" : "outline"}
              className="h-10 gap-2 rounded-lg"
              onClick={() => setTheme("light")}
            >
              <Sun className="h-4 w-4" />
              Light
            </Button>
            <Button
              type="button"
              variant={theme === "dim" ? "default" : "outline"}
              className="h-10 gap-2 rounded-lg"
              onClick={() => setTheme("dim")}
            >
              <Monitor className="h-4 w-4" />
              Dim
            </Button>
            <Button
              type="button"
              variant={theme === "dark" ? "default" : "outline"}
              className="h-10 gap-2 rounded-lg"
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              `Dim` keeps the dark look softer. `Dark` matches the full auth-style deep theme.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> App Lock
          </CardTitle>
          <CardDescription className="text-xs">Protect your vault with a PIN or device biometrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lockMethod && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/8 px-3 py-2.5">
              {lockMethod === "biometric" ? (
                <Fingerprint className="h-4 w-4 shrink-0 text-primary" />
              ) : (
                <KeyRound className="h-4 w-4 shrink-0 text-primary" />
              )}
              <span className="text-sm font-medium text-foreground">
                {lockMethod === "biometric" ? "Biometric lock active" : "PIN lock active"}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Fingerprint className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Fingerprint / Face ID</p>
                <p className="text-xs text-muted-foreground">
                  {biometricSupported
                    ? "Use this device's biometric prompt to unlock"
                    : "Not supported on this device"}
                </p>
              </div>
            </div>
            <Switch
              checked={lockMethod === "biometric"}
              onCheckedChange={(checked) => {
                if (checked) {
                  void handleEnableBiometric();
                } else {
                  handleDisableBiometric();
                }
              }}
              disabled={!biometricSupported}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">PIN Lock</p>
                <p className="text-xs text-muted-foreground">{hasPin ? "PIN is set" : "Set a 4-6 digit PIN"}</p>
              </div>
            </div>
            <Switch
              checked={lockMethod === "pin"}
              onCheckedChange={(checked) => {
                if (checked) {
                  setPinSetupMode(true);
                } else {
                  handleRemovePin();
                }
              }}
            />
          </div>

          {pinSetupMode && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">Set your PIN</p>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Enter 4-6 digit PIN"
                  value={pinInput}
                  onChange={(event) => setPinInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-8 pr-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => void handleSavePin()} disabled={pinInput.length < 4}>
                  <Lock className="mr-1.5 h-3.5 w-3.5" /> Set PIN
                </Button>
                <Button size="sm" variant="outline" onClick={resetPinForm}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Crown className="h-4 w-4 text-primary" /> Subscription
          </CardTitle>
          <CardDescription className="text-xs">
            {plan === "soulmate" ? "Soulmate plan - full access" : plan === "dating" ? "Dating plan active" : "Free plan"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onNavigateBilling} variant="outline" size="sm" className="w-full">
            <Crown className="mr-2 h-3.5 w-3.5 text-primary" />
            {plan === "free" ? "Upgrade Plan" : "Manage Plan"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4 text-primary" /> Install App
          </CardTitle>
          <CardDescription className="text-xs">Add usMoments to your home screen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isInstalled ? (
            <div className="flex items-center gap-3 rounded-lg border border-primary/15 bg-primary/8 px-3 py-2.5">
              <Smartphone className="h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">App installed</p>
                <p className="text-xs text-muted-foreground">Running as a standalone app</p>
              </div>
            </div>
          ) : installPrompt ? (
            <div className="space-y-2">
              <Button onClick={() => void handleInstall()} size="sm" className="w-full gap-2">
                <Download className="h-3.5 w-3.5" />
                Install usMoments
              </Button>
              <p className="text-center text-xs text-muted-foreground">Add to home screen for quick access</p>
            </div>
          ) : isIOS ? (
            <div className="space-y-1 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">Install on iOS</p>
              <p className="text-xs text-muted-foreground">
                Tap the share button in Safari, then choose "Add to Home Screen"
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Open in Chrome or Edge to install this app</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" /> Push Notifications
          </CardTitle>
          <CardDescription className="text-xs">
            Turn on notifications after installing usMoments on your phone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pushPermission === "granted" ? (
            <div className="flex items-center gap-3 rounded-lg border border-primary/15 bg-primary/8 px-3 py-2.5">
              <Bell className="h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Notifications enabled</p>
                <p className="text-xs text-muted-foreground">This device can receive push alerts.</p>
              </div>
            </div>
          ) : (
            <>
              <Button
                onClick={() => void handleEnablePush()}
                variant="outline"
                size="sm"
                className="w-full gap-2"
                disabled={isEnablingPush}
              >
                <Bell className="h-3.5 w-3.5" />
                {isEnablingPush ? "Enabling..." : "Enable notifications"}
              </Button>
              <p className="text-xs text-muted-foreground">
                We only ask when you tap this button, which works better on mobile than prompting automatically.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <LogOut className="h-4 w-4" /> Sign Out
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={async () => {
              await signOut();
              navigate(APP_PATHS.auth);
            }}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sign out of usMoments
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You'll need to sign in again to access your vault
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
