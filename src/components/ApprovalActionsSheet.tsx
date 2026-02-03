import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    MessageSquare,
    DollarSign,
    FileQuestion,
    X
} from 'lucide-react';
import type { EnrichedApproval } from '@/types';

type ActionType = 'justify' | 'suggest' | 'evidence' | null;

interface ApprovalActionsSheetProps {
    isOpen: boolean;
    approval: EnrichedApproval | null;
    onClose: () => void;
    onRequestJustification: (approval: EnrichedApproval, message: string) => void;
    onSuggestPrice: (approval: EnrichedApproval, price: number, message: string) => void;
    onRequestEvidence: (approval: EnrichedApproval, message: string) => void;
}

export function ApprovalActionsSheet({
    isOpen,
    approval,
    onClose,
    onRequestJustification,
    onSuggestPrice,
    onRequestEvidence
}: ApprovalActionsSheetProps) {
    const [activeAction, setActiveAction] = useState<ActionType>(null);
    const [message, setMessage] = useState('');
    const [suggestedPrice, setSuggestedPrice] = useState('');

    const handleClose = () => {
        setActiveAction(null);
        setMessage('');
        setSuggestedPrice('');
        onClose();
    };

    const handleSubmit = () => {
        if (!approval) return;

        switch (activeAction) {
            case 'justify':
                onRequestJustification(approval, message);
                break;
            case 'suggest':
                const price = parseFloat(suggestedPrice.replace(',', '.'));
                if (!isNaN(price)) {
                    onSuggestPrice(approval, price, message);
                }
                break;
            case 'evidence':
                onRequestEvidence(approval, message);
                break;
        }
        handleClose();
    };

    if (!isOpen || !approval) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                {/* Backdrop */}
                <motion.div
                    className="absolute inset-0 bg-black/50"
                    onClick={handleClose}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                />

                {/* Sheet */}
                <motion.div
                    className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                >
                    {/* Handle */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                    </div>

                    <div className="px-4 pb-8">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-lg">
                                {activeAction === null ? 'Ações Rápidas' :
                                    activeAction === 'justify' ? 'Pedir Justificativa' :
                                        activeAction === 'suggest' ? 'Sugerir Preço' :
                                            'Pedir Evidência'}
                            </h3>
                            <Button variant="ghost" size="icon" onClick={handleClose}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Actions Menu */}
                        {activeAction === null && (
                            <div className="space-y-2">
                                <Button
                                    variant="outline"
                                    className="w-full justify-start h-14 text-left"
                                    onClick={() => setActiveAction('justify')}
                                >
                                    <MessageSquare className="h-5 w-5 mr-3 text-orange-500" />
                                    <div>
                                        <p className="font-medium">Pedir Justificativa</p>
                                        <p className="text-xs text-muted-foreground">Solicitar explicação ao solicitante</p>
                                    </div>
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full justify-start h-14 text-left"
                                    onClick={() => setActiveAction('suggest')}
                                >
                                    <DollarSign className="h-5 w-5 mr-3 text-blue-500" />
                                    <div>
                                        <p className="font-medium">Sugerir Preço</p>
                                        <p className="text-xs text-muted-foreground">Propor um valor alternativo</p>
                                    </div>
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full justify-start h-14 text-left"
                                    onClick={() => setActiveAction('evidence')}
                                >
                                    <FileQuestion className="h-5 w-5 mr-3 text-purple-500" />
                                    <div>
                                        <p className="font-medium">Pedir Evidência</p>
                                        <p className="text-xs text-muted-foreground">Solicitar comprovação ou documentação</p>
                                    </div>
                                </Button>
                            </div>
                        )}

                        {/* Justify Form */}
                        {activeAction === 'justify' && (
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm">Mensagem para o solicitante</Label>
                                    <Textarea
                                        placeholder="Por favor, justifique este preço..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={3}
                                        className="mt-1"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setActiveAction(null)} className="flex-1">
                                        Voltar
                                    </Button>
                                    <Button onClick={handleSubmit} className="flex-1" disabled={!message.trim()}>
                                        Enviar
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Suggest Price Form */}
                        {activeAction === 'suggest' && (
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm">Preço sugerido (R$)</Label>
                                    <Input
                                        type="text"
                                        placeholder="0,000"
                                        value={suggestedPrice}
                                        onChange={(e) => setSuggestedPrice(e.target.value)}
                                        className="mt-1 text-lg font-semibold"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Preço atual: R$ {approval.suggested_price?.toFixed(3)}
                                    </p>
                                </div>
                                <div>
                                    <Label className="text-sm">Observação (opcional)</Label>
                                    <Textarea
                                        placeholder="Motivo da sugestão..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={2}
                                        className="mt-1"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setActiveAction(null)} className="flex-1">
                                        Voltar
                                    </Button>
                                    <Button onClick={handleSubmit} className="flex-1" disabled={!suggestedPrice.trim()}>
                                        Enviar Sugestão
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Request Evidence Form */}
                        {activeAction === 'evidence' && (
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-sm">O que você precisa?</Label>
                                    <Textarea
                                        placeholder="Preciso de comprovante de..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={3}
                                        className="mt-1"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setActiveAction(null)} className="flex-1">
                                        Voltar
                                    </Button>
                                    <Button onClick={handleSubmit} className="flex-1" disabled={!message.trim()}>
                                        Solicitar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
