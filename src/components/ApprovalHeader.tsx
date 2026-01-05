import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ApprovalHeaderProps {
  realtimeStatus: 'connected' | 'disconnected' | 'connecting';
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * Componente de cabeçalho para a página de aprovações
 */
export function ApprovalHeader({ realtimeStatus, isRefreshing, onRefresh }: ApprovalHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-3 sm:p-4 text-white shadow-xl">
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            variant="secondary"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm h-8 text-xs sm:text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Voltar ao Dashboard</span>
            <span className="sm:hidden">Voltar</span>
          </Button>
          <div className="flex-1 sm:flex-none">
            <h1 className="text-lg sm:text-xl font-bold mb-0.5 sm:mb-1">Aprovações de Preços</h1>
            <p className="text-slate-200 text-xs sm:text-sm hidden sm:block">Gerencie e aprove as solicitações de alteração de preços</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* O status de real-time e botão de refresh agora são automáticos e invisíveis para o usuário */}
        </div>
      </div>
    </div>
  );
}

