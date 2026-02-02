import { supabase } from "@/integrations/supabase/client";
import type { ApprovalWithRelations, ApprovalFilters } from "@/types";

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
}

// Helper
function isTableMissingError(error: any): boolean {
  return error?.code === "PGRST205" || error?.message?.includes("not find the table");
}

// API Functions
export async function listPriceRequests(filters?: PriceRequestFilters): Promise<PriceRequestRecord[]> {
  let query = supabase
    .from("price_suggestions")
    .select(`
      *,
      stations:station_id (name, code),
      clients:client_id (name)
    `)
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

  return (data || []) as unknown as PriceRequestRecord[];
}

export async function getMyRequests(userId: string): Promise<PriceRequestRecord[]> {
  const { data, error } = await supabase
    .from("price_suggestions")
    .select(`
      *,
      stations:station_id (name, code),
      clients:client_id (name)
    `)
    .eq("requested_by", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isTableMissingError(error)) return [];
    throw error;
  }

  return (data || []) as unknown as PriceRequestRecord[];
}

export async function getPriceRequestById(id: string): Promise<PriceRequestRecord | null> {
  const { data, error } = await supabase
    .from("price_suggestions")
    .select(`
      *,
      stations:station_id (name, code),
      clients:client_id (name)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (isTableMissingError(error)) return null;
    throw error;
  }

  return data as unknown as PriceRequestRecord;
}

export async function createPriceRequest(data: CreatePriceRequestData): Promise<string> {
  const { data: result, error } = await supabase
    .from("price_suggestions")
    .insert({
      ...data,
      status: "draft",
    } as any)
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return result.id;
}

export async function createPriceRequestsBatch(
  requests: CreatePriceRequestData[]
): Promise<string[]> {
  const { data, error } = await supabase
    .from("price_suggestions")
    .insert(requests.map(r => ({ ...r, status: "draft" })) as any)
    .select("id");

  if (error) {
    throw error;
  }

  return (data || []).map((r: any) => r.id);
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

// Get draft requests (added cards not yet sent)
export async function getDraftRequests(userId: string): Promise<PriceRequestRecord[]> {
  const { data, error } = await supabase
    .from("price_suggestions")
    .select(`
      *,
      stations:station_id (name, code),
      clients:client_id (name)
    `)
    .eq("requested_by", userId)
    .eq("status", "draft" as any)
    .order("created_at", { ascending: false });

  if (error) {
    if (isTableMissingError(error)) return [];
    throw error;
  }

  return (data || []) as unknown as PriceRequestRecord[];
}
