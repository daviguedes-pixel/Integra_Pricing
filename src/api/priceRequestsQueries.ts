import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPriceRequests,
  getMyRequests,
  getPriceRequestById,
  createPriceRequest,
  createPriceRequestsBatch,
  updatePriceRequest,
  deletePriceRequest,
  sendForApproval,
  sendBatchForApproval,
  getDraftRequests,
  PriceRequestFilters,
  CreatePriceRequestData,
} from "./priceRequestsApi";

// Query Keys
export const priceRequestKeys = {
  all: ["priceRequests"] as const,
  lists: () => [...priceRequestKeys.all, "list"] as const,
  list: (filters?: PriceRequestFilters) => [...priceRequestKeys.lists(), filters] as const,
  myRequests: (userId: string) => [...priceRequestKeys.all, "my", userId] as const,
  drafts: (userId: string) => [...priceRequestKeys.all, "drafts", userId] as const,
  details: () => [...priceRequestKeys.all, "detail"] as const,
  detail: (id: string) => [...priceRequestKeys.details(), id] as const,
};

// Hooks
export function usePriceRequests(filters?: PriceRequestFilters) {
  return useQuery({
    queryKey: priceRequestKeys.list(filters),
    queryFn: () => listPriceRequests(filters),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useMyRequests(userId: string) {
  return useQuery({
    queryKey: priceRequestKeys.myRequests(userId),
    queryFn: () => getMyRequests(userId),
    enabled: !!userId,
    staleTime: 1 * 60 * 1000,
  });
}

export function useDraftRequests(userId: string) {
  return useQuery({
    queryKey: priceRequestKeys.drafts(userId),
    queryFn: () => getDraftRequests(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

export function usePriceRequest(id: string) {
  return useQuery({
    queryKey: priceRequestKeys.detail(id),
    queryFn: () => getPriceRequestById(id),
    enabled: !!id,
    staleTime: 1 * 60 * 1000,
  });
}

// Mutations
export function useCreatePriceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePriceRequestData) => createPriceRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceRequestKeys.all });
    },
  });
}

export function useCreatePriceRequestsBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requests: CreatePriceRequestData[]) => createPriceRequestsBatch(requests),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceRequestKeys.all });
    },
  });
}

export function useUpdatePriceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePriceRequestData> }) =>
      updatePriceRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceRequestKeys.all });
    },
  });
}

export function useDeletePriceRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePriceRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceRequestKeys.all });
    },
  });
}

export function useSendForApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => sendForApproval(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceRequestKeys.all });
    },
  });
}

export function useSendBatchForApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, batchName }: { ids: string[]; batchName?: string }) =>
      sendBatchForApproval(ids, batchName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceRequestKeys.all });
    },
  });
}
