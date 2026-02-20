import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Check, X, Eye, ArrowUpDown, GitBranch, MessageSquare, Paperclip, DollarSign, MessageSquarePlus, FileQuestion } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatPrice, formatDate, getStatusBadge, getProductName, centsToReais, formatPrice4Decimals } from '@/lib/pricing-utils';
import { formatNameFromEmail, parseBrazilianDecimal } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ActionDialog, ActionField } from './ActionDialog';
import type { EnrichedApproval } from '@/types';

interface ApprovalsTableViewProps {
    approvals: EnrichedApproval[];
    onApprove: (approval: EnrichedApproval, observation?: string) => Promise<void>;
    onReject: (approval: EnrichedApproval, observation: string) => Promise<void>;
    onSuggestPrice?: (suggestionId: string, observations: string, suggestedPrice: number) => Promise<void>;
    onRequestJustification?: (suggestionId: string, observations: string) => Promise<void>;
    onRequestEvidence?: (suggestionId: string, observations: string, product?: 'principal' | 'arla') => Promise<void>;
    selectedIds?: string[];
    onSelectionChange?: (ids: string[]) => void;
    onProvideJustification?: (suggestionId: string, observations: string) => Promise<void>;
    onProvideEvidence?: (suggestionId: string, observations: string, attachmentUrl?: string) => Promise<void>;
    onAcceptSuggestion?: (suggestionId: string) => Promise<void>;
    onAppeal?: (suggestionId: string, observations: string, newPrice: number) => Promise<void>;
    currentUserId?: string;
}

type SortKey = 'id' | 'station' | 'client' | 'product' | 'cost' | 'price' | 'margin' | 'date' | 'status';
type SortDir = 'asc' | 'desc';

export function ApprovalsTableView({
    approvals,
    onApprove,
    onReject,
    onSuggestPrice,
    onRequestJustification,
    onRequestEvidence,
    selectedIds = [],
    onSelectionChange,
    onProvideJustification,
    onProvideEvidence,
    onAcceptSuggestion,
    onAppeal,
    currentUserId
}: ApprovalsTableViewProps) {
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
        variant?: 'default' | 'destructive';
        confirmLabel?: string;
    }>({
        title: '',
        fields: [],
        onConfirm: async () => { }
    });

    const openDialog = (
        title: string,
        description: string | undefined,
        fields: ActionField[],
        onConfirm: (data: any) => Promise<void>,
        variant: 'default' | 'destructive' = 'default',
        confirmLabel: string = 'Confirmar'
    ) => {
        setDialogConfig({ title, description, fields, onConfirm, variant, confirmLabel });
        setDialogOpen(true);
    };

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const getSortValue = (a: EnrichedApproval, key: SortKey): string | number => {
        switch (key) {
            case 'id': return a.id;
            case 'station': return a.stations?.name || a.stations?.nome_empresa || '';
            case 'client': return a.clients?.name || a.clients?.nome || '';
            case 'product': return a.product || '';
            case 'cost': return a.cost_price ?? 0;
            case 'price': return a.suggested_price ?? 0;
            case 'margin': return a.margin_cents ?? 0;
            case 'date': return a.created_at || '';
            case 'status': return a.status || '';
            default: return '';
        }
    };

    const sorted = useMemo(() => {
        if (!approvals) return [];
        return [...approvals].sort((a, b) => {
            const va = getSortValue(a, sortKey);
            const vb = getSortValue(b, sortKey);
            const cmp = va < vb ? -1 : va > vb ? 1 : 0;
            return sortDir === 'asc' ? cmp : -cmp;
        })
    }, [approvals, sortKey, sortDir]);

    const handleSelectAll = (checked: boolean) => {
        if (!onSelectionChange) return;
        if (checked) {
            onSelectionChange(sorted.map(a => a.id));
        } else {
            onSelectionChange([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (!onSelectionChange) return;
        if (checked) {
            onSelectionChange([...selectedIds, id]);
        } else {
            onSelectionChange(selectedIds.filter(i => i !== id));
        }
    };

    const isAllSelected = sorted.length > 0 && selectedIds.length === sorted.length;
    const isSomeSelected = selectedIds.length > 0 && selectedIds.length < sorted.length;

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
        return <span className={color}>{val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>;
    };

    const isArlaProduct = (product: string) => {
        return product?.includes('arla') || product === 'arla32_granel';
    };

    return (
        <div className="w-full">
            <div>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                            <TableHead className="w-[40px] px-3">
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                    aria-label="Selecionar todos"
                                />
                            </TableHead>
                            <SortableHead label="ID" sortId="id" />
                            <SortableHead label="Posto" sortId="station" />
                            <SortableHead label="Cliente" sortId="client" />
                            <SortableHead label="Produto" sortId="product" />
                            <SortableHead label="Custo" sortId="cost" />
                            <SortableHead label="Preço Sug." sortId="price" />
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Preço Arla</TableHead>
                            <SortableHead label="Lucro Prod." sortId="margin" />
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Lucro Arla</TableHead>
                            <SortableHead label="Data" sortId="date" />
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Aprovador</TableHead>
                            <TableHead className="whitespace-nowrap text-xs font-semibold">Aprovação</TableHead>
                            <SortableHead label="Status" sortId="status" />
                            <TableHead className="whitespace-nowrap text-xs font-semibold text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sorted.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={15} className="text-center py-8 text-muted-foreground">
                                    Nenhuma aprovação encontrada
                                </TableCell>
                            </TableRow>
                        ) : (
                            sorted.map((item) => {
                                const stationName = item.stations?.name || item.stations?.nome_empresa || item.station_id || '—';
                                const clientName = item.clients?.name || item.clients?.nome || '—';
                                const productName = getProductName(item.product || '');
                                const costPrice = item.cost_price;
                                const suggestedPriceValue = item.suggested_price ?? item.final_price ?? (item.cost_price && item.margin_cents ? item.cost_price + (item.margin_cents / 100) : null);
                                const marginCents = item.margin_cents;
                                const arlaPrice = item.arla_purchase_price;
                                const arlaCost = item.arla_cost_price;
                                const arlaMargin = (arlaPrice != null && arlaCost != null) ? (arlaPrice - arlaCost) * 100 : null;
                                const approverName = item.current_approver_name
                                    ? formatNameFromEmail(item.current_approver_name)
                                    : '—';
                                const approvalsCount = item.approvals_count ?? 0;
                                const totalApprovers = item.max_level ?? 3;
                                const isActive = ['pending', 'price_suggested', 'awaiting_justification', 'awaiting_evidence', 'appealed'].includes(item.status) && item.current_approver_id === currentUserId;
                                const shortId = item.id.substring(0, 8);

                                return (
                                    <TableRow
                                        key={item.id}
                                        className={`text-xs hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors ${selectedIds.includes(item.id) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                        onClick={() => navigate(`/approval-details/${item.id}`)}
                                    >
                                        <TableCell className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedIds.includes(item.id)}
                                                onCheckedChange={(checked) => handleSelectOne(item.id, !!checked)}
                                                aria-label={`Selecionar ${item.id}`}
                                            />
                                        </TableCell>
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
                                            {fmtPrice(suggestedPriceValue)}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap font-mono text-right">
                                            {arlaPrice != null ? fmtPrice(arlaPrice) : '—'}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap font-mono text-right">
                                            {fmtMargin(marginCents)}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap font-mono text-right">
                                            {arlaMargin != null ? fmtMargin(Math.round(arlaMargin)) : '—'}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap text-muted-foreground">
                                            {item.created_at ? formatDate(item.created_at) : '—'}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 max-w-[120px] truncate" title={approverName}>
                                            {approverName}
                                        </TableCell>
                                        <TableCell className="py-2 px-3 whitespace-nowrap text-center">
                                            <Badge variant="outline" className="text-[11px] font-mono">
                                                {approvalsCount}/{totalApprovers}
                                            </Badge>
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
                                                    onClick={() => navigate(`/approval-details/${item.id}`)}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </Button>
                                                {isActive && (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-slate-500 hover:text-green-600"
                                                            title="Aprovar"
                                                            onClick={async () => {
                                                                openDialog(
                                                                    "Aprovar Solicitação",
                                                                    "Deseja aprovar esta solicitação?",
                                                                    [
                                                                        ...(item.observations ? [{ id: 'justification', label: 'Justificativa do Solicitante', type: 'info' as const, defaultValue: item.observations }] : []),
                                                                        { id: 'obs', label: 'Observação (obrigatória)', type: 'textarea', placeholder: 'Digite uma observação...', required: true }
                                                                    ],
                                                                    async (data) => await onApprove(item, data.obs),
                                                                    'default',
                                                                    'Aprovar'
                                                                );
                                                            }}
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                        </Button>

                                                        {onSuggestPrice && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                                                                title="Sugerir Preço"
                                                                onClick={async () => {
                                                                    openDialog(
                                                                        "Sugerir Preço",
                                                                        "Informe o novo preço sugerido.",
                                                                        [
                                                                            ...(item.observations ? [{ id: 'justification', label: 'Justificativa do Solicitante', type: 'info' as const, defaultValue: item.observations }] : []),
                                                                            { id: 'price', label: 'Preço (R$)', type: 'currency', placeholder: '0,00', required: true },
                                                                            { id: 'obs', label: 'Observação', type: 'textarea', placeholder: 'Motivo da sugestão...', required: false }
                                                                        ],
                                                                        async (data) => {
                                                                            const price = typeof data.price === 'string' ? parseBrazilianDecimal(data.price) : data.price;
                                                                            if (isNaN(price) || price <= 0) throw new Error("Preço inválido");
                                                                            await onSuggestPrice(item.id, data.obs, price);
                                                                        }
                                                                    );
                                                                }}
                                                            >
                                                                <DollarSign className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}

                                                        {onRequestJustification && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-amber-600"
                                                                title="Pedir Justificativa"
                                                                onClick={async () => {
                                                                    openDialog(
                                                                        "Pedir Justificativa",
                                                                        "Explique o que precisa ser justificado.",
                                                                        [
                                                                            ...(item.observations ? [{ id: 'justification', label: 'Justificativa do Solicitante', type: 'info' as const, defaultValue: item.observations }] : []),
                                                                            { id: 'obs', label: 'Motivo', type: 'textarea', placeholder: 'Digite o motivo...', required: true }
                                                                        ],
                                                                        async (data) => await onRequestJustification(item.id, data.obs)
                                                                    );
                                                                }}
                                                            >
                                                                <MessageSquarePlus className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}

                                                        {onRequestEvidence && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-purple-600"
                                                                title="Pedir Referência"
                                                                onClick={async () => {
                                                                    openDialog(
                                                                        "Pedir Referência",
                                                                        "Explique qual referência de preço é necessária.",
                                                                        [
                                                                            ...(item.observations ? [{ id: 'justification', label: 'Justificativa do Solicitante', type: 'info' as const, defaultValue: item.observations }] : []),
                                                                            {
                                                                                id: 'product',
                                                                                label: 'Produto',
                                                                                type: 'radio',
                                                                                options: [
                                                                                    { label: 'Produto Principal', value: 'principal' },
                                                                                    { label: 'Arla 32', value: 'arla' }
                                                                                ],
                                                                                defaultValue: 'principal',
                                                                                required: true
                                                                            },
                                                                            { id: 'obs', label: 'Observação', type: 'textarea', placeholder: 'Digite a observação...', required: true }
                                                                        ],
                                                                        async (data) => await onRequestEvidence(item.id, data.obs, data.product)
                                                                    );
                                                                }}
                                                            >
                                                                <FileQuestion className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}

                                                        {/* Requester Actions */}
                                                        {currentUserId && (item.created_by === currentUserId || item.requested_by === currentUserId) && (
                                                            <>
                                                                {item.status === 'price_suggested' && (
                                                                    <>
                                                                        {onAcceptSuggestion && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-7 w-7 p-0 text-slate-500 hover:text-green-600"
                                                                                title="Aceitar Sugestão"
                                                                                onClick={async (e) => {
                                                                                    e.stopPropagation();

                                                                                    // Buscar nota do aprovador
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

                                                                                    // Buscar nota do aprovador
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
                                                            </>
                                                        )}

                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 w-7 p-0 text-slate-500 hover:text-red-600"
                                                            title="Rejeitar"
                                                            onClick={async () => {
                                                                openDialog(
                                                                    "Rejeitar Solicitação",
                                                                    "Tem certeza que deseja rejeitar esta solicitação?",
                                                                    [
                                                                        ...(item.observations ? [{ id: 'justification', label: 'Justificativa do Solicitante', type: 'info' as const, defaultValue: item.observations }] : []),
                                                                        { id: 'obs', label: 'Motivo da rejeição', type: 'textarea', placeholder: 'Digite o motivo...', required: true }
                                                                    ],
                                                                    async (data) => await onReject(item, data.obs),
                                                                    'destructive',
                                                                    'Rejeitar'
                                                                );
                                                            }}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
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
                variant={dialogConfig.variant}
                confirmLabel={dialogConfig.confirmLabel}
            />
        </div>
    );
}
