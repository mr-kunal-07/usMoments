import { Loader2 } from "lucide-react";

export function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex items-center gap-3" role="status" aria-live="polite">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        <span className="text-sm font-medium text-foreground">Opening usMoments...</span>
      </div>
    </div>
  );
}
