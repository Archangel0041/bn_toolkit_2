import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Upload, Trash2, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/Header';

type AppRole = 'admin' | 'uploader';

interface UserWithRoles {
  id: string;
  roles: AppRole[];
}

export default function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    } else if (!authLoading && !isAdmin) {
      navigate('/');
      toast({
        title: 'Access Denied',
        description: 'You need admin privileges to access this page.',
        variant: 'destructive',
      });
    }
  }, [user, isAdmin, authLoading, navigate, toast]);

  const fetchUsers = async () => {
    setLoading(true);
    
    // Get all roles and group by user
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');
    
    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      toast({
        title: 'Error',
        description: 'Failed to load users.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Group roles by user_id
    const userMap = new Map<string, AppRole[]>();
    (roles || []).forEach(r => {
      const existing = userMap.get(r.user_id) || [];
      existing.push(r.role as AppRole);
      userMap.set(r.user_id, existing);
    });

    const usersWithRoles: UserWithRoles[] = Array.from(userMap.entries()).map(([id, roles]) => ({
      id,
      roles,
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const grantRole = async (userId: string, role: AppRole) => {
    setActionLoading(`${userId}-${role}`);
    
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role,
        granted_by: user?.id,
      });
    
    if (error) {
      if (error.code === '23505') {
        toast({
          title: 'Role exists',
          description: 'User already has this role.',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to grant role.',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Role granted',
        description: `Successfully granted ${role} role.`,
      });
      await fetchUsers();
    }
    
    setActionLoading(null);
  };

  const revokeRole = async (userId: string, role: AppRole) => {
    if (userId === user?.id && role === 'admin') {
      toast({
        title: 'Cannot remove',
        description: 'You cannot remove your own admin role.',
        variant: 'destructive',
      });
      return;
    }
    
    setActionLoading(`${userId}-${role}-revoke`);
    
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke role.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Role revoked',
        description: `Successfully revoked ${role} role.`,
      });
      await fetchUsers();
    }
    
    setActionLoading(null);
  };

  if (authLoading || !isAdmin) {
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

        {/* User Management Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage user roles and permissions. Grant or revoke upload access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No users with roles found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="font-mono text-sm">{u.id.slice(0, 8)}...</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {u.roles.length === 0 ? (
                            <span className="text-muted-foreground text-sm">No roles</span>
                          ) : (
                            u.roles.map(role => (
                              <Badge 
                                key={role} 
                                variant={role === 'admin' ? 'default' : 'secondary'}
                                className="flex items-center gap-1"
                              >
                                {role === 'admin' ? <Shield className="h-3 w-3" /> : <Upload className="h-3 w-3" />}
                                {role}
                                <button
                                  onClick={() => revokeRole(u.id, role)}
                                  disabled={actionLoading === `${u.id}-${role}-revoke`}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {!u.roles.includes('uploader') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => grantRole(u.id, 'uploader')}
                              disabled={actionLoading === `${u.id}-uploader`}
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Grant Uploader
                            </Button>
                          )}
                          {!u.roles.includes('admin') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => grantRole(u.id, 'admin')}
                              disabled={actionLoading === `${u.id}-admin`}
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              Grant Admin
                            </Button>
                          )}
                        </div>
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
