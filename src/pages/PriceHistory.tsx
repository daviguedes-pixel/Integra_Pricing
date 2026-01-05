import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, TrendingDown, Eye, Trophy, Users, UserPlus, CheckCircle2, ShoppingCart, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDatabase } from "@/hooks/useDatabase";
import { PriceHistoryFilters } from "@/components/PriceHistoryFilters";
import { PriceTimeline } from "@/components/PriceTimeline";
import { PriceStats } from "@/components/PriceStats";
import { formatBrazilianCurrency } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export default function PriceHistory() {
  const { toast } = useToast();
  const { priceHistory, searchPriceHistory, loading } = useDatabase();
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [topStats, setTopStats] = useState({
    topApprover: { name: '-', count: 0 },
    topClient: { name: '-', count: 0 },
    topRequester: { name: '-', count: 0 }
  });

  useEffect(() => {
    console.log('📊 PriceHistory - priceHistory atualizado:', priceHistory?.length || 0);
    if (priceHistory && priceHistory.length > 0) {
      setFilteredHistory(priceHistory);
      loadTopStats();
    } else {
      setFilteredHistory([]);
      // Tentar carregar diretamente se o hook não trouxe dados
      loadPriceHistoryDirectly();
    }

    // Real-time listener for price updates
    const channel = supabase
      .channel('price_history_realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes
          schema: 'public',
          table: 'price_suggestions'
        },
        () => {
          console.log('🔄 Mudança detectada em price_suggestions (PriceHistory)');
          loadPriceHistoryDirectly();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [priceHistory]);

  const loadPriceHistoryDirectly = async () => {
    try {
      console.log('🔍 Carregando histórico diretamente de price_suggestions aprovadas...');

      // SEMPRE buscar de price_suggestions aprovadas
      const { data: approvedSuggestions, error: suggestionsError } = await supabase
        .from('price_suggestions')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!suggestionsError && approvedSuggestions && approvedSuggestions.length > 0) {
        console.log('✅ Encontrados', approvedSuggestions.length, 'sugestões aprovadas');

        // Buscar todos os IDs únicos de postos, clientes e aprovadores
        const stationIds = [...new Set(approvedSuggestions.map((s: any) => s.station_id).filter(Boolean))];
        const clientIds = [...new Set(approvedSuggestions.map((s: any) => s.client_id).filter(Boolean))];

        // Extrair UUIDs de aprovadores (approved_by pode ser UUID ou texto)
        const approverIds = [...new Set(approvedSuggestions
          .map((s: any) => s.approved_by)
          .filter(Boolean)
          .filter((id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        )];

        // Buscar nomes dos postos em sis_empresa (os IDs são numéricos)
        const stationsMap = new Map<string, string>();
        if (stationIds.length > 0) {
          console.log('🔍 Buscando nomes de', stationIds.length, 'postos em sis_empresa...');
          // Converter IDs para strings (id_empresa na tabela é text/varchar)
          const stringIds = stationIds.map(id => String(id)).filter(Boolean);

          if (stringIds.length > 0) {
            // Usar função RPC para buscar empresas do schema cotacao
            // @ts-ignore
            const { data: sisEmpresaData, error: sisError } = await supabase.rpc('get_sis_empresa_by_ids', {
              p_ids: stringIds
            }) as { data: any[] | null, error: any };

            if (sisError) {
              console.error('❌ Erro ao buscar postos em sis_empresa via RPC:', sisError);
            } else if (sisEmpresaData) {
              console.log('✅ Encontrados', sisEmpresaData.length, 'postos em sis_empresa');
              sisEmpresaData.forEach((e: any) => {
                const stationId = String(e.id_empresa);
                const stationName = e.nome_empresa || 'Posto Desconhecido';
                stationsMap.set(stationId, stationName);
                console.log('  📍 Posto:', stationId, '->', stationName);
              });
            }
          }
        }

        // Buscar nomes dos clientes em clientes (os IDs são numéricos)
        const clientsMap = new Map<string, string>();
        if (clientIds.length > 0) {
          console.log('🔍 Buscando nomes de', clientIds.length, 'clientes em clientes...');
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

        // Converter para formato de price_history com nomes
        // Usar nomes do JOIN se disponível, senão usar do mapa
        const convertedHistory = approvedSuggestions.map((suggestion: any) => ({
          id: suggestion.id,
          suggestion_id: suggestion.id,
          station_id: suggestion.station_id,
          client_id: suggestion.client_id,
          product: suggestion.product,
          old_price: null,
          new_price: suggestion.final_price >= 100 ? suggestion.final_price / 100 : suggestion.final_price,
          margin_cents: suggestion.margin_cents || 0,
          approved_by: (() => {
            const approverId = suggestion.approved_by;
            if (!approverId) return 'Sistema';
            // Se for UUID, buscar nome do mapa
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(approverId)) {
              const name = approversMap.get(approverId);
              // Se o nome contém @, pegar apenas a parte antes do @
              if (name && name.includes('@')) {
                return name.split('@')[0];
              }
              return name || 'Desconhecido';
            }
            // Se não for UUID, pode ser email ou nome direto - remover email se houver
            if (approverId.includes('@')) {
              return approverId.split('@')[0];
            }
            return approverId;
          })(),
          change_type: null,
          created_at: suggestion.approved_at || suggestion.created_at,
          stations: suggestion.station_id ? (() => {
            const stationId = String(suggestion.station_id);
            const stationName = stationsMap.get(stationId);
            if (!stationName) {
              console.warn('⚠️ Posto não encontrado no mapa:', stationId);
            }
            return { name: stationName || 'Posto Desconhecido' };
          })() : null,
          clients: suggestion.client_id ? (() => {
            const clientId = String(suggestion.client_id);
            const clientName = clientsMap.get(clientId);
            if (!clientName) {
              console.warn('⚠️ Cliente não encontrado no mapa:', clientId);
            }
            return { name: clientName || 'Cliente Desconhecido' };
          })() : null,
          price_suggestions: suggestion
        }));

        console.log('📊 Histórico convertido com nomes:', convertedHistory.length);
        setFilteredHistory(convertedHistory);
        loadTopStats(clientsMap);
      } else {
        console.log('⚠️ Nenhuma sugestão aprovada encontrada');
      }
    } catch (error) {
      console.error('Erro ao carregar histórico diretamente:', error);
    }
  };

  const loadTopStats = async (clientsMapFromParent?: Map<string, string>) => {
    try {
      // Carregar aprovações para calcular top stats
      const { data: suggestions, error: suggestionsError } = await supabase
        .from('price_suggestions')
        .select('*')
        .in('status', ['approved', 'rejected']);

      if (suggestionsError) {
        console.error('Erro ao carregar sugestões:', suggestionsError);
        return;
      }

      if (!suggestions || suggestions.length === 0) {
        setTopStats({
          topApprover: { name: 'N/A', count: 0 },
          topClient: { name: 'N/A', count: 0 },
          topRequester: { name: 'N/A', count: 0 }
        });
        return;
      }

      // Buscar histórico de aprovações
      const { data: approvalHistory, error: approvalError } = await supabase
        .from('approval_history')
        .select('*')
        .eq('action', 'approved');

      if (approvalError) {
        console.error('Erro ao carregar histórico de aprovações:', approvalError);
      }

      // Contar aprovações por usuário
      const approvalCounts: { [key: string]: number } = {};
      if (approvalHistory && approvalHistory.length > 0) {
        approvalHistory.forEach(item => {
          const key = item.approver_name || 'Desconhecido';
          approvalCounts[key] = (approvalCounts[key] || 0) + 1;
        });
      }

      // Buscar clientes para mapear IDs para nomes
      // Tentar primeiro na tabela clients
      let clientsData: any[] = [];
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name');

      if (clients && clients.length > 0) {
        clientsData = clients.map(c => ({ id: c.id, nome: c.name }));
      } else {
        // Fallback para tabela clientes
        const { data: clientesData } = await supabase
          .from('clientes' as any)
          .select('id_cliente, nome');

        if (clientesData) {
          clientsData = clientesData.map((c: any) => ({ id: c.id_cliente, nome: c.nome }));
        }
      }

      // Contar por cliente usando nome do mapa
      const clientCounts: { [key: string]: number } = {};
      suggestions.forEach(suggestion => {
        const clientId = String(suggestion.client_id);
        // Primeiro tentar buscar no mapa de clientes
        const clientName = clientsMapFromParent?.get(clientId);
        if (clientName) {
          clientCounts[clientName] = (clientCounts[clientName] || 0) + 1;
        } else {
          // Fallback: buscar na lista de clientes
          const client = clientsData?.find(c => String(c.id) === clientId);
          const name = client?.nome || 'Sem cliente';
          clientCounts[name] = (clientCounts[name] || 0) + 1;
        }
      });

      // Buscar usuários do perfil para mapear IDs para nomes
      const { data: userProfiles } = await supabase
        .from('user_profiles')
        .select('user_id, nome, email');

      // Contar por solicitante usando nome
      const requesterCounts: { [key: string]: number } = {};
      suggestions.forEach(suggestion => {
        const user = userProfiles?.find(u => String(u.user_id) === String(suggestion.requested_by));
        const requesterName = user?.nome || user?.email?.split('@')[0] || 'Desconhecido';
        requesterCounts[requesterName] = (requesterCounts[requesterName] || 0) + 1;
      });

      // Encontrar tops
      const topApprover = Object.entries(approvalCounts)
        .sort(([, a], [, b]) => b - a)[0] || ['-', 0];

      const topClient = Object.entries(clientCounts)
        .sort(([, a], [, b]) => b - a)[0] || ['-', 0];

      const topRequester = Object.entries(requesterCounts)
        .sort(([, a], [, b]) => b - a)[0] || ['-', 0];

      setTopStats({
        topApprover: { name: topApprover[0], count: topApprover[1] },
        topClient: { name: topClient[0], count: topClient[1] },
        topRequester: { name: topRequester[0], count: topRequester[1] }
      });
    } catch (error) {
      console.error('Erro ao carregar top stats:', error);
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    const data = filteredHistory.length > 0 ? filteredHistory : priceHistory;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      totalChanges: data.length,
      approvedChanges: data.filter((item: any) => item.price_suggestions?.status === 'approved').length,
      pendingChanges: data.filter((item: any) => item.price_suggestions?.status === 'pending').length,
      rejectedChanges: data.filter((item: any) => item.price_suggestions?.status === 'rejected').length,
      averageIncrease: 0,
      averageDecrease: 0,
      averageMargin: 0,
      totalClients: new Set(data.map((item: any) => item.clients?.name || item.client_id).filter(Boolean)).size,
      totalStations: new Set(data.map((item: any) => item.stations?.name || item.station_id).filter(Boolean)).size,
      recentActivity: data.filter((item: any) => new Date(item.created_at) > sevenDaysAgo).length
    };

    // Calcular margem média (usando margin_cents)
    const itemsWithMargin = data.filter((item: any) => item.margin_cents != null && item.margin_cents !== undefined);
    if (itemsWithMargin.length > 0) {
      const totalMargin = itemsWithMargin.reduce((sum: number, item: any) => {
        // margin_cents está em centavos, converter para reais
        return sum + (item.margin_cents / 100);
      }, 0);
      stats.averageMargin = totalMargin / itemsWithMargin.length;
    }

    // Calcular variação média comparando preços consecutivos do mesmo produto/posto/cliente
    // Agrupar por produto, posto e cliente, ordenar por data e calcular diferenças
    const groupedData = new Map<string, any[]>();
    data.forEach((item: any) => {
      const key = `${item.product}-${item.station_id}-${item.client_id}`;
      if (!groupedData.has(key)) {
        groupedData.set(key, []);
      }
      groupedData.get(key)!.push(item);
    });

    const increases: number[] = [];
    const decreases: number[] = [];

    groupedData.forEach((items) => {
      // Ordenar por data
      const sorted = [...items].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Comparar preços consecutivos
      for (let i = 1; i < sorted.length; i++) {
        const prevPrice = sorted[i - 1].new_price;
        const currPrice = sorted[i].new_price;
        if (prevPrice && currPrice) {
          const diff = currPrice - prevPrice;
          if (diff > 0) {
            increases.push(diff);
          } else if (diff < 0) {
            decreases.push(Math.abs(diff));
          }
        }
      }
    });

    if (increases.length > 0) {
      stats.averageIncrease = increases.reduce((sum, val) => sum + val, 0) / increases.length;
    }

    if (decreases.length > 0) {
      stats.averageDecrease = decreases.reduce((sum, val) => sum + val, 0) / decreases.length;
    }

    return stats;
  };

  // Convert data to timeline format
  const convertToTimelineData = () => {
    const data = filteredHistory.length > 0 ? filteredHistory : priceHistory;

    return data.map((item: any) => {
      // Debug: verificar se temos o nome do cliente
      if (!item.clients?.name && item.client_id) {
        console.log('⚠️ Cliente sem nome:', {
          client_id: item.client_id,
          clients: item.clients,
          item_id: item.id
        });
      }

      return {
        id: item.id,
        date: item.created_at,
        client: item.clients?.name || (item.client_id ? `Cliente ${String(item.client_id).substring(0, 10)}` : 'Cliente'),
        station: item.stations?.name || (item.station_id ? `Posto ${String(item.station_id).substring(0, 10)}` : 'Posto'),
        product: getProductName(item.product),
        oldPrice: item.old_price,
        newPrice: item.new_price,
        status: 'approved' as 'approved', // price_history só contém aprovações
        approvedBy: item.approved_by,
        changeType: (item.old_price && item.new_price && item.old_price > 0
          ? (item.new_price > item.old_price ? 'up' : 'down')
          : item.change_type || 'up') as 'up' | 'down'
      };
    });
  };

  const handleFilter = (filters: any) => {
    try {
      const data = priceHistory || [];
      let filtered = [...data];

      // Filtrar por produto
      if (filters.product && filters.product !== 'all') {
        filtered = filtered.filter((item: any) => item.product === filters.product);
      }

      // Filtrar por posto
      if (filters.station && filters.station !== 'all' && filters.station !== undefined) {
        filtered = filtered.filter((item: any) =>
          String(item.station_id) === String(filters.station)
        );
      }

      // Filtrar por cliente
      if (filters.client && filters.client !== 'all' && filters.client !== undefined) {
        filtered = filtered.filter((item: any) =>
          String(item.client_id) === String(filters.client)
        );
      }


      // Ordenar
      if (filters.sortBy === 'price') {
        filtered.sort((a: any, b: any) => (b.new_price || 0) - (a.new_price || 0));
      } else {
        filtered.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }

      setFilteredHistory(filtered);

      toast({
        title: "Filtros aplicados",
        description: `${filtered.length} registro(s) encontrado(s)`
      });
    } catch (error) {
      console.error('Error filtering price history:', error);
      toast({
        title: "Erro",
        description: "Erro ao aplicar filtros",
        variant: "destructive"
      });
    }
  };

  const exportDashboardImage = async () => {
    try {
      toast({
        title: "Gerando imagem...",
        description: "Aguarde enquanto o dashboard é capturado"
      });

      // Carregar html2canvas dinamicamente
      let html2canvas: any;
      try {
        html2canvas = (await import('html2canvas')).default;
      } catch (importError) {
        // Se não conseguir importar, tentar carregar via CDN
        return new Promise<void>((resolve, reject) => {
          if ((window as any).html2canvas) {
            html2canvas = (window as any).html2canvas;
            captureDashboard(html2canvas).then(resolve).catch(reject);
            return;
          }

          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
          script.onload = () => {
            html2canvas = (window as any).html2canvas;
            captureDashboard(html2canvas).then(resolve).catch(reject);
          };
          script.onerror = () => {
            toast({
              title: "Erro",
              description: "Não foi possível carregar a biblioteca de exportação. Instale html2canvas: npm install html2canvas",
              variant: "destructive"
            });
            reject(new Error('html2canvas não disponível'));
          };
          document.head.appendChild(script);
        });
      }

      await captureDashboard(html2canvas);
    } catch (error) {
      console.error('Erro ao exportar dashboard:', error);
      toast({
        title: "Erro",
        description: "Erro ao exportar dashboard. Tente instalar: npm install html2canvas",
        variant: "destructive"
      });
    }
  };

  const captureDashboard = async (html2canvas: any) => {
    try {
      if (!html2canvas) {
        throw new Error('html2canvas não disponível');
      }

      // Encontrar o container principal do dashboard
      const dashboardElement = document.querySelector('.min-h-screen.bg-background');
      if (!dashboardElement) {
        throw new Error('Elemento do dashboard não encontrado');
      }

      // Capturar o dashboard como imagem
      const canvas = await html2canvas(dashboardElement as HTMLElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
        windowWidth: dashboardElement.scrollWidth,
        windowHeight: dashboardElement.scrollHeight
      });

      // Converter canvas para blob
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) {
          throw new Error('Erro ao gerar imagem');
        }

        // Criar link de download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `dashboard_historico_precos_${new Date().toISOString().split('T')[0]}.png`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
          title: "Exportação concluída",
          description: "Dashboard exportado com sucesso!"
        });
      }, 'image/png', 0.95);
    } catch (error) {
      console.error('Erro ao capturar dashboard:', error);
      throw error;
    }
  };

  const getProductName = (product: string) => {
    const names: { [key: string]: string } = {
      's10': 'Diesel S-10',
      's10_aditivado': 'Diesel S-10 Aditivado',
      'diesel_s500': 'Diesel S-500',
      'diesel_s500_aditivado': 'Diesel S-500 Aditivado',
      'arla32_granel': 'Arla 32 Granel',
      // Produtos legados (para compatibilidade)
      'gasolina_comum': 'Gasolina Comum',
      'gasolina_aditivada': 'Gasolina Aditivada',
      'etanol': 'Etanol',
      'diesel_comum': 'Diesel Comum',
      'diesel_s10': 'Diesel S-10',
      's500': 'Diesel S-500',
      'diesel_s10_aditivado': 'Diesel S-10 Aditivado',
      's500_aditivado': 'Diesel S-500 Aditivado',
      'arla': 'ARLA 32'
    };
    return names[product] || product;
  };

  // Removed mock history: data comes from useDatabase().priceHistory

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success/10 text-success">Aprovado</Badge>;
      case "rejected":
        return <Badge variant="destructive">Negado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const getChangeIcon = (change: string) => {
    return change === "up" ? (
      <TrendingUp className="h-4 w-4 text-destructive" />
    ) : (
      <TrendingDown className="h-4 w-4 text-success" />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl p-4 sm:p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Histórico de Preços</h1>
              <p className="text-blue-100 text-sm sm:text-base">Acompanhe todas as alterações de preços aprovadas</p>
            </div>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  exportDashboardImage();
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Dashboard
              </Button>
            </div>
          </div>
        </div>

        <PriceHistoryFilters onFilter={handleFilter} />

        {/* Statistics */}
        <PriceStats stats={calculateStats()} />

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-500/10 dark:bg-yellow-500/20 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Top Aprovador</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                    {topStats.topApprover.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    {topStats.topApprover.count} aprovações
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 dark:bg-green-500/20 rounded-full">
                  <ShoppingCart className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Top Cliente</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                    {topStats.topClient.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    {topStats.topClient.count} solicitações
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 dark:bg-blue-500/20 rounded-full">
                  <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Top Solicitante</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                    {topStats.topRequester.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    {topStats.topRequester.count} solicitações
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Linha do Tempo de Alterações</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredHistory.length > 0 || priceHistory.length > 0 ? (
              <PriceTimeline items={convertToTimelineData()} />
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg mb-2">Nenhum histórico encontrado</p>
                <p className="text-muted-foreground text-sm">
                  Os registros de histórico de preços aparecerão aqui quando houver aprovações.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}