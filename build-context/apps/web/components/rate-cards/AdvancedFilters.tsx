'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, X, Search } from 'lucide-react';

export interface FilterCriteria {
  roleStandardized?: string;
  seniority?: string;
  country?: string;
  region?: string;
  lineOfService?: string;
  supplierName?: string;
  supplierTier?: string;
  minRate?: number;
  maxRate?: number;
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
  // Array-based filters for API compatibility
  roles?: string[];
  suppliers?: string[];
  regions?: string[];
}

interface AdvancedFiltersProps {
  onFilterChange?: (filters: FilterCriteria) => void;
  onReset?: () => void;
}

export function AdvancedFilters({ onFilterChange, onReset }: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({});

  const handleFilterChange = (key: keyof FilterCriteria, value: string | number | undefined) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleReset = () => {
    setFilters({});
    onReset?.();
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
            {activeFilterCount > 0 && (
              <span className="bg-violet-100 text-violet-800 text-xs font-semibold px-2 py-0.5 rounded">
                {activeFilterCount} active
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Hide' : 'Show'} Filters
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by role, supplier, or keyword..."
              value={filters.searchTerm || ''}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Role */}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={filters.roleStandardized}
                onValueChange={(value) => handleFilterChange('roleStandardized', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Software Developer">Software Developer</SelectItem>
                  <SelectItem value="Data Scientist">Data Scientist</SelectItem>
                  <SelectItem value="Business Analyst">Business Analyst</SelectItem>
                  <SelectItem value="Project Manager">Project Manager</SelectItem>
                  <SelectItem value="DevOps Engineer">DevOps Engineer</SelectItem>
                  <SelectItem value="QA Engineer">QA Engineer</SelectItem>
                  <SelectItem value="Solution Architect">Solution Architect</SelectItem>
                  <SelectItem value="Product Manager">Product Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Seniority */}
            <div className="space-y-2">
              <Label>Seniority</Label>
              <Select
                value={filters.seniority}
                onValueChange={(value) => handleFilterChange('seniority', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select seniority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JUNIOR">Junior</SelectItem>
                  <SelectItem value="MID">Mid-Level</SelectItem>
                  <SelectItem value="SENIOR">Senior</SelectItem>
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="PRINCIPAL">Principal</SelectItem>
                  <SelectItem value="DIRECTOR">Director</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Country */}
            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={filters.country}
                onValueChange={(value) => handleFilterChange('country', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="Germany">Germany</SelectItem>
                  <SelectItem value="India">India</SelectItem>
                  <SelectItem value="Australia">Australia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Region */}
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={filters.region}
                onValueChange={(value) => handleFilterChange('region', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="North America">North America</SelectItem>
                  <SelectItem value="Europe">Europe</SelectItem>
                  <SelectItem value="Asia Pacific">Asia Pacific</SelectItem>
                  <SelectItem value="Latin America">Latin America</SelectItem>
                  <SelectItem value="Middle East">Middle East</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Line of Service */}
            <div className="space-y-2">
              <Label>Line of Service</Label>
              <Select
                value={filters.lineOfService}
                onValueChange={(value) => handleFilterChange('lineOfService', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Software Development">Software Development</SelectItem>
                  <SelectItem value="Data & Analytics">Data & Analytics</SelectItem>
                  <SelectItem value="Cloud Services">Cloud Services</SelectItem>
                  <SelectItem value="Consulting">Consulting</SelectItem>
                  <SelectItem value="Infrastructure">Infrastructure</SelectItem>
                  <SelectItem value="Security">Security</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Supplier Tier */}
            <div className="space-y-2">
              <Label>Supplier Tier</Label>
              <Select
                value={filters.supplierTier}
                onValueChange={(value) => handleFilterChange('supplierTier', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TIER_1">Tier 1 (Strategic)</SelectItem>
                  <SelectItem value="TIER_2">Tier 2 (Preferred)</SelectItem>
                  <SelectItem value="TIER_3">Tier 3 (Approved)</SelectItem>
                  <SelectItem value="TIER_4">Tier 4 (Transactional)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Min Rate */}
            <div className="space-y-2">
              <Label>Min Daily Rate (USD)</Label>
              <Input
                type="number"
                placeholder="0"
                value={filters.minRate || ''}
                onChange={(e) => handleFilterChange('minRate', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>

            {/* Max Rate */}
            <div className="space-y-2">
              <Label>Max Daily Rate (USD)</Label>
              <Input
                type="number"
                placeholder="10000"
                value={filters.maxRate || ''}
                onChange={(e) => handleFilterChange('maxRate', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Effective Date From</Label>
              <Input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Effective Date To</Label>
              <Input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear All Filters
            </Button>
            <Button
              onClick={() => onFilterChange?.(filters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
