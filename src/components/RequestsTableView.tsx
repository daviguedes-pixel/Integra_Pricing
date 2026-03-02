import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Eye, Edit, Trash2, ArrowUpDown, Clock, Check, X, DollarSign, AlertCircle, FileText, GitBranch, MessageSquare, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatPrice, formatDate, getProductName, formatPrice4Decimals } from '@/lib/pricing-utils';
import { formatNameFromEmail, parseBrazilianDecimal } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { EnrichedPriceRequest, ProposalItem } from '@/types';
import { ActionDialog, ActionField } from './ActionDialog';

interface RequestsTableViewProps {
    requests: ProposalItem[];
    onDelete: (id: string) => void;
    onEdit?: (request: EnrichedPriceRequest) => void;
    onView: (request: EnrichedPriceRequest) => void;
    onProvideJustification?: (suggestionId: string, observations: string) => Promise<void>;
    onProvideEvidence?: (suggestionId: string, observations: string, attachmentUrl?: string) => Promise<void>;
    onAcceptSuggestion?: (suggestionId: string) => Promise<void>;
    onAppeal?: (suggestionId: string, observations: string, newPrice: number) => Promise<void>;
}

type SortKey = 'id' | 'station' | 'client' | 'product' | 'cost' | 'price' | 'margin' | 'date' | 'status' | 'approver';
type SortDir = 'asc' | 'desc';

/** Statuses that BLOCK edit/delete */
const LOCKED_STATUSES = ['approved', 'rejected', 'price_suggested', 'awaiting_justification', 'awaiting_evidence', 'cancelled'];

function isEditable(status: string): boolean {
    return !LOCKED_STATUSES.includes(status);
}

function flattenRequests(items: ProposalItem[]): EnrichedPriceRequest[] {
    const result: EnrichedPriceRequest[] = [];
    for (const item of items) {
        if ('type' in item && item.type === 'batch') {
            result.push(...item.requests);
        } else {
            result.push(item as EnrichedPriceRequest);
        }
    }
    return result;
}

export function RequestsTableView({
    requests,
    onDelete,
    onEdit,
    onView,
    onProvideJustification,
    onProvideEvidence,
    onAcceptSuggestion,
    onAppeal
}: RequestsTableViewProps) {
    const navigate = useNavigate();
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogConfig, setDialogConfig] = useState<{
        title: string;
        description?: string;
        fields: ActionField[];
        onConfirm: (data: any) => Promise<void>;
    }>({
        title: '',
        fields: [],
        onConfirm: async () => { }
    });

    const openDialog = (
        title: string,
        description: string | undefined,
        fields: ActionField[],
        onConfirm: (data: any) => Promise<void>
    ) => {
        setDialogConfig({ title, description, fields, onConfirm });
        setDialogOpen(true);
    };

    const flat = useMemo(() => {
        if (!requests) return [];
        return flattenRequests(requests);
    }, [requests]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const getSortValue = (a: EnrichedPriceRequest, key: SortKey): string | number => {
        switch (key) {
            case 'id': return a.id;
            case 'station': return a.stations?.name || '';
            case 'client': return a.clients?.name || '';
            case 'product': return a.product || '';
            case 'cost': return a.cost_price ?? 0;
            case 'price': return a.suggested_price ?? 0;
            case 'margin': return a.margin_cents ?? 0;
            case 'date': return a.created_at || '';
            case 'status': return a.status || '';
            case 'approver': return a.current_approver_name || '';
            default: return '';
        }
    };

    const sorted = useMemo(() => [...flat].sort((a, b) => {
        const va = getSortValue(a, sortKey);
        const vb = getSortValue(b, sortKey);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
    }), [flat, sortKey, sortDir]);

    const SortableHead = ({ label, sortId }: { label: string; sortId: SortKey }) => (
        <TableHead
            className="cursor-pointer select-none whitespace-nowrap text-xs font-semibold hover:bg-muted/50 transition-colors"
            onClick={() => toggleSort(sortId)}
        >
            <span className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`h-3 w-3 ${sortKey === sortId ? 'text-primary' : 'text-muted-foreground/50'}`} />
            </span>
        </TableHead>
    );

    const fmtPrice = (value: number | null | undefined) => {
        if (value === null || value === undefined) return '—';
        return formatPrice4Decimals(value);
    };

    const fmtMargin = (cents: number | null | undefined) => {
        if (cents === null || cents === undefined) return '—';
        const val = cents / 100;
        const color = val >= 0 ? 'text-green-600' : 'text-red-600';
        return <span className={color}>{val.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 4,
            maximumFractionDigits: 4
        })}</span>;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-[11px]"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
            case 'approved':
                return <Badge className="bg-green-100 text-green-800 border-green-300 text-[11px]"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>;
            case 'rejected':
                return <Badge variant="destructive" className="text-[11px]"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>;
            case 'price_suggested':
                return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-[11px]"><DollarSign className="h-3 w-3 mr-1" />Sugerido</Badge>;
            case 'awaiting_justification':
                return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 text-[11px]"><AlertCircle className="h-3 w-3 mr-1" />Justificar</Badge>;
            case 'awaiting_evidence':
                return <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 text-[11px]"><FileText className="h-3 w-3 mr-1" />Referência</Badge>;
            case 'appealed':
                return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300 text-[11px]"><GitBranch className="h-3 w-3 mr-1" />Recurso</Badge>;
            case 'draft':
                return <Badge variant="outline" className="text-[11px]">Rascunho</Badge>;
            default:
                return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
        }
    };

    return (
        <div className="rounded-lg border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                            <SortableHead label="ID" sortId="id" />
                            <SortableHead label="Posto" sortId="station" />
                            <SortableHead label="Cliente" sortId="client" />
                            <SortableHead label="Produto" sortId="product" />
                            <SortableHead label="Custo" sortId="cost" />
                            <SortableHead label="Preço Sug." sortId="price" />
                            <SortableHead label="Margem" sortId="margin" />
                            <SortableHead label="Data" sortId="date" />
                            <SortableHead label="Aprovador" sortId="approver" />
                            <SortableHead label="Status" sortId="status" />
                            <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sorted.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                    Nenhuma solicitação encontrada
                                </TableCell>
                            </TableRow>
                        ) : (
                            sorted.map((item) => {
                                const stationName = item.stations_list && item.stations_list.length > 0
                                    ? item.stations_list.map(s => s.name).join(', ')
                                    : (item.stations?.name || item.station_id || '—');
                                const clientName = item.clients?.name || '—';
                                const productName = getProductName(item.product || '');
                                const costPrice = item.cost_price;
                                const originalSuggestedPrice = item.suggested_price;
                                const marginCents = item.margin_cents;

                                // Enhanced fallback logic for suggested price
                                const suggestedPrice = originalSuggestedPrice ?? item.final_price ?? (costPrice && marginCents ? costPrice + (marginCents / 100) : null);

                                const shortId = item.id.substring(0, 8);
                                const canEdit = isEditable(item.status);
                                const canRespond = ['price_suggested', 'awaiting_justification', 'awaiting_evidence'].includes(item.status);

                                return (
                                    <TableRow
                                        key={item.id}
                                        className="text-xs hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                                        onClick={() => onView(item)}
                                    >
                                        <TableCell className="font-mono text-[11px] text-muted-foreground py-2 px-3">
                                            {shortId}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 max-w-[160px] truncate font-medium" title={stationName}>
                                            {stationName}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 max-w-[140px] truncate" title={clientName}>
                                            {clientName}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap">
                                            {productName}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap font-mono text-right">
                                            {fmtPrice(costPrice)}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap font-mono text-right font-semibold">
                                            {fmtPrice(suggestedPrice)}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap font-mono text-right">
                                            {fmtMargin(marginCents)}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap text-muted-foreground">
                                            {item.created_at ? formatDate(item.created_at) : '—'}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap text-muted-foreground" title={item.current_approver_name || undefined}>
                                            {item.current_approver_name
                                                ? formatNameFromEmail(item.current_approver_name)
                                                : '—'}
                                        </TableCell>
                                        <TableCell className="py-2 px-3">
                                            {getStatusBadge(item.status)}
                                        </TableCell>
                                        <TableCell className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-1 justify-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                                                    title="Ver detalhes"
                                                    onClick={() => onView(item)}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>

                                                {/* Requester Actions */}
                                                {item.status === 'price_suggested' && (
                                                    <>
                                                        {onAcceptSuggestion && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-green-600"
                                                                title="Aceitar Sugestão"
                                                                onClick={async (e) => {
                                                                    // Buscar última nota do aprovador
                                                                    let note = "";
                                                                    try {
                                                                        const { data: history } = await supabase
                                                                            .from('approval_history')
                                                                            .select('observations')
                                                                            .eq('suggestion_id', item.id)
                                                                            .eq('action', 'price_suggested')
                                                                            .order('created_at', { ascending: false })
                                                                            .limit(1);
                                                                        if (history && history.length > 0) note = history[0].observations || "";
                                                                    } catch (err) {
                                                                        console.error("Erro ao buscar histórico:", err);
                                                                    }

                                                                    openDialog(
                                                                        "Aceitar Sugestão",
                                                                        "Tem certeza que deseja aceitar o preço sugerido?",
                                                                        [
                                                                            ...(note ? [{ id: 'note', label: 'Nota do Aprovador', type: 'info' as const, defaultValue: note }] : [])
                                                                        ],
                                                                        async () => await onAcceptSuggestion(item.id)
                                                                    );
                                                                }}
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        {onAppeal && !(item as any).has_appealed && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-orange-600"
                                                                title="Recorrer"
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();

                                                                    // Buscar nota do aprovador (preço sugerido ou rejeitado)
                                                                    let note = "";
                                                                    try {
                                                                        const { data: history } = await supabase
                                                                            .from('approval_history')
                                                                            .select('observations')
                                                                            .eq('suggestion_id', item.id)
                                                                            .or('action.eq.price_suggested,action.eq.rejected')
                                                                            .order('created_at', { ascending: false })
                                                                            .limit(1);
                                                                        if (history && history.length > 0) note = history[0].observations || "";
                                                                    } catch (err) {
                                                                        console.error("Erro ao buscar histórico:", err);
                                                                    }

                                                                    openDialog(
                                                                        "Recorrer da Sugestão",
                                                                        "Informe o preço desejado e o motivo do recurso.",
                                                                        [
                                                                            ...(note ? [{ id: 'note', label: 'Nota do Aprovador', type: 'info' as const, defaultValue: note }] : []),
                                                                            { id: 'price', label: 'Preço (R$)', type: 'currency' as const, placeholder: '0,00', required: true },
                                                                            { id: 'obs', label: 'Motivo', type: 'textarea' as const, placeholder: 'Descreva o motivo...', required: true }
                                                                        ],
                                                                        async (data) => {
                                                                            const price = typeof data.price === 'string' ? parseBrazilianDecimal(data.price) : data.price;
                                                                            if (isNaN(price) || price <= 0) throw new Error("Preço inválido");
                                                                            await onAppeal(item.id, data.obs, price);
                                                                        }
                                                                    );
                                                                }}
                                                            >
                                                                <GitBranch className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </>
                                                )}

                                                {item.status === 'awaiting_justification' && onProvideJustification && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                                                        title="Enviar Justificativa"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();

                                                            // Buscar nota do aprovador
                                                            let note = "";
                                                            try {
                                                                const { data: history } = await supabase
                                                                    .from('approval_history')
                                                                    .select('observations')
                                                                    .eq('suggestion_id', item.id)
                                                                    .eq('action', 'request_justification')
                                                                    .order('created_at', { ascending: false })
                                                                    .limit(1);
                                                                if (history && history.length > 0) note = history[0].observations || "";
                                                            } catch (err) {
                                                                console.error("Erro ao buscar histórico:", err);
                                                            }

                                                            openDialog(
                                                                "Justificar",
                                                                "Informe a justificativa para esta solicitação.",
                                                                [
                                                                    ...(note ? [{ id: 'note', label: 'Nota do Aprovador', type: 'info' as const, defaultValue: note }] : []),
                                                                    { id: 'obs', label: 'Justificativa', type: 'textarea' as const, placeholder: 'Digite sua justificativa...', required: true }
                                                                ],
                                                                async (data) => await onProvideJustification(item.id, data.obs)
                                                            );
                                                        }}
                                                    >
                                                        <MessageSquare className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}

                                                {item.status === 'awaiting_evidence' && onProvideEvidence && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-slate-500 hover:text-purple-600"
                                                        title="Enviar Evidência"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();

                                                            // Buscar última nota do aprovador
                                                            let note = "";
                                                            try {
                                                                const { data: history } = await supabase
                                                                    .from('approval_history')
                                                                    .select('observations')
                                                                    .eq('suggestion_id', item.id)
                                                                    .eq('action', 'request_evidence')
                                                                    .order('created_at', { ascending: false })
                                                                    .limit(1);
                                                                if (history && history.length > 0) note = history[0].observations || "";
                                                            } catch (err) {
                                                                console.error("Erro ao buscar histórico:", err);
                                                            }

                                                            openDialog(
                                                                "Enviar Evidência",
                                                                "Anexe um arquivo com a evidência solicitada.",
                                                                [
                                                                    ...(note ? [{ id: 'note', label: 'Nota do Aprovador', type: 'info' as const, defaultValue: note }] : []),
                                                                    { id: 'file', label: 'Arquivo de Evidência', type: 'file' as const, required: true }
                                                                ],
                                                                async (data) => {
                                                                    if (!data.file) {
                                                                        toast.error("Por favor, anexe o arquivo de evidência");
                                                                        throw new Error("Validation failed");
                                                                    }

                                                                    let fileUrl = "";
                                                                    if (data.file instanceof File) {
                                                                        const file = data.file;
                                                                        const fileExt = file.name.split('.').pop();
                                                                        const fileName = `${item.id}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                                                                        const filePath = `evidence/${fileName}`;

                                                                        const { error: uploadError } = await supabase.storage
                                                                            .from('financial-documents')
                                                                            .upload(filePath, file);

                                                                        if (uploadError) throw uploadError;

                                                                        const { data: { publicUrl } } = supabase.storage
                                                                            .from('financial-documents')
                                                                            .getPublicUrl(filePath);

                                                                        fileUrl = publicUrl;
                                                                    }

                                                                    await onProvideEvidence(item.id, "Evidência enviada via arquivo.", fileUrl);
                                                                }
                                                            );
                                                        }}
                                                    >
                                                        <Paperclip className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}

                                                {canEdit && (
                                                    <>
                                                        {onEdit && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-amber-600"
                                                                title="Editar"
                                                                onClick={() => onEdit(item)}
                                                            >
                                                                <Edit className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-slate-500 hover:text-red-600"
                                                            title="Excluir"
                                                            onClick={() => onDelete(item.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                                {canRespond && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-50"
                                                        title="Responder"
                                                        onClick={() => onView(item)}
                                                    >
                                                        <Clock className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="px-4 py-2 border-t bg-slate-50 dark:bg-slate-800/30 text-xs text-muted-foreground">
                {sorted.length} registro(s)
            </div>
            <ActionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                title={dialogConfig.title}
                description={dialogConfig.description}
                fields={dialogConfig.fields}
                onConfirm={dialogConfig.onConfirm}
            />
        </div>
    );
}
