import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Check, X, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';

interface UserAccess {
  id: string;
  user_id: string;
  discord_username: string;
  has_access: boolean;
}

export default function Admin() {
  const { user, hasAccess, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    } else if (!authLoading && !hasAccess) {
      navigate('/');
      toast({
        title: 'Access Denied',
        description: 'You need access privileges to view this page.',
        variant: 'destructive',
      });
    }
  }, [user, hasAccess, authLoading, navigate, toast]);

  const fetchUsers = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('user_roles')
      .select('id, user_id, discord_username, has_access');
    
    if (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (hasAccess) {
      fetchUsers();
    }
  }, [hasAccess]);

  const toggleAccess = async (userId: string, currentAccess: boolean) => {
    setActionLoading(userId);
    
    const { error } = await supabase
      .from('user_roles')
      .update({ has_access: !currentAccess })
      .eq('user_id', userId);
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update access.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Access updated',
        description: `Successfully ${!currentAccess ? 'granted' : 'revoked'} access.`,
      });
      await fetchUsers();
    }
    
    setActionLoading(null);
  };

  if (authLoading || !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage user access permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No users found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Discord Username</TableHead>
                    <TableHead>Access</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="font-medium">{u.discord_username}</p>
                        <p className="text-xs text-muted-foreground font-mono">{u.user_id.slice(0, 8)}...</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.has_access ? 'default' : 'secondary'}>
                          {u.has_access ? (
                            <><Check className="h-3 w-3 mr-1" /> Has Access</>
                          ) : (
                            <><X className="h-3 w-3 mr-1" /> No Access</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={u.has_access ? 'destructive' : 'default'}
                          onClick={() => toggleAccess(u.user_id, u.has_access)}
                          disabled={actionLoading === u.user_id || u.user_id === user?.id}
                        >
                          {u.has_access ? 'Revoke Access' : 'Grant Access'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
