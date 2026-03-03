import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
    Check,
    X,
    DollarSign,
    TrendingUp,
    Clock,
    Info,
    Paperclip,
    ExternalLink
} from 'lucide-react';
import { getProductName, formatPrice } from '@/lib/pricing-utils';
import type { EnrichedApproval } from '@/types';

interface SwipeableApprovalCardProps {
    approval: EnrichedApproval;
    onApprove: (approval: EnrichedApproval) => void;
    onReject: (approval: EnrichedApproval) => void;
    onShowActions: (approval: EnrichedApproval) => void;
    onViewDetails: (approval: EnrichedApproval) => void;
    onViewAttachment?: (url: string) => void;
    isTopCard: boolean;
}

export function SwipeableApprovalCard({
    approval,
    onApprove,
    onReject,
    onShowActions,
    onViewDetails,
    onViewAttachment,
    isTopCard
}: SwipeableApprovalCardProps) {
    const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);
    const [arlaPercentage, setArlaPercentage] = useState(5); // % padrão de Arla
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);

    // Motion values for drag
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Rotation based on horizontal drag
    const rotate = useTransform(x, [-200, 200], [-15, 15]);

    // Opacity for action indicators
    const approveOpacity = useTransform(x, [0, 100], [0, 1]);
    const rejectOpacity = useTransform(x, [-100, 0], [1, 0]);
    const actionsOpacity = useTransform(y, [-100, 0], [1, 0]);

    // Background colors based on drag direction
    const backgroundColor = useTransform(
        x,
        [-200, 0, 200],
        ['rgba(239, 68, 68, 0.1)', 'rgba(0,0,0,0)', 'rgba(34, 197, 94, 0.1)']
    );

    const exitVariants = {
        left: { x: -500, opacity: 0, transition: { duration: 0.3 } },
        right: { x: 500, opacity: 0, transition: { duration: 0.3 } },
        up: { y: -200, opacity: 0, transition: { duration: 0.2 } }
    };

    const handleDragEnd = (_: any, info: PanInfo) => {
        if (isDraggingSlider) return; // Não processar se estava no slider

        // Thresholds mais altos para evitar deslize acidental no mobile
        const offsetThreshold = 180; // px - precisa arrastar bastante
        const velocityThreshold = 1200; // px/s - precisa ser rápido E intencional

        // Requer offset GRANDE ou (offset médio + velocidade alta)
        const absOffsetX = Math.abs(info.offset.x);
        const absVelocityX = Math.abs(info.velocity.x);

        if (info.offset.x > 0 && (absOffsetX > offsetThreshold || (absOffsetX > 120 && absVelocityX > velocityThreshold))) {
            setExitDirection('right');
            setTimeout(() => onApprove(approval), 300);
        } else if (info.offset.x < 0 && (absOffsetX > offsetThreshold || (absOffsetX > 120 && absVelocityX > velocityThreshold))) {
            setExitDirection('left');
            setTimeout(() => onReject(approval), 300);
        } else if (info.offset.y < -150 || info.velocity.y < -800) {
            // Arrastar para cima abre o menu de ações
            onShowActions(approval);
        }
    };

    // Calculate price change
    const currentPrice = approval.current_price || 0;
    const suggestedPrice = approval.suggested_price || 0;
    const priceDiff = suggestedPrice - currentPrice;
    const isIncrease = priceDiff > 0;

    // Get station name (sem código)
    const stationName = approval.stations?.nome_empresa || approval.stations?.name || 'Posto';

    // Get client name
    const clientName = approval.clients?.nome || approval.clients?.name || 'Cliente';

    // Informações de pagamento
    const paymentMethod = approval.payment_methods?.CARTAO || approval.payment_methods?.name || null;
    const paymentTax = approval.payment_methods?.TAXA || 0;

    // Cálculos financeiros
    const margin = approval.margin_cents ? approval.margin_cents / 100 : 0;
    const costPrice = approval.cost_price || 0;
    const volumeProjected = approval.volume_projected || 0;
    const freightCost = approval.freight_cost || 0;
    const purchaseCost = approval.purchase_cost || 0;

    // Custo total
    const totalCost = costPrice || (purchaseCost + freightCost);

    // Lucro de margem = margem (R$/L) * volume projetado (m³) * 1000
    const marginProfit = margin * volumeProjected * 1000;

    // Lucro Arla (dinâmico baseado no slider)
    const arlaCostPrice = approval.arla_cost_price || 0;
    const arlaPurchasePrice = approval.arla_purchase_price || 0;
    const arlaMargin = arlaPurchasePrice > 0 ? arlaPurchasePrice - arlaCostPrice : 0.10;
    const arlaProfit = arlaMargin * volumeProjected * 1000 * (arlaPercentage / 100);

    // Lucro líquido = lucro margem + lucro arla
    const netProfit = marginProfit + arlaProfit;

    return (
        <motion.div
            className={`absolute inset-0 ${isTopCard ? 'z-10' : 'z-0'}`}
            style={{ x, y, rotate, backgroundColor }}
            drag={isTopCard && !isDraggingSlider}
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.35}
            onDragEnd={handleDragEnd}
            animate={exitDirection ? exitVariants[exitDirection] : {}}
            whileTap={{ cursor: 'grabbing' }}
        >
            {/* Action Indicators */}
            {isTopCard && (
                <>
                    <motion.div
                        className="absolute top-4 right-4 z-20 bg-green-500 text-white px-3 py-1 rounded-lg font-bold shadow-lg"
                        style={{ opacity: approveOpacity }}
                    >
                        <Check className="h-5 w-5 inline mr-1" />
                        APROVAR
                    </motion.div>

                    <motion.div
                        className="absolute top-4 left-4 z-20 bg-red-500 text-white px-3 py-1 rounded-lg font-bold shadow-lg"
                        style={{ opacity: rejectOpacity }}
                    >
                        <X className="h-5 w-5 inline mr-1" />
                        REJEITAR
                    </motion.div>

                    <motion.div
                        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-purple-500 text-white px-3 py-1 rounded-lg font-bold shadow-lg"
                        style={{ opacity: actionsOpacity }}
                    >
                        <DollarSign className="h-5 w-5 inline mr-1" />
                        MAIS AÇÕES
                    </motion.div>
                </>
            )}

            {/* Card Content */}
            <Card className="h-full w-full overflow-hidden shadow-2xl border-0 bg-white dark:bg-slate-900">
                <CardContent className="p-0 h-full flex flex-col">
                    {/* Header compacto - Minimalista */}
                    <div className="bg-slate-900 px-4 py-3 text-white border-b border-slate-800">
                        <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-white border-white/20 text-xs font-normal">
                                {getProductName(approval.product)}
                            </Badge>
                            <div className="flex items-center gap-2">
                                {/* Indicador de anexos */}
                                {approval.attachments && approval.attachments.length > 0 && (
                                    <div
                                        className="flex items-center gap-1 bg-white/10 rounded px-1.5 py-0.5"
                                    >
                                        <Paperclip className="h-3 w-3 text-white/70" />
                                        <span className="text-[10px] text-white/70">{approval.attachments.length}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-1 text-white/60 text-xs">
                                    <Clock className="h-3 w-3" />
                                    {new Date(approval.created_at).toLocaleDateString('pt-BR')}
                                </div>
                            </div>
                        </div>
                        <h2 className="text-base font-medium truncate mt-1 text-white/90">{stationName}</h2>
                        <p className="text-white/60 text-xs truncate font-light">{clientName}</p>
                    </div>

                    {/* Conteúdo principal */}
                    <div className="p-3 flex-1 flex flex-col">
                        {/* Preço */}
                        <div className="text-center mb-3">
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatPrice(suggestedPrice)}
                            </p>
                            <div className={`flex items-center justify-center gap-1 text-xs ${isIncrease ? 'text-red-500' : 'text-green-500'}`}>
                                <TrendingUp className={`h-3 w-3 ${!isIncrease ? 'rotate-180' : ''}`} />
                                <span className="font-medium">
                                    {isIncrease ? '+' : ''}{formatPrice(priceDiff)} ({currentPrice > 0 ? ((priceDiff / currentPrice) * 100).toFixed(1) : 0}%)
                                </span>
                            </div>
                        </div>

                        {/* Grid de dados - 2x2 compacto e limpo */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="bg-slate-50 dark:bg-slate-800 rounded p-2 text-center border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Margem</p>
                                <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{formatPrice(margin)}/L</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded p-2 text-center border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Custo Total</p>
                                <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">{formatPrice(totalCost)}</p>
                                {paymentMethod && (
                                    <p className="text-[9px] text-slate-400">{paymentMethod} {paymentTax > 0 && `(${paymentTax.toFixed(2)}%)`}</p>
                                )}
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded p-2 text-center border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Vol. Projetado</p>
                                <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">{volumeProjected.toLocaleString('pt-BR')} m³</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded p-2 text-center border border-slate-100 dark:border-slate-700">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Lucro Est.</p>
                                <p className="font-bold text-slate-900 dark:text-white text-sm">R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>

                        {/* Slider ARLA - Estilo minimalista */}
                        <div
                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded p-2 mb-2"
                            onPointerDown={() => setIsDraggingSlider(true)}
                            onPointerUp={() => setIsDraggingSlider(false)}
                            onPointerLeave={() => setIsDraggingSlider(false)}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] text-slate-500 uppercase tracking-wider">ARLA {arlaPercentage}%</p>
                                <p className="text-xs font-medium text-slate-700">{arlaProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-400 mb-2">
                                <span>Custo: {formatPrice(arlaCostPrice)}</span>
                                <span>Venda: {formatPrice(arlaPurchasePrice)}</span>
                            </div>
                            <Slider
                                value={[arlaPercentage]}
                                onValueChange={(value) => setArlaPercentage(value[0])}
                                max={10}
                                min={5}
                                step={1}
                                className="w-full [&>span:first-child]:h-1.5 [&>span:first-child]:bg-slate-100 [&_span[role=slider]]:h-3 [&_span[role=slider]]:w-3 [&_span[role=slider]]:border-2 [&_span[role=slider]]:border-primary [&_span[role=slider]]:bg-white [&_span[role=slider]]:shadow-sm"
                            />
                        </div>

                        {/* Resumo de lucro - Simplificado */}
                        <div className="border border-slate-100 dark:border-slate-800 rounded p-2 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex justify-between items-center">
                                <div className="text-xs text-slate-500">
                                    <span>S10: R$ {marginProfit.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                    <span className="mx-1 text-slate-300">+</span>
                                    <span>ARLA: R$ {arlaProfit.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                                </div>
                                <p className="text-lg font-bold text-slate-900 dark:text-white">R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                            </div>
                        </div>
                    </div>

                    {/* Botões de ação - Minimalistas */}
                    {isTopCard && (
                        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="flex items-center justify-center gap-3">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-full border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all duration-300"
                                    onClick={() => onReject(approval)}
                                >
                                    <X className="h-5 w-5" />
                                </Button>

                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                        onClick={() => onViewDetails(approval)}
                                    >
                                        <Info className="h-5 w-5" />
                                    </Button>

                                    {approval.attachments && approval.attachments.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 rounded-full text-slate-400 hover:text-purple-600 hover:bg-purple-50"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onViewAttachment) {
                                                    onViewAttachment(approval.attachments![0]);
                                                } else {
                                                    window.open(approval.attachments![0], '_blank');
                                                }
                                            }}
                                        >
                                            <Paperclip className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-full border-slate-200 text-slate-400 hover:text-green-600 hover:border-green-200 hover:bg-green-50 transition-all duration-300"
                                    onClick={() => onApprove(approval)}
                                >
                                    <Check className="h-5 w-5" />
                                </Button>
                            </div>
                            <p className="text-center text-[10px] text-slate-300 font-light mt-2 uppercase tracking-widest">Deslize para decidir</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
}
