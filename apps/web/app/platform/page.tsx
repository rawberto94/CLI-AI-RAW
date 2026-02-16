"use client";

/**
 * Platform Admin - Multi-Tenant Management
 * 
 * Allows platform owners to:
 * - View all client tenants
 * - Create new tenants
 * - Access tenant context (view as client)
 * - Manage tenant settings
 */

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  ExternalLink,
  Settings,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Ban,
  TrendingUp,
  HardDrive,
  Crown,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  usersCount: number;
  contractsCount: number;
  plan: string;
  planStatus: string;
  contractsProcessed: number;
  storageUsed: number;
}

const statusConfig = {
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-800", icon: CheckCircle },
  SUSPENDED: { label: "Suspended", color: "bg-red-100 text-red-800", icon: Ban },
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-800", icon: Clock },
};

const planConfig = {
  free: { label: "Free", color: "bg-slate-100 text-slate-800" },
  starter: { label: "Starter", color: "bg-violet-100 text-violet-800" },
  professional: { label: "Professional", color: "bg-violet-100 text-violet-800" },
  enterprise: { label: "Enterprise", color: "bg-amber-100 text-amber-800" },
};

export default function PlatformAdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Create tenant dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({
    name: "",
    slug: "",
    adminEmail: "",
    adminFirstName: "",
    adminLastName: "",
  });
  const [creating, setCreating] = useState(false);

  // Selected tenant for context switching
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/tenants");
      if (!res.ok) {
        throw new Error("Failed to load tenants");
      }
      const data = await res.json();
      setTenants(data.tenants || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug || !newTenant.adminEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTenant),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create tenant");
      }

      toast.success("Client organization created successfully");
      setCreateDialogOpen(false);
      setNewTenant({ name: "", slug: "", adminEmail: "", adminFirstName: "", adminLastName: "" });
      loadTenants();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleAccessTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setAccessDialogOpen(true);
  };

  const confirmAccessTenant = () => {
    if (!selectedTenant) return;
    
    // Store the tenant context in sessionStorage
    sessionStorage.setItem("viewAsTenantId", selectedTenant.id);
    sessionStorage.setItem("viewAsTenantName", selectedTenant.name);
    
    // Redirect to dashboard with tenant context
    toast.success(`Now viewing as ${selectedTenant.name}`);
    router.push(`/?tenantId=${selectedTenant.id}`);
    setAccessDialogOpen(false);
  };

  const handleSuspendTenant = async (tenant: Tenant) => {
    if (!confirm(`Are you sure you want to suspend ${tenant.name}? Their users will not be able to access the platform.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/platform/tenants/${tenant.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to suspend tenant");
      }

      toast.success("Tenant suspended");
      loadTenants();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: tenants.length,
    active: tenants.filter((t) => t.status === "ACTIVE").length,
    totalUsers: tenants.reduce((sum, t) => sum + t.usersCount, 0),
    totalContracts: tenants.reduce((sum, t) => sum + t.contractsCount, 0),
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-violet-600" />
          <p className="text-slate-600">Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Crown className="h-7 w-7 text-amber-500" />
            Platform Administration
          </h1>
          <p className="text-slate-600 mt-1">
            Manage all client organizations and their access
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-100 rounded-lg">
                <Building2 className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-slate-600">Total Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-sm text-slate-600">Active Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-100 rounded-lg">
                <Users className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-sm text-slate-600">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 rounded-lg">
                <FileText className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalContracts}</p>
                <p className="text-sm text-slate-600">Total Contracts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Client Organizations</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="icon" onClick={loadTenants} aria-label="Refresh client list">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Contracts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    {searchQuery ? "No clients match your search" : "No clients yet. Create your first client above."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => {
                  const status = statusConfig[tenant.status as keyof typeof statusConfig] || statusConfig.PENDING;
                  const plan = planConfig[tenant.plan as keyof typeof planConfig] || planConfig.free;
                  const StatusIcon = status.icon;

                  return (
                    <TableRow key={tenant.id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                            {tenant.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{tenant.name}</p>
                            <p className="text-sm text-slate-500">{tenant.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("gap-1", status.color)}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={plan.color}>{plan.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{tenant.usersCount}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{tenant.contractsCount}</span>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {formatDate(tenant.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Tenant actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleAccessTenant(tenant)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View as Client
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/platform/tenants/${tenant.id}`)}>
                              <Settings className="h-4 w-4 mr-2" />
                              Manage
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleSuspendTenant(tenant)}
                              className="text-red-600"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Suspend
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
        </CardContent>
      </Card>

      {/* Create Tenant Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>
              Set up a new client organization. They will receive an invitation to complete setup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name *</Label>
              <Input
                id="name"
                placeholder="Acme Corporation"
                value={newTenant.name}
                onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug *</Label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm">app.pactum.ai/</span>
                <Input
                  id="slug"
                  placeholder="acme"
                  value={newTenant.slug}
                  onChange={(e) =>
                    setNewTenant({
                      ...newTenant,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    })
                  }
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin Email *</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@acme.com"
                value={newTenant.adminEmail}
                onChange={(e) => setNewTenant({ ...newTenant, adminEmail: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminFirstName">Admin First Name</Label>
                <Input
                  id="adminFirstName"
                  placeholder="John"
                  value={newTenant.adminFirstName}
                  onChange={(e) => setNewTenant({ ...newTenant, adminFirstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminLastName">Admin Last Name</Label>
                <Input
                  id="adminLastName"
                  placeholder="Doe"
                  value={newTenant.adminLastName}
                  onChange={(e) => setNewTenant({ ...newTenant, adminLastName: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTenant} disabled={creating}>
              {creating ? "Creating..." : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access Tenant Confirmation Dialog */}
      <Dialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>View as {selectedTenant?.name}</DialogTitle>
            <DialogDescription>
              You are about to access this client&apos;s view. You will see their dashboard, contracts, and data as if you were logged in as them.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Admin Mode Active</p>
                <p>Your actions will be logged. A banner will indicate you&apos;re viewing as this client.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAccessTenant}>
              <Eye className="h-4 w-4 mr-2" />
              View as Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
