export const DASHBOARD_VIEWS = [
  "all",
  "starred",
  "recently-deleted",
  "timeline",
  "on-this-day",
  "anniversaries",
  "chat",
  "activity",
  "billing",
  "settings",
  "love-story",
  "travel-map",
] as const;

export type DashboardView = (typeof DASHBOARD_VIEWS)[number];

export const APP_PATHS = {
  home: "/",
  auth: "/auth",
  authCallback: "/auth/callback",
  resetPassword: "/reset-password",
  join: "/join",
  inviteExpired: "/invite-expired",
  dashboard: "/dashboard",
  profile: "/profile",
  admin: "/admin",
  paymentReturn: "/payment-return",
  legacyTravelMap: "/travel-map",
  notFound: "/not-found",
} as const;

const AUTH_REDIRECT_ALLOWLIST = [
  APP_PATHS.dashboard,
  APP_PATHS.profile,
  APP_PATHS.admin,
  APP_PATHS.join,
  APP_PATHS.paymentReturn,
] as const;

export function isDashboardView(value: string | undefined): value is DashboardView {
  return !!value && (DASHBOARD_VIEWS as readonly string[]).includes(value);
}

export function isFolderId(value: string | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function dashboardPath(view: DashboardView = "all"): string {
  return view === "all" ? APP_PATHS.dashboard : `${APP_PATHS.dashboard}/${view}`;
}

export function folderPath(folderId: string): string {
  return `${APP_PATHS.dashboard}/folder/${encodeURIComponent(folderId)}`;
}

export function authPath(redirectTo?: string): string {
  if (!redirectTo) return APP_PATHS.auth;
  const search = new URLSearchParams({ redirect: redirectTo });
  return `${APP_PATHS.auth}?${search.toString()}`;
}

export function dashboardRouteRedirect(tab?: string, folderId?: string): string | null {
  if (tab === "all") return dashboardPath();
  if (tab && !isDashboardView(tab)) return APP_PATHS.notFound;
  if (folderId && !isFolderId(folderId)) return APP_PATHS.notFound;
  return null;
}

export function sanitiseRedirect(raw: string | null, origin?: string): string | null {
  if (!raw) return null;

  const currentOrigin = origin ?? (typeof window !== "undefined" ? window.location.origin : null);
  if (!currentOrigin) return null;

  try {
    const url = new URL(raw, currentOrigin);
    if (url.origin !== currentOrigin) return null;

    const allowed = AUTH_REDIRECT_ALLOWLIST.some(
      (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
    );

    return allowed ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}
