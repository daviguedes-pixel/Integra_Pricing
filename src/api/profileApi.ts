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
    nome: data.nome,
    email: data.email,
    phone: undefined,
    perfil: data.perfil,
    avatar_url: undefined,
    created_at: data.created_at,
    updated_at: data.updated_at,
  } as UserProfile;
}
