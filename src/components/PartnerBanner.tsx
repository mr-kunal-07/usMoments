import { useNavigate } from "react-router-dom";
import { Heart, Link2 } from "lucide-react";
import { useMyCouple } from "@/hooks/useCouple";

export function PartnerBanner() {
  const { data: couple, isLoading, isError } = useMyCouple();
  const navigate = useNavigate();

  // ✅ Safe guards
  if (isLoading || isError || couple?.status === "active") {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Connect partner banner"
      className="
        mx-3 sm:mx-6 mt-3
        flex items-center gap-2
        rounded-lg
        border border-primary/20
        bg-primary/5
        px-3 py-2
        overflow-hidden
      "
    >
      {/* Icon */}
      <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Link2 className="h-3.5 w-3.5 text-primary" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-foreground truncate">
          Connect with your partner 💕
        </p>
        <p className="hidden md:block text-xs text-muted-foreground truncate">
          Share memories together
        </p>
      </div>

      {/* ✅ Custom Button (No import) */}
      <button
        onClick={() => navigate("/profile")}
        aria-label="Connect with partner"
        className="
          flex items-center gap-1
          shrink-0
          h-7 px-2.5
          text-xs font-medium
          rounded-md
          bg-primary text-primary-foreground
          hover:bg-primary/90
          active:scale-95
          transition-all
          focus:outline-none focus:ring-2 focus:ring-primary/40
        "
      >
        <Heart className="h-3 w-3" />
        Connect
      </button>
    </div>
  );
}