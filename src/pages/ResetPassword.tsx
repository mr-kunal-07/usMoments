import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const RECOVERY_WAIT_MS = 5000;

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const markReady = () => {
      if (!active) return;
      setReady(true);
      setLinkError(null);
    };

    const timeoutId = window.setTimeout(() => {
      if (!active) return;
      setLinkError("This reset link is invalid or has expired. Please request a new one.");
    }, RECOVERY_WAIT_MS);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.clearTimeout(timeoutId);
        markReady();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        window.clearTimeout(timeoutId);
        markReady();
      }
    });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!ready) {
      toast({ title: "Reset link not ready", description: "Open the reset link from your email again.", variant: "destructive" });
      return;
    }

    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Password updated", description: "You can now sign in with your new password." });
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-primary">
            <KeyRound className="h-8 w-8" />
            <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
          </div>
          <p className="text-sm text-muted-foreground">Enter your new password below</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>New Password</CardTitle>
              <CardDescription>
                {linkError
                  ? linkError
                  : ready
                    ? "Choose a strong new password."
                    : "Loading recovery session..."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  placeholder="Enter a new password"
                  disabled={!ready || submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                  placeholder="Confirm your new password"
                  disabled={!ready || submitting}
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={!ready || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update password"
                )}
              </Button>

              {linkError && (
                <Button type="button" variant="outline" className="w-full" onClick={() => navigate("/auth", { state: { mode: "forgot" } })}>
                  Request a new reset link
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
