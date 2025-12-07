/**
 * Team Collaboration
 * Team workspace and collaboration features
 */

'use client';

import { memo, useState } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Crown,
  Shield,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Search,
  Filter,
  Check,
  X,
  Loader2,
  Clock,
  Activity,
  FileText,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type UserRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
type UserStatus = 'active' | 'invited' | 'inactive';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: Date;
  lastActive?: Date;
  contractsAccess: number;
  department?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  members: TeamMember[];
  createdAt: Date;
}

const roleConfig: Record<UserRole, { 
  label: string; 
  icon: React.ElementType; 
  color: string; 
  description: string;
}> = {
  owner: { 
    label: 'Owner', 
    icon: Crown, 
    color: 'bg-purple-100 text-purple-700',
    description: 'Full access to all features and settings',
  },
  admin: { 
    label: 'Admin', 
    icon: Shield, 
    color: 'bg-red-100 text-red-700',
    description: 'Manage users, settings, and all contracts',
  },
  manager: { 
    label: 'Manager', 
    icon: Users, 
    color: 'bg-blue-100 text-blue-700',
    description: 'Manage assigned contracts and team workflows',
  },
  member: { 
    label: 'Member', 
    icon: FileText, 
    color: 'bg-green-100 text-green-700',
    description: 'View and edit assigned contracts',
  },
  viewer: { 
    label: 'Viewer', 
    icon: Eye, 
    color: 'bg-slate-100 text-slate-700',
    description: 'Read-only access to assigned contracts',
  },
};

const statusColors: Record<UserStatus, string> = {
  active: 'bg-green-100 text-green-700',
  invited: 'bg-yellow-100 text-yellow-700',
  inactive: 'bg-slate-100 text-slate-500',
};

// Demo data
const demoMembers: TeamMember[] = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john@company.com',
    role: 'owner',
    status: 'active',
    joinedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    lastActive: new Date(Date.now() - 5 * 60 * 1000),
    contractsAccess: 185,
    department: 'Executive',
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah@company.com',
    role: 'admin',
    status: 'active',
    joinedAt: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
    lastActive: new Date(Date.now() - 30 * 60 * 1000),
    contractsAccess: 185,
    department: 'Legal',
  },
  {
    id: '3',
    name: 'Michael Chen',
    email: 'michael@company.com',
    role: 'manager',
    status: 'active',
    joinedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
    lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000),
    contractsAccess: 45,
    department: 'Finance',
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily@company.com',
    role: 'member',
    status: 'active',
    joinedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000),
    contractsAccess: 28,
    department: 'Operations',
  },
  {
    id: '5',
    name: 'Robert Wilson',
    email: 'robert@company.com',
    role: 'viewer',
    status: 'active',
    joinedAt: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
    lastActive: new Date(Date.now() - 48 * 60 * 60 * 1000),
    contractsAccess: 12,
    department: 'Sales',
  },
  {
    id: '6',
    name: 'Lisa Anderson',
    email: 'lisa@company.com',
    role: 'member',
    status: 'invited',
    joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    contractsAccess: 0,
    department: 'Legal',
  },
];

interface TeamCollaborationProps {
  className?: string;
}

export const TeamCollaboration = memo(function TeamCollaboration({
  className,
}: TeamCollaborationProps) {
  const [members, setMembers] = useState<TeamMember[]>(demoMembers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('member');

  const filteredMembers = members.filter(member => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !member.name.toLowerCase().includes(searchLower) &&
        !member.email.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }
    if (roleFilter !== 'all' && member.role !== roleFilter) {
      return false;
    }
    return true;
  });

  const activeCount = members.filter(m => m.status === 'active').length;
  const pendingCount = members.filter(m => m.status === 'invited').length;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error('Email is required');
      return;
    }

    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newMember: TeamMember = {
      id: `m${Date.now()}`,
      name: inviteEmail.split('@')[0] || 'Unknown',
      email: inviteEmail,
      role: inviteRole,
      status: 'invited',
      joinedAt: new Date(),
      contractsAccess: 0,
    };

    setMembers(prev => [...prev, newMember]);
    setShowInviteDialog(false);
    setInviteEmail('');
    setInviteRole('member');
    setIsSubmitting(false);
    toast.success(`Invitation sent to ${inviteEmail}`);
  };

  const updateMemberRole = (memberId: string, newRole: UserRole) => {
    setMembers(prev =>
      prev.map(m =>
        m.id === memberId ? { ...m, role: newRole } : m
      )
    );
    toast.success('Role updated');
  };

  const removeMember = (memberId: string) => {
    setMembers(prev => prev.filter(m => m.id !== memberId));
    toast.success('Member removed');
  };

  const resendInvite = (memberId: string) => {
    toast.success('Invitation resent');
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Team
          </h2>
          <p className="text-slate-600 mt-1">
            Manage team members and collaboration
          </p>
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-slate-500">Active Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-slate-500">Pending Invites</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {members.filter(m => m.lastActive && Date.now() - m.lastActive.getTime() < 60 * 60 * 1000).length}
                </p>
                <p className="text-sm text-slate-500">Online Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={roleFilter}
          onValueChange={(v) => setRoleFilter(v as UserRole | 'all')}
        >
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {Object.entries(roleConfig).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Members List */}
      <div className="space-y-2">
        {filteredMembers.map(member => {
          const roleConf = roleConfig[member.role];
          const RoleIcon = roleConf.icon;
          const isOnline = member.lastActive && Date.now() - member.lastActive.getTime() < 60 * 60 * 1000;

          return (
            <Card key={member.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.avatar} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{member.name}</span>
                      <Badge className={roleConf.color}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {roleConf.label}
                      </Badge>
                      {member.status === 'invited' && (
                        <Badge className={statusColors.invited}>Pending</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{member.email}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                      {member.department && <span>{member.department}</span>}
                      <span>•</span>
                      <span>{member.contractsAccess} contracts</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {member.lastActive 
                          ? formatDistanceToNow(member.lastActive, { addSuffix: true })
                          : 'Never'
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {member.status === 'invited' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendInvite(member.id)}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Resend
                      </Button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedMember(member)}>
                          <Settings className="h-4 w-4 mr-2" />
                          Manage Access
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <span className="text-slate-500 text-xs">Change Role:</span>
                        </DropdownMenuItem>
                        {Object.entries(roleConfig)
                          .filter(([key]) => key !== 'owner' && key !== member.role)
                          .map(([key, { label }]) => (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => updateMemberRole(member.id, key as UserRole)}
                            >
                              {label}
                            </DropdownMenuItem>
                          ))
                        }
                        <DropdownMenuSeparator />
                        {member.role !== 'owner' && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => removeMember(member.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredMembers.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No members found</p>
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig)
                    .filter(([key]) => key !== 'owner')
                    .map(([key, { label, description }]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <p>{label}</p>
                          <p className="text-xs text-slate-500">{description}</p>
                        </div>
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Role Permissions</h4>
              <p className="text-sm text-slate-600">
                {roleConfig[inviteRole].description}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={isSubmitting || !inviteEmail}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Detail Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-lg">
          {selectedMember && (
            <>
              <DialogHeader>
                <DialogTitle>Manage Access</DialogTitle>
                <DialogDescription>
                  Configure permissions for {selectedMember.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {getInitials(selectedMember.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedMember.name}</p>
                    <p className="text-sm text-slate-500">{selectedMember.email}</p>
                  </div>
                </div>

                <div>
                  <Label>Current Role</Label>
                  <Select
                    value={selectedMember.role}
                    onValueChange={(v) => {
                      updateMemberRole(selectedMember.id, v as UserRole);
                      setSelectedMember({ ...selectedMember, role: v as UserRole });
                    }}
                    disabled={selectedMember.role === 'owner'}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleConfig)
                        .filter(([key]) => key !== 'owner')
                        .map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-sm text-blue-700 mb-1">Access Summary</h4>
                  <p className="text-sm text-blue-600">
                    {selectedMember.contractsAccess} contracts accessible
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedMember(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default TeamCollaboration;
