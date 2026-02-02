import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getUserProfileByUserId } from '@/api/profileApi';
import type { UserProfile } from '@/types';

interface SignInResult {
  error: AuthError | Error | null;
  data?: { user: User | null; session: unknown };
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  isConfigured: boolean;
}

// NOTE: All authentication now uses real Supabase. No mock paths.

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  isConfigured: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    try {
      const data = await getUserProfileByUserId(userId);
      console.log('[Auth] loadProfile result', { hasData: !!data, hasError: false });
      if (data) setProfile(data);
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    console.log('[Auth] init start');
    // Set up auth state listener FIRST to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      console.log('[Auth] onAuthStateChange', { event, hasSession: !!session, hasUser: !!session?.user });
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer profile fetch to avoid blocking the callback
        setTimeout(() => {
          console.log('[Auth] deferred loadProfile');
          loadProfile(session.user!.id);
        }, 0);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;
        console.log('[Auth] getSession resolved', { hasSession: !!session, hasUser: !!session?.user });
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            console.log('[Auth] deferred loadProfile from getSession');
            loadProfile(session.user!.id);
          }, 0);
        }
      })
      .catch((error) => {
        console.error('[Auth] getSession error:', error);
      })
      .finally(() => {
        if (mounted) {
          console.log('[Auth] finalize -> setLoading(false)');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error, data };
    } catch (error) {
      return { error } as any;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }, []);

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isConfigured: true,
  };

  console.log('[Auth] context value', { loading, hasUser: !!user, hasProfile: !!profile });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}