import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Save } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface ProfilePermission {
  perfil: string;
  dashboard: boolean;
  price_request: boolean;
  approvals: boolean;
  research: boolean;
  map: boolean;
  price_history: boolean;
  reference_registration: boolean;
  admin: boolean;
  settings: boolean;
  gestao: boolean;
  gestao_stations: boolean;
  gestao_clients: boolean;
  gestao_payment_methods: boolean;
  can_approve: boolean;
  can_register: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_view_history: boolean;
  can_manage_notifications: boolean;
}

const perfis = [
  { nome: 'Diretor Comercial', key: 'diretor_comercial' },
  { nome: 'Supervisor Comercial', key: 'supervisor_comercial' },
  { nome: 'Assessor Comercial', key: 'assessor_comercial' },
  { nome: 'Diretor de Pricing', key: 'diretor_pricing' },
  { nome: 'Analista de Pricing', key: 'analista_pricing' },
  { nome: 'Gerente Comercial', key: 'gerente_comercial' },
  { nome: 'Gerente', key: 'gerente' }
];

const abas = [
  { label: 'Página Inicial', key: 'dashboard' },
  { label: 'Solicitação de Preços', key: 'price_request' },
  { label: 'Aprovações', key: 'approvals' },
  { label: 'Pesquisa de Preços Públicos', key: 'research' },
  { label: 'Mapa de Preços', key: 'map' },
  { label: 'Histórico de Preços', key: 'price_history' },
  { label: 'Referências', key: 'reference_registration' },
  { label: 'Gestão de Postos', key: 'station_management' },
  { label: 'Gestão de Clientes', key: 'client_management' },
  { label: 'Gestão de Taxas', key: 'tax_management' },
  { label: 'Logs de Auditoria', key: 'audit_logs' },
  { label: 'Config. Margem Aprovação', key: 'approval_margin_config' },
  { label: 'Administração', key: 'admin' },
  { label: 'Configurações', key: 'settings' },
  { label: 'Gestão Geral', key: 'gestao' }
];

const subabasGestao = [
  { label: 'Gestão - Postos', key: 'gestao_stations' },
  { label: 'Gestão - Clientes', key: 'gestao_clients' },
  { label: 'Gestão - Tipos de Pagamento', key: 'gestao_payment_methods' }
];

const acoes = [
  { label: 'Pode Aprovar', key: 'can_approve' },
  { label: 'Pode Cadastrar', key: 'can_register' },
  { label: 'Pode Editar', key: 'can_edit' },
  { label: 'Pode Excluir', key: 'can_delete' },
  { label: 'Ver Histórico', key: 'can_view_history' },
  { label: 'Gerenciar Notificações', key: 'can_manage_notifications' }
];

export function PermissionsManager() {
  const [permissions, setPermissions] = useState<Record<string, ProfilePermission>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { reloadPermissions } = usePermissions();

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_permissions')
        .select('*');

      if (error) throw error;

      const permissionsMap: Record<string, ProfilePermission> = {};

      // Inicializar todos os perfis com valores padrão
      perfis.forEach(perfil => {
        permissionsMap[perfil.key] = {
          perfil: perfil.key,
          dashboard: false,
          price_request: false,
          approvals: false,
          research: false,
          map: false,
          price_history: false,
          reference_registration: false,
          station_management: false,
          client_management: false,
          tax_management: false,
          audit_logs: false,
          approval_margin_config: false,
          admin: false,
          settings: false,
          gestao: false,
          gestao_stations: false,
          gestao_clients: false,
          gestao_payment_methods: false,
          can_approve: false,
          can_register: false,
          can_edit: false,
          can_delete: false,
          can_view_history: false,
          can_manage_notifications: false,
        };
      });

      // Sobrescrever com dados do banco
      (data || []).forEach((perm: any) => {
        if (permissionsMap[perm.perfil]) {
          permissionsMap[perm.perfil] = {
            ...permissionsMap[perm.perfil],
            ...perm
          };
        }
      });

      setPermissions(permissionsMap);
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      toast.error('Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (perfil: string, key: keyof ProfilePermission) => {
    setPermissions(prev => {
      const currentPerfil = prev[perfil] || {
        perfil,
        dashboard: false,
        price_request: false,
        approvals: false,
        research: false,
        map: false,
        price_history: false,
        reference_registration: false,
        station_management: false,
        client_management: false,
        tax_management: false,
        audit_logs: false,
        approval_margin_config: false,
        admin: false,
        settings: false,
        gestao: false,
        gestao_stations: false,
        gestao_clients: false,
        gestao_payment_methods: false,
        can_approve: false,
        can_register: false,
        can_edit: false,
        can_delete: false,
        can_view_history: false,
        can_manage_notifications: false,
      };

      return {
        ...prev,
        [perfil]: {
          ...currentPerfil,
          [key]: !currentPerfil[key]
        }
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(permissions).map(([perfil, perms]) => ({
        perfil,
        ...perms
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('profile_permissions')
          .upsert(update, { onConflict: 'perfil' });

        if (error) throw error;
      }

      toast.success('Permissões salvas com sucesso!');

      // Recarregar permissões do hook para atualizar o contexto
      await reloadPermissions();

      // Recarregar permissões locais para garantir sincronização
      await loadPermissions();
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      toast.error('Erro ao salvar permissões');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando permissões...</div>;
  }

  return (
    <div className="space-y-6">
      {perfis.map((perfil) => (
        <div key={perfil.key} className="border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-primary">{perfil.nome}</h3>

          {/* Abas do Sistema */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Abas Visíveis</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {abas.map((aba) => (
                <div key={aba.key} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors">
                  <span className="text-sm font-medium">{aba.label}</span>
                  <Switch
                    checked={permissions[perfil.key]?.[aba.key as keyof ProfilePermission] as boolean || false}
                    onCheckedChange={() => handleToggle(perfil.key, aba.key as keyof ProfilePermission)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Ações Permitidas */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Ações Permitidas</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {acoes.map((acao) => (
                <div key={acao.key} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <span className="text-sm">{acao.label}</span>
                  <Switch
                    checked={permissions[perfil.key]?.[acao.key as keyof ProfilePermission] as boolean || false}
                    onCheckedChange={() => handleToggle(perfil.key, acao.key as keyof ProfilePermission)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Subabas da Gestão */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Subabas da Gestão</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {subabasGestao.map((subaba) => (
                <div key={subaba.key} className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg hover:bg-secondary/70 transition-colors">
                  <span className="text-sm font-medium">{subaba.label}</span>
                  <Switch
                    checked={permissions[perfil.key]?.[subaba.key as keyof ProfilePermission] as boolean || false}
                    onCheckedChange={() => handleToggle(perfil.key, subaba.key as keyof ProfilePermission)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary-hover text-primary-foreground"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Permissões'}
        </Button>
      </div>
    </div>
  );
}
