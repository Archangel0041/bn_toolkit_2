import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  hasAccess: boolean;
  isAnonymous: boolean;
  displayName: string | null;
  signInWithUsername: (username: string) => Promise<{ error: Error | null }>;
  signInWithDiscord: () => Promise<{ error: Error | null }>;
  linkDiscord: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate a random password for the pseudo-anonymous account
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 32; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // Check if user signed up with our custom email pattern (not linked to Discord yet)
  const isAnonymous = user?.email?.endsWith('@archangel04.com') && 
    !user?.app_metadata?.providers?.includes('discord');

  // Get display name from metadata or extract from custom email
  const displayName = user?.user_metadata?.discord_username || 
    user?.user_metadata?.custom_claims?.global_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    (user?.email?.endsWith('@archangel04.com') 
      ? user.email.replace('@archangel04.com', '') 
      : null);

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

  // Sync Discord access by calling edge function
  const syncDiscordAccess = async (accessToken: string, providerToken: string) => {
    try {
      console.log('Syncing Discord access...');
      const { data, error } = await supabase.functions.invoke('discord-access-sync', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: {
          provider_token: providerToken,
        },
      });
      
      if (error) {
        console.error('Error syncing Discord access:', error);
        return;
      }
      
      console.log('Discord access sync result:', data);
      setHasAccess(data?.has_access ?? false);
    } catch (err) {
      console.error('Failed to sync Discord access:', err);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Check if this is a sign-in event with Discord
        if (session?.user) {
          const isDiscordUser = session.user.app_metadata?.providers?.includes('discord');
          
          if (event === 'SIGNED_IN' && isDiscordUser && session.access_token && session.provider_token) {
            // Trigger Discord access sync for new sign-ins
            setTimeout(() => {
              syncDiscordAccess(session.access_token, session.provider_token!);
            }, 0);
          } else {
            // For existing sessions, just fetch access from the table
            setTimeout(() => {
              fetchAccess(session.user.id);
            }, 0);
          }
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

  const signInWithUsername = async (username: string) => {
    const email = `${username.toLowerCase()}@archangel04.com`;
    const password = generateRandomPassword();
    
    // Try to sign up first
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          discord_username: username,
        },
      },
    });

    if (signUpError) {
      // If user already exists, try to sign in (they should link Discord to recover)
      if (signUpError.message.includes('already registered')) {
        return { 
          error: new Error('This username is already taken. If this is you, please contact support to recover your account.') 
        };
      }
      return { error: signUpError };
    }

    return { error: null };
  };

  const signInWithDiscord = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'identify guilds.members.read',
      }
    });
    
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
      displayName,
      signInWithUsername,
      signInWithDiscord,
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
