import { supabase } from "@/integrations/supabase/client";
import type { ApprovalWithRelations, ApprovalFilters } from "@/types";
import { isValidUUID } from "@/lib/pricing-utils";

// Types
export interface PriceRequestFilters extends Omit<ApprovalFilters, 'onlyMyApprovals'> {
  stationId?: string;
  clientId?: string;
}

export type PriceRequestRecord = ApprovalWithRelations;

export interface CreatePriceRequestData {
  station_id: string;
  client_id: string;
  product: string;
  payment_method_id?: string;
  current_price?: number;
  suggested_price: number;
  purchase_cost?: number;
  freight_cost?: number;
  cost_price?: number;
  margin_cents?: number;
  arla_cost_price?: number;
  arla_purchase_price?: number;
  volume_made?: number;
  volume_projected?: number;
  observations?: string;
  requested_by: string;
  created_by: string;
  batch_id?: string;
  batch_name?: string;
  attachments?: string[];
  status?: string;
}

// Helper
function isTableMissingError(error: any): boolean {
  return error?.code === "PGRST205" || error?.message?.includes("not find the table");
}

// Helper to manual fetch/enrich
async function enrichRequests(data: any[]) {
  if (!data || data.length === 0) return [];

  // 1. Collect IDs
  const stationIds = [...new Set(data.map(d => d.station_id).filter(Boolean))];
  const clientIds = [...new Set(data.map(d => d.client_id).filter(Boolean))];

  // 2. Fetch Stations (via RPC or Table)
  let stationsMap: Record<string, any> = {};
  if (stationIds.length > 0) {
    // Try RPC first as in ApprovalDetails
    const { data: rpcData } = await supabase.rpc('get_sis_empresa_by_ids', { p_ids: stationIds.map(Number).filter(n => !isNaN(n)) });
    if (rpcData) {
      rpcData.forEach((s: any) => {
        stationsMap[s.id_empresa] = { name: s.nome_empresa, code: s.cnpj_cpf };
      });
    }
  }

  // 3. Fetch Clients
  let clientsMap: Record<string, any> = {};
  if (clientIds.length > 0) {
    const { data: clData } = await supabase
      .from('clientes')
      .select('id_cliente, nome')
      .in('id_cliente', clientIds);

    if (clData) {
      clData.forEach((c: any) => {
        clientsMap[c.id_cliente] = { name: c.nome };
      });
    }
  }

  // 4. Enrich and Map
  return data.map(item => {
    // Map final_price to suggested_price if missing
    // Use nullish coalescing to catch null or undefined
    const rawSuggested = item.suggested_price ?? item.final_price;
    const suggestedPrice = typeof rawSuggested === 'string' ? Number(rawSuggested) : rawSuggested;

    // Ensure cost_price is number
    const costPrice = typeof item.cost_price === 'string' ? Number(item.cost_price) : item.cost_price;

    // Enrich Relations
    const station = stationsMap[item.station_id] || { name: item.station_id || 'Não identificado', code: '' };
    const client = clientsMap[item.client_id] || { name: 'Não identificado' };

    return {
      ...item,
      suggested_price: suggestedPrice,
      cost_price: costPrice,
      stations: station,
      clients: client
    };
  });
}

// API Functions
export async function listPriceRequests(filters?: PriceRequestFilters): Promise<PriceRequestRecord[]> {
  let query = supabase
    .from("price_suggestions")
    .select('*') // No joins
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status as any);
  }

  if (filters?.product && filters.product !== "all") {
    query = query.eq("product", filters.product as any);
  }

  if (filters?.stationId) {
    query = query.eq("station_id", filters.stationId);
  }

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  if (filters?.requesterId) {
    query = query.eq("requested_by", filters.requesterId);
  }

  const { data, error } = await query;

  if (error) {
    if (isTableMissingError(error)) return [];
    throw error;
  }

  return await enrichRequests(data);
}

export async function getMyRequests(userId: string): Promise<PriceRequestRecord[]> {
  const { data, error } = await supabase
    .from("price_suggestions")
    .select('*')
    .eq("requested_by", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isTableMissingError(error)) return [];
    throw error;
  }

  return await enrichRequests(data);
}

export async function getPriceRequestById(id: string): Promise<PriceRequestRecord | null> {
  const { data, error } = await supabase
    .from("price_suggestions")
    .select('*')
    .eq("id", id)
    .single();

  if (error) {
    if (isTableMissingError(error)) return null;
    throw error;
  }

  const enriched = await enrichRequests([data]);
  return enriched[0] || null;
}

export async function createPriceRequest(data: CreatePriceRequestData): Promise<string> {
  const { data: result, error } = await supabase.rpc('create_price_request', {
    p_station_id: data.station_id,
    p_product: data.product,
    p_final_price: data.suggested_price,
    p_margin_cents: data.margin_cents || 0,
    p_client_id: data.client_id || null,
    p_payment_method_id: data.payment_method_id || null,
    p_observations: data.observations || null,
    p_purchase_cost: data.purchase_cost || 0,
    p_freight_cost: data.freight_cost || 0,
    p_cost_price: data.cost_price || 0,
    p_status: data.status || 'pending',
    p_batch_id: data.batch_id || null,
    p_batch_name: data.batch_name || null,
    p_volume_made: data.volume_made || 0,
    p_volume_projected: data.volume_projected || 0,
    p_current_price: data.current_price || 0,
    p_arla_purchase_price: data.arla_purchase_price || 0,
    p_arla_cost_price: data.arla_cost_price || 0,
    p_evidence_url: data.attachments && data.attachments.length > 0 ? data.attachments[0] : null
  });

  if (error) {
    throw error;
  }

  return (result as any).id;
}

export async function createPriceRequestsBatch(
  requests: CreatePriceRequestData[]
): Promise<string[]> {
  // Loop client-side to reuse the single creation logic (which now includes auth)
  // In a real optimized scenario, we'd have a batch endpoint.
  const createdIds: string[] = [];
  for (const request of requests) {
    const id = await createPriceRequest(request);
    createdIds.push(id);
  }
  return createdIds;
}

export async function updatePriceRequest(
  id: string,
  data: Partial<CreatePriceRequestData>
): Promise<void> {
  const { error } = await supabase
    .from("price_suggestions")
    .update(data as any)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deletePriceRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from("price_suggestions")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function sendForApproval(id: string): Promise<void> {
  const { error } = await supabase
    .from("price_suggestions")
    .update({
      status: "pending",
      approval_level: 1,
    } as any)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function sendBatchForApproval(ids: string[], batchName?: string): Promise<void> {
  const batchId = crypto.randomUUID();

  const { error } = await supabase
    .from("price_suggestions")
    .update({
      status: "pending",
      approval_level: 1,
      batch_id: batchId,
      batch_name: batchName || null,
    } as any)
    .in("id", ids);

  if (error) {
    throw error;
  }
}

// Approve price request
export async function approvePriceRequest(id: string, observations?: string): Promise<any> {
  if (!isValidUUID(id)) {
    console.error(`[approvePriceRequest] ID inválido para RPC: "${id}"`);
    throw new Error(`ID de solicitação inválido: "${id}". Um UUID era esperado.`);
  }

  const { data, error } = await supabase.rpc('approve_price_request', {
    p_request_id: id,
    p_observations: observations
  });

  if (error) {
    throw error;
  }
  return data;
}

// Reject price request
export async function rejectPriceRequest(id: string, observations: string): Promise<any> {
  if (!isValidUUID(id)) {
    console.error(`[rejectPriceRequest] ID inválido para RPC: "${id}"`);
    throw new Error(`ID de solicitação inválido: "${id}". Um UUID era esperado.`);
  }

  const { data, error } = await supabase.rpc('reject_price_request', {
    p_request_id: id,
    p_observations: observations
  });

  if (error) {
    throw error;
  }
  return data;
}

// Suggest price for a request
export async function suggestPriceRequest(
  id: string,
  suggestedPrice: number,
  observations?: string,
  arlaPrice?: number
): Promise<any> {
  if (!isValidUUID(id)) {
    console.error(`[suggestPriceRequest] ID inválido para RPC: "${id}"`);
    throw new Error(`ID de solicitação inválido: "${id}". Um UUID era esperado.`);
  }

  const { data, error } = await supabase.rpc('suggest_price_request', {
    p_request_id: id,
    p_suggested_price: suggestedPrice,
    p_observations: observations || null,
    p_arla_price: arlaPrice || null
  });

  if (error) throw error;
  return data;
}

// Request justification from requester
export async function requestJustification(id: string, observations: string): Promise<any> {
  if (!isValidUUID(id)) {
    console.error(`[requestJustification] ID inválido para RPC: "${id}"`);
    throw new Error(`ID de solicitação inválido: "${id}". Um UUID era esperado.`);
  }

  const { data, error } = await supabase.rpc('request_justification', {
    p_request_id: id,
    p_observations: observations
  });

  if (error) throw error;
  return data;
}

// Request evidence (price reference) from requester
export async function requestEvidence(
  id: string,
  product: 'principal' | 'arla',
  observations?: string
): Promise<any> {
  if (!isValidUUID(id)) {
    console.error(`[requestEvidence] ID inválido para RPC: "${id}"`);
    throw new Error(`ID de solicitação inválido: "${id}". Um UUID era esperado.`);
  }

  const { data, error } = await supabase.rpc('request_evidence', {
    p_request_id: id,
    p_product: product,
    p_observations: observations || null
  });

  if (error) throw error;
  return data;
}

// Requester provides justification
export async function provideJustification(id: string, justification: string): Promise<any> {
  if (!isValidUUID(id)) {
    console.error(`[provideJustification] ID inválido para RPC: "${id}"`);
    throw new Error(`ID de solicitação inválido: "${id}". Um UUID era esperado.`);
  }

  const { data, error } = await supabase.rpc('provide_justification', {
    p_request_id: id,
    p_justification: justification
  });

  if (error) throw error;
  return data;
}

// Requester provides evidence
export async function provideEvidence(
  id: string,
  attachmentUrl: string,
  observations?: string
): Promise<any> {
  console.warn(`[provideEvidence] Enviando para ID: "${id}"`);

  if (!isValidUUID(id)) {
    console.error(`[provideEvidence] ID inválido detectado. Abortando chamada RPC. ID: "${id}"`);
    throw new Error(`ID de solicitação inválido: "${id}". Operação cancelada para evitar erro de banco de dados.`);
  }

  const { data, error } = await supabase.rpc('provide_evidence', {
    p_request_id: id,
    p_attachment_url: attachmentUrl,
    p_observations: observations || null
  });

  if (error) throw error;
  return data;
}

// Requester appeals a suggested price
export async function appealPriceRequest(
  id: string,
  newPrice: number,
  observations?: string,
  arlaPrice?: number
): Promise<any> {
  if (!isValidUUID(id)) {
    console.error(`[appealPriceRequest] ID inválido para RPC: "${id}"`);
    throw new Error(`ID de solicitação inválido: "${id}". Um UUID era esperado.`);
  }

  const { data, error } = await supabase.rpc('appeal_price_request', {
    p_request_id: id,
    p_new_price: newPrice,
    p_observations: observations || null,
    p_arla_price: arlaPrice || null
  });

  if (error) throw error;
  return data;
}

// Requester accepts a suggested price
export async function acceptSuggestedPrice(id: string, observations?: string): Promise<any> {
  if (!isValidUUID(id)) {
    throw new Error(`ID de solicitação inválido: "${id}"`);
  }

  const { data, error } = await supabase.rpc('accept_suggested_price', {
    p_request_id: id,
    p_observations: observations || null
  });

  if (error) throw error;
  return data;
}

// Get draft requests (added cards not yet sent)
export async function getDraftRequests(userId: string): Promise<PriceRequestRecord[]> {
  const { data, error } = await supabase
    .from("price_suggestions")
    .select('*')
    .eq("requested_by", userId)
    .eq("status", "draft" as any)
    .order("created_at", { ascending: false });

  if (error) {
    if (isTableMissingError(error)) return [];
    throw error;
  }

  return await enrichRequests(data);
}
