'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Eye,
  Pencil,
  Settings,
  Trash2,
  Clock,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface UserAccess {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  accessLevel: string;
  grantedAt: string;
  expiresAt?: string;
}

interface GroupAccess {
  id: string;
  name: string;
  color: string;
  memberCount: number;
  accessLevel: string;
  grantedAt: string;
  expiresAt?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface Group {
  id: string;
  name: string;
  color: string;
  memberCount: number;
}

interface ContractAccessControlProps {
  contractId: string;
  contractName: string;
}

const ACCESS_LEVELS = [
  { value: 'view', label: 'View', icon: Eye, description: 'Can view contract and metadata' },
  { value: 'edit', label: 'Edit', icon: Pencil, description: 'Can edit contract and add notes' },
  { value: 'manage', label: 'Manage', icon: Settings, description: 'Can manage access and workflows' },
  { value: 'admin', label: 'Admin', icon: Shield, description: 'Full control including delete' },
];

export function ContractAccessControl({ contractId, contractName }: ContractAccessControlProps) {
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [groups, setGroups] = useState<GroupAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [accessLevel, setAccessLevel] = useState('view');
  const [expiresAt, setExpiresAt] = useState('');
  const [isGranting, setIsGranting] = useState(false);

  const fetchAccess = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/contracts/${contractId}/access`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setGroups(data.groups);
      }
    } catch (error) {
      toast.error('Failed to fetch access list');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailable = async () => {
    try {
      const [usersRes, groupsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/admin/groups'),
      ]);
      
      if (usersRes.ok) {
        const data = await usersRes.json();
        setAvailableUsers(data.users.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          avatar: u.avatar,
        })));
      }
      
      if (groupsRes.ok) {
        const data = await groupsRes.json();
        setAvailableGroups(data.groups.map((g: any) => ({
          id: g.id,
          name: g.name,
          color: g.color,
          memberCount: g.memberCount,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch available users/groups');
    }
  };

  useEffect(() => {
    fetchAccess();
    fetchAvailable();
  }, [contractId]);

  const handleGrantAccess = async () => {
    if (selectedUserIds.length === 0 && selectedGroupIds.length === 0) {
      toast.error('Select at least one user or group');
      return;
    }

    setIsGranting(true);
    try {
      const response = await fetch(`/api/contracts/${contractId}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUserIds,
          groupIds: selectedGroupIds,
          accessLevel,
          expiresAt: expiresAt || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to grant access');
      }

      toast.success('Access granted successfully');
      setShowGrantDialog(false);
      setSelectedUserIds([]);
      setSelectedGroupIds([]);
      setAccessLevel('view');
      setExpiresAt('');
      fetchAccess();
    } catch (error) {
      toast.error('Failed to grant access');
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevokeUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/access`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [userId] }),
      });

      if (!response.ok) throw new Error();
      toast.success('Access revoked');
      fetchAccess();
    } catch {
      toast.error('Failed to revoke access');
    }
  };

  const handleRevokeGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/contracts/${contractId}/access`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: [groupId] }),
      });

      if (!response.ok) throw new Error();
      toast.success('Group access revoked');
      fetchAccess();
    } catch {
      toast.error('Failed to revoke access');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAccessIcon = (level: string) => {
    const config = ACCESS_LEVELS.find(l => l.value === level);
    const Icon = config?.icon || Eye;
    return <Icon className="h-4 w-4" />;
  };

  const filteredUsers = availableUsers.filter(u =>
    !users.some(eu => eu.id === u.id) &&
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredGroups = availableGroups.filter(g =>
    !groups.some(eg => eg.id === g.id) &&
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Access Control
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage who can view and edit this contract
          </p>
        </div>
        <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Grant Access
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Grant Access to Contract</DialogTitle>
              <DialogDescription>
                Share &quot;{contractName}&quot; with users or groups
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="users" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="groups">Groups</TabsTrigger>
              </TabsList>

              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <TabsContent value="users" className="mt-4">
                <div className="max-h-48 overflow-auto space-y-2">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No users available</p>
                  ) : (
                    filteredUsers.map(user => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds(prev => [...prev, user.id]);
                            } else {
                              setSelectedUserIds(prev => prev.filter(id => id !== user.id));
                            }
                          }}
                          className="rounded"
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="groups" className="mt-4">
                <div className="max-h-48 overflow-auto space-y-2">
                  {filteredGroups.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No groups available</p>
                  ) : (
                    filteredGroups.map(group => (
                      <label
                        key={group.id}
                        className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.includes(group.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGroupIds(prev => [...prev, group.id]);
                            } else {
                              setSelectedGroupIds(prev => prev.filter(id => id !== group.id));
                            }
                          }}
                          className="rounded"
                        />
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                          style={{ backgroundColor: group.color }}
                        >
                          {group.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{group.name}</p>
                          <p className="text-xs text-muted-foreground">{group.memberCount} members</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <Label>Access Level</Label>
                <Select value={accessLevel} onValueChange={setAccessLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center gap-2">
                          <level.icon className="h-4 w-4" />
                          {level.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Expires (optional)</Label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {(selectedUserIds.length > 0 || selectedGroupIds.length > 0) && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  Granting <strong>{accessLevel}</strong> access to{' '}
                  {selectedUserIds.length > 0 && `${selectedUserIds.length} user(s)`}
                  {selectedUserIds.length > 0 && selectedGroupIds.length > 0 && ' and '}
                  {selectedGroupIds.length > 0 && `${selectedGroupIds.length} group(s)`}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGrantDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGrantAccess}
                disabled={isGranting || (selectedUserIds.length === 0 && selectedGroupIds.length === 0)}
              >
                {isGranting ? 'Granting...' : 'Grant Access'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Access List */}
      <div className="space-y-3">
        {/* Users */}
        {users.map(user => (
          <div key={user.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar} />
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{user.name}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                {getAccessIcon(user.accessLevel)}
                {user.accessLevel}
              </Badge>
              {user.expiresAt && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(user.expiresAt), { addSuffix: true })}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRevokeUser(user.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {/* Groups */}
        {groups.map(group => (
          <div key={group.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ backgroundColor: group.color }}
            >
              {group.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{group.name}</p>
                <Badge variant="secondary">{group.memberCount} members</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Group</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                {getAccessIcon(group.accessLevel)}
                {group.accessLevel}
              </Badge>
              {group.expiresAt && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(group.expiresAt), { addSuffix: true })}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRevokeGroup(group.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {users.length === 0 && groups.length === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No specific access granted</p>
            <p className="text-sm">Contract follows default tenant permissions</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContractAccessControl;
