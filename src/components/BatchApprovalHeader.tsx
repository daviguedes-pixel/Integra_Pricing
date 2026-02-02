import { Button } from "@/components/ui/button";
import { formatNameFromEmail } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight } from "lucide-react";

interface BatchApprovalHeaderProps {
  batch: any;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onApproveLot: () => void;
  loading: boolean;
}

export function BatchApprovalHeader({ batch, isExpanded, onToggleExpanded, onApproveLot, loading }: BatchApprovalHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4 bg-muted/50">
      <div
        className="flex items-center gap-2 sm:gap-3 flex-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-secondary transition-colors rounded-lg p-2 -m-2 w-full sm:w-auto"
        onClick={onToggleExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
            {batch.hasMultipleClients ? (
              <>Clientes: {batch.clients?.map((c: any) => c?.name || 'N/A').join(', ') || 'Múltiplos'}</>
            ) : (
              <>Cliente: {batch.client?.name || 'N/A'}</>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
            <span className="block sm:inline">Data: {new Date(batch.created_at).toLocaleDateString('pt-BR')}</span>
            <span className="hidden sm:inline"> | </span>
            <span className="block sm:inline">{batch.requests.length} solicitação(ões)</span>
            {batch.requests[0]?.requester && (
              <>
                <span className="hidden sm:inline"> | </span>
                <span className="block sm:inline text-xs text-slate-500 dark:text-slate-400">
                  Enviado por: {formatNameFromEmail(batch.requests[0].requester.name || batch.requests[0].requester.email || 'N/A')}
                </span>
              </>
            )}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onApproveLot}
        disabled={loading}
        className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-300 w-full sm:w-auto text-xs sm:text-sm"
      >
        <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
        <span className="hidden sm:inline">Aprovar Lote</span>
        <span className="sm:hidden">Aprovar</span>
      </Button>
    </div>
  );
}
