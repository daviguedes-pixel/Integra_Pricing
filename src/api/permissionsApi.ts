import { supabase } from "@/integrations/supabase/client";

export type ProfilePermissionsRow = Record<string, any>;
export type UserProfileRow = Record<string, any>;

export async function getUserProfile(userId: string): Promise<UserProfileRow | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return data as any;
}

export async function getProfilePermissions(perfil: string): Promise<ProfilePermissionsRow | null> {
  const { data, error } = await supabase
    .from("profile_permissions")
    .select("*")
    .eq("perfil", perfil)
    .single();

  if (error) throw error;
  return data as any;
}
