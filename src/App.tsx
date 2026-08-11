import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { BackgroundUploadsProvider } from "@/hooks/useBackgroundUploads";
import { useAppLock } from "@/hooks/useAppLock";
import { AppLockScreen } from "@/components/AppLockScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionStatusIndicator } from "@/hooks/useConnectionStatus";
import { Loader2 } from "lucide-react";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Join = lazy(() => import("./pages/Join"));
const Admin = lazy(() => import("./pages/Admin"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const PaymentReturn = lazy(() => import("./pages/PaymentReturn"));
const InviteExpired = lazy(() => import("./components/Inviteexpired"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-5 rounded-3xl border border-border/60 bg-card/70 p-5 shadow-card animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Loading..." />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Opening usMoments</p>
            <p className="text-xs text-muted-foreground">Getting your private space ready...</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="aspect-square rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, bootstrapping } = useAuth();
  const { locked, lockMethod, unlock } = useAppLock(!!session);

  if (bootstrapping) return <LoadingScreen />;
  if (!session) return <Navigate to="/auth" replace />;
  if (locked) return <AppLockScreen lockMethod={lockMethod} onUnlock={unlock} />;

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, bootstrapping } = useAuth();

  if (bootstrapping) return <LoadingScreen />;
  if (session) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ConnectionStatusIndicator />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <BackgroundUploadsProvider>
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/join" element={<Join />} />
                  <Route path="/payment-return" element={<ProtectedRoute><PaymentReturn /></ProtectedRoute>} />
                  <Route path="/travel-map" element={<ProtectedRoute><Navigate to="/dashboard/travel-map" replace /></ProtectedRoute>} />

                  <Route path="/dashboard/folder/:folderId" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/dashboard/:tab" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                  <Route path="/invite-expired" element={<InviteExpired />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BackgroundUploadsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
