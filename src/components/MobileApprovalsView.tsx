import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SwipeableApprovalCard } from './SwipeableApprovalCard';
import { ApprovalActionsSheet } from './ApprovalActionsSheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ArrowLeft,
    RefreshCw,
    Filter,
    CheckCircle2,
    XCircle,
    X,
    Loader2,
    Inbox,
    DollarSign,
    Paperclip,
    ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { EnrichedApproval } from '@/types';

interface MobileApprovalsViewProps {
    approvals: EnrichedApproval[];
    onApprove: (approval: EnrichedApproval, observation?: string) => Promise<void>;
    onReject: (approval: EnrichedApproval, observation: string) => Promise<void>;
    onSuggestPrice: (approval: EnrichedApproval, newPrice: number, observation: string) => Promise<void>;
    onRequestJustification?: (approval: EnrichedApproval, message: string) => Promise<void>;
    onRequestEvidence?: (approval: EnrichedApproval, message: string) => Promise<void>;
    onRefresh: () => void;
    isRefreshing: boolean;
    stats: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
    };
}

export function MobileApprovalsView({
    approvals,
    onApprove,
    onReject,
    onSuggestPrice,
    onRequestJustification,
    onRequestEvidence,
    onRefresh,
    isRefreshing,
    stats
}: MobileApprovalsViewProps) {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showSuggestModal, setShowSuggestModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showActionsSheet, setShowActionsSheet] = useState(false);
    const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);
    const [selectedApproval, setSelectedApproval] = useState<EnrichedApproval | null>(null);
    const [observation, setObservation] = useState('');
    const [suggestedPrice, setSuggestedPrice] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [lastAction, setLastAction] = useState<{ type: 'approve' | 'reject'; approval: EnrichedApproval } | null>(null);
    const [arlaPercentage, setArlaPercentage] = useState(5); // % padrão de Arla para simulação

    // Filter out processed approvals - only show pending ones assigned to current user
    const pendingApprovals = approvals.filter(a =>
        a.status === 'pending' &&
        !processedIds.has(a.id)
    );

    // Get visible cards (current + next for stack effect)
    const visibleCards = pendingApprovals.slice(0, 3);

    const handleApprove = async (approval: EnrichedApproval) => {
        // Optimistic UI: Mark as processed IMMEDIATELY to remove card instantly
        setProcessedIds(prev => new Set([...prev, approval.id]));
        setLastAction({ type: 'approve', approval });

        // Show success feedback immediately
        toast.success('Aprovado!', {
            icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
            duration: 1500 // Duração mais curta para sensação de agilidade
        });

        // Executar em background (fire and forget)
        onApprove(approval).catch((error) => {
            console.error("Erro ao aprovar em background:", error);
            // Rollback optimistic state em caso de erro
            setProcessedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(approval.id);
                return newSet;
            });
            toast.error('Erro ao salvar aprovação. Tente novamente.');
        });
    };

    const handleReject = (approval: EnrichedApproval) => {
        setSelectedApproval(approval);
        setObservation('');
        setShowRejectModal(true);
    };

    const confirmReject = async () => {
        if (!selectedApproval) return;
        if (!observation.trim()) {
            toast.error('Por favor, adicione um motivo para a rejeição');
            return;
        }

        setIsProcessing(true);
        try {
            await onReject(selectedApproval, observation);
            setProcessedIds(prev => new Set([...prev, selectedApproval.id]));
            setLastAction({ type: 'reject', approval: selectedApproval });
            setShowRejectModal(false);
            setSelectedApproval(null);
            setObservation('');
            toast.success('Rejeitado', {
                icon: <XCircle className="h-5 w-5 text-red-500" />
            });
        } catch (error) {
            toast.error('Erro ao rejeitar');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSuggestPrice = (approval: EnrichedApproval) => {
        setSelectedApproval(approval);
        setSuggestedPrice(approval.suggested_price?.toString() || '');
        setObservation('');
        setShowSuggestModal(true);
    };

    const confirmSuggestPrice = async () => {
        if (!selectedApproval) return;
        const price = parseFloat(suggestedPrice.replace(',', '.'));
        if (isNaN(price) || price <= 0) {
            toast.error('Por favor, insira um preço válido');
            return;
        }

        setIsProcessing(true);
        try {
            await onSuggestPrice(selectedApproval, price, observation);
            setProcessedIds(prev => new Set([...prev, selectedApproval.id]));
            setShowSuggestModal(false);
            setSelectedApproval(null);
            setSuggestedPrice('');
            setObservation('');
            toast.success('Preço sugerido com sucesso!');
        } catch (error) {
            toast.error('Erro ao sugerir preço');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleShowActions = (approval: EnrichedApproval) => {
        setSelectedApproval(approval);
        setShowActionsSheet(true);
    };

    const handleRequestJustification = async (approval: EnrichedApproval, message: string) => {
        if (onRequestJustification) {
            try {
                await onRequestJustification(approval, message);
                toast.success('Justificativa solicitada');
            } catch (error) {
                toast.error('Erro ao solicitar justificativa');
            }
        } else {
            // Fallback: exibir toast informativo
            toast.info(`Solicitação enviada: "${message}"`);
        }
    };

    const handleRequestEvidence = async (approval: EnrichedApproval, message: string) => {
        if (onRequestEvidence) {
            try {
                await onRequestEvidence(approval, message);
                toast.success('Evidência solicitada');
            } catch (error) {
                toast.error('Erro ao solicitar evidência');
            }
        } else {
            // Fallback: exibir toast informativo
            toast.info(`Solicitação enviada: "${message}"`);
        }
    };

    const handleSuggestPriceFromSheet = async (approval: EnrichedApproval, price: number, message: string) => {
        try {
            await onSuggestPrice(approval, price, message);
            setProcessedIds(prev => new Set([...prev, approval.id]));
            toast.success('Preço sugerido com sucesso!');
        } catch (error) {
            toast.error('Erro ao sugerir preço');
        }
    };

    const handleViewAttachment = (url: string) => {
        setViewingAttachment(url);
    };

    const handleViewDetails = (approval: EnrichedApproval) => {
        navigate(`/approval-details/${approval.id}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b">
                <div className="flex items-center justify-between p-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>

                    <div className="text-center">
                        <h1 className="font-bold text-lg">Aprovações</h1>
                        <p className="text-xs text-muted-foreground">
                            {pendingApprovals.length} pendente{pendingApprovals.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onRefresh}
                        disabled={isRefreshing}
                    >
                        <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                {/* Mini stats */}
                <div className="flex justify-center gap-4 pb-3">
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        {stats.pending} pendentes
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {stats.approved} aprovados
                    </Badge>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        {stats.rejected} rejeitados
                    </Badge>
                </div>
            </div>

            {/* Card Stack Area */}
            <div className="relative h-[calc(100vh-180px)] p-4">
                {pendingApprovals.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center h-full text-center"
                    >
                        <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Inbox className="h-12 w-12 text-slate-400" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Tudo em dia! 🎉</h2>
                        <p className="text-muted-foreground mb-6">
                            Não há aprovações pendentes para você.
                        </p>
                        <Button onClick={onRefresh} variant="outline">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Verificar novamente
                        </Button>
                    </motion.div>
                ) : (
                    <div className="relative h-full">
                        <AnimatePresence>
                            {visibleCards.map((approval, index) => (
                                <SwipeableApprovalCard
                                    key={approval.id}
                                    approval={approval}
                                    onApprove={handleApprove}
                                    onReject={handleReject}
                                    onShowActions={handleShowActions}
                                    onViewDetails={handleViewDetails}
                                    onViewAttachment={handleViewAttachment}
                                    isTopCard={index === 0}
                                />
                            ))}
                        </AnimatePresence>

                        {/* Card counter */}
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                            <Badge variant="secondary" className="text-sm">
                                {currentIndex + 1} de {pendingApprovals.length}
                            </Badge>
                        </div>
                    </div>
                )}
            </div>

            {/* Reject Modal */}
            <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-500" />
                            Rejeitar Solicitação
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedApproval?.observations && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                                <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-1">Justificativa do Solicitante</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{selectedApproval.observations}"</p>
                            </div>
                        )}
                        <div>
                            <Label htmlFor="reject-reason">Motivo da rejeição *</Label>
                            <Textarea
                                id="reject-reason"
                                placeholder="Explique o motivo da rejeição..."
                                value={observation}
                                onChange={(e) => setObservation(e.target.value)}
                                className="mt-2"
                                rows={4}
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                                Cancelar
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={confirmReject}
                                disabled={isProcessing || !observation.trim()}
                            >
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Confirmar Rejeição
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Suggest Price Modal */}
            <Dialog open={showSuggestModal} onOpenChange={setShowSuggestModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-blue-500" />
                            Sugerir Novo Preço
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedApproval?.observations && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg">
                                <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-1">Justificativa do Solicitante</p>
                                <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{selectedApproval.observations}"</p>
                            </div>
                        )}
                        <div>
                            <Label htmlFor="new-price">Novo preço sugerido</Label>
                            <div className="relative mt-2">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                                <Input
                                    id="new-price"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0,000"
                                    value={suggestedPrice}
                                    onChange={(e) => setSuggestedPrice(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="suggest-reason">Observação (opcional)</Label>
                            <Textarea
                                id="suggest-reason"
                                placeholder="Justificativa para o novo preço..."
                                value={observation}
                                onChange={(e) => setObservation(e.target.value)}
                                className="mt-2"
                                rows={3}
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setShowSuggestModal(false)}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={confirmSuggestPrice}
                                disabled={isProcessing || !suggestedPrice}
                            >
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Enviar Sugestão
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Details Modal */}
            <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
                <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalhes da Solicitação</DialogTitle>
                    </DialogHeader>
                    {selectedApproval && (() => {
                        // Cálculos financeiros
                        const margin = selectedApproval.margin_cents ? selectedApproval.margin_cents / 100 : 0;
                        const volumeProjected = selectedApproval.volume_projected || 0;
                        const totalCost = selectedApproval.cost_price || (selectedApproval.purchase_cost || 0) + (selectedApproval.freight_cost || 0);
                        const marginProfit = margin * volumeProjected * 1000;
                        const arlaCostPrice = selectedApproval.arla_cost_price || 0;
                        const arlaPurchasePrice = selectedApproval.arla_purchase_price || 0;
                        const arlaMargin = arlaPurchasePrice > 0 ? arlaPurchasePrice - arlaCostPrice : 0.10;
                        const arlaProfit = arlaMargin * volumeProjected * 1000 * (arlaPercentage / 100);
                        const netProfit = marginProfit + arlaProfit;

                        const paymentMethod = selectedApproval.payment_methods?.CARTAO || selectedApproval.payment_methods?.name || null;
                        const paymentTax = selectedApproval.payment_methods?.TAXA || 0;

                        return (
                            <div className="space-y-3">
                                {/* Info básica */}
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-muted-foreground text-[10px]">Posto</p>
                                        <p className="font-medium text-sm">{selectedApproval.stations?.nome_empresa || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-[10px]">Cliente</p>
                                        <p className="font-medium text-sm">{selectedApproval.clients?.nome || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Preços */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded p-2 text-center">
                                        <p className="text-[10px] text-muted-foreground">Sugerido</p>
                                        <p className="font-bold text-primary text-sm">R$ {selectedApproval.suggested_price?.toFixed(3)}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded p-2 text-center">
                                        <p className="text-[10px] text-muted-foreground">Margem</p>
                                        <p className="font-semibold text-green-600 text-sm">R$ {margin.toFixed(4)}/L</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800 rounded p-2 text-center">
                                        <p className="text-[10px] text-muted-foreground">Custo</p>
                                        <p className="font-semibold text-sm">R$ {totalCost.toFixed(4)}</p>
                                        {paymentMethod && (
                                            <p className="text-[9px] text-muted-foreground">{paymentMethod} {paymentTax > 0 && `(${paymentTax.toFixed(1)}%)`}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Slider ARLA */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] text-muted-foreground">% ARLA</p>
                                        <p className="text-xs font-semibold text-blue-600">{arlaPercentage}%</p>
                                    </div>
                                    <Slider
                                        value={[arlaPercentage]}
                                        onValueChange={(value) => setArlaPercentage(value[0])}
                                        max={10}
                                        min={5}
                                        step={1}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                                        <span>5%</span>
                                        <span>10%</span>
                                    </div>
                                </div>

                                {/* Lucro */}
                                <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/10 dark:to-blue-900/10 rounded p-3">
                                    <div className="flex justify-between items-center">
                                        <div className="text-xs text-muted-foreground">
                                            <span>S10: R$ {marginProfit.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                            <span className="mx-1">+</span>
                                            <span>ARLA: R$ {arlaProfit.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                        </div>
                                        <p className="text-xl font-bold text-primary">R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                    </div>
                                </div>

                                {/* Anexos */}
                                {selectedApproval.attachments && selectedApproval.attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {selectedApproval.attachments.map((attachment, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleViewAttachment(attachment)}
                                                className="flex items-center gap-1.5 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-xs text-blue-600 transition-colors"
                                            >
                                                <Paperclip className="h-3 w-3" />
                                                <span>Anexo {index + 1}</span>
                                                <ExternalLink className="h-3 w-3" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {selectedApproval.observations && (
                                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs text-muted-foreground">
                                        {selectedApproval.observations}
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={() => {
                                            setShowDetailsModal(false);
                                            handleReject(selectedApproval);
                                        }}
                                    >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Rejeitar
                                    </Button>
                                    <Button
                                        className="flex-1"
                                        onClick={() => {
                                            setShowDetailsModal(false);
                                            handleApprove(selectedApproval);
                                        }}
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Aprovar
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Actions Bottom Sheet */}
            <ApprovalActionsSheet
                isOpen={showActionsSheet}
                approval={selectedApproval}
                onClose={() => {
                    setShowActionsSheet(false);
                    setSelectedApproval(null);
                }}
                onRequestJustification={handleRequestJustification}
                onSuggestPrice={handleSuggestPriceFromSheet}
                onRequestEvidence={handleRequestEvidence}
            />
            {/* Attachment Viewer Modal */}
            <Dialog open={!!viewingAttachment} onOpenChange={(open) => !open && setViewingAttachment(null)}>
                <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden flex flex-col bg-slate-900/95 border-slate-800">
                    <DialogHeader className="p-4 bg-slate-900 absolute top-0 left-0 right-0 z-10 flex flex-row items-center justify-between border-b border-slate-800">
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            Visualizar Anexo
                        </DialogTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-slate-800 rounded-full h-8 w-8"
                            onClick={() => setViewingAttachment(null)}
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </DialogHeader>

                    <div className="flex-1 bg-slate-950 flex items-center justify-center pt-14 pb-0 overflow-hidden">
                        {viewingAttachment && (
                            viewingAttachment.toLowerCase().includes('.pdf') ? (
                                <iframe
                                    src={viewingAttachment}
                                    className="w-full h-full border-0"
                                    title="Visualizador de PDF"
                                />
                            ) : (
                                <img
                                    src={viewingAttachment}
                                    alt="Anexo"
                                    className="max-w-full max-h-full object-contain"
                                />
                            )
                        )}
                    </div>

                    <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
                        <Button
                            variant="outline"
                            onClick={() => viewingAttachment && window.open(viewingAttachment, '_blank')}
                            className="text-white border-slate-700 hover:bg-slate-800"
                        >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Abrir no Navegador
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default MobileApprovalsView;
