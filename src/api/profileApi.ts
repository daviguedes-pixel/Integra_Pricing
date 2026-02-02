import { supabase } from "@/integrations/supabase/client";
import type { UserProfile } from "@/types";

export async function getUserProfileByUserId(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  
  if (!data) return null;
  
  return {
    id: data.id,
    user_id: data.user_id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    perfil: data.perfil,
    avatar_url: data.avatar_url,
    created_at: data.created_at,
    updated_at: data.updated_at,
  } as UserProfile;
}
