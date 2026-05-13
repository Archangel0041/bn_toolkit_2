import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const DEFAULT_ACCOUNT_LEVEL = 65;
export const MIN_ACCOUNT_LEVEL = 1;
export const MAX_ACCOUNT_LEVEL = 200;

export function useAccountLevel() {
  const { user } = useAuth();
  const [accountLevel, setAccountLevelState] = useState<number>(DEFAULT_ACCOUNT_LEVEL);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setAccountLevelState(DEFAULT_ACCOUNT_LEVEL);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('user_settings')
      .select('account_level')
      .eq('user_id', user.id)
      .maybeSingle();
    setLoading(false);
    if (error) {
      console.error('Error loading user settings:', error);
      return;
    }
    if (data?.account_level != null) {
      setAccountLevelState(data.account_level);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const setAccountLevel = useCallback(
    async (level: number) => {
      const clamped = Math.max(MIN_ACCOUNT_LEVEL, Math.min(MAX_ACCOUNT_LEVEL, Math.floor(level)));
      setAccountLevelState(clamped);
      if (!user) return { error: new Error('Not signed in') };
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          { user_id: user.id, account_level: clamped },
          { onConflict: 'user_id' }
        );
      if (error) {
        console.error('Error saving account level:', error);
        return { error };
      }
      return { error: null };
    },
    [user]
  );

  return { accountLevel, setAccountLevel, loading, canEdit: !!user };
}
