'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Archive, Search, RefreshCw, RotateCcw, Trash2, FileText,
  Calendar, Clock, Eye, MoreVertical, AlertCircle, CheckCircle2,
  Download, Filter, Building2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ArchivedContract {
  id: string;
  title: string;
  contractType: string | null;
  status: string;
  counterpartyName: string | null;
  updatedAt: string;
  totalValue: number | null;
  archivedAt?: string;
}

export default function ArchiveClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['archived-contracts'],
    queryFn: async () => {
      const res = await fetch('/api/contracts?status=ARCHIVED&limit=100');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return json.data?.contracts || [];
    },
    staleTime: 30_000,
  });

  const contracts: ArchivedContract[] = data || [];

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contracts/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Contract restored to active');
      setConfirmRestore(null);
      queryClient.invalidateQueries({ queryKey: ['archived-contracts'] });
    },
    onError: () => toast.error('Failed to restore contract'),
  });

  const filtered = contracts.filter(c => {
    if (searchTerm && !c.title.toLowerCase().includes(searchTerm.toLowerCase()) && !c.counterpartyName?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (typeFilter !== 'all' && c.contractType !== typeFilter) return false;
    return true;
  });

  const types = [...new Set(contracts.map(c => c.contractType).filter(Boolean))];

  if (isLoading) {
    return (
      <DashboardLayout title="Contract Archive" description="Archived contracts">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Contract Archive"
      description={`${contracts.length} archived contracts`}
      actions={
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Archived</p>
                  <p className="text-2xl font-bold">{contracts.length}</p>
                </div>
                <Archive className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">${(contracts.reduce((s, c) => s + (c.totalValue || 0), 0) / 1000).toFixed(0)}k</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Contract Types</p>
                  <p className="text-2xl font-bold">{types.length}</p>
                </div>
                <Filter className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Archived Contracts ({filtered.length})</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
                  <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-8 w-48 text-xs" />
                </div>
                {types.length > 0 && (
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {types.map(t => <SelectItem key={t!} value={t!}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Archive className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
                <p className="text-sm font-medium">No archived contracts</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {contracts.length === 0 ? 'Archived contracts will appear here' : 'No items match your filters'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(contract => (
                  <div key={contract.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Archive className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link href={`/contracts/${contract.id}`} className="font-medium text-sm hover:underline">{contract.title}</Link>
                        {contract.contractType && <Badge variant="outline" className="text-[10px]">{contract.contractType}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {contract.counterpartyName && <><Building2 className="h-3 w-3 inline mr-1" />{contract.counterpartyName} · </>}
                        Archived {new Date(contract.updatedAt).toLocaleDateString()}
                        {contract.totalValue && <> · ${(contract.totalValue / 1000).toFixed(0)}k</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link href={`/contracts/${contract.id}`}>
                        <Button size="sm" variant="ghost" className="h-7"><Eye className="h-3 w-3" /></Button>
                      </Link>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirmRestore(contract.id)}>
                        <RotateCcw className="h-3 w-3 mr-1" /> Restore
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Restore Confirmation */}
      <Dialog open={!!confirmRestore} onOpenChange={() => setConfirmRestore(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Contract?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will move the contract back to Active status. It will appear in your main contract list.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(null)}>Cancel</Button>
            <Button onClick={() => confirmRestore && restoreMutation.mutate(confirmRestore)} disabled={restoreMutation.isPending}>
              {restoreMutation.isPending ? 'Restoring...' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
