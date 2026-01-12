import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  hasAccess: boolean;
  isAnonymous: boolean;
  signInAnonymously: () => Promise<{ error: Error | null }>;
  linkDiscord: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const isAnonymous = user?.is_anonymous ?? false;

  const fetchAccess = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('has_access')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching access:', error);
      setHasAccess(false);
      return;
    }
    
    setHasAccess(data?.has_access ?? false);
  };

  const refreshAccess = async () => {
    if (user) {
      await fetchAccess(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Defer access fetching to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchAccess(session.user.id);
          }, 0);
        } else {
          setHasAccess(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        fetchAccess(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInAnonymously = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    return { error: error || null };
  };

  const linkDiscord = async () => {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'identify guilds.members.read',
      }
    });
    
    return { error: error || null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setHasAccess(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      hasAccess,
      isAnonymous,
      signInAnonymously,
      linkDiscord,
      signOut,
      refreshAccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
