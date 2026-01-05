
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";

interface AppRouteProps {
    children: React.ReactNode;
    permission: string;
}

export function AppRoute({ children, permission }: AppRouteProps) {
    const { canAccess, loading } = usePermissions();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!canAccess(permission)) {
        console.log(`🚫 Acesso negado para a permissão: ${permission}`);
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}
