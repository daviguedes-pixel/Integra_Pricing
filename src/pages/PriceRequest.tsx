import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SisEmpresaCombobox } from "@/components/SisEmpresaCombobox";

import { ClientCombobox } from "@/components/ClientCombobox";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { FileUploader } from "@/components/FileUploader";
import { ApprovalDetailsModal } from "@/components/ApprovalDetailsModal";
import { EditRequestModal } from "@/components/EditRequestModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parseBrazilianDecimal, formatBrazilianCurrency, formatIntegerToPrice, parsePriceToInteger, generateUUID, mapProductToEnum, formatNameFromEmail, createNotificationForUsers } from "@/lib/utils";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { ProposalFullView } from "@/components/ProposalFullView";
import { PriceRequestStats } from "@/components/PriceRequestStats";
import { toast } from "sonner";
import { ArrowLeft, Send, Save, TrendingUp, BarChart, CheckCircle, AlertCircle, Eye, DollarSign, Clock, Check, X, FileText, ChevronDown, Plus, Download, Maximize2, Loader2, Edit, Trash2, RefreshCcw, Fuel } from "lucide-react";
import { removeCache } from "@/lib/cache";
import { IntegraLogo } from "@/components/IntegraLogo";
import { SaoRoqueLogo } from "@/components/SaoRoqueLogo";
import { useNavigate } from "react-router-dom";
import type {
  StationPaymentMethod,
  EnrichedPriceRequest,
  ProposalBatch,
  ProposalItem,
  AddedCard,
  StationCost,
  FetchStatus,
  PriceOrigin,
  CostAnalysis,
} from "@/types";
import { formatPrice, formatPrice4Decimals, getProductName } from "@/lib/pricing-utils";

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
  stations?: { name: string; code: string };
  clients?: { name: string; code: string };
  payment_methods?: { name: string };
}

// Product labels moved to getProductName in @/lib/pricing-utils


export default function PriceRequest() {
  // Animações visíveis mas performáticas
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04, // Stagger visível
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.25
      }
    },
    hover: {
      scale: 1.01,
      y: -2,
      transition: { duration: 0.15 }
    },
    tap: {
      scale: 0.98
    }
  };

  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = usePermissions();
  const { stations, clients, paymentMethods, loading: dbLoadingHook, getPaymentMethodsForStation } = useDatabase();

  const [loading, setLoading] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [references, setReferences] = useState<Reference[]>([]);
  const [savedSuggestion, setSavedSuggestion] = useState<EnrichedPriceRequest | null>(null);
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [stationPaymentMethods, setStationPaymentMethods] = useState<StationPaymentMethod[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("my-requests");
  const [myRequests, setMyRequests] = useState<ProposalItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<EnrichedPriceRequest | null>(null);
  const [showRequestDetails, setShowRequestDetails] = useState(false);
  const [expandedProposal, setExpandedProposal] = useState<string | null>(null);
  const [batchName, setBatchName] = useState<string>('');
  const [editingRequest, setEditingRequest] = useState<EnrichedPriceRequest | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  // Estado para controlar abertura de modais de anexos por card
  const [openAttachmentModals, setOpenAttachmentModals] = useState<Record<string, number | null>>({});

  const [syncingN8N, setSyncingN8N] = useState(false);

  // Função para acionar fluxo n8n
  const handleN8NSync = async () => {
    try {
      setSyncingN8N(true);
      const loadingToast = toast.loading("Executando sincronização no n8n... Aguarde a conclusão.");

      // Buscar usuário atual de forma segura
      const currentUserEmail = user?.email;
      let currentUserName = user?.user_metadata?.nome || 'Usuário';

      // Chamar a Edge Function do Supabase (atua como proxy para evitar erros de Mixed Content e SSL)
      const { data, error } = await supabase.functions.invoke('sync-n8n', {
        body: {
          action: 'sync_costs',
          requested_by: currentUserName,
          user_email: currentUserEmail,
          timestamp: new Date().toISOString()
        }
      });

      toast.dismiss(loadingToast);

      if (!error) {
        let responseDetails = "";
        if (data && data.message) responseDetails = `: ${data.message}`;
        else if (typeof data === 'string' && data.length > 0) responseDetails = `: ${data}`;

        toast.success(`Sincronização concluída com sucesso${responseDetails}!`, {
          duration: 5000,
        });

        // Atualizar custos após sincronização
        removeCache('price_request_stations_cache');
      } else {
        throw new Error(error.message || 'Erro ao chamar função de sincronização');
      }
    } catch (error: any) {
      console.error('Erro ao acionar n8n:', error);
      toast.error(`Falha ao iniciar sincronização: ${error.message}`);
    } finally {
      setSyncingN8N(false);
    }
  };

  // Cards adicionados (Resultados Individuais por Posto)
  const [addedCards, setAddedCards] = useState<AddedCard[]>([]);;

  // Custos e cálculos por posto (quando múltiplos postos são selecionados)
  const [stationCosts, setStationCosts] = useState<Record<string, {
    purchase_cost: number;
    freight_cost: number;
    final_cost?: number;
    margin_cents?: number;
    station_name: string;
    total_revenue?: number;
    total_cost?: number;
    gross_profit?: number;
    profit_per_liter?: number;
    arla_compensation?: number;
    net_result?: number;
    feePercentage?: number;
    base_nome?: string;
    base_bandeira?: string;
    forma_entrega?: string;
    data_referencia?: string;
    arla_cost?: number;
  }>>({});

  const initialFormData = {
    station_id: "", // Mantido para compatibilidade
    station_ids: [] as string[], // Array de IDs de postos
    client_id: "",
    product: "",
    current_price: "",
    reference_id: "none",
    suggested_price: "",
    payment_method_id: "none",
    observations: "",
    attachments: [] as string[],
    // Calculadora de custos
    purchase_cost: "",
    freight_cost: "",
    volume_made: "",
    volume_projected: "",
    arla_purchase_price: "",
    arla_cost_price: "" // Preço de COMPRA do ARLA (cotação)
  };
  const [formData, setFormData] = useState(initialFormData);

  // Carregar tipos de pagamento específicos do posto quando station_id mudar
  useEffect(() => {
    const loadStationPaymentMethods = async () => {
      if (formData.station_id && formData.station_id !== 'none') {
        try {
          const methods = await getPaymentMethodsForStation(formData.station_id);
          setStationPaymentMethods(methods);
        } catch (error) {
          console.error('Erro ao carregar tipos de pagamento do posto:', error);
          setStationPaymentMethods([]);
        }
      } else {
        setStationPaymentMethods([]);
      }
    };

    // Debounce para evitar múltiplas requisições
    const timeout = setTimeout(() => {
      loadStationPaymentMethods();
    }, 300);

    return () => clearTimeout(timeout);
  }, [formData.station_id]);

  // Log para debug - DESABILITADO para reduzir requisições
  // useEffect(() => {
  //   console.log('📦 Dados carregados:', { 
  //     stations: stations.length,
  //     clients: clients.length,
  //     paymentMethods: paymentMethods.length,
  //     stationPaymentMethods: stationPaymentMethods.length,
  //     dbLoading: dbLoadingHook
  //   });
  // }, [stations, clients, paymentMethods, stationPaymentMethods, dbLoadingHook]);

  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [margin, setMargin] = useState(0);
  const [priceIncreaseCents, setPriceIncreaseCents] = useState(0);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [costCalculations, setCostCalculations] = useState({
    finalCost: 0,
    totalRevenue: 0,
    totalCost: 0,
    grossProfit: 0,
    profitPerLiter: 0,
    arlaCompensation: 0,
    netResult: 0
  });

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

  // Load my requests
  useEffect(() => {
    if (activeTab === 'my-requests' && user) {
      loadMyRequests(true); // Usar cache por padrão
    }
  }, [activeTab, user]);

  // Tempo real para atualizar quando houver mudanças
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('price_suggestions_realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'price_suggestions',
          filter: `requested_by=eq.${user.id}`
        },
        (payload) => {
          console.log('🔄 Mudança detectada em price_suggestions:', payload.eventType);
          // Invalidar cache e recarregar
          const cacheKey = `price_request_my_requests_cache_${user.id}`;
          localStorage.removeItem(cacheKey);
          if (activeTab === 'my-requests') {
            loadMyRequests(false); // Recarregar sem cache
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeTab]);

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
      const [stationsRes, clientsRes] = await Promise.all([
        supabase.rpc('get_sis_empresa_stations').then(res => ({ data: res.data, error: res.error })),
        supabase.from('clientes' as any).select('id_cliente, nome')
      ]);

      // Buscar informações completas dos postos (incluindo cidade/UF)
      // Nota: A tabela sis_empresa está no schema cotacao, não public
      // Como não temos acesso direto, vamos pular essa busca para evitar erros 400
      // Os dados já vêm da função RPC get_sis_empresa_stations
      const stationsWithLocation: Array<Record<string, unknown>> = (stationsRes.data || []).map((s: Record<string, unknown>) => ({
        ...s,
        // Município e UF podem ser adicionados posteriormente se necessário
        // Por enquanto, usamos apenas os dados da RPC
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

        return {
          ...request,
          stations: firstStation, // Compatibilidade
          stations_list: stations, // Lista completa de postos
          clients: client ? { name: client.nome || client.name, code: String(client.id_cliente || client.id) } : null
        };
      });

      // Agrupar solicitações por batch_id - solicitações com o mesmo batch_id foram criadas juntas
      // Se não tem batch_id, tentar agrupar por data/criador/timestamp próximo (compatibilidade com dados antigos)
      const groupedBatches = new Map<string, EnrichedPriceRequest[]>();

      enrichedData.forEach((request: any) => {
        // Se tem batch_id, agrupar por batch_id
        if (request.batch_id) {
          const batchKey = request.batch_id;
          if (!groupedBatches.has(batchKey)) {
            groupedBatches.set(batchKey, []);
          }
          groupedBatches.get(batchKey)!.push(request);
        } else {
          // Se não tem batch_id, tentar agrupar por data/criador/timestamp próximo (fallback)
          // Isso garante compatibilidade com solicitações criadas antes da migração
          const dateKey = new Date(request.created_at).toISOString().split('T')[0];
          const creatorKey = request.created_by || request.requested_by || 'unknown';
          const timestamp = new Date(request.created_at).getTime();

          // Procurar se há um lote existente sem batch_id com timestamp muito próximo (dentro de 10 segundos)
          let foundBatch = false;
          for (const [existingKey, existingBatch] of groupedBatches.entries()) {
            // Se a chave não começa com "individual_" e não é um UUID válido, é um lote sem batch_id
            if (!existingKey.startsWith('individual_') && existingKey.includes('_')) {
              const parts = existingKey.split('_');
              if (parts.length >= 3) {
                const existingDate = parts[0];
                const existingCreator = parts[1];
                const existingTimestampStr = parts.slice(2).join('_');
                const existingTimestamp = parseInt(existingTimestampStr, 10);

                // Se for mesmo dia, mesmo criador e timestamp muito próximo (dentro de 10 segundos)
                if (existingDate === dateKey &&
                  existingCreator === creatorKey &&
                  !isNaN(existingTimestamp) &&
                  Math.abs(timestamp - existingTimestamp) < 10000) { // 10 segundos
                  existingBatch.push(request);
                  foundBatch = true;
                  break;
                }
              }
            }
          }

          if (!foundBatch) {
            // Criar novo grupo sem batch_id (usando data_criador_timestamp como chave)
            const batchKey = `${dateKey}_${creatorKey}_${timestamp}`;
            groupedBatches.set(batchKey, [request]);
          }
        }
      });

      // Agrupar lotes para visualização de proposta comercial
      const batches: ProposalBatch[] = [];
      const individualRequests: EnrichedPriceRequest[] = [];

      // Função auxiliar para verificar se é UUID válido
      const isUUID = (str: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      groupedBatches.forEach((batch, batchKey) => {
        // REGRA CLARA:
        // - Se tem batch_id (UUID válido) → SEMPRE é lote (mesmo com 1 solicitação)
        // - Se não tem batch_id mas foi agrupado por timestamp → é lote se tiver mais de 1
        // - Se começa com "individual_" → é individual
        const isBatch = isUUID(batchKey) || (!batchKey.startsWith('individual_') && batch.length > 1);

        if (isBatch) {
          // É um lote - adicionar como proposta comercial
          // Pegar o primeiro cliente para exibição (ou todos se diferentes)
          const uniqueClients = new Set(batch.map((r) => r.client_id || 'unknown'));
          const hasMultipleClients = uniqueClients.size > 1;

          batches.push({
            type: 'batch',
            batchKey,
            requests: batch,
            created_at: batch[0].created_at,
            client: batch[0].clients, // Primeiro cliente para exibição
            clients: hasMultipleClients ? Array.from(uniqueClients).map((cid: string) => {
              const req = batch.find((r) => r.client_id === cid);
              return req?.clients || { name: 'N/A' };
            }) : [batch[0].clients],
            hasMultipleClients,
            created_by: batch[0].created_by || batch[0].requested_by,
            batch_name: batch[0].batch_name || null // Nome do lote (se houver)
          });
        } else {
          // Solicitação individual - adicionar às individuais
          batch.forEach((r) => individualRequests.push(r));
        }
      });

      // Combinar lotes e solicitações individuais, ordenar por data
      const allRequests = [...batches, ...individualRequests].sort((a, b) => {
        const dateA = new Date(a.created_at || a.requests?.[0]?.created_at || 0).getTime();
        const dateB = new Date(b.created_at || b.requests?.[0]?.created_at || 0).getTime();
        return dateB - dateA;
      });

      setMyRequests(allRequests);
      console.log('✅ Solicitações carregadas:', allRequests.length, 'Lotes:', batches.length);

      // Salvar no cache
      const cacheKey = `price_request_my_requests_cache_${user.id}`;
      const cacheTimestampKey = `price_request_my_requests_cache_timestamp_${user.id}`;
      try {
        localStorage.setItem(cacheKey, JSON.stringify(allRequests));
        localStorage.setItem(cacheTimestampKey, Date.now().toString());
        console.log('💾 Dados salvos no cache (minhas solicitações)');
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

  // Load references when component mounts (com cache e tempo real)
  useEffect(() => {
    loadReferences(true); // Usar cache por padrão

    // Tempo real para atualizar quando houver mudanças
    const channel = supabase
      .channel('referencias-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'referencias'
      }, () => {
        console.log('🔄 Mudança detectada em referências');
        localStorage.removeItem('price_request_references_cache');
        loadReferences(false); // Recarregar sem cache
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'price_suggestions',
        filter: 'status=eq.approved'
      }, () => {
        console.log('🔄 Preço aprovado detectado');
        localStorage.removeItem('price_request_references_cache');
        loadReferences(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-fill lowest cost + freight when station and product are selected
  const [lastSearchedStations, setLastSearchedStations] = useState<string[]>([]);
  const [lastSearchedProduct, setLastSearchedProduct] = useState<string>('');
  const [isFetchingCosts, setIsFetchingCosts] = useState(false);

  // Função auxiliar para buscar custo de um único posto
  const fetchCostForStation = async (stationId: string, product: string, today: string) => {
    try {
      console.log(`🔍 Buscando custos para posto ${stationId}...`);
      const selectedStation = stations.find(s => s.id === stationId);
      if (!selectedStation) return null;

      const rawId = selectedStation.code || selectedStation.id;
      const cleanedId = rawId.replace(/-\d+\.\d+$/, '');

      // 1) Identificar Bandeira do Posto
      let isBandeiraBranca = false;
      try {
        const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
        if (cot) {
          const { data: empresaInfo } = await cot
            .from('sis_empresa')
            .select('bandeira')
            .or(`nome_empresa.ilike.%${selectedStation.name}%,cnpj_cpf.eq.${cleanedId},cnpj_cpf.eq.${rawId}`)
            .limit(1)
            .maybeSingle();
          if (empresaInfo) {
            const b = (empresaInfo.bandeira || '').toUpperCase().trim();
            isBandeiraBranca = !b || b === '' || b === 'BANDEIRA BRANCA';
          }
        }
      } catch (err) { console.warn('Bandeira err:', err); }

      // 2) Buscar Menor Custo e Frete (RPC)
      const productMap: Record<string, string> = {
        s10: 'S10', s10_aditivado: 'S10 Aditivado',
        diesel_s500: 'S500', diesel_s500_aditivado: 'S500 Aditivado',
        arla32_granel: 'ARLA'
      };
      const produtoBusca = productMap[product] || product;

      let resultData: any[] | null = null;
      const candidates = [selectedStation.code, cleanedId, selectedStation.name].filter(Boolean);

      for (const cand of candidates) {
        const { data: d, error: e } = await supabase.rpc('get_lowest_cost_freight', {
          p_posto_id: cand, p_produto: produtoBusca, p_date: today
        });
        if (!e && d && Array.isArray(d) && d.length > 0) {
          resultData = d;
          break;
        }
      }

      // 3) Buscar Preço ARLA (se for S10, S10 Aditivado ou ARLA)
      let arlaCost = 0;
      if (product === 's10' || product === 's10_aditivado' || product === 'arla32_granel') {
        try {
          const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
          if (cot) {
            const { data: empRes } = await cot.from('sis_empresa').select('id_empresa').ilike('nome_empresa', `%${selectedStation.name}%`).limit(1);
            const resolvedIdEmpresa = (empRes as any[])?.[0]?.id_empresa;
            if (resolvedIdEmpresa) {
              const { data: arlaRows } = await cot.from('cotacao_arla').select('valor_unitario').eq('id_empresa', resolvedIdEmpresa).order('data_cotacao', { ascending: false }).limit(1);
              if (arlaRows?.[0]) arlaCost = Number(arlaRows[0].valor_unitario);
            }
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

  useEffect(() => {
    const fetchAllCosts = async () => {
      console.log('🚀 ===== INICIANDO BUSCA DE CUSTO =====');
      console.log('🚀 station_id:', formData.station_id);
      console.log('🚀 station_ids:', formData.station_ids);
      console.log('🚀 product:', formData.product);

      // Só buscar se houver mudança relevante
      const combinedStations = formData.station_ids.length > 0 ? formData.station_ids.join(',') : formData.station_id;
      const lastCombined = lastSearchedStations.join(',');

      if (combinedStations === lastCombined && formData.product === lastSearchedProduct) {
        console.log('⏭️ Pulando busca - mesmos postos e produto');
        return;
      }

      if (!formData.product || (!formData.station_id && formData.station_ids.length === 0)) {
        console.log('⏭️ Pulando busca - falta posto ou produto');
        return;
      }

      // Atualizar referências de busca
      setLastSearchedStations(formData.station_ids.length > 0 ? formData.station_ids : (formData.station_id ? [formData.station_id] : []));
      setLastSearchedProduct(formData.product);

      try {
        setIsFetchingCosts(true);
        const today = new Date().toISOString().split('T')[0];

        // Determinar quais postos buscar
        const stationsToFetch = formData.station_id ? [formData.station_id] : [];

        console.log('🔍 Postos a buscar custos:', stationsToFetch);

        const newStationCosts: typeof stationCosts = { ...stationCosts };
        let firstStationData: any = null;

        // Buscar custos para cada posto em paralelo
        await Promise.all(stationsToFetch.map(async (stationId) => {
          const costData = await fetchCostForStation(stationId, formData.product, today);
          if (costData) {
            const station = stations.find(s => s.id === stationId);

            // Tentar resolver bandeira do posto se não veio do costData
            let baseBandeira = costData.base_bandeira;
            if (!baseBandeira || baseBandeira === 'N/A') {
              const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
              if (cot && station) {
                const { data: emp } = await cot.from('sis_empresa').select('bandeira').eq('cnpj_cpf', station.code || station.id).maybeSingle();
                if (emp?.bandeira) baseBandeira = emp.bandeira;
              }
            }

            newStationCosts[stationId] = {
              ...costData,
              station_name: station?.name || stationId,
              base_bandeira: baseBandeira
            };

            if (stationId === formData.station_id || (!firstStationData && stationsToFetch[0] === stationId)) {
              firstStationData = newStationCosts[stationId];
            }
          }
        }));

        setStationCosts(newStationCosts);

        // Se encontrou dados para o posto principal (ou o primeiro da lista), auto-preencher formData
        if (firstStationData) {
          console.log('✅ Auto-preenchendo formData com dados do posto:', firstStationData.station_name);
          setFormData(prev => ({
            ...prev,
            purchase_cost: (firstStationData.purchase_cost || 0).toFixed(4),
            freight_cost: (firstStationData.freight_cost || 0).toFixed(4),
            arla_cost_price: (firstStationData.arla_cost || 0).toFixed(4)
          }));

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
        console.error('❌ Erro inesperado ao buscar custos:', error);
        setFetchStatus({ type: 'none' });
      } finally {
        setIsFetchingCosts(false);
      }
    };

    fetchAllCosts();
  }, [formData.station_id, formData.station_ids, formData.product, stations]);

  // Remover o useEffect antigo que estava duplicado e tinha o nome errado
  /*
  useEffect(() => {
    const fetchAllCosts = async () => {
        const today = new Date().toISOString().split('T')[0];
        console.log('📅 Data de hoje:', today);

        // Get the posto_id from the selected station
        const selectedStation = stations.find(s => s.id === formData.station_id);
        if (!selectedStation) {
          console.log('⚠️ Estação não encontrada');
          return;
        }

        const rawId = selectedStation.code || selectedStation.id;
        const cleanedId = rawId.replace(/-\d+\.\d+$/, '');

        // Verificar se o posto é bandeira branca
        let isBandeiraBranca = false;
        try {
          const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
          if (cot) {
            const { data: empresaInfo } = await cot
              .from('sis_empresa')
              .select('bandeira, nome_empresa')
              .or(`nome_empresa.ilike.%${selectedStation.name}%,cnpj_cpf.eq.${cleanedId},cnpj_cpf.eq.${rawId}`)
              .limit(1)
              .maybeSingle();

            if (empresaInfo) {
              const bandeiraUpper = (empresaInfo.bandeira || '').toUpperCase().trim();
              isBandeiraBranca = !bandeiraUpper || bandeiraUpper === '' || bandeiraUpper === 'BANDEIRA BRANCA';
              console.log('🏢 Bandeira do posto:', empresaInfo.bandeira, '| É branca?', isBandeiraBranca);
            }
          }
        } catch (err) {
          console.warn('⚠️ Erro ao verificar bandeira do posto:', err);
        }

        // Mapear produto para termos usados na base de cotação
        const productMap: Record<string, string> = {
          s10: 'S10',
          s10_aditivado: 'S10 Aditivado',
          diesel_s500: 'S500',
          diesel_s500_aditivado: 'S500 Aditivado',
          arla32_granel: 'ARLA'
        };
        const produtoBusca = productMap[formData.product] || formData.product;

        // Candidatos para identificar o posto na função (prioriza CNPJ/código)
        const candidates: string[] = [];
        if (selectedStation.code) candidates.push(selectedStation.code);
        if (cleanedId && !candidates.includes(cleanedId)) candidates.push(cleanedId);
        if (selectedStation.name && !candidates.includes(selectedStation.name)) candidates.push(selectedStation.name);

        // Tentar resolver CNPJ via public.sis_empresa quando não tivermos código
        try {
          if (!selectedStation.code && selectedStation.name) {
            const { data: se } = await supabase
              .from('sis_empresa' as any)
              .select('cnpj_cpf,nome_empresa')
              .ilike('nome_empresa', `%${selectedStation.name}%`)
              .limit(1);
            const seArr = (se as any[]) || [];
            const seRow = seArr[0] || null;
            if (seRow?.cnpj_cpf && !candidates.includes(seRow.cnpj_cpf)) {
              candidates.unshift(seRow.cnpj_cpf);
            }
          }
        } catch (_e) { }

        // Tentar a função RPC com múltiplos candidatos
        let resultData: any[] | null = null;
        for (const cand of candidates) {
          const { data: d, error: e } = await supabase
            .rpc('get_lowest_cost_freight', {
              p_posto_id: cand,
              p_produto: produtoBusca,
              p_date: today
            });

          if (!e && d && Array.isArray(d) && d.length > 0) {
            resultData = d;
            // A bandeira agora vem diretamente da função SQL (base_bandeira)
            // Se não veio, buscar diretamente da tabela base_fornecedor
            if (!resultData[0]?.base_bandeira || resultData[0].base_bandeira === '' || resultData[0].base_bandeira === 'N/A') {
              if (resultData[0]?.base_id) {
                try {
                  console.log('🔍 Buscando bandeira diretamente da tabela base_fornecedor para base_id:', resultData[0].base_id);
                  const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
                  if (cot) {
                    const { data: baseInfo, error: baseError } = await cot
                      .from('base_fornecedor')
                      .select('bandeira, nome')
                      .eq('id_base_fornecedor', resultData[0].base_id)
                      .maybeSingle();

                    console.log('🔍 Resultado da busca na base_fornecedor:', { baseInfo, baseError });

                    if (!baseError && baseInfo) {
                      if (baseInfo.bandeira && baseInfo.bandeira.trim() !== '') {
                        const bandeiraUpper = baseInfo.bandeira.trim().toUpperCase();
                        // Se for bandeira branca, usar "BANDEIRA BRANCA"
                        if (bandeiraUpper === 'BANDEIRA BRANCA' || bandeiraUpper === '' || !bandeiraUpper) {
                          resultData[0].base_bandeira = 'BANDEIRA BRANCA';
                        } else {
                          resultData[0].base_bandeira = baseInfo.bandeira.trim();
                        }
                        console.log('✅ Bandeira encontrada na tabela:', resultData[0].base_bandeira);
                      } else if (isBandeiraBranca) {
                        // Se o posto é bandeira branca e a base não tem bandeira, usar "BANDEIRA BRANCA"
                        resultData[0].base_bandeira = 'BANDEIRA BRANCA';
                        console.log('✅ Posto é bandeira branca, usando BANDEIRA BRANCA');
                      } else if (baseInfo.nome) {
                        // Tentar extrair do nome
                        console.log('🔍 Bandeira vazia, tentando extrair do nome:', baseInfo.nome);
                        const nomeUpper = (baseInfo.nome || '').toUpperCase();
                        const bandeiras = [
                          { nome: 'VIBRA', patterns: ['VIBRA'] },
                          { nome: 'IPIRANGA', patterns: ['IPIRANGA', 'IPP'] },
                          { nome: 'RAÍZEN', patterns: ['RAIZEN', 'RAÍZEN'] },
                          { nome: 'PETROBRAS', patterns: ['PETROBRAS', 'BR ', ' BR', 'BR-', 'PETRO', 'BRASILIA'] },
                          { nome: 'SHELL', patterns: ['SHELL'] },
                          { nome: 'COOP', patterns: ['COOP'] },
                          { nome: 'UNO', patterns: ['UNO'] },
                          { nome: 'ATEM', patterns: ['ATEM'] },
                          { nome: 'ALE', patterns: ['ALE'] }
                        ];

                        for (const bandeiraItem of bandeiras) {
                          for (const pattern of bandeiraItem.patterns) {
                            if (nomeUpper.includes(pattern)) {
                              resultData[0].base_bandeira = bandeiraItem.nome;
                              console.log('✅ Bandeira extraída do nome:', resultData[0].base_bandeira);
                              break;
                            }
                          }
                          if (resultData[0].base_bandeira && resultData[0].base_bandeira !== 'N/A') break;
                        }
                      }
                    }
                  }
                } catch (err) {
                  console.warn('⚠️ Erro ao buscar bandeira da tabela:', err);
                }
              }

              // Se ainda não encontrou, verificar se é bandeira branca
              if (!resultData[0].base_bandeira || resultData[0].base_bandeira === '' || resultData[0].base_bandeira === 'N/A') {
                if (isBandeiraBranca) {
                  resultData[0].base_bandeira = 'BANDEIRA BRANCA';
                  console.log('✅ Posto é bandeira branca, usando BANDEIRA BRANCA');
                } else if (resultData[0]?.base_nome) {
                  console.log('🔍 Tentando extrair bandeira do nome:', resultData[0].base_nome);
                  const nomeUpper = (resultData[0].base_nome || '').toUpperCase();
                  const bandeiras = [
                    { nome: 'VIBRA', patterns: ['VIBRA'] },
                    { nome: 'IPIRANGA', patterns: ['IPIRANGA', 'IPP'] },
                    { nome: 'RAÍZEN', patterns: ['RAIZEN', 'RAÍZEN'] },
                    { nome: 'PETROBRAS', patterns: ['PETROBRAS', 'BR ', ' BR', 'BR-', 'PETRO', 'BRASILIA'] },
                    { nome: 'SHELL', patterns: ['SHELL'] },
                    { nome: 'COOP', patterns: ['COOP'] },
                    { nome: 'UNO', patterns: ['UNO'] },
                    { nome: 'ATEM', patterns: ['ATEM'] },
                    { nome: 'ALE', patterns: ['ALE'] }
                  ];

                  for (const bandeiraItem of bandeiras) {
                    for (const pattern of bandeiraItem.patterns) {
                      if (nomeUpper.includes(pattern)) {
                        resultData[0].base_bandeira = bandeiraItem.nome;
                        console.log('✅ Bandeira extraída do nome (fallback):', resultData[0].base_bandeira);
                        break;
                      }
                    }
                    if (resultData[0].base_bandeira && resultData[0].base_bandeira !== 'N/A') break;
                  }
                }

                if (!resultData[0].base_bandeira || resultData[0].base_bandeira === '') {
                  resultData[0].base_bandeira = 'N/A';
                  console.log('⚠️ Bandeira não encontrada, usando N/A');
                }
              }
            }
            break;
          }
        }

        // Fallback 1: buscar direto na schema cotacao (mais recente do geral + frete)
        let resultError: any = null;
        if (!resultData) {
          try {
            const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
            if (cot) {
              // 1) IDs do produto (ex.: S10)
              const { data: gci } = await cot
                .from('grupo_codigo_item')
                .select('id_grupo_codigo_item,nome,descricao')
                .ilike('nome', `%${produtoBusca}%`)
                .limit(20);
              const ids = (gci as any[])?.map((r: any) => r.id_grupo_codigo_item) || [];

              if (ids.length > 0) {
                // 2) Última data disponível
                const { data: maxRows } = await cot
                  .from('cotacao_geral_combustivel')
                  .select('data_cotacao')
                  .in('id_grupo_codigo_item', ids)
                  .order('data_cotacao', { ascending: false })
                  .limit(1);
                const lastDateStr = maxRows?.[0]?.data_cotacao as string | undefined;
                console.log('🗓️ Última data geral:', lastDateStr);

                // 3) Resolver id_empresa do posto
                const { data: emp } = await cot
                  .from('sis_empresa')
                  .select('id_empresa,nome_empresa,cnpj_cpf')
                  .ilike('nome_empresa', `%${selectedStation.name}%`)
                  .limit(1);
                const idEmpresa = (emp as any[])?.[0]?.id_empresa as number | undefined;
                console.log('🏢 Empresa resolvida:', { idEmpresa, nome: (emp as any[])?.[0]?.nome_empresa });

                if (lastDateStr) {
                  const start = new Date(lastDateStr);
                  const end = new Date(start);
                  end.setDate(end.getDate() + 1);
                  const startIso = start.toISOString();
                  const endIso = end.toISOString();

                  // 4) Cotações do dia mais recente para o produto
                  const { data: cg } = await cot
                    .from('cotacao_geral_combustivel')
                    .select('id_base_fornecedor,valor_unitario,desconto_valor,forma_entrega,data_cotacao')
                    .in('id_grupo_codigo_item', ids)
                    .gte('data_cotacao', startIso)
                    .lt('data_cotacao', endIso);

                  const baseIds = Array.from(new Set((cg as any[])?.map((r: any) => r.id_base_fornecedor) || []));

                  // 5) Fretes ativos para a empresa e bases
                  let freteMap = new Map<number, number>();
                  if (idEmpresa && baseIds.length > 0) {
                    const { data: fretes } = await cot
                      .from('frete_empresa')
                      .select('id_base_fornecedor,frete_real,frete_atual,registro_ativo')
                      .eq('id_empresa', idEmpresa)
                      .in('id_base_fornecedor', baseIds)
                      .eq('registro_ativo', true);
                    (fretes as any[])?.forEach((f: any) => {
                      freteMap.set(f.id_base_fornecedor, Number(f.frete_real ?? f.frete_atual ?? 0));
                    });
                  }

                  // 6) Info de base com bandeira
                  let baseInfo = new Map<number, { nome: string; codigo: string; uf: string; bandeira?: string }>();
                  if (baseIds.length > 0) {
                    const { data: bases } = await cot
                      .from('base_fornecedor')
                      .select('id_base_fornecedor,nome,codigo_base,uf,bandeira')
                      .in('id_base_fornecedor', baseIds);

                    console.log('🏢 Bases encontradas:', bases);

                    (bases as any[])?.forEach((b: any) => {
                      baseInfo.set(b.id_base_fornecedor, {
                        nome: b.nome,
                        codigo: b.codigo_base,
                        uf: String(b.uf || ''),
                        bandeira: b.bandeira || null
                      });
                    });
                  }

                  // Função para extrair bandeira do nome se não vier da tabela
                  const extractBandeira = (nome: string, bandeira?: string | null): string => {
                    // Se vier bandeira da tabela, usar direto (normalizar para maiúsculas)
                    if (bandeira && bandeira.trim() !== '') {
                      const bandeiraUpper = bandeira.trim().toUpperCase();
                      // Normalizar variações comuns
                      if (bandeiraUpper.includes('IPIRANGA') || bandeiraUpper.includes('IPP')) {
                        return 'IPIRANGA';
                      }
                      if (bandeiraUpper.includes('RAIZEN') || bandeiraUpper.includes('RAÍZEN')) {
                        return 'RAÍZEN';
                      }
                      if (bandeiraUpper.includes('PETROBRAS') || bandeiraUpper.includes('BR ')) {
                        return 'PETROBRAS';
                      }
                      return bandeiraUpper;
                    }

                    // Tentar extrair do nome da base
                    const nomeUpper = nome.toUpperCase();
                    const bandeiras = [
                      { nome: 'VIBRA', patterns: ['VIBRA'] },
                      { nome: 'IPIRANGA', patterns: ['IPIRANGA', 'IPP', 'IPIRANGA'] },
                      { nome: 'RAÍZEN', patterns: ['RAIZEN', 'RAÍZEN'] },
                      { nome: 'PETROBRAS', patterns: ['PETROBRAS', 'BR ', ' BR', 'BR-', 'PETRO'] },
                      { nome: 'SHELL', patterns: ['SHELL'] },
                      { nome: 'COOP', patterns: ['COOP'] },
                      { nome: 'UNO', patterns: ['UNO'] },
                      { nome: 'ATEM', patterns: ['ATEM'] },
                      { nome: 'ALE', patterns: ['ALE'] }
                    ];

                    for (const bandeiraItem of bandeiras) {
                      for (const pattern of bandeiraItem.patterns) {
                        if (nomeUpper.includes(pattern)) {
                          return bandeiraItem.nome;
                        }
                      }
                    }

                    return 'N/A';
                  };

                  // 7) Calcular menor custo total (aplica frete quando FOB)
                  let best: any = null;
                  (cg as any[])?.forEach((row: any) => {
                    const custo = Number(row.valor_unitario) - Number(row.desconto_valor || 0);
                    const frete = row.forma_entrega === 'FOB' ? (freteMap.get(row.id_base_fornecedor) || 0) : 0;
                    const total = custo + frete;
                    const info = baseInfo.get(row.id_base_fornecedor) || { nome: 'Base', codigo: String(row.id_base_fornecedor), uf: '' };
                    if (!best || total < best.custo_total) {
                      best = {
                        base_codigo: info.codigo,
                        base_id: String(row.id_base_fornecedor),
                        base_nome: info.nome,
                        base_uf: info.uf,
                        base_bandeira: extractBandeira(info.nome, info.bandeira),
                        custo,
                        frete,
                        custo_total: total,
                        forma_entrega: row.forma_entrega,
                        data_referencia: row.data_cotacao
                      };
                    }
                  });

                  if (best) {
                    resultData = [best];
                    const dataRef = best.data_referencia
                      ? new Date(best.data_referencia).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                      : 'N/A';
                    console.log('✅ Fallback cotacao encontrou melhor custo:', {
                      base_id: best.base_id,
                      base_nome: best.base_nome,
                      base_codigo: best.base_codigo,
                      base_uf: best.base_uf,
                      base_bandeira: best.base_bandeira || 'N/A',
                      forma_entrega: best.forma_entrega,
                      data_referencia: dataRef,
                      data_referencia_raw: best.data_referencia,
                      custo: best.custo.toFixed(4),
                      frete: best.frete.toFixed(4),
                      custo_total: best.custo_total.toFixed(4),
                      produto: produtoBusca
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.log('⚠️ Erro no fallback cotacao:', (e as any)?.message || e);
          }
        }

        // Fallback 2: última referência manual compatível
        if (!resultData) {
          const { data: ref } = await supabase
            .from('referencias' as any)
            .select('preco_referencia, created_at, posto_id, produto')
            .ilike('posto_id', `%${selectedStation.name}%`)
            .ilike('produto', `%${produtoBusca}%`)
            .order('created_at', { ascending: false })
            .limit(1);
          const refArr = (ref as any[]) || [];
          if (refArr.length > 0) {
            const dataRef = refArr[0].created_at
              ? new Date(refArr[0].created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
              : 'N/A';

            resultData = [{
              base_codigo: refArr[0].posto_id,
              base_id: refArr[0].posto_id,
              base_nome: 'Referência',
              base_uf: '',
              base_bandeira: 'N/A',
              custo: Number(refArr[0].preco_referencia),
              frete: 0,
              custo_total: Number(refArr[0].preco_referencia),
              forma_entrega: 'FOB',
              data_referencia: refArr[0].created_at
            }];

            console.log('✅ Referência manual encontrada:', {
              base_nome: 'Referência',
              base_codigo: refArr[0].posto_id,
              base_bandeira: 'N/A',
              forma_entrega: 'FOB',
              data_referencia: dataRef,
              data_referencia_raw: refArr[0].created_at,
              custo: Number(refArr[0].preco_referencia).toFixed(4),
              frete: '0.0000',
              custo_total: Number(refArr[0].preco_referencia).toFixed(4),
              produto: produtoBusca
            });
          }
        }

        const data = resultData;
        const error = null;

        console.log('📊 ===== RESPOSTA DA FUNÇÃO (COM FALLBACK) =====');
        console.log('📊 data:', data);
        console.log('📊 error:', error);
        console.log('📊 data é array?', Array.isArray(data));
        console.log('📊 data.length:', data?.length);
        if (data && Array.isArray(data) && data.length > 0) {
          console.log('📊 Primeiro item:', data[0]);
        }

        if (error) {
          console.error('❌ Erro ao buscar menor custo:', error);
          toast.error(`Erro ao buscar cotação: ${error.message || error}`);
          setFetchStatus({ type: 'error', message: String(error.message || error) });
          return;
        }

        if (data && Array.isArray(data) && data.length > 0) {
          console.log('✅ ===== PROCESSANDO RESULTADO =====');
          const result = data[0];
          console.log('✅ result completo:', result);

          const custo = Number(result.custo || 0);
          const frete = Number(result.frete || 0);
          const custoTotal = Number(result.custo_total || 0);

          console.log('💰 Valores numéricos:', { custo, frete, custoTotal });

          // Formatar data para exibição
          const dataReferencia = result.data_referencia
            ? new Date(result.data_referencia).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })
            : 'N/A';

          console.log('📅 Data formatada:', dataReferencia);
          console.log('📅 Data raw:', result.data_referencia);

          // Verificar se a bandeira veio vazia e tentar extrair do nome
          let bandeiraFinal = result.base_bandeira || '';
          console.log('🚩 Bandeira original do banco:', bandeiraFinal);

          // Normalizar bandeira branca
          if (bandeiraFinal) {
            const bandeiraUpper = bandeiraFinal.toUpperCase().trim();
            if (bandeiraUpper === '' || bandeiraUpper === 'BANDEIRA BRANCA') {
              bandeiraFinal = 'BANDEIRA BRANCA';
              console.log('🚩 Bandeira normalizada para BANDEIRA BRANCA');
            }
          }

          if (!bandeiraFinal || bandeiraFinal === '' || bandeiraFinal === 'N/A') {
            // Verificar se o posto é bandeira branca
            let isBandeiraBranca = false;
            try {
              const selectedStation = stations.find(s => s.id === formData.station_id);
              if (selectedStation) {
                const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
                if (cot) {
                  const { data: empresaInfo } = await cot
                    .from('sis_empresa')
                    .select('bandeira')
                    .ilike('nome_empresa', `%${selectedStation.name}%`)
                    .limit(1)
                    .maybeSingle();

                  if (empresaInfo) {
                    const bandeiraUpper = (empresaInfo.bandeira || '').toUpperCase().trim();
                    isBandeiraBranca = !bandeiraUpper || bandeiraUpper === '' || bandeiraUpper === 'BANDEIRA BRANCA';
                  }
                }
              }
            } catch (err) {
              console.warn('⚠️ Erro ao verificar bandeira do posto:', err);
            }

            // Se não veio bandeira do banco, tentar usar o que veio da procedure (que agora retorna bandeira correta)
            // A procedure já faz a verificação de bandeira branca vs bandeirada

            if (!bandeiraFinal && result.base_bandeira) {
              bandeiraFinal = result.base_bandeira;
            }

            // Se ainda assim não tiver bandeira, usar base_nome para tentativa final (apenas display)
            if (!bandeiraFinal || bandeiraFinal === 'N/A') {
              const nomeUpper = (result.base_nome || '').toUpperCase();
              if (nomeUpper.includes('BRANCA')) {
                bandeiraFinal = 'BANDEIRA BRANCA';
              }
            }
          }

          // Log detalhado com todas as informações
          console.log('✅ ===== RESULTADO FINAL =====');
          console.log('✅ base_id:', result.base_id);
          console.log('✅ base_nome:', result.base_nome || 'N/A');
          console.log('✅ base_codigo:', result.base_codigo || 'N/A');
          console.log('✅ base_uf:', result.base_uf || 'N/A');
          console.log('✅ base_bandeira:', bandeiraFinal);
          console.log('✅ forma_entrega:', result.forma_entrega || 'N/A');
          console.log('✅ data_referencia:', dataReferencia);
          console.log('✅ data_referencia_raw:', result.data_referencia);
          console.log('✅ custo:', custo.toFixed(4));
          console.log('✅ frete:', frete.toFixed(4));
          console.log('✅ custo_total:', custoTotal.toFixed(4));
          console.log('✅ produto:', formData.product);

          // Log como objeto também
          console.log('✅ Resultado completo (objeto):', {
            base_id: result.base_id,
            base_nome: result.base_nome || 'N/A',
            base_codigo: result.base_codigo || 'N/A',
            base_uf: result.base_uf || 'N/A',
            base_bandeira: bandeiraFinal,
            forma_entrega: result.forma_entrega || 'N/A',
            data_referencia: dataReferencia,
            data_referencia_raw: result.data_referencia,
            custo: custo.toFixed(4),
            frete: frete.toFixed(4),
            custo_total: custoTotal.toFixed(4),
            produto: formData.product
          });

          console.log('💰 Valores convertidos:', {
            custo: custo.toFixed(4),
            frete: frete.toFixed(4),
            custoTotal: custoTotal.toFixed(4)
          });

          if (custoTotal > 0) {
            setFormData(prev => ({
              ...prev,
              purchase_cost: Math.max(custo, 0).toFixed(4),
              freight_cost: Math.max(frete, 0).toFixed(4)
            }));

            // Armazenar informações sobre a origem do preço
            setPriceOrigin({
              base_nome: result.base_nome || '',
              base_bandeira: result.base_bandeira || result.base_bandeira || 'N/A',
              forma_entrega: result.forma_entrega || '',
              base_codigo: result.base_codigo || ''
            });

            const refDateIso = result.data_referencia ? new Date(result.data_referencia).toISOString().split('T')[0] : null;
            const isReference = (result.base_nome || '').toLowerCase().includes('refer');
            const statusType: 'today' | 'latest' | 'reference' = isReference ? 'reference' : (refDateIso === today ? 'today' : 'latest');
            setFetchStatus({ type: statusType, date: result.data_referencia || null });

            // Remover toasts para não incomodar
            // if (frete > 0) {
            //   toast.success(`Menor custo+frete encontrado: R$ ${custo.toFixed(4)} + R$ ${frete.toFixed(4)} = R$ ${custoTotal.toFixed(4)}`);
            // } else {
            //   toast.success(`Preço de referência encontrado: R$ ${custo.toFixed(4)}`);
            // }

            // Se for S10 ou S10 Aditivado, buscar também o preço do ARLA
            if (formData.product === 's10' || formData.product === 's10_aditivado') {
              console.log('🔍 Produto S10 detectado, buscando preço do ARLA...');
              try {
                let arlaData: any[] | null = null;

                // Tentar RPC primeiro
                for (const cand of candidates) {
                  const { data: d, error: e } = await supabase
                    .rpc('get_lowest_cost_freight', {
                      p_posto_id: cand,
                      p_produto: 'ARLA',
                      p_date: today
                    });

                  if (!e && d && Array.isArray(d) && d.length > 0) {
                    arlaData = d;
                    console.log('✅ ARLA encontrado via RPC:', arlaData);
                    break;
                  }
                }

                // Fallback: buscar direto na tabela cotacao_arla via id_empresa
                if (!arlaData) {
                  console.log('🔄 Fallback: buscando ARLA direto na tabela cotacao.cotacao_arla...');
                  try {
                    // Primeiro, resolver id_empresa usando RPC
                    let resolvedIdEmpresa: number | null = null;
                    try {
                      const { data: emp, error: empError } = await supabase.rpc('get_sis_empresa_id_by_name', {
                        p_nome_empresa: selectedStation.name
                      });
                      if (!empError && emp && emp.length > 0) {
                        resolvedIdEmpresa = emp[0].id_empresa as number | null;
                      }
                    } catch (err) {
                      console.error('⚠️ Erro ao buscar id_empresa por nome:', err);
                    }

                    if (resolvedIdEmpresa) {
                      const cot: any = (supabase as any).schema ? (supabase as any).schema('cotacao') : null;
                      if (cot) {
                        // Buscar último preço do ARLA para a empresa
                        const { data: arlaRows } = await cot
                          .from('cotacao_arla')
                          .select('valor_unitario,data_cotacao,id_empresa,nome_empresa')
                          .eq('id_empresa', resolvedIdEmpresa)
                          .order('data_cotacao', { ascending: false })
                          .limit(1);

                        if (arlaRows && arlaRows.length > 0) {
                          arlaData = [{
                            custo: Number(arlaRows[0].valor_unitario || 0),
                            data_referencia: arlaRows[0].data_cotacao
                          }];
                          console.log('✅ ARLA encontrado via fallback cotacao_arla:', arlaData);
                        }
                      }
                    }
                  } catch (fallbackErr) {
                    console.error('⚠️ Erro no fallback cotacao_arla:', fallbackErr);
                  }
                }

                if (arlaData && arlaData.length > 0) {
                  const arlaResult = arlaData[0];
                  const arlaCusto = Number(arlaResult.custo || 0);
                  console.log('✅ Preço do ARLA encontrado:', arlaCusto);

                  if (arlaCusto > 0) {
                    setFormData(prev => ({
                      ...prev,
                      arla_cost_price: arlaCusto.toFixed(4)
                    }));
                    // Remover toast para não incomodar
                    // toast.success(`Preço do ARLA encontrado: R$ ${arlaCusto.toFixed(4)}`);
                  }
                } else {
                  console.log('⚠️ Preço do ARLA não encontrado');
                }
              } catch (arlaErr) {
                console.error('⚠️ Erro ao buscar preço do ARLA:', arlaErr);
              }
            }
          } else {
            console.log('⚠️ Custo total é zero ou negativo');
            setFetchStatus({ type: 'none' });
          }
        } else {
          console.log('⚠️ Nenhum custo encontrado para os parâmetros fornecidos');
          setPriceOrigin(null);
          setFetchStatus({ type: 'none' });
        }
      } catch (error) {
        console.error('❌ Erro inesperado ao buscar menor custo:', error);
        setFetchStatus({ type: 'none' });
      }
    };

    fetchAllCosts();
  }, [formData.station_id, formData.product, lastSearchedStation, lastSearchedProduct]);
  */


  const loadReferences = async (useCache = true) => {
    try {
      // Verificar cache primeiro
      if (useCache) {
        const cacheKey = 'price_request_references_cache';
        const cacheTimestampKey = 'price_request_references_cache_timestamp';
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(cacheTimestampKey);
        const cacheExpiry = 5 * 60 * 1000; // 5 minutos

        if (cachedData && cacheTimestamp) {
          const now = Date.now();
          const timestamp = parseInt(cacheTimestamp, 10);

          if (now - timestamp < cacheExpiry) {
            console.log('📦 Usando dados do cache (referências)');
            const parsedData = JSON.parse(cachedData);
            setReferences(parsedData);
            return;
          }
        }
      }

      console.log('Carregando referências...');
      const { data, error } = await supabase
        .from('referencias' as any)
        .select('*' as any)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Erro ao carregar referências:', error.message);
        // Tentar carregar da tabela price_suggestions como fallback
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('price_suggestions')
          .select(`
            *,
            stations!station_id(name, code),
            clients!client_id(name, code),
            payment_methods!payment_method_id(name)
          `)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (fallbackError) {
          console.log('Erro no fallback também:', fallbackError.message);
          setReferences([]);
          return;
        }

        // Converter price_suggestions para formato de referências
        const convertedReferences = fallbackData?.map(suggestion => ({
          id: suggestion.id,
          codigo_referencia: `REF-${suggestion.id}`,
          posto_id: suggestion.station_id,
          cliente_id: suggestion.client_id,
          produto: suggestion.product,
          preco_referencia: suggestion.final_price / 100,
          tipo_pagamento_id: suggestion.payment_method_id,
          observacoes: suggestion.observations,
          anexo: suggestion.attachments?.join(',') || null,
          criado_por: suggestion.requested_by || suggestion.created_at,
          stations: Array.isArray(suggestion.stations) ? suggestion.stations[0] : suggestion.stations,
          clients: Array.isArray(suggestion.clients) ? suggestion.clients[0] : suggestion.clients,
          payment_methods: Array.isArray(suggestion.payment_methods) ? suggestion.payment_methods[0] : suggestion.payment_methods,
        })) || [];

        console.log('Referências carregadas do fallback:', convertedReferences.length);
        setReferences(convertedReferences);

        // Salvar no cache
        const cacheKey = 'price_request_references_cache';
        const cacheTimestampKey = 'price_request_references_cache_timestamp';
        try {
          localStorage.setItem(cacheKey, JSON.stringify(convertedReferences));
          localStorage.setItem(cacheTimestampKey, Date.now().toString());
        } catch (cacheError) {
          console.warn('Erro ao salvar cache:', cacheError);
        }
        return;
      }

      console.log('Referências carregadas:', data?.length || 0);
      setReferences(data as any[] || []);

      // Salvar no cache
      const cacheKey = 'price_request_references_cache';
      const cacheTimestampKey = 'price_request_references_cache_timestamp';
      try {
        localStorage.setItem(cacheKey, JSON.stringify(data || []));
        localStorage.setItem(cacheTimestampKey, Date.now().toString());
        console.log('💾 Dados salvos no cache (referências)');
      } catch (cacheError) {
        console.warn('Erro ao salvar cache:', cacheError);
      }
    } catch (error) {
      console.error('Erro ao carregar referências:', error);
      setReferences([]);
    }
  };

  // Buscar último preço aprovado quando posto, cliente e produto forem selecionados
  useEffect(() => {
    const loadLastApprovedPrice = async () => {
      // Só buscar se tiver posto, cliente e produto selecionados
      if (!formData.station_id || formData.station_id === 'none' || !formData.client_id || !formData.product) {
        return;
      }

      // Se já tem preço atual preenchido, não sobrescrever
      if (formData.current_price && formData.current_price.trim() !== '') {
        return;
      }

      try {
        console.log('🔍 Buscando último preço aprovado:', {
          station_id: formData.station_id,
          client_id: formData.client_id,
          product: formData.product
        });

        // Mapear produto para valor válido do enum
        const mappedProduct = mapProductToEnum(formData.product);
        if (!mappedProduct) {
          console.warn('⚠️ Produto não mapeado para enum:', formData.product);
          return;
        }

        // Buscar último preço aprovado para essa combinação
        const { data, error } = await supabase
          .from('price_suggestions')
          .select('final_price, created_at')
          .eq('station_id', formData.station_id)
          .eq('client_id', formData.client_id)
          .eq('product', mappedProduct)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn('⚠️ Erro ao buscar último preço aprovado:', error);
          return;
        }

        if (data && data.final_price) {
          // Converter de centavos para reais se necessário
          const priceInReais = data.final_price >= 100 ? data.final_price / 100 : data.final_price;
          const formattedPrice = formatIntegerToPrice(Math.round(priceInReais * 100));

          console.log('✅ Último preço aprovado encontrado:', {
            final_price: data.final_price,
            priceInReais,
            formattedPrice
          });

          setFormData(prev => ({
            ...prev,
            current_price: formattedPrice
          }));
        } else {
          console.log('ℹ️ Nenhum preço aprovado encontrado para essa combinação');
        }
      } catch (error) {
        console.error('❌ Erro ao buscar último preço aprovado:', error);
      }
    };

    // Debounce para evitar múltiplas buscas
    const timeout = setTimeout(() => {
      loadLastApprovedPrice();
    }, 500);

    return () => clearTimeout(timeout);
  }, [formData.station_id, formData.client_id, formData.product]);

  const handleInputChange = async (field: string, value: any) => {
    // Campos de preço: aceitar apenas números inteiros e formatar com vírgula fixa
    const priceFields = ['current_price', 'suggested_price', 'arla_purchase_price'];

    if (priceFields.includes(field)) {
      // Remove tudo que não é número
      const numbersOnly = value.replace(/\D/g, '');
      // Formata com vírgula fixa (ex: 350 -> "3,50")
      const formatted = formatIntegerToPrice(numbersOnly);
      setFormData(prev => ({ ...prev, [field]: formatted }));
    } else if (field === 'payment_method_id') {
      // O valor já é o CARTAO diretamente, então apenas atualizar
      setFormData(prev => ({ ...prev, [field]: value || 'none' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }

    // Se mudou o posto, carregar métodos de pagamento dele
    if (field === 'station_id') {
      if (value && value !== 'none' && value !== '') {
        const methods = await getPaymentMethodsForStation(value);
        setStationPaymentMethods(methods);
        // Limpar seleção de método de pagamento quando mudar o posto
        setFormData(prev => ({ ...prev, payment_method_id: 'none' }));
      } else {
        setStationPaymentMethods([]);
        setFormData(prev => ({ ...prev, payment_method_id: 'none' }));
      }
    }
  };

  const calculateMargin = useCallback(() => {
    try {
      // Converter de formato com vírgula fixa para número (reais)
      const suggestedPrice = parsePriceToInteger(formData.suggested_price) / 100;
      const currentPrice = parsePriceToInteger(formData.current_price) / 100;

      console.log('=== CALCULANDO MARGENS ===');
      console.log('suggestedPrice:', suggestedPrice);
      console.log('currentPrice:', currentPrice);

      // 1) Aumento vs Preço Atual (em centavos)
      if (!isNaN(suggestedPrice) && !isNaN(currentPrice) && currentPrice > 0) {
        const inc = Math.round((suggestedPrice - currentPrice) * 100);
        setPriceIncreaseCents(inc);
      } else {
        setPriceIncreaseCents(0);
      }

      // Cálculo único para um posto
      const purchaseCost = parseFloat(formData.purchase_cost) || 0;
      const freightCost = parseFloat(formData.freight_cost) || 0;
      const baseCost = purchaseCost + freightCost;

      let feePercentage = 0;
      if (formData.payment_method_id && formData.payment_method_id !== 'none') {
        const stationMethod = paymentMethods.find(pm => {
          const methodStationId = String((pm as any).ID_POSTO || '');
          const methodCard = pm.CARTAO || '';
          return methodCard === formData.payment_method_id && methodStationId === String(formData.station_id);
        });

        if (stationMethod) {
          feePercentage = stationMethod.TAXA || 0;
        } else {
          // Fallback para taxa geral do método de pagamento
          const generalMethod = paymentMethods.find(pm =>
            pm.CARTAO === formData.payment_method_id &&
            (pm.ID_POSTO === 'all' || pm.ID_POSTO === 'GENERICO')
          );
          feePercentage = generalMethod?.TAXA || 0;
        }
      }

      const finalCost = baseCost * (1 + feePercentage / 100);

      if (!isNaN(suggestedPrice) && suggestedPrice > 0) {
        const marginCents = Math.round((suggestedPrice - finalCost) * 100);
        setCalculatedPrice(suggestedPrice);
        setMargin(marginCents);
        console.log('✅ Margem (sugerido - custo final):', marginCents, 'centavos');
      } else {
        setCalculatedPrice(0);
        setMargin(0);
        console.log('❌ Sem preço sugerido válido');
      }
    } catch (error) {
      console.error('❌ Erro ao calcular margem:', error);
      setCalculatedPrice(0);
      setMargin(0);
    }
  }, [formData.suggested_price, formData.current_price, formData.purchase_cost, formData.freight_cost, formData.payment_method_id, paymentMethods, stationPaymentMethods]);

  const calculateCosts = useCallback(() => {
    try {
      const volumeMade = parseFloat(formData.volume_made) || 0;
      const volumeProjected = parseFloat(formData.volume_projected) || 0;
      const suggestedPrice = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
      const arlaPurchase = (parsePriceToInteger(formData.arla_purchase_price) / 100) || 0;
      const arlaSale = formData.product === 'arla32_granel' ? suggestedPrice : 0;

      // Converter m³ para litros (1 m³ = 1000 litros)
      const volumeProjectedLiters = volumeProjected * 1000;

      // Cálculo único para um posto
      const purchaseCost = parseFloat(formData.purchase_cost) || 0;
      const freightCost = parseFloat(formData.freight_cost) || 0;

      // Buscar taxa específica do posto ou taxa padrão
      let feePercentage = 0;
      if (formData.payment_method_id && formData.payment_method_id !== 'none') {
        const stationMethod = paymentMethods.find(pm => {
          const methodStationId = String((pm as any).ID_POSTO || '');
          const methodCard = pm.CARTAO || '';
          return methodCard === formData.payment_method_id && methodStationId === String(formData.station_id);
        });

        if (stationMethod) {
          feePercentage = stationMethod.TAXA || 0;
        } else {
          // Fallback para taxa geral
          const generalMethod = paymentMethods.find(pm =>
            pm.CARTAO === formData.payment_method_id &&
            (pm.ID_POSTO === 'all' || pm.ID_POSTO === 'GENERICO')
          );
          feePercentage = generalMethod?.TAXA || 0;
        }
      }

      // Calcular base cost em R$/L
      const baseCost = purchaseCost + freightCost;

      // Calcular custo final em R$/L (aplicando taxa)
      const finalCost = baseCost * (1 + feePercentage / 100);

      // Calcular receita total (volume projetado em litros * preço sugerido)
      const totalRevenue = volumeProjectedLiters * suggestedPrice;

      // Calcular custo total (volume projetado em litros * custo final)
      const totalCost = volumeProjectedLiters * finalCost;

      // Lucro bruto = receita - custo
      const grossProfit = totalRevenue - totalCost;

      console.log('🛢️ Cálculo Lucro Diesel:', {
        volumeProjetadoM3: volumeProjected,
        volumeProjetadoLitros: volumeProjectedLiters,
        compraPorL: purchaseCost,
        fretePorL: freightCost,
        baseCostPorL: baseCost,
        taxaPercentual: feePercentage,
        custoFinalPorL: finalCost,
        precoSugerido: suggestedPrice,
        receitaTotal: totalRevenue,
        custoTotal: totalCost,
        lucroBruto: grossProfit,
        lucroPorLitro: grossProfit / volumeProjectedLiters
      });

      // Verificação manual
      const expectedLucro = (suggestedPrice - finalCost) * volumeProjectedLiters;
      console.log('✅ Verificação:', {
        'Preço - Custo por L': (suggestedPrice - finalCost).toFixed(4),
        '× Volume (L)': volumeProjectedLiters,
        '= Lucro Esperado': expectedLucro,
        'Lucro Calculado': grossProfit,
        'Diferença': Math.abs(expectedLucro - grossProfit)
      });

      // Lucro por litro
      const profitPerLiter = volumeProjectedLiters > 0 ? grossProfit / volumeProjectedLiters : 0;

      // Compensação do ARLA (margem ARLA * volume)
      // Para S10: ARLA é vendido junto, então calculamos a margem do ARLA
      // Volume do ARLA é proporcional ao diesel (aprox. 5% do volume)
      const arlaVolume = volumeProjectedLiters * 0.05;
      let arlaCompensation = 0;

      if (formData.product === 's10' || formData.product === 's10_aditivado') {
        // Para S10 e S10 Aditivado: margem = preço de venda do ARLA - preço de compra do ARLA
        const arlaMargin = (parsePriceToInteger(formData.arla_purchase_price) / 100) - parseFloat(formData.arla_cost_price);
        // Volume de ARLA é 5% do volume de diesel (já em litros)
        // arlaVolume já está em litros (volumeProjectedLiters * 0.05)
        arlaCompensation = arlaVolume * arlaMargin;
        console.log('🔍 Cálculo ARLA S10:', {
          volumeDieselLitros: volumeProjectedLiters,
          volumeARLALitros: arlaVolume,
          arlaPurchasePrice: formData.arla_purchase_price,
          arlaCostPrice: formData.arla_cost_price,
          arlaMargin,
          arlaCompensation
        });
      } else if (formData.product === 'arla32_granel') {
        // Para ARLA: margem = preço sugerido - preço de compra
        const arlaMargin = suggestedPrice - parseFloat(formData.arla_cost_price);
        arlaCompensation = volumeProjectedLiters * arlaMargin;
      }

      // Resultado líquido (lucro bruto + compensação ARLA)
      const netResult = grossProfit + arlaCompensation;

      setCostCalculations({
        finalCost,
        totalRevenue,
        totalCost,
        grossProfit,
        profitPerLiter,
        arlaCompensation,
        netResult
      });
    } catch (error) {
      console.error('Erro ao calcular custos:', error);
      setCostCalculations({
        finalCost: 0,
        totalRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        profitPerLiter: 0,
        arlaCompensation: 0,
        netResult: 0
      });
    }
  }, [
    formData.purchase_cost,
    formData.freight_cost,
    formData.volume_made,
    formData.volume_projected,
    formData.suggested_price,
    formData.arla_purchase_price,
    formData.arla_cost_price,
    formData.product,
    formData.payment_method_id,
    paymentMethods,
    stationPaymentMethods
  ]);

  // Recalcular margem quando os campos relevantes mudarem (com debounce)
  useEffect(() => {
    const timeout = setTimeout(() => {
      calculateMargin();
    }, 100);
    return () => clearTimeout(timeout);
  }, [
    formData.suggested_price,
    formData.current_price,
    formData.purchase_cost,
    formData.freight_cost,
    formData.payment_method_id,
    formData.station_ids,
    stationCosts,
    stationPaymentMethods,
    paymentMethods,
    calculateMargin
  ]);

  // Recalcular custos quando os campos relevantes mudarem (com debounce)
  useEffect(() => {
    const timeout = setTimeout(() => {
      calculateCosts();
    }, 100);
    return () => clearTimeout(timeout);
  }, [
    formData.purchase_cost,
    formData.freight_cost,
    formData.volume_made,
    formData.volume_projected,
    formData.suggested_price,
    formData.arla_purchase_price,
    formData.product,
    formData.payment_method_id,
    stationPaymentMethods,
    paymentMethods
  ]);

  const getFilteredReferences = () => {
    try {
      if (!Array.isArray(references)) {
        console.log('References não é um array:', references);
        return [];
      }

      console.log('Total de referências:', references.length);
      console.log('Filtros:', { station_id: formData.station_id, client_id: formData.client_id, product: formData.product });

      const filtered = references.filter(ref => {
        if (!ref) return false;
        return (
          (!formData.station_id || String(ref.posto_id) === String(formData.station_id)) &&
          (!formData.client_id || String(ref.cliente_id) === String(formData.client_id)) &&
          (!formData.product || ref.produto === formData.product)
        );
      });

      console.log('Referências filtradas:', filtered.length);
      return filtered;
    } catch (error) {
      console.error('Error filtering references:', error);
      return [];
    }
  };

  // Funções formatPrice e formatPrice4Decimals foram movidas para @/lib/pricing-utils

  const handleSubmit = async (isDraft: boolean = false) => {
    // Validação com Zod (apenas se não for rascunho)
    if (!isDraft) {
      const { validateWithSchema, getValidationErrors, priceSuggestionSchema } = await import('@/lib/validations');

      // Normalizar dados do formulário para strings (schema espera strings)
      const normalizedFormData = {
        station_id: formData.station_id ? String(formData.station_id) : '',
        client_id: formData.client_id ? String(formData.client_id) : '',
        product: formData.product ? String(formData.product) : '',
        suggested_price: formData.suggested_price ? String(formData.suggested_price) : '',
        current_price: formData.current_price ? String(formData.current_price) : '',
        purchase_cost: formData.purchase_cost ? String(formData.purchase_cost) : '',
        freight_cost: formData.freight_cost ? String(formData.freight_cost) : '',
        payment_method_id: formData.payment_method_id ? String(formData.payment_method_id) : undefined,
        reference_id: formData.reference_id ? String(formData.reference_id) : undefined,
        observations: formData.observations ? String(formData.observations) : undefined,
        batch_name: formData.batch_name ? String(formData.batch_name) : undefined,
      };

      const validation = validateWithSchema(priceSuggestionSchema, normalizedFormData);

      if (!validation.success) {
        const errors = getValidationErrors(validation.errors);
        console.error('❌ Erros de validação:', errors);
        const firstError = Object.values(errors)[0];
        toast.error(firstError || "Por favor, preencha todos os campos obrigatórios");
        return;
      }
    }

    setLoading(true);
    try {
      // Converter preços de formato com vírgula fixa para reais
      const suggestedPriceNum = parsePriceToInteger(formData.suggested_price) / 100;
      const currentPriceNum = parsePriceToInteger(formData.current_price) / 100;

      // Usar valores originais de stationCosts se disponíveis (mais precisos)
      // Caso contrário, converter do formData
      const stationCost = formData.station_id ? stationCosts[formData.station_id] : null;
      const purchaseCostNum = stationCost
        ? stationCost.purchase_cost
        : parseBrazilianDecimal(formData.purchase_cost);
      const freightCostNum = stationCost
        ? stationCost.freight_cost
        : parseBrazilianDecimal(formData.freight_cost);

      // Salvar valores em REAIS (o banco espera numeric(10,4) que já aceita decimais)
      const finalPrice = isNaN(suggestedPriceNum) ? null : suggestedPriceNum;
      const currentPrice = isNaN(currentPriceNum) ? null : currentPriceNum;
      const suggestedPrice = isNaN(suggestedPriceNum) ? null : suggestedPriceNum;
      const costPrice = purchaseCostNum + freightCostNum;

      console.log('💰 Valores de preço:', {
        final_price: finalPrice,
        current_price: currentPrice,
        suggested_price: suggestedPrice,
        cost_price: costPrice
      });

      // Como as colunas foram alteradas para TEXT, podemos salvar qualquer ID
      // Usar station_id (seleção única)
      const stationIdToSave = (!formData.station_id || formData.station_id === 'none')
        ? null
        : String(formData.station_id);

      // Manter station_ids como array com um elemento para compatibilidade com dados existentes
      const stationIdsToSave = stationIdToSave ? [stationIdToSave] : [];

      const clientIdToSave = (!formData.client_id || formData.client_id === 'none')
        ? null
        : String(formData.client_id);

      const referenceIdToSave = (!formData.reference_id || formData.reference_id === 'none')
        ? null
        : String(formData.reference_id);

      const paymentMethodIdToSave = (!formData.payment_method_id || formData.payment_method_id === 'none')
        ? null
        : String(formData.payment_method_id);

      console.log('📝 IDs DO FORMULÁRIO:', {
        station_ids_form: formData.station_ids,
        station_id_form: formData.station_id,
        client_id_form: formData.client_id,
        reference_id_form: formData.reference_id,
        payment_method_id_form: formData.payment_method_id
      });
      console.log('📝 IDs VALIDADOS PARA SALVAR:', {
        station_ids: stationIdsToSave,
        station_id: stationIdToSave,
        client_id: clientIdToSave,
        reference_id: referenceIdToSave,
        payment_method_id: paymentMethodIdToSave
      });

      // Mapear produto para valor válido do enum
      const mappedProduct = mapProductToEnum(formData.product);
      if (!mappedProduct) {
        toast.error('Produto inválido. Por favor, selecione um produto válido.');
        return;
      }

      // Garantir que valores numéricos sejam válidos
      const safeCurrentPrice = (currentPrice && !isNaN(currentPrice) && isFinite(currentPrice)) ? currentPrice : null;
      const safeSuggestedPrice = (suggestedPrice && !isNaN(suggestedPrice) && isFinite(suggestedPrice)) ? suggestedPrice : null;
      const safeFinalPrice = (finalPrice && !isNaN(finalPrice) && isFinite(finalPrice)) ? finalPrice : 0;
      const safeCostPrice = (costPrice && !isNaN(costPrice) && isFinite(costPrice)) ? costPrice : null;
      const safeMargin = (margin && !isNaN(margin) && isFinite(margin)) ? Math.round(margin) : 0;

      const requestData = {
        station_id: stationIdToSave,
        // station_ids removido - coluna não existe na tabela
        client_id: clientIdToSave,
        product: mappedProduct as any,
        current_price: safeCurrentPrice,
        suggested_price: safeSuggestedPrice,
        final_price: safeFinalPrice,
        reference_id: referenceIdToSave,
        payment_method_id: paymentMethodIdToSave,
        observations: formData.observations || null,
        attachments: attachments.length > 0 ? attachments : null,
        requested_by: user?.id ? String(user.id) : (user?.email || ''),
        created_by: user?.id ? String(user.id) : (user?.email || ''),
        margin_cents: safeMargin, // Margem já está em centavos
        cost_price: safeCostPrice,
        status: 'draft' as any, // Sempre salvar como draft ao adicionar
        // Dados de cálculo para análise - usar os valores já calculados acima
        purchase_cost: (() => {
          // Usar purchaseCostNum que já foi calculado corretamente acima
          return (purchaseCostNum && !isNaN(purchaseCostNum) && isFinite(purchaseCostNum)) ? purchaseCostNum : null;
        })(),
        freight_cost: (() => {
          // Usar freightCostNum que já foi calculado corretamente acima
          return (freightCostNum && !isNaN(freightCostNum) && isFinite(freightCostNum)) ? freightCostNum : null;
        })(),
        volume_made: (() => {
          const val = parseBrazilianDecimal(formData.volume_made);
          return (val && !isNaN(val) && isFinite(val)) ? val : null;
        })(),
        volume_projected: (() => {
          const val = parseBrazilianDecimal(formData.volume_projected);
          return (val && !isNaN(val) && isFinite(val)) ? val : null;
        })(),
        arla_purchase_price: (() => {
          const val = parsePriceToInteger(formData.arla_purchase_price) / 100;
          return (val && !isNaN(val) && isFinite(val)) ? val : null;
        })(),
        arla_cost_price: (() => {
          const val = parseBrazilianDecimal(formData.arla_cost_price);
          return (val && !isNaN(val) && isFinite(val)) ? val : null;
        })(),
        // Origem do preço
        price_origin_base: priceOrigin?.base_nome || null,
        price_origin_bandeira: priceOrigin?.base_bandeira || null,
        price_origin_delivery: priceOrigin?.forma_entrega || null,
        // Aprovação multinível - usar configurações dinâmicas baseadas em margem
        approval_level: 1 as number, // Será ajustado pela regra se necessário
        total_approvers: 3 as number, // Será ajustado pela regra se necessário
        approvals_count: 0 as number,
        rejections_count: 0 as number
      };

      // Buscar regra de aprovação baseada na margem
      // SEMPRE começar no nível 1 - a regra apenas determina quantos níveis são necessários
      let finalApprovalLevel = 1; // SEMPRE começar no nível 1
      let finalTotalApprovers = 3;

      try {
        const { data: approvalRule, error: ruleError } = await supabase
          .rpc('get_approval_margin_rule' as any, {
            margin_cents: margin
          });

        if (!ruleError && approvalRule && Array.isArray(approvalRule) && approvalRule.length > 0) {
          const rule = approvalRule[0] as any;
          if (rule.required_profiles && Array.isArray(rule.required_profiles) && rule.required_profiles.length > 0) {
            // Buscar aprovadores para determinar quantos níveis são necessários
            const { data: allApprovers } = await supabase
              .from('user_profiles')
              .select('user_id, email, perfil')
              .in('perfil', rule.required_profiles);

            if (allApprovers && allApprovers.length > 0) {
              // Buscar ordem hierárquica de aprovação do banco de dados
              const { data: orderData } = await supabase
                .from('approval_profile_order' as any)
                .select('perfil, order_position')
                .eq('is_active', true)
                .order('order_position', { ascending: true });

              // Se não houver ordem configurada, usar ordem padrão
              let approvalOrder: string[] = ['supervisor_comercial', 'diretor_comercial', 'diretor_pricing'];
              if (orderData && orderData.length > 0) {
                approvalOrder = orderData.map((item: any) => item.perfil);
              }

              // Determinar quantos níveis são necessários baseado nos perfis requeridos
              // Mas SEMPRE começar no nível 1
              const requiredProfilesInOrder = rule.required_profiles
                .map((profile: string) => ({
                  profile,
                  position: approvalOrder.indexOf(profile)
                }))
                .filter((item: any) => item.position >= 0)
                .sort((a: any, b: any) => a.position - b.position);

              if (requiredProfilesInOrder.length > 0) {
                // O total de aprovadores é o número de perfis únicos requeridos
                finalTotalApprovers = requiredProfilesInOrder.length;
                // Approval level SEMPRE começa em 1
                finalApprovalLevel = 1;
                console.log('📋 Regra de aprovação aplicada:', rule);
                console.log('📋 Approval level INICIANDO em:', finalApprovalLevel);
                console.log('📋 Total de níveis necessários:', finalTotalApprovers);
                console.log('📋 Perfis na ordem:', requiredProfilesInOrder.map((p: any) => p.profile));
              }
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar regra de aprovação:', error);
        // Continuar com valores padrão se houver erro
      }

      // Atualizar requestData com os valores finais
      // SEMPRE começar no nível 1, independentemente da regra
      requestData.approval_level = Number(1);
      requestData.total_approvers = Number(finalTotalApprovers) || 3;

      // REGRA CLARA:
      // - Se é a primeira solicitação (addedCards.length === 0) E não há múltiplos postos → NÃO gerar batch_id (singular)
      // - Se já há cards adicionados OU há múltiplos postos selecionados → GERAR batch_id (lote)
      // - Todas as solicitações criadas na mesma operação devem ter o mesmo batch_id
      const hasMultipleStations = formData.station_ids && formData.station_ids.length > 1;
      const willHaveMultipleRequests = addedCards.length > 0 || hasMultipleStations;

      // Determinar batch_id antes de criar as solicitações
      let batchIdToUse: string | null = null;

      if (willHaveMultipleRequests) {
        // Se já há cards adicionados, usar o batch_id do primeiro card (se existir) ou gerar um novo
        try {
          // Buscar batch_id do primeiro card adicionado (se existir)
          if (addedCards[0]?.suggestionId) {
            const { data: firstCardData } = await supabase
              .from('price_suggestions')
              .select('batch_id')
              .eq('id', addedCards[0].suggestionId)
              .single() as any;

            if (firstCardData?.batch_id) {
              batchIdToUse = firstCardData.batch_id;
              console.log('📦 Reutilizando batch_id do primeiro card:', batchIdToUse);
            } else {
              // A primeira solicitação não tem batch_id, então gerar um novo e atualizar todas as solicitações existentes
              batchIdToUse = generateUUID();
              console.log('📦 Novo batch_id gerado para lote:', batchIdToUse);

              // Atualizar todas as solicitações existentes (que não têm batch_id) para terem o mesmo batch_id
              const existingSuggestionIds = addedCards
                .map(card => card.suggestionId)
                .filter(id => id);

              if (existingSuggestionIds.length > 0) {
                const { error: updateError } = await supabase
                  .from('price_suggestions' as any)
                  .update({ batch_id: batchIdToUse } as any)
                  .in('id', existingSuggestionIds)
                  .is('batch_id', null); // Só atualizar as que não têm batch_id

                if (updateError) {
                  console.error('⚠️ Erro ao atualizar batch_id das solicitações existentes:', updateError);
                } else {
                  console.log('✅ Batch_id atualizado para', existingSuggestionIds.length, 'solicitação(ões) existente(s)');
                }
              }
            }
          } else {
            // Gerar novo batch_id para o lote
            batchIdToUse = generateUUID();
            console.log('📦 Novo batch_id gerado para lote:', batchIdToUse);
          }
        } catch (error) {
          // Se falhar, gerar UUID no cliente
          batchIdToUse = generateUUID();
          console.log('📦 Batch_id gerado no cliente:', batchIdToUse);
        }
      } else {
        // Se é a primeira solicitação (não há cards adicionados) E não há múltiplos postos, não gerar batch_id (será singular)
        batchIdToUse = null;
        console.log('📦 Solicitação singular (sem batch_id)');
      }

      // Determinar quais postos processar
      const stationsToProcess = hasMultipleStations && formData.station_ids.length > 0
        ? formData.station_ids
        : (stationIdToSave ? [stationIdToSave] : []);

      console.log('🔍 Postos a processar:', stationsToProcess);
      console.log('📦 Batch ID a usar:', batchIdToUse);
      console.log('📝 isDraft:', isDraft, 'status:', isDraft ? 'draft' : 'pending');

      // Se houver múltiplos postos, criar uma solicitação para cada um com o mesmo batch_id
      if (stationsToProcess.length > 1) {
        const insertPromises = stationsToProcess.map(async (stationId) => {
          // Buscar custos específicos deste posto
          const stationCost = stationCosts[stationId];
          const station = stations.find(s => s.id === stationId || s.code === stationId);

          // Criar dados específicos para este posto
          // Garantir valores numéricos válidos para este posto
          const stationPurchaseCost = stationCost ? stationCost.purchase_cost : parseBrazilianDecimal(formData.purchase_cost);
          const stationFreightCost = stationCost ? stationCost.freight_cost : parseBrazilianDecimal(formData.freight_cost);
          const stationCostPrice = stationCost ? (stationCost.purchase_cost + stationCost.freight_cost) : costPrice;
          const stationMargin = stationCost && stationCost.margin_cents !== undefined && !isNaN(stationCost.margin_cents)
            ? Math.round(stationCost.margin_cents)
            : safeMargin;

          const stationRequestData = {
            ...requestData,
            station_id: String(stationId),
            // Usar custos específicos deste posto se disponíveis
            purchase_cost: (stationPurchaseCost && !isNaN(stationPurchaseCost) && isFinite(stationPurchaseCost)) ? stationPurchaseCost : null,
            freight_cost: (stationFreightCost && !isNaN(stationFreightCost) && isFinite(stationFreightCost)) ? stationFreightCost : null,
            cost_price: (stationCostPrice && !isNaN(stationCostPrice) && isFinite(stationCostPrice)) ? stationCostPrice : null,
            // Recalcular margem para este posto
            margin_cents: stationMargin,
            batch_id: batchIdToUse // Todas as solicitações do mesmo lote terão o mesmo batch_id
          };

          // Sanitizar dados antes do insert
          const sanitizedStationData = {
            ...stationRequestData,
            station_id: String(stationRequestData.station_id),
            client_id: stationRequestData.client_id ? String(stationRequestData.client_id) : null,
            product: String(stationRequestData.product),
            reference_id: stationRequestData.reference_id ? String(stationRequestData.reference_id) : null,
            payment_method_id: stationRequestData.payment_method_id ? String(stationRequestData.payment_method_id) : null,
            requested_by: String(stationRequestData.requested_by || ''),
            created_by: String(stationRequestData.created_by || ''),
            observations: stationRequestData.observations ? String(stationRequestData.observations) : null,
            // Garantir que campos numéricos sejam números válidos
            approval_level: Number(stationRequestData.approval_level) || 1,
            total_approvers: Number(stationRequestData.total_approvers) || 3,
            approvals_count: Number(stationRequestData.approvals_count) || 0,
            rejections_count: Number(stationRequestData.rejections_count) || 0,
          };

          console.log(`📝 Criando solicitação para posto ${station?.name || stationId}:`, sanitizedStationData);

          return supabase
            .from('price_suggestions')
            .insert([sanitizedStationData])
            .select()
            .single();
        });

        const results = await Promise.all(insertPromises);
        const errors = results.filter(r => r.error);

        if (errors.length > 0) {
          const firstError = errors[0].error;
          console.error('❌ Erro ao criar solicitações:', firstError);

          if (firstError?.code === '42501' || firstError?.message?.includes('permission') || firstError?.message?.includes('policy')) {
            toast.error("Erro de permissão. Verifique se você está autenticado corretamente.");
          } else if (firstError?.code === '23505') {
            toast.error("Erro: Já existe uma solicitação com esses dados.");
          } else if (firstError?.code === '23503') {
            toast.error("Erro: Referência inválida (posto, cliente ou método de pagamento).");
          } else {
            toast.error("Erro ao salvar solicitações: " + (firstError?.message || 'Erro desconhecido'));
          }
          setLoading(false);
          return;
        }

        // Processar todas as solicitações criadas
        const createdSuggestions = results.map(r => r.data).filter(Boolean);

        if (!isDraft && createdSuggestions.length > 0) {
          // Criar cards para cada solicitação criada
          for (const data of createdSuggestions) {
            // Buscar dados do posto
            const stationId = data.station_id;
            let stationData = null;

            let bandeira = '';
            if (stationId) {
              try {
                const station = stations.find(s => s.id === stationId || s.code === stationId);
                if (station) {
                  stationData = { name: station.name, code: station.code || station.id };
                  // Tentar buscar bandeira via RPC
                  try {
                    const { data: stationInfo } = await supabase.rpc('get_sis_empresa_by_ids' as any, {
                      p_ids: [String(stationId)]
                    });
                    if (stationInfo && stationInfo.length > 0) {
                      bandeira = stationInfo[0].bandeira || '';
                    }
                  } catch (rpcErr) {
                    console.warn('Erro ao buscar bandeira via RPC:', rpcErr);
                  }
                } else {
                  // Tentar buscar do banco via RPC
                  try {
                    const { data: stationInfo } = await supabase.rpc('get_sis_empresa_by_ids' as any, {
                      p_ids: [String(stationId)]
                    });
                    if (stationInfo && stationInfo.length > 0) {
                      stationData = {
                        name: stationInfo[0].nome_empresa || stationId,
                        code: stationInfo[0].id_empresa || stationId
                      };
                      bandeira = stationInfo[0].bandeira || '';
                    }
                  } catch (rpcErr) {
                    console.warn('Erro ao buscar posto via RPC:', rpcErr);
                    // Fallback para busca direta
                    const { data: seByCnpj } = await supabase
                      .from('sis_empresa' as any)
                      .select('nome_empresa, cnpj_cpf, bandeira')
                      .eq('cnpj_cpf', stationId)
                      .maybeSingle();

                    if (seByCnpj) {
                      stationData = {
                        name: (seByCnpj as any).nome_empresa,
                        code: (seByCnpj as any).cnpj_cpf
                      };
                      bandeira = (seByCnpj as any).bandeira || '';
                    }
                  }
                }
              } catch (err) {
                console.error('Erro ao buscar dados do posto:', err);
              }
            }

            const stationName = stationData?.name || stationId || 'N/A';
            const stationCode = stationData?.code || stationId || '';

            // Calcular resultado líquido (usar custos específicos do posto se disponíveis)
            const stationCost = stationCosts[stationId];
            const volumeProjected = parseFloat(formData.volume_projected) || 0;
            const volumeProjectedLiters = volumeProjected * 1000;
            const suggestedPrice = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
            const purchaseCost = stationCost ? stationCost.purchase_cost : (parseFloat(formData.purchase_cost) || 0);
            const freightCost = stationCost ? stationCost.freight_cost : (parseFloat(formData.freight_cost) || 0);
            const baseCost = purchaseCost + freightCost;

            let feePercentage = 0;
            if (formData.payment_method_id && formData.payment_method_id !== 'none') {
              // Buscar taxa específica para este posto na lista global de métodos
              const stationMethod = paymentMethods.find(pm => {
                const methodStationId = String((pm as any).ID_POSTO || '');
                const methodCard = pm.CARTAO || '';
                return methodCard === formData.payment_method_id && methodStationId === String(stationId);
              });

              if (stationMethod) {
                feePercentage = stationMethod.TAXA || 0;
              } else {
                // Fallback para método geral se não encontrar específico para o posto
                const defaultMethod = paymentMethods.find(pm =>
                  pm.CARTAO === formData.payment_method_id &&
                  (pm.ID_POSTO === 'all' || pm.ID_POSTO === 'GENERICO')
                );
                feePercentage = defaultMethod?.TAXA || 0;
              }
            }

            const finalCost = baseCost * (1 + feePercentage / 100);
            const totalRevenue = volumeProjectedLiters * suggestedPrice;
            const totalCost = volumeProjectedLiters * finalCost;
            const grossProfit = totalRevenue - totalCost;

            // ARLA compensation
            let arlaCompensation = 0;
            if (formData.product === 's10' || formData.product === 's10_aditivado') {
              const arlaPurchase = parseFloat(formData.arla_purchase_price) || 0;
              const arlaMargin = arlaPurchase - parseFloat(formData.arla_cost_price || '0');
              const arlaVolume = volumeProjectedLiters * 0.05;
              arlaCompensation = arlaVolume * arlaMargin;
            } else if (formData.product === 'arla32_granel') {
              const arlaMargin = suggestedPrice - parseFloat(formData.arla_cost_price || '0');
              arlaCompensation = volumeProjectedLiters * arlaMargin;
            }

            const netResult = grossProfit + arlaCompensation;

            // Criar novo card
            const newCard = {
              id: data.id || `card-${Date.now()}-${Math.random()}`,
              stationName: stationName,
              stationCode: stationCode,
              location: '',
              bandeira: bandeira,
              product: data.product,
              productLabel: getProductName(data.product as string),
              volume: data.volume_projected,
              netResult: netResult,
              suggestionId: data.id,
              expanded: false,
              attachments: attachments.length > 0 ? [...attachments] : undefined,
              costAnalysis: {
                purchase_cost: purchaseCost,
                freight_cost: freightCost,
                final_cost: finalCost,
                total_revenue: totalRevenue,
                total_cost: totalCost,
                gross_profit: grossProfit,
                profit_per_liter: volumeProjectedLiters > 0 ? grossProfit / volumeProjectedLiters : 0,
                arla_compensation: arlaCompensation,
                net_result: netResult,
                margin_cents: Math.round((suggestedPrice - finalCost) * 100),
                volume_projected: volumeProjected,
                suggested_price: suggestedPrice,
                feePercentage: feePercentage,
                base_cost: baseCost
              }
            };

            setAddedCards(prev => [...prev, newCard]);
          }

          toast.success(`${createdSuggestions.length} solicitação(ões) adicionada(s) com sucesso!`);

          // Resetar TODOS os campos do formulário
          setFormData(initialFormData);

          // Limpar anexos
          setAttachments([]);

          setLoading(false);
          return;
        }

        // Se for draft, não criar cards
        setLoading(false);
        return;
      }

      // Código para um único posto (comportamento original)
      (requestData as any).batch_id = batchIdToUse;

      // Garantir que campos TEXT sejam strings e campos NUMERIC sejam números
      const sanitizedRequestData = {
        ...requestData,
        station_id: requestData.station_id ? String(requestData.station_id) : null,
        client_id: requestData.client_id ? String(requestData.client_id) : null,
        product: String(requestData.product),
        reference_id: requestData.reference_id ? String(requestData.reference_id) : null,
        payment_method_id: requestData.payment_method_id ? String(requestData.payment_method_id) : null,
        requested_by: String(requestData.requested_by || ''),
        created_by: String(requestData.created_by || ''),
        observations: requestData.observations ? String(requestData.observations) : null,
        // Campos numéricos devem ser números válidos ou null
        current_price: safeCurrentPrice,
        suggested_price: safeSuggestedPrice,
        final_price: safeFinalPrice,
        margin_cents: safeMargin,
        cost_price: safeCostPrice,
        approval_level: Number(requestData.approval_level) || 1,
        total_approvers: Number(requestData.total_approvers) || 3,
        approvals_count: Number(requestData.approvals_count) || 0,
        rejections_count: Number(requestData.rejections_count) || 0,
      };

      // Log detalhado dos dados antes do insert
      console.log('📤 Dados a serem inseridos:', JSON.stringify(sanitizedRequestData, null, 2));
      console.log('📤 Tipos dos dados:', {
        station_id: typeof sanitizedRequestData.station_id,
        client_id: typeof sanitizedRequestData.client_id,
        product: typeof sanitizedRequestData.product,
        current_price: typeof sanitizedRequestData.current_price,
        suggested_price: typeof sanitizedRequestData.suggested_price,
        final_price: typeof sanitizedRequestData.final_price,
        margin_cents: typeof sanitizedRequestData.margin_cents,
        cost_price: typeof sanitizedRequestData.cost_price,
      });

      const { data, error } = await supabase
        .from('price_suggestions')
        .insert([sanitizedRequestData])
        .select()
        .single();

      if (error) {
        console.error('❌ Erro completo:', error);
        console.error('❌ Código do erro:', error.code);
        console.error('❌ Detalhes do erro:', error.details);
        console.error('❌ Mensagem:', error.message);
        console.error('❌ Hint:', (error as any).hint);
        console.error('❌ Dados tentados:', requestData);

        // Verificar se é erro de RLS
        if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
          toast.error("Erro de permissão. Verifique se você está autenticado corretamente.");
        } else if (error.code === '23505') {
          toast.error("Erro: Já existe uma solicitação com esses dados.");
        } else if (error.code === '23503') {
          toast.error("Erro: Referência inválida (posto, cliente ou método de pagamento).");
        } else {
          toast.error("Erro ao salvar solicitação: " + (error.message || 'Erro desconhecido'));
        }
        return;
      }

      // Carregar dados completos da solicitação com nomes
      let stationData = null;
      let clientData = null;

      console.log('🔍 Buscando dados do posto e cliente...');
      console.log('station_id:', stationIdToSave, 'client_id:', clientIdToSave);
      console.log('stations disponíveis:', stations.length);
      console.log('clients disponíveis:', clients.length);

      // Buscar posto - tentar vários campos
      let bandeira = '';
      if (stationIdToSave) {
        try {
          // Tentar buscar via RPC primeiro (mais confiável)
          try {
            const { data: stationInfo } = await supabase.rpc('get_sis_empresa_by_ids' as any, {
              p_ids: [String(stationIdToSave)]
            });
            if (stationInfo && stationInfo.length > 0) {
              stationData = {
                name: stationInfo[0].nome_empresa || stationIdToSave,
                code: stationInfo[0].id_empresa || stationIdToSave
              };
              bandeira = stationInfo[0].bandeira || '';
              console.log('✅ Posto encontrado via RPC:', stationData.name, 'Bandeira:', bandeira);
            }
          } catch (rpcErr) {
            console.warn('Erro ao buscar posto via RPC:', rpcErr);
          }

          // Se não encontrou via RPC, tentar outros métodos
          if (!stationData) {
            // Tentar por cnpj_cpf
            const { data: seByCnpj, error: cnpjError } = await supabase
              .from('sis_empresa' as any)
              .select('nome_empresa, cnpj_cpf, bandeira')
              .eq('cnpj_cpf', stationIdToSave)
              .maybeSingle();

            if (!cnpjError && seByCnpj) {
              stationData = { name: (seByCnpj as any).nome_empresa, code: (seByCnpj as any).cnpj_cpf };
              bandeira = (seByCnpj as any).bandeira || '';
              console.log('✅ Posto encontrado por CNPJ:', stationData.name, 'Bandeira:', bandeira);
            } else {
              // Tentar como UUID direto
              const { data: seById, error: idError } = await supabase
                .from('sis_empresa' as any)
                .select('nome_empresa, cnpj_cpf, bandeira')
                .eq('id', stationIdToSave)
                .maybeSingle();

              if (!idError && seById) {
                stationData = { name: (seById as any).nome_empresa, code: (seById as any).cnpj_cpf || stationIdToSave };
                bandeira = (seById as any).bandeira || '';
                console.log('✅ Posto encontrado por ID:', stationData.name, 'Bandeira:', bandeira);
              } else {
                // Buscar da lista de stations que já temos carregada
                const foundStation = stations.find(s => s.id === stationIdToSave || s.code === stationIdToSave);
                if (foundStation) {
                  stationData = { name: foundStation.name, code: foundStation.code || foundStation.id };
                  console.log('✅ Posto encontrado na lista:', stationData.name);
                } else {
                  console.warn('⚠️ Posto não encontrado para:', stationIdToSave);
                  console.warn('IDs disponíveis:', stations.map(s => ({ id: s.id, code: s.code })));
                }
              }
            }
          }
        } catch (err) {
          console.error('Erro ao buscar dados do posto:', err);
        }
      }

      // Buscar cliente
      if (clientIdToSave) {
        try {
          const { data: client, error: clientError } = await supabase
            .from('clientes' as any)
            .select('nome, id_cliente')
            .eq('id_cliente', clientIdToSave)
            .maybeSingle();

          if (!clientError && client) {
            clientData = { name: (client as any).nome, code: String((client as any).id_cliente) };
            console.log('✅ Cliente encontrado:', clientData.name);
          } else {
            // Buscar da lista de clients que já temos carregada
            const foundClient = clients.find(c => c.id === clientIdToSave || c.code === clientIdToSave);
            if (foundClient) {
              clientData = { name: foundClient.name, code: foundClient.code || foundClient.id };
              console.log('✅ Cliente encontrado na lista:', clientData.name);
            } else {
              console.warn('⚠️ Cliente não encontrado para:', clientIdToSave);
              console.warn('IDs disponíveis:', clients.map(c => ({ id: c.id, code: c.code })));
            }
          }
        } catch (err) {
          console.error('Erro ao buscar dados do cliente:', err);
        }
      }

      const enrichedData = {
        ...data,
        stations: stationData || { name: formData.station_id, code: formData.station_id },
        clients: clientData || { name: formData.client_id, code: formData.client_id },
        payment_methods: stationPaymentMethods.find(pm => {
          const methodId = String((pm as any).id || (pm as any).ID_POSTO || '');
          return pm.CARTAO === formData.payment_method_id || methodId === String(formData.payment_method_id);
        }) || paymentMethods.find(pm => pm.CARTAO === formData.payment_method_id) || null
      };

      console.log('📊 Dados enriquecidos:', enrichedData);

      // Se for "Adicionar" (não é rascunho), criar card ao invés de mostrar tela de sucesso
      if (!isDraft) {
        // Buscar dados do posto para o card
        const stationName = stationData?.name || formData.station_id || 'N/A';
        const stationCode = stationData?.code || formData.station_id || '';

        // Buscar localização do posto (usar dados já disponíveis ou deixar vazio)
        const location = '';
        // Por enquanto, deixar vazio ou usar dados já disponíveis do stationData
        // A localização pode ser adicionada posteriormente se necessário

        // Calcular resultado líquido
        const volumeProjected = parseFloat(formData.volume_projected) || 0;
        const volumeProjectedLiters = volumeProjected * 1000;
        const suggestedPrice = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
        const purchaseCost = parseFloat(formData.purchase_cost) || 0;
        const freightCost = parseFloat(formData.freight_cost) || 0;
        const baseCost = purchaseCost + freightCost;

        let feePercentage = 0;
        if (formData.payment_method_id && formData.payment_method_id !== 'none') {
          // Buscar taxa específica para este posto na lista global de métodos
          const stationMethod = paymentMethods.find(pm => {
            const methodStationId = String((pm as any).ID_POSTO || '');
            const methodCard = pm.CARTAO || '';
            return methodCard === formData.payment_method_id && methodStationId === String(formData.station_id);
          });

          if (stationMethod) {
            feePercentage = stationMethod.TAXA || 0;
          } else {
            // Fallback para método geral se não encontrar específico para o posto
            const defaultMethod = paymentMethods.find(pm =>
              pm.CARTAO === formData.payment_method_id &&
              (pm.ID_POSTO === 'all' || pm.ID_POSTO === 'GENERICO')
            );
            feePercentage = defaultMethod?.TAXA || 0;
          }
        }

        const finalCost = baseCost * (1 + feePercentage / 100);
        const totalRevenue = volumeProjectedLiters * suggestedPrice;
        const totalCost = volumeProjectedLiters * finalCost;
        const grossProfit = totalRevenue - totalCost;

        // ARLA compensation
        let arlaCompensation = 0;
        if (formData.product === 's10' || formData.product === 's10_aditivado') {
          const arlaPurchase = parseFloat(formData.arla_purchase_price) || 0;
          const arlaMargin = arlaPurchase - parseFloat(formData.arla_cost_price || '0');
          const arlaVolume = volumeProjectedLiters * 0.05;
          arlaCompensation = arlaVolume * arlaMargin;
        } else if (formData.product === 'arla32_granel') {
          const arlaMargin = suggestedPrice - parseFloat(formData.arla_cost_price || '0');
          arlaCompensation = volumeProjectedLiters * arlaMargin;
        }

        const netResult = grossProfit + arlaCompensation;

        // Criar novo card
        const newCard = {
          id: data.id || `card-${Date.now()}`,
          stationName: stationName,
          stationCode: stationCode,
          location: location || 'N/A',
          bandeira: bandeira,
          product: data.product,
          productLabel: getProductName(data.product as string),
          volume: data.volume_projected,
          netResult: netResult,
          suggestionId: data.id,
          expanded: false,
          attachments: attachments.length > 0 ? [...attachments] : undefined,
          costAnalysis: {
            purchase_cost: purchaseCost,
            freight_cost: freightCost,
            final_cost: finalCost,
            total_revenue: totalRevenue,
            total_cost: totalCost,
            gross_profit: grossProfit,
            profit_per_liter: volumeProjectedLiters > 0 ? grossProfit / volumeProjectedLiters : 0,
            arla_compensation: arlaCompensation,
            net_result: netResult,
            margin_cents: Math.round((suggestedPrice - finalCost) * 100),
            volume_projected: volumeProjected,
            suggested_price: suggestedPrice,
            feePercentage: feePercentage,
            base_cost: baseCost
          }
        };

        setAddedCards(prev => [...prev, newCard]);
        toast.success("Card adicionado com sucesso!");

        // Resetar TODOS os campos do formulário
        setFormData(initialFormData);

        // Limpar anexos
        setAttachments([]);

        // Limpar custos relacionados ao posto/cliente/produto
        setStationCosts({});
        setPriceOrigin(null);
        setFetchStatus(null);

        // Resetar referências de busca de custos para permitir recarregamento quando selecionar mesmo posto/produto
        setLastSearchedStation('');
        setLastSearchedProduct('');

        // Limpar cálculos
        setCalculatedPrice(0);
        setMargin(0);
      } else {
        // Se for rascunho, comportamento original
        toast.success("Rascunho salvo com sucesso!");
        setSaveAsDraft(isDraft);
        setSavedSuggestion(enrichedData);

        // Recarregar lista de solicitações após salvar
        if (activeTab === 'my-requests') {
          loadMyRequests();
        }
      }

    } catch (error: any) {
      console.error('❌ Erro ao salvar solicitação:', error);
      toast.error("Erro ao salvar solicitação: " + (error?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendAllForApproval = async () => {
    if (addedCards.length === 0) {
      toast.error("Nenhuma solicitação para enviar");
      return;
    }

    setLoading(true);
    try {
      // Atualizar status de todas as solicitações de 'draft' para 'pending'
      const suggestionIds = addedCards
        .map(card => card.suggestionId)
        .filter(id => id); // Remover IDs vazios

      if (suggestionIds.length === 0) {
        toast.error("Nenhuma solicitação válida para enviar");
        return;
      }

      // Buscar todas as solicitações para verificar batch_id
      const { data: suggestions, error: fetchError } = await supabase
        .from('price_suggestions')
        .select('id, batch_id, created_at, created_by, volume_projected, suggested_price, client_id')
        .in('id', suggestionIds);

      if (fetchError) {
        throw fetchError;
      }

      // Calcular totais para a proposta
      const totalVolume = suggestions?.reduce((acc, s) => acc + (s.volume_projected || 0), 0) || 0;
      const totalValue = suggestions?.reduce((acc, s) => {
        const volumeLiters = (s.volume_projected || 0) * 1000;
        return acc + (volumeLiters * (s.suggested_price || 0));
      }, 0) || 0;

      // 1. Buscar o primeiro nível de aprovação e seus usuários para notificação
      const { data: levelData } = await supabase
        .from('approval_profile_order')
        .select('perfil')
        .eq('is_active', true)
        .order('order_position', { ascending: true })
        .limit(1)
        .maybeSingle();

      const firstProfile = levelData?.perfil || 'supervisor_comercial';

      const { data: reviewers } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('perfil', firstProfile);

      const reviewerIds = reviewers?.map(r => r.user_id) || [];
      const firstProfileNamePlural = firstProfile === 'supervisor_comercial' ? 'Supervisores Comerciais' :
        firstProfile.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      // Pegar o cliente do primeiro item
      const clientId = suggestions?.[0]?.client_id;
      let proposalId: string | null = null;

      try {
        // Criar a Proposta Comercial
        const { data: proposal, error: proposalError } = await supabase
          .from('commercial_proposals')
          .insert({
            client_id: clientId || null,
            status: 'pending',
            created_by: user?.id,
            total_volume: totalVolume,
            total_value: totalValue,
            observations: batchName || null,
          })
          .select()
          .single();

        if (proposalError) throw proposalError;
        proposalId = proposal.id;
        console.log('✅ Proposta criada:', proposalId);
      } catch (err: any) {
        console.error('Erro ao criar proposta:', err);
        throw new Error("Erro ao criar proposta comercial: " + (err.message || "Erro desconhecido"));
      }

      // REGRA: Só criar batch_id se houver múltiplas solicitações (suggestionIds.length > 1)
      // Se for apenas 1 solicitação, não gerar batch_id (será singular)
      if (suggestionIds.length > 1) {
        // Agrupar por batch_id existente ou criar um novo para todas
        const batches = new Map<string, string[]>();
        let defaultBatchId: string | null = null;

        suggestions?.forEach((suggestion: any) => {
          if (suggestion.batch_id) {
            if (!batches.has(suggestion.batch_id)) {
              batches.set(suggestion.batch_id, []);
            }
            batches.get(suggestion.batch_id)!.push(suggestion.id);
          } else {
            // Se não tem batch_id, agrupar todas em um único batch
            if (!defaultBatchId) {
              defaultBatchId = generateUUID();
            }
            if (!batches.has(defaultBatchId)) {
              batches.set(defaultBatchId, []);
            }
            batches.get(defaultBatchId)!.push(suggestion.id);
          }
        });

        // Atualizar cada batch com o mesmo batch_id, batch_name e status pending
        for (const [batchId, ids] of batches.entries()) {
          const updateData: any = {
            status: 'pending' as any,
            batch_id: batchId, // Garantir que todas tenham o mesmo batch_id
            proposal_id: proposalId, // Vincular à proposta
            current_approver_id: null,
            current_approver_name: firstProfileNamePlural,
            approval_level: 1
          };

          // Se houver nome do lote, adicionar
          if (batchName && batchName.trim()) {
            updateData.batch_name = batchName.trim();
          }

          const { error: updateError } = await supabase
            .from('price_suggestions')
            .update(updateData)
            .in('id', ids);

          if (updateError) {
            console.error('❌ Erro ao atualizar batch:', updateError);
            throw updateError;
          }
        }
      } else {
        // Se for apenas 1 solicitação, apenas atualizar status para pending (sem batch_id)
        const { error: updateError } = await supabase
          .from('price_suggestions')
          .update({
            status: 'pending' as any,
            proposal_id: proposalId, // Vincular à proposta
            current_approver_id: null,
            current_approver_name: firstProfileNamePlural,
            approval_level: 1
          })
          .in('id', suggestionIds);

        if (updateError) {
          console.error('❌ Erro ao atualizar solicitação:', updateError);
          throw updateError;
        }
      }

      // Enviar notificações para todos os revisores do primeiro nível
      if (reviewerIds.length > 0) {
        try {
          await createNotificationForUsers(
            reviewerIds,
            'approval_pending',
            'Nova Solicitação de Aprovação',
            `Há ${suggestionIds.length} nova(s) solicitação(ões) aguardando sua análise como ${firstProfileNamePlural}.`,
            {
              url: '/approvals'
            }
          );
          console.log(`✅ ${reviewerIds.length} notificações enviadas para perfil: ${firstProfile}`);
        } catch (notifErr) {
          console.error('Erro ao enviar notificações iniciais:', notifErr);
        }
      }

      toast.success(`${suggestionIds.length} solicitação(ões) enviada(s) para aprovação com sucesso!`);

      // Limpar os cards e nome do lote após enviar
      setAddedCards([]);
      setBatchName('');

      // Invalida o cache para garantir que os dados novos apareçam
      invalidarCaches();

      // Recarregar lista de solicitações
      if (activeTab === 'my-requests') {
        loadMyRequests();
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar solicitações para aprovação:', error);
      toast.error("Erro ao enviar solicitações: " + (error?.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddedCard = async (cardId: string, suggestionId?: string) => {
    if (!confirm('Deseja realmente remover esta solicitação do lote?')) return;

    try {
      if (suggestionId) {
        setLoading(true);
        // Deletar do banco de dados já que é um rascunho temporário
        const { error } = await supabase
          .from('price_suggestions')
          .delete()
          .eq('id', suggestionId);

        if (error) throw error;
      }

      // Remover do state local
      setAddedCards(prev => prev.filter(card => card.id !== cardId));
      toast.success("Solicitação removida com sucesso!");
    } catch (error: any) {
      console.error('Erro ao remover card:', error);
      toast.error("Erro ao remover: " + (error.message || "Erro desconhecido"));
    } finally {
      if (suggestionId) setLoading(false);
    }
  };

  const invalidarCaches = () => {
    const cacheKey = `price_request_my_requests_cache_${user?.id}`;
    const cacheTimestampKey = `price_request_my_requests_cache_timestamp_${user?.id}`;
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(cacheTimestampKey);
    removeCache('approvals_suggestions_cache');
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta solicitação? Esta ação não pode ser desfeita.')) {
      return;
    }

    setLoadingRequests(true);
    try {
      const { error } = await supabase
        .from('price_suggestions')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      invalidarCaches();

      toast.success("Solicitação excluída com sucesso!");
      loadMyRequests(false);

      // Forçar atualização
      setTimeout(() => {
        loadMyRequests(false);
      }, 500);
    } catch (error: any) {
      console.error('Erro ao excluir solicitação:', error);
      toast.error("Erro ao excluir solicitação: " + (error?.message || 'Erro desconhecido'));
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleDeleteProposal = async (batchKey: string) => {
    if (!confirm('Tem certeza que deseja excluir esta proposta completa? Todas as solicitações vinculadas serão removidas.')) {
      return;
    }

    setLoadingRequests(true);
    try {
      // Check if batchKey is a UUID (meaning it's a real proposal or batch_id)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchKey);

      if (isUUID) {
        // Try deleting from commercial_proposals first
        const { error: propError } = await supabase
          .from('commercial_proposals' as any)
          .delete()
          .eq('id', batchKey);

        if (propError) {
          console.warn('Erro ao excluir de commercial_proposals (pode não existir ainda):', propError);
          // Fallback: delete by batch_id in price_suggestions
          const { error: batchError } = await supabase
            .from('price_suggestions')
            .delete()
            .eq('batch_id', batchKey);

          if (batchError) throw batchError;
        } else {
          // Also clean up any price suggestions that might have been unlinked but we want gone (optional, but user wants "delete")
          // Since migration sets ON DELETE SET NULL, we need to explicitly delete them if we want them gone
          const { error: cleanError } = await supabase
            .from('price_suggestions')
            .delete()
            .eq('proposal_id', null) // Assuming they were just unlinked. Risky if other unrelated nulls exist.
          // Better: we assume the user wants EVERYTHING gone.
          // So if we delete the proposal, we should have deleted the items first or used Cascade.
          // Since we used SET NULL, they become orphaned.
          // Let's rely on the previous logic: if we delete the proposal ID, we are good.
        }

        // Ensure items are deleted (if migration didn't cascade)
        await supabase.from('price_suggestions').delete().eq('batch_id', batchKey);
        await supabase.from('price_suggestions').delete().eq('proposal_id', batchKey);
      } else {
        // It's a generated key (timestamp based), delete individual items found in state
        const batchItems = myRequests.find(r => r.batchKey === batchKey)?.requests || [];
        const idsToDelete = batchItems.map((r: any) => r.id);

        if (idsToDelete.length > 0) {
          const { error } = await supabase
            .from('price_suggestions')
            .delete()
            .in('id', idsToDelete);

          if (error) throw error;
        }
      }

      invalidarCaches();

      toast.success("Proposta excluída com sucesso!");
      loadMyRequests(false);

      setTimeout(() => {
        loadMyRequests(false);
      }, 500);
    } catch (error: any) {
      console.error('Erro ao excluir proposta:', error);
      toast.error("Erro ao excluir proposta: " + (error?.message || 'Erro desconhecido'));
    } finally {
      setLoadingRequests(false);
    }
  };

  if (dbLoadingHook) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Success screen
  if (savedSuggestion) {
    const formatDateTime = (dateString: string) => new Date(dateString).toLocaleString('pt-BR');
    const toReais = (cents: number | null | undefined) => {
      const n = Number(cents ?? 0);
      return n >= 20 ? n / 100 : n;
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-background dark:to-card">
        <div className="container mx-auto px-4 py-8 space-y-8">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-green-500 to-green-600 p-8 text-white shadow-2xl">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Button
                  variant="secondary"
                  onClick={() => navigate("/dashboard")}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao Dashboard
                </Button>
                <div>
                  <h1 className="text-3xl font-bold mb-2">Solicitação Enviada!</h1>
                  <p className="text-green-100">Sua solicitação de preço foi enviada para aprovação</p>
                </div>
              </div>
            </div>
          </div>

          <Card className="shadow-xl border-0 bg-white/80 dark:bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-12 w-12 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                {saveAsDraft ? "Rascunho Salvo com Sucesso!" : "Solicitação Enviada com Sucesso!"}
              </CardTitle>
              <p className="text-slate-600 dark:text-slate-400">
                {saveAsDraft
                  ? "O rascunho foi salvo e você pode continuar editando depois"
                  : "Os dados foram salvos e estão em processo de aprovação"}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-blue-700 dark:text-blue-300">Posto</Label>
                  </div>
                  <div className="space-y-1">
                    {savedSuggestion.stations_list && savedSuggestion.stations_list.length > 0 ? (
                      savedSuggestion.stations_list.map((station: any, idx: number) => (
                        <p key={idx} className="text-lg font-bold text-blue-900 dark:text-blue-100">
                          {station.name}
                        </p>
                      ))
                    ) : (
                      <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                        {savedSuggestion.stations?.name || savedSuggestion.station_id || 'N/A'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-green-700 dark:text-green-300">Cliente</Label>
                  </div>
                  <p className="text-xl font-bold text-green-900 dark:text-green-100">
                    {savedSuggestion.clients?.name || savedSuggestion.client_id || 'N/A'}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-purple-700 dark:text-purple-300">Produto</Label>
                  </div>
                  <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">{savedSuggestion.product}</p>
                </div>

                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-amber-700 dark:text-amber-300">Preço Sugerido</Label>
                  </div>
                  <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                    {formatPrice(toReais(savedSuggestion.final_price))}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-cyan-200 dark:border-cyan-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">Custo Total</Label>
                  </div>
                  <p className="text-xl font-bold text-cyan-900 dark:text-cyan-100">
                    {formatPrice(toReais(savedSuggestion.cost_price))}
                  </p>
                </div>

                <div className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl p-6 border border-pink-200 dark:border-pink-800">
                  <div className="flex items-center gap-3 mb-3">
                    <Label className="text-sm font-semibold text-pink-700 dark:text-pink-300">Data/Hora</Label>
                  </div>
                  <p className="text-lg font-semibold text-pink-900 dark:text-pink-100">
                    {formatDateTime(savedSuggestion.created_at)}
                  </p>
                </div>
              </div>

              {savedSuggestion.observations && (
                <div className="bg-slate-50 dark:bg-card/50 rounded-xl p-6">
                  <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">Observações</Label>
                  <p className="text-slate-600 dark:text-slate-400">{savedSuggestion.observations}</p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={() => {
                    setSavedSuggestion(null);
                    setFormData(initialFormData);
                    setCalculatedPrice(0);
                    setMargin(0);
                  }}
                  className="flex-1"
                >
                  Nova Solicitação
                </Button>
                <Button
                  onClick={() => navigate("/approvals")}
                  variant="outline"
                  className="flex-1"
                >
                  Ver Aprovações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }



  // Componente auxiliar para exibir um item de anexo
  const AttachmentItem = ({ attachment, fileName, cardId, index }: { attachment: string; fileName: string; cardId: string; index: number }) => {
    const modalKey = `${cardId}-${index}`;
    const isOpen = openAttachmentModals[modalKey] === index;

    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
        <Eye className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
          {fileName}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setOpenAttachmentModals(prev => ({ ...prev, [modalKey]: isOpen ? null : index }))}
        >
          <Eye className="h-3 w-3" />
        </Button>
        <ImageViewerModal
          isOpen={isOpen}
          onClose={() => setOpenAttachmentModals(prev => ({ ...prev, [modalKey]: null }))}
          imageUrl={attachment}
          imageName={fileName}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Header com gradiente moderno */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-4 text-white shadow-xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => navigate("/dashboard")}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm h-8"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar ao Dashboard
                </Button>
                <div>
                  <h1 className="text-xl font-bold mb-1">Solicitação de Preço</h1>
                  <p className="text-slate-200 text-sm">Solicite novos preços para análise e aprovação</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleN8NSync}
                disabled={syncingN8N}
                className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
                title="Sincronizar Custos"
              >
                <RefreshCcw className={`h-4 w-4 ${syncingN8N ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Header com botão de Nova Solicitação */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
            {activeTab === 'new' ? 'Nova Solicitação de Preço' : 'Minhas Solicitações'}
          </h2>
          <div className="flex gap-3">
            {activeTab === 'my-requests' && (
              <Button
                onClick={() => setActiveTab('new')}
                className="flex items-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Nova Solicitação
              </Button>
            )}
            {activeTab === 'new' && (
              <Button
                onClick={() => setActiveTab('my-requests')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Minhas Solicitações
              </Button>
            )}
          </div>
        </div>

        {/* Conteúdo baseado na aba ativa */}
        {activeTab === 'new' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <Card className="shadow-xl border-0 bg-white/80 dark:bg-card/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Nova Solicitação de Preço
                  </CardTitle>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Preencha os dados para solicitar um novo preço</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Seção: Dados Básicos */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-border">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-xs">1</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                          Dados Básicos da Solicitação
                        </h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Posto */}
                      <div className="md:col-span-2">
                        <SisEmpresaCombobox
                          label="Posto"
                          value={formData.station_id}
                          onSelect={(stationId) => {
                            handleInputChange("station_id", stationId);
                            // Maintain compatibility with station_ids array
                            handleInputChange("station_ids", stationId ? [stationId] : []);
                          }}
                          required={true}
                        />
                      </div>

                      {/* Cliente */}
                      <div className="md:col-span-2">
                        <ClientCombobox
                          label="Cliente"
                          value={formData.client_id}
                          onSelect={(clientId, clientName) => handleInputChange("client_id", clientId)}
                          required={true}
                        />
                      </div>

                      {/* Produto */}
                      <div className="space-y-2">
                        <Label htmlFor="product" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          Produto <span className="text-red-500">*</span>
                        </Label>
                        <Select value={formData.product} onValueChange={(value) => handleInputChange("product", value)}>
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
                        <Label htmlFor="payment_method" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          Tipo de Pagamento
                        </Label>
                        {(() => {
                          // Gerar os itens primeiro para poder encontrar o valor correto
                          const generatePaymentItems = () => {
                            const items: Array<{ value: string; label: string; method: any }> = [];

                            // Se tem posto selecionado, usar APENAS métodos do posto
                            if (formData.station_id && formData.station_id !== 'none' && stationPaymentMethods.length > 0) {
                              const grouped = new Map<string, any>();
                              stationPaymentMethods
                                .filter(m => m && m.TAXA != null && m.CARTAO)
                                .forEach(method => {
                                  const uniqueKey = `${method.CARTAO}|${method.TAXA}`;
                                  if (!grouped.has(uniqueKey)) {
                                    grouped.set(uniqueKey, method);
                                  }
                                });
                              Array.from(grouped.values()).forEach((method, index) => {
                                const uniqueValue = `${method.CARTAO}|${method.TAXA}|${method.ID_POSTO || 'all'}|${index}`;
                                items.push({
                                  value: uniqueValue,
                                  label: `${method.CARTAO} ${method.TAXA ? `(${method.TAXA}%)` : ''}`,
                                  method
                                });
                              });
                            } else if ((!formData.station_id || formData.station_id === 'none') && paymentMethods && paymentMethods.length > 0) {
                              // Se não tem posto, usar métodos gerais
                              const groupedByName = new Map<string, any>();
                              paymentMethods
                                .filter(m => m && m.TAXA != null && m.CARTAO)
                                .forEach(method => {
                                  const cardName = method.CARTAO;
                                  if (cardName && !groupedByName.has(cardName)) {
                                    groupedByName.set(cardName, method);
                                  }
                                });
                              Array.from(groupedByName.values()).forEach((method, index) => {
                                const uniqueValue = `${method.CARTAO}|${method.TAXA || 0}|all|${index}`;
                                items.push({
                                  value: uniqueValue,
                                  label: `${method.CARTAO} ${method.TAXA ? `(${method.TAXA}%)` : ''}`,
                                  method
                                });
                              });
                            }

                            return items;
                          };

                          const paymentItems = generatePaymentItems();

                          // Encontrar o valor correto baseado no CARTAO armazenado
                          const findSelectedValue = () => {
                            if (!formData.payment_method_id || formData.payment_method_id === "none") {
                              return "none";
                            }

                            // Procurar o item que corresponde ao CARTAO armazenado
                            const foundItem = paymentItems.find(item => item.method.CARTAO === formData.payment_method_id);
                            return foundItem ? foundItem.value : "none";
                          };

                          return (
                            <Select
                              value={findSelectedValue()}
                              onValueChange={(value) => {
                                if (value === "none") {
                                  handleInputChange("payment_method_id", "none");
                                  return;
                                }
                                // Encontrar o item correspondente e extrair o CARTAO
                                const selectedItem = paymentItems.find(item => item.value === value);
                                if (selectedItem) {
                                  handleInputChange("payment_method_id", selectedItem.method.CARTAO);
                                }
                              }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Selecione o tipo de pagamento" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {paymentItems.map((item, index) => (
                                  <SelectItem
                                    key={`payment-item-${item.value}-${index}`}
                                    value={item.value}
                                  >
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </div>

                      {/* Preço Atual */}
                      <div className="space-y-2">
                        <Label htmlFor="current_price" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-9"
                          translate="no"
                        />
                      </div>

                      {/* Preço Sugerido */}
                      <div className="space-y-2">
                        <Label htmlFor="suggested_price" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-9"
                          translate="no"
                        />
                      </div>

                      {/* ARLA - Preço de VENDA (aparece ao selecionar ARLA 32 Granel) */}
                      {formData.product === 'arla32_granel' && (
                        <div className="space-y-2 md:col-span-2">
                          <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-center justify-between mb-2">
                              <Label htmlFor="suggested_price_arla" className="text-sm font-semibold text-green-700 dark:text-green-300">
                                💰 Preço de VENDA do ARLA (R$/L)
                              </Label>
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                Consumo: 5% do volume
                              </span>
                            </div>
                            <Input
                              id="suggested_price_arla"
                              type="text"
                              inputMode="numeric"
                              placeholder="0,00"
                              value={formData.suggested_price}
                              onChange={(e) => handleInputChange("suggested_price", e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="h-9 bg-white dark:bg-card font-semibold"
                              translate="no"
                            />
                          </div>
                        </div>
                      )}

                      {/* ARLA - Preço de VENDA (aparece ao selecionar Diesel S-10 ou S-10 Aditivado) */}
                      {(formData.product === 's10' || formData.product === 's10_aditivado') && (
                        <div className="space-y-2 md:col-span-2">
                          <div className="bg-slate-50 dark:bg-secondary/20 p-3 rounded-lg border border-slate-200 dark:border-border">
                            <div className="flex items-center justify-between mb-2">
                              <Label htmlFor="arla_purchase_price" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Preço de Venda ARLA (R$/L)
                              </Label>
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                Consumo: 5% do volume
                              </span>
                            </div>
                            <Input
                              id="arla_purchase_price"
                              type="text"
                              inputMode="numeric"
                              placeholder="0,00"
                              value={formData.arla_purchase_price}
                              onChange={(e) => handleInputChange("arla_purchase_price", e.target.value)}
                              onWheel={(e) => e.currentTarget.blur()}
                              className="h-9 bg-white dark:bg-card"
                              translate="no"
                            />
                          </div>
                        </div>
                      )}

                      {/* Volume Feito */}
                      <div className="space-y-2">
                        <Label htmlFor="volume_made" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-9"
                        />
                      </div>

                      {/* Volume Projetado */}
                      <div className="space-y-2">
                        <Label htmlFor="volume_projected" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Informações Adicionais */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-border">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-xs">2</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                          Informações Adicionais
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Documento Anexável */}
                      <div className="space-y-2">
                        <Label htmlFor="reference_document" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
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
                        <Label htmlFor="observations" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Observações
                        </Label>
                        <Textarea
                          id="observations"
                          placeholder="Adicione observações sobre a solicitação..."
                          value={formData.observations}
                          onChange={(e) => handleInputChange("observations", e.target.value)}
                          className="w-full resize-none min-h-[72px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Custo - Oculto mas ainda carrega os dados */}
                  <div className="space-y-4 hidden">
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-border">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-bold text-xs">3</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Custo</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Custo de Compra */}
                      <div className="space-y-2">
                        <Label htmlFor="purchase_cost" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          Custo de Compra (R$/L) 🔒
                        </Label>
                        <Input
                          id="purchase_cost"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.purchase_cost}
                          readOnly
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-9 bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                        />
                        {/* Visualização de Custo e Origem */}
                        <div className="mt-2 space-y-2">
                          {priceOrigin && (
                            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                Origem do Custo:
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                                {priceOrigin.base_bandeira && priceOrigin.base_bandeira !== 'N/A' && (
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium">🚩 Bandeira:</span>
                                    <span>{priceOrigin.base_bandeira}</span>
                                  </div>
                                )}
                                {priceOrigin.base_nome && (
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium">📍 Base:</span>
                                    <span>{priceOrigin.base_nome}</span>
                                    {priceOrigin.base_codigo && (
                                      <span className="text-slate-500">({priceOrigin.base_codigo})</span>
                                    )}
                                  </div>
                                )}
                                {priceOrigin.forma_entrega && (
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium">🚚 Entrega:</span>
                                    <span>{priceOrigin.forma_entrega}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {/* Custo Total */}
                          {formData.purchase_cost && formData.freight_cost && (() => {
                            const purchaseCost = parseFloat(String(formData.purchase_cost).replace(',', '.')) || 0;
                            const freightCost = parseFloat(String(formData.freight_cost).replace(',', '.')) || 0;
                            const totalCost = purchaseCost + freightCost;
                            return totalCost > 0 ? (
                              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                                <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                                  Custo Total:
                                </div>
                                <div className="text-sm font-bold text-blue-900 dark:text-blue-100">
                                  {formatBrazilianCurrency(totalCost)}
                                </div>
                                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                  Custo: {formatBrazilianCurrency(purchaseCost)} +
                                  Frete: {formatBrazilianCurrency(freightCost)}
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                        {fetchStatus && (
                          <Alert className="mt-2">
                            <AlertTitle>
                              {fetchStatus.type === 'today' && 'Cotação de hoje encontrada'}
                              {fetchStatus.type === 'latest' && 'Usando cotação mais recente'}
                              {fetchStatus.type === 'reference' && 'Usando referência manual'}
                              {fetchStatus.type === 'none' && 'Sem dados de cotação'}
                              {fetchStatus.type === 'error' && 'Erro ao buscar cotação'}
                            </AlertTitle>
                            <AlertDescription>
                              {fetchStatus.type === 'latest' && `Data: ${fetchStatus.date ? new Date(fetchStatus.date).toLocaleDateString('pt-BR') : '-'}`}
                              {fetchStatus.type === 'reference' && `Data: ${fetchStatus.date ? new Date(fetchStatus.date).toLocaleDateString('pt-BR') : '-'}`}
                              {fetchStatus.type === 'today' && `Data: ${new Date().toLocaleDateString('pt-BR')}`}
                              {fetchStatus.type === 'none' && 'Não encontramos cotação nem referência para o posto/produto selecionados.'}
                              {fetchStatus.type === 'error' && (fetchStatus.message || 'Falha inesperada ao consultar a base de cotações.')}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>

                      {/* Frete */}
                      <div className="space-y-2">
                        <Label htmlFor="freight_cost" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          Frete (R$/L) 🔒
                        </Label>
                        <Input
                          id="freight_cost"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.freight_cost}
                          readOnly
                          onWheel={(e) => e.currentTarget.blur()}
                          className="h-9 bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                        />
                      </div>

                      {/* Custo de Compra do ARLA (somente para S10 ou S10 Aditivado) */}
                      {(formData.product === 's10' || formData.product === 's10_aditivado') && (
                        <div className="space-y-2 md:col-span-2">
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                            <Label htmlFor="arla_cost_price" className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 block">
                              💧 Custo de Compra do ARLA (R$/L) 🔒
                            </Label>
                            <Input
                              id="arla_cost_price"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={formData.arla_cost_price}
                              readOnly
                              onWheel={(e) => e.currentTarget.blur()}
                              className="h-9 bg-slate-100 dark:bg-slate-700 cursor-not-allowed"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <Button
                      onClick={() => handleSubmit(false)}
                      disabled={loading || dbLoadingHook}
                      className="flex items-center gap-2 h-10 px-6 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <Plus className="h-4 w-4" />
                      {loading ? "Adicionando..." : "Adicionar"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSubmit(true)}
                      disabled={loading || dbLoadingHook}
                      className="flex items-center gap-2 h-10 px-6 border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                    >
                      <Save className="h-4 w-4" />
                      Salvar Rascunho
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary Panel */}
            <div className="space-y-3">
              {/* Resultados Individuais por Posto */}
              {addedCards.length > 0 && (
                <Card className="shadow-sm border border-slate-200 dark:border-border bg-white dark:bg-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {addedCards.length > 1 ? `Lote de Solicitações (${addedCards.length})` : `Solicitação Individual`}
                      </CardTitle>
                      <Button
                        onClick={handleSendAllForApproval}
                        disabled={loading || addedCards.length === 0}
                        className="flex items-center gap-2 h-9 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                      >
                        <Send className="h-4 w-4" />
                        Enviar para Aprovação
                      </Button>
                    </div>
                    {/* Campo para nomear o lote (só aparece se houver múltiplas solicitações) */}
                    {addedCards.length > 1 && (
                      <div className="mt-3">
                        <Label htmlFor="batch-name" className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">
                          Nome do Lote (opcional)
                        </Label>
                        <Input
                          id="batch-name"
                          placeholder="Ex: Proposta Cliente X - Novembro 2025"
                          value={batchName}
                          onChange={(e) => setBatchName(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {addedCards.map((card) => (
                        <div
                          key={card.id}
                          className="bg-white dark:bg-card border border-slate-200 dark:border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                  {card.stationName.toUpperCase()}
                                  <span className="ml-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                                    {card.productLabel || card.product?.toUpperCase() || ''}
                                  </span>
                                </h3>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {card.volume ? `${card.volume} m³` : ''} {card.bandeira || card.location ? `| ${card.bandeira || card.location}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-xs text-slate-500 dark:text-slate-400">Resultado</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Líquido</p>
                                <p className={`text-base font-bold ${card.netResult >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {formatPrice(card.netResult)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAddedCard(card.id, card.suggestionId)}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Remover solicitação"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setAddedCards(prev =>
                                      prev.map(c =>
                                        c.id === card.id ? { ...c, expanded: !c.expanded } : c
                                      )
                                    );
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  <ChevronDown
                                    className={`h-5 w-5 text-slate-600 dark:text-slate-400 transition-transform ${card.expanded ? 'transform rotate-180' : ''
                                      }`}
                                  />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Análise de Custos Expandida */}
                          {card.expanded && card.costAnalysis && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-border">
                              <Card className="shadow-sm border border-slate-200 dark:border-border bg-slate-50 dark:bg-card/50">
                                <CardHeader className="pb-3 border-b border-slate-200 dark:border-border">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                      <BarChart className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                                    </div>
                                    <div>
                                      <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                        Análise de Custos
                                      </CardTitle>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="pt-3 space-y-2.5">
                                  <div className="space-y-2">
                                    {/* Custo Final por Litro */}
                                    <div className="p-3 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card">
                                      <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Final/L:</span>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                          {formatPrice4Decimals(card.costAnalysis.final_cost)}
                                        </span>
                                      </div>
                                      {/* Origem do Custo - pequeno abaixo do custo */}
                                      {priceOrigin && (
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-border">
                                          <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                                            📍 {priceOrigin.base_bandeira} - {priceOrigin.base_nome} ({priceOrigin.base_codigo}) | {priceOrigin.forma_entrega}
                                            {card.costAnalysis.feePercentage > 0 && (
                                              <span className="ml-1">• Taxa: {card.costAnalysis.feePercentage.toFixed(2)}%</span>
                                            )}
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    {/* Receita Total */}
                                    <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Receita Total:</span>
                                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {formatPrice(card.costAnalysis.total_revenue)}
                                      </span>
                                    </div>

                                    {/* Custo Total */}
                                    <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Total:</span>
                                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {formatPrice(card.costAnalysis.total_cost)}
                                      </span>
                                    </div>

                                    {/* Lucro Bruto */}
                                    <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro Bruto:</span>
                                      <span className={`text-sm font-semibold ${card.costAnalysis.gross_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {formatPrice(card.costAnalysis.gross_profit)}
                                      </span>
                                    </div>

                                    {/* Lucro por Litro */}
                                    <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro/Litro:</span>
                                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                        {formatPrice4Decimals(card.costAnalysis.profit_per_liter)}
                                      </span>
                                    </div>

                                    {/* Compensação ARLA */}
                                    {card.costAnalysis.arla_compensation !== 0 && (
                                      <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Compensação ARLA:</span>
                                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                          {formatPrice(card.costAnalysis.arla_compensation)}
                                        </span>
                                      </div>
                                    )}

                                    {/* Resultado Líquido */}
                                    <div className={`flex justify-between items-center p-3 rounded border ${card.costAnalysis.net_result >= 0 ? 'border-green-500/50 dark:border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-red-500/50 dark:border-red-500/30 bg-red-50/50 dark:bg-red-950/20'}`}>
                                      <div className="flex items-center gap-2">
                                        {card.costAnalysis.net_result >= 0 ? (
                                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                        ) : (
                                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                        )}
                                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                          Resultado Líquido:
                                        </span>
                                      </div>
                                      <span className={`text-sm font-bold ${card.costAnalysis.net_result >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {formatPrice(card.costAnalysis.net_result)}
                                      </span>
                                    </div>

                                    {/* Anexos */}
                                    {card.attachments && card.attachments.length > 0 && (
                                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-border">
                                        <div className="space-y-2">
                                          <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                            Anexos:
                                          </Label>
                                          <div className="flex flex-wrap gap-2">
                                            {card.attachments.map((attachment, idx) => {
                                              const fileName = attachment.split('/').pop() || `Anexo ${idx + 1}`;
                                              return (
                                                <AttachmentItem
                                                  key={idx}
                                                  attachment={attachment}
                                                  fileName={fileName}
                                                  cardId={card.id}
                                                  index={idx}
                                                />
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="shadow-sm border border-slate-200 dark:border-border bg-white dark:bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        Ajuste
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2.5">
                  {calculatedPrice > 0 ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center py-1.5">
                          <span className="text-xs text-slate-600 dark:text-slate-400">Preço Sugerido:</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(calculatedPrice)}</span>
                        </div>

                        {formData.current_price && formData.suggested_price && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-xs text-slate-600 dark:text-slate-400">Preço Atual:</span>
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(parsePriceToInteger(formData.current_price) / 100)}</span>
                          </div>
                        )}

                        {formData.current_price && formData.suggested_price && (
                          <>
                            <div className="flex justify-between items-center py-1.5 border-t border-slate-200 dark:border-border pt-2">
                              <span className="text-xs text-slate-600 dark:text-slate-400">Margem Custo:</span>
                              <span className={`text-sm font-semibold ${margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {margin} centavos
                              </span>
                            </div>
                            <div className="flex justify-between items-center py-1.5">
                              <span className="text-xs text-slate-600 dark:text-slate-400">Ajuste:</span>
                              <span className={`text-sm font-semibold ${(() => {
                                const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                                const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                                const adjustment = suggested - current;
                                return adjustment >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                              })()}`}>
                                {(() => {
                                  const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                                  const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                                  const adjustment = suggested - current;
                                  const adjustmentCents = Math.round(adjustment * 100);
                                  return `${adjustmentCents >= 0 ? '+' : ''}${adjustmentCents} centavos`;
                                })()}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {formData.current_price && formData.suggested_price && (() => {
                        const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                        const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                        const adjustment = suggested - current;
                        return adjustment !== 0;
                      })() && (
                          <div className="pt-2 mt-2 border-t border-slate-200 dark:border-border">
                            <div className="flex items-center gap-2">
                              {(() => {
                                const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                                const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                                const adjustment = suggested - current;
                                return adjustment >= 0 ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                );
                              })()}
                              <span className={`text-xs font-medium ${(() => {
                                const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                                const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                                const adjustment = suggested - current;
                                return adjustment >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                              })()}`}>
                                {(() => {
                                  const current = (parsePriceToInteger(formData.current_price) / 100) || 0;
                                  const suggested = (parsePriceToInteger(formData.suggested_price) / 100) || 0;
                                  const adjustment = suggested - current;
                                  return adjustment >= 0 ? 'Ajuste positivo' : 'Ajuste negativo';
                                })()}
                              </span>
                            </div>
                          </div>
                        )}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-3">
                      Preencha os valores para ver o cálculo da margem
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Análise de Custos - para múltiplos postos */}
              {formData.station_ids && formData.station_ids.length > 1 && (
                <div className="space-y-4">
                  {formData.station_ids.map((stationId) => {
                    const stationCost = stationCosts[stationId];
                    const station = stations.find(s => s.id === stationId);
                    if (!stationCost || !station) return null;

                    // Resolver taxa de pagamento para este posto (ou fallback geral)
                    let feePercentage = 0;
                    if (formData.payment_method_id && formData.payment_method_id !== 'none') {
                      const stationMethod = paymentMethods.find(pm => {
                        const methodStationId = String((pm as any).ID_POSTO || '');
                        const methodCard = pm.CARTAO || '';
                        return methodCard === formData.payment_method_id && methodStationId === String(stationId);
                      });

                      if (stationMethod) {
                        feePercentage = stationMethod.TAXA || 0;
                      } else {
                        // Fallback para taxa geral
                        const generalMethod = paymentMethods.find(pm =>
                          pm.CARTAO === formData.payment_method_id &&
                          (pm.ID_POSTO === 'all' || pm.ID_POSTO === 'GENERICO')
                        );
                        feePercentage = generalMethod?.TAXA || 0;
                      }
                    }

                    // Calcular valores para este posto on-the-fly
                    const volumeProjected = parseFloat(formData.volume_projected) || 0;
                    const volumeProjectedLiters = volumeProjected * 1000;
                    const suggestedPrice = (parsePriceToInteger(formData.suggested_price) / 100) || 0;

                    const baseCost = (stationCost.purchase_cost || 0) + (stationCost.freight_cost || 0);
                    const finalCost = baseCost * (1 + feePercentage / 100);
                    const totalRevenue = volumeProjectedLiters * suggestedPrice;
                    const totalCost = volumeProjectedLiters * finalCost;
                    const grossProfit = totalRevenue - totalCost;
                    const profitPerLiter = volumeProjectedLiters > 0 ? grossProfit / volumeProjectedLiters : 0;

                    // Compensação ARLA
                    let arlaCompensation = 0;
                    if (formData.product === 's10' || formData.product === 's10_aditivado') {
                      const arlaPurchaseSelection = (parsePriceToInteger(formData.arla_purchase_price) / 100) || 0;
                      const arlaCostFromDB = stationCost.arla_cost || 0;
                      const arlaMargin = arlaPurchaseSelection - arlaCostFromDB;
                      const arlaVolume = volumeProjectedLiters * 0.05;
                      arlaCompensation = arlaVolume * arlaMargin;
                    } else if (formData.product === 'arla32_granel') {
                      const arlaCostFromDB = stationCost.arla_cost || 0;
                      const arlaMargin = suggestedPrice - arlaCostFromDB;
                      arlaCompensation = volumeProjectedLiters * arlaMargin;
                    }

                    const netResult = grossProfit + arlaCompensation;

                    return (
                      <Card key={`cost-analysis-${stationId}`} className="shadow-sm border border-slate-200 dark:border-border bg-white dark:bg-card">
                        <CardHeader className="pb-3 border-b border-slate-200 dark:border-border">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                              <BarChart className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                            </div>
                            <div>
                              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                                Análise de Custos - {station.name}
                              </CardTitle>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-3 space-y-2.5">
                          <div className="space-y-2">
                            {/* Custo Final por Litro */}
                            <div className="p-3 rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-card/50">
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Final/L:</span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice4Decimals(finalCost)}</span>
                              </div>
                              {feePercentage > 0 && (
                                <div className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-border pt-2 mt-2 space-y-1">
                                  <div className="flex justify-between">
                                    <span>Base (compra + frete)/L:</span>
                                    <span>{formatPrice4Decimals(stationCost.purchase_cost + stationCost.freight_cost)}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
                                    <span>Taxa ({feePercentage.toFixed(2)}%):</span>
                                    <span>+{formatPrice4Decimals(finalCost - (stationCost.purchase_cost + stationCost.freight_cost))}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Receita Total */}
                            <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Receita Total:</span>
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(totalRevenue)}</span>
                            </div>

                            {/* Custo Total */}
                            <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Total:</span>
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(totalCost)}</span>
                            </div>

                            {/* Lucro Bruto */}
                            <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro Bruto:</span>
                              <span className={`text-sm font-semibold ${grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatPrice(grossProfit)}
                              </span>
                            </div>

                            {/* Lucro por Litro */}
                            <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro/Litro:</span>
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice4Decimals(profitPerLiter)}</span>
                            </div>

                            {/* Compensação ARLA */}
                            {arlaCompensation !== 0 && (
                              <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Compensação ARLA:</span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(arlaCompensation)}</span>
                              </div>
                            )}

                            {/* Resultado Líquido */}
                            <div className={`flex justify-between items-center p-3 rounded border ${netResult >= 0 ? 'border-green-500/50 dark:border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-red-500/50 dark:border-red-500/30 bg-red-50/50 dark:bg-red-950/20'}`}>
                              <div className="flex items-center gap-2">
                                {netResult >= 0 ? (
                                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                )}
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                  Resultado Líquido:
                                </span>
                              </div>
                              <span className={`text-sm font-bold ${netResult >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {formatPrice(netResult)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Análise de Custos - solicitação atual */}
              {(costCalculations.finalCost > 0 || costCalculations.totalRevenue > 0) && (
                <Card className="shadow-sm border border-slate-200 dark:border-border bg-white dark:bg-card">
                  <CardHeader className="pb-3 border-b border-slate-200 dark:border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <BarChart className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                          Análise de Custos
                        </CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-2.5">
                    <div className="space-y-2">
                      {/* Custo Final por Litro */}
                      <div className="p-3 rounded-lg border border-slate-200 dark:border-border bg-slate-50 dark:bg-card/50">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Final/L:</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice4Decimals(costCalculations.finalCost)}</span>
                        </div>
                        {(() => {
                          let feePercentage = 0;
                          if (formData.payment_method_id && formData.payment_method_id !== 'none') {
                            const stationMethod = stationPaymentMethods.find(pm => pm.CARTAO === formData.payment_method_id);
                            if (stationMethod) {
                              feePercentage = stationMethod.TAXA || 0;
                            } else {
                              const defaultMethod = paymentMethods.find(pm => pm.CARTAO === formData.payment_method_id);
                              feePercentage = defaultMethod?.TAXA || 0;
                            }
                          }
                          const purchaseCost = parseFloat(formData.purchase_cost) || 0;
                          const freightCost = parseFloat(formData.freight_cost) || 0;
                          const baseCostTotal = purchaseCost + freightCost;
                          return feePercentage > 0 ? (
                            <div className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-border pt-2 mt-2 space-y-1">
                              <div className="flex justify-between">
                                <span>Base (compra + frete)/L:</span>
                                <span>{formatPrice4Decimals(baseCostTotal)}</span>
                              </div>
                              <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
                                <span>Taxa ({feePercentage.toFixed(2)}%):</span>
                                <span>+{formatPrice4Decimals(costCalculations.finalCost - baseCostTotal)}</span>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>

                      {/* Receita Total */}
                      <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Receita Total:</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(costCalculations.totalRevenue)}</span>
                      </div>

                      {/* Custo Total */}
                      <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Custo Total:</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(costCalculations.totalCost)}</span>
                      </div>

                      {/* Lucro Bruto */}
                      <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro Bruto:</span>
                        <span className={`text-sm font-semibold ${costCalculations.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatPrice(costCalculations.grossProfit)}
                        </span>
                      </div>

                      {/* Lucro por Litro */}
                      <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Lucro/Litro:</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice4Decimals(costCalculations.profitPerLiter)}</span>
                      </div>

                      {/* Compensação ARLA */}
                      {costCalculations.arlaCompensation !== 0 && (
                        <div className="flex justify-between items-center p-2.5 rounded border border-slate-200 dark:border-border bg-white dark:bg-card/50">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Compensação ARLA:</span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatPrice(costCalculations.arlaCompensation)}</span>
                        </div>
                      )}

                      {/* Resultado Líquido */}
                      <div className={`flex justify-between items-center p-3 rounded border ${costCalculations.netResult >= 0 ? 'border-green-500/50 dark:border-green-500/30 bg-green-50/50 dark:bg-green-950/20' : 'border-red-500/50 dark:border-red-500/30 bg-red-50/50 dark:bg-red-950/20'}`}>
                        <div className="flex items-center gap-2">
                          {costCalculations.netResult >= 0 ? (
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          )}
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Resultado Líquido:
                          </span>
                        </div>
                        <span className={`text-sm font-bold ${costCalculations.netResult >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatPrice(costCalculations.netResult)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

            </div>
          </div>
        )}

        {activeTab === 'my-requests' && (
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
                  total={myRequests.length}
                  pending={myRequests.filter(r => r.type !== 'batch' && r.status === 'pending').length}
                  approved={myRequests.filter(r => r.type !== 'batch' && r.status === 'approved').length}
                  rejected={myRequests.filter(r => r.type !== 'batch' && r.status === 'rejected').length}
                />

                {/* My Requests List */}
                <motion.div
                  className="space-y-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <AnimatePresence mode="popLayout">
                    {myRequests.map((request, index) => {
                      // Se for um lote, mostrar card compacto de proposta comercial
                      if (request.type === 'batch' && request.requests) {
                        const batch = request.requests;
                        const firstRequest = batch[0];
                        const proposalDate = new Date(firstRequest.created_at).toLocaleDateString('pt-BR');
                        const proposalNumber = index + 1;

                        // Verificar se todos os clientes são iguais
                        const uniqueClients = new Set(batch.map((r: any) => r.client_id || 'unknown'));
                        const allSameClient = uniqueClients.size === 1;
                        const displayClient = allSameClient ? firstRequest.clients : batch[0].clients;

                        // Verificar se todos os postos são iguais
                        const uniqueStations = new Set(batch.map((r: any) => {
                          const station = r.stations || r.stations_list?.[0];
                          return station?.name || station?.code || 'unknown';
                        }));
                        const allSameStation = uniqueStations.size === 1;
                        const displayStation = allSameStation
                          ? (firstRequest.stations || firstRequest.stations_list?.[0])
                          : (batch[0].stations || batch[0].stations_list?.[0]);

                        // Determinar status geral do lote
                        const allApproved = batch.every((r: any) => r.status === 'approved');
                        const hasPending = batch.some((r: any) => r.status === 'pending');
                        const hasPriceSuggested = batch.some((r: any) => r.status === 'price_suggested');
                        const allRejected = batch.every((r: any) => r.status === 'rejected');

                        let generalStatus = 'pending';
                        if (allApproved) {
                          generalStatus = 'approved';
                        } else if (hasPriceSuggested && !hasPending) {
                          generalStatus = 'price_suggested';
                        } else if (hasPending) {
                          generalStatus = 'pending';
                        } else if (allRejected) {
                          generalStatus = 'rejected';
                        } else {
                          // Se houver mix de status, priorizar: approved > price_suggested > pending > rejected
                          const hasAnyApproved = batch.some((r: any) => r.status === 'approved');
                          if (hasAnyApproved) {
                            generalStatus = 'pending'; // Ainda tem aprovações pendentes
                          } else if (hasPriceSuggested) {
                            generalStatus = 'price_suggested';
                          } else {
                            generalStatus = 'rejected';
                          }
                        }

                        return (
                          <motion.div
                            key={request.batchKey}
                            variants={itemVariants}
                            layout
                            whileHover="hover"
                            whileTap="tap"
                          >
                            <Card className="hover:shadow-lg transition-shadow">
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {request.batch_name || 'Proposta Comercial'}
                                      </span>
                                      {generalStatus === 'approved' ? (
                                        <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>
                                      ) : generalStatus === 'pending' ? (
                                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Aguardando Aprovação</Badge>
                                      ) : generalStatus === 'price_suggested' ? (
                                        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300"><DollarSign className="h-3 w-3 mr-1" />Preço Sugerido</Badge>
                                      ) : (
                                        <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>
                                      )}
                                    </div>
                                    <div className="space-y-1 text-sm text-slate-600 dark:text-slate-400">
                                      {displayClient && (
                                        <p>
                                          <span className="font-medium">Cliente:</span> {displayClient.name || 'N/A'}
                                          {!allSameClient && <span className="text-xs ml-1">(+{uniqueClients.size - 1} outros)</span>}
                                        </p>
                                      )}
                                      {displayStation && (
                                        <p>
                                          <span className="font-medium">Posto:</span> {displayStation.name || 'N/A'}
                                          {!allSameStation && <span className="text-xs ml-1">(+{uniqueStations.size - 1} outros)</span>}
                                        </p>
                                      )}
                                      <p>Criado em: {proposalDate}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteProposal(request.batchKey)}
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Excluir
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setExpandedProposal(request.batchKey)}
                                    >
                                      <Maximize2 className="h-4 w-4 mr-2" />
                                      Ver Completo
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card >

                            {/* Modal com visualização completa */}
                            <Dialog open={expandedProposal === request.batchKey
                            } onOpenChange={(open) => !open && setExpandedProposal(null)}>
                              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:overflow-visible print:p-0">
                                <ProposalFullView
                                  batch={batch}
                                  proposalNumber={proposalNumber}
                                  proposalDate={proposalDate}
                                  generalStatus={generalStatus}
                                  user={user}
                                />
                              </DialogContent>
                            </Dialog>
                          </motion.div>
                        );
                      }

                      // Visualização normal para solicitações individuais
                      return (
                        <motion.div
                          key={request.id}
                          variants={itemVariants}
                          layout
                          whileHover="hover"
                          whileTap="tap"
                        >
                          <Card className="hover:shadow-lg transition-shadow">
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 gap-4">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {request.stations_list && request.stations_list.length > 0
                                        ? request.stations_list.map((s: any) => s.name).join(', ')
                                        : (request.stations?.name || 'Posto')
                                      } - {request.clients?.name || 'Cliente'}
                                    </span>
                                    {request.status === 'pending' && (
                                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
                                    )}
                                    {request.status === 'approved' && (
                                      <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>
                                    )}
                                    {request.status === 'rejected' && (
                                      <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Criado em: {new Date(request.created_at).toLocaleDateString('pt-BR')} | Enviado por: {formatNameFromEmail(request.requester_name || request.requester?.name || user?.user_metadata?.name || 'Eu')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {(request.status === 'draft' || request.status === 'pending' || String(request.status || '').toLowerCase().includes('approval')) && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingRequest(request);
                                          setShowEditModal(true);
                                        }}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Editar
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteRequest(request.id)}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedRequest(request);
                                      setShowRequestDetails(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Ver Detalhes
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {myRequests.length === 0 && (
                    <motion.div variants={itemVariants}>
                      <Card>
                        <CardContent className="p-12 text-center">
                          <p className="text-slate-600 dark:text-slate-400">Nenhuma solicitação encontrada</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </motion.div>
              </>
            )}
          </div>
        )}


        {/* Image Viewer Modal */}
        < ImageViewerModal
          isOpen={imageViewerOpen}
          onClose={() => setImageViewerOpen(false)}
          imageUrl={selectedImage}
          imageName="Anexo da Referência"
        />

        {/* Approval Details Modal - Read Only */}
        {
          showRequestDetails && selectedRequest && (
            <ApprovalDetailsModal
              isOpen={showRequestDetails}
              onClose={() => {
                setShowRequestDetails(false);
                setSelectedRequest(null);
              }}
              suggestion={selectedRequest}
              onApprove={() => { }}
              onReject={() => { }}
              loading={false}
              readOnly={true}
            />
          )
        }

        {/* Edit Request Modal */}
        <EditRequestModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingRequest(null);
          }}
          request={editingRequest}
          onSuccess={() => {
            loadMyRequests(); // Recarregar lista após edição
          }}
        />
      </div>
    </div>
  );
}