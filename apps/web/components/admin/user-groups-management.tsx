'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  Settings as _Settings,
  Shield as _Shield,
  FileText as _FileText,
  RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';

interface GroupMember {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  joinedAt: string;
}

interface UserGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  permissions: string[];
  departmentAccess: string[];
  contractAccessLevel: string;
  memberCount: number;
  contractCount: number;
  members: GroupMember[];
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

const PERMISSION_OPTIONS = [
  { value: 'contracts:view', label: 'View Contracts' },
  { value: 'contracts:create', label: 'Create Contracts' },
  { value: 'contracts:edit', label: 'Edit Contracts' },
  { value: 'contracts:delete', label: 'Delete Contracts' },
  { value: 'contracts:analyze', label: 'Run AI Analysis' },
  { value: 'reports:view', label: 'View Reports' },
  { value: 'reports:export', label: 'Export Reports' },
  { value: 'workflows:manage', label: 'Manage Workflows' },
];

const ACCESS_LEVELS = [
  { value: 'all', label: 'All Contracts', description: 'Access to all tenant contracts' },
  { value: 'assigned', label: 'Assigned Only', description: 'Only contracts explicitly assigned' },
  { value: 'department', label: 'Department', description: 'Contracts in same department' },
  { value: 'none', label: 'None', description: 'No contract access' },
];

export function UserGroupsManagement() {
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    permissions: [] as string[],
    departmentAccess: [] as string[],
    contractAccess: 'assigned',
  });

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/groups');
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups);
      }
    } catch (_error) {
      toast.error('Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setAvailableUsers(data.users.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
          avatar: u.avatar,
        })));
      }
    } catch (_error) {
      console.warn('Failed to fetch users');
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchAvailableUsers();
  }, []);

  const handleCreateGroup = async () => {
    if (!formData.name) {
      toast.error('Group name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create group');
      }

      toast.success('Group created successfully');
      setShowCreateDialog(false);
      resetForm();
      fetchGroups();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!selectedGroup) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroup.id, ...formData }),
      });

      if (!response.ok) {
        throw new Error('Failed to update group');
      }

      toast.success('Group updated successfully');
      setShowEditDialog(false);
      resetForm();
      fetchGroups();
    } catch (_error) {
      toast.error('Failed to update group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      const response = await fetch('/api/admin/groups', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete group');
      }

      toast.success('Group deleted');
      fetchGroups();
    } catch (_error) {
      toast.error('Failed to delete group');
    }
  };

  const handleAddMembers = async () => {
    if (!selectedGroup || selectedUserIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/groups/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          userIds: selectedUserIds,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add members');
      }

      toast.success('Members added successfully');
      setShowMembersDialog(false);
      setSelectedUserIds([]);
      fetchGroups();
    } catch (_error) {
      toast.error('Failed to add members');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (groupId: string, userId: string) => {
    try {
      const response = await fetch('/api/admin/groups/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, userIds: [userId] }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      toast.success('Member removed');
      fetchGroups();
    } catch (_error) {
      toast.error('Failed to remove member');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      permissions: [],
      departmentAccess: [],
      contractAccess: 'assigned',
    });
    setSelectedGroup(null);
  };

  const openEditDialog = (group: UserGroup) => {
    setSelectedGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      color: group.color,
      permissions: group.permissions,
      departmentAccess: group.departmentAccess,
      contractAccess: group.contractAccessLevel,
    });
    setShowEditDialog(true);
  };

  const openMembersDialog = (group: UserGroup) => {
    setSelectedGroup(group);
    setSelectedUserIds([]);
    setShowMembersDialog(true);
  };

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-4 border rounded-lg">
                <div className="w-10 h-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Groups
            </CardTitle>
            <CardDescription>
              Organize users into teams with shared permissions
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchGroups}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create User Group</DialogTitle>
                  <DialogDescription>
                    Create a new group to organize users with shared permissions
                  </DialogDescription>
                </DialogHeader>
                <GroupForm
                  formData={formData}
                  setFormData={setFormData}
                  togglePermission={togglePermission}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateGroup} disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Group'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No groups created yet</p>
              <p className="text-sm">Create a group to organize your team</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map(group => (
                <div
                  key={group.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: group.color }}
                  >
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{group.name}</span>
                      <Badge variant="secondary">{group.memberCount} members</Badge>
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {group.description}
                      </p>
                    )}
                    <div className="flex gap-1 mt-1">
                      {group.permissions.slice(0, 3).map(p => (
                        <Badge key={p} variant="outline" className="text-xs">
                          {p.split(':')[1]}
                        </Badge>
                      ))}
                      {group.permissions.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{group.permissions.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Members Avatars */}
                  <div className="flex -space-x-2">
                    {group.members.slice(0, 4).map(member => (
                      <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {group.memberCount > 4 && (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                        +{group.memberCount - 4}
                      </div>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openMembersDialog(group)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Manage Members
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(group)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Group
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteGroup(group.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Group Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>
              Update group settings and permissions
            </DialogDescription>
          </DialogHeader>
          <GroupForm
            formData={formData}
            setFormData={setFormData}
            togglePermission={togglePermission}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateGroup} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Members - {selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              Add or remove users from this group
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current Members */}
            {selectedGroup && selectedGroup.members.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Current Members</Label>
                <div className="mt-2 space-y-2 max-h-48 overflow-auto">
                  {selectedGroup.members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(selectedGroup.id, member.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Members */}
            <div>
              <Label className="text-sm font-medium">Add Members</Label>
              <div className="mt-2 space-y-2 max-h-48 overflow-auto border rounded p-2">
                {availableUsers
                  .filter(u => !selectedGroup?.members.some(m => m.id === u.id))
                  .map(user => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
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
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </label>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMembersDialog(false)}>
              Close
            </Button>
            {selectedUserIds.length > 0 && (
              <Button onClick={handleAddMembers} disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : `Add ${selectedUserIds.length} Member(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Group Form Component
function GroupForm({
  formData,
  setFormData,
  togglePermission,
}: {
  formData: any;
  setFormData: (fn: any) => void;
  togglePermission: (p: string) => void;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Group Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Legal Team"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev: any) => ({ ...prev, description: e.target.value }))}
          placeholder="What does this group do?"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="color">Color</Label>
        <div className="flex gap-2">
          {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(color => (
            <button
              key={color}
              type="button"
              className={`w-8 h-8 rounded-full border-2 ${formData.color === color ? 'border-foreground' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
              onClick={() => setFormData((prev: any) => ({ ...prev, color }))}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Contract Access Level</Label>
        <Select
          value={formData.contractAccess}
          onValueChange={(value) => setFormData((prev: any) => ({ ...prev, contractAccess: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCESS_LEVELS.map(level => (
              <SelectItem key={level.value} value={level.value}>
                <div>
                  <div className="font-medium">{level.label}</div>
                  <div className="text-xs text-muted-foreground">{level.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Permissions</Label>
        <div className="grid grid-cols-2 gap-2">
          {PERMISSION_OPTIONS.map(perm => (
            <label
              key={perm.value}
              className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted"
            >
              <input
                type="checkbox"
                checked={formData.permissions.includes(perm.value)}
                onChange={() => togglePermission(perm.value)}
                className="rounded"
              />
              <span className="text-sm">{perm.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default UserGroupsManagement;
