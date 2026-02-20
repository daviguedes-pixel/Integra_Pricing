import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, DollarSign } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface PriceRequestHeaderProps {
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

export function PriceRequestHeader({ onRefresh, isRefreshing }: PriceRequestHeaderProps) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [syncingN8N, setSyncingN8N] = useState(false);

    // Função para acionar fluxo n8n
    const handleN8NSync = async () => {
        try {
            setSyncingN8N(true);
            const loadingToast = toast.loading("Executando sincronização de custos... Aguarde.");

            // Buscar usuário atual (melhor esforço)
            let currentUserName = 'Usuario';
            const currentUserEmail = user?.email;

            if (user) {
                const { data: profile } = await supabase.from('user_profiles').select('nome').eq('user_id', user.id).maybeSingle();
                if (profile) currentUserName = profile.nome;
            }

            // Chamar a Edge Function
            const { data, error } = await supabase.functions.invoke('sync-n8n', {
                body: {
                    action: 'sync_costs',
                    requested_by: currentUserName,
                    user_email: currentUserEmail,
                    timestamp: new Date().toISOString(),
                    source: 'price_request_header'
                }
            });

            toast.dismiss(loadingToast);

            if (!error) {
                toast.success(`Sincronização iniciada com sucesso!`, {
                    duration: 4000,
                });
            } else {
                throw new Error(error.message || 'Erro ao chamar função');
            }
        } catch (error: any) {
            console.error('Erro ao acionar n8n:', error);
            toast.error(`Falha na sincronização: ${error.message}`);
        } finally {
            setSyncingN8N(false);
        }
    };

    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-3 sm:p-4 text-white shadow-xl mb-6">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <Button
                        variant="secondary"
                        onClick={() => navigate("/dashboard")}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm h-8 text-xs sm:text-sm"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Voltar ao Dashboard</span>
                        <span className="sm:hidden">Voltar</span>
                    </Button>
                    <div className="flex-1 sm:flex-none">
                        <h1 className="text-base sm:text-lg font-bold mb-0">Solicitação de Preço</h1>
                        <p className="text-slate-200 text-[10px] sm:text-xs hidden sm:block">Gerencie solicitações de preços</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleN8NSync}
                        disabled={syncingN8N}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm h-8 text-xs sm:text-sm"
                    >
                        <DollarSign className={`h-3.5 w-3.5 ${syncingN8N ? 'text-green-400' : 'text-green-500'}`} />
                        <span className="hidden sm:inline">{syncingN8N ? 'Sincronizando...' : 'Atualizar Custos'}</span>
                        <span className="sm:hidden">Custos</span>
                    </Button>
                    {onRefresh && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm h-8 text-xs sm:text-sm"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">Atualizar</span>
                            {/* Mobile icon only */}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
