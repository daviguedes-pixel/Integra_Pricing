import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NotificationsProvider } from "@/hooks/useNotifications";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PermissionsProvider } from "@/hooks/usePermissions";
// // import { ErrorBoundary } from "@/components/ErrorBoundary"; // Temporariamente desabilitado para debug // Temporariamente desabilitado para debug
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PriceRequest from "./pages/PriceRequest";
import Approvals from "./pages/Approvals";
import Admin from "./pages/Admin";
import MapView from "./pages/MapView";
import PriceHistory from "./pages/PriceHistory";
import PortfolioManager from "./pages/PortfolioManager";
import ReferenceRegistration from "./pages/ReferenceRegistration";
import RateManagement from "./pages/RateManagement";
import TaxManagement from "./pages/TaxManagement";
import StationManagement from "./pages/StationManagement";
import ClientManagement from "./pages/ClientManagement";
import PasswordChange from "./pages/PasswordChange";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";
import ProfileSettings from "./pages/ProfileSettings";
import Gestao from "./pages/Gestao";
import ApprovalMarginConfig from "./pages/ApprovalMarginConfig";
import ApprovalOrderConfig from "./pages/ApprovalOrderConfig";
import MapaContatos from "./pages/MapaContatos";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 60 * 1000, // 30 minutes (aumentado de 5 minutos)
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false, // Desabilitar refetch ao montar
      retry: false, // Desabilitar retry automático
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  // console.log('ProtectedRoute render', { loading, hasUser: !!user, path: window.location.pathname });

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
  const needsPasswordChange = searchParams.get('change-password') === 'true';

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

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/pricing-suggestion" element={<Navigate to="/solicitacao-preco" replace />} />
              <Route path="/solicitacao-preco" element={<ProtectedRoute><PriceRequest /></ProtectedRoute>} />
              <Route path="/approvals" element={<ProtectedRoute><Approvals /></ProtectedRoute>} />
              <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/price-history" element={<ProtectedRoute><PriceHistory /></ProtectedRoute>} />
              <Route path="/portfolio-manager" element={<ProtectedRoute><PortfolioManager /></ProtectedRoute>} />
              <Route path="/reference-registration" element={<ProtectedRoute><ReferenceRegistration /></ProtectedRoute>} />
              <Route path="/tax-management" element={<ProtectedRoute><TaxManagement /></ProtectedRoute>} />
              <Route path="/station-management" element={<ProtectedRoute><StationManagement /></ProtectedRoute>} />
              <Route path="/client-management" element={<ProtectedRoute><ClientManagement /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute><AuditLogs /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/profile-settings" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />
              <Route path="/gestao" element={<ProtectedRoute><Gestao /></ProtectedRoute>} />
              <Route path="/approval-margin-config" element={<ProtectedRoute><ApprovalMarginConfig /></ProtectedRoute>} />
              <Route path="/approval-order-config" element={<ProtectedRoute><ApprovalOrderConfig /></ProtectedRoute>} />
              <Route path="/mapa-contatos" element={<ProtectedRoute><MapaContatos /></ProtectedRoute>} />
              <Route path="/change-password" element={<PasswordChange />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;