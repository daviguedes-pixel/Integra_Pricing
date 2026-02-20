
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PriceRequestStats } from "@/components/PriceRequestStats";
import { RequestsTableView } from "@/components/RequestsTableView";
import { toast } from "sonner";
import { Loader2, Filter, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import type { EnrichedPriceRequest, ProposalBatch } from "@/types";
import {
    appealPriceRequest,
    acceptSuggestedPrice,
    provideJustification,
    provideEvidence
} from "@/api/priceRequestsApi";

interface RequestFilters {
    status: string;
    product: string;
    station: string;
    client: string;
    search: string;
    startDate: string;
    endDate: string;
}

const defaultFilters: RequestFilters = {
    status: "all",
    product: "all",
    station: "all",
    client: "all",
    search: "",
    startDate: "",
    endDate: "",
};

interface RequestListProps {
    filterStatus?: string;
}

export function RequestList({ filterStatus }: RequestListProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [myRequests, setMyRequests] = useState<(EnrichedPriceRequest | ProposalBatch)[]>([]);
    const [filters, setFilters] = useState<RequestFilters>(defaultFilters);

    // Derive unique values for filter dropdowns
    const uniqueStations = useMemo(() => {
        const stationMap = new Map<string, string>();
        myRequests.forEach((r: any) => {
            if (r.type === 'batch') return;
            const name = r.stations?.name;
            const code = r.stations?.code || r.station_id;
            if (name && code) stationMap.set(String(code), String(name));
        });
        return Array.from(stationMap.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [myRequests]);

    const uniqueClients = useMemo(() => {
        const clientMap = new Map<string, string>();
        myRequests.forEach((r: any) => {
            if (r.type === 'batch') return;
            const name = r.clients?.name;
            const code = r.clients?.code || r.client_id;
            if (name && code) clientMap.set(String(code), String(name));
        });
        return Array.from(clientMap.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [myRequests]);

    const uniqueProducts = useMemo(() => {
        const products = new Set<string>();
        myRequests.forEach((r: any) => {
            if (r.type === 'batch') return;
            if (r.product) products.add(r.product);
        });
        return Array.from(products).sort();
    }, [myRequests]);

    // Apply filters to the requests list
    const filteredRequests = useMemo(() => {
        return myRequests.filter((r: any) => {
            const targetStatus = filterStatus || filters.status;

            if (r.type === 'batch') {
                // Apply Status Filter to Batch
                if (targetStatus !== 'all') {
                    // Start simple: If filtering by 'draft', only show batches that are PURELY drafts or contain drafts?
                    // Typically a batch is entire draft or entire pending.
                    // We check if at least one item matches the status, OR if all match.
                    // Let's assume strict filtering: if looking for drafts, show batches that ARE drafts.
                    const match = r.requests.some((req: any) => req.status === targetStatus);
                    if (!match) return false;
                }

                // Apply Search Filter to Batch
                if (filters.search) {
                    const searchLower = filters.search.toLowerCase();
                    const clientName = (r.client?.name || '').toLowerCase();
                    const batchName = (r.batch_name || '').toLowerCase();
                    const hasStation = r.requests.some((req: any) =>
                        (req.stations?.name || '').toLowerCase().includes(searchLower)
                    );

                    if (!clientName.includes(searchLower) && !batchName.includes(searchLower) && !hasStation) {
                        return false;
                    }
                }

                // Apply Client Filter
                if (filters.client !== 'all') {
                    // Check if batch has this client
                    const hasClient = r.clients.some((c: any) => String(c.code) === filters.client);
                    if (!hasClient) return false;
                }

                // Apply Station Filter
                if (filters.station !== 'all') {
                    const hasStation = r.requests.some((req: any) => {
                        const code = req.stations?.code || req.station_id;
                        return String(code) === filters.station;
                    });
                    if (!hasStation) return false;
                }

                return true;
            }

            // Status - Use prop if provided, otherwise Use state
            if (targetStatus !== 'all' && r.status !== targetStatus) return false;

            // Product
            if (filters.product !== 'all' && r.product !== filters.product) return false;

            // Station
            if (filters.station !== 'all') {
                const stationCode = r.stations?.code || r.station_id;
                if (String(stationCode) !== filters.station) return false;
            }

            // Client
            if (filters.client !== 'all') {
                const clientCode = r.clients?.code || r.client_id;
                if (String(clientCode) !== filters.client) return false;
            }

            // Search
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                const stationName = (r.stations?.name || '').toLowerCase();
                const clientName = (r.clients?.name || '').toLowerCase();
                const product = (r.product || '').toLowerCase();
                if (!stationName.includes(searchLower) && !clientName.includes(searchLower) && !product.includes(searchLower)) {
                    return false;
                }
            }

            // Date filters
            if (filters.startDate) {
                const requestDate = new Date(r.created_at).toISOString().split('T')[0];
                if (requestDate < filters.startDate) return false;
            }
            if (filters.endDate) {
                const requestDate = new Date(r.created_at).toISOString().split('T')[0];
                if (requestDate > filters.endDate) return false;
            }

            return true;
        });
    }, [myRequests, filters]);

    const hasActiveFilters = filters.status !== 'all' || filters.product !== 'all' || filters.station !== 'all' || filters.client !== 'all' || filters.search || filters.startDate || filters.endDate;

    const getProductLabel = (product: string) => {
        const labels: Record<string, string> = {
            's10': 'Diesel S-10',
            's10_aditivado': 'Diesel S-10 Aditivado',
            'diesel_s500': 'Diesel S-500',
            'diesel_s500_aditivado': 'Diesel S-500 Aditivado',
            'arla32_granel': 'Arla 32 Granel',
        };
        return labels[product] || product;
    };

    const handleFilterChange = (key: keyof RequestFilters, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const resetFilters = () => {
        setFilters(defaultFilters);
    };

    const loadMyRequests = async (useCache = true) => {
        if (!user) {
            console.log('⚠️ Usuário não encontrado no loadMyRequests');
            return;
        }

        try {
            // Verificar cache primeiro
            if (useCache) {
                const cacheKey = `price_request_my_requests_cache_${user.id}`;
                const cacheTimestampKey = `price_request_my_requests_cache_timestamp_${user.id}`;
                const cachedData = localStorage.getItem(cacheKey);
                const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
                const cacheExpiry = 5 * 60 * 1000; // 5 minutos

                if (cachedData && cacheTimestamp) {
                    const now = Date.now();
                    const timestamp = parseInt(cacheTimestamp, 10);

                    if (now - timestamp < cacheExpiry) {
                        console.log('📦 Usando dados do cache (minhas solicitações)');
                        const parsedData = JSON.parse(cachedData);
                        setMyRequests(parsedData);
                        setLoadingRequests(false);
                        return;
                    }
                }
            }

            setLoadingRequests(true);
            console.log('📋 Carregando minhas solicitações no PriceRequest...');
            const userId = String(user.id);
            const userEmail = user.email ? String(user.email) : null;

            // Buscar todas e filtrar no cliente (mais confiável)
            const { data: allData, error: allError } = await supabase
                .from('price_suggestions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1000);

            if (allError) {
                console.error('❌ Erro ao buscar solicitações:', allError);
                throw allError;
            }

            // Filtrar no cliente
            const data = (allData || []).filter((suggestion: any) => {
                const reqBy = String(suggestion.requested_by || '');
                const creBy = String(suggestion.created_by || '');
                return reqBy === userId || creBy === userId ||
                    (userEmail && (reqBy === userEmail || creBy === userEmail));
            }).slice(0, 50); // Limitar a 50 após filtrar

            // Carregar postos e clientes para enriquecer dados
            const ids = data.map((d: any) => d.id);
            const profileIds = Array.from(new Set(data.map((d: any) => d.current_approver_id).filter(Boolean)));

            const [stationsRes, clientsRes, appealsRes] = await Promise.all([
                supabase.rpc('get_sis_empresa_stations').then(res => ({ data: res.data, error: res.error })),
                supabase.from('clientes' as any).select('id_cliente, nome'),
                supabase.from('approval_history')
                    .select('suggestion_id')
                    .eq('action', 'appealed')
                    .in('suggestion_id', ids)
            ]);

            const profilesRes = await supabase
                .from('user_profiles')
                .select('user_id, nome, email')
                .in('user_id', profileIds);

            // Map profiles for quick lookup
            const profilesMap = new Map();
            profilesRes.data?.forEach((p: any) => {
                profilesMap.set(p.user_id, p.nome || p.email);
            });

            const appealedIds = new Set((appealsRes.data || []).map((h: any) => h.suggestion_id));

            const stationsWithLocation: Array<Record<string, unknown>> = (stationsRes.data || []).map((s: Record<string, unknown>) => ({
                ...s,
            }));

            // Enriquecer dados
            const enrichedData = (data || []).map((request: any) => {
                // Buscar múltiplos postos se station_ids existir, senão usar station_id
                const stations = [];
                const stationIds = request.station_ids && Array.isArray(request.station_ids)
                    ? request.station_ids
                    : (request.station_id ? [request.station_id] : []);

                stationIds.forEach((stationId: string) => {
                    if (stationId) {
                        const station = stationsWithLocation.find((s: any) => {
                            const sId = String(s.id || s.id_empresa || s.cnpj_cpf || '');
                            const reqId = String(stationId);
                            return sId === reqId || s.cnpj_cpf === reqId || s.id_empresa === reqId;
                        });
                        if (station) {
                            stations.push({
                                name: station.nome_empresa || station.name,
                                code: station.cnpj_cpf || station.id || station.id_empresa,
                                municipio: station.municipio,
                                uf: station.uf
                            });
                        }
                    }
                });

                // Manter compatibilidade: stations como primeiro posto ou null
                const firstStation = stations.length > 0 ? stations[0] : null;

                let client = null;
                if (request.client_id) {
                    client = (clientsRes.data as any)?.find((c: any) => {
                        const clientId = String(c.id_cliente || c.id || '');
                        const suggId = String(request.client_id);
                        return clientId === suggId;
                    });
                }

                const calculatedPrice = request.cost_price && request.margin_cents
                    ? request.cost_price + (request.margin_cents / 100)
                    : null;

                const finalSuggestedPrice = request.suggested_price ?? request.final_price ?? calculatedPrice;

                return {
                    ...request,
                    suggested_price: finalSuggestedPrice,
                    stations: firstStation, // Compatibilidade
                    stations_list: stations, // Lista completa de postos
                    clients: client ? { name: client.nome || client.name, code: String(client.id_cliente || client.id) } : null,
                    current_approver_name: request.current_approver_id
                        ? profilesMap.get(request.current_approver_id) || 'Sistema'
                        : null,
                    current_approver_id: request.current_approver_id,
                    has_appealed: appealedIds.has(request.id)
                };
            });

            // Agrupar solicitações por batch_id
            const groupedBatches = new Map<string, EnrichedPriceRequest[]>();

            enrichedData.forEach((request: any) => {
                if (request.batch_id) {
                    const batchKey = request.batch_id;
                    if (!groupedBatches.has(batchKey)) {
                        groupedBatches.set(batchKey, []);
                    }
                    groupedBatches.get(batchKey)!.push(request);
                } else {
                    // Fallback grouping logic
                    const dateKey = new Date(request.created_at).toISOString().split('T')[0];
                    const creatorKey = request.created_by || request.requested_by || 'unknown';
                    const timestamp = new Date(request.created_at).getTime();

                    let foundBatch = false;
                    for (const [existingKey, existingBatch] of groupedBatches.entries()) {
                        if (!existingKey.startsWith('individual_') && existingKey.includes('_')) {
                            const parts = existingKey.split('_');
                            if (parts.length >= 3) {
                                const existingDate = parts[0];
                                const existingCreator = parts[1];
                                const existingTimestampStr = parts.slice(2).join('_');
                                const existingTimestamp = parseInt(existingTimestampStr, 10);

                                if (existingDate === dateKey &&
                                    existingCreator === creatorKey &&
                                    !isNaN(existingTimestamp) &&
                                    Math.abs(timestamp - existingTimestamp) < 10000) {
                                    existingBatch.push(request);
                                    foundBatch = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (!foundBatch) {
                        const batchKey = `${dateKey}_${creatorKey}_${timestamp}`;
                        groupedBatches.set(batchKey, [request]);
                    }
                }
            });

            const batches: ProposalBatch[] = [];
            const individualRequests: EnrichedPriceRequest[] = [];

            const isUUID = (str: string): boolean => {
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                return uuidRegex.test(str);
            };

            const BATCH_MODE_DISABLED = false;

            groupedBatches.forEach((batch, batchKey) => {
                const isBatch = !BATCH_MODE_DISABLED && (isUUID(batchKey) || (!batchKey.startsWith('individual_') && batch.length > 1));

                if (isBatch) {
                    const uniqueClientsSet = new Set(batch.map((r) => r.client_id || 'unknown'));
                    const hasMultipleClients = uniqueClientsSet.size > 1;

                    batches.push({
                        type: 'batch',
                        batchKey,
                        requests: batch,
                        created_at: batch[0].created_at,
                        client: batch[0].clients,
                        clients: hasMultipleClients ? Array.from(uniqueClientsSet).map((cid: string) => {
                            const req = batch.find((r) => r.client_id === cid);
                            return req?.clients || { name: 'N/A' };
                        }) : [batch[0].clients],
                        hasMultipleClients,
                        created_by: batch[0].created_by || batch[0].requested_by,
                        batch_name: batch[0].batch_name || null
                    });
                } else {
                    batch.forEach((r) => individualRequests.push(r));
                }
            });

            const allRequests = [...batches, ...individualRequests].sort((a, b) => {
                const itemA = a as any;
                const itemB = b as any;
                const dateA = new Date(itemA.created_at || itemA.requests?.[0]?.created_at || 0).getTime();
                const dateB = new Date(itemB.created_at || itemB.requests?.[0]?.created_at || 0).getTime();
                return dateB - dateA;
            });

            setMyRequests(allRequests);

            // Salvar no cache
            const cacheKey = `price_request_my_requests_cache_${user.id}`;
            const cacheTimestampKey = `price_request_my_requests_cache_timestamp_${user.id}`;
            try {
                localStorage.setItem(cacheKey, JSON.stringify(allRequests));
                localStorage.setItem(cacheTimestampKey, Date.now().toString());
            } catch (cacheError) {
                console.warn('Erro ao salvar cache:', cacheError);
            }
        } catch (error: any) {
            console.error('❌ Erro ao carregar minhas solicitações:', error);
            toast.error("Erro ao carregar solicitações: " + (error?.message || 'Erro desconhecido'));
            setMyRequests([]);
        } finally {
            setLoadingRequests(false);
        }
    };

    const handleDeleteRequest = async (id: string) => {
        try {
            const { error } = await supabase
                .from('price_suggestions')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success("Solicitação excluída com sucesso");
            // Atualizar lista após exclusão
            loadMyRequests(false);
        } catch (error: any) {
            toast.error("Erro ao excluir solicitação: " + error.message);
        }
    };

    useEffect(() => {
        if (user) {
            loadMyRequests(true);
        }
    }, [user]);

    // Realtime updates
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('price_suggestions_realtime_list')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'price_suggestions',
                    filter: `requested_by=eq.${user.id}`
                },
                (payload) => {
                    console.log('🔄 Mudança detectada em price_suggestions:', payload.eventType);
                    const cacheKey = `price_request_my_requests_cache_${user.id}`;
                    localStorage.removeItem(cacheKey);
                    loadMyRequests(false);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    return (
        <div className="space-y-6">
            {loadingRequests && (
                <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
                    </div>
                </div>
            )}
            {!loadingRequests && (
                <>
                    {/* Stats */}
                    <PriceRequestStats
                        total={filteredRequests.length}
                        pending={filteredRequests.filter(r => (r as any).type !== 'batch' && ['pending', 'price_suggested', 'awaiting_justification', 'awaiting_evidence', 'appealed'].includes((r as any).status)).length}
                        approved={filteredRequests.filter(r => (r as any).type !== 'batch' && (r as any).status === 'approved').length}
                        rejected={filteredRequests.filter(r => (r as any).type !== 'batch' && (r as any).status === 'rejected').length}
                    />

                    {/* Filters & Actions Bar */}
                    <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm border">
                        <div className="flex items-center gap-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex items-center gap-2 border-slate-200 shadow-sm">
                                        <Filter className="h-4 w-4 text-slate-600" />
                                        <span className="font-medium">Filtros</span>
                                        {hasActiveFilters && (
                                            <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary border-none h-5 px-1.5 min-w-[20px] flex justify-center">
                                                !
                                            </Badge>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-6 shadow-xl border-slate-200" align="start">
                                    <div className="space-y-6">
                                        <h3 className="font-bold text-lg flex items-center gap-2 border-b pb-2">
                                            <Filter className="h-5 w-5 text-primary" />
                                            Filtros de Solicitação
                                        </h3>

                                        <div className="grid grid-cols-1 gap-6">
                                            {/* Status */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                    Status
                                                </label>
                                                <Select value={filters.status} onValueChange={(v) => handleFilterChange("status", v)}>
                                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                                        <SelectValue placeholder="Todos os status" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">Todos</SelectItem>
                                                        <SelectItem value="pending">Pendente</SelectItem>
                                                        <SelectItem value="approved">Aprovado</SelectItem>
                                                        <SelectItem value="rejected">Rejeitado</SelectItem>
                                                        <SelectItem value="price_suggested">Preço Sugerido</SelectItem>
                                                        <SelectItem value="awaiting_justification">Pedindo Justificativa</SelectItem>
                                                        <SelectItem value="awaiting_evidence">Pedindo Referência</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Produto */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                    Produto
                                                </label>
                                                <Select value={filters.product} onValueChange={(v) => handleFilterChange("product", v)}>
                                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                                        <SelectValue placeholder="Todos os produtos" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">Todos</SelectItem>
                                                        {uniqueProducts.map((p) => (
                                                            <SelectItem key={p} value={p}>{getProductLabel(p)}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Posto */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    Posto
                                                </label>
                                                <Select value={filters.station} onValueChange={(v) => handleFilterChange("station", v)}>
                                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                                        <SelectValue placeholder="Todos os postos" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">Todos</SelectItem>
                                                        {uniqueStations.map((s) => (
                                                            <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Cliente */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                    <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                                                    Cliente
                                                </label>
                                                <Select value={filters.client} onValueChange={(v) => handleFilterChange("client", v)}>
                                                    <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                                                        <SelectValue placeholder="Todos os clientes" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">Todos</SelectItem>
                                                        {uniqueClients.map((c) => (
                                                            <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {/* Buscar */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                    <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                                                    Buscar
                                                </label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                    <Input
                                                        placeholder="Buscar por posto, cliente..."
                                                        value={filters.search}
                                                        onChange={(e) => handleFilterChange("search", e.target.value)}
                                                        className="pl-10 bg-slate-50 border-slate-200"
                                                    />
                                                </div>
                                            </div>

                                            {/* Date Range */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                                        Data Início
                                                    </label>
                                                    <Input
                                                        type="date"
                                                        value={filters.startDate}
                                                        onChange={(e) => handleFilterChange("startDate", e.target.value)}
                                                        className="w-full bg-slate-50 border-slate-200"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-semibold flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                                        <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                                                        Data Fim
                                                    </label>
                                                    <Input
                                                        type="date"
                                                        value={filters.endDate}
                                                        onChange={(e) => handleFilterChange("endDate", e.target.value)}
                                                        className="w-full bg-slate-50 border-slate-200"
                                                        min={filters.startDate || undefined}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-4 border-t">
                                            <Button
                                                variant="ghost"
                                                className="flex-1 text-slate-500 text-sm hover:bg-slate-100"
                                                onClick={resetFilters}
                                            >
                                                Limpar Tudo
                                            </Button>
                                            <Button
                                                className="flex-1 shadow-md hover:shadow-lg transition-all"
                                                onClick={() => (document.activeElement as HTMLElement)?.blur()}
                                            >
                                                Aplicar Filtros
                                            </Button>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <div className="h-6 w-px bg-slate-200"></div>

                            <Badge variant="outline" className="h-7 px-3 bg-slate-50 text-slate-600 border-slate-200 font-medium">
                                {filteredRequests.length} Registros
                            </Badge>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                toast.info("Atualizando...");
                                loadMyRequests(false);
                            }}
                            disabled={loadingRequests}
                            className="flex items-center gap-2 h-9 px-4 hover:bg-slate-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${loadingRequests ? 'animate-spin' : ''}`} />
                            Atualizar
                        </Button>
                    </div>

                    {/* My Requests Table */}
                    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200">
                        <RequestsTableView
                            requests={filteredRequests}
                            onDelete={(id) => handleDeleteRequest(id)}
                            onView={(request) => navigate(`/solicitacao-preco/${request.id}`)}
                            onAcceptSuggestion={async (id) => {
                                try {
                                    await acceptSuggestedPrice(id);
                                    toast.success("Preço aceito com sucesso!");
                                    // Clear cache to force refresh
                                    const cacheKey = `price_request_my_requests_cache_${user?.id}`;
                                    localStorage.removeItem(cacheKey);
                                    localStorage.removeItem(`price_request_my_requests_cache_timestamp_${user?.id}`);
                                    loadMyRequests(false);
                                } catch (error) {
                                    console.error("Erro ao aceitar:", error);
                                    toast.error("Erro ao aceitar preço.");
                                }
                            }}
                            onAppeal={async (id, obs, price) => {
                                try {
                                    await appealPriceRequest(id, price, obs);
                                    toast.success("Recurso enviado com sucesso!");
                                    // Clear cache to force refresh
                                    const cacheKey = `price_request_my_requests_cache_${user?.id}`;
                                    localStorage.removeItem(cacheKey);
                                    localStorage.removeItem(`price_request_my_requests_cache_timestamp_${user?.id}`);
                                    loadMyRequests(false);
                                } catch (error) {
                                    console.error("Erro ao recorrer:", error);
                                    toast.error("Erro ao enviar recurso.");
                                }
                            }}
                            onProvideJustification={async (id, obs) => {
                                try {
                                    await provideJustification(id, obs);
                                    toast.success("Justificativa enviada!");
                                    loadMyRequests(false);
                                } catch (error) {
                                    console.error("Erro ao justificar:", error);
                                    toast.error("Erro ao enviar justificativa.");
                                }
                            }}
                            onProvideEvidence={async (id, obs, fileUrl) => {
                                try {
                                    await provideEvidence(id, fileUrl || "", obs);
                                    toast.success("Evidência enviada!");
                                    loadMyRequests(false);
                                } catch (error) {
                                    console.error("Erro ao enviar evidência:", error);
                                    toast.error("Erro ao enviar evidência.");
                                }
                            }}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
