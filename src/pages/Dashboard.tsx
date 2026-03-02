import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Sparkles,
  Bell,
  CalendarDays,
  Eye,
  MessageSquarePlus,
  FileQuestion,
  Check,
  RefreshCcw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNameFromEmail } from "@/lib/utils";
import { getProductName, getStatusBadge, formatPrice } from "@/lib/pricing-utils";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25 },
  },
};

interface ActionItem {
  id: string;
  product: string;
  station_name: string;
  suggested_price: number | null;
  final_price: number | null;
  margin_cents: number | null;
  status: string;
  created_at: string;
  role: 'approver' | 'requester';
  action_label: string;
  action_color: string;
  approver_name?: string;
}

interface RecentItem {
  id: string;
  product: string;
  station_name: string;
  suggested_price: number | null;
  final_price: number | null;
  status: string;
  created_at: string;
  requested_by_name: string;
}

const Dashboard = () => {
  const { user, profile } = useAuth();
  const { canAccess } = usePermissions();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    myPending: 0,
    awaitingAction: 0,
    approvedToday: 0,
    totalMonth: 0,
  });

  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentItem[]>([]);
  const [approvalRate, setApprovalRate] = useState({ approved: 0, total: 0 });

  const getActionLabel = (status: string, role: 'approver' | 'requester') => {
    if (role === 'approver') return { label: 'Aprovar / Rejeitar', color: 'bg-amber-500 hover:bg-amber-600' };
    switch (status) {
      case 'awaiting_justification': return { label: 'Justificar', color: 'bg-orange-500 hover:bg-orange-600' };
      case 'awaiting_evidence': return { label: 'Enviar Referência', color: 'bg-purple-500 hover:bg-purple-600' };
      default: return { label: 'Ver', color: 'bg-slate-500 hover:bg-slate-600' };
    }
  };

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      // --- 0) Get user's perfil and approval level ---
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('perfil')
        .eq('user_id', user.id)
        .single();

      let myApprovalLevels: number[] = [];
      if (userProfile?.perfil) {
        const { data: approvalOrders } = await supabase
          .from('approval_profile_order')
          .select('order_position')
          .eq('perfil', userProfile.perfil)
          .eq('is_active', true);

        if (approvalOrders) {
          myApprovalLevels = approvalOrders.map(o => o.order_position);
        }
      }

      // --- 1) Minhas Pendentes ---
      const { count: myPendingCount } = await supabase
        .from('price_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('status', 'pending');

      // --- 2) Aguardando Meu Parecer (como APROVADOR - por perfil) ---
      let approverItems: any[] = [];
      if (myApprovalLevels.length > 0) {
        const { data } = await supabase
          .from('price_suggestions')
          .select('id, product, station_id, suggested_price, final_price, margin_cents, status, created_at')
          .eq('status', 'pending')
          .in('approval_level', myApprovalLevels)
          .order('created_at', { ascending: false })
          .limit(30);
        approverItems = data || [];
      }

      // --- 3) Aguardando Meu Parecer (como SOLICITANTE - preciso justificar/enviar referência) ---
      const { data: requesterItems } = await supabase
        .from('price_suggestions')
        .select('id, product, station_id, suggested_price, final_price, margin_cents, status, created_at, last_approver_action_by')
        .eq('created_by', user.id)
        .in('status', ['awaiting_justification', 'awaiting_evidence'])
        .order('created_at', { ascending: false })
        .limit(20);

      // --- 4) Aprovadas Hoje ---
      const { count: approvedTodayCount } = await supabase
        .from('price_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('updated_at', todayStr);

      // --- 5) Total no Mês ---
      const { count: totalMonthCount } = await supabase
        .from('price_suggestions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', firstOfMonth);

      // --- 6) Atividade Recente (últimas 10) ---
      const { data: recentData } = await supabase
        .from('price_suggestions')
        .select('id, product, station_id, suggested_price, final_price, status, created_at, requested_by, created_by')
        .order('created_at', { ascending: false })
        .limit(10);

      // --- 7) Taxa de Aprovação do Mês ---
      const { count: monthApproved } = await supabase
        .from('price_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('created_at', firstOfMonth);

      const { count: monthRejected } = await supabase
        .from('price_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'rejected')
        .gte('created_at', firstOfMonth);

      // --- Resolve station names ---
      const allItems = [
        ...(approverItems || []),
        ...(requesterItems || []),
        ...(recentData || []),
      ];
      const stationIds = Array.from(new Set(allItems.map(i => i.station_id).filter(Boolean)));

      let stationsMap: Record<string, string> = {};
      if (stationIds.length > 0) {
        const { data: stations } = await supabase.rpc('get_sis_empresa_by_ids', {
          p_ids: stationIds,
        });
        if (stations) {
          stations.forEach((s: any) => {
            if (s.id_empresa) stationsMap[String(s.id_empresa)] = s.nome_empresa;
            if (s.cnpj_cpf) stationsMap[s.cnpj_cpf] = s.nome_empresa;
          });
        }
      }

      // --- Resolve requester names for recent ---
      const requesterIds = Array.from(new Set([
        ...(recentData || []).map(r => r.requested_by),
        ...(recentData || []).map(r => r.created_by),
        ...(requesterItems || []).map(r => r.last_approver_action_by)
      ].filter(Boolean)));

      let profilesMap: Record<string, string> = {};
      if (requesterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, nome, email')
          .in('user_id', requesterIds);
        if (profiles) {
          profiles.forEach(p => {
            if (p.user_id) profilesMap[p.user_id] = p.nome || p.email || 'Desconhecido';
          });
        }
      }

      // --- Build action items ---
      const actions: ActionItem[] = [];
      (approverItems || []).forEach(item => {
        const { label, color } = getActionLabel('pending', 'approver');
        actions.push({
          ...item,
          station_name: stationsMap[item.station_id] || 'Posto',
          role: 'approver',
          action_label: label,
          action_color: color,
        });
      });
      (requesterItems || []).forEach(item => {
        const { label, color } = getActionLabel(item.status, 'requester');
        actions.push({
          ...item,
          station_name: stationsMap[item.station_id] || 'Posto',
          role: 'requester',
          action_label: label,
          action_color: color,
          approver_name: profilesMap[item.last_approver_action_by] || 'Aprovador',
        });
      });

      // --- Build recent items ---
      const recent: RecentItem[] = (recentData || []).map(item => ({
        ...item,
        station_name: stationsMap[item.station_id] || 'Posto',
        requested_by_name: profilesMap[item.created_by] || profilesMap[item.requested_by] || 'Desconhecido',
      }));

      // --- Set state ---
      setStats({
        myPending: myPendingCount || 0,
        awaitingAction: actions.length,
        approvedToday: approvedTodayCount || 0,
        totalMonth: totalMonthCount || 0,
      });
      setActionItems(actions);
      setRecentActivity(recent);
      setApprovalRate({
        approved: monthApproved || 0,
        total: (monthApproved || 0) + (monthRejected || 0),
      });
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('dashboard_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'price_suggestions' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const quickActions = [
    { icon: DollarSign, title: "Nova Solicitação", href: "/solicitacao-preco", permission: "price_request" },
    { icon: BarChart3, title: "Aprovações", href: "/approvals", permission: "approvals" },
    { icon: Map, title: "Mapa", href: "/map", permission: "map" },
    { icon: History, title: "Histórico", href: "/price-history", permission: "price_history" },
    { icon: FileText, title: "Referências", href: "/reference-registration", permission: "reference_registration" },
    { icon: Users, title: "Gestão", href: "/gestao", permission: "admin" },
  ].filter(action => canAccess(action.permission));

  const approvalPct = approvalRate.total > 0
    ? Math.round((approvalRate.approved / approvalRate.total) * 100)
    : 0;

  const kpiCards = [
    {
      label: "Minhas Pendentes",
      value: stats.myPending,
      icon: Clock,
      color: "yellow",
      description: "Suas solicitações aguardando aprovação",
      onClick: () => navigate('/solicitacao-preco'),
    },
    {
      label: "Aguardando Meu Parecer",
      value: stats.awaitingAction,
      icon: Bell,
      color: "orange",
      description: "Itens que precisam da sua ação",
      highlight: stats.awaitingAction > 0,
    },
    {
      label: "Aprovadas Hoje",
      value: stats.approvedToday,
      icon: CheckCircle2,
      color: "green",
      description: "Aprovações realizadas hoje",
    },
    {
      label: "Total no Mês",
      value: stats.totalMonth,
      icon: CalendarDays,
      color: "blue",
      description: "Solicitações criadas este mês",
    },
  ];

  const colorMap: Record<string, { bg: string; text: string; icon: string; glow: string; ring: string }> = {
    yellow: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-600 dark:text-yellow-400',
      icon: 'text-yellow-600',
      glow: 'from-yellow-500/0 via-yellow-500/5 to-yellow-500/0',
      ring: 'ring-yellow-500/20',
    },
    orange: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-600 dark:text-orange-400',
      icon: 'text-orange-600',
      glow: 'from-orange-500/0 via-orange-500/5 to-orange-500/0',
      ring: 'ring-orange-500/20',
    },
    green: {
      bg: 'bg-green-500/10',
      text: 'text-green-600 dark:text-green-400',
      icon: 'text-green-600',
      glow: 'from-green-500/0 via-green-500/5 to-green-500/0',
      ring: 'ring-green-500/20',
    },
    blue: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-600 dark:text-blue-400',
      icon: 'text-blue-600',
      glow: 'from-blue-500/0 via-blue-500/5 to-blue-500/0',
      ring: 'ring-blue-500/20',
    },
  };

  return (
    <motion.div
      className="min-h-full bg-background p-4 md:p-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="container mx-auto max-w-7xl space-y-6">
        {/* ── Header ─────────────────────────────────── */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="space-y-0.5">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {getGreeting()}, <span className="text-primary">{formatNameFromEmail(profile?.nome || profile?.email).split(' ')[0]}</span>! 👋
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Centro de controle de precificação
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData()}
              className="gap-1.5"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              onClick={() => navigate("/solicitacao-preco")}
              size="sm"
              className="shadow-sm bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary gap-1.5"
            >
              <DollarSign className="h-3.5 w-3.5" />
              Nova Solicitação
            </Button>
          </div>
        </motion.div>

        {/* ── KPI Cards ──────────────────────────────── */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {kpiCards.map((kpi) => {
            const c = colorMap[kpi.color];
            return (
              <motion.div
                key={kpi.label}
                whileHover={{ y: -3, scale: 1.01 }}
                transition={{ duration: 0.2 }}
                onClick={kpi.onClick}
                className={kpi.onClick ? 'cursor-pointer' : ''}
              >
                <Card className={`border-0 shadow-md bg-gradient-to-br from-white to-slate-50/80 dark:from-slate-800 dark:to-slate-900 overflow-hidden relative group ${kpi.highlight ? `ring-2 ${c.ring}` : ''}`}>
                  <div className={`absolute inset-0 bg-gradient-to-r ${c.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <CardContent className="p-4 md:p-5 relative">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground truncate">{kpi.label}</p>
                        <h3 className={`text-2xl md:text-3xl font-bold mt-1 ${c.text} font-mono tracking-tight`}>
                          {loading ? '—' : kpi.value}
                        </h3>
                      </div>
                      <div className={`p-2.5 ${c.bg} rounded-xl group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                        <kpi.icon className={`h-5 w-5 ${c.icon}`} />
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground/70 truncate">{kpi.description}</p>
                    {kpi.highlight && kpi.value > 0 && (
                      <div className="absolute top-2 right-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Main Grid ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* ── Left Column (2/3) ────────────────────── */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Ação Necessária */}
            {actionItems.length > 0 && (
              <motion.div variants={itemVariants}>
                <Card className="border-orange-200/50 dark:border-orange-800/30 shadow-sm bg-gradient-to-br from-orange-50/50 to-white dark:from-orange-950/10 dark:to-slate-900">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                        <Bell className="h-4 w-4 text-orange-600" />
                      </div>
                      Ação Necessária
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0">
                        {actionItems.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-1 space-y-2">
                    {actionItems.slice(0, 5).map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 hover:border-primary/30 hover:shadow-sm transition-all group cursor-pointer"
                        onClick={() => {
                          navigate(`/approval-details/${item.id}`);
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`p-1.5 rounded-md ${item.role === 'approver'
                            ? 'bg-amber-100 dark:bg-amber-900/30'
                            : 'bg-blue-100 dark:bg-blue-900/30'
                            }`}>
                            {item.role === 'approver'
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />
                              : item.status === 'awaiting_justification'
                                ? <MessageSquarePlus className="h-3.5 w-3.5 text-orange-600" />
                                : item.status === 'awaiting_evidence'
                                  ? <FileQuestion className="h-3.5 w-3.5 text-purple-600" />
                                  : <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                            }
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                              {getProductName(item.product)} — {item.station_name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">
                                R$ {((item.final_price || item.suggested_price || 0)).toFixed(3)}
                              </span>
                              {item.margin_cents != null && (
                                <span className={`text-xs font-medium ${item.margin_cents >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {item.margin_cents >= 0 ? '+' : ''}{item.margin_cents} ¢
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground/60">
                                {item.role === 'approver'
                                  ? '• Você é o aprovador'
                                  : item.last_approver_action_by
                                    ? `• Solicitado por: ${formatNameFromEmail(item.approver_name || 'Aprovador')}`
                                    : '• Sua solicitação'
                                }
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className={`ml-2 text-white text-xs ${item.action_color} shadow-sm flex-shrink-0`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.role === 'approver') {
                              navigate(`/approvals`);
                            } else {
                              navigate(`/solicitacao-preco/${item.id}`);
                            }
                          }}
                        >
                          {item.action_label}
                        </Button>
                      </motion.div>
                    ))}

                    {actionItems.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground hover:text-primary"
                        onClick={() => navigate('/approvals')}
                      >
                        Ver mais {actionItems.length - 5} item(ns) <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Atividade Recente (mini-tabela) */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Atividade Recente
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/approvals")} className="text-xs text-primary hover:bg-primary/5">
                    Ver Tudo <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent className="pt-1">
                  {recentActivity.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="text-xs font-semibold h-8 px-3">Produto</TableHead>
                            <TableHead className="text-xs font-semibold h-8 px-3 hidden md:table-cell">Posto</TableHead>
                            <TableHead className="text-xs font-semibold h-8 px-3 text-right">Preço</TableHead>
                            <TableHead className="text-xs font-semibold h-8 px-3">Status</TableHead>
                            <TableHead className="text-xs font-semibold h-8 px-3 hidden lg:table-cell">Solicitante</TableHead>
                            <TableHead className="text-xs font-semibold h-8 px-3 text-right">Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentActivity.map((item) => (
                            <TableRow
                              key={item.id}
                              className="cursor-pointer hover:bg-primary/5 transition-colors"
                              onClick={() => navigate(`/approval-details/${item.id}`)}
                            >
                              <TableCell className="text-xs font-medium py-2 px-3">
                                {getProductName(item.product)}
                              </TableCell>
                              <TableCell className="text-xs py-2 px-3 text-muted-foreground hidden md:table-cell truncate max-w-[200px]">
                                {item.station_name}
                              </TableCell>
                              <TableCell className="text-xs py-2 px-3 text-right font-mono">
                                R$ {((item.final_price || item.suggested_price || 0)).toFixed(3)}
                              </TableCell>
                              <TableCell className="py-2 px-3">
                                {getStatusBadge(item.status)}
                              </TableCell>
                              <TableCell className="text-xs py-2 px-3 text-muted-foreground hidden lg:table-cell truncate max-w-[150px]">
                                {formatNameFromEmail(item.requested_by_name)}
                              </TableCell>
                              <TableCell className="text-xs py-2 px-3 text-right text-muted-foreground whitespace-nowrap">
                                {new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhuma atividade recente</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ── Right Column (1/3) ───────────────────── */}
          <motion.div variants={itemVariants} className="space-y-4 md:space-y-6">
            {/* Taxa de Aprovação */}
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Taxa de Aprovação
                  <span className="text-xs font-normal text-muted-foreground ml-auto">Este mês</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center pt-2 pb-5">
                {/* CSS Donut */}
                <div className="relative w-32 h-32 mb-4">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-slate-200 dark:text-slate-700"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="text-green-500"
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${approvalPct}, 100`}
                      strokeLinecap="round"
                      style={{
                        transition: 'stroke-dasharray 0.6s ease-in-out',
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">{loading ? '—' : `${approvalPct}%`}</span>
                    <span className="text-[10px] text-muted-foreground">aprovação</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <span>{approvalRate.approved} aprovadas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <span>{approvalRate.total - approvalRate.approved} rejeitadas</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Acesso Rápido */}
            <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  Acesso Rápido
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="grid grid-cols-3 gap-2">
                  {quickActions.map((action) => (
                    <motion.div
                      key={action.href}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <button
                        className="w-full flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                        onClick={() => navigate(action.href)}
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <action.icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors leading-tight text-center">
                          {action.title}
                        </span>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Live Status */}
            <Card className="border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/0 border-primary/10">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping absolute opacity-75"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 relative"></div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Monitoramento Ativo</p>
                  <p className="text-[10px] text-muted-foreground">Atualizações em tempo real</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
