
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, FileText, Send, Save, AlertCircle } from "lucide-react";
import { formatPrice, getProductName } from "@/lib/pricing-utils";
import type { AddedCard } from "@/types";

interface CommercialProposalSidebarProps {
    items: AddedCard[];
    onRemoveItem: (id: string) => void;
    onSendProposal: () => void;
    onSaveDraft: () => void;
    loading?: boolean;
}

export function CommercialProposalSidebar({
    items,
    onRemoveItem,
    onSendProposal,
    onSaveDraft,
    loading = false
}: CommercialProposalSidebarProps) {
    // Calculate totals
    const totalVolume = items.reduce((acc, item) => acc + (parseFloat(String(item.volume).replace(',', '.')) || 0), 0);
    const totalValue = items.reduce((acc, item) => acc + ((parseFloat(String(item.volume).replace(',', '.')) || 0) * 1000 * (item.suggestedPrice || 0)), 0);

    return (
        <Card className="shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-card h-full flex flex-col">
            <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4">
                <div className="flex items-center gap-2">
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-md p-1.5 text-slate-500 dark:text-slate-400">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wide">
                            Proposta Comercial
                        </CardTitle>
                        <p className="text-[10px] text-slate-500 font-medium">
                            {items.length} {items.length === 1 ? 'item' : 'itens'} adicionado(s)
                        </p>
                    </div>
                </div>
            </CardHeader>

            <div className="flex-1 overflow-auto p-0">
                {items.length > 0 ? (
                    <div className="relative">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                                <TableRow className="hover:bg-transparent border-b-2 border-slate-200 dark:border-slate-700">
                                    <TableHead className="h-9 text-[10px] font-bold text-slate-600 uppercase w-[35%] pl-4">Posto</TableHead>
                                    <TableHead className="h-9 text-[10px] font-bold text-slate-600 uppercase w-[30%]">Cliente</TableHead>
                                    <TableHead className="h-9 text-[10px] font-bold text-slate-600 uppercase text-right w-[25%]">Preço Un.</TableHead>
                                    <TableHead className="h-9 w-[10%]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, index) => (
                                    <TableRow key={item.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                                        <TableCell className="py-2.5 pl-4 align-middle">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                                                    {item.stationName}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                                                    {getProductName(item.product)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2.5 align-middle">
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                                {item.clientName || 'N/A'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-2.5 text-right align-middle">
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                                    {formatPrice(item.suggestedPrice || 0)}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                                                    Vol: {item.volume}m³
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2.5 text-center align-middle">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onRemoveItem(item.id)}
                                                className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-48 sm:h-64 px-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                            <AlertCircle className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                            Nenhum item adicionado
                        </p>
                        <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
                            Preencha o formulário e clique em "+ Adicionar" para montar a proposta.
                        </p>
                    </div>
                )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3 mt-auto">
                <div className="flex justify-between items-center text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>Volume Total:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-bold">{totalVolume.toFixed(2)} m³</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                        variant="outline"
                        onClick={onSaveDraft}
                        disabled={items.length === 0 || loading}
                        className="w-full text-xs font-semibold h-9 border-slate-300 dark:border-slate-700 hover:bg-slate-100 transition-all"
                    >
                        <Save className="h-3.5 w-3.5 mr-2" />
                        Rascunho
                    </Button>
                    <Button
                        onClick={onSendProposal}
                        disabled={items.length === 0 || loading}
                        className="w-full text-xs font-bold h-9 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-sm transition-all"
                    >
                        <Send className="h-3.5 w-3.5 mr-2" />
                        Enviar
                    </Button>
                </div>
            </div>
        </Card>
    );
}
