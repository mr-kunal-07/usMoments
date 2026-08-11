import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { SessionProviders } from "@/app/providers/SessionProviders";
import { APP_PATHS, dashboardPath } from "@/app/router/paths";
import { AdminOnlyRoute, DashboardRoute, ProtectedRoute, PublicOnlyRoute } from "@/app/router/RouteGuards";
import { RouteLoading } from "@/app/router/RouteLoading";

const AdminPage = lazy(() => import("@/features/admin/pages/AdminPage"));
const AuthPage = lazy(() => import("@/features/auth/pages/AuthPage"));
const AuthCallbackPage = lazy(() => import("@/features/auth/pages/AuthCallbackPage"));
const ResetPasswordPage = lazy(() => import("@/features/auth/pages/ResetPasswordPage"));
const PaymentReturnPage = lazy(() => import("@/features/billing/pages/PaymentReturnPage"));
const InviteExpiredPage = lazy(() => import("@/features/couples/pages/InviteExpiredPage"));
const JoinPage = lazy(() => import("@/features/couples/pages/JoinPage"));
const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage"));
const NotFoundPage = lazy(() => import("@/features/errors/pages/NotFoundPage"));
const ProfilePage = lazy(() => import("@/features/profile/pages/ProfilePage"));

export function AppRouter() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <SessionProviders>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route index element={<AuthPage />} />
              <Route path={APP_PATHS.auth} element={<AuthPage />} />
            </Route>

            <Route path={APP_PATHS.authCallback} element={<AuthCallbackPage />} />
            <Route path={APP_PATHS.resetPassword} element={<ResetPasswordPage />} />
            <Route path={APP_PATHS.join} element={<JoinPage />} />
            <Route path={APP_PATHS.inviteExpired} element={<InviteExpiredPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path={APP_PATHS.dashboard} element={<DashboardPage />} />
              <Route
                path={`${APP_PATHS.dashboard}/:tab`}
                element={<DashboardRoute><DashboardPage /></DashboardRoute>}
              />
              <Route
                path={`${APP_PATHS.dashboard}/folder/:folderId`}
                element={<DashboardRoute><DashboardPage /></DashboardRoute>}
              />

              <Route path={APP_PATHS.profile} element={<ProfilePage />} />
              <Route path={APP_PATHS.paymentReturn} element={<PaymentReturnPage />} />
              <Route
                path={APP_PATHS.legacyTravelMap}
                element={<Navigate to={dashboardPath("travel-map")} replace />}
              />

              <Route element={<AdminOnlyRoute />}>
                <Route path={APP_PATHS.admin} element={<AdminPage />} />
              </Route>
            </Route>

            <Route path={APP_PATHS.notFound} element={<NotFoundPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </SessionProviders>
    </BrowserRouter>
  );
}
