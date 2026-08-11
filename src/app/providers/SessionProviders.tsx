import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { BackgroundUploadsProvider } from "@/hooks/useBackgroundUploads";

export function SessionProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <BackgroundUploadsProvider>{children}</BackgroundUploadsProvider>
    </AuthProvider>
  );
}
