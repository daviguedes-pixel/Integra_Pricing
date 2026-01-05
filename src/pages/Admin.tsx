// @ts-nocheck
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Shield, Plus, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ClientForm } from "@/components/ClientForm";
import { StationForm } from "@/components/StationForm";
import { PermissionsManager } from "@/components/PermissionsManager";
import { useDatabase } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { Select as UiSelect, SelectContent as UiSelectContent, SelectItem as UiSelectItem, SelectTrigger as UiSelectTrigger, SelectValue as UiSelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function Admin() {
  const { stations, clients, paymentMethods, suggestions } = useDatabase();
  const [newUser, setNewUser] = useState({
    nome: "",
    email: "",
    perfil: "",
    posto: ""
  });

  const [logs, setLogs] = useState<any[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [updatingCosts, setUpdatingCosts] = useState(false);
  const [updateCostsDateRange, setUpdateCostsDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Função para atualizar custos
  const handleUpdateCosts = async () => {
    if (!updateCostsDateRange.start || !updateCostsDateRange.end) {
      toast.error("Selecione as datas inicial e final");
      return;
    }

    try {
      setUpdatingCosts(true);
      const { data, error } = await supabase.rpc('admin_update_approval_costs', {
        p_start_date: updateCostsDateRange.start,
        p_end_date: updateCostsDateRange.end
      });

      if (error) throw error;

      toast.success(`Custos atualizados com sucesso! ${data?.updated_count || 0} registros afetados.`);

      // Log da ação
      await supabase.rpc('log_system_action', {
        p_action: 'UPDATE_COSTS',
        p_resource_type: 'system',
        p_details: {
          start_date: updateCostsDateRange.start,
          end_date: updateCostsDateRange.end,
          updated_count: data?.updated_count || 0
        }
      });

      await loadLogs();

    } catch (error: any) {
      console.error('Erro ao atualizar custos:', error);
      toast.error("Erro ao atualizar custos: " + (error.message || "Erro desconhecido"));
    } finally {
      setUpdatingCosts(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles' as any)
        .select('*')
        .order('nome');
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      toast.error('Erro ao carregar logs do sistema');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      setBackupLoading(true);

      // Criar backup das principais tabelas
      const tables = [
        'price_suggestions',
        'competitor_research',
        'referencias',
        'user_profiles',
        'clients',
        'stations',
        'payment_methods',
        'system_logs'
      ];

      const backupData: any = {};

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('*');

        if (error) {
          console.error(`Erro ao fazer backup da tabela ${table}:`, error);
          continue;
        }

        backupData[table] = data || [];
      }

      // Criar arquivo JSON para download
      const dataStr = JSON.stringify(backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });

      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Log da ação
      await supabase.rpc('log_system_action', {
        p_action: 'BACKUP_COMPLETED',
        p_resource_type: 'system',
        p_details: {
          tables: tables,
          backup_size: `${(dataBlob.size / 1024 / 1024).toFixed(2)}MB`,
          timestamp: new Date().toISOString()
        }
      });

      toast.success('Backup criado com sucesso!');

      // Recarregar logs para mostrar a ação
      await loadLogs();

    } catch (error) {
      console.error('Erro ao criar backup:', error);
      toast.error('Erro ao criar backup');
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadLogs();
  }, []); // Array vazio para executar apenas uma vez

  const handleSyncUsers = async () => {
    const loadingToast = toast.loading('Sincronizando usuários com Auth...');

    try {
      const { data, error } = await supabase.functions.invoke('sync-auth-users', {
        method: 'POST'
      });

      toast.dismiss(loadingToast);

      if (error) throw error;

      const { summary } = data;

      if (summary.created > 0) {
        toast.success(`Sincronização concluída! ${summary.created} novo(s) usuário(s) adicionado(s).`);
      } else if (summary.errors > 0) {
        toast.warning(`Sincronização concluída com ${summary.errors} erro(s).`);
      } else {
        toast.info('Todos os usuários já estavam sincronizados.');
      }

      // Recarregar a lista de usuários
      await loadUsers();
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Erro ao sincronizar usuários:', error);
      toast.error('Falha ao sincronizar usuários. Tente novamente.');
    }
  };

  const getProfileDisplayName = (perfil: string) => {
    const names = {
      'diretor_comercial': 'Diretor Comercial',
      'assessor_comercial': 'Assessor Comercial',
      'supervisor_comercial': 'Supervisor Comercial',
      'diretor_pricing': 'Diretor de Pricing',
      'analista_pricing': 'Analista de Pricing',
      'gerente': 'Gerente'
    };
    return names[perfil as keyof typeof names] || perfil;
  };

  const getDefaultPermission = (role: string, permission: string) => {
    const permissions: Record<string, string[]> = {
      'diretor_comercial': ['create_suggestions', 'approve_prices', 'view_all_suggestions', 'competitor_research', 'manage_users', 'system_settings'],
      'supervisor_comercial': ['create_suggestions', 'approve_prices', 'view_all_suggestions', 'competitor_research'],
      'assessor_comercial': ['create_suggestions', 'competitor_research'],
      'diretor_pricing': ['create_suggestions', 'approve_prices', 'view_all_suggestions', 'competitor_research', 'system_settings'],
      'analista_pricing': ['create_suggestions', 'view_all_suggestions', 'competitor_research'],
      'gerente': ['create_suggestions', 'view_all_suggestions', 'competitor_research']
    };
    return permissions[role]?.includes(permission) || false;
  };

  const handleRoleChange = async (profileId: string, newRole: string) => {
    try {
      console.log('Atualizando perfil:', { profileId, newRole });

      const { data, error } = await supabase
        .from('user_profiles' as any)
        .update({
          role: newRole,
          perfil: newRole
        })
        .eq('id', profileId)
        .select();

      if (error) throw error;

      console.log('Perfil atualizado com sucesso:', data);

      setUsers(prev => prev.map(u => u.id === profileId ? { ...u, role: newRole, perfil: newRole } : u));
      toast.success('Perfil atualizado com sucesso');

      // Recarregar lista para garantir sincronização
      await loadUsers();
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Falha ao atualizar perfil');
    }
  };

  const handleActiveToggle = async (profileId: string, newActive: boolean) => {
    try {
      const { error } = await supabase
        .from('user_profiles' as any)
        .update({ ativo: newActive })
        .eq('id', profileId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === profileId ? { ...u, ativo: newActive } : u));
      toast.success('Status atualizado');
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Falha ao atualizar status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-3 text-white shadow-lg">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-lg font-bold mb-0.5">Administração</h1>
              <p className="text-slate-200 text-xs">Gerencie usuários e permissões do sistema</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permissões
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add User Form */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Novo Usuário
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input
                      id="nome"
                      placeholder="Digite o nome"
                      value={newUser.nome}
                      onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="usuario@redesaoroque.com.br"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="perfil">Perfil</Label>
                    <Select value={newUser.perfil} onValueChange={(value) => setNewUser({ ...newUser, perfil: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diretor_comercial">Diretor Comercial</SelectItem>
                        <SelectItem value="supervisor_comercial">Supervisor Comercial</SelectItem>
                        <SelectItem value="assessor_comercial">Assessor Comercial</SelectItem>
                        <SelectItem value="diretor_pricing">Diretor de Pricing</SelectItem>
                        <SelectItem value="analista_pricing">Analista de Pricing</SelectItem>
                        <SelectItem value="gerente">Gerente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="posto">Posto (opcional)</Label>
                    <Select value={newUser.posto} onValueChange={(value) => setNewUser({ ...newUser, posto: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o posto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="posto-central">Posto Central</SelectItem>
                        <SelectItem value="posto-norte">Posto Norte</SelectItem>
                        <SelectItem value="posto-shopping">Posto Shopping</SelectItem>
                        <SelectItem value="posto-rodovia">Posto Rodovia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full bg-primary hover:bg-primary-hover text-primary-foreground" onClick={() => {
                    if (!newUser.nome || !newUser.email || !newUser.perfil) {
                      toast.error("Preencha todos os campos obrigatórios");
                      return;
                    }
                    toast.success("Usuário criado com sucesso!");
                    setNewUser({ nome: "", email: "", perfil: "", posto: "" });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Usuário
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Users List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <CardTitle>Usuários do Sistema</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleSyncUsers}>Sincronizar com Auth</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{user.nome}</h4>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <UiSelect value={(user.perfil || user.role) as any} onValueChange={(v) => handleRoleChange(user.id, v as any)}>
                              <UiSelectTrigger className="w-[250px]">
                                <UiSelectValue placeholder="Selecione o perfil" />
                              </UiSelectTrigger>
                              <UiSelectContent>
                                <UiSelectItem value="diretor_comercial">Diretor Comercial</UiSelectItem>
                                <UiSelectItem value="supervisor_comercial">Supervisor Comercial</UiSelectItem>
                                <UiSelectItem value="assessor_comercial">Assessor Comercial</UiSelectItem>
                                <UiSelectItem value="diretor_pricing">Diretor de Pricing</UiSelectItem>
                                <UiSelectItem value="analista_pricing">Analista de Pricing</UiSelectItem>
                                <UiSelectItem value="gerente">Gerente</UiSelectItem>
                              </UiSelectContent>
                            </UiSelect>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Ativo</span>
                              <Switch checked={user.ativo !== false} onCheckedChange={(v) => handleActiveToggle(user.id, v)} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Permissões por Perfil</CardTitle>
              <p className="text-sm text-muted-foreground">Defina quais abas e funcionalidades cada perfil pode acessar</p>
            </CardHeader>
            <CardContent>
              <PermissionsManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status do Banco de Dados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge className="bg-success text-success-foreground">Online</Badge>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Projeto:</span>
                  <span className="ml-2 font-mono">ijygsxwfmribbjymxhaf</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">URL:</span>
                  <span className="ml-2 font-mono text-xs">supabase.co/dashboard/project/ijygsxwfmribbjymxhaf</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">RLS Ativo:</span>
                  <Badge className="bg-success text-success-foreground">Sim</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Tabelas:</span>
                  <span className="text-sm font-bold">6</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Policies:</span>
                  <span className="text-sm font-bold">6</span>
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Métricas do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Usuários Ativos:</span>
                  <span className="text-sm font-bold">{users.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Sugestões Hoje:</span>
                  <span className="text-sm font-bold">{suggestions.filter(s =>
                    new Date(s.created_at).toDateString() === new Date().toDateString()
                  ).length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Aprovações Pendentes:</span>
                  <span className="text-sm font-bold">{suggestions.filter(s => s.status === 'pending').length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total de Sugestões:</span>
                  <span className="text-sm font-bold">{suggestions.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Postos Cadastrados:</span>
                  <span className="text-sm font-bold">{stations.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Clientes Cadastrados:</span>
                  <span className="text-sm font-bold">{clients.length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Database Tables Management */}
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Tabelas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <ClientForm />
                  <StationForm />
                </div>
              </CardContent>
            </Card>

            {/* System Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Configuração do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="maxFileSize">Tamanho Máximo de Arquivo (MB)</Label>
                  <Input id="maxFileSize" type="number" defaultValue="10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Timeout de Sessão (minutos)</Label>
                  <Input id="sessionTimeout" type="number" defaultValue="60" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backupFreq">Frequência de Backup</Label>
                  <Select defaultValue="daily">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">A cada hora</SelectItem>
                      <SelectItem value="daily">Diário</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full bg-primary hover:bg-primary-hover text-primary-foreground">
                  Salvar Configurações
                </Button>
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={handleBackup}
                  disabled={backupLoading}
                >
                  {backupLoading ? 'Criando Backup...' : 'Criar Backup'}
                </Button>
              </CardContent>
            </Card>



            {/* Update Costs */}
            <Card>
              <CardHeader>
                <CardTitle>Atualizar Custos de Aprovações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Data Inicial</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={updateCostsDateRange.start}
                      onChange={(e) => setUpdateCostsDateRange(prev => ({ ...prev, start: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Data Final</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={updateCostsDateRange.end}
                      onChange={(e) => setUpdateCostsDateRange(prev => ({ ...prev, end: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleUpdateCosts}
                  disabled={updatingCosts}
                >
                  {updatingCosts ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Atualizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Atualizar Custos
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Isso irá recalcular o custo base e financeiro de todas as aprovações no intervalo selecionado, usando a cotação mais recente para a data de cada aprovação.
                </p>
              </CardContent>
            </Card>

            {/* Logs and Monitoring */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Logs do Sistema
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadLogs}
                    disabled={logsLoading}
                  >
                    {logsLoading ? 'Carregando...' : 'Atualizar'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {logs.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Nenhum log encontrado
                      </div>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="text-xs font-mono bg-secondary p-2 rounded">
                          <span className="text-muted-foreground">
                            [{new Date(log.created_at).toLocaleString('pt-BR')}]
                          </span>
                          <span className="ml-2 font-semibold">{log.action}</span>
                          {log.user_email && (
                            <span className="ml-2 text-blue-600">por {log.user_email}</span>
                          )}
                          {log.resource_type && (
                            <span className="ml-2 text-green-600">({log.resource_type})</span>
                          )}
                          {log.details && (
                            <div className="mt-1 text-gray-600">
                              {JSON.stringify(log.details, null, 2)}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
                <Button variant="outline" className="w-full mt-4">
                  Ver Todos os Logs
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Data Management Tabs */}
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Formas de Pagamento e Taxas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input placeholder="Descrição" />
                    <Input placeholder="Taxa (%)" type="number" />
                    <Button className="bg-primary hover:bg-primary-hover text-primary-foreground">
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 border border-border rounded">
                      <span>À Vista</span>
                      <span>0%</span>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex justify-between items-center p-2 border border-border rounded">
                      <span>Cartão 28 dias</span>
                      <span>2.5%</span>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex justify-between items-center p-2 border border-border rounded">
                      <span>Cartão 35 dias</span>
                      <span>3.2%</span>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Clientes Cadastrados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 border border-border rounded">
                    <div>
                      <span className="font-medium">Transportadora ABC</span>
                      <p className="text-xs text-muted-foreground">12.345.678/0001-90</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex justify-between items-center p-2 border border-border rounded">
                    <div>
                      <span className="font-medium">Frota Express</span>
                      <p className="text-xs text-muted-foreground">98.765.432/0001-10</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent >
      </Tabs >
    </div >
  );
}