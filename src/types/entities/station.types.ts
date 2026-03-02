/**
 * Tipos para postos (stations)
 */

export interface Station {
  id: string;
  name: string;
  code: string;
  latitude?: number;
  longitude?: number;
  bandeira?: string;
  rede?: string;
  address?: string;
  city?: string;
  state?: string;
  municipio?: string;
  uf?: string;
  active: boolean;
}

export interface StationWithPayments extends Station {
  paymentMethods?: PaymentMethod[];
}

export interface PaymentMethod {
  id?: number | string;
  ID_POSTO?: string;
  POSTO?: string;
  CARTAO: string;
  TAXA?: number;
  PRAZO?: string;
}

export interface StationFilters {
  search?: string;
  bandeira?: string;
  rede?: string;
  active?: boolean;
}
