import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BatchApproveDialog({
  batch,
  open,
  onOpenChange,
  observation,
  onObservationChange,
  onApprove,
  loading,
}: {
  batch: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  observation: string;
  onObservationChange: (value: string) => void;
  onApprove: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <Dialog key={`batch-approve-${batch.batchKey}`} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Aprovar Lote Completo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold mb-2 block">
              {batch.hasMultipleClients ? (
                <>Clientes: {batch.clients?.map((c: any) => c?.name || "N/A").join(", ") || "Múltiplos"}</>
              ) : (
                <>Cliente: {batch.client?.name || "N/A"}</>
              )}
            </Label>
            <p className="text-xs text-slate-500 mb-4">
              {(batch.allRequests || batch.requests).filter((r: any) => r.status === "pending").length} solicitação(ões)
              pendente(s) serão aprovadas com a mesma observação
            </p>
          </div>
          <div>
            <Label htmlFor={`batch-obs-${batch.batchKey}`} className="text-xs">
              Observação para todo o lote:
            </Label>
            <Textarea
              id={`batch-obs-${batch.batchKey}`}
              placeholder="Digite uma observação que será aplicada a todas as solicitações do lote..."
              value={observation}
              onChange={(e) => onObservationChange(e.target.value)}
              className="min-h-[120px] mt-2"
              rows={5}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <Button
              onClick={onApprove}
              className="flex-1 w-full sm:w-auto text-xs sm:text-sm"
              disabled={loading || !observation.trim()}
            >
              Aprovar Lote
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none w-full sm:w-auto text-xs sm:text-sm"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
