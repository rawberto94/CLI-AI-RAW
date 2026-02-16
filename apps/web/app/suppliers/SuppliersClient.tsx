'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Building2, Plus, Search, RefreshCw, Star, Shield, AlertTriangle,
  TrendingUp, Mail, Phone, Globe, MapPin, FileText, MoreVertical,
  Edit, Eye, Trash2, CheckCircle2, XCircle, BarChart3, Users,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VendorProfile {
  id: string;
  vendorName: string;
  vendorId: string;
  riskScore: number;
  riskLevel: string;
  complianceStatus: string;
  lastAssessment: string;
  contractCount: number;
  totalValue: number;
  category: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  address?: string;
  notes?: string;
}

interface VendorMetrics {
  totalVendors: number;
  highRisk: number;
  compliant: number;
  pendingReview: number;
}

const RISK_COLORS: Record<string, { text: string; bg: string }> = {
  low: { text: 'text-green-700', bg: 'bg-green-100' },
  medium: { text: 'text-amber-700', bg: 'bg-amber-100' },
  high: { text: 'text-red-700', bg: 'bg-red-100' },
  critical: { text: 'text-red-800', bg: 'bg-red-200' },
};

export default function SuppliersClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorProfile | null>(null);
  const [formData, setFormData] = useState({ vendorName: '', category: '', contactEmail: '', contactPhone: '', website: '', address: '', notes: '' });
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['vendor-risk'],
    queryFn: async () => {
      const res = await fetch('/api/vendor-risk');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return json.data as { profiles: VendorProfile[]; metrics: VendorMetrics };
    },
    staleTime: 2 * 60 * 1000,
  });

  const profiles = data?.profiles || [];
  const metrics = data?.metrics || { totalVendors: 0, highRisk: 0, compliant: 0, pendingReview: 0 };

  const filteredProfiles = profiles.filter(p => {
    if (riskFilter !== 'all' && p.riskLevel !== riskFilter) return false;
    if (searchTerm && !p.vendorName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleCreate = () => {
    toast.success('Vendor profile created', { description: formData.vendorName });
    setShowCreateDialog(false);
    setFormData({ vendorName: '', category: '', contactEmail: '', contactPhone: '', website: '', address: '', notes: '' });
    refetch();
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Vendor Management" description="Manage supplier profiles and risk">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Vendor Management"
      description="View and manage supplier profiles, risk assessments, and contracts"
      actions={
        <div className="flex gap-2">
          <Link href="/analytics/suppliers">
            <Button size="sm" variant="outline"><BarChart3 className="h-4 w-4 mr-2" /> Analytics</Button>
          </Link>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Vendor
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Vendors', value: metrics.totalVendors, icon: Building2, color: 'text-violet-600', bg: 'bg-violet-100' },
            { label: 'High Risk', value: metrics.highRisk, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
            { label: 'Compliant', value: metrics.compliant, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'Pending Review', value: metrics.pendingReview, icon: Shield, color: 'text-amber-600', bg: 'bg-amber-100' },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{kpi.label}</p>
                      <p className={cn('text-2xl font-bold', kpi.color)}>{kpi.value}</p>
                    </div>
                    <div className={cn('p-3 rounded-full', kpi.bg)}>
                      <kpi.icon className={cn('h-5 w-5', kpi.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Vendor List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Vendors ({filteredProfiles.length})</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
                  <Input placeholder="Search vendors..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-8 w-48 text-xs" />
                </div>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Risk" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risks</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => refetch()} className="h-8">
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredProfiles.length === 0 ? (
              <div className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  {profiles.length === 0 ? 'No vendors yet — add your first vendor' : 'No vendors match the current filters'}
                </p>
                {profiles.length === 0 && (
                  <Button size="sm" className="mt-3" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Vendor
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProfiles.map(vendor => {
                  const riskColors = RISK_COLORS[vendor.riskLevel] || RISK_COLORS.medium;
                  return (
                    <div key={vendor.id} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedVendor(vendor)}>
                      <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5 text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{vendor.vendorName}</span>
                          <Badge variant="outline" className="text-[10px]">{vendor.category || 'General'}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {vendor.contractCount} contracts · ${(vendor.totalValue / 1000).toFixed(0)}k total value
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Risk Score</p>
                          <div className="flex items-center gap-1.5">
                            <Progress value={vendor.riskScore} className="w-16 h-1.5" />
                            <span className={cn('text-xs font-medium', riskColors.text)}>{vendor.riskScore}</span>
                          </div>
                        </div>
                        <Badge className={cn('text-[10px] capitalize', riskColors.bg, riskColors.text, 'border-0')}>{vendor.riskLevel}</Badge>
                        <Badge variant={vendor.complianceStatus === 'compliant' ? 'outline' : 'destructive'} className="text-[10px] capitalize">
                          {vendor.complianceStatus}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Vendor Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vendor Name *</Label>
              <Input value={formData.vendorName} onChange={e => setFormData(f => ({ ...f, vendorName: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={v => setFormData(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                    <SelectItem value="staffing">Staffing</SelectItem>
                    <SelectItem value="facilities">Facilities</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input type="email" value={formData.contactEmail} onChange={e => setFormData(f => ({ ...f, contactEmail: e.target.value }))} placeholder="contact@vendor.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input value={formData.contactPhone} onChange={e => setFormData(f => ({ ...f, contactPhone: e.target.value }))} placeholder="+1 555-1234" />
              </div>
              <div>
                <Label>Website</Label>
                <Input value={formData.website} onChange={e => setFormData(f => ({ ...f, website: e.target.value }))} placeholder="https://vendor.com" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!formData.vendorName}>Create Vendor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vendor Detail Dialog */}
      <Dialog open={!!selectedVendor} onOpenChange={() => setSelectedVendor(null)}>
        <DialogContent className="max-w-lg">
          {selectedVendor && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-violet-600" />
                  {selectedVendor.vendorName}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Risk Score</p>
                    <p className={cn('text-xl font-bold', RISK_COLORS[selectedVendor.riskLevel]?.text)}>{selectedVendor.riskScore}</p>
                    <Badge className={cn('text-[10px] mt-1 capitalize', RISK_COLORS[selectedVendor.riskLevel]?.bg, RISK_COLORS[selectedVendor.riskLevel]?.text, 'border-0')}>
                      {selectedVendor.riskLevel} Risk
                    </Badge>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Compliance</p>
                    <p className="text-xl font-bold capitalize">{selectedVendor.complianceStatus}</p>
                    <p className="text-xs text-muted-foreground mt-1">Last: {new Date(selectedVendor.lastAssessment).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Active Contracts</p>
                    <p className="text-lg font-semibold">{selectedVendor.contractCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                    <p className="text-lg font-semibold">${(selectedVendor.totalValue / 1000).toFixed(0)}k</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {selectedVendor.contactEmail && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {selectedVendor.contactEmail}</p>}
                  {selectedVendor.contactPhone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {selectedVendor.contactPhone}</p>}
                  {selectedVendor.website && <p className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-muted-foreground" /> {selectedVendor.website}</p>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedVendor(null)}>Close</Button>
                <Link href={`/analytics/suppliers`}>
                  <Button><BarChart3 className="h-4 w-4 mr-2" /> View Analytics</Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
