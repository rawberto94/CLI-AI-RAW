"use client";

import { useState, useEffect, useCallback as _useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, 
  Users, 
  Settings as _Settings, 
  Shield as _Shield, 
  Mail, 
  Plus as _Plus, 
  Trash2, 
  UserPlus,
  Crown,
  Edit2,
  Check,
  X,
  Copy,
  AlertCircle,
  RefreshCw,
  FileText,
  Zap,
  BarChart3,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  subscription: {
    plan: string;
    status: string;
  } | null;
  usage: {
    contractsProcessed: number;
    storageUsed: number;
    apiCallsCount: number;
  } | null;
  _count: {
    users: number;
    contracts: number;
  };
}

// ============ AI ACCURACY DASHBOARD ============

interface AccuracyData {
  overview: {
    totalFeedback: number;
    correctExtractions: number;
    corrections: number;
    overallAccuracy: number | null;
  };
  fieldAccuracy: Array<{
    field: string;
    accuracy: number;
    sampleSize: number;
  }>;
  typeAccuracy: Array<{
    contractType: string;
    accuracy: number;
    sampleSize: number;
  }>;
  recommendations: string[];
}

function AIAccuracyDashboard() {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccuracy() {
      try {
        const response = await fetch('/api/extraction/accuracy?view=summary');
        if (response.ok) {
          const result = await response.json();
          setData(result.data);
        }
      } catch {
        // Error handled silently
      } finally {
        setLoading(false);
      }
    }
    fetchAccuracy();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
        <CardContent className="p-12 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No extraction data yet. Accuracy tracking begins when users provide feedback on extracted fields.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-xl">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Overall Accuracy</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.overview.overallAccuracy ?? '--'}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-violet-100 rounded-xl">
                <Check className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Correct Extractions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.overview.correctExtractions}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-xl">
                <Edit2 className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Corrections Made</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.overview.corrections}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-xl">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Feedback</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.overview.totalFeedback}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Field Accuracy Table */}
      <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            Field Accuracy
          </CardTitle>
          <CardDescription>
            Accuracy by extracted field - lowest accuracy fields shown first
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.fieldAccuracy.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Sample Size</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.fieldAccuracy.map((field) => (
                  <TableRow key={field.field}>
                    <TableCell className="font-medium capitalize">
                      {field.field.replace(/([A-Z])/g, ' $1').trim()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              field.accuracy >= 90 ? 'bg-violet-500' :
                              field.accuracy >= 70 ? 'bg-violet-500' :
                              field.accuracy >= 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${field.accuracy}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{field.accuracy}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{field.sampleSize} samples</TableCell>
                    <TableCell>
                      {field.accuracy >= 90 ? (
                        <Badge className="bg-violet-100 text-violet-700">Excellent</Badge>
                      ) : field.accuracy >= 70 ? (
                        <Badge className="bg-violet-100 text-violet-700">Good</Badge>
                      ) : field.accuracy >= 50 ? (
                        <Badge className="bg-amber-100 text-amber-700">Needs Improvement</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700">Poor</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-gray-500 text-center py-8">No field-level data yet</p>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-purple-50 border-indigo-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-purple-600" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-purple-500 mt-1">•</span>
                  <span className="text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function TenantAdminPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("team");
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);

  // Edit member state
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");

  // Organization settings state
  const [orgName, setOrgName] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tenantRes, membersRes, invitationsRes] = await Promise.all([
        fetch("/api/admin/tenant"),
        fetch("/api/admin/team/members"),
        fetch("/api/admin/team/invitations"),
      ]);

      if (tenantRes.ok) {
        const tenantData = await tenantRes.json();
        setTenantInfo(tenantData.tenant);
        setOrgName(tenantData.tenant?.name || "");
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData.members || []);
      }

      if (invitationsRes.ok) {
        const invitationsData = await invitationsRes.json();
        setInvitations(invitationsData.invitations || []);
      }
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await fetch("/api/admin/team/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      setInviteEmail("");
      setInviteRole("member");
      setInviteDialogOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) throw new Error("Failed to update role");
      
      setEditingMember(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    
    try {
      const res = await fetch(`/api/admin/team/members/${memberId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove member");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/admin/team/invitations/${invitationId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to revoke invitation");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveOrganization = async () => {
    if (!orgName.trim()) return;
    setSavingOrg(true);
    try {
      const res = await fetch("/api/admin/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName }),
      });

      if (!res.ok) throw new Error("Failed to update organization");
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingOrg(false);
    }
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/auth/signup?invite=${token}`;
    navigator.clipboard.writeText(link);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner": return "default";
      case "admin": return "secondary";
      default: return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-4">
            <motion.div 
              className="p-4 rounded-2xl bg-gradient-to-br from-purple-600 via-purple-600 to-violet-600 text-white shadow-xl shadow-purple-500/30"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Building2 className="h-8 w-8" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Organization Settings
              </h1>
              <p className="text-slate-500 mt-1">
                Manage your organization, team members, and settings
              </p>
            </div>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button onClick={loadData} variant="outline" size="sm" className="bg-white/80 backdrop-blur-sm shadow-sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive"
            >
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Organization Overview Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Team Members', value: tenantInfo?._count?.users || 0, icon: Users, gradient: 'from-violet-500 to-purple-500' },
            { label: 'Contracts', value: tenantInfo?._count?.contracts || 0, icon: FileText, gradient: 'from-violet-500 to-violet-500' },
            { label: 'Storage Used', value: formatBytes(tenantInfo?.usage?.storageUsed || 0), icon: BarChart3, gradient: 'from-amber-500 to-orange-500' },
            { label: 'Plan', value: tenantInfo?.subscription?.plan?.toLowerCase() || 'Free', icon: Crown, gradient: 'from-purple-500 to-pink-500', capitalize: true },
          ].map((stat, i) => {
            const StatIcon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 * i + 0.2 }}
              >
                <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg hover:shadow-xl transition-all">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">{stat.label}</p>
                        <p className={`text-2xl font-bold text-slate-900 ${stat.capitalize ? 'capitalize' : ''}`}>
                          {stat.value}
                        </p>
                      </div>
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} text-white shadow-lg`}>
                        <StatIcon className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 bg-white/80 backdrop-blur-sm p-1 shadow-sm">
              <TabsTrigger value="team" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">
                <Users className="h-4 w-4" />
                Team
              </TabsTrigger>
              <TabsTrigger value="invitations" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">
                <Mail className="h-4 w-4" />
                Invitations
                {invitations.filter(i => i.status === "PENDING").length > 0 && (
                  <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700">
                    {invitations.filter(i => i.status === "PENDING").length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="organization" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">
                <Building2 className="h-4 w-4" />
                Organization
              </TabsTrigger>
              <TabsTrigger value="ai-accuracy" className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">
                <Zap className="h-4 w-4" />
                AI Accuracy
              </TabsTrigger>
            </TabsList>

        {/* Team Tab */}
            <TabsContent value="team">
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage your team and their permissions</CardDescription>
              </div>
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join your organization
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="inviteEmail">Email Address</Label>
                      <Input
                        id="inviteEmail"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="inviteRole">Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
                      {inviting ? "Sending..." : "Send Invitation"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {member.firstName && member.lastName
                              ? `${member.firstName} ${member.lastName}`
                              : member.email.split("@")[0]}
                          </p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {editingMember === member.id ? (
                          <div className="flex items-center gap-2">
                            <Select value={editRole} onValueChange={setEditRole}>
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">Owner</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleUpdateRole(member.id, editRole)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingMember(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant={getRoleBadgeVariant(member.role)}>
                            {member.role === "owner" && <Crown className="h-3 w-3 mr-1" />}
                            {member.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.status === "ACTIVE" ? "default" : "secondary"}>
                          {member.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.lastLoginAt ? formatDate(member.lastLoginAt) : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.role !== "owner" && member.id !== session?.user?.id && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingMember(member.id);
                                setEditRole(member.role);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invitations Tab */}
            <TabsContent value="invitations">
              <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>Track and manage pending team invitations</CardDescription>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending invitations</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{invitation.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              invitation.status === "PENDING"
                                ? "secondary"
                                : invitation.status === "ACCEPTED"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {invitation.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(invitation.expiresAt)}</TableCell>
                        <TableCell className="text-right">
                          {invitation.status === "PENDING" && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyInviteLink((invitation as any).token)}
                                title="Copy invite link"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => handleRevokeInvitation(invitation.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
            <TabsContent value="organization">
              <div className="grid gap-6">
                <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>Update your organization information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="orgName">Organization Name</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="orgName"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Organization name"
                    />
                    <Button 
                      onClick={handleSaveOrganization} 
                      disabled={savingOrg || orgName === tenantInfo?.name}
                    >
                      {savingOrg ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Organization URL</Label>
                  <div className="flex items-center mt-1 p-2 bg-muted rounded-md">
                    <span className="text-sm text-muted-foreground">
                      {window.location.origin}/{tenantInfo?.slug}
                    </span>
                  </div>
                </div>
                <div>
                  <Label>Created</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tenantInfo?.createdAt ? formatDate(tenantInfo.createdAt) : "-"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/90 backdrop-blur-sm border-white/50 shadow-lg">
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
                <CardDescription>Your current plan and usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-50 rounded-lg border border-indigo-100">
                  <div>
                    <p className="font-medium text-lg capitalize text-indigo-900">
                      {tenantInfo?.subscription?.plan?.toLowerCase() || "Free"} Plan
                    </p>
                    <p className="text-sm text-purple-600">
                      {tenantInfo?.usage?.contractsProcessed || 0} contracts processed
                    </p>
                  </div>
                  <Button className="bg-gradient-to-r from-purple-500 to-purple-500 text-white hover:from-purple-600 hover:to-purple-600">
                    Upgrade Plan
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-destructive/50 bg-white/90 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions - proceed with caution</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" className="shadow-lg shadow-red-500/20">
                  Delete Organization
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Accuracy Tab */}
        <TabsContent value="ai-accuracy">
          <AIAccuracyDashboard />
        </TabsContent>
      </Tabs>
    </motion.div>
    </div>
    </div>
  );
}
