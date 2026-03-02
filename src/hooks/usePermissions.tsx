import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getProfilePermissions, getUserProfile } from '@/api/permissionsApi';

interface UserPermissions {
  role: 'admin' | 'user';
  max_approval_margin: number;
  permissions: {
    // Abas visíveis
    dashboard: boolean;
    price_request: boolean;
    approvals: boolean;
    research: boolean;
    map: boolean;
    price_history: boolean;
    admin: boolean;
    reference_registration: boolean;
    tax_management: boolean;
    station_management: boolean;
    client_management: boolean;
    audit_logs: boolean;
    settings: boolean;
    gestao: boolean;
    approval_margin_config: boolean;
    gestao_stations: boolean;
    gestao_clients: boolean;
    gestao_payment_methods: boolean;
    portfolio_manager: boolean;
    variations: boolean;
    quotations: boolean;
    mapa_contatos: boolean;
    cargas: boolean;
    nfs_incorretas: boolean;
    paridade: boolean;
    financial_review: boolean;

    // Funções habilitadas
    can_approve: boolean;
    can_register: boolean;
    can_edit: boolean;
    can_delete: boolean;
    can_view_history: boolean;
    can_manage_notifications: boolean;
  };
}

type PermissionKey = keyof UserPermissions['permissions'];

interface PermissionsContextType {
  permissions: UserPermissions | null;
  loading: boolean;
  canAccess: (tab: string) => boolean;
  canPerform: (action: string) => boolean;
  canApproveMargin: (marginCents: number) => boolean;
  reloadPermissions: () => Promise<void>;
}

const defaultPermissions: UserPermissions = {
  role: 'user',
  max_approval_margin: 0,
  permissions: {
    dashboard: false,
    price_request: false,
    approvals: false,
    research: false,
    map: false,
    price_history: false,
    admin: false,
    reference_registration: false,
    tax_management: false,
    station_management: false,
    client_management: false,
    audit_logs: false,
    settings: false,
    gestao: false,
    approval_margin_config: false,
    gestao_stations: false,
    gestao_clients: false,
    gestao_payment_methods: false,
    portfolio_manager: false,
    variations: false,
    quotations: false,
    mapa_contatos: false,
    cargas: false,
    nfs_incorretas: false,
    paridade: false,
    financial_review: false,
    can_approve: false,
    can_register: false,
    can_edit: false,
    can_delete: false,
    can_view_history: false,
    can_manage_notifications: false,
  }
};

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: null,
  loading: true,
  canAccess: () => false,
  canPerform: () => false,
  canApproveMargin: () => false,
  reloadPermissions: async () => { },
});

export const usePermissions = () => useContext(PermissionsContext);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  const loadPermissions = async () => {
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    try {
      // ADMIN FIXO: davi.guedes@redesaoroque.com.br sempre tem acesso total
      const email = user.email || '';

      console.log('Carregando permissões para:', { email });

      // Se for o davi.guedes, forçar permissões de admin
      if (email === 'davi.guedes@redesaoroque.com.br') {
        console.log('Admin fixo detectado: davi.guedes@redesaoroque.com.br');
        setPermissions({
          role: 'admin',
          max_approval_margin: 999999,
          permissions: {
            dashboard: true,
            price_request: true,
            approvals: true,
            research: true,
            map: true,
            price_history: true,
            admin: true,
            reference_registration: true,
            tax_management: true,
            station_management: true,
            client_management: true,
            audit_logs: true,
            settings: true,
            gestao: true,
            approval_margin_config: true,
            gestao_stations: true,
            gestao_clients: true,
            gestao_payment_methods: true,
            portfolio_manager: true,
            variations: true,
            quotations: true,
            mapa_contatos: true,
            cargas: true,
            nfs_incorretas: true,
            paridade: true,
            financial_review: true,
            can_approve: true,
            can_register: true,
            can_edit: true,
            can_delete: true,
            can_view_history: true,
            can_manage_notifications: true,
          }
        });
        setLoading(false);
        return;
      }

      // Buscar perfil do usuário com tratamento de erro melhorado
      let profileData: any = null;
      try {
        profileData = await getUserProfile(user.id);
      } catch (profileError) {
        console.error('Error loading profile:', profileError);
        // Se não conseguir carregar o perfil, usar permissões mínimas
        setPermissions({
          role: 'user',
          max_approval_margin: 0,
          permissions: {
            dashboard: true,
            price_request: true,
            approvals: false,
            research: false,
            map: false,
            price_history: false,
            admin: false,
            reference_registration: false,
            tax_management: false,
            station_management: false,
            client_management: false,
            audit_logs: false,
            settings: false,
            gestao: false,
            approval_margin_config: false,
            gestao_stations: false,
            gestao_clients: false,
            gestao_payment_methods: false,
            portfolio_manager: false,
            variations: false,
            quotations: false,
            mapa_contatos: false,
            cargas: false,
            nfs_incorretas: false,
            paridade: false,
            financial_review: false,
            can_approve: false,
            can_register: true,
            can_edit: false,
            can_delete: false,
            can_view_history: false,
            can_manage_notifications: false,
          }
        });
        setLoading(false);
        return;
      }

      if (!profileData) {
        console.error('No profile data found');
        setPermissions(defaultPermissions);
        setLoading(false);
        return;
      }

      // Determinar perfil - usar o perfil do banco de dados se existir
      const perfilFromDb = (profileData as any).perfil || null;
      const role = profileData.role || 'analista';
      const perfil = perfilFromDb || (
        role === 'admin' ? 'diretor_comercial' :
          role === 'supervisor' ? 'supervisor_comercial' :
            role === 'gerente' ? 'gerente' : 'analista_pricing'
      );

      console.log('Perfil determinado:', { role, perfil, perfilFromDb });

      // Buscar permissões da tabela profile_permissions
      let perms: any = null;
      try {
        perms = await getProfilePermissions(perfil);
      } catch (permsError) {
        console.error('Error loading permissions:', permsError);
        // Se não conseguir carregar permissões específicas, usar permissões baseadas no role
        const isAdmin = role === 'admin';
        setPermissions({
          role: isAdmin ? 'admin' : 'user',
          max_approval_margin: profileData.max_approval_margin || 0,
          permissions: {
            dashboard: true,
            price_request: true,
            approvals: isAdmin,
            research: isAdmin,
            map: true,
            price_history: isAdmin,
            admin: isAdmin,
            reference_registration: isAdmin,
            tax_management: isAdmin,
            station_management: isAdmin,
            client_management: isAdmin,
            audit_logs: isAdmin,
            settings: isAdmin,
            gestao: isAdmin,
            approval_margin_config: isAdmin,
            gestao_stations: isAdmin,
            gestao_clients: isAdmin,
            gestao_payment_methods: isAdmin,
            portfolio_manager: isAdmin,
            variations: isAdmin,
            quotations: isAdmin,
            mapa_contatos: isAdmin,
            cargas: isAdmin,
            nfs_incorretas: isAdmin,
            paridade: isAdmin,
            financial_review: isAdmin,
            can_approve: isAdmin,
            can_register: true,
            can_edit: isAdmin,
            can_delete: isAdmin,
            can_view_history: true,
            can_manage_notifications: isAdmin,
          }
        });
        setLoading(false);
        return;
      }

      const userRole = (perfil === 'diretor_comercial' || perfil === 'diretor_pricing') ? 'admin' : 'user';

      const permsData = perms as any;
      console.log('Permissões carregadas do banco:', { perfil, userRole, perms: permsData });
      console.log('🔍 Verificando permissões de gestão:', {
        gestao: permsData.gestao,
        gestao_stations: permsData.gestao_stations,
        gestao_clients: permsData.gestao_clients,
        gestao_payment_methods: permsData.gestao_payment_methods
      });

      setPermissions({
        role: userRole as 'admin' | 'user',
        max_approval_margin: profileData.max_approval_margin || 0,
        permissions: {
          dashboard: permsData.dashboard || false,
          price_request: permsData.price_request || false,
          approvals: permsData.approvals || false,
          research: permsData.research || false,
          map: permsData.map || false,
          price_history: permsData.price_history || false,
          admin: permsData.admin || false,
          reference_registration: permsData.reference_registration || false,
          tax_management: permsData.tax_management || false,
          station_management: permsData.station_management || false,
          client_management: permsData.client_management || false,
          audit_logs: permsData.audit_logs || false,
          settings: permsData.settings || false,
          gestao: permsData.gestao || false,
          approval_margin_config: permsData.approval_margin_config || false,
          gestao_stations: permsData.gestao_stations || false,
          gestao_clients: permsData.gestao_clients || false,
          gestao_payment_methods: permsData.gestao_payment_methods || false,
          portfolio_manager: permsData.portfolio_manager || false,
          variations: permsData.variations || false,
          quotations: permsData.quotations || false,
          mapa_contatos: permsData.mapa_contatos || false,
          cargas: permsData.cargas || false,
          nfs_incorretas: permsData.nfs_incorretas || false,
          paridade: permsData.paridade || false,
          financial_review: permsData.financial_review || false,
          can_approve: permsData.can_approve || false,
          can_register: permsData.can_register || false,
          can_edit: permsData.can_edit || false,
          can_delete: permsData.can_delete || false,
          can_view_history: permsData.can_view_history || false,
          can_manage_notifications: permsData.can_manage_notifications || false,
        }
      });
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions(defaultPermissions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadPermissions();
    }
  }, [user?.id, profile]); // Adicionar profile como dependência para recarregar quando mudar

  const canAccess = (tab: string): boolean => {
    if (!permissions) {
      console.log('🚫 canAccess: Sem permissões carregadas');
      return false;
    }
    if (permissions.role === 'admin') {
      console.log('✅ canAccess: Admin - acesso total para', tab);
      return true;
    }
    const key = tab as PermissionKey;
    const hasAccess = permissions.permissions[key] || false;
    console.log(`🔍 canAccess: ${tab} = ${hasAccess}`, {
      tab,
      hasAccess,
      permissions: permissions.permissions[key]
    });
    return hasAccess;
  };

  const canPerform = (action: string): boolean => {
    if (!permissions) return false;
    if (permissions.role === 'admin') return true;
    return permissions.permissions[action as PermissionKey] || false;
  };

  const canApproveMargin = (marginCents: number): boolean => {
    if (!permissions) return false;
    if (permissions.role === 'admin') return true;
    return marginCents <= permissions.max_approval_margin;
  };

  const reloadPermissions = async () => {
    setLoading(true);
    await loadPermissions();
  };

  return (
    <PermissionsContext.Provider value={{
      permissions,
      loading,
      canAccess,
      canPerform,
      canApproveMargin,
      reloadPermissions
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}