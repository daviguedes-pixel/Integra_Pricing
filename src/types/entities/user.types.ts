/**
 * Tipos para usuários e permissões
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  name?: string;
  email?: string;
  phone?: string;
  perfil?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Permission {
  id: string;
  perfil: string;
  modulo: string;
  pode_visualizar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
  pode_aprovar: boolean;
}

export type PermissionKey = 
  | 'dashboard'
  | 'price_request'
  | 'approvals'
  | 'price_history'
  | 'portfolio'
  | 'admin'
  | 'settings'
  | 'gestao'
  | 'map'
  | 'references'
  | 'taxes'
  | 'stations'
  | 'clients';

export type PermissionAction = 'view' | 'edit' | 'delete' | 'approve';

export interface UserSession {
  user: User;
  profile?: UserProfile;
  permissions?: Permission[];
}
