import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { PermissionsProvider } from "@/hooks/usePermissions";
import Layout from "@/components/Layout";
import { AppRoute } from "@/components/AppRoute";

const Login = lazy(() => import("@/pages/Login"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const PriceRequest = lazy(() => import("@/pages/PriceRequest"));
const Approvals = lazy(() => import("@/pages/Approvals"));
const Admin = lazy(() => import("@/pages/Admin"));
const PriceHistory = lazy(() => import("@/pages/PriceHistory"));
const PortfolioManager = lazy(() => import("@/pages/PortfolioManager"));
const CotacoesReferencias = lazy(() => import("@/pages/CotacoesReferencias"));
const TaxManagement = lazy(() => import("@/pages/TaxManagement"));
const StationManagement = lazy(() => import("@/pages/StationManagement"));
const ClientManagement = lazy(() => import("@/pages/ClientManagement"));
const PasswordChange = lazy(() => import("@/pages/PasswordChange"));
const AuditLogs = lazy(() => import("@/pages/AuditLogs"));
const Settings = lazy(() => import("@/pages/Settings"));
const ProfileSettings = lazy(() => import("@/pages/ProfileSettings"));
const Gestao = lazy(() => import("@/pages/Gestao"));
const ApprovalMarginConfig = lazy(() => import("@/pages/ApprovalMarginConfig"));
const ApprovalOrderConfig = lazy(() => import("@/pages/ApprovalOrderConfig"));
const MapaContatos = lazy(() => import("@/pages/MapaContatos"));
const Variations = lazy(() => import("@/pages/Variations"));
const ApprovalDetails = lazy(() => import("@/pages/ApprovalDetails"));
const Quotations = lazy(() => import("@/pages/Quotations"));
const PriceReferences = lazy(() => import("@/pages/PriceReferences"));
const DocumentReview = lazy(() => import("@/pages/Financial/DocumentReview"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user needs to change password
  const searchParams = new URLSearchParams(window.location.search);
  const needsPasswordChange = searchParams.get("change-password") === "true";

  if (needsPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <PermissionsProvider>
      <NotificationsProvider>
        <Layout>{children}</Layout>
      </NotificationsProvider>
    </PermissionsProvider>
  );
}

function DashboardRedirect() {
  const location = useLocation();
  const path = location.pathname;

  // Logic to handle malformed dashboard sub-routes
  if (path.includes('approvals')) {
    return <Navigate to="/approvals" replace />;
  }

  if (path.includes('solicitacao-preco')) {
    // Try to extract ID from the end of the path
    // Example: /dashboard/solicitacao-preco/123 -> 123
    const parts = path.split('/').filter(p => p && p !== 'dashboard' && p !== 'solicitacao-preco');
    const id = parts.length > 0 ? parts[0] : null;

    if (id && id !== '&') {
      return <Navigate to={`/solicitacao-preco/${id}`} replace />;
    }
    return <Navigate to="/solicitacao-preco" replace />;
  }

  // Default fallback to dashboard if no specific match
  return <Navigate to="/dashboard" replace />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Catch-all for dashboard sub-routes to fix malformed navigation */}
        <Route path="/dashboard/*" element={<DashboardRedirect />} />

        <Route path="/pricing-suggestion" element={<Navigate to="/solicitacao-preco" replace />} />
        <Route
          path="/solicitacao-preco"
          element={
            <ProtectedRoute>
              <AppRoute permission="price_request">
                <PriceRequest />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/solicitacao-preco/:id"
          element={
            <ProtectedRoute>
              <AppRoute permission="price_request">
                <PriceRequest />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/approvals"
          element={
            <ProtectedRoute>
              <AppRoute permission="approvals">
                <Approvals />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quotations"
          element={
            <ProtectedRoute>
              <AppRoute permission="quotations">
                <Quotations />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/approval-details/:id"
          element={
            <ProtectedRoute>
              {/* No AppRoute here to allow both Approvers and Requesters to view */}
              <ApprovalDetails />
            </ProtectedRoute>
          }
        />
        {/* /map redirects to /cotacoes-referencias */}
        <Route path="/map" element={<Navigate to="/cotacoes-referencias" replace />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AppRoute permission="admin">
                <Admin />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/price-history"
          element={
            <ProtectedRoute>
              <AppRoute permission="price_history">
                <PriceHistory />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/portfolio-manager"
          element={
            <ProtectedRoute>
              <AppRoute permission="portfolio_manager">
                <PortfolioManager />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        {/* /reference-registration redirects to /cotacoes-referencias */}
        <Route path="/reference-registration" element={<Navigate to="/cotacoes-referencias" replace />} />
        <Route
          path="/cotacoes-referencias"
          element={
            <ProtectedRoute>
              <AppRoute permission="price_request">
                <CotacoesReferencias />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/referencias"
          element={
            <ProtectedRoute>
              <PriceReferences />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tax-management"
          element={
            <ProtectedRoute>
              <AppRoute permission="tax_management">
                <TaxManagement />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/station-management"
          element={
            <ProtectedRoute>
              <AppRoute permission="station_management">
                <StationManagement />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/client-management"
          element={
            <ProtectedRoute>
              <AppRoute permission="client_management">
                <ClientManagement />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute>
              <AppRoute permission="audit_logs">
                <AuditLogs />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AppRoute permission="settings">
                <Settings />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile-settings"
          element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestao"
          element={
            <ProtectedRoute>
              <AppRoute permission="gestao">
                <Gestao />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/approval-margin-config"
          element={
            <ProtectedRoute>
              <AppRoute permission="approval_margin_config">
                <ApprovalMarginConfig />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/approval-order-config"
          element={
            <ProtectedRoute>
              <AppRoute permission="admin">
                <ApprovalOrderConfig />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mapa-contatos"
          element={
            <ProtectedRoute>
              <AppRoute permission="mapa_contatos">
                <MapaContatos />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/variations"
          element={
            <ProtectedRoute>
              <AppRoute permission="variations">
                <Variations />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/financial/review"
          element={
            <ProtectedRoute>
              <AppRoute permission="financial_review">
                <DocumentReview />
              </AppRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/change-password" element={<PasswordChange />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
