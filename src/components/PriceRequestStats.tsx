import { Card, CardContent } from "@/components/ui/card";
import { FileText, Clock, Check, X } from "lucide-react";

interface PriceRequestStatsProps {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export function PriceRequestStats({ total, pending, approved, rejected }: PriceRequestStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="bg-white/80 dark:bg-card/80 backdrop-blur-sm border-0 shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
            <FileText className="h-6 w-6 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/80 dark:bg-card/80 backdrop-blur-sm border-0 shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{pending}</p>
            </div>
            <Clock className="h-6 w-6 text-yellow-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/80 dark:bg-card/80 backdrop-blur-sm border-0 shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Aprovadas</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{approved}</p>
            </div>
            <Check className="h-6 w-6 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/80 dark:bg-card/80 backdrop-blur-sm border-0 shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Rejeitadas</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{rejected}</p>
            </div>
            <X className="h-6 w-6 text-red-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
