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
    municipio?: string;
    uf?: string;
    fonte?: string;
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
                .from('price_references')
                .select('*')
                .eq('ativo', true)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            // Enrich data with station/client/payment method details
            const uniquePostoIds = Array.from(new Set((data || []).map((r: any) => r.posto_id).filter(Boolean)));
            const uniqueClientIds = Array.from(new Set((data || []).map((r: any) => r.cliente_id).filter(Boolean)));

            const [stationsRes, clientesRes, clientsRes, paymentMethodsRes, concorrentesRes] = await Promise.all([
                supabase.rpc('get_sis_empresa_stations'),
                supabase.from('clientes').select('id_cliente, nome'),
                uniqueClientIds.length > 0
                    ? supabase.from('clients').select('id, name, id_cliente').in('id', uniqueClientIds as any[])
                    : Promise.resolve({ data: [] }),
                supabase.from('tipos_pagamento').select('id, CARTAO'),
                uniquePostoIds.length > 0
                    ? supabase.from('concorrentes').select('id_posto, razao_social, municipio, uf').in('id_posto', uniquePostoIds.map(Number).filter(n => !isNaN(n)) as any[])
                    : Promise.resolve({ data: [] })
            ]);

            const stations = stationsRes.data || [];
            const clientes = clientesRes.data || [];
            const clientsData = (clientsRes as any).data || [];
            const paymentMethods = paymentMethodsRes.data || [];
            const concorrentes = (concorrentesRes as any).data || [];

            // Build a comprehensive client name map
            const clientNameMap = new Map<string, string>();
            clientes.forEach((c: any) => {
                if (c.id_cliente) clientNameMap.set(String(c.id_cliente), c.nome || c.id_cliente);
            });
            clientsData.forEach((c: any) => {
                if (c.id) clientNameMap.set(String(c.id), c.name || c.id_cliente || 'Cliente');
                if (c.id_cliente) clientNameMap.set(String(c.id_cliente), c.name || c.id_cliente);
            });

            // Build concorrente maps for municipio/uf enrichment
            const concMap = new Map<string, any>();
            concorrentes.forEach((c: any) => {
                concMap.set(String(c.id_posto), c);
            });

            const enrichedReferences = (data || []).map((ref: any) => {
                // Find station
                const station = stations.find((s: any) =>
                    String(s.id) === String(ref.posto_id) ||
                    String(s.cnpj_cpf) === String(ref.posto_id) ||
                    String(s.id_empresa) === String(ref.posto_id)
                );

                // Find client name from the map
                const clientName = ref.cliente_id ? clientNameMap.get(String(ref.cliente_id)) : null;

                // Find payment method
                const paymentMethod = paymentMethods.find((pm: any) => String(pm.id) === String(ref.tipo_pagamento_id));

                // Enrich municipio/uf from concorrentes if missing
                const conc = ref.posto_id ? concMap.get(String(ref.posto_id)) : null;
                const enrichedMunicipio = ref.municipio || conc?.municipio || station?.municipio || 'Não Identificado';
                const enrichedUf = ref.uf || conc?.uf || station?.uf || '';

                return {
                    ...ref,
                    preco_referencia: Number(ref.preco) || 0,
                    anexo: ref.anexo_url,
                    municipio: enrichedMunicipio,
                    uf: enrichedUf,
                    stations: station ? { name: station.nome_empresa, code: station.cnpj_cpf || station.id } : (conc ? { name: conc.razao_social, code: conc.id_posto } : null),
                    clients: clientName ? { name: clientName, code: ref.cliente_id } : null,
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
            .channel('price-references-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'price_references'
            }, () => {
                console.log('🔄 Mudança detectada em referências');
                loadReferences(false);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Implement substitution logic: only the latest reference per Client + Product + Município
    const substitutedReferences = (() => {
        const map = new Map<string, Reference>();

        // References are already sorted by created_at desc from loadReferences
        references.forEach(ref => {
            // Unique key for substitution: Client + Product + Município
            // If client_id is missing, fallback to posto_id (competitor)
            const clientKey = ref.cliente_id || ref.posto_id || 'unknown';
            const rawMunicipio = (ref.municipio || '').trim().toLowerCase();

            // Se municipio estiver vazio ou 'não identificado', cada ref é única (não substituir)
            const isValidMunicipio = rawMunicipio && rawMunicipio !== 'não identificado' && rawMunicipio !== 'sem_municipio';
            const municipioKey = isValidMunicipio ? rawMunicipio : `_unique_${ref.id}`;
            const key = `${clientKey}-${ref.produto}-${municipioKey}`;

            if (!map.has(key)) {
                map.set(key, ref);
            }
        });

        return Array.from(map.values());
    })();

    const filteredReferences = substitutedReferences.filter(ref => {
        if (stationId && stationId !== 'none' && String(ref.posto_id) !== String(stationId)) return false;
        if (clientId && clientId !== 'none' && String(ref.cliente_id) !== String(clientId)) return false;
        if (product && ref.produto !== product) return false;
        return true;
    });

    // Grouping by UF > Municipality
    const groupedReferences = filteredReferences.reduce((acc, ref) => {
        const uf = ref.uf || 'OUTROS';
        const municipio = ref.municipio || 'NÃO IDENTIFICADO';

        if (!acc[uf]) acc[uf] = {};
        if (!acc[uf][municipio]) acc[uf][municipio] = [];

        acc[uf][municipio].push(ref);
        return acc;
    }, {} as Record<string, Record<string, Reference[]>>);

    const ufs = Object.keys(groupedReferences).sort();

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
                <div className="space-y-8">
                    {ufs.map(uf => (
                        <div key={uf} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="rounded-sm px-1.5 py-0.5 text-xs font-bold bg-slate-200 text-slate-700">
                                    {uf}
                                </Badge>
                                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                            </div>

                            {Object.keys(groupedReferences[uf]).sort().map(municipio => (
                                <div key={`${uf}-${municipio}`} className="space-y-4 ml-2">
                                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                        {municipio}
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {groupedReferences[uf][municipio].map((ref) => (
                                            <Card key={ref.id} className="hover:shadow-md transition-shadow border-l-4 border-l-primary/30">
                                                <CardHeader className="pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                                {ref.clients?.name || ref.stations?.name || "Referência Local"}
                                                            </CardTitle>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-lg font-black text-primary">
                                                                    {formatPriceUtils(ref.preco_referencia)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-5">
                                                            {ref.produto}
                                                        </Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="text-xs space-y-2 pt-0">
                                                    <div className="flex items-center justify-between text-slate-500">
                                                        <span>{new Date(ref.created_at).toLocaleDateString('pt-BR')}</span>
                                                        {ref.fonte && <Badge variant="secondary" className="text-[9px] h-4 px-1">{ref.fonte}</Badge>}
                                                    </div>

                                                    {(ref.stations?.name || ref.posto_id) && !ref.clients?.name && (
                                                        <div>
                                                            <span className="font-semibold text-slate-700 dark:text-slate-300">Posto: </span>
                                                            <span className="text-slate-600 dark:text-slate-400">
                                                                {ref.stations?.name || ref.posto_id}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {ref.payment_methods && (
                                                        <div>
                                                            <span className="font-semibold text-slate-700 dark:text-slate-300">Pagamento: </span>
                                                            <span className="text-slate-600 dark:text-slate-400">
                                                                {ref.payment_methods.name}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {ref.observacoes && (
                                                        <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded italic text-slate-600 dark:text-slate-400 mt-2">
                                                            "{ref.observacoes}"
                                                        </div>
                                                    )}
                                                    {ref.anexo && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full mt-2 h-7 gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-[10px]"
                                                            onClick={() => {
                                                                setSelectedImage(ref.anexo!);
                                                                setImageViewerOpen(true);
                                                            }}
                                                        >
                                                            <ExternalLink className="h-3 w-3" />
                                                            VER ANEXO
                                                        </Button>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
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
