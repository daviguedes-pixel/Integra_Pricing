import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
    Check,
    X,
    MessageSquare,
    Upload,
    AlertCircle,
    ChevronRight,
    TrendingUp,
    FileText,
    ArrowLeft
} from "lucide-react";
import {
    acceptSuggestedPrice,
    provideJustification,
    provideEvidence,
    appealPriceRequest
} from "@/api/priceRequestsApi";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyInput } from "@/components/ui/currency-input"; // Implemented previously
import { parseBrazilianDecimal } from "@/lib/utils"; // Ensure this helper exists or implement inline

interface RequesterResponseActionsProps {
    requests: any[];
    onSuccess: () => void;
}

export function RequesterResponseActions({ requests, onSuccess }: RequesterResponseActionsProps) {
    const [loading, setLoading] = useState(false);
    const [justification, setJustification] = useState("");
    const [newSuggestedPrice, setNewSuggestedPrice] = useState("");
    const [isAppealing, setIsAppealing] = useState(false);
    const [uploading, setUploading] = useState(false);

    if (!requests || requests.length === 0) return null;

    const first = requests[0];
    const status = first.status;
    const requestId = first.id;

    const handleAcceptPrice = async () => {
        setLoading(true);
        try {
            await acceptSuggestedPrice(requestId, "Aceito pelo solicitante via interface.");
            toast.success("Preço sugerido aceito com sucesso!");
            onSuccess();
        } catch (error: any) {
            toast.error("Erro ao aceitar preço: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendJustification = async () => {
        if (!justification.trim()) {
            toast.error("Por favor, insira a justificativa.");
            return;
        }
        setLoading(true);
        try {
            await provideJustification(requestId, justification);
            toast.success("Justificativa enviada com sucesso!");
            setJustification("");
            onSuccess();
        } catch (error: any) {
            toast.error("Erro ao enviar justificativa: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendAppeal = async () => {
        // Use parseBrazilianDecimal to handle "1.234,56" correctly
        const price = parseBrazilianDecimal(newSuggestedPrice);

        if (isNaN(price) || price <= 0) {
            toast.error("Preço inválido.");
            return;
        }
        setLoading(true);
        try {
            await appealPriceRequest(requestId, price, justification || "Apelação de preço sugerido.");
            toast.success("Apelação enviada com sucesso!");
            setIsAppealing(false);
            onSuccess();
        } catch (error: any) {
            toast.error("Erro ao enviar apelação: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `evidence/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('financial-documents')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('financial-documents')
                .getPublicUrl(filePath);

            await provideEvidence(requestId, publicUrl, justification || "Evidência anexada.");
            toast.success("Evidência enviada com sucesso!");
            onSuccess();
        } catch (error: any) {
            toast.error("Erro ao enviar evidência: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    // Helper to format currency for display
    const formatCurrency = (val: number) => {
        return val.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    };

    return (
        <Card className="bg-white border text-left shadow-sm overflow-hidden">
            {/* Top accent border based on type */}
            <div className={`h-1 w-full ${status === 'price_suggested' ? 'bg-amber-500' :
                status === 'awaiting_justification' ? 'bg-blue-500' :
                    'bg-purple-500'
                }`} />

            <CardContent className="p-5 space-y-5">
                {/* Header Section */}
                <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full shrink-0 ${status === 'price_suggested' ? 'bg-amber-100 text-amber-600' :
                        status === 'awaiting_justification' ? 'bg-blue-100 text-blue-600' :
                            'bg-purple-100 text-purple-600'
                        }`}>
                        {status === 'price_suggested' && <TrendingUp size={20} />}
                        {status === 'awaiting_justification' && <MessageSquare size={20} />}
                        {status === 'awaiting_evidence' && <Upload size={20} />}
                    </div>

                    <div className="space-y-1">
                        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                            {status === 'price_suggested' && "Preço Sugerido pelo Aprovador"}
                            {status === 'awaiting_justification' && "Justificativa Solicitada"}
                            {status === 'awaiting_evidence' && "Evidência Solicitada"}
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            {status === 'price_suggested' && "O aprovador sugeriu um valor diferente do solicitado. Analise e decida se aceita ou deseja recorrer."}
                            {status === 'awaiting_justification' && "O aprovador precisa de mais detalhes para prosseguir. Por favor, forneça uma justificativa."}
                            {status === 'awaiting_evidence' && (
                                <>
                                    É necessário anexar um documento ou imagem que comprove o valor solicitado.
                                    {first.evidence_product && (
                                        <div className="mt-2 font-semibold text-purple-700">
                                            Produto: {first.evidence_product === 'arla' ? 'ARLA 32' : 'Combustível (Principal)'}
                                        </div>
                                    )}
                                </>
                            )}
                        </p>

                        {/* Display Approver's Observation if available */}
                        {first.last_observation && (
                            <div className="mt-3 p-3 bg-white/50 border border-slate-200 rounded-md">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    Nota do Aprovador
                                </p>
                                <p className="text-sm text-slate-700 italic">"{first.last_observation}"</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Logic */}
                {status === 'price_suggested' && (
                    <div className="pl-[52px]"> {/* Indent to align with text */}
                        {!isAppealing ? (
                            <div className="space-y-4">
                                <div className="flex items-baseline gap-2 bg-slate-50 p-4 rounded-lg border border-slate-100 w-fit">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Novo Valor:</span>
                                    <span className="text-2xl font-bold text-slate-900">
                                        R$ {formatCurrency(first.suggested_price || 0)}
                                    </span>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button onClick={handleAcceptPrice} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                        Aceitar Valor
                                    </Button>
                                    <Button variant="outline" onClick={() => setIsAppealing(true)} disabled={loading} className="text-slate-600 border-slate-300 hover:bg-slate-50">
                                        Recorrer / Contraproposta
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-bold text-slate-700">Recurso de Preço</h4>
                                    <Button variant="ghost" size="sm" onClick={() => setIsAppealing(false)} className="h-6 w-6 p-0 rounded-full hover:bg-slate-200">
                                        <X size={14} />
                                    </Button>
                                </div>

                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Sua Contraproposta (R$)</label>
                                        <CurrencyInput
                                            value={newSuggestedPrice}
                                            onChange={setNewSuggestedPrice} // set formatted value
                                            placeholder="0,0000"
                                            className="bg-white border-slate-300 focus:border-amber-500 font-medium text-lg"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Justificativa</label>
                                        <Textarea
                                            value={justification}
                                            onChange={(e) => setJustification(e.target.value)}
                                            placeholder="Por que este valor é necessário?"
                                            className="bg-white border-slate-300 resize-none h-24 text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <Button onClick={handleSendAppeal} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Recurso"}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {status === 'awaiting_justification' && (
                    <div className="pl-[52px] space-y-4">
                        <Textarea
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            placeholder="Escreva sua justificativa aqui..."
                            className="bg-white border-slate-300 min-h-[100px] text-sm"
                        />
                        <Button onClick={handleSendJustification} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Resposta"}
                        </Button>
                    </div>
                )}

                {status === 'awaiting_evidence' && (
                    <div className="pl-[52px] space-y-4">
                        <div className="relative group">
                            <input
                                type="file"
                                id="evidence-upload"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={uploading}
                            />
                            <label
                                htmlFor="evidence-upload"
                                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all
                                ${uploading ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-300 hover:border-purple-400 hover:bg-purple-50'}`}
                            >
                                {uploading ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                                ) : (
                                    <>
                                        <Upload className="h-8 w-8 text-slate-400 group-hover:text-purple-500 transition-colors" />
                                        <span className="mt-2 text-xs font-bold text-slate-500 group-hover:text-purple-700 uppercase tracking-wider">Clique para adicionar anexo</span>
                                    </>
                                )}
                            </label>
                        </div>
                        <Textarea
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            placeholder="Observação opcional sobre o anexo..."
                            className="bg-white border-slate-300 text-sm h-20"
                        />
                    </div>
                )}

                {/* Display Evidence if available (e.g. after upload or if previously uploaded) */}
                {first.evidence_url && (
                    <div className="pl-[52px] mt-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-purple-600" />
                                <div>
                                    <p className="text-sm font-medium text-slate-700">Evidência Anexada</p>
                                    <a
                                        href={first.evidence_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-600 hover:underline"
                                    >
                                        Visualizar documento
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

const Loader2 = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);
