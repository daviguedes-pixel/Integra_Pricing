import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCcw, FileText, Download, ExternalLink } from "lucide-react";
import { formatPrice } from "@/lib/utils"; // Assuming utils has formatPrice or I can use the one from pricing-utils
import { formatPrice as formatPriceUtils } from "@/lib/pricing-utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ImageViewerModal } from "@/components/ImageViewerModal";

interface Reference {
    id: string;
    codigo_referencia: string;
    posto_id: string;
    cliente_id: string;
    produto: string;
    preco_referencia: number;
    tipo_pagamento_id?: string;
    observacoes?: string;
    anexo?: string;
    criado_por?: string;
    created_at: string;
    stations?: { name: string; code: string };
    clients?: { name: string; code: string };
    payment_methods?: { name: string };
}

interface PriceReferenceListProps {
    stationId?: string;
    clientId?: string;
    product?: string;
}

export function PriceReferenceList({ stationId, clientId, product }: PriceReferenceListProps) {
    const [references, setReferences] = useState<Reference[]>([]);
    const [loading, setLoading] = useState(false);
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string>("");

    const loadReferences = async (useCache = true) => {
        try {
            setLoading(true);

            // Check cache
            const cacheKey = 'price_request_references_cache';
            if (useCache) {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { data, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < 5 * 60 * 1000) { // 5 minutes
                        setReferences(data);
                        setLoading(false);
                        return;
                    }
                }
            }

            console.log('🔄 Carregando referências de mercado...');

            const { data, error } = await supabase
                .from('referencias')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            // Enrich data with station/client/payment method details
            // Note: This matches the logic inferred from PriceRequest.tsx
            const [stationsRes, clientsRes, paymentMethodsRes] = await Promise.all([
                supabase.rpc('get_sis_empresa_stations'),
                supabase.from('clientes').select('id_cliente, nome'),
                supabase.from('tipos_pagamento').select('id, CARTAO')
            ]);

            const stations = stationsRes.data || [];
            const clients = clientsRes.data || [];
            const paymentMethods = paymentMethodsRes.data || [];

            const enrichedReferences = (data || []).map((ref: any) => {
                // Find station
                const station = stations.find((s: any) =>
                    String(s.id) === String(ref.posto_id) ||
                    String(s.cnpj_cpf) === String(ref.posto_id) ||
                    String(s.id_empresa) === String(ref.posto_id)
                );

                // Find client
                const client = clients.find((c: any) => String(c.id_cliente) === String(ref.cliente_id));

                // Find payment method
                const paymentMethod = paymentMethods.find((pm: any) => String(pm.id) === String(ref.tipo_pagamento_id));

                return {
                    ...ref,
                    stations: station ? { name: station.nome_empresa, code: station.cnpj_cpf || station.id } : null,
                    clients: client ? { name: client.nome, code: client.id_cliente } : null,
                    payment_methods: paymentMethod ? { name: paymentMethod.CARTAO } : null
                };
            });

            setReferences(enrichedReferences);

            // Update cache
            localStorage.setItem(cacheKey, JSON.stringify({
                data: enrichedReferences,
                timestamp: Date.now()
            }));

        } catch (error: any) {
            console.error('Erro ao carregar referências:', error);
            toast.error('Erro ao carregar referências: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReferences(true);

        const channel = supabase
            .channel('referencias-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'referencias'
            }, () => {
                console.log('🔄 Mudança detectada em referências');
                loadReferences(false);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filteredReferences = references.filter(ref => {
        if (stationId && stationId !== 'none' && String(ref.posto_id) !== String(stationId)) return false;
        if (clientId && clientId !== 'none' && String(ref.cliente_id) !== String(clientId)) return false;
        if (product && ref.produto !== product) return false;
        return true;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Referências de Mercado</h2>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadReferences(false)}
                    disabled={loading}
                    className="gap-2"
                >
                    <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredReferences.length === 0 ? (
                <Card className="bg-slate-50 dark:bg-slate-800/50 border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="h-12 w-12 text-slate-300 mb-4" />
                        <p className="text-lg font-medium text-slate-600 dark:text-slate-400">Nenhuma referência encontrada</p>
                        <p className="text-sm text-slate-500 dark:text-slate-500">
                            Tente limpar os filtros ou adicionar novas referências.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredReferences.map((ref) => (
                        <Card key={ref.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">
                                            {formatPriceUtils(ref.preco_referencia)}
                                        </CardTitle>
                                        <p className="text-xs text-slate-500 mt-1">
                                            {new Date(ref.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        {ref.produto}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">Posto: </span>
                                    <span className="text-slate-600 dark:text-slate-400">
                                        {ref.stations?.name || ref.posto_id}
                                    </span>
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">Cliente: </span>
                                    <span className="text-slate-600 dark:text-slate-400">
                                        {ref.clients?.name || ref.cliente_id}
                                    </span>
                                </div>
                                {ref.payment_methods && (
                                    <div>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">Pagamento: </span>
                                        <span className="text-slate-600 dark:text-slate-400">
                                            {ref.payment_methods.name}
                                        </span>
                                    </div>
                                )}
                                {ref.observacoes && (
                                    <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded text-xs italic text-slate-600 dark:text-slate-400 mt-2">
                                        "{ref.observacoes}"
                                    </div>
                                )}
                                {ref.anexo && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full mt-2 gap-2 text-blue-600 hover:text-blue-700"
                                        onClick={() => {
                                            setSelectedImage(ref.anexo!);
                                            setImageViewerOpen(true);
                                        }}
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                        Visualizar Anexo
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <ImageViewerModal
                isOpen={imageViewerOpen}
                onClose={() => setImageViewerOpen(false)}
                imageUrl={selectedImage}
                imageName="Anexo da Referência"
            />
        </div>
    );
}
