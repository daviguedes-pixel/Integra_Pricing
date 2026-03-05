import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Station {
  id: string;
  name: string;
  code: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  bandeira?: string;
  municipio?: string;
  uf?: string;
  active: boolean;
}

interface Client {
  id: string;
  name: string;
  code: string;
  contact_email?: string;
  contact_phone?: string;
  active: boolean;
}

interface PaymentMethod {
  ID_POSTO: string;
  POSTO: string;
  TAXA: number;
  PRAZO: string;
  CARTAO: string;
}

interface PriceSuggestion {
  id: string;
  station_id: string;
  client_id: string;
  product: 'etanol' | 'gasolina_comum' | 'gasolina_aditivada' | 's10' | 's500';
  payment_method_id: string;
  cost_price: number;
  margin_cents: number;
  final_price: number;
  reference_type?: 'nf' | 'print_portal' | 'print_conversa' | 'sem_referencia';
  observations?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  requested_by: string;
  approved_by?: string;
  approved_at?: string;
  attachments?: string[];
  created_at: string;
  updated_at: string;
}

interface PriceHistory {
  id: string;
  suggestion_id?: string;
  station_id?: string;
  client_id?: string;
  product: 'etanol' | 'gasolina_comum' | 'gasolina_aditivada' | 's10' | 's500';
  old_price?: number;
  new_price: number;
  margin_cents: number;
  created_at: string;
  approved_by: string;
  change_type?: string;
  stations?: { name: string };
  clients?: { name: string };
  price_suggestions?: { status: 'draft' | 'pending' | 'approved' | 'rejected' };
}

export const useDatabase = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [suggestions, setSuggestions] = useState<PriceSuggestion[]>([]);

  // Load initial data
  useEffect(() => {
    const loadAllData = async () => {
      await Promise.all([
        loadStations(),
        loadClients(),
        loadPaymentMethods(),
        loadPriceHistoryFunc(),
        loadSuggestions()
      ]);
    };

    loadAllData();
  }, []);

  const loadStations = async () => {
    try {
      // Tentar usar a função RPC que já busca id_empresa
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_sis_empresa_stations');

      if (!rpcError && rpcData) {
        console.log('✅ Postos carregados via RPC:', rpcData.length);
        const stationsWithActive = (rpcData as any)?.map((station: any) => ({
          id: String(station.id_empresa || station.cnpj_cpf || `${station.nome_empresa}-${Math.random()}`),
          name: station.nome_empresa,
          code: station.cnpj_cpf,
          latitude: station.latitude,
          longitude: station.longitude,
          bandeira: station.bandeira,
          rede: station.rede,
          municipio: station.municipio,
          uf: station.uf,
          active: true
        })) || [];

        setStations(stationsWithActive);
        console.log('📊 Total de postos:', stationsWithActive.length);
        return;
      }

      // Fallback: buscar diretamente sem id_empresa
      console.log('🏪 Carregando postos diretamente da tabela sis_empresa...');
      const { data, error } = await supabase
        .from('sis_empresa')
        .select('nome_empresa, cnpj_cpf, latitude, longitude, bandeira, rede, registro_ativo, municipio, uf')
        .order('nome_empresa');

      if (error) {
        console.error('❌ Erro ao carregar sis_empresa:', error);
        setStations([]);
        return;
      }

      console.log('✅ Postos brutos carregados:', data?.length || 0);

      const stationsWithActive = (data as any)
        ?.map((station: any) => ({
          id: station.cnpj_cpf || `${station.nome_empresa}-${Math.random()}`,
          name: station.nome_empresa,
          code: station.cnpj_cpf,
          latitude: station.latitude,
          longitude: station.longitude,
          bandeira: station.bandeira,
          rede: station.rede,
          municipio: station.municipio,
          uf: station.uf,
          active: true
        })) || [];

      setStations(stationsWithActive);
      console.log('📊 Total de postos:', stationsWithActive.length);
    } catch (error) {
      console.error('Error loading stations:', error);
      setStations([]);
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes' as any)
        .select('id_cliente, nome')
        .order('nome');

      if (error) throw error;
      // Mapear campos e adicionar active: true
      const clientsWithActive = (data as any)?.map((client: any) => ({
        id: client.id_cliente,
        name: client.nome,
        code: client.id_cliente,
        active: true
      })) || [];
      console.log('✅ loadClients: Clientes carregados:', clientsWithActive.length);
      setClients(clientsWithActive);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      console.log('🔄 ===== CARREGANDO TIPOS DE PAGAMENTO =====');

      const { data, error } = await supabase
        .from('tipos_pagamento' as any)
        .select('*')
        .order('"CARTAO"');

      console.log('📊 Resultado da consulta:', { data, error });
      console.log('📊 Quantidade de registros:', data?.length || 0);

      if (error) {
        console.error('❌ Erro ao carregar tipos de pagamento:', error);
        setPaymentMethods([]);
        return;
      }

      console.log('✅ Tipos de pagamento carregados:', data);
      setPaymentMethods((data as any) || []);

    } catch (err) {
      console.error('❌ Error loading payment methods:', err);
      setPaymentMethods([]);
    }
  };

  const getPaymentMethodsForStation = useCallback(async (stationId: string) => {
    try {
      // Validar stationId
      if (!stationId || stationId === '' || stationId === 'none') {
        return [];
      }

      // Buscar tipos de pagamento que correspondem ao stationId (id_empresa)
      const { data, error } = await supabase
        .from('tipos_pagamento' as any)
        .select('*')
        .eq('ID_POSTO', stationId);

      if (error) {
        console.error('❌ Erro ao buscar tipos de pagamento:', error);
        return [];
      }

      // Deduplicate by CARTAO + ID_POSTO + TAXA to keep cards with same name but different rates
      const grouped = new Map<string, any>();
      (data || []).forEach((method: any) => {
        const cardName = method.CARTAO || method.name || 'Método';
        const postoId = method.ID_POSTO || 'all';
        const taxa = method.TAXA ?? 0;
        const key = `${cardName}_${postoId}_${taxa}`;
        if (!grouped.has(key)) {
          grouped.set(key, method);
        }
      });

      return Array.from(grouped.values()) as any[];

    } catch (error) {
      console.error('❌ Erro em getPaymentMethodsForStation:', error);
      return [];
    }
  }, []);

  const loadPriceHistoryFunc = async () => {
    try {
      console.log('🔍 Carregando histórico de price_suggestions aprovadas...');

      // SEMPRE buscar de price_suggestions aprovadas
      const { data: approvedSuggestions, error: suggestionsError } = await supabase
        .from('price_suggestions')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (suggestionsError) {
        console.error('❌ Erro ao carregar price_suggestions:', suggestionsError);
        setPriceHistory([]);
        return;
      }

      if (!approvedSuggestions || approvedSuggestions.length === 0) {
        console.log('⚠️ Nenhuma sugestão aprovada encontrada');
        setPriceHistory([]);
        return;
      }

      console.log('✅ Encontradas', approvedSuggestions.length, 'sugestões aprovadas');

      // Buscar todos os IDs únicos de postos, clientes e aprovadores
      const stationIds = [...new Set((approvedSuggestions || []).map((s: any) => s.station_id).filter(Boolean))];
      const clientIds = [...new Set((approvedSuggestions || []).map((s: any) => s.client_id).filter(Boolean))];

      console.log('📊 IDs únicos encontrados:');
      console.log('  📍 Postos:', stationIds.length, stationIds);
      console.log('  👤 Clientes:', clientIds.length, clientIds);

      // Extrair UUIDs de aprovadores
      const approverIds = [...new Set((approvedSuggestions || [])
        .map((s: any) => s.approved_by)
        .filter(Boolean)
        .filter((id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      )];

      // Buscar nomes dos postos em sis_empresa
      const stationsMap = new Map<string, string>();
      if (stationIds.length > 0) {
        console.log('🔍 Buscando nomes de', stationIds.length, 'postos em sis_empresa...');
        console.log('  📋 IDs originais:', stationIds);

        // Converter IDs para strings (id_empresa na tabela é text/varchar)
        const stringIds = stationIds.map(id => String(id)).filter(Boolean);

        console.log('  📋 IDs convertidos para strings:', stringIds);

        if (stringIds.length > 0) {
          console.log('  🔍 Executando RPC get_sis_empresa_by_ids com', stringIds.length, 'IDs...');
          // Usar função RPC para buscar empresas do schema cotacao
          const { data: sisEmpresaData, error: sisError } = await supabase.rpc('get_sis_empresa_by_ids', {
            p_ids: stringIds
          });

          if (sisError) {
            console.error('❌ Erro ao buscar postos em sis_empresa via RPC:', sisError);
            console.error('  Query:', 'id_empresa IN', stringIds);
          } else {
            console.log('  📊 Resultado da query RPC:', {
              encontrados: sisEmpresaData?.length || 0,
              esperados: stringIds.length,
              dados: sisEmpresaData
            });

            if (sisEmpresaData && sisEmpresaData.length > 0) {
              console.log('✅ Encontrados', sisEmpresaData.length, 'postos em sis_empresa');
              sisEmpresaData.forEach((e: any) => {
                const stationId = String(e.id_empresa);
                const stationName = e.nome_empresa || 'Posto Desconhecido';
                stationsMap.set(stationId, stationName);
                console.log('  📍 Posto mapeado:', stationId, '->', stationName);
              });
            } else {
              console.warn('⚠️ Nenhum posto encontrado em sis_empresa para os IDs:', stringIds);
            }
          }
        } else {
          console.warn('⚠️ Nenhum ID válido para buscar postos');
        }
      }

      // Buscar nomes dos clientes em clientes (os IDs são numéricos, não UUIDs)
      const clientsMap = new Map<string, string>();
      if (clientIds.length > 0) {
        console.log('🔍 Buscando nomes de', clientIds.length, 'clientes em clientes...');
        // Converter IDs para números se necessário
        const numericIds = clientIds.map(id => {
          const numId = typeof id === 'string' ? parseInt(id, 10) : id;
          return isNaN(numId) ? null : numId;
        }).filter(Boolean);

        if (numericIds.length > 0) {
          const { data: clientesData, error: clientesError } = await supabase
            .from('clientes' as any)
            .select('id_cliente, nome')
            .in('id_cliente', numericIds);

          if (clientesError) {
            console.error('❌ Erro ao buscar clientes:', clientesError);
          } else if (clientesData) {
            console.log('✅ Encontrados', clientesData.length, 'clientes na tabela clientes');
            clientesData.forEach((c: any) => {
              const clientId = String(c.id_cliente);
              clientsMap.set(clientId, c.nome);
              console.log('  👤 Cliente:', clientId, '->', c.nome);
            });
          }
        }
      }

      // Buscar nomes dos aprovadores
      const approversMap = new Map<string, string>();
      if (approverIds.length > 0) {
        const { data: approversData } = await supabase
          .from('user_profiles')
          .select('user_id, nome, email')
          .in('user_id', approverIds);

        if (approversData) {
          approversData.forEach((a: any) => {
            approversMap.set(a.user_id, a.nome || a.email);
          });
        }
      }

      // Converter price_suggestions aprovadas para formato de price_history com nomes
      // Usar nomes do JOIN se disponível, senão usar do mapa
      const convertedHistory = approvedSuggestions.map((suggestion: any) => ({
        id: suggestion.id,
        suggestion_id: suggestion.id,
        station_id: suggestion.station_id,
        client_id: suggestion.client_id,
        product: suggestion.product,
        old_price: null, // Não temos old_price em price_suggestions
        new_price: suggestion.final_price >= 100 ? suggestion.final_price / 100 : suggestion.final_price,
        margin_cents: suggestion.margin_cents || 0,
        approved_by: (() => {
          const approverId = suggestion.approved_by;
          if (!approverId) return 'Sistema';
          // Se for UUID, buscar nome do mapa
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(approverId)) {
            return approversMap.get(approverId) || approverId;
          }
          // Se não for UUID, pode ser email ou nome direto
          return approverId;
        })(),
        change_type: null,
        created_at: suggestion.approved_at || suggestion.created_at,
        stations: suggestion.station_id ? (() => {
          const stationId = String(suggestion.station_id);
          const stationName = stationsMap.get(stationId);
          if (!stationName) {
            console.warn('⚠️ Posto não encontrado no mapa:', stationId, 'Mapa tem:', Array.from(stationsMap.keys()));
          }
          return { name: stationName || 'Posto Desconhecido' };
        })() : null,
        clients: suggestion.client_id ? (() => {
          const clientId = String(suggestion.client_id);
          const clientName = clientsMap.get(clientId);
          if (!clientName) {
            console.warn('⚠️ Cliente não encontrado no mapa:', clientId, 'Mapa tem:', Array.from(clientsMap.keys()));
          }
          return { name: clientName || 'Cliente Desconhecido' };
        })() : null,
        price_suggestions: suggestion
      }));

      console.log('✅ Histórico carregado de price_suggestions:', convertedHistory.length, 'registros');
      setPriceHistory(convertedHistory);
    } catch (error) {
      console.error('❌ Error loading price history:', error);
      setPriceHistory([]);
    }
  };

  const loadSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  // CRUD helpers
  const addStation = async (station: Partial<Station>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('postos' as any)
        .insert([
          {
            razao_social: station.name!,
            cnpj: station.code!,
            endereco: station.address ?? null,
            latitude: station.latitude ?? null,
            longitude: station.longitude ?? null,
          } as any,
        ])
        .select('id_posto as id, razao_social as name, cnpj as code, endereco as address, latitude, longitude')
        .single();
      if (error) throw error;
      await loadStations();
      return data;
    } finally {
      setLoading(false);
    }
  };

  const addClient = async (client: Partial<Client>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes' as any)
        .insert([
          {
            nome: client.name!,
          } as any,
        ])
        .select('id_cliente as id, nome as name, id_cliente as code')
        .single();
      if (error) throw error;
      await loadClients();
      return data;
    } finally {
      setLoading(false);
    }
  };

  const addPaymentMethod = async (pm: Partial<PaymentMethod>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tipos_pagamento' as any)
        .insert([
          {
            CARTAO: (pm as any).CARTAO || 'Novo Cartão',
            POSTO: (pm as any).POSTO || 'GENERICO',
            TAXA: (pm as any).TAXA ?? 0,
            PRAZO: (pm as any).PRAZO ?? 0,
            ID_POSTO: (pm as any).ID_POSTO || 'GENERICO',
          },
        ])
        .select('*')
        .single();
      if (error) throw error;
      await loadPaymentMethods();
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Search helpers
  const searchPriceHistory = async (filters: any) => {
    let query = supabase
      .from('price_history')
      .select(`
        *,
        stations(name),
        clients(name),
        price_suggestions(status, station_id, client_id)
      `)
      .order('created_at', { ascending: false });

    if (filters?.product && filters.product !== 'all') {
      query = query.eq('product', filters.product);
    }
    if (filters?.station && filters.station !== 'all') {
      query = query.eq('station_id', filters.station);
    }
    if (filters?.client && filters.client !== 'all') {
      query = query.eq('client_id', filters.client);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Enriquecer dados com nomes de postos e clientes se não vieram das foreign keys
    const enrichedData = await Promise.all((data || []).map(async (item: any) => {
      // Se não tem nome do posto, buscar
      if (!item.stations?.name && item.station_id) {
        try {
          const { data: stationData } = await supabase
            .from('stations')
            .select('name')
            .eq('id', item.station_id)
            .single();

          if (stationData?.name) {
            item.stations = { name: stationData.name };
          }
        } catch (err) {
          console.warn('Erro ao buscar nome do posto:', err);
        }
      }

      // Se não tem nome do cliente, buscar
      if (!item.clients?.name && item.client_id) {
        try {
          const { data: clientData } = await supabase
            .from('clients')
            .select('name')
            .eq('id', item.client_id)
            .single();

          if (clientData?.name) {
            item.clients = { name: clientData.name };
          } else {
            // Tentar buscar na tabela clientes (formato antigo)
            const { data: clientesData } = await supabase
              .from('clientes' as any)
              .select('nome')
              .eq('id_cliente', item.client_id)
              .single();

            if (clientesData?.nome) {
              item.clients = { name: clientesData.nome };
            }
          }
        } catch (err) {
          console.warn('Erro ao buscar nome do cliente:', err);
        }
      }

      return item;
    }));

    return enrichedData;
  };

  // Refresh functions
  const refreshStations = () => loadStations();
  const refreshClients = () => loadClients();
  const refreshPaymentMethods = () => loadPaymentMethods();
  const refreshPriceHistory = () => loadPriceHistoryFunc();
  const refreshSuggestions = () => loadSuggestions();

  return {
    loading,
    stations,
    clients,
    paymentMethods,
    priceHistory,
    suggestions,
    // CRUD
    addStation,
    addClient,
    addPaymentMethod,
    // Search
    searchPriceHistory,
    // Station-specific
    getPaymentMethodsForStation,
    // Refresh
    refreshStations,
    refreshClients,
    refreshPaymentMethods,
    refreshPriceHistory,
    refreshSuggestions,
  };
};
