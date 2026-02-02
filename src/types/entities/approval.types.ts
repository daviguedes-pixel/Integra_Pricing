/**
 * Tipos para aprovações de preço
 */

export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'price_suggested' | 'in_approval';

export type ProductType =
  | 's10'
  | 's10_aditivado'
  | 'diesel_s500'
  | 'diesel_s500_aditivado'
  | 'arla32_granel'
  | 'etanol'
  | 'gasolina_comum'
  | 'gasolina_aditivada'
  | 's500';

export interface Approval {
  id: string;
  station_id: string;
  client_id: string;
  product: ProductType;
  status: ApprovalStatus;
  suggested_price: number;
  current_price?: number;
  purchase_cost?: number;
  freight_cost?: number;
  cost_price?: number;
  final_price?: number;
  margin_cents?: number;
  volume_made?: number;
  volume_projected?: number;
  observations?: string;
  requested_by: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  approval_level?: number;
  approvals_count?: number;
  max_level?: number;
  batch_id?: string;
  batch_name?: string;
  reference_id?: string;
  payment_method_id?: string;
  arla_cost_price?: number;
  arla_purchase_price?: number;
  attachments?: string[];
  created_at: string;
  updated_at?: string;
}

export interface ApprovalWithRelations extends Approval {
  stations?: { name: string; code?: string } | null;
  clients?: { name: string; id_cliente?: string } | null;
  requester?: { name?: string; email?: string } | null;
}

export interface ApprovalFilters {
  status?: ApprovalStatus | 'all';
  product?: ProductType | 'all';
  requesterId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  onlyMyApprovals?: boolean;
  userId?: string;
}

export interface ApproveRequestData {
  userId: string;
  userName?: string;
  observation?: string;
  newPrice?: number;
}

export interface RejectRequestData {
  userId: string;
  userName?: string;
  observation?: string;
}

export interface ApprovalHistoryEntry {
  id: string;
  suggestion_id: string;
  approver_id: string;
  approver_name: string;
  action: string;
  observations?: string;
  approval_level?: number;
  created_at: string;
}

export interface BatchApproval {
  batchKey: string;
  batch_name?: string;
  requests: ApprovalWithRelations[];
  created_at: string;
  status: ApprovalStatus;
}

// Tipos estendidos para uso no Approvals.tsx

/** Cliente relacionado a uma aprovação */
export interface ApprovalClient {
  id?: string;
  id_cliente?: string;
  name?: string;
  nome?: string;
  code?: string;
}

/** Posto relacionado a uma aprovação */
export interface ApprovalStation {
  id?: string;
  name?: string;
  nome_empresa?: string;
  code?: string;
  cnpj_cpf?: string;
  id_empresa?: string;
}

/** Usuário que solicitou uma aprovação */
export interface ApprovalRequester {
  id?: string;
  user_id?: string;
  email?: string;
  name?: string;
  nome?: string;
}

/** Método de pagamento relacionado */
export interface ApprovalPaymentMethod {
  name?: string;
  CARTAO?: string;
  TAXA?: number;
  PRAZO?: number | string;
  ID_POSTO?: string;
}

/** Aprovação enriquecida com dados de relacionamentos e estado do fluxo de aprovação */
export interface EnrichedApproval extends Omit<Approval, 'product' | 'requested_by'> {
  product: string; // Relaxar tipo para aceitar qualquer string do banco
  stations?: ApprovalStation | null;
  clients?: ApprovalClient | null;
  requester?: ApprovalRequester | null;
  payment_methods?: ApprovalPaymentMethod | null;
  /** Nome do aprovador atual */
  current_approver_name?: string | null;
  /** ID do aprovador atual */
  current_approver_id?: string | null;
  /** Se é a vez do usuário logado aprovar */
  is_current_user_turn?: boolean;
  /** Se o usuário já aprovou esta solicitação */
  user_already_approved?: boolean;
  /** Se é uma referência (não deve aparecer em aprovações) */
  is_reference?: boolean;
  /** ID do solicitante (pode ser null em dados do banco) */
  requested_by?: string | null;
}

/** Grupo de aprovações em lote para exibição */
export interface BatchApprovalGroup {
  batchKey: string;
  requests: EnrichedApproval[];
  allRequests: EnrichedApproval[];
  client?: ApprovalClient | null;
  clients?: (ApprovalClient | null)[];
  hasMultipleClients?: boolean;
  created_at: string;
  created_by?: string;
}

/** Aprovador com informações de perfil */
export interface Approver {
  user_id: string;
  email?: string;
  perfil?: string;
}

/** Estatísticas de aprovações */
export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

/** Filtros de aprovação da UI */
export interface ApprovalUIFilters {
  status: string;
  station: string;
  client: string;
  product: string;
  requester: string;
  search: string;
  startDate: string;
  endDate: string;
  myApprovalsOnly: boolean;
}

// Tipos para dados brutos do banco (antes de enriquecimento)

/** Dados brutos de price_suggestions do banco */
export interface PriceSuggestionRow {
  id: string;
  station_id: string | null;
  client_id: string | null;
  product: string;
  status: string;
  suggested_price: number | null;
  current_price: number | null;
  cost_price: number | null;
  final_price: number | null;
  margin_cents: number | null;
  payment_method_id: string | null;
  batch_id: string | null;
  batch_name: string | null;
  approval_level: number | null;
  approvals_count: number | null;
  max_level: number | null;
  requested_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  observations: string | null;
  attachments: string[] | null;
  reference_id: string | null;
  arla_purchase_price: number | null;
}

/** Dados brutos de sis_empresa (postos) do banco */
export interface StationRow {
  id?: string;
  id_empresa?: string | number;
  nome_empresa?: string;
  name?: string;
  cnpj_cpf?: string;
  code?: string;
}

/** Dados brutos de clientes do banco */
export interface ClientRow {
  id?: string;
  id_cliente?: string;
  nome?: string;
  name?: string;
}

/** Dados brutos de user_profiles do banco */
export interface RequesterRow {
  user_id: string;
  email?: string;
  nome?: string;
}

/** Dados brutos de tipos_pagamento do banco */
export interface PaymentMethodRow {
  CARTAO: string;
  TAXA?: number;
  PRAZO?: number | string;
  ID_POSTO?: string;
}
