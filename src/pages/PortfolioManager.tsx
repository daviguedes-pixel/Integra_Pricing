import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  User,
  DollarSign, 
  BarChart3, 
  PieChart, 
  Award,
  Target,
  Activity,
  Download,
  CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatBrazilianCurrency } from "@/lib/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { BarChart, Bar, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";

export default function PortfolioManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [userProfiles, setUserProfiles] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // SEMPRE buscar histórico de price_suggestions aprovadas
      let historyData: any[] = [];
      console.log('🔍 Carregando histórico de price_suggestions aprovadas...');
      const { data: approvedSuggestions, error: approvedSuggestionsError } = await supabase
        .from('price_suggestions')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (!approvedSuggestionsError && approvedSuggestions && approvedSuggestions.length > 0) {
        console.log('✅ Encontrados', approvedSuggestions.length, 'sugestões aprovadas');
        
        // Buscar IDs únicos
        const stationIds = [...new Set(approvedSuggestions.map((s: any) => s.station_id).filter(Boolean))];
        const clientIds = [...new Set(approvedSuggestions.map((s: any) => s.client_id).filter(Boolean))];
        const approverIds = [...new Set(approvedSuggestions
          .map((s: any) => s.approved_by)
          .filter(Boolean)
          .filter((id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        )];
        
        // Buscar nomes dos postos em sis_empresa
        const stationsMap = new Map<string, string>();
        if (stationIds.length > 0) {
          // Converter IDs para strings (id_empresa na tabela é text/varchar)
          const stringIds = stationIds.map(id => String(id)).filter(Boolean);
          
          if (stringIds.length > 0) {
            // Usar função RPC para buscar empresas do schema cotacao
            const { data: sisEmpresaData, error: sisError } = await supabase.rpc('get_sis_empresa_by_ids', {
              p_ids: stringIds
            });
            
            if (sisError) {
              console.error('❌ Erro ao buscar postos em sis_empresa via RPC:', sisError);
            } else if (sisEmpresaData) {
                sisEmpresaData.forEach((e: any) => {
                  const stationId = String(e.id_empresa);
                  stationsMap.set(stationId, e.nome_empresa || 'Posto Desconhecido');
                });
            }
          }
        }
        
        // Buscar nomes dos clientes em clientes
        const clientsMap = new Map<string, string>();
        if (clientIds.length > 0) {
          const numericIds = clientIds.map(id => {
            const numId = typeof id === 'string' ? parseInt(id, 10) : id;
            return isNaN(numId) ? null : numId;
          }).filter(Boolean);
          
          if (numericIds.length > 0) {
            const { data: clientesData } = await supabase
              .from('clientes' as any)
              .select('id_cliente, nome')
              .in('id_cliente', numericIds);
            
            if (clientesData) {
              clientesData.forEach((c: any) => {
                const clientId = String(c.id_cliente);
                clientsMap.set(clientId, c.nome);
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
        
        // Converter para formato de price_history
        historyData = approvedSuggestions.map((suggestion: any) => ({
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
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(approverId)) {
              return approversMap.get(approverId) || approverId;
            }
            return approverId;
          })(),
          change_type: null,
          created_at: suggestion.approved_at || suggestion.created_at,
          stations: suggestion.station_id ? (() => {
            const stationId = String(suggestion.station_id);
            return { name: stationsMap.get(stationId) || 'Posto Desconhecido' };
          })() : null,
          clients: suggestion.client_id ? (() => {
            const clientId = String(suggestion.client_id);
            return { name: clientsMap.get(clientId) || 'Cliente Desconhecido' };
          })() : null,
          price_suggestions: { status: suggestion.status, approved_by: suggestion.approved_by }
        }));
      }

      // Carregar sugestões de preço
      const { data: suggestionsData, error: suggestionsError } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); // Limitar para performance
      
      if (suggestionsError) {
        console.error('Erro ao carregar sugestões:', suggestionsError);
      }

      // Carregar clientes - tentar primeiro na tabela clients
      let clientsData: any[] = [];
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name');
      
      if (clients && clients.length > 0) {
        clientsData = clients.map(c => ({ id_cliente: c.id, nome: c.name }));
      } else {
        // Fallback para tabela clientes
        const { data: clientesData } = await supabase
          .from('clientes' as any)
          .select('id_cliente, nome');
        
        if (clientesData) {
          clientsData = clientesData;
        }
      }

      // Carregar perfis de usuário
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('user_id, email, nome');
      
      if (profilesError) {
        console.error('Erro ao carregar perfis:', profilesError);
      }

      // Enriquecer dados de histórico com nomes de postos e clientes
      const enrichedHistory = await Promise.all(historyData.map(async (item: any) => {
        // Buscar nome do posto se não vier
        if (!item.stations?.name && item.station_id) {
          try {
            const { data: stationData } = await supabase
              .from('stations')
              .select('name')
              .eq('id', item.station_id)
              .maybeSingle();
            
            if (stationData?.name) {
              item.stations = { name: stationData.name };
            }
          } catch (err) {
            console.warn('Erro ao buscar nome do posto:', err);
          }
        }
        
        // Buscar nome do cliente se não vier
        if (!item.clients?.name && item.client_id) {
          try {
            // Tentar clients primeiro
            const { data: clientData } = await supabase
              .from('clients')
              .select('name')
              .eq('id', item.client_id)
              .maybeSingle();
            
            if (clientData?.name) {
              item.clients = { name: clientData.name };
            } else {
              // Tentar clientes (formato antigo)
              const { data: clientesData } = await supabase
                .from('clientes' as any)
                .select('nome')
                .eq('id_cliente', item.client_id)
                .maybeSingle();
              
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
      
      setPriceHistory(enrichedHistory);
      console.log('📊 Total de registros no histórico:', enrichedHistory.length);
      setSuggestions(suggestionsData || []);
      setClients(clientsData || []);
      setUserProfiles(profilesData || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do portfólio",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Dados para gráfico de evolução de preços aprovados
  const getPriceEvolutionData = () => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map(date => {
      const dayHistory = priceHistory.filter(h => {
        const historyDate = new Date(h.created_at).toISOString().split('T')[0];
        return historyDate === date;
      });

      const totalApproved = dayHistory.length;
      const avgPrice = dayHistory.length > 0
        ? dayHistory.reduce((sum, h) => sum + (parseFloat(String(h.new_price)) || 0), 0) / dayHistory.length
        : 0;

      return {
        date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        aprovados: totalApproved,
        precoMedio: avgPrice
      };
    });
  };

  // Dados para gráfico de top solicitantes
  const getTopRequestersData = () => {
    const requesterCounts: { [key: string]: { count: number; name: string } } = {};

    suggestions.forEach(suggestion => {
      const userId = suggestion.requested_by;
      const user = userProfiles.find(u => String(u.user_id) === String(userId));
      const userName = user?.nome || user?.email || userId || 'Desconhecido';
      
      if (!requesterCounts[userName]) {
        requesterCounts[userName] = { count: 0, name: userName };
      }
      requesterCounts[userName].count++;
    });

    return Object.values(requesterCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => ({
        nome: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
        solicitacoes: item.count
      }));
  };

  // Dados para gráfico de margem média por pessoa
  const getAverageMarginByPersonData = () => {
    const marginByPerson: { [key: string]: { margins: number[]; name: string } } = {};

    priceHistory.forEach(history => {
      const approverName = history.approved_by || 'Desconhecido';
      
      if (!marginByPerson[approverName]) {
        marginByPerson[approverName] = { margins: [], name: approverName };
      }
      
      const margin = history.margin_cents ? history.margin_cents / 100 : 0;
      marginByPerson[approverName].margins.push(margin);
    });

    return Object.values(marginByPerson)
      .map(item => ({
        pessoa: item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name,
        margemMedia: item.margins.length > 0
          ? item.margins.reduce((sum, m) => sum + m, 0) / item.margins.length
          : 0
      }))
      .sort((a, b) => b.margemMedia - a.margemMedia)
      .slice(0, 10);
  };

  // Dados para gráfico de distribuição por produto
  const getProductDistributionData = () => {
    const productCounts: { [key: string]: number } = {};

    // Usar priceHistory (histórico) E suggestions (aprovadas) para ter dados completos
    [...priceHistory, ...suggestions].forEach(item => {
      const product = item.product || 'outro';
      productCounts[product] = (productCounts[product] || 0) + 1;
    });

    const productNames: { [key: string]: string } = {
      'gasolina_comum': 'Gasolina Comum',
      'gasolina_aditivada': 'Gasolina Aditivada',
      'etanol': 'Etanol',
      's10': 'Diesel S-10',
      'diesel_s10': 'Diesel S-10',
      's500': 'Diesel S-500',
      'diesel_s500': 'Diesel S-500',
      's10_aditivado': 'Diesel S-10 Aditivado',
      'diesel_s10_aditivado': 'Diesel S-10 Aditivado',
      's500_aditivado': 'Diesel S-500 Aditivado',
      'diesel_s500_aditivado': 'Diesel S-500 Aditivado',
      'arla32_granel': 'ARLA 32',
      'arla': 'ARLA 32'
    };

    return Object.entries(productCounts).map(([product, count]) => ({
      produto: productNames[product] || product,
      quantidade: count
    }));
  };

  // Dados para gráfico de volume por cliente
  const getClientVolumeData = () => {
    const clientCounts: { [key: string]: { count: number; name: string } } = {};

    priceHistory.forEach(history => {
      const clientId = history.client_id;
      // Tentar buscar na lista de clientes carregada
      const client = clients.find((c: any) => {
        const clientIdStr = String(c.id_cliente || c.id || '');
        return clientIdStr === String(clientId);
      });
      const clientName = client?.nome || client?.name || history.clients?.name || clientId || 'Cliente Desconhecido';
      
      if (!clientCounts[clientName]) {
        clientCounts[clientName] = { count: 0, name: clientName };
      }
      clientCounts[clientName].count++;
    });

    return Object.values(clientCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(item => ({
        cliente: item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name,
        volume: item.count
      }));
  };

  // Estatísticas gerais
  const getGeneralStats = () => {
    const totalApproved = priceHistory.length;
    const totalRequests = suggestions.length;
    const approvedRequests = suggestions.filter(s => s.status === 'approved').length;
    const avgMargin = priceHistory.length > 0
      ? priceHistory.reduce((sum, h) => sum + (h.margin_cents || 0) / 100, 0) / priceHistory.length
      : 0;
    const avgPrice = priceHistory.length > 0
      ? priceHistory.reduce((sum, h) => sum + (parseFloat(String(h.new_price)) || 0), 0) / priceHistory.length
      : 0;
    const uniqueClients = new Set(priceHistory.map(h => h.client_id).filter(Boolean)).size;
    const uniqueRequesters = new Set(suggestions.map(s => s.requested_by).filter(Boolean)).size;

    return {
      totalApproved,
      totalRequests,
      approvedRequests,
      approvalRate: totalRequests > 0 ? (approvedRequests / totalRequests) * 100 : 0,
      avgMargin,
      avgPrice,
      uniqueClients,
      uniqueRequesters
    };
  };

  const stats = getGeneralStats();
  const priceEvolutionData = getPriceEvolutionData();
  const topRequestersData = getTopRequestersData();
  const averageMarginData = getAverageMarginByPersonData();
  const productDistributionData = getProductDistributionData();
  const clientVolumeData = getClientVolumeData();

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const chartConfig = {
    aprovados: {
      label: "Preços Aprovados",
      color: "hsl(var(--chart-1))",
    },
    precoMedio: {
      label: "Preço Médio (R$)",
      color: "hsl(var(--chart-2))",
    },
    solicitacoes: {
      label: "Solicitações",
      color: "hsl(var(--chart-1))",
    },
    margemMedia: {
      label: "Margem Média (%)",
      color: "hsl(var(--chart-3))",
    },
    quantidade: {
      label: "Quantidade",
      color: "hsl(var(--chart-4))",
    },
    volume: {
      label: "Volume",
      color: "hsl(var(--chart-5))",
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-background dark:to-card">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Gestor de Carteiras</h1>
              <p className="text-blue-100">Visualização completa de gráficos e estatísticas dos clientes</p>
            </div>
            <Button 
              variant="outline" 
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white"
              onClick={() => {
                toast({
                  title: "Exportar Relatório",
                  description: "Funcionalidade em desenvolvimento"
                });
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Relatório
            </Button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Aprovado</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalApproved}</div>
              <p className="text-xs text-muted-foreground">
                Preços aprovados no histórico
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approvalRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.approvedRequests} de {stats.totalRequests} solicitações
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margem Média</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgMargin.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">
                Média de todas as aprovações
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Preço Médio</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBrazilianCurrency(stats.avgPrice)}</div>
              <p className="text-xs text-muted-foreground">
                Média dos preços aprovados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos - Todas as visualizações em uma única página */}
        <div className="space-y-6">
          {/* Evolução de Preços */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Evolução de Preços Aprovados</CardTitle>
                  <CardDescription>Últimos 30 dias</CardDescription>
                </CardHeader>
                <CardContent>
                  {priceEvolutionData.length > 0 && priceEvolutionData.some(d => d.aprovados > 0) ? (
                    <ChartContainer config={chartConfig}>
                      <AreaChart data={priceEvolutionData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area 
                          type="monotone" 
                          dataKey="aprovados" 
                          stroke="hsl(var(--chart-1))" 
                          fill="hsl(var(--chart-1))" 
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Nenhum dado disponível para os últimos 30 dias</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preço Médio ao Longo do Tempo</CardTitle>
                  <CardDescription>Últimos 30 dias</CardDescription>
                </CardHeader>
                <CardContent>
                  {priceEvolutionData.length > 0 && priceEvolutionData.some(d => d.precoMedio > 0) ? (
                    <ChartContainer config={chartConfig}>
                      <AreaChart data={priceEvolutionData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area 
                          type="monotone" 
                          dataKey="precoMedio" 
                          stroke="hsl(var(--chart-2))" 
                          fill="hsl(var(--chart-2))" 
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Nenhum dado disponível para os últimos 30 dias</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Top Solicitantes */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 - Pessoas que Mais Solicitam Preços</CardTitle>
                <CardDescription>Ranking de solicitantes por volume</CardDescription>
              </CardHeader>
              <CardContent>
                {topRequestersData.length > 0 ? (
                  <ChartContainer config={chartConfig}>
                    <BarChart data={topRequestersData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="nome" type="category" width={150} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="solicitacoes" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum dado de solicitantes disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Margens Médias */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Margem Média por Pessoa</CardTitle>
                <CardDescription>Top 10 aprovadores por margem média</CardDescription>
              </CardHeader>
              <CardContent>
                {averageMarginData.length > 0 ? (
                  <ChartContainer config={chartConfig}>
                    <BarChart data={averageMarginData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="pessoa" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="margemMedia" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum dado de margens disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Distribuição por Produto */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Produto</CardTitle>
                <CardDescription>Volume de aprovações por tipo de produto</CardDescription>
              </CardHeader>
              <CardContent>
                {productDistributionData.length > 0 ? (
                  <ChartContainer config={chartConfig}>
                    <RechartsPieChart>
                      <Pie
                        data={productDistributionData}
                        dataKey="quantidade"
                        nameKey="produto"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ produto, quantidade }) => `${produto}: ${quantidade}`}
                      >
                        {productDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend />
                    </RechartsPieChart>
                  </ChartContainer>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum dado de produtos disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Volume por Cliente */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Volume de Aprovações por Cliente</CardTitle>
                <CardDescription>Top 8 clientes por volume de aprovações</CardDescription>
              </CardHeader>
              <CardContent>
                {clientVolumeData.length > 0 ? (
                  <ChartContainer config={chartConfig}>
                    <BarChart data={clientVolumeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cliente" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="volume" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Nenhum dado de clientes disponível</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cards Adicionais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Clientes Únicos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.uniqueClients}</div>
              <p className="text-sm text-muted-foreground mt-2">
                Clientes com preços aprovados
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Solicitantes Únicos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.uniqueRequesters}</div>
              <p className="text-sm text-muted-foreground mt-2">
                Pessoas que solicitaram preços
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Atividade Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalRequests}</div>
              <p className="text-sm text-muted-foreground mt-2">
                Total de solicitações criadas
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

