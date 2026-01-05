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
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNameFromEmail } from "@/lib/utils";

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
      const { data: recent } = await supabase
        .from('price_suggestions')
        .select('*, requested_by_profile:user_profiles!requested_by(nome, email)')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recent) setRecentActivity(recent);
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
    <div className="min-h-full bg-background p-6">
      <div className="container mx-auto max-w-7xl space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {profile?.nome?.split(' ')[0]}! 👋
            </h1>
            <p className="text-muted-foreground text-lg">
              Painel de controle e monitoramento de preços.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/solicitacao-preco")} className="shadow-md">
              <DollarSign className="h-4 w-4 mr-2" />
              Nova Solicitação
            </Button>
          </div>
        </div>

        {/* Live Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 overflow-hidden">
            <CardContent className="p-6 relative">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pendentes</p>
                  <h3 className="text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400">{stats.pending}</h3>
                </div>
                <div className="p-3 bg-yellow-500/10 rounded-xl">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-2 animate-pulse"></div>
                Atualizando em tempo real
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aprovados</p>
                  <h3 className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{stats.approved}</h3>
                </div>
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                Dados consolidados
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Solicitações Hoje</p>
                  <h3 className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">{stats.today}</h3>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-xs text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 animate-pulse"></div>
                Volume diário
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            Acesso Rápido
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {quickActions.map((action) => (
              <Card
                key={action.href}
                className="group hover:shadow-md transition-all duration-200 cursor-pointer border-border hover:border-primary/50 text-center"
                onClick={() => navigate(action.href)}
              >
                <CardContent className="p-4 flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xs font-semibold text-foreground truncate w-full">
                    {action.title}
                  </h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity Feed */}
          <Card className="lg:col-span-2 border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-bold">Atividade Recente</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/approvals")} className="text-xs text-primary">
                Ver Tudo <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-6">
                {recentActivity.length > 0 ? (
                  recentActivity.map((item, idx) => (
                    <div key={item.id} className="flex gap-4 relative">
                      {idx !== recentActivity.length - 1 && (
                        <div className="absolute left-5 top-10 bottom-[-24px] w-px bg-slate-200 dark:bg-slate-700"></div>
                      )}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 ${activityColors[item.status] || 'bg-slate-100'}`}>
                        {item.status === 'approved' ? <CheckCircle2 className="h-5 w-5" /> :
                          item.status === 'rejected' ? <X className="h-5 w-5" /> :
                            <Clock className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-semibold">
                            {item.product === 's10' ? 'Diesel S10' : item.product} - R$ {(item.final_price / (item.final_price >= 10 ? 1 : 1)).toFixed(3)}
                          </p>
                          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          Solicitado por {formatNameFromEmail(item.requested_by_profile?.nome || item.requested_by_profile?.email || item.requested_by)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    Nenhuma atividade encontrada hoje.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Side Panel: System Status & Info */}
          <div className="space-y-6">
            <Card className="border-border shadow-sm bg-primary/5 border-primary/10">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-foreground">Acompanhamento Live</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      O sistema está monitorando alterações de preços continuamente. Novos eventos aparecerão automaticamente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">Fluxo Ativo</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Suporte e Configuração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => navigate("/profile-settings")}>
                  <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                    <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <span className="text-sm font-medium">Perfil e Preferências</span>
                </div>
                {canAccess('admin') && (
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" onClick={() => navigate("/settings")}>
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                      <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <span className="text-sm font-medium">Configurações Base</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
