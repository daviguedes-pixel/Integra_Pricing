/**
 * Tipos para clientes
 */

export interface Client {
  id: string;
  id_cliente?: string;
  name: string;
  nome?: string;
  code: string;
  contact_email?: string;
  contact_phone?: string;
  active: boolean;
}

export interface ClientFilters {
  search?: string;
  active?: boolean;
}
