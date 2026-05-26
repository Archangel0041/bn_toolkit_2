import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAccountLevel,
  MIN_ACCOUNT_LEVEL,
  MAX_ACCOUNT_LEVEL,
} from '@/hooks/useAccountLevel';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';
import { Seo } from '@/components/Seo';

export default function Settings() {
  const { user, loading: authLoading } = useAuth();
  const { accountLevel, setAccountLevel, loading } = useAccountLevel();
  const [value, setValue] = useState<string>(String(accountLevel));
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setValue(String(accountLevel));
  }, [accountLevel]);

  if (!authLoading && !user) {
    return <Navigate to="/" replace />;
  }

  const handleSave = async () => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < MIN_ACCOUNT_LEVEL || num > MAX_ACCOUNT_LEVEL) {
      toast({
        title: 'Invalid level',
        description: `Account level must be between ${MIN_ACCOUNT_LEVEL} and ${MAX_ACCOUNT_LEVEL}.`,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    const { error } = await setAccountLevel(num);
    setSaving(false);
    if (error) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Settings saved' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Account Level</CardTitle>
            <CardDescription>
              Used to determine the default level range for boss strike enemies and
              other level-scaled content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-level">Level ({MIN_ACCOUNT_LEVEL}–{MAX_ACCOUNT_LEVEL})</Label>
              <Input
                id="account-level"
                type="number"
                min={MIN_ACCOUNT_LEVEL}
                max={MAX_ACCOUNT_LEVEL}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={loading || saving}
              />
            </div>
            <Button onClick={handleSave} disabled={loading || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
