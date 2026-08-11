import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { APP_PATHS, authPath, dashboardRouteRedirect, sanitiseRedirect } from "@/app/router/paths";
import { RouteLoading } from "@/app/router/RouteLoading";
import { AppLockScreen } from "@/components/settings/AppLockScreen";
import { useIsAdmin } from "@/hooks/useAdmin";
import { useAppLock } from "@/hooks/useAppLock";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute() {
  const { session, bootstrapping } = useAuth();
  const { locked, lockMethod, unlock } = useAppLock(!!session);
  const location = useLocation();

  if (bootstrapping) return <RouteLoading />;
  if (!session) {
    const destination = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={authPath(destination)} replace />;
  }
  if (locked) return <AppLockScreen lockMethod={lockMethod} onUnlock={unlock} />;

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { session, bootstrapping } = useAuth();
  const location = useLocation();

  if (bootstrapping) return <RouteLoading />;
  if (session) {
    const redirectTo = sanitiseRedirect(new URLSearchParams(location.search).get("redirect"));
    return <Navigate to={redirectTo ?? APP_PATHS.dashboard} replace />;
  }

  return <Outlet />;
}

export function AdminOnlyRoute() {
  const { data: isAdmin, isLoading, isError } = useIsAdmin();

  if (isLoading) return <RouteLoading />;
  if (isError || !isAdmin) return <Navigate to={APP_PATHS.dashboard} replace />;

  return <Outlet />;
}

export function DashboardRoute({ children }: { children: ReactNode }) {
  const { tab, folderId } = useParams<{ tab?: string; folderId?: string }>();
  const redirectTo = dashboardRouteRedirect(tab, folderId);

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
}
