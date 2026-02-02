import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listApprovals,
  getApprovalById,
  approveRequest,
  rejectRequest,
  deleteApproval,
  approveBatch,
  rejectBatch,
  getUniqueRequesters,
  getApprovalHistory,
  addApprovalHistoryEntry,
  ApprovalFilters,
  ApproveData,
  RejectData,
} from "./approvalsApi";

// Query Keys
export const approvalKeys = {
  all: ["approvals"] as const,
  lists: () => [...approvalKeys.all, "list"] as const,
  list: (filters?: ApprovalFilters) => [...approvalKeys.lists(), filters] as const,
  details: () => [...approvalKeys.all, "detail"] as const,
  detail: (id: string) => [...approvalKeys.details(), id] as const,
  history: (id: string) => [...approvalKeys.all, "history", id] as const,
  requesters: () => [...approvalKeys.all, "requesters"] as const,
};

// Hooks
export function useApprovals(filters?: ApprovalFilters) {
  return useQuery({
    queryKey: approvalKeys.list(filters),
    queryFn: () => listApprovals(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

export function useApproval(id: string) {
  return useQuery({
    queryKey: approvalKeys.detail(id),
    queryFn: () => getApprovalById(id),
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useApprovalHistory(suggestionId: string) {
  return useQuery({
    queryKey: approvalKeys.history(suggestionId),
    queryFn: () => getApprovalHistory(suggestionId),
    enabled: !!suggestionId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useRequesters() {
  return useQuery({
    queryKey: approvalKeys.requesters(),
    queryFn: getUniqueRequesters,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutations
export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveData }) =>
      approveRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });
}

export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectData }) =>
      rejectRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });
}

export function useDeleteApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteApproval(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });
}

export function useApproveBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, data }: { ids: string[]; data: ApproveData }) =>
      approveBatch(ids, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });
}

export function useRejectBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, data }: { ids: string[]; data: RejectData }) =>
      rejectBatch(ids, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    },
  });
}

export function useAddApprovalHistory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entry: {
      suggestion_id: string;
      approver_id: string;
      approver_name: string;
      action: string;
      observations?: string;
      approval_level?: number;
    }) => addApprovalHistoryEntry(entry),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: approvalKeys.history(variables.suggestion_id),
      });
    },
  });
}
