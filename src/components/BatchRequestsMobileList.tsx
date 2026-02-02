import { Button } from "@/components/ui/button";
import { Trash2, Eye, Check, X } from "lucide-react";

interface BatchRequestsMobileListProps {
  batch: any;
  loading: boolean;
  permissions: any;
  formatPrice: (price: number) => string;
  getProductName: (product: string) => string;
  getStatusBadge: (status: string) => React.ReactNode;
  onViewDetails: (req: any) => void;
  onOpenObservationModal: (reqId: string, action: 'approve' | 'reject') => void;
  onDelete: (reqId: string) => void;
}

export function BatchRequestsMobileList({
  batch,
  loading,
  permissions,
  formatPrice,
  getProductName,
  getStatusBadge,
  onViewDetails,
  onOpenObservationModal,
  onDelete,
}: BatchRequestsMobileListProps) {
  return (
    <div className="block sm:hidden space-y-3 p-3">
      {batch.requests.slice(0, 20).map((req: any, index: number) => {
        const currentPrice = req.current_price || req.cost_price || 0;
        const currentPriceReais = currentPrice >= 100 ? currentPrice / 100 : currentPrice;
        const finalPrice = req.final_price || req.suggested_price || 0;
        const finalPriceReais = finalPrice >= 100 ? finalPrice / 100 : finalPrice;
        const costPrice = req.cost_price || req.cost || 0;
        const costPriceReais = costPrice >= 100 ? costPrice / 100 : costPrice;
        const margin = finalPriceReais - costPriceReais;
        const station = req.stations || { name: req.station_id || 'N/A', code: '' };

        return (
          <div
            key={`mobile-${batch.id}-${req.id}-${index}`}
            className="bg-white dark:bg-card rounded-lg border border-slate-200 dark:border-border p-3 space-y-2"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{station.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{req.clients?.name || batch.client?.name || 'N/A'}</p>
              </div>
              {getStatusBadge(req.status)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Produto:</span>
                <p className="font-medium text-slate-700 dark:text-slate-300">{getProductName(req.product)}</p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Preço Atual:</span>
                <p className="font-medium text-slate-700 dark:text-slate-300">{currentPriceReais > 0 ? formatPrice(currentPriceReais) : '-'}</p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Preço Sugerido:</span>
                <p className="font-medium text-green-600 dark:text-green-400">{finalPriceReais > 0 ? formatPrice(finalPriceReais) : '-'}</p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Margem:</span>
                <p className="font-medium text-slate-700 dark:text-slate-300">{costPriceReais > 0 ? formatPrice(margin) : '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails(req)}
                className="h-7 w-7 p-0 flex-shrink-0"
                title="Ver detalhes"
              >
                <Eye className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenObservationModal(req.id, 'approve')}
                className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50 text-xs flex-1"
                disabled={loading}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Aprovar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenObservationModal(req.id, 'reject')}
                className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs flex-1"
                disabled={loading}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Rejeitar
              </Button>
              {(permissions?.permissions?.can_approve || permissions?.permissions?.admin) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(req.id)}
                  className="h-7 w-7 px-0 sm:px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                  title="Excluir"
                  disabled={loading}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
