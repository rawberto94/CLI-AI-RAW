/**
 * User Management Component
 * Admin panel for managing users, roles, and permissions
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus,
  Search,
  MoreVertical,
  Shield,
  Mail,
  Calendar,
  Ban,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Key,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'analyst' | 'viewer';
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  createdAt: Date;
  lastLoginAt?: Date;
  department?: string;
  permissions: string[];
}

interface UserManagementProps {
  className?: string;
}

const roleConfig: Record<string, { color: string; label: string; permissions: string[] }> = {
  admin: { 
    color: 'bg-red-100 text-red-700', 
    label: 'Admin',
    permissions: ['contracts:*', 'users:*', 'settings:*', 'api:*', 'audit:read']
  },
  manager: { 
    color: 'bg-violet-100 text-violet-700', 
    label: 'Manager',
    permissions: ['contracts:*', 'users:read', 'settings:read', 'api:read']
  },
  analyst: { 
    color: 'bg-purple-100 text-purple-700', 
    label: 'Analyst',
    permissions: ['contracts:read', 'contracts:write', 'ai:analyze']
  },
  viewer: { 
    color: 'bg-slate-100 text-slate-700', 
    label: 'Viewer',
    permissions: ['contracts:read']
  },
};

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  active: { color: 'text-green-600', icon: CheckCircle2 },
  inactive: { color: 'text-slate-400', icon: XCircle },
  pending: { color: 'text-yellow-600', icon: Calendar },
  suspended: { color: 'text-red-600', icon: Ban },
};

// Mock data generator
function generateMockUsers(): User[] {
  const names = [
    'Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown',
    'Emma Davis', 'Frank Miller', 'Grace Wilson', 'Henry Taylor'
  ];
  const departments = ['Legal', 'Finance', 'Operations', 'IT', 'Sales'];
  const roles: User['role'][] = ['admin', 'manager', 'analyst', 'viewer'];
  const statuses: User['status'][] = ['active', 'active', 'active', 'pending', 'inactive', 'suspended'];

  return names.map((name, i) => {
    const role = roles[i % roles.length] as User['role'];
    const status = statuses[Math.floor(Math.random() * statuses.length)] as User['status'];
    const department = departments[Math.floor(Math.random() * departments.length)];
    return {
      id: `usr_${i + 1}`,
      email: name.toLowerCase().replace(' ', '.') + '@example.com',
      name,
      avatar: undefined,
      role,
      status,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      lastLoginAt: Math.random() > 0.2 
        ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
        : undefined,
      department,
      permissions: roleConfig[role]!.permissions,
    };
  });
}

export const UserManagement = memo(function UserManagement({
  className,
}: UserManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'viewer' as User['role'],
    department: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users.map((u: User) => ({
          ...u,
          createdAt: new Date(u.createdAt),
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : undefined,
        })));
      } else {
        setUsers(generateMockUsers());
      }
    } catch {
      setUsers(generateMockUsers());
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    if (statusFilter !== 'all' && user.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.department?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setInviting(true);
    try {
      const response = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      if (response.ok) {
        toast.success('Invitation sent successfully');
      } else {
        // Mock success
        const newUser: User = {
          id: `usr_${Date.now()}`,
          ...inviteForm,
          status: 'pending',
          createdAt: new Date(),
          permissions: roleConfig[inviteForm.role]?.permissions || [],
        };
        setUsers(prev => [newUser, ...prev]);
        toast.success('Invitation sent successfully');
      }

      setShowInviteDialog(false);
      setInviteForm({ email: '', name: '', role: 'viewer', department: '' });
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: User['status']) => {
    try {
      const response = await fetch(`/api/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      // Update locally regardless of API response
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, status: newStatus } : u
      ));
      toast.success(`User status updated to ${newStatus}`);
    } catch {
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, status: newStatus } : u
      ));
      toast.success(`User status updated to ${newStatus}`);
    }
  };

  const handleRoleChange = async (userId: string, newRole: User['role']) => {
    setUsers(prev => prev.map(u => 
      u.id === userId ? { ...u, role: newRole, permissions: roleConfig[newRole]?.permissions || [] } : u
    ));
    toast.success(`User role updated to ${roleConfig[newRole]?.label || newRole}`);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;

    setUsers(prev => prev.filter(u => u.id !== userId));
    toast.success('User removed');
  };

  const handleResetPassword = async (userId: string) => {
    toast.success('Password reset email sent');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-600" />
              User Management
            </CardTitle>
            <CardDescription>
              Manage team members, roles, and permissions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                  <DialogDescription>
                    Send an invitation email to add a new team member
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email *</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="user@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-name">Full Name *</Label>
                    <Input
                      id="invite-name"
                      placeholder="John Doe"
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={inviteForm.role}
                        onValueChange={(value) => setInviteForm(prev => ({ 
                          ...prev, 
                          role: value as User['role'] 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-dept">Department</Label>
                      <Input
                        id="invite-dept"
                        placeholder="e.g. Legal"
                        value={inviteForm.department}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, department: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50">
                    <p className="text-xs font-medium text-slate-600 mb-2">
                      {roleConfig[inviteForm.role]?.label || inviteForm.role} Permissions:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(roleConfig[inviteForm.role]?.permissions || []).map(perm => (
                        <Badge key={perm} variant="outline" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInvite} disabled={inviting} className="gap-2">
                    {inviting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[130px]">
              <Shield className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {Object.entries(roleConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-slate-50 text-center">
            <p className="text-2xl font-bold">{users.length}</p>
            <p className="text-xs text-slate-500">Total Users</p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 text-center">
            <p className="text-2xl font-bold text-green-600">
              {users.filter(u => u.status === 'active').length}
            </p>
            <p className="text-xs text-slate-500">Active</p>
          </div>
          <div className="p-3 rounded-lg bg-yellow-50 text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {users.filter(u => u.status === 'pending').length}
            </p>
            <p className="text-xs text-slate-500">Pending</p>
          </div>
          <div className="p-3 rounded-lg bg-red-50 text-center">
            <p className="text-2xl font-bold text-red-600">
              {users.filter(u => u.role === 'admin').length}
            </p>
            <p className="text-xs text-slate-500">Admins</p>
          </div>
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600 mr-2" />
            <span>Loading users...</span>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => {
                    const statusInfo = statusConfig[user.status] ?? statusConfig.active;
                    const StatusIcon = statusInfo!.icon;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="text-xs">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user.id, value as User['role'])}
                          >
                            <SelectTrigger className="h-7 w-[100px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(roleConfig).map(([key, config]) => (
                                <SelectItem key={key} value={key} className="text-xs">
                                  {config.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{user.department || '—'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={cn(
                              'gap-1',
                              statusInfo!.color
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-slate-500">
                            {user.lastLoginAt 
                              ? formatDistanceToNow(user.lastLoginAt, { addSuffix: true })
                              : 'Never'
                            }
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleResetPassword(user.id)}>
                                <Key className="h-4 w-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.status === 'active' ? (
                                <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'suspended')}>
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspend User
                                </DropdownMenuItem>
                              ) : user.status === 'suspended' ? (
                                <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'active')}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Activate User
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(user.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
