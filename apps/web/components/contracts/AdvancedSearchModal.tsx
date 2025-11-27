'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Filter, X } from 'lucide-react';

export interface AdvancedSearchFilters {
  query?: string;
  contractType?: string[];
  status?: string[];
  dateRange?: { from?: Date; to?: Date };
  clientName?: string;
  supplierName?: string;
  minValue?: number;
  maxValue?: number;
}

interface AdvancedSearchModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSearch?: (filters: AdvancedSearchFilters) => void;
  initialFilters?: AdvancedSearchFilters;
}

export function AdvancedSearchModal({
  open,
  onOpenChange,
  onSearch,
  initialFilters,
}: AdvancedSearchModalProps) {
  const [filters, setFilters] = useState<AdvancedSearchFilters>(initialFilters || {});

  const handleSearch = () => {
    onSearch?.(filters);
    onOpenChange?.(false);
  };

  const handleClear = () => {
    setFilters({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Advanced Search
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="query">Search Query</Label>
            <Input
              id="query"
              placeholder="Search contracts..."
              value={filters.query || ''}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                placeholder="Filter by client..."
                value={filters.clientName || ''}
                onChange={(e) => setFilters({ ...filters, clientName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierName">Supplier Name</Label>
              <Input
                id="supplierName"
                placeholder="Filter by supplier..."
                value={filters.supplierName || ''}
                onChange={(e) => setFilters({ ...filters, supplierName: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minValue">Min Value</Label>
              <Input
                id="minValue"
                type="number"
                placeholder="0"
                value={filters.minValue || ''}
                onChange={(e) => setFilters({ ...filters, minValue: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxValue">Max Value</Label>
              <Input
                id="maxValue"
                type="number"
                placeholder="No limit"
                value={filters.maxValue || ''}
                onChange={(e) => setFilters({ ...filters, maxValue: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleClear}>
            <X className="mr-2 h-4 w-4" />
            Clear All
          </Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => onOpenChange?.(false)}>
              Cancel
            </Button>
            <Button onClick={handleSearch}>
              <Filter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
