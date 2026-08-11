import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Download, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useToast } from "@/hooks/use-toast";
import { haptic } from "@/lib/haptics";

export function NotificationsPanel() {
  const { data: notifications = [] } = useNotifications();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canInstall, install, isIOS, isInstalled } = usePWAInstall();

  const unread = notifications.filter((n) => !n.read).length;

  const handleInstall = async () => {
    haptic("light");
    if (canInstall) {
      const outcome = await install();
      if (outcome === "accepted") {
        toast({ title: "Installing usMoments", description: "The app is being added to your device." });
      }
      return;
    }

    if (isIOS) {
      toast({
        title: "Install usMoments",
        description: "Tap Share, then Add to Home Screen.",
      });
      return;
    }

    toast({
      title: "Install from your browser",
      description: "Open the browser menu and choose Install app or Add to Home Screen.",
    });
  };

  if (!isInstalled) {
    return (
      <Button
        variant="default"
        size="sm"
        className="h-8 gap-1.5 rounded-md px-2.5 text-xs active:scale-[0.98]"
        onClick={() => void handleInstall()}
      >
        <Download className="h-3 w-3" />
        <span className="hidden sm:inline">Download app</span>
        <span className="sm:hidden">App</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-9 w-9"
      onClick={() => {
        haptic("light");
        navigate("/dashboard/activity");
      }}
      aria-label="Open activity"
    >
      <Heart className="h-4 w-4" />

      {unread > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Button>
  );
}
