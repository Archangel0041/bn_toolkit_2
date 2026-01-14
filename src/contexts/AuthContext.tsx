import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  manualSync: () => Promise<void>;
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
  const syncTriggeredRef = useRef(false);

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
      toast.info('Syncing Discord access...');
      
      const { data, error } = await supabase.functions.invoke('discord-access-sync', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: { provider_token: providerToken },
      });
      
      if (error) {
        console.error('Error syncing Discord access:', error);
        toast.error('Failed to sync Discord access');
        return;
      }
      
      setHasAccess(data?.has_access ?? false);
      toast.success(data?.has_access ? 'Access granted!' : 'Sync complete - no access');
    } catch (err) {
      console.error('Failed to sync Discord access:', err);
      toast.error('Failed to sync Discord access');
    }
  };

  useEffect(() => {
    // Check if this is an OAuth callback (has code in URL)
    const urlParams = new URLSearchParams(window.location.search);
    const hasOAuthCode = urlParams.has('code');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Check if this is a sign-in event with Discord
        if (session?.user) {
          const isDiscordUser = session.user.app_metadata?.providers?.includes('discord');
          
          if (event === 'SIGNED_IN' && isDiscordUser && session.access_token && session.provider_token && !syncTriggeredRef.current) {
            // Mark sync as triggered to prevent duplicates
            syncTriggeredRef.current = true;
            // Trigger Discord access sync for new sign-ins
            setTimeout(() => {
              syncDiscordAccess(session.access_token, session.provider_token!);
              // Clean up the URL after processing OAuth callback
              if (hasOAuthCode) {
                window.history.replaceState({}, '', window.location.pathname);
              }
            }, 0);
          } else if (!syncTriggeredRef.current) {
            // For existing sessions, just fetch access from the table
            setTimeout(() => {
              fetchAccess(session.user.id);
            }, 0);
          }
        } else {
          setHasAccess(false);
          syncTriggeredRef.current = false;
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        const isDiscordUser = session.user.app_metadata?.providers?.includes('discord');
        
        // If we have an OAuth code and provider token, this is a fresh OAuth callback
        // Only sync if not already triggered
        if (hasOAuthCode && isDiscordUser && session.access_token && session.provider_token && !syncTriggeredRef.current) {
          syncTriggeredRef.current = true;
          syncDiscordAccess(session.access_token, session.provider_token);
          // Clean up the URL
          window.history.replaceState({}, '', window.location.pathname);
        } else if (!syncTriggeredRef.current) {
          fetchAccess(session.user.id);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check access on every page load/visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        fetchAccess(user.id);
      }
    };

    // Check access on mount if user exists
    if (user) {
      fetchAccess(user.id);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

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

  const manualSync = async () => {
    if (!session?.access_token || !session?.provider_token) {
      return;
    }
    await syncDiscordAccess(session.access_token, session.provider_token);
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
      manualSync,
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
