import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Search } from "lucide-react";

type FiltersState = {
  status: string;
  station: string;
  client: string;
  product: string;
  requester: string;
  search: string;
  startDate: string;
  endDate: string;
  myApprovalsOnly: boolean;
};

type RequesterOption = {
  id: string;
  name: string;
};

interface ApprovalsFiltersCardProps {
  filters: FiltersState;
  requesters: RequesterOption[];
  onFilterChange: (field: keyof FiltersState, value: string | boolean) => void;
  onResetFilters: () => void;
}

export function ApprovalsFiltersCard({ filters, requesters, onFilterChange, onResetFilters }: ApprovalsFiltersCardProps) {
  const showReset = Boolean(filters.startDate || filters.endDate || filters.myApprovalsOnly);

  return (
    <Card className="shadow-lg">
      <CardHeader className="p-3 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-400" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Status
            </label>
            <Select value={filters.status} onValueChange={(value) => onFilterChange("status", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
                <SelectItem value="price_suggested">Preço Sugerido</SelectItem>
                <SelectItem value="awaiting_justification">Aguardando Justificativa</SelectItem>
                <SelectItem value="awaiting_evidence">Aguardando Evidência</SelectItem>
                <SelectItem value="appealed">Recurso Solicitado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              Produto
            </label>
            <Select value={filters.product} onValueChange={(value) => onFilterChange("product", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os produtos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="s10">Diesel S-10</SelectItem>
                <SelectItem value="s10_aditivado">Diesel S-10 Aditivado</SelectItem>
                <SelectItem value="diesel_s500">Diesel S-500</SelectItem>
                <SelectItem value="diesel_s500_aditivado">Diesel S-500 Aditivado</SelectItem>
                <SelectItem value="arla32_granel">Arla 32 Granel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pink-500"></div>
              Solicitante
            </label>
            <Select value={filters.requester} onValueChange={(value) => onFilterChange("requester", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os solicitantes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {requesters.map((req) => (
                  <SelectItem key={req.id} value={req.id}>
                    {req.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por posto, cliente..."
                value={filters.search}
                onChange={(e) => onFilterChange("search", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              Data Início
            </label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange("startDate", e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              Data Fim
            </label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange("endDate", e.target.value)}
              className="w-full"
              min={filters.startDate || undefined}
            />
          </div>

          <div className="space-y-2 flex flex-col justify-end">
            <label className="text-sm font-medium flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.myApprovalsOnly}
                onChange={(e) => onFilterChange("myApprovalsOnly", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Apenas minhas aprovações</span>
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">Mostrar apenas aprovações que dependem de mim</p>
          </div>

          {showReset && (
            <div className="space-y-2 flex flex-col justify-end">
              <Button variant="outline" size="sm" onClick={onResetFilters} className="w-full">
                Limpar Filtros
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
