import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/types";

// Re-export types
export type { Client };

// API Functions
export async function listClients(): Promise<Client[]> {
  try {
    const { data, error } = await supabase
      .from('clientes' as any)
      .select('id_cliente, nome')
      .order('nome');

    if (error) {
      console.error('Error loading clients:', error);
      return [];
    }

    return (data as any[]).map((client: any) => ({
      id: client.id_cliente,
      name: client.nome,
      code: client.id_cliente,
      active: true,
    }));
  } catch (error) {
    console.error('Error loading clients:', error);
    return [];
  }
}

export async function getClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clientes' as any)
    .select('id_cliente, nome')
    .eq('id_cliente', id)
    .single();

  if (error) {
    return null;
  }

  const client = data as any;
  return {
    id: client.id_cliente,
    name: client.nome,
    code: client.id_cliente,
    active: true,
  };
}

export async function searchClients(query: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clientes' as any)
    .select('id_cliente, nome')
    .ilike('nome', `%${query}%`)
    .order('nome')
    .limit(50);

  if (error) {
    console.error('Error searching clients:', error);
    return [];
  }

  return (data as any[]).map((client: any) => ({
    id: client.id_cliente,
    name: client.nome,
    code: client.id_cliente,
    active: true,
  }));
}
