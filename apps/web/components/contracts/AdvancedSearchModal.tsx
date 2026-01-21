'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, X, DollarSign, Building2, Truck, FileText } from 'lucide-react';

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
      <DialogContent className="sm:max-w-[640px] bg-white border-slate-200 shadow-lg rounded-lg">
        <DialogHeader className="pb-2">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2.5 bg-blue-600 rounded-lg text-white">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <span className="font-semibold text-slate-900">
                Advanced Search
              </span>
              <p className="text-sm font-normal text-slate-500 mt-0.5">Find contracts with precision</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="query" className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              Search Query
            </Label>
            <Input
              id="query"
              placeholder="Search contracts by title, content..."
              value={filters.query || ''}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-500" />
                Client Name
              </Label>
              <Input
                id="clientName"
                placeholder="Filter by client..."
                value={filters.clientName || ''}
                onChange={(e) => setFilters({ ...filters, clientName: e.target.value })}
                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplierName" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Truck className="h-4 w-4 text-teal-500" />
                Supplier Name
              </Label>
              <Input
                id="supplierName"
                placeholder="Filter by supplier..."
                value={filters.supplierName || ''}
                onChange={(e) => setFilters({ ...filters, supplierName: e.target.value })}
                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minValue" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                Min Value
              </Label>
              <Input
                id="minValue"
                type="number"
                placeholder="0"
                value={filters.minValue || ''}
                onChange={(e) => setFilters({ ...filters, minValue: e.target.value ? Number(e.target.value) : undefined })}
                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxValue" className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                Max Value
              </Label>
              <Input
                id="maxValue"
                type="number"
                placeholder="No limit"
                value={filters.maxValue || ''}
                onChange={(e) => setFilters({ ...filters, maxValue: e.target.value ? Number(e.target.value) : undefined })}
                className="h-11 rounded-xl border-slate-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-100">
          <Button 
            variant="outline" 
            onClick={handleClear}
            className="rounded-xl border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <X className="mr-2 h-4 w-4" />
            Clear All
          </Button>
          <div className="space-x-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange?.(false)}
              className="rounded-lg border-slate-200 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSearch}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Search className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
