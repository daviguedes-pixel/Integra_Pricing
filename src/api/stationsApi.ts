import { supabase } from "@/integrations/supabase/client";
import type { Station, PaymentMethod } from "@/types";

// Re-export types
export type { Station, PaymentMethod };

// API Functions
export async function listStations(): Promise<Station[]> {
  try {
    // Try RPC function first
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_sis_empresa_stations');
    
    if (!rpcError && rpcData) {
      return (rpcData as any[]).map((station: any) => ({
        id: String(station.id_empresa || station.cnpj_cpf || `${station.nome_empresa}-${Math.random()}`),
        name: station.nome_empresa,
        code: station.cnpj_cpf,
        latitude: station.latitude,
        longitude: station.longitude,
        bandeira: station.bandeira,
        rede: station.rede,
        active: true,
      }));
    }

    // Fallback: query table directly
    const { data, error } = await supabase
      .from('sis_empresa')
      .select('nome_empresa, cnpj_cpf, latitude, longitude, bandeira, rede, registro_ativo')
      .order('nome_empresa');

    if (error) {
      console.error('Error loading stations:', error);
      return [];
    }

    return (data as any[]).map((station: any) => ({
      id: station.cnpj_cpf || `${station.nome_empresa}-${Math.random()}`,
      name: station.nome_empresa,
      code: station.cnpj_cpf,
      latitude: station.latitude,
      longitude: station.longitude,
      bandeira: station.bandeira,
      rede: station.rede,
      active: true,
    }));
  } catch (error) {
    console.error('Error loading stations:', error);
    return [];
  }
}

export async function getStationById(id: string): Promise<Station | null> {
  const { data, error } = await supabase
    .from('sis_empresa')
    .select('nome_empresa, cnpj_cpf, latitude, longitude, bandeira, rede')
    .eq('cnpj_cpf', id)
    .single();

  if (error) {
    return null;
  }

  const station = data as any;
  return {
    id: station.cnpj_cpf,
    name: station.nome_empresa,
    code: station.cnpj_cpf,
    latitude: station.latitude,
    longitude: station.longitude,
    bandeira: station.bandeira,
    rede: station.rede,
    active: true,
  };
}

export async function getPaymentMethodsForStation(stationId: string): Promise<any[]> {
  if (!stationId || stationId === '' || stationId === 'none') {
    return [];
  }

  const { data, error } = await supabase
    .from('tipos_pagamento' as any)
    .select('*')
    .eq('ID_POSTO', stationId);

  if (error) {
    console.error('Error loading payment methods:', error);
    return [];
  }

  // Deduplicate by CARTAO and ID_POSTO
  const grouped = new Map<string, any>();
  (data || []).forEach((method: any) => {
    const key = `${method.CARTAO}_${method.ID_POSTO || 'all'}`;
    if (!grouped.has(key)) {
      grouped.set(key, method);
    }
  });

  return Array.from(grouped.values());
}

export async function getAllPaymentMethods(): Promise<any[]> {
  const { data, error } = await supabase
    .from('tipos_pagamento' as any)
    .select('*')
    .order('"CARTAO"');

  if (error) {
    console.error('Error loading payment methods:', error);
    return [];
  }

  return data || [];
}
