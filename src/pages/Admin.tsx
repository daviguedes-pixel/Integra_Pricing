// @ts-nocheck
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Shield, Plus, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";
import { PermissionsManager } from "@/components/PermissionsManager";
import { useDatabase } from "@/hooks/useDatabase";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

export default function Admin() {
  const { stations, clients, suggestions } = useDatabase();
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
  const [updateCostsDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });


  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
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

      if (error && error.code !== 'PGRST204' && error.code !== 'PGRST205') {
        throw error;
      }
      setLogs(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar logs:', error);
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      setBackupLoading(true);
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
        try {
          const { data, error } = await supabase.from(table).select('*');
          if (!error) backupData[table] = data || [];
        } catch (e) {
          console.warn(`Erro ao processar tabela ${table}`);
        }
      }

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

      toast.success('Backup criado com sucesso!');
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
  }, []);

  const handleSyncUsers = async () => {
    const loadingToast = toast.loading('Sincronizando usuários com Auth...');
    try {
      const { data, error } = await supabase.functions.invoke('sync-auth-users', {
        method: 'POST'
      });
      toast.dismiss(loadingToast);
      if (error) throw error;
      toast.success(`Sincronização concluída!`);
      await loadUsers();
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Erro ao sincronizar usuários:', error);
      toast.error('Falha ao sincronizar usuários.');
    }
  };

  const handleRoleChange = async (profileId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole, perfil: newRole })
        .eq('id', profileId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === profileId ? { ...u, role: newRole, perfil: newRole } : u));
      toast.success('Perfil atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Falha ao atualizar perfil');
    }
  };

  const handleActiveToggle = async (profileId: string, newActive: boolean) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
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
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-3 text-white shadow-lg">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold mb-0.5">Administração</h1>
            <p className="text-slate-200 text-xs">Gerencie usuários e permissões do sistema</p>
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

        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                    <Input id="nome" placeholder="Digite o nome" value={newUser.nome} onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" placeholder="usuario@redesaoroque.com.br" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="perfil">Perfil</Label>
                    <Select value={newUser.perfil} onValueChange={(value) => setNewUser({ ...newUser, perfil: value })}>
                      <SelectTrigger><SelectValue placeholder="Selecione o perfil" /></SelectTrigger>
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
                  <Button className="w-full" onClick={() => toast.success("Simulação: Usuário criado!")}>
                    <Plus className="h-4 w-4 mr-2" /> Criar Usuário
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Usuários do Sistema</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleSyncUsers}>Sincronizar</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{user.nome}</h4>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Select value={(user.perfil || user.role) || ""} onValueChange={(v) => handleRoleChange(user.id, v)}>
                              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="diretor_comercial">Diretor Comercial</SelectItem>
                                <SelectItem value="supervisor_comercial">Supervisor Comercial</SelectItem>
                                <SelectItem value="assessor_comercial">Assessor Comercial</SelectItem>
                                <SelectItem value="diretor_pricing">Diretor de Pricing</SelectItem>
                                <SelectItem value="analista_pricing">Analista de Pricing</SelectItem>
                                <SelectItem value="gerente">Gerente</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <span className="text-xs">Ativo</span>
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

        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Permissões</CardTitle>
            </CardHeader>
            <CardContent><PermissionsManager /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Status do Sistema</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm"><span>Status:</span><Badge>Online</Badge></div>
                <div className="flex justify-between text-sm"><span>Usuários:</span><span>{users.length}</span></div>
                <div className="flex justify-between text-sm"><span>Postos:</span><span>{stations?.length || 0}</span></div>
                <div className="flex justify-between text-sm"><span>Sugestões:</span><span>{suggestions?.length || 0}</span></div>
                <Button variant="outline" className="w-full mt-4" onClick={handleBackup} disabled={backupLoading}>
                  {backupLoading ? '...Gerando' : 'Gerar Backup JSON'}
                </Button>
              </CardContent>
            </Card>



            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Logs Recentes</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {logs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum log.</p> :
                    logs.map((log) => (
                      <div key={log.id} className="text-xs font-mono bg-secondary p-2 rounded flex justify-between">
                        <span>{log.action}</span>
                        <span className="text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}