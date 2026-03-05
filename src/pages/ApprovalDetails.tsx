import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    CheckCircle,
    XCircle,
    DollarSign,
    TrendingDown,
    Clock,
    MessageSquare,
    Info,
    FileText,
    Paperclip,
    GitBranch,
    HelpCircle,
    FileSearch, // Replaces FileQuestion which might not be in all lucide versions, checking below
    ArrowLeft,
    Loader2,
    TrendingUp, // Added for positive margin
    X,
    Upload,
    RefreshCcw
} from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    approvePriceRequest,
    rejectPriceRequest,
    suggestPriceRequest,
    requestJustification,
    requestEvidence,
    provideJustification,
    provideEvidence,
    appealPriceRequest,
    acceptSuggestedPrice
} from "@/api/priceRequestsApi";
import { parseBrazilianDecimal, formatNameFromEmail, formatCurrency } from "@/lib/utils";
import { formatPrice4Decimals } from "@/lib/pricing-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Internal Components from User Design
const Badge = ({ children, variant = 'neutral' }: { children: React.ReactNode, variant?: 'success' | 'danger' | 'warning' | 'neutral' | 'info' | 'purple' }) => {
    const styles = {
        success: 'bg-green-50 text-green-700 border-green-100',
        danger: 'bg-red-50 text-red-700 border-red-100',
        warning: 'bg-amber-50 text-amber-700 border-amber-100',
        neutral: 'bg-slate-50 text-slate-600 border-slate-200',
        info: 'bg-blue-50 text-blue-700 border-blue-100',
        purple: 'bg-purple-50 text-purple-700 border-purple-100',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[variant] || styles.neutral}`}>
            {children}
        </span>
    );
};

const Card = ({ title, children, className = "" }: { title?: string, children: React.ReactNode, className?: string }) => (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden ${className}`}>
        {title && (
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-tight text-slate-500">{title}</h3>
            </div>
        )}
        <div className="p-4">{children}</div>
    </div>
);

const InfoItem = ({ label, value, highlight = false }: { label: string, value: string | React.ReactNode, highlight?: boolean }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold leading-none">{label}</span>
        <div className={`flex items-center gap-2 ${highlight ? 'text-slate-900' : 'text-slate-700'}`}>
            <span className={`text-sm ${highlight ? 'font-bold' : 'font-semibold'}`}>{value}</span>
        </div>
    </div>
);

export default function ApprovalDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [suggestion, setSuggestion] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [approvalHistory, setApprovalHistory] = useState<any[]>([]);

    // Action states
    const [observation, setObservation] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogConfig, setDialogConfig] = useState<{
        type: 'approve' | 'reject' | 'suggest_price' | 'request_justification' | 'request_evidence' | 'provide_justification' | 'provide_evidence' | 'accept_suggestion' | 'appeal';
        title: string;
        description: string;
        actionLabel: string;
    } | null>(null);
    const [suggestedPriceInput, setSuggestedPriceInput] = useState('');
    const [showEvidenceModal, setShowEvidenceModal] = useState(false);
    const [evidenceTarget, setEvidenceTarget] = useState<'principal' | 'arla'>('principal');
    const [arlaPercent, setArlaPercent] = useState(5);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [approverNote, setApproverNote] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Loads
    useEffect(() => {
        if (id) {
            loadData(id);
        }
    }, [id]);

    const loadData = async (suggestionId: string) => {
        try {
            setLoading(true);

            // 1. Fetch Suggestion (Without Joins to avoid FK errors)
            const { data: suggestionData, error: suggestionError } = await supabase
                .from('price_suggestions')
                .select('*')
                .eq('id', suggestionId)
                .single();

            if (suggestionError) throw suggestionError;

            // 2. Fetch History
            const { data: historyData, error: historyError } = await supabase
                .from('approval_history')
                .select('*')
                .eq('suggestion_id', suggestionId)
                .order('created_at', { ascending: true });

            if (historyError) throw historyError;

            // 3. Manual Fetch for Station and Client (Enrichment)
            let stationName = 'Não identificado';
            let stationLegacyId = ''; // New: Capture legacy ID for payment tax lookup
            let clientName = 'Não identificado';

            // Fetch Station
            // Fetch Station
            if (suggestionData.station_id) {
                const sid = suggestionData.station_id;

                // Prepare candidates for Legacy ID lookup
                // We start with the ID itself. If it's a UUID, we'll try to resolve it to Name/CNPJ first.
                const lookupCandidates = [String(sid)];

                // Check if likely UUID
                const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid);

                if (isUuid) {
                    try {
                        const { data: pubStation } = await supabase
                            .from('sis_empresa')
                            .select('nome, cnpj_cpf') // Public table uses 'nome'
                            .eq('id', sid)
                            .maybeSingle();

                        if (pubStation) {
                            if (pubStation.nome) {
                                lookupCandidates.push(pubStation.nome);
                                // Update display name immediately if we found it
                                stationName = pubStation.nome;
                            }
                            if (pubStation.cnpj_cpf) lookupCandidates.push(pubStation.cnpj_cpf);
                        }
                    } catch (e) {
                        console.warn('Error fetching public station details:', e);
                    }
                }

                try {
                    // Use RPC to fetch station details reliably (works with both UUID and numeric legacy IDs)
                    const { data: stDataArray, error: stError } = await supabase
                        .rpc('get_sis_empresa_by_ids', { p_ids: lookupCandidates });

                    if (stDataArray && stDataArray.length > 0) {
                        const stData = stDataArray[0];
                        stationName = stData.nome_empresa;
                        stationLegacyId = stData.id_empresa; // Capture legacy ID
                        // Note: RPC returns specific columns. If we need municipio/uf and they aren't in RPC, we might need to update RPC or live with potentially missing data.
                        // The RPC get_sis_empresa_by_ids usually returns: id_empresa, nome_empresa, cnpj_cpf, latitude, longitude, bandeira, rede
                        // If municipio/uf are critical and not in RPC, we fallback or update RPC.
                        // For now, let's assuming the RPC is the source of truth for name.
                    } else {
                        // Fallback purely to what we have
                        stationName = suggestionData.station_name || stationName || sid;
                    }

                } catch (err) {
                    console.error('Error fetching station via RPC:', err);
                    stationName = suggestionData.station_name || stationName || sid;
                }
            }

            // Fetch Client
            if (suggestionData.client_id) {
                const cid = Number(suggestionData.client_id);
                if (!isNaN(cid)) {
                    const { data: clData } = await supabase
                        .from('clientes')
                        .select('nome')
                        .eq('id_cliente', cid)
                        .maybeSingle();

                    if (clData) clientName = clData.nome;
                }
            }

            // Fetch Profiles manually
            let requester = null;
            let approver = null;

            // Map 'created_by' (requester) and 'current_approver_id'
            const requesterId = suggestionData.created_by || suggestionData.requested_by; // Fallback just in case
            const approverId = suggestionData.current_approver_id;

            const userIds = [requesterId, approverId].filter(id => id && !id.includes('@')); // Filter out emails from IDs list
            const userEmails = [requesterId, approverId].filter(id => id && id.includes('@'));

            // 1. Fetch by user_id
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('user_id, nome, email') // Select user_id explicitly
                    .in('user_id', userIds);

                if (profiles) {
                    if (requesterId && !requester) requester = profiles.find((p: any) => p.user_id === requesterId);
                    if (approverId && !approver) approver = profiles.find((p: any) => p.user_id === approverId);
                }
            }

            // 2. Fetch by email (fallback or if ID is email)
            if ((requesterId && !requester) || (approverId && !approver)) {
                // Gather emails to check
                const emailsToCheck = [...userEmails];

                // If requesterId is effectively an email but wasn't found (unlikely if filtered above) 
                // OR if we want to try looking up an ID as an email (impossible for UUIDs)
                // But mainly, if we have a UUID that wasn't found, maybe check if there's a profile with that email? 
                // Actually the specific case is: requesterId IS an email (legacy data).

                if (requesterId && !requester && requesterId.includes('@')) emailsToCheck.push(requesterId);
                if (approverId && !approver && approverId.includes('@')) emailsToCheck.push(approverId);

                if (emailsToCheck.length > 0) {
                    const { data: profilesEmail } = await supabase
                        .from('user_profiles')
                        .select('user_id, nome, email')
                        .in('email', emailsToCheck);

                    if (profilesEmail) {
                        if (requesterId && !requester) requester = profilesEmail.find((p: any) => p.email === requesterId);
                        if (approverId && !approver) approver = profilesEmail.find((p: any) => p.email === approverId);
                    }
                }
            }

            // Normalize names
            if (requester) requester.name = requester.nome || requester.email;
            if (approver) approver.name = approver.nome || approver.email;

            setSuggestion({
                ...suggestionData,
                station_name: stationName,
                station_legacy_id: stationLegacyId, // Store legacy ID
                client_name: clientName,
                requester,
                approver
            });

            setApprovalHistory(historyData || []);

        } catch (error: any) {
            console.error('Error loading details:', error);
            toast.error('Erro ao carregar detalhes da solicitação');
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    // Helper functions
    const fetchPaymentTax = async (stationId: string, paymentMethodId: string) => {
        if (!stationId || !paymentMethodId || paymentMethodId === 'none') return 0;
        try {
            // First try to find station-specific tax
            const { data: stTax } = await supabase
                .from('tipos_pagamento')
                .select('TAXA')
                .eq('ID_POSTO', stationId)
                .eq('CARTAO', paymentMethodId)
                .limit(1);

            if (stTax && stTax.length > 0) return Number(stTax[0].TAXA) || 0;

            // Fallback to generic tax using 'GENERICO'
            const { data: genTax } = await supabase
                .from('tipos_pagamento')
                .select('TAXA')
                .eq('ID_POSTO', 'GENERICO')
                .eq('CARTAO', paymentMethodId)
                .limit(1);

            if (genTax && genTax.length > 0) return Number(genTax[0].TAXA) || 0;

            // Second fallback 'all'
            const { data: allTax } = await supabase
                .from('tipos_pagamento')
                .select('TAXA')
                .eq('ID_POSTO', 'all')
                .eq('CARTAO', paymentMethodId)
                .limit(1);

            if (allTax && allTax.length > 0) return Number(allTax[0].TAXA) || 0;

            return 0;
        } catch (e) {
            console.error('Error fetching tax:', e);
            return 0;
        }
    };

    const fromMaybeCents = (v: number | string | null | undefined) => {
        if (!v) return 0;
        if (typeof v === 'string') return parseBrazilianDecimal(v);
        const n = Number(v);
        return n >= 100 ? n / 100 : n;
    };

    const formatCurrency = (val: number | null | undefined) => {
        if (val === null || val === undefined) return 'R$ 0,00';
        return val.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
        });
    };

    const formatCurrencySimple = (val: number | null | undefined) => {
        if (val === null || val === undefined) return 'R$ 0,00';
        return val.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return format(new Date(dateString), "dd/MM/yyyy, HH:mm", { locale: ptBR });
    };

    // Metrics Calculation
    const [paymentTax, setPaymentTax] = useState(0);

    useEffect(() => {
        if (suggestion?.payment_method_id) {
            // Prioritize legacy ID (id_empresa) for tipos_pagamento lookup
            const sid = suggestion.station_legacy_id || suggestion.station_id;
            if (sid) {
                fetchPaymentTax(String(sid), suggestion.payment_method_id)
                    .then(tax => setPaymentTax(tax));
            }
        }
    }, [suggestion]);

    const metrics = useMemo(() => {
        if (!suggestion) return null;

        const purchaseCost = fromMaybeCents(suggestion.purchase_cost) || 0;
        const freightCost = fromMaybeCents(suggestion.freight_cost) || 0;
        const baseCost = purchaseCost + freightCost;

        // Payment Tax calculation
        const finalCost = baseCost * (1 + paymentTax / 100);

        const arlaCost = fromMaybeCents(suggestion.arla_cost_price) || 0;
        const arlaPrice = fromMaybeCents(suggestion.arla_purchase_price) || 0;

        const currentPrice = fromMaybeCents(suggestion.current_price) || 0;
        const suggestedPriceVal = fromMaybeCents(suggestion.suggested_price) || fromMaybeCents(suggestion.final_price) || 0;

        // User requested: Preço Sugerido - (Compra + Frete + Taxa)
        // Ignoring Arla from margin indicator
        const margin = suggestedPriceVal - finalCost;

        // Arla Margin
        const arlaMargin = arlaPrice - arlaCost;

        const volume = suggestion.volume_projected || 0; // m3
        const volumeL = volume * 1000;

        // ARLA volume is a % of fuel volume (simulatable 5-10%)
        const arlaVolumeM3 = volume * (arlaPercent / 100);
        const arlaVolumeL = arlaVolumeM3 * 1000;

        // Net Profit (Combustível + Arla) - TOTAL
        const totalFuelMargin = margin * volumeL;
        const totalArlaMargin = arlaMargin * arlaVolumeL;
        const totalNetProfit = totalFuelMargin + totalArlaMargin;

        return {
            purchaseCost,
            freightCost,
            baseCost,
            paymentTax,
            arlaCost,
            arlaPrice,
            finalCost,
            currentPrice,
            suggestedPrice: suggestedPriceVal,
            margin,
            arlaMargin,
            netProfit: totalNetProfit,
            totalFuelMargin,
            totalArlaMargin,
            volumeL,
            arlaVolumeM3,
            arlaVolumeL,
            volume,
            status: suggestion.status
        };
    }, [suggestion, paymentTax, arlaPercent]);

    // Status mapping
    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'approved': return 'success';
            case 'rejected': return 'danger';
            case 'pending': return 'warning';
            case 'draft': return 'neutral';
            default: return 'info';
        }
    };
    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'approved': return 'Aprovado';
            case 'rejected': return 'Rejeitado';
            case 'pending': return 'Pendente';
            case 'draft': return 'Rascunho';
            case 'price_suggested': return 'Preço Sugerido';
            case 'awaiting_justification': return 'Aguardando Justificativa';
            case 'awaiting_evidence': return 'Aguardando Evidência';
            case 'appealed': return 'Em Recurso';
            default: return status;
        }
    };

    const getHistoryIcon = (item: any) => {
        switch (item.action) {
            case 'created': return <FileText size={14} />;
            case 'approved': return <CheckCircle size={14} className="text-green-500" />;
            case 'rejected': return <XCircle size={14} className="text-red-500" />;
            case 'price_suggested': return <DollarSign size={14} className="text-indigo-500" />;
            case 'appealed': return <GitBranch size={14} className="text-orange-500" />;
            case 'request_justification': return <HelpCircle size={14} className="text-amber-500" />;
            case 'provide_justification': return <MessageSquare size={14} className="text-blue-500" />;
            case 'request_evidence': return <FileSearch size={14} className="text-blue-500" />;
            case 'provide_evidence': return <Paperclip size={14} className="text-purple-500" />;
            case 'accept_suggestion': return <CheckCircle size={14} className="text-emerald-500" />;
            case 'resubmitted': return <RefreshCcw size={14} className="text-blue-500" />;
            default: return <Clock size={14} />;
        }
    };

    const handleActionClick = (type: typeof dialogConfig extends null ? never : NonNullable<typeof dialogConfig>['type']) => {
        const configs: Record<string, { title: string; description: string; actionLabel: string }> = {
            approve: { title: 'Aprovar Solicitação', description: 'Confirma a aprovação desta solicitação de preço?', actionLabel: 'Confirmar Aprovação' },
            reject: { title: 'Rejeitar Solicitação', description: 'Informe o motivo da rejeição.', actionLabel: 'Confirmar Rejeição' },
            suggest_price: { title: 'Sugerir Novo Preço', description: 'Informe o novo preço sugerido e o motivo.', actionLabel: 'Enviar Sugestão' },
            request_justification: { title: 'Solicitar Justificativa', description: 'Solicite uma justificativa do solicitante.', actionLabel: 'Enviar Solicitação' },
            request_evidence: { title: 'Solicitar Evidência', description: 'Solicite uma evidência de preço ao solicitante.', actionLabel: 'Enviar Solicitação' },
            provide_justification: { title: 'Enviar Justificativa', description: 'Forneça a justificativa solicitada.', actionLabel: 'Enviar Justificativa' },
            provide_evidence: { title: 'Enviar Evidência', description: 'Anexe um arquivo ou forneça um link para a evidência solicitada.', actionLabel: 'Enviar Evidência' },
            accept_suggestion: { title: 'Aceitar Preço Sugerido', description: 'Confirma a aceitação do preço sugerido pelo aprovador?', actionLabel: 'Aceitar Preço' },
            appeal: { title: 'Recorrer da Decisão', description: 'Informe o novo preço proposto e o motivo do recurso.', actionLabel: 'Enviar Recurso' },
        };
        const config = configs[type];
        if (config) {
            setDialogConfig({ type: type as any, ...config });
            setObservation('');
            setSuggestedPriceInput('');
            setSelectedFile(null);

            // Buscar observação do aprovador para ações de resposta
            let note: string | null = null;
            const history = [...approvalHistory].reverse();

            if (type === 'provide_evidence') {
                const parent = history.find(h => h.action === 'request_evidence');
                if (parent) note = parent.observations;
            } else if (type === 'provide_justification') {
                const parent = history.find(h => h.action === 'request_justification');
                if (parent) note = parent.observations;
            } else if (type === 'accept_suggestion' || type === 'appeal') {
                const parent = history.find(h => h.action === 'price_suggested' || h.action === 'rejected');
                if (parent) note = parent.observations;
            }

            setApproverNote(note);
            setDialogOpen(true);
        }
    };

    const submitAction = async () => {
        if (!id || !dialogConfig) return;

        // Observação é obrigatória, exceto para envio de evidência se houver arquivo
        // Observação é obrigatória, exceto para envio de evidência (que agora exige arquivo)
        if (dialogConfig.type !== 'provide_evidence' && !observation.trim()) {
            toast.error('Observação é obrigatória');
            return;
        }

        if (dialogConfig.type === 'provide_evidence' && !selectedFile) {
            toast.error('Por favor, anexe o arquivo de evidência');
            return;
        }

        setActionLoading(true);
        try {
            switch (dialogConfig.type) {
                case 'approve':
                    await approvePriceRequest(id, observation);
                    toast.success('Solicitação aprovada com sucesso!');
                    break;
                case 'reject':
                    await rejectPriceRequest(id, observation);
                    toast.success('Solicitação rejeitada.');
                    break;
                case 'suggest_price': {
                    const price = parseBrazilianDecimal(suggestedPriceInput);
                    if (!price || price <= 0) {
                        toast.error('Informe um preço válido');
                        setActionLoading(false);
                        return;
                    }
                    await suggestPriceRequest(id, price, observation);
                    toast.success('Sugestão de preço enviada!');
                    break;
                }
                case 'request_justification':
                    await requestJustification(id, observation);
                    toast.success('Justificativa solicitada!');
                    break;
                case 'request_evidence':
                    await requestEvidence(id, evidenceTarget, observation);
                    toast.success('Evidência solicitada!');
                    break;
                case 'provide_justification':
                    await provideJustification(id, observation);
                    toast.success('Justificativa enviada!');
                    break;
                case 'provide_evidence': {
                    let finalEvidenceUrl = '';

                    if (selectedFile) {
                        setIsUploading(true);
                        try {
                            const fileExt = selectedFile.name.split('.').pop();
                            const fileName = `${id}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                            const filePath = `evidence/${fileName}`;

                            const { error: uploadError } = await supabase.storage
                                .from('financial-documents')
                                .upload(filePath, selectedFile);

                            if (uploadError) throw uploadError;

                            const { data: { publicUrl } } = supabase.storage
                                .from('financial-documents')
                                .getPublicUrl(filePath);

                            finalEvidenceUrl = publicUrl;
                        } catch (error: any) {
                            toast.error("Erro ao fazer upload do arquivo: " + error.message);
                            setIsUploading(false);
                            setActionLoading(false);
                            return;
                        } finally {
                            setIsUploading(false);
                        }
                    }

                    await provideEvidence(id, finalEvidenceUrl, observation || "Evidência enviada via arquivo.");
                    toast.success('Evidência enviada!');
                    break;
                }
                case 'accept_suggestion':
                    await acceptSuggestedPrice(id, observation);
                    toast.success('Preço aceito com sucesso!');
                    break;
                case 'appeal': {
                    const appealPrice = parseBrazilianDecimal(suggestedPriceInput);
                    if (!appealPrice || appealPrice <= 0) {
                        toast.error('Informe um preço válido para o recurso');
                        setActionLoading(false);
                        return;
                    }
                    await appealPriceRequest(id, appealPrice, observation);
                    toast.success('Recurso enviado com sucesso!');
                    break;
                }
            }
            setDialogOpen(false);
            setObservation('');
            setSuggestedPriceInput('');
            loadData(id);
        } catch (error: any) {
            console.error('Action error:', error);
            toast.error(error.message || 'Erro ao executar ação');
        } finally {
            setActionLoading(false);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!suggestion) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <p className="text-slate-500">Solicitação não encontrada.</p>
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft size={16} className="mr-2" /> Voltar
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <ArrowLeft size={20} className="text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800 tracking-tight">Detalhes da Solicitação</h1>
                        <p className="text-xs text-slate-400 font-mono">{id?.substring(0, 8)}...</p>
                    </div>
                </div>
                <Badge variant={getStatusBadgeVariant(suggestion.status)}>
                    {getStatusLabel(suggestion.status)}
                </Badge>
            </div>

            {/* Summary Card — unified */}
            <Card>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Posto</span>
                        <p className="text-sm font-bold text-slate-800 mt-1 leading-tight">{suggestion.station_name}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliente</span>
                        <p className="text-sm font-bold text-slate-800 mt-1 leading-tight">{suggestion.client_name}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Produto</span>
                        <div className="mt-1.5">
                            {(() => {
                                const p = (suggestion.product || '').toLowerCase().trim();
                                const productMap: Record<string, { label: string; color: string }> = {
                                    's10': { label: 'Diesel S10', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                                    's500': { label: 'Diesel S500', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                                    'diesel': { label: 'Diesel', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                                    'diesel s10': { label: 'Diesel S10', color: 'bg-amber-50 text-amber-700 border-amber-200' },
                                    'diesel s500': { label: 'Diesel S500', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                                    'etanol': { label: 'Etanol Hidratado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                    'etanol hidratado': { label: 'Etanol Hidratado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                    'gasolina': { label: 'Gasolina Comum', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                                    'gasolina comum': { label: 'Gasolina Comum', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                                    'gasolina aditivada': { label: 'Gasolina Aditivada', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                                };
                                const product = productMap[p] || { label: suggestion.product, color: 'bg-slate-50 text-slate-700 border-slate-200' };
                                return (
                                    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${product.color}`}>
                                        {product.label}
                                    </span>
                                );
                            })()}
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Margem Unit.</span>
                            {(metrics?.margin || 0) < 0 ? (
                                <TrendingDown size={14} className="text-red-500" />
                            ) : (
                                <TrendingUp size={14} className="text-emerald-500" />
                            )}
                        </div>
                        <div className={`text-2xl font-bold mt-1 tracking-tight ${(metrics?.margin || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatPrice4Decimals(metrics?.margin)}
                        </div>
                    </div>
                </div>
            </Card>


            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                <div className="lg:col-span-3 space-y-6">
                    <Card title="Composição de Preço">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100">
                                        <th className="pb-3 px-2">Componente</th>
                                        <th className="pb-3 text-right px-2">Valor Unit.</th>
                                        <th className="pb-3 text-right px-2">Total (Proj.)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {/* Custo de Compra */}
                                    <tr>
                                        <td className="py-4 px-2">
                                            <div className="font-medium text-slate-600">Custo de Compra</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight italic">
                                                {suggestion.station_municipio ? `${suggestion.station_municipio} / ${suggestion.station_uf || ''}` : suggestion.price_origin_base ? `Base: ${suggestion.price_origin_base}` : 'Origem não inf.'}
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 text-right font-medium">{formatPrice4Decimals(metrics?.purchaseCost)}</td>
                                        <td className="py-4 px-2 text-right text-slate-400">
                                            {formatCurrency((metrics?.purchaseCost || 0) * (metrics?.volumeL || 0))}
                                            {/* Note: This total is simplified, could vary if volume is m3 vs L. purchaseCost usually per Liter */}
                                        </td>
                                    </tr>

                                    {/* Frete */}
                                    <tr>
                                        <td className="py-3 px-2 text-slate-600 font-medium">Frete</td>
                                        <td className="py-3 px-2 text-right font-medium">{formatPrice4Decimals(metrics?.freightCost)}</td>
                                        <td className="py-3 px-2 text-right text-slate-400">
                                            {formatCurrency((metrics?.freightCost || 0) * (metrics?.volumeL || 0))}
                                        </td>
                                    </tr>

                                    {/* Taxa de Pagamento (Conditional) */}
                                    {metrics?.paymentTax !== 0 && (
                                        <tr>
                                            <td className="py-3 px-2 text-slate-600 font-medium italic">Taxa de Pagamento ({suggestion.payment_method_id})</td>
                                            <td className="py-3 px-2 text-right font-medium">{metrics?.paymentTax}%</td>
                                            <td className="py-3 px-2 text-right text-slate-400">
                                                {formatCurrency((metrics?.finalCost || 0) - (metrics?.baseCost || 0))}
                                            </td>
                                        </tr>
                                    )}

                                    <tr className="bg-slate-50/50 border-t-2 border-slate-100">
                                        <td className="py-3 px-2 font-bold text-slate-900 uppercase text-[10px]">Custo Final (Combustível)</td>
                                        <td className="py-3 px-2 text-right font-bold text-slate-900">{formatPrice4Decimals(metrics?.finalCost)}</td>
                                        <td className="py-3 px-2 text-right font-bold text-slate-900 text-xs">
                                            {formatCurrency((metrics?.finalCost || 0) * (metrics?.volumeL || 0))}
                                        </td>
                                    </tr>

                                    {/* Arla (Separated from Fuel Final Cost) */}
                                    {(metrics?.arlaCost || 0) > 0 && (
                                        <>
                                            <tr className="border-t border-slate-100">
                                                <td className="py-3 px-2 text-slate-500 font-medium italic opacity-70">ARLA 32 (Custo)</td>
                                                <td className="py-3 px-2 text-right font-medium opacity-70">{formatCurrency(metrics?.arlaCost)}</td>
                                                <td className="py-3 px-2 text-right text-slate-400 opacity-70">-</td>
                                            </tr>
                                            <tr className="bg-slate-50/30">
                                                <td className="py-4 px-2 text-slate-500 font-bold italic opacity-70">ARLA 32 (Venda)</td>
                                                <td className="py-4 px-2 text-right font-bold opacity-70">{formatCurrency(metrics?.arlaPrice)}</td>
                                                <td className="py-4 px-2 text-right font-bold opacity-70">-</td>
                                            </tr>
                                        </>
                                    )}

                                    <tr className="bg-slate-900 text-white shadow-lg">
                                        <td className="py-3 px-4 font-bold rounded-l-md tracking-tight uppercase text-[10px]">Preço Sugerido (Venda)</td>
                                        <td className="py-3 px-2 text-right font-bold">{formatPrice4Decimals(metrics?.suggestedPrice)}</td>
                                        <td className="py-3 px-4 text-right font-bold rounded-r-md">
                                            {formatCurrency((metrics?.suggestedPrice || 0) * (metrics?.volumeL || 0))}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Lucro Líquido + ARLA Simulation — integrated card */}
                    <Card title="Resultado Projetado">
                        {/* ARLA Simulation — subtle inline */}
                        {(metrics?.arlaCost || 0) > 0 && (
                            <div className="mb-5 pb-4 border-b border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Volume ARLA 32</span>
                                    <span className="text-sm font-bold text-slate-700">{arlaPercent.toFixed(1)}% <span className="text-[10px] font-normal text-slate-400">({(metrics?.arlaVolumeM3 || 0).toFixed(2)} m³)</span></span>
                                </div>
                                <input
                                    type="range"
                                    min="5"
                                    max="10"
                                    step="0.5"
                                    value={arlaPercent}
                                    onChange={(e) => setArlaPercent(Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-slate-600"
                                />
                                <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                                    <span>5%</span>
                                    <span>10%</span>
                                </div>
                            </div>
                        )}

                        {/* Net Profit Summary */}
                        <div className="flex items-baseline justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lucro Líquido</span>
                            <div className="flex items-center gap-2">
                                {(metrics?.netProfit || 0) < 0 ? (
                                    <TrendingDown size={14} className="text-red-500" />
                                ) : (
                                    <TrendingUp size={14} className="text-emerald-500" />
                                )}
                                <span className={`text-2xl font-bold tracking-tight ${(metrics?.netProfit || 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(metrics?.netProfit)}
                                </span>
                            </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-50 space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Combustível</span>
                                <div className="text-right">
                                    <span className={`font-bold ${(metrics?.totalFuelMargin || 0) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                        {formatCurrency(metrics?.totalFuelMargin)}
                                    </span>
                                    <span className="text-[10px] text-slate-400 ml-2">{((metrics?.volumeL || 0) / 1000).toLocaleString('pt-BR')} m³ × {formatPrice4Decimals(metrics?.margin)}/L</span>
                                </div>
                            </div>
                            {(metrics?.arlaPrice || 0) > 0 && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 font-medium">ARLA 32 <span className="text-[10px] text-slate-400">({arlaPercent}%)</span></span>
                                    <div className="text-right">
                                        <span className={`font-bold ${(metrics?.totalArlaMargin || 0) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                            {formatCurrency(metrics?.totalArlaMargin)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 ml-2">{(metrics?.arlaVolumeM3 || 0).toFixed(2)} m³ × {formatPrice4Decimals(metrics?.arlaMargin)}/L</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    <div className="flex gap-4 items-start bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-inner">
                        <Info size={18} className="text-slate-400 mt-0.5 shrink-0" />
                        <div className="space-y-2 w-full">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Justificativa do Solicitante</span>
                            <p className="text-sm text-slate-600 italic leading-relaxed">
                                "{suggestion.justificativa || suggestion.observations || 'Nenhuma justificativa fornecida.'}"
                            </p>
                            {suggestion.rejection_reason && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Motivo da Rejeição</span>
                                    <p className="text-sm text-red-600 italic leading-relaxed">
                                        "{suggestion.rejection_reason}"
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <Card title="Condições">
                        <div className="space-y-4">
                            <InfoItem label="Pagamento" value={suggestion.payment_method_id || 'Não informado'} />
                            <InfoItem label="Volume Atual" value={suggestion.volume_made ? `${Number(suggestion.volume_made).toLocaleString('pt-BR')} m³` : '-'} />
                            <InfoItem label="Volume Projetado" value={`${(suggestion.volume_projected || 0).toLocaleString('pt-BR')} m³`} />
                            <InfoItem label="Solicitante" value={formatNameFromEmail(suggestion.requester?.name || 'Sistema')} />
                            {/* Simplified payment info as data might be complex JSON or Join */}
                            <InfoItem label="Validade" value={formatDate(suggestion.valid_until) || 'Imediata'} />
                        </div>
                    </Card>

                    {suggestion.evidence_url && (
                        <Card title="Anexos">
                            <div className="space-y-2">
                                <button
                                    onClick={() => setShowEvidenceModal(true)}
                                    className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-md w-full text-left hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    <Paperclip size={16} className="text-purple-500" />
                                    <div className="flex-1 overflow-hidden">
                                        <p className="text-xs font-bold text-slate-700 truncate">Evidência de Preço</p>
                                        <span className="text-[10px] text-blue-600 truncate block">Visualizar Arquivo</span>
                                    </div>
                                </button>
                            </div>
                        </Card>
                    )}

                    <Card title="Atividade">
                        <div className="space-y-6 relative before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-slate-100 pl-1">
                            {approvalHistory.map((item, idx) => (
                                <div key={idx} className="flex gap-4 relative">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white shadow-sm bg-slate-100 text-slate-500`}>
                                        {getHistoryIcon(item)}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-700">
                                                {(() => {
                                                    const requesterActions = ['created', 'justification_provided', 'evidence_provided', 'accept_suggestion', 'appealed'];
                                                    const isRequesterAction = requesterActions.includes(item.action);
                                                    // For requester actions: always prefer enriched requester name
                                                    if (isRequesterAction) {
                                                        if (suggestion.requester?.name) return formatNameFromEmail(suggestion.requester.name);
                                                        if (item.approver_name && !item.approver_name.toLowerCase().includes('solicitante')) return formatNameFromEmail(item.approver_name);
                                                        return 'Solicitante';
                                                    }
                                                    // For approver actions: prefer stored name, fallback to enriched
                                                    if (item.approver_name && !item.approver_name.toLowerCase().includes('aprovador')) return formatNameFromEmail(item.approver_name);
                                                    if (suggestion.approver?.name) return formatNameFromEmail(suggestion.approver.name);
                                                    return 'Aprovador';
                                                })()}
                                            </span>
                                            {item.approval_level && <span className="text-[9px] font-bold bg-slate-100 px-1 rounded text-slate-500 uppercase">Nv {item.approval_level}</span>}
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-600 leading-tight">
                                            {(() => {
                                                const actionLabels: Record<string, string> = {
                                                    created: 'Criou solicitação',
                                                    approved: 'Aprovou',
                                                    rejected: 'Rejeitou',
                                                    price_suggested: 'Sugeriu preço',
                                                    request_justification: 'Solicitou justificativa',
                                                    justification_provided: 'Forneceu justificativa',
                                                    request_evidence: 'Solicitou evidência',
                                                    evidence_provided: 'Forneceu evidência',
                                                    accept_suggestion: 'Aceitou sugestão',
                                                    appealed: 'Recorreu do preço',
                                                    resubmitted: 'Reenviou p/ revisão',
                                                };
                                                const baseLabel = actionLabels[item.action] || item.action || 'Ação registrada';

                                                // Helper to extract price from observations text
                                                const extractPrice = (obs: string): number | null => {
                                                    const match = obs.match(/(?:Preço sugerido|Contraproposta):\s*R\$\s*([\d.,]+)/i);
                                                    if (!match) return null;
                                                    // Values use dot as decimal (e.g. "5.8", "5.78") or comma (e.g. "5,78")
                                                    const cleaned = match[1].replace(',', '.');
                                                    const val = parseFloat(cleaned);
                                                    return isNaN(val) ? null : val;
                                                };

                                                // For price_suggested and appealed, show "de R$ X a R$ Y"
                                                if (item.action === 'price_suggested' || item.action === 'appealed') {
                                                    const toPrice = extractPrice(item.observations || '');

                                                    // Find "from" price: look at previous history entries for the last known price
                                                    let fromPrice: number | null = null;
                                                    const previousItems = approvalHistory.slice(0, idx);
                                                    for (let i = previousItems.length - 1; i >= 0; i--) {
                                                        const prev = previousItems[i];
                                                        if (prev.action === 'price_suggested' || prev.action === 'appealed') {
                                                            const prevPrice = extractPrice(prev.observations || '');
                                                            if (prevPrice !== null) {
                                                                fromPrice = prevPrice;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                    // Fallback: use the original suggested_price or final_price
                                                    if (fromPrice === null) {
                                                        fromPrice = fromMaybeCents(suggestion.suggested_price) || fromMaybeCents(suggestion.final_price) || null;
                                                    }

                                                    if (toPrice !== null) {
                                                        const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
                                                        if (fromPrice !== null && fromPrice !== toPrice) {
                                                            return <>{baseLabel} <span className="text-[10px] text-slate-400 font-medium">({fmt(fromPrice)} → {fmt(toPrice)})</span></>;
                                                        }
                                                        return <>{baseLabel} <span className="text-[10px] text-slate-400 font-medium">({fmt(toPrice)})</span></>;
                                                    }
                                                }

                                                return baseLabel;
                                            })()}
                                        </span>
                                        {item.observations && <p className="text-[10px] text-slate-500 mt-1 italic leading-snug">"{item.observations}"</p>}
                                        {item.attachment_url && (
                                            <a
                                                href={item.attachment_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5 text-[9px] text-purple-600 font-bold mt-2 hover:bg-purple-50 w-fit p-1 rounded transition-colors border border-purple-100"
                                            >
                                                <Paperclip size={10} />
                                                Ver evidência
                                            </a>
                                        )}
                                        <span className="text-[9px] text-slate-400 font-medium mt-1">{formatDate(item.created_at)}</span>
                                    </div>
                                </div>
                            ))}
                            {approvalHistory.length === 0 && (
                                <span className="text-xs text-slate-400 italic">Sem histórico registrado.</span>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* Rodapé de Ação */}
            {/* Mostra se for a vez do usuário aprovar OU se ele for o solicitante e a solicitação aguarda resposta */}
            {
                (
                    // Turno do aprovador
                    (['pending', 'appealed'].includes(suggestion.status) && suggestion.current_approver_id === user?.id) ||
                    // Turno do solicitante (requester)
                    (['price_suggested', 'awaiting_justification', 'awaiting_evidence'].includes(suggestion.status) && (suggestion.created_by === user?.id || suggestion.requested_by === user?.id))
                ) && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xl flex flex-col gap-5 sticky bottom-4 z-50">
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            <div className="flex-1 w-full relative group">
                                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-400 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="Insira uma observação técnica rápida..."
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 transition-all placeholder:text-slate-400"
                                    value={observation}
                                    onChange={(e) => setObservation(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                {(['pending', 'appealed'].includes(suggestion.status)) ? (
                                    <>
                                        <button
                                            onClick={() => handleActionClick('reject')}
                                            className="flex-1 md:flex-none px-6 py-3 rounded-lg border border-red-100 text-red-600 font-bold text-xs uppercase tracking-wider hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={16} />
                                            Rejeitar
                                        </button>
                                        <button
                                            onClick={() => handleActionClick('approve')}
                                            className="flex-1 md:flex-none px-12 py-3 rounded-lg bg-green-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={16} />
                                            Aprovar
                                        </button>
                                    </>
                                ) : suggestion.status === 'price_suggested' ? (
                                    <>
                                        {!approvalHistory.some(item => item.action === 'appealed') && (
                                            <button
                                                onClick={() => handleActionClick('appeal')}
                                                className="flex-1 md:flex-none px-6 py-3 rounded-lg border border-orange-100 text-orange-600 font-bold text-xs uppercase tracking-wider hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <GitBranch size={16} />
                                                Recorrer
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleActionClick('accept_suggestion')}
                                            className="flex-1 md:flex-none px-12 py-3 rounded-lg bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={16} />
                                            Aceitar Preço
                                        </button>
                                    </>
                                ) : suggestion.status === 'awaiting_justification' ? (
                                    <button
                                        onClick={() => handleActionClick('provide_justification')}
                                        className="flex-1 px-12 py-3 rounded-lg bg-blue-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                                    >
                                        <MessageSquare size={16} />
                                        Enviar Justificativa
                                    </button>
                                ) : suggestion.status === 'awaiting_evidence' ? (
                                    <button
                                        onClick={() => handleActionClick('provide_evidence')}
                                        className="flex-1 px-12 py-3 rounded-lg bg-purple-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2"
                                    >
                                        <Paperclip size={16} />
                                        Enviar Evidência
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {/* Ações Secundárias / Administrativas */}
                        {(['pending', 'appealed'].includes(suggestion.status)) && (
                            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Ações Adicionais:</span>
                                <button
                                    onClick={() => handleActionClick('suggest_price')}
                                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                                >
                                    <DollarSign size={14} className="text-indigo-400" />
                                    Sugerir Preço
                                </button>
                                <button
                                    onClick={() => handleActionClick('request_evidence')}
                                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                                >
                                    <FileSearch size={14} className="text-blue-400" />
                                    Pedir Evidência
                                </button>
                                <button
                                    onClick={() => handleActionClick('request_justification')}
                                    className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                                >
                                    <HelpCircle size={14} className="text-amber-400" />
                                    Pedir Justificativa
                                </button>
                            </div>
                        )}
                    </div>
                )
            }


            {/* Action Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{dialogConfig?.title}</DialogTitle>
                        <DialogDescription>{dialogConfig?.description}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {dialogConfig?.type === 'request_evidence' && (
                            <RadioGroup
                                value={evidenceTarget}
                                onValueChange={(v) => setEvidenceTarget(v as 'principal' | 'arla')}
                                className="flex gap-4 mb-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="principal" id="r1" />
                                    <Label htmlFor="r1">Produto Principal</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="arla" id="r2" />
                                    <Label htmlFor="r2">Arla 32</Label>
                                </div>
                            </RadioGroup>
                        )}

                        {(dialogConfig?.type === 'suggest_price' || dialogConfig?.type === 'appeal') && (
                            <div className="space-y-2">
                                <Label>Novo Preço Sugerido (R$)</Label>
                                <Input
                                    value={suggestedPriceInput}
                                    onChange={(e) => {
                                        // Simple mask
                                        let v = e.target.value.replace(/\D/g, "");
                                        v = (Number(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        setSuggestedPriceInput(v);
                                    }}
                                    placeholder="0,00"
                                />
                            </div>
                        )}

                        {/* Context Section (Note from previous action) */}
                        {dialogConfig?.type && ['provide_justification', 'provide_evidence', 'accept_suggestion', 'appeal'].includes(dialogConfig.type) && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold flex items-center gap-1">
                                    <MessageSquare size={12} />
                                    Nota do Aprovador
                                </Label>
                                <p className="text-sm text-slate-600 italic leading-relaxed">
                                    {approverNote ? `"${approverNote}"` : "Sem observações do aprovador."}
                                </p>
                            </div>
                        )}

                        {dialogConfig?.type && ['approve', 'reject', 'suggest_price', 'request_justification', 'request_evidence'].includes(dialogConfig.type) && suggestion?.observations && (
                            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg space-y-1">
                                <Label className="text-[10px] uppercase tracking-wider text-blue-600 font-bold flex items-center gap-1">
                                    <Info size={12} />
                                    Justificativa do Solicitante
                                </Label>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    "{suggestion.observations}"
                                </p>
                            </div>
                        )}

                        {dialogConfig?.type === 'provide_evidence' && (
                            <div className="space-y-4">
                                <div className="relative group">
                                    <input
                                        type="file"
                                        id="dialog-evidence-upload"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) setSelectedFile(file);
                                        }}
                                        disabled={isUploading}
                                    />
                                    <label
                                        htmlFor="dialog-evidence-upload"
                                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all
                                        ${isUploading ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 hover:border-purple-400 hover:bg-purple-50'}`}
                                    >
                                        {selectedFile ? (
                                            <div className="flex flex-col items-center">
                                                <FileText className="h-8 w-8 text-purple-600 mb-2" />
                                                <span className="text-xs font-bold text-slate-700">{selectedFile.name}</span>
                                                <span className="text-[10px] text-slate-400 mt-1">Clique para trocar o arquivo</span>
                                            </div>
                                        ) : (
                                            <>
                                                <Upload className="h-8 w-8 text-slate-400 group-hover:text-purple-500 transition-colors" />
                                                <span className="mt-2 text-xs font-bold text-slate-500 group-hover:text-purple-700 uppercase tracking-wider">Clique para anexar evidência</span>
                                            </>
                                        )}
                                    </label>
                                </div>

                                {selectedFile && !isUploading && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedFile(null)}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 text-[10px] uppercase font-bold"
                                    >
                                        Remover Anexo
                                    </Button>
                                )}
                            </div>
                        )}

                        {dialogConfig?.type !== 'provide_evidence' && (
                            <div className="space-y-2">
                                <Label>Observação <span className="text-red-500">*</span></Label>
                                <Textarea
                                    value={observation}
                                    onChange={(e) => setObservation(e.target.value)}
                                    placeholder="Digite o motivo ou observação..."
                                    className="min-h-[100px]"
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={submitAction}
                            disabled={actionLoading}
                            variant={dialogConfig?.type === 'reject' ? 'destructive' : 'default'}
                        >
                            {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {dialogConfig?.actionLabel}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Evidence Image Modal — portal to body */}
            {showEvidenceModal && suggestion.evidence_url && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                    onClick={() => setShowEvidenceModal(false)}
                >
                    <div
                        className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <Paperclip size={14} className="text-purple-500" />
                                <span className="text-sm font-bold text-slate-700">Evidência de Preço</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={suggestion.evidence_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                    <ExternalLink size={12} />
                                    Abrir em nova aba
                                </a>
                                <button
                                    onClick={() => setShowEvidenceModal(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        {/* Content */}
                        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50">
                            {suggestion.evidence_url.toLowerCase().endsWith('.pdf') ? (
                                <iframe
                                    src={suggestion.evidence_url}
                                    className="w-full h-[75vh] rounded border border-slate-200"
                                    title="Evidência de Preço"
                                />
                            ) : (
                                <img
                                    src={suggestion.evidence_url}
                                    alt="Evidência de Preço"
                                    className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-sm"
                                />
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
