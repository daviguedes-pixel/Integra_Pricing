import { supabase } from "@/integrations/supabase/client";
import type { 
  ApprovalStatus, 
  ProductType, 
  ApprovalFilters, 
  ApprovalWithRelations,
  ApproveRequestData,
  RejectRequestData,
  ApprovalHistoryEntry
} from "@/types";

// Re-export types for backwards compatibility
export type { ApprovalStatus, ProductType, ApprovalFilters };
export type ApprovalRecord = ApprovalWithRelations;
export type ApproveData = ApproveRequestData;
export type RejectData = RejectRequestData;

// Helper to handle table missing errors
function isTableMissingError(error: any): boolean {
  return error?.code === "PGRST205" || error?.message?.includes("not find the table");
}

// API Functions
export async function listApprovals(filters?: ApprovalFilters): Promise<ApprovalRecord[]> {
  let query = supabase
    .from("price_suggestions")
    .select(`
      *,
      stations:station_id (name, code),
      clients:client_id (name),
      requester:requested_by (name, email)
    `)
    .order("created_at", { ascending: false });

  // Apply filters
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status as any);
  }

  if (filters?.product && filters.product !== "all") {
    query = query.eq("product", filters.product as any);
  }

  if (filters?.requesterId && filters.requesterId !== "all") {
    query = query.eq("requested_by", filters.requesterId);
  }

  if (filters?.startDate) {
    query = query.gte("created_at", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("created_at", filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    if (isTableMissingError(error)) return [];
    throw error;
  }

  return (data || []) as unknown as ApprovalRecord[];
}

export async function getApprovalById(id: string): Promise<ApprovalRecord | null> {
  const { data, error } = await supabase
    .from("price_suggestions")
    .select(`
      *,
      stations:station_id (name, code),
      clients:client_id (name),
      requester:requested_by (name, email)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (isTableMissingError(error)) return null;
    throw error;
  }

  return data as unknown as ApprovalRecord;
}

export async function approveRequest(
  id: string,
  data: ApproveData
): Promise<void> {
  const updateData: Record<string, any> = {
    status: "approved",
    approved_by: data.userId,
    approved_at: new Date().toISOString(),
  };

  if (data.observation) {
    updateData.approval_observation = data.observation;
  }

  if (data.newPrice !== undefined) {
    updateData.suggested_price = data.newPrice;
  }

  const { error } = await supabase
    .from("price_suggestions")
    .update(updateData)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function rejectRequest(
  id: string,
  data: RejectData
): Promise<void> {
  const updateData: Record<string, any> = {
    status: "rejected",
    approved_by: data.userId,
    approved_at: new Date().toISOString(),
  };

  if (data.observation) {
    updateData.rejection_observation = data.observation;
  }

  const { error } = await supabase
    .from("price_suggestions")
    .update(updateData)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function updateApprovalLevel(
  id: string,
  currentLevel: number,
  maxLevel: number
): Promise<void> {
  const { error } = await supabase
    .from("price_suggestions")
    .update({
      approval_level: currentLevel,
      max_level: maxLevel,
    } as any)
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function deleteApproval(id: string): Promise<void> {
  const { error } = await supabase
    .from("price_suggestions")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function getApprovalHistory(suggestionId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("approval_history")
    .select("*")
    .eq("suggestion_id", suggestionId)
    .order("created_at", { ascending: true });

  if (error) {
    if (isTableMissingError(error)) return [];
    throw error;
  }

  return data || [];
}

export async function addApprovalHistoryEntry(entry: {
  suggestion_id: string;
  approver_id: string;
  approver_name: string;
  action: string;
  observations?: string;
  approval_level?: number;
}): Promise<void> {
  const { error } = await supabase.from("approval_history").insert({
    suggestion_id: entry.suggestion_id,
    approver_id: entry.approver_id,
    approver_name: entry.approver_name,
    action: entry.action,
    observations: entry.observations || '',
    approval_level: entry.approval_level || 0,
  });

  if (error) {
    if (isTableMissingError(error)) return;
    throw error;
  }
}

// Batch operations
export async function approveBatch(
  ids: string[],
  data: ApproveData
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      await approveRequest(id, data);
      success++;
    } catch (error) {
      console.error(`Failed to approve ${id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

export async function rejectBatch(
  ids: string[],
  data: RejectData
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      await rejectRequest(id, data);
      success++;
    } catch (error) {
      console.error(`Failed to reject ${id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

// Get unique requesters for filter dropdown
export async function getUniqueRequesters(): Promise<Array<{ id: string; name: string; email: string }>> {
  const { data, error } = await supabase
    .from("price_suggestions")
    .select("requested_by, requester:requested_by(name, email)")
    .order("created_at", { ascending: false });

  if (error) {
    if (isTableMissingError(error)) return [];
    throw error;
  }

  // Deduplicate
  const seen = new Set<string>();
  const requesters: Array<{ id: string; name: string; email: string }> = [];

  for (const item of data || []) {
    if (item.requested_by && !seen.has(item.requested_by)) {
      seen.add(item.requested_by);
      const req = item.requester as any;
      requesters.push({
        id: item.requested_by,
        name: req?.name || "",
        email: req?.email || "",
      });
    }
  }

  return requesters;
}
