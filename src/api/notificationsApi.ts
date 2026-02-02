import { supabase } from "@/integrations/supabase/client";

export interface NotificationRecord {
  id: string;
  user_id: string;
  suggestion_id?: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: unknown;
}

function isTableMissingError(error: any) {
  return error?.code === "PGRST205" || error?.message?.includes("not find the table");
}

function normalizeNotificationData(n: any): NotificationRecord {
  const normalized: any = { ...n };
  if (normalized.data && typeof normalized.data === "string") {
    try {
      normalized.data = JSON.parse(normalized.data);
    } catch {
      // keep as-is
    }
  }
  return normalized as NotificationRecord;
}

export async function listNotifications(userId: string): Promise<NotificationRecord[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isTableMissingError(error)) return [];
    throw error;
  }

  return (data || []).map(normalizeNotificationData);
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) {
    if (isTableMissingError(error)) return;
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    if (isTableMissingError(error)) return;
    throw error;
  }
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) {
    if (isTableMissingError(error)) return;
    throw error;
  }
}
