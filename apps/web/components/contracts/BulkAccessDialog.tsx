'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Users, UserPlus, Shield, Eye, Pencil, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractIds: string[];
  onSuccess?: () => void;
}

interface UserOption {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface GroupOption {
  id: string;
  name: string;
  color: string;
  memberCount: number;
}

const ACCESS_LEVELS = [
  { value: 'view', label: 'View', icon: Eye, description: 'Can view contract and metadata' },
  { value: 'edit', label: 'Edit', icon: Pencil, description: 'Can edit contract and add notes' },
  { value: 'manage', label: 'Manage', icon: Settings, description: 'Can manage access and workflows' },
  { value: 'admin', label: 'Admin', icon: Shield, description: 'Full control including delete' },
];

export function BulkAccessDialog({ open, onOpenChange, contractIds, onSuccess }: BulkAccessDialogProps) {
  const [mode, setMode] = useState<'grant' | 'revoke'>('grant');
  const [accessLevel, setAccessLevel] = useState('view');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!open) {
      setMode('grant');
      setAccessLevel('view');
      setSelectedUserIds([]);
      setSelectedGroupIds([]);
      setSearchQuery('');
      return;
    }

    const fetchData = async () => {
      setIsFetching(true);
      try {
        const [usersRes, groupsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/user-groups'),
        ]);
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users || data.data?.users || []);
        }
        if (groupsRes.ok) {
          const data = await groupsRes.json();
          setGroups(data.groups || data.data?.groups || []);
        }
      } catch {
        toast.error('Failed to load users and groups');
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [open]);

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    g.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (selectedUserIds.length === 0 && selectedGroupIds.length === 0) {
      toast.error('Please select at least one user or group');
      return;
    }
    if (contractIds.length === 0) {
      toast.error('No contracts selected');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/contracts/bulk/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractIds,
          userIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
          groupIds: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
          accessLevel,
          mode,
        }),
      });
      if (!res.ok) throw new Error('Failed to update access');
      const data = await res.json();
      toast.success(data.message || `Updated access for ${contractIds.length} contracts`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update access');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = selectedUserIds.length + selectedGroupIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-500" />
            Manage Access — {contractIds.length} Contract{contractIds.length !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {mode === 'grant'
              ? 'Grant access to selected users or groups for all selected contracts.'
              : 'Revoke access from selected users or groups for all selected contracts.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode + Level */}
          <div className="flex gap-3">
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex-1">
              {(['grant', 'revoke'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize',
                    mode === m
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>

            {mode === 'grant' && (
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value} className="text-xs">
                      <div className="flex items-center gap-2">
                        <level.icon className="h-3.5 w-3.5" />
                        {level.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Search */}
          <Input
            placeholder="Search users or groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />

          {/* Selection summary */}
          {selectedCount > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUserIds.map((id) => {
                const user = users.find((u) => u.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {user?.name || user?.email || id}
                    <button onClick={() => toggleUser(id)} className="rounded-full hover:bg-slate-200 p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
              {selectedGroupIds.map((id) => {
                const group = groups.find((g) => g.id === id);
                return (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1" style={{ backgroundColor: group?.color + '20', color: group?.color }}>
                    {group?.name || id}
                    <button onClick={() => toggleGroup(id)} className="rounded-full hover:bg-slate-200 p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Tabs for Users / Groups */}
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
              <TabsTrigger value="groups" className="text-xs">Groups</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="mt-2">
              <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                {isFetching ? (
                  <div className="p-4 text-center text-sm text-slate-500">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">No users found</div>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                        selectedUserIds.includes(user.id) && 'bg-violet-50 dark:bg-violet-900/20'
                      )}
                    >
                      <div className="w-4 flex justify-center">
                        {selectedUserIds.includes(user.id) && (
                          <div className="w-2 h-2 rounded-full bg-violet-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{user.name || user.email}</div>
                        <div className="text-xs text-slate-500 truncate">{user.email}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="groups" className="mt-2">
              <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                {isFetching ? (
                  <div className="p-4 text-center text-sm text-slate-500">Loading groups...</div>
                ) : filteredGroups.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">No groups found</div>
                ) : (
                  filteredGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={() => toggleGroup(group.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
                        selectedGroupIds.includes(group.id) && 'bg-violet-50 dark:bg-violet-900/20'
                      )}
                    >
                      <div className="w-4 flex justify-center">
                        {selectedGroupIds.includes(group.id) && (
                          <div className="w-2 h-2 rounded-full bg-violet-500" />
                        )}
                      </div>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{group.name}</div>
                        <div className="text-xs text-slate-500">{group.memberCount} members</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || selectedCount === 0} className="gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'grant' ? 'Grant Access' : 'Revoke Access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
