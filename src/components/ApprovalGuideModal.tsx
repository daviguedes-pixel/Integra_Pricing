import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, ShieldAlert, MessageSquarePlus, FileQuestion, ArrowRight, DollarSign } from "lucide-react";
import { useState, useEffect } from "react";

interface ApprovalGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ApprovalGuideModal = ({ isOpen, onClose }: ApprovalGuideModalProps) => {
    const [step, setStep] = useState(1);

    // Reset step when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
        }
    }, [isOpen]);

    const totalSteps = 4;

    const handleNext = () => {
        if (step < totalSteps) {
            setStep(step + 1);
        } else {
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center">
                        {step === 1 && "Novo Fluxo de Aprovação"}
                        {step === 2 && "Ações do Aprovador"}
                        {step === 3 && "Interações do Solicitante"}
                        {step === 4 && "Escalonamento Automático"}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="flex justify-center mb-6">
                                <div className="bg-blue-100 p-4 rounded-full">
                                    <ShieldAlert className="w-12 h-12 text-blue-600" />
                                </div>
                            </div>
                            <p className="text-lg text-center text-slate-700 dark:text-slate-300">
                                O sistema de aprovação de preços foi atualizado para oferecer mais flexibilidade e controle.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                <div className="border p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                                    <h3 className="font-semibold text-lg mb-2">Antes</h3>
                                    <p className="text-sm text-muted-foreground">Aprovação ou Rejeição direta. Sem possibilidade de negociação ou ajuste fino pelo solicitante.</p>
                                </div>
                                <div className="border p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                                    <h3 className="font-semibold text-lg mb-2 text-blue-700 dark:text-blue-400">Agora</h3>
                                    <p className="text-sm text-slate-700 dark:text-slate-300">Fluxo interativo com solicitação de justificativas, evidências, contrapropostas e recursos.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <p className="text-center text-slate-700 dark:text-slate-300 mb-4">
                                Como aprovador, você agora tem mais opções além de Aprovar ou Rejeitar:
                            </p>

                            <div className="grid gap-3">
                                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <div className="bg-amber-100 p-2 rounded-md mt-1">
                                        <MessageSquarePlus className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <span className="font-semibold block">Solicitar Justificativa</span>
                                        <span className="text-sm text-muted-foreground">Pede ao solicitante que explique melhor o motivo do preço, sem rejeitar de imediato.</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <div className="bg-purple-100 p-2 rounded-md mt-1">
                                        <FileQuestion className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <span className="font-semibold block">Solicitar Evidência</span>
                                        <span className="text-sm text-muted-foreground">Solicita foto ou documento (ex: nota fiscal, print do cliente) para comprovar o preço.</span>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <div className="bg-indigo-100 p-2 rounded-md mt-1">
                                        <DollarSign className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <span className="font-semibold block">Sugerir Novo Preço</span>
                                        <span className="text-sm text-muted-foreground">Propõe um valor diferente. O solicitante pode aceitar ou recorrer.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <p className="text-center text-slate-700 dark:text-slate-300 mb-4">
                                O solicitante participa ativamente do processo:
                            </p>

                            <div className="grid gap-4">
                                <div className="border-l-4 border-blue-500 pl-4 py-2">
                                    <h4 className="font-semibold">Responder Solicitações</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Quando pedido, o solicitante envia justificativas ou anexa evidências (fotos/arquivos) diretamente pela plataforma.
                                    </p>
                                </div>

                                <div className="border-l-4 border-green-500 pl-4 py-2">
                                    <h4 className="font-semibold">Aceitar Sugestões</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Se o aprovador sugerir um preço, o solicitante pode aceitar imediatamente, finalizando o processo.
                                    </p>
                                </div>

                                <div className="border-l-4 border-orange-500 pl-4 py-2">
                                    <h4 className="font-semibold">Recursos (Apelação)</h4>
                                    <p className="text-sm text-muted-foreground">
                                        O solicitante pode recorrer de uma sugestão de preço, enviando uma contraproposta justificada. Isso reinicia o fluxo de aprovação.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-6">
                            <div className="flex justify-center mb-6">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full"></div>
                                    <div className="relative bg-white dark:bg-slate-950 border-2 border-blue-100 dark:border-blue-900 p-6 rounded-xl shadow-lg">
                                        <div className="flex items-center gap-4 text-sm font-medium">
                                            <div className="flex flex-col items-center">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-2">1</div>
                                                <span>Supervisor</span>
                                            </div>
                                            <ArrowRight className="text-muted-foreground" />
                                            <div className="flex flex-col items-center">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-2 text-blue-600">2</div>
                                                <span className="text-blue-600">Gerente</span>
                                            </div>
                                            <ArrowRight className="text-muted-foreground" />
                                            <div className="flex flex-col items-center">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-2">3</div>
                                                <span>Diretor</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <h3 className="font-semibold text-lg text-center mb-2">Hierarquia Inteligente</h3>
                            <p className="text-center text-muted-foreground">
                                Se um aprovador rejeitar (ou se o valor exceder sua alçada), o sistema escala automaticamente para o próximo nível (ex: Gerente → Diretor) em vez de cancelar o pedido imediatamente.
                            </p>

                            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mt-4 border border-yellow-200 dark:border-yellow-800">
                                <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
                                    <strong>Nota:</strong> A rejeição final só ocorre se o aprovador de nível máximo rejeitar ou se não houver próximo nível configurado.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center mt-4">
                    <div className="flex gap-1">
                        {Array.from({ length: totalSteps }).map((_, i) => (
                            <div
                                key={i}
                                className={`h-2 w-2 rounded-full transition-colors ${step === i + 1 ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                            />
                        ))}
                    </div>

                    <Button onClick={handleNext} className="ml-auto">
                        {step < totalSteps ? (
                            <>
                                Próximo
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                        ) : (
                            <>
                                Entendi, vamos começar!
                                <Check className="w-4 h-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
