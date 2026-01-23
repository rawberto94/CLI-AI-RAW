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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ExternalLink,
  UserPlus,
  Copy,
  MoreVertical,
  Mail,
  Clock,
  Shield,
  Eye,
  Pencil,
  MessageSquare,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Building,
  User,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format, addDays } from 'date-fns';

interface Collaborator {
  id: string;
  email: string;
  name?: string;
  organization?: string;
  type: 'client' | 'vendor' | 'partner' | 'consultant' | 'auditor';
  status: 'pending' | 'active' | 'expired' | 'revoked';
  permissions: {
    canView: boolean;
    canDownload: boolean;
    canComment: boolean;
  };
  accessToken: string;
  expiresAt: string;
  createdAt: string;
  lastAccessAt?: string;
  contracts: {
    id: string;
    name: string;
  }[];
  invitedBy: {
    name: string;
    email: string;
  };
}

interface Contract {
  id: string;
  name: string;
  type: string;
}

const COLLABORATOR_TYPES = [
  { value: 'client', label: 'Client', icon: Building, description: 'Customer or client contact' },
  { value: 'vendor', label: 'Vendor', icon: User, description: 'Supplier or service provider' },
  { value: 'partner', label: 'Partner', icon: ExternalLink, description: 'Business partner' },
  { value: 'consultant', label: 'Consultant', icon: User, description: 'External consultant' },
  { value: 'auditor', label: 'Auditor', icon: Shield, description: 'External auditor' },
];

const STATUS_CONFIG = {
  pending: { color: 'bg-yellow-500', label: 'Pending', icon: Clock },
  active: { color: 'bg-green-500', label: 'Active', icon: Check },
  expired: { color: 'bg-gray-500', label: 'Expired', icon: AlertTriangle },
  revoked: { color: 'bg-red-500', label: 'Revoked', icon: X },
};

export function ExternalCollaborators() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    organization: '',
    type: 'client' as const,
    contractIds: [] as string[],
    expiresInDays: 30,
    permissions: {
      canView: true,
      canDownload: false,
      canComment: false,
    },
  });
  const [isInviting, setIsInviting] = useState(false);

  const fetchCollaborators = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/collaborators');
      if (response.ok) {
        const data = await response.json();
        setCollaborators(data.collaborators);
      }
    } catch (error) {
      toast.error('Failed to fetch collaborators');
    } finally {
      setLoading(false);
    }
  };

  const fetchContracts = async () => {
    try {
      const response = await fetch('/api/contracts?limit=100');
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts.map((c: any) => ({
          id: c.id,
          name: c.name || c.title || `Contract ${c.id.slice(0, 8)}`,
          type: c.type || 'general',
        })));
      }
    } catch (error) {
      console.error('Failed to fetch contracts');
    }
  };

  useEffect(() => {
    fetchCollaborators();
    fetchContracts();
  }, []);

  const handleInvite = async () => {
    if (!inviteForm.email || inviteForm.contractIds.length === 0) {
      toast.error('Email and at least one contract are required');
      return;
    }

    setIsInviting(true);
    try {
      const response = await fetch('/api/collaborators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...inviteForm,
          expiresAt: addDays(new Date(), inviteForm.expiresInDays).toISOString(),
        }),
      });

      if (!response.ok) throw new Error();
      
      const data = await response.json();
      toast.success('Collaborator invited successfully');
      
      // Copy access link to clipboard
      const accessLink = `${window.location.origin}/collaborate/${data.accessToken}`;
      await navigator.clipboard.writeText(accessLink);
      toast.info('Access link copied to clipboard');

      setShowInviteDialog(false);
      setInviteForm({
        email: '',
        name: '',
        organization: '',
        type: 'client',
        contractIds: [],
        expiresInDays: 30,
        permissions: { canView: true, canDownload: false, canComment: false },
      });
      fetchCollaborators();
    } catch {
      toast.error('Failed to invite collaborator');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this collaborator\'s access?')) return;

    try {
      const response = await fetch('/api/collaborators', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) throw new Error();
      toast.success('Access revoked');
      fetchCollaborators();
    } catch {
      toast.error('Failed to revoke access');
    }
  };

  const handleResend = async (id: string) => {
    try {
      const response = await fetch('/api/collaborators', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'resend' }),
      });

      if (!response.ok) throw new Error();
      toast.success('Invitation resent');
    } catch {
      toast.error('Failed to resend invitation');
    }
  };

  const handleExtend = async (id: string, days: number) => {
    try {
      const response = await fetch('/api/collaborators', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action: 'extend',
          expiresAt: addDays(new Date(), days).toISOString(),
        }),
      });

      if (!response.ok) throw new Error();
      toast.success(`Access extended by ${days} days`);
      fetchCollaborators();
    } catch {
      toast.error('Failed to extend access');
    }
  };

  const copyAccessLink = async (token: string) => {
    const link = `${window.location.origin}/collaborate/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success('Access link copied to clipboard');
  };

  const filteredCollaborators = collaborators.filter(c => {
    const matchesSearch = 
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.organization?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: collaborators.length,
    active: collaborators.filter(c => c.status === 'active').length,
    pending: collaborators.filter(c => c.status === 'pending').length,
    expired: collaborators.filter(c => c.status === 'expired').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ExternalLink className="h-6 w-6" />
            External Collaborators
          </h2>
          <p className="text-muted-foreground">
            Invite external parties to view and interact with contracts
          </p>
        </div>
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Collaborator
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Invite External Collaborator</DialogTitle>
              <DialogDescription>
                Share contract access with external parties
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="partner@company.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="John Smith"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Organization</Label>
                  <Input
                    placeholder="Company Inc."
                    value={inviteForm.organization}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, organization: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={inviteForm.type}
                    onValueChange={(value: any) => setInviteForm(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLLABORATOR_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Contracts to Share *</Label>
                <div className="border rounded-lg max-h-36 overflow-auto p-2">
                  <div className="relative mb-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contracts..."
                      className="pl-8 h-8"
                    />
                  </div>
                  {contracts.map(contract => (
                    <label
                      key={contract.id}
                      className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={inviteForm.contractIds.includes(contract.id)}
                        onCheckedChange={(checked) => {
                          setInviteForm(prev => ({
                            ...prev,
                            contractIds: checked
                              ? [...prev.contractIds, contract.id]
                              : prev.contractIds.filter(id => id !== contract.id),
                          }));
                        }}
                      />
                      <span className="text-sm flex-1 truncate">{contract.name}</span>
                      <Badge variant="outline" className="text-xs">{contract.type}</Badge>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {inviteForm.contractIds.length} contract(s) selected
                </p>
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={inviteForm.permissions.canView}
                      onCheckedChange={(checked) =>
                        setInviteForm(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, canView: !!checked },
                        }))
                      }
                      disabled
                    />
                    <Eye className="h-4 w-4" />
                    <span className="text-sm">View contracts</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={inviteForm.permissions.canDownload}
                      onCheckedChange={(checked) =>
                        setInviteForm(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, canDownload: !!checked },
                        }))
                      }
                    />
                    <Download className="h-4 w-4" />
                    <span className="text-sm">Download contracts</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={inviteForm.permissions.canComment}
                      onCheckedChange={(checked) =>
                        setInviteForm(prev => ({
                          ...prev,
                          permissions: { ...prev.permissions, canComment: !!checked },
                        }))
                      }
                    />
                    <MessageSquare className="h-4 w-4" />
                    <span className="text-sm">Add comments</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Access Duration</Label>
                <Select
                  value={String(inviteForm.expiresInDays)}
                  onValueChange={(value) => setInviteForm(prev => ({ ...prev, expiresInDays: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={isInviting}>
                {isInviting ? 'Inviting...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Collaborators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-500">{stats.expired}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search collaborators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {COLLABORATOR_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Collaborators Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Collaborator</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contracts</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCollaborators.map(collaborator => {
              const status = STATUS_CONFIG[collaborator.status];
              return (
                <TableRow key={collaborator.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{collaborator.name || collaborator.email}</p>
                      {collaborator.name && (
                        <p className="text-sm text-muted-foreground">{collaborator.email}</p>
                      )}
                      {collaborator.organization && (
                        <p className="text-xs text-muted-foreground">{collaborator.organization}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {collaborator.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {collaborator.contracts.slice(0, 2).map(c => (
                        <Badge key={c.id} variant="secondary" className="text-xs">
                          {c.name.length > 20 ? c.name.slice(0, 20) + '...' : c.name}
                        </Badge>
                      ))}
                      {collaborator.contracts.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{collaborator.contracts.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {collaborator.permissions.canView && (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                      {collaborator.permissions.canDownload && (
                        <Download className="h-4 w-4 text-muted-foreground" />
                      )}
                      {collaborator.permissions.canComment && (
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${status.color} text-white`}>
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {formatDistanceToNow(new Date(collaborator.expiresAt), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => copyAccessLink(collaborator.accessToken)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Access Link
                        </DropdownMenuItem>
                        {collaborator.status === 'pending' && (
                          <DropdownMenuItem onClick={() => handleResend(collaborator.id)}>
                            <Mail className="h-4 w-4 mr-2" />
                            Resend Invitation
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleExtend(collaborator.id, 30)}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Extend 30 Days
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRevoke(collaborator.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Revoke Access
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredCollaborators.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No collaborators found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

export default ExternalCollaborators;
