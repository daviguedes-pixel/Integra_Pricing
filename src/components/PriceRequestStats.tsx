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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Total</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{total}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-slate-600 to-slate-700 flex items-center justify-center">
              <FileText className="h-5 w-5" style={{ color: '#94a3b8' }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Pendentes</p>
              <p className="text-lg font-bold text-yellow-600">{pending}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 flex items-center justify-center">
              <Clock className="h-5 w-5" style={{ color: '#94a3b8' }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Aprovadas</p>
              <p className="text-lg font-bold text-green-600">{approved}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center">
              <Check className="h-5 w-5" style={{ color: '#94a3b8' }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg hover:shadow-xl transition-all duration-300">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Rejeitadas</p>
              <p className="text-lg font-bold text-red-600">{rejected}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center">
              <X className="h-5 w-5" style={{ color: '#94a3b8' }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
