'use client';

import { useState } from 'react';
import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { EnhancedRateCardFilters } from '@/components/rate-cards/EnhancedRateCardFilters';
import { RateCardTable } from '@/components/rate-cards/RateCardTable';
import { BulkEditModal } from '@/components/rate-cards/BulkEditModal';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDataMode } from '@/contexts/DataModeContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCrossModuleInvalidation } from '@/hooks/use-queries';
import { toast } from 'sonner';

interface RateCardFilters {
  clientName?: string;
  supplierName?: string;
  role?: string;
  seniority?: string;
  country?: string;
  isBaseline?: boolean;
  isNegotiated?: boolean;
}

const fetchRateCards = async (filters: RateCardFilters, dataMode: string) => {
  const params = new URLSearchParams();
  if (filters.clientName) params.append('clientName', filters.clientName);
  if (filters.supplierName) params.append('supplierName', filters.supplierName);
  if (filters.role) params.append('roleStandardized', filters.role);
  if (filters.seniority) params.append('seniority', filters.seniority);
  if (filters.country) params.append('country', filters.country);
  if (filters.isBaseline !== undefined) params.append('isBaseline', String(filters.isBaseline));
  if (filters.isNegotiated !== undefined) params.append('isNegotiated', String(filters.isNegotiated));
  
  const response = await fetch(`/api/rate-cards?${params.toString()}`, {
    headers: { 'x-data-mode': dataMode },
  });
  const data = await response.json();
  
  // Map database fields to component interface
  const entries = (data.data || data.entries || []).map((entry: any) => ({
    id: entry.id,
    clientName: entry.clientName,
    supplierName: entry.supplierName,
    role: entry.roleStandardized || entry.standardizedRole,
    seniority: entry.seniority || entry.seniorityLevel,
    lineOfService: entry.lineOfService || entry.serviceLine,
    country: entry.country,
    dailyRate: Number(entry.dailyRate || entry.dailyRateUSD),
    currency: entry.currency || 'USD',
    isBaseline: entry.isBaseline || false,
    baselineType: entry.baselineType,
    isNegotiated: entry.isNegotiated || false,
    msaReference: entry.msaReference,
    createdAt: entry.createdAt,
  }));
  
  return { entries, total: data.total || 0 };
};

export default function RateCardEntriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { dataMode } = useDataMode();
  const crossModule = useCrossModuleInvalidation();
  const [filters, setFilters] = useState<RateCardFilters>({});
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rateCardToDelete, setRateCardToDelete] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rate-cards', filters, dataMode],
    queryFn: () => fetchRateCards(filters, dataMode),
    staleTime: 30 * 1000,
  });

  const rateCards = data?.entries || [];
  const matchCount = data?.total || 0;

  const handleEdit = (id: string) => {
    router.push(`/rate-cards/${id}`);
  };

  const handleView = (id: string) => {
    router.push(`/rate-cards/${id}`);
  };

  const handleDeleteClick = (id: string) => {
    setRateCardToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!rateCardToDelete) return;
    
    try {
      await fetch(`/api/rate-cards/${rateCardToDelete}`, { method: 'DELETE' });
      crossModule.onRateCardChange();
      toast.success('Rate card deleted successfully');
    } catch (error) {
      console.error('Error deleting rate card:', error);
      toast.error('Failed to delete rate card');
    } finally {
      setRateCardToDelete(null);
    }
  };

  const handleBulkEdit = async (ids: string[]) => {
    setSelectedIds(ids);
    setBulkEditOpen(true);
  };

  const handleBulkEditSuccess = () => {
    crossModule.onRateCardChange();
    setSelectedIds([]);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <RateCardBreadcrumbs />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rate Card Entries</h1>
          <p className="text-muted-foreground">
            View, filter, and manage all rate card entries
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rate-cards/upload">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload CSV
            </Button>
          </Link>
          <Button onClick={() => router.push('/rate-cards/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rate Card
          </Button>
        </div>
      </div>

      <EnhancedRateCardFilters 
        onFilterChange={setFilters}
        matchCount={matchCount}
      />

      <RateCardTable
        data={rateCards}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDeleteClick}
        onBulkEdit={handleBulkEdit}
        loading={isLoading}
        showClientColumn={true}
        showBaselineColumn={true}
        showNegotiatedColumn={true}
      />

      <BulkEditModal
        open={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        selectedIds={selectedIds}
        onSuccess={handleBulkEditSuccess}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Rate Card"
        description="Are you sure you want to delete this rate card? This action cannot be undone."
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
