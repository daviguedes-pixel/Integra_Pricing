import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  BarChart3,
  Map,
  TrendingUp,
  Activity,
  ArrowRight,
  History,
  FileText,
  Users,
  Settings,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNameFromEmail } from "@/lib/utils";
import { motion } from "framer-motion";

// Animações simplificadas para melhor performance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03 // Reduzido para animação mais rápida
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 }
  }
};

const Dashboard = () => {
  const { profile } = useAuth();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    today: 0
  });

  const loadData = async () => {
    // Carregar estatísticas
    const { data: suggestions } = await supabase
      .from('price_suggestions')
      .select('status, created_at')
      .order('created_at', { ascending: false });

    if (suggestions) {
      const today = new Date().toISOString().split('T')[0];
      setStats({
        pending: suggestions.filter(s => s.status === 'pending').length,
        approved: suggestions.filter(s => s.status === 'approved').length,
        today: suggestions.filter(s => s.created_at.startsWith(today)).length
      });

      // Carregar atividade recente (últimas 5)
      const { data: recent, error: recentError } = await supabase
        .from('price_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) {
        console.error('Erro ao carregar atividade recente:', recentError);
      }

      if (recent && recent.length > 0) {
        // Collect IDs for manual fetching
        const userIds = Array.from(new Set(recent.map(r => r.requested_by).filter(Boolean)));
        const stationIds = Array.from(new Set(recent.map(r => r.station_id).filter(Boolean)));

        // Fetch profiles
        let profilesMap: Record<string, any> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, nome, email')
            .in('user_id', userIds);

          if (profiles) {
            profiles.forEach(p => {
              if (p.user_id) profilesMap[p.user_id] = p;
            });
          }
        }

        // Fetch stations using RPC for better ID resolution (supports id_empresa and cnpj_cpf)
        let stationsMap: Record<string, string> = {};
        if (stationIds.length > 0) {
          const { data: stations } = await supabase.rpc('get_sis_empresa_by_ids', {
            p_ids: stationIds
          });

          if (stations) {
            stations.forEach((s: any) => {
              // Map both ID and CNPJ to the name to ensure we catch the reference
              if (s.id_empresa) stationsMap[String(s.id_empresa)] = s.nome_empresa;
              if (s.cnpj_cpf) stationsMap[s.cnpj_cpf] = s.nome_empresa;
            });
          }
        }

        const recentWithDetails = recent.map(item => ({
          ...item,
          requested_by_profile: profilesMap[item.requested_by] || { nome: 'Desconhecido', email: 'N/A' },
          station_name: stationsMap[item.station_id] || 'Posto não identificado'
        }));

        setRecentActivity(recentWithDetails);
      } else {
        setRecentActivity([]);
      }
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('dashboard_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'price_suggestions'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const quickActions = [
    {
      icon: DollarSign,
      title: "Nova Solicitação",
      description: "Criar solicitação de preço",
      href: "/solicitacao-preco",
      permission: "price_request",
    },
    {
      icon: BarChart3,
      title: "Aprovações",
      description: "Revisar pendências",
      href: "/approvals",
      permission: "approvals",
    },
    {
      icon: Map,
      title: "Mapa",
      description: "Referências",
      href: "/map",
      permission: "map",
    },
    {
      icon: History,
      title: "Histórico",
      description: "Consultar preços",
      href: "/price-history",
      permission: "price_history",
    },
    {
      icon: FileText,
      title: "Referências",
      description: "Gerenciar produtos",
      href: "/reference-registration",
      permission: "reference_registration",
    },
    {
      icon: Users,
      title: "Gestão",
      description: "Administração",
      href: "/gestao",
      permission: "admin",
    },
    {
      icon: Settings,
      title: "Configurações",
      description: "Sistema",
      href: "/settings",
      permission: "admin",
    },
  ].filter(action => canAccess(action.permission));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const activityColors: any = {
    'pending': 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/20',
    'approved': 'text-green-500 bg-green-100 dark:bg-green-900/20',
    'rejected': 'text-red-500 bg-red-100 dark:bg-red-900/20',
    'draft': 'text-gray-500 bg-gray-100 dark:bg-gray-900/20'
  };

  return (
    <motion.div
      className="min-h-full bg-background p-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="container mx-auto max-w-7xl space-y-8">
        {/* Header Section */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              {getGreeting()}, <span className="text-primary">{formatNameFromEmail(profile?.nome || profile?.email).split(' ')[0]}</span>! 👋
            </h1>
            <p className="text-muted-foreground text-lg">
              Painel de controle e monitoramento de preços.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate("/solicitacao-preco")}
              className="shadow-md bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-colors"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Nova Solicitação
            </Button>
          </div>
        </motion.div>

        {/* Live Stats Row */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="transition-transform hover:-translate-y-1 duration-200">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="p-6 relative">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pendentes</p>
                    <h3 className="text-3xl font-bold mt-1 text-yellow-600 dark:text-yellow-400 font-mono tracking-tight">{stats.pending}</h3>
                  </div>
                  <div className="p-3 bg-yellow-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-2"></div>
                  Atualizando em tempo real
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="transition-transform hover:-translate-y-1 duration-200">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="p-6 relative">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aprovados</p>
                    <h3 className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400 font-mono tracking-tight">{stats.approved}</h3>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></div>
                  Dados consolidados
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="transition-transform hover:-translate-y-1 duration-200">
            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardContent className="p-6 relative">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Solicitações Hoje</p>
                    <h3 className="text-3xl font-bold mt-1 text-blue-600 dark:text-blue-400 font-mono tracking-tight">{stats.today}</h3>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                    <Activity className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-xs text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></div>
                  Volume diário
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Quick Actions Grid */}
        <motion.div variants={itemVariants} className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" /> Acesso Rápido
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {quickActions.map((action, index) => (
              <motion.div
                key={action.href}
                variants={itemVariants}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Card
                  className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/50 text-center h-full bg-card/50 backdrop-blur-sm"
                  onClick={() => navigate(action.href)}
                >
                  <CardContent className="p-4 flex flex-col items-center gap-3 justify-center h-full">
                    <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300 relative overflow-hidden">
                      <div className="absolute inset-0 bg-primary/10 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-2xl" />
                      <action.icon className="h-6 w-6 text-primary relative z-10 group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="text-xs font-semibold text-foreground/80 group-hover:text-foreground transition-colors w-full line-clamp-2">
                      {action.title}
                    </h3>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Main Content Area */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity Feed */}
          <Card className="lg:col-span-2 border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                Atividade Recente
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/approvals")} className="text-xs text-primary hover:bg-primary/5">
                Ver Tudo <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-0">
                {recentActivity.length > 0 ? (
                  recentActivity.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + (idx * 0.1) }}
                      className="flex gap-4 relative pb-6 last:pb-0 group"
                    >
                      {idx !== recentActivity.length - 1 && (
                        <div className="absolute left-5 top-10 bottom-0 w-px bg-slate-200 dark:bg-slate-700/50 group-hover:bg-primary/20 transition-colors"></div>
                      )}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 ${activityColors[item.status] || 'bg-slate-100'} shadow-sm ring-4 ring-background transition-transform duration-300 group-hover:scale-110`}>
                        {item.status === 'approved' ? <CheckCircle2 className="h-5 w-5" /> :
                          item.status === 'rejected' ? <X className="h-5 w-5" /> :
                            <Clock className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 space-y-1 pt-1">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <p className="text-sm font-semibold group-hover:text-primary transition-colors duration-200">
                              {item.product === 's10' ? 'Diesel S10' : item.product === 's500' ? 'Diesel S500' : item.product} - R$ {(item.final_price / (item.final_price >= 10 ? 1 : 1)).toFixed(3)}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium">
                              {item.station_name}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                            {(() => {
                              const date = new Date(item.created_at);
                              const today = new Date();
                              const isToday = date.getDate() === today.getDate() &&
                                date.getMonth() === today.getMonth() &&
                                date.getFullYear() === today.getFullYear();

                              return isToday
                                ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : date.toLocaleDateString([], { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            })()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                          Solicitado por <span className="font-medium text-foreground">{formatNameFromEmail(item.requested_by_profile?.nome || item.requested_by_profile?.email || item.requested_by)}</span>
                        </p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-12 text-slate-400 flex flex-col items-center gap-3"
                  >
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center">
                      <Clock className="h-8 w-8 text-slate-300" />
                    </div>
                    <p>Nenhuma atividade encontrada hoje.</p>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Side Panel: System Status & Info */}
          <motion.div variants={itemVariants} className="space-y-6">
            <Card className="border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/0 border-primary/10 relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
              <CardContent className="p-6 relative">
                <div className="flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground">Acompanhamento Live</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      O sistema está monitorando alterações de preços continuamente. Novos eventos aparecerão automaticamente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping absolute opacity-75"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 relative"></div>
                    </div>
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">Fluxo Ativo</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Suporte e Configuração
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <motion.div
                  whileHover={{ x: 4, backgroundColor: "rgba(0,0,0,0.02)" }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-border/50 transition-all cursor-pointer"
                  onClick={() => navigate("/profile-settings")}
                >
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                    <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <span className="text-sm font-medium">Perfil e Preferências</span>
                </motion.div>
                {canAccess('admin') && (
                  <motion.div
                    whileHover={{ x: 4, backgroundColor: "rgba(0,0,0,0.02)" }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-border/50 transition-all cursor-pointer"
                    onClick={() => navigate("/settings")}
                  >
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                      <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <span className="text-sm font-medium">Configurações Base</span>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div >
    </motion.div >
  );
};

export default Dashboard;
