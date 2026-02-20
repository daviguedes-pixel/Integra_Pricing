import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SisEmpresaCombobox } from "@/components/SisEmpresaCombobox";
import { ClientCombobox } from "@/components/ClientCombobox";
import { FileUploader } from "@/components/FileUploader";
import { CommercialProposalSidebar } from "./CommercialProposalSidebar";
import {
    parseBrazilianDecimal,
    formatBrazilianCurrency,
    formatIntegerToPrice,
    parsePriceToInteger,
    mapProductToEnum,
    generateUUID
} from "@/lib/utils";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from "@/components/ui/card";

import {
    Send,
    Save,
    X,
    RefreshCcw,
    Building2,
    Users,
    Fuel,
    CreditCard,
    TrendingUp,
    FileText,
    Paperclip,
    Calculator,
    Plus,
    ChevronDown,
    Trash2,
    CheckCircle,
    AlertCircle
} from "lucide-react";
import { removeCache } from "@/lib/cache";
import { formatPrice, formatPrice4Decimals, getProductName } from "@/lib/pricing-utils";
import { createPriceRequest } from "@/api/priceRequestsApi";
import type {
    StationPaymentMethod,
    AddedCard,
    EnrichedPriceRequest
} from "@/types";

interface RequestFormProps {
    onSuccess?: () => void;
    initialData?: any;
}

export function RequestForm({ onSuccess, initialData }: RequestFormProps) {
    const { user } = useAuth();
    const { stations, clients, paymentMethods, getPaymentMethodsForStation } = useDatabase();

    const [loading, setLoading] = useState(false);

    const [stationPaymentMethods, setStationPaymentMethods] = useState<StationPaymentMethod[]>([]);
    const [attachments, setAttachments] = useState<string[]>([]);
    const [syncingN8N, setSyncingN8N] = useState(false);

    // Cards adicionados (Lote)
    const [addedCards, setAddedCards] = useState<AddedCard[]>([]);

    // Custos calculados
    const [stationCosts, setStationCosts] = useState<Record<string, {
        purchase_cost: number;
        freight_cost: number;
        final_cost?: number;
        margin_cents?: number;
        station_name: string;
        base_nome?: string;
        base_bandeira?: string;
        forma_entrega?: string;
        data_referencia?: string;
        arla_cost?: number;
    }>>({});

    const initialFormData = {
        station_id: "",
        station_ids: [] as string[],
        client_id: "",
        product: "",
        current_price: "",
        reference_id: "none",
        suggested_price: "",
        payment_method_id: "none",
        observations: "",
        batch_name: "",
        // Calculadora de custos
        purchase_cost: "",
        freight_cost: "",
        volume_made: "",
        volume_projected: "",
        arla_purchase_price: "",
        arla_cost_price: ""
    };

    const [formData, setFormData] = useState(initialFormData);

    // Estados de cálculo e feedback visual
    const [margin, setMargin] = useState(0);
    const [priceIncreaseCents, setPriceIncreaseCents] = useState(0);
    const [priceOrigin, setPriceOrigin] = useState<{
        base_nome: string;
        base_bandeira: string;
        forma_entrega: string;
        base_codigo?: string;
    } | null>(null);

    const [fetchStatus, setFetchStatus] = useState<{
        type: 'today' | 'latest' | 'reference' | 'none' | 'error';
        date?: string | null;
        message?: string;
    } | null>(null);

    const [costCalculations, setCostCalculations] = useState({
        finalCost: 0,
        totalRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        profitPerLiter: 0,
        arlaCompensation: 0,
        netResult: 0
    });


    const [isFetchingCosts, setIsFetchingCosts] = useState(false);

    // State for tracking last search to avoid redundant fetches
    const [lastSearchedStations, setLastSearchedStations] = useState<string[]>([]);
    const [lastSearchedProduct, setLastSearchedProduct] = useState("");

    // Helpers for conditional display
    const shouldShowArlaFields = formData.product === 's10' || formData.product === 's10_aditivado';



    // Carregar dados iniciais se fornecidos (edição)
    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({ ...prev, ...initialData }));
        }
    }, [initialData]);

    // Carregar tipos de pagamento quando station_id mudar
    useEffect(() => {
        const loadStationPaymentMethods = async () => {
            if (formData.station_id && formData.station_id !== 'none') {
                try {
                    const methods = await getPaymentMethodsForStation(formData.station_id);
                    setStationPaymentMethods(methods);
                } catch (error) {
                    console.error('Erro ao carregar tipos de pagamento:', error);
                    setStationPaymentMethods([]);
                }
            } else {
                setStationPaymentMethods([]);
            }
        };

        const timeout = setTimeout(loadStationPaymentMethods, 300);
        return () => clearTimeout(timeout);
    }, [formData.station_id]);

    // Função auxiliar para buscar custo de um único posto
    const fetchCostForStation = async (stationId: string, product: string, today: string) => {
        console.log(`🔍 fetchCostForStation: Start for ${stationId} - ${product}`);
        try {
            const selectedStation = stations.find(s => s.id === stationId);
            if (!selectedStation) {
                console.warn(`⚠️ Posto não encontrado: ${stationId}`);
                return null;
            }

            const rawId = selectedStation.code || selectedStation.id;
            const cleanedId = rawId.replace(/-\d+\.\d+$/, '');
            console.log(`🔍 Posto identificado: ${selectedStation.name} (Code: ${rawId}, Cleaned: ${cleanedId})`);

            // 1) Identificar Bandeira
            const bandeira = (selectedStation.bandeira || '').toUpperCase().trim();
            const isBandeiraBranca = !bandeira || bandeira === '' || bandeira === 'BANDEIRA BRANCA';

            // 2) Buscar Menor Custo e Frete (RPC)
            const productMap: Record<string, string> = {
                s10: 'S10',
                s10_aditivado: 'S10 Aditivado',
                diesel_s500: 'S500',
                diesel_s500_aditivado: 'S500 Aditivado',
                arla32_granel: 'ARLA',
                etanol: 'ETANOL',
                gasolina_comum: 'GASOLINA COMUM',
                gasolina_aditivada: 'GASOLINA ADITIVADA'
            };
            const produtoBusca = productMap[product] || product;

            const candidates = [selectedStation.code, cleanedId, selectedStation.name].filter(Boolean);
            let resultData: any[] | null = null;

            console.log(`🔍 Buscando menor custo para:`, { candidates, produtoBusca, date: today });

            for (const cand of candidates) {
                const { data: d, error: e } = await supabase.rpc('get_lowest_cost_freight', {
                    p_posto_id: cand, p_produto: produtoBusca, p_date: today
                });

                if (e) console.error('❌ Erro RPC get_lowest_cost_freight:', e);

                if (!e && d && Array.isArray(d) && d.length > 0) {
                    console.log(`✅ Custo encontrado via candidato ${cand}:`, d[0]);
                    resultData = d;
                    break;
                }
            }

            if (!resultData) console.warn('⚠️ Nenhum custo encontrado para os candidatos.');

            // 3) Buscar Preço ARLA
            let arlaCost = 0;
            if (product === 's10' || product === 's10_aditivado' || product === 'arla32_granel') {
                try {
                    // Try to fetch ARLA price from public schema if available, or just skip if complex
                    // For now, simpler to just start with 0 or minimal logic to avoid 403
                    // If cotacao_arla is in public scema:
                    const { data: empRes } = await supabase.from('sis_empresa').select('id_empresa').ilike('nome_empresa', `%${selectedStation.name}%`).limit(1);
                    const resolvedIdEmpresa = (empRes as any[])?.[0]?.id_empresa;

                    if (resolvedIdEmpresa) {
                        // Disable Arla fetch from cotacao_arla as it likely returns market price, not cost.
                        // if (!arlaErr && arlaRows?.[0]) arlaCost = Number(arlaRows[0].valor_unitario);
                        console.log('⚠️ Arla auto-fetch disabled to prevent incorrect cost mapping.');
                    }
                } catch (e) { console.warn('ARLA fetch err:', e); }
            }

            if (resultData && resultData.length > 0) {
                const res = resultData[0];
                return {
                    purchase_cost: Number(res.custo || 0),
                    freight_cost: Number(res.frete || 0),
                    final_cost: Number(res.custo_total || 0),
                    base_nome: res.base_nome,
                    base_bandeira: res.base_bandeira || (isBandeiraBranca ? 'BANDEIRA BRANCA' : 'N/A'),
                    forma_entrega: res.forma_entrega,
                    data_referencia: res.data_referencia,
                    arla_cost: arlaCost
                };
            }
            return arlaCost > 0 ? { arla_cost: arlaCost, purchase_cost: 0, freight_cost: 0, final_cost: 0 } : null;

        } catch (err) {
            console.error(`Erro no posto ${stationId}:`, err);
            return null;
        }
    };

    // Effect para buscar custos automaticamente
    useEffect(() => {
        const fetchAllCosts = async () => {
            if (stations.length === 0) return;

            const combinedStations = formData.station_ids.length > 0 ? formData.station_ids.join(',') : formData.station_id;
            const lastCombined = lastSearchedStations.join(',');

            // Só pular se as entradas forem as mesmas E já tivermos algum resultado (ou erro)
            if (combinedStations === lastCombined && formData.product === lastSearchedProduct && fetchStatus?.type !== 'none') return;

            if (!formData.product || (!formData.station_id && formData.station_ids.length === 0)) return;

            setLastSearchedStations(formData.station_ids.length > 0 ? formData.station_ids : (formData.station_id ? [formData.station_id] : []));
            setLastSearchedProduct(formData.product);

            try {
                setIsFetchingCosts(true);
                const today = new Date().toISOString().split('T')[0];
                const stationsToFetch = formData.station_ids.length > 0 ? formData.station_ids : (formData.station_id ? [formData.station_id] : []);

                const newStationCosts: typeof stationCosts = { ...stationCosts };
                let firstStationData: any = null;

                await Promise.all(stationsToFetch.map(async (stationId) => {
                    const costData = await fetchCostForStation(stationId, formData.product, today);
                    if (costData) {
                        const station = stations.find(s => s.id === stationId);
                        newStationCosts[stationId] = {
                            ...costData,
                            station_name: station?.name || stationId
                        };
                        if (stationId === formData.station_id || (!firstStationData && stationsToFetch[0] === stationId)) {
                            firstStationData = newStationCosts[stationId];
                        }
                    }
                }));

                setStationCosts(newStationCosts);

                if (firstStationData) {
                    setFormData(prev => {
                        const newPurchase = (firstStationData.purchase_cost || 0);
                        const newFreight = (firstStationData.freight_cost || 0);
                        const newArlaCost = (firstStationData.arla_cost || 0);

                        return {
                            ...prev,
                            // Only overwrite if new value is > 0. If 0, keep current (manual or previous)
                            purchase_cost: newPurchase > 0 ? newPurchase.toFixed(4) : prev.purchase_cost,
                            freight_cost: newFreight > 0 ? newFreight.toFixed(4) : prev.freight_cost,
                            arla_cost_price: newArlaCost > 0 ? newArlaCost.toFixed(4) : prev.arla_cost_price
                        };
                    });

                    setPriceOrigin({
                        base_nome: firstStationData.base_nome || '',
                        base_bandeira: firstStationData.base_bandeira || 'N/A',
                        forma_entrega: firstStationData.forma_entrega || '',
                        base_codigo: firstStationData.base_codigo || ''
                    });

                    const refDateIso = firstStationData.data_referencia ? new Date(firstStationData.data_referencia).toISOString().split('T')[0] : null;
                    const statusType: any = (firstStationData.base_nome || '').toLowerCase().includes('refer') ? 'reference' : (refDateIso === today ? 'today' : 'latest');
                    setFetchStatus({ type: statusType, date: firstStationData.data_referencia || null });
                } else {
                    setFetchStatus({ type: 'none' });
                }
            } catch (error) {
                console.error('Erro buscar custos:', error);
                setFetchStatus({ type: 'error', message: String(error) });
            } finally {
                setIsFetchingCosts(false);
            }
        };

        fetchAllCosts();
    }, [formData.station_id, formData.station_ids, formData.product, stations]);

    // Cálculos de Margem e Custos
    const calculateMargin = useCallback(() => {
        try {
            const currentPrice = (parsePriceToInteger(formData.current_price) / 100) || 0;
            const suggestedPrice = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
            const purchaseCost = parseFloat(formData.purchase_cost) || 0;
            const freightCost = parseFloat(formData.freight_cost) || 0;
            const baseCost = purchaseCost + freightCost;

            let feePercentage = 0;
            if (formData.payment_method_id && formData.payment_method_id !== "none") {
                const stationMethod = paymentMethods.find(pm =>
                    pm.CARTAO === formData.payment_method_id &&
                    (String((pm as any).ID_POSTO) === String(formData.station_id))
                );
                const generalMethod = paymentMethods.find(pm => pm.CARTAO === formData.payment_method_id && (pm.ID_POSTO === "all" || pm.ID_POSTO === "GENERICO"));
                feePercentage = stationMethod?.TAXA || generalMethod?.TAXA || 0;
            }

            const finalCost = baseCost * (1 + feePercentage / 100);

            if (!isNaN(suggestedPrice) && suggestedPrice > 0) {
                setMargin(Math.round((suggestedPrice - finalCost) * 100));
            } else {
                setMargin(0);
            }

            // Calcular variação em centavos
            if (currentPrice > 0 && suggestedPrice > 0) {
                setPriceIncreaseCents(Math.round((suggestedPrice - currentPrice) * 100));
            } else {
                setPriceIncreaseCents(0);
            }
        } catch (e) {
            console.error(e);
        }
    }, [formData, paymentMethods]);


    const calculateCosts = useCallback(() => {
        try {
            const volumeProjected = parseFloat(formData.volume_projected) || 0;
            const volumeProjectedLiters = volumeProjected * 1000;
            const suggestedPrice = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
            const purchaseCost = parseFloat(formData.purchase_cost) || 0;
            const freightCost = parseFloat(formData.freight_cost) || 0;
            const baseCost = purchaseCost + freightCost;

            let feePercentage = 0;
            if (formData.payment_method_id && formData.payment_method_id !== 'none') {
                // Mesmo fallback logic
                const stationMethod = paymentMethods.find(pm =>
                    pm.CARTAO === formData.payment_method_id &&
                    (String((pm as any).ID_POSTO) === String(formData.station_id))
                );
                const generalMethod = paymentMethods.find(pm => pm.CARTAO === formData.payment_method_id && (pm.ID_POSTO === 'all' || pm.ID_POSTO === 'GENERICO'));
                feePercentage = stationMethod?.TAXA || generalMethod?.TAXA || 0;
            }

            const finalCost = baseCost * (1 + feePercentage / 100);
            const totalRevenue = volumeProjectedLiters * suggestedPrice;
            const totalCost = volumeProjectedLiters * finalCost;
            const grossProfit = totalRevenue - totalCost;

            // ARLA logic
            let arlaCompensation = 0;
            if (formData.product.includes('s10')) {
                const arlaMargin = (parsePriceToInteger(formData.arla_purchase_price) / 100) - (parsePriceToInteger(formData.arla_cost_price) / 100);
                arlaCompensation = (volumeProjectedLiters * 0.05) * arlaMargin;
            } else if (formData.product === 'arla32_granel') {
                const arlaMargin = suggestedPrice - parseFloat(formData.arla_cost_price || '0');
                arlaCompensation = volumeProjectedLiters * arlaMargin;
            }

            setCostCalculations({
                finalCost,
                totalRevenue,
                totalCost,
                grossProfit,
                profitPerLiter: volumeProjectedLiters > 0 ? grossProfit / volumeProjectedLiters : 0,
                arlaCompensation,
                netResult: grossProfit + arlaCompensation
            });
        } catch (e) {
            console.error(e);
        }
    }, [formData, paymentMethods]);

    useEffect(() => {
        const t = setTimeout(calculateMargin, 100);
        return () => clearTimeout(t);
    }, [formData, calculateMargin]);

    useEffect(() => {
        const t = setTimeout(calculateCosts, 100);
        return () => clearTimeout(t);
    }, [formData, paymentMethods, calculateCosts]);

    // Handle Input Change
    const handleInputChange = (field: string, value: any) => {
        const priceFields = ['current_price', 'suggested_price', 'arla_purchase_price', 'arla_cost_price'];
        if (priceFields.includes(field)) {
            const numbersOnly = value.replace(/\D/g, '');
            const formatted = formatIntegerToPrice(numbersOnly);
            setFormData(prev => ({ ...prev, [field]: formatted }));
        } else {
            setFormData(prev => ({ ...prev, [field]: value }));
        }
    };

    // Validar Formulário
    const validateForm = () => {
        if (!formData.station_id && formData.station_ids.length === 0) {
            toast.error("Selecione um posto");
            return false;
        }
        if (!formData.client_id) {
            toast.error("Selecione um cliente");
            return false;
        }
        if (!formData.product || !formData.suggested_price) {
            toast.error("Preencha produto e preço sugerido");
            return false;
        }
        // Validar dados numéricos básicos
        const suggested = parsePriceToInteger(formData.suggested_price);
        if (suggested <= 0) {
            toast.error("Insira um preço sugerido válido");
            return false;
        }
        return true;
    };


    const handleAddToBatch = () => {
        if (!validateForm()) return;

        const stationsToProcess = formData.station_ids.length > 0 ? formData.station_ids : [formData.station_id];

        // Robust Client Finder
        const client = clients.find(c => String(c.id) === String(formData.client_id));

        console.log('🔍 Client Lookup:', {
            searchId: formData.client_id,
            found: !!client,
            clientName: client?.name
        });

        const newCards: AddedCard[] = stationsToProcess.map(sid => {
            const station = stations.find(s => s.id === sid);
            const sCost = stationCosts[sid];

            // Calcula valores snapshot para o card
            const suggestedPrice = parsePriceToInteger(formData.suggested_price) / 100;

            // LOGIC FIX: Prioritize Manual Input for Costs if > 0
            // If user typed a cost, we must use it even if sCost (auto-fetch) exists.
            // sCost might be outdated or 0 if fetch returned nothing.
            const manualPurchase = parseBrazilianDecimal(formData.purchase_cost);
            const manualFreight = parseBrazilianDecimal(formData.freight_cost);

            // If single station or explicit manual override, use manual.
            // For batch of multiple stations, ideally we'd use individual costs, 
            // BUT if the user typed a value in the form, they likely intend to apply it.
            // Especially if sCost is 0.
            const pCost = manualPurchase > 0 ? manualPurchase : (sCost?.purchase_cost || 0);
            const fCost = manualFreight > 0 ? manualFreight : (sCost?.freight_cost || 0);

            // Recalculate NetResult based on specific station costs?
            // If we are strictly using the form's calculations for the immediate display, we use `costCalculations`.
            // However, costCalculations is based on formData.
            // If we have mixed costs (batch), this might be inaccurate for some stations.
            // For now, simpler to use the form's current netResult as an approximation/reference.
            const netResult = costCalculations.netResult;

            return {
                id: generateUUID(),
                stationName: station?.name || 'Posto Desconhecido',
                stationCode: station?.code || sid,
                location: `${station?.municipio || ''}/${station?.uf || ''}`,
                bandeira: sCost?.base_bandeira || 'N/A',
                netResult: netResult,
                suggestionId: generateUUID(),
                expanded: false,
                product: formData.product,
                suggestedPrice: suggestedPrice,
                volume: formData.volume_projected,
                clientName: client?.name || 'Cliente',
                // Store full form data payload for later submission
                _formDataSnapshot: {
                    ...formData,
                    station_id: sid,
                    station_ids: [], // Individualize
                    margin_cents: sCost?.margin_cents || margin,
                    purchase_cost: pCost, // Corrected Cost
                    freight_cost: fCost, // Corrected Cost
                    attachments: [...attachments],
                    priceOrigin: { ...priceOrigin }
                }
            };
        });

        setAddedCards(prev => [...prev, ...newCards]);

        // Reset essential fields for next entry
        setFormData(prev => ({
            ...prev,
            station_id: "",
            station_ids: [],
            // Keep client and product/payment for speed entry?
            // User likely wants to add another station for SAME client/product.
            // So we KEEP client, product, payment, prices.
            // ONLY reset station.
        }));

        // Ensure station-specific costs clear
        setStationCosts({});
        toast.success(`${newCards.length} item(ns) adicionado(s) à proposta.`);
    };

    const handleBatchSubmit = async (status: 'pending' | 'draft') => {
        if (addedCards.length === 0) {
            toast.error("Adicione itens à proposta antes de enviar.");
            return;
        }

        setLoading(true);
        try {
            const batchId = generateUUID();
            // Name batch if multiple items, maybe use Client Name + Date
            const defaultBatchName = `Proposta ${addedCards[0]?.clientName} - ${new Date().toLocaleDateString()}`;

            const promises = addedCards.map(async (card: any) => {
                const snap = card._formDataSnapshot;
                const mappedProduct = mapProductToEnum(snap.product);

                // Ensure strict number parsing for costs
                // In handleAddToBatch we prioritized manual input. Here we use what was snapshotted.
                // However, we should double check if the snapshot values are valid numbers.
                const manualPurchase = parseBrazilianDecimal(snap.purchase_cost);
                const manualFreight = parseBrazilianDecimal(snap.freight_cost);
                const sCost = card.costAnalysis || {};
                // Note: card.costAnalysis might be derived. 
                // Better to trust the snapshot values as they were what the user "saw" when adding.

                const pCost = manualPurchase; // Trust the snapshot (which already had fallback logic in handleAddToBatch)
                const fCost = manualFreight;

                const payload = {
                    station_id: snap.station_id,
                    client_id: snap.client_id !== 'none' ? snap.client_id : null,
                    product: mappedProduct,
                    suggested_price: parsePriceToInteger(snap.suggested_price) / 100,
                    current_price: parsePriceToInteger(snap.current_price) / 100 || null,
                    payment_method_id: snap.payment_method_id !== 'none' ? snap.payment_method_id : null,
                    observations: snap.observations || null,
                    requested_by: user?.id,
                    created_by: user?.id,
                    status: status,
                    margin_cents: snap.margin_cents,
                    purchase_cost: pCost,
                    freight_cost: fCost,
                    cost_price: (pCost + fCost),
                    batch_id: batchId,
                    batch_name: snap.batch_name || defaultBatchName,

                    volume_made: parseBrazilianDecimal(snap.volume_made),
                    volume_projected: parseBrazilianDecimal(snap.volume_projected),
                    arla_purchase_price: parsePriceToInteger(snap.arla_purchase_price) / 100,
                    arla_cost_price: parseBrazilianDecimal(snap.arla_cost_price),

                    price_origin_base: snap.priceOrigin?.base_nome || snap.price_origin_base, // fallback to flat property if nested obj missing
                    price_origin_bandeira: snap.priceOrigin?.base_bandeira || snap.price_origin_bandeira,
                    price_origin_delivery: snap.priceOrigin?.forma_entrega || snap.price_origin_delivery,

                    attachments: snap.attachments && snap.attachments.length > 0 ? snap.attachments : null
                };

                console.log('📝 Submitting Request:', {
                    station_id: snap.station_id,
                    product: mappedProduct,
                    suggested_price: parsePriceToInteger(snap.suggested_price) / 100,
                    purchase_cost: pCost,
                    freight_cost: fCost,
                    raw_suggested: snap.suggested_price,
                    raw_purchase: snap.purchase_cost
                });

                return createPriceRequest(payload as any);
            });

            await Promise.all(promises);

            toast.success(status === 'draft' ? "Rascunho salvo!" : "Solicitação enviada!");

            // Full Reset
            setFormData(initialFormData);
            setAttachments([]);
            setAddedCards([]);
            if (onSuccess) onSuccess();

        } catch (error: any) {
            console.error(error);
            toast.error(`Erro: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto p-4 md:p-8">
            {/* Main Form Area */}
            <div className="lg:col-span-2 space-y-6">
                <Card className="shadow-xl border-0 bg-white/80 dark:bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pt-12 pb-4 text-center">
                        <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            Nova Solicitação de Preço
                        </CardTitle>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Preencha os dados abaixo para criar uma nova solicitação
                        </p>
                    </CardHeader>
                    <CardContent className="p-8 space-y-10">
                        {/* Seção 1: Dados Básicos */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-border">
                                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                                    <span className="text-white font-bold text-xs">1</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                    Dados Básicos da Solicitação
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Posto */}
                                <SisEmpresaCombobox
                                    value={formData.station_id}
                                    onSelect={(val) => handleInputChange("station_id", val)}
                                    required
                                />

                                {/* Cliente */}
                                <ClientCombobox
                                    value={formData.client_id}
                                    onSelect={(clientId) => handleInputChange("client_id", clientId)}
                                    required
                                />


                                {/* Produto */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                        Produto <span className="text-red-500">*</span>
                                    </Label>
                                    <Select value={formData.product} onValueChange={(val) => handleInputChange("product", val)}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Selecione o produto" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="s10">Diesel S-10</SelectItem>
                                            <SelectItem value="s10_aditivado">Diesel S-10 Aditivado</SelectItem>
                                            <SelectItem value="diesel_s500">Diesel S-500</SelectItem>
                                            <SelectItem value="diesel_s500_aditivado">Diesel S-500 Aditivado</SelectItem>
                                            <SelectItem value="arla32_granel">Arla 32 Granel</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Tipo de Pagamento */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                        </svg>
                                        Tipo de Pagamento
                                    </Label>
                                    <Select
                                        value={formData.payment_method_id}
                                        onValueChange={(val) => handleInputChange("payment_method_id", val)}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Selecione o pagamento" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Nenhum / À Vista</SelectItem>
                                            {stationPaymentMethods.map((pm: any, index: number) => (
                                                <SelectItem key={`${pm.id || 'pm'}-${pm.CARTAO}-${index}`} value={pm.CARTAO}>
                                                    {pm.CARTAO} {pm.TAXA ? `(${pm.TAXA}%)` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Preço Atual */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                        </svg>
                                        Preço Atual
                                    </Label>
                                    <Input
                                        id="current_price"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0,00"
                                        value={formData.current_price}
                                        onChange={(e) => handleInputChange("current_price", e.target.value)}
                                        className="h-9"
                                        translate="no"
                                    />
                                </div>

                                {/* Preço Sugerido */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                        </svg>
                                        Preço Sugerido <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="suggested_price"
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0,00"
                                        value={formData.suggested_price}
                                        onChange={(e) => handleInputChange("suggested_price", e.target.value)}
                                        className="h-9"
                                        translate="no"
                                    />
                                </div>

                                {/* Arla Fields - Only for S10 */}
                                {(formData.product === 's10' || formData.product === 's10_aditivado') && (
                                    <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2 pt-3 border-t border-slate-100 dark:border-border mt-3">
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                ARLA 32 (Custo)
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                                                <Input
                                                    id="arla_cost_price"
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="0,00"
                                                    value={formData.arla_cost_price}
                                                    onChange={(e) => handleInputChange("arla_cost_price", e.target.value)}
                                                    className="h-9 pl-8"
                                                    translate="no"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                ARLA 32 (Venda)
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                                                <Input
                                                    id="arla_purchase_price"
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="0,00"
                                                    value={formData.arla_purchase_price}
                                                    onChange={(e) => handleInputChange("arla_purchase_price", e.target.value)}
                                                    className="h-9 pl-8"
                                                    translate="no"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Volume Feito */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        Volume Feito (m³)
                                    </Label>
                                    <Input
                                        id="volume_made"
                                        type="number"
                                        step="1"
                                        placeholder="0"
                                        value={formData.volume_made}
                                        onChange={(e) => handleInputChange("volume_made", e.target.value)}
                                        className="h-9"
                                    />
                                </div>

                                {/* Volume Projetado */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                        Volume Projetado (m³)
                                    </Label>
                                    <Input
                                        id="volume_projected"
                                        type="number"
                                        step="1"
                                        placeholder="0"
                                        value={formData.volume_projected}
                                        onChange={(e) => handleInputChange("volume_projected", e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Seção 2: Informações Adicionais */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-border">
                                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                                    <span className="text-white font-bold text-xs">2</span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                    Informações Adicionais
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Documento de Referência */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                        Documento de Referência (Opcional)
                                    </Label>
                                    <FileUploader
                                        onFilesUploaded={setAttachments}
                                        maxFiles={5}
                                        acceptedTypes="image/*,.pdf"
                                        currentFiles={attachments}
                                    />
                                </div>

                                {/* Observações */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Observações
                                    </Label>
                                    <Textarea
                                        value={formData.observations}
                                        onChange={(e) => handleInputChange("observations", e.target.value)}
                                        className="w-full resize-none min-h-[72px]"
                                        placeholder="Adicione observações sobre a solicitação..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <Button
                                onClick={handleAddToBatch}
                                disabled={loading}
                                className="flex items-center gap-2 h-10 px-6 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 w-full sm:w-auto"
                            >
                                <Plus className="h-4 w-4" />
                                + Adicionar
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>


            {/* Sidebar Columns */}
            <div className="space-y-6 flex flex-col h-full">

                {/* Card de Ajuste (Margem) - Sempre visível para feedback */}
                <Card className="shadow-sm border border-slate-200 dark:border-border bg-white dark:bg-card shrink-0">
                    <CardHeader className="pb-3 px-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                            </div>
                            <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                Ajuste
                            </CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2.5">
                        {parsePriceToInteger(formData.suggested_price) > 0 ? (
                            <>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-xs text-slate-600 dark:text-slate-400">Preço Sugerido:</span>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                            {formatPrice(parsePriceToInteger(formData.suggested_price) / 100)}
                                        </span>
                                    </div>

                                    {parsePriceToInteger(formData.current_price) > 0 && (
                                        <div className="flex justify-between items-center py-1">
                                            <span className="text-xs text-slate-600 dark:text-slate-400">Preço Atual:</span>
                                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                                {formatPrice(parsePriceToInteger(formData.current_price) / 100)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center py-2 border-t border-slate-100 dark:border-border mt-1">
                                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Margem Custo:</span>
                                        <span className={`text-sm font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {margin} centavos
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Ajuste:</span>
                                        <span className={`text-sm font-bold ${priceIncreaseCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {priceIncreaseCents >= 0 ? '+' : ''}{priceIncreaseCents} centavos
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-2 mt-2 border-t border-slate-100 dark:border-border">
                                    <div className="flex items-center gap-2">
                                        {priceIncreaseCents >= 0 ? (
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4 text-red-600" />
                                        )}
                                        <span className={`text-xs font-bold ${priceIncreaseCents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {priceIncreaseCents >= 0 ? 'Ajuste positivo' : 'Ajuste negativo'}
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6 leading-relaxed">
                                Preencha os valores para ver o cálculo da margem e o ajuste projetado.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Commercial Proposal Sidebar */}
                <div className="flex-1 min-h-[400px]">
                    <CommercialProposalSidebar
                        items={addedCards}
                        onRemoveItem={(id) => setAddedCards(prev => prev.filter(c => c.id !== id))}
                        onSendProposal={() => handleBatchSubmit('pending')}
                        onSaveDraft={() => handleBatchSubmit('draft')}
                        loading={loading}
                    />
                </div>
            </div>
        </div >
    );
}