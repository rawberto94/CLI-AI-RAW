'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Filter } from 'lucide-react';

export interface EnhancedRateCardFilterCriteria {
  // Existing filters
  supplier?: string;
  role?: string;
  seniority?: string;
  lineOfService?: string;
  country?: string;
  region?: string;
  rateMin?: number;
  rateMax?: number;
  
  // New filters
  clientName?: string;
  isBaseline?: boolean;
  isNegotiated?: boolean;
  baselineType?: string;
}

interface EnhancedRateCardFiltersProps {
  onFilterChange: (filters: EnhancedRateCardFilterCriteria) => void;
  matchCount?: number;
}

const SENIORITY_LEVELS = ['JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'PARTNER'];
const BASELINE_TYPES = [
  'TARGET_RATE',
  'MARKET_BENCHMARK',
  'HISTORICAL_BEST',
  'COMPETITIVE_BID',
  'NEGOTIATED_CAP',
  'INDUSTRY_STANDARD',
  'CUSTOM',
];

export function EnhancedRateCardFilters({ onFilterChange, matchCount }: EnhancedRateCardFiltersProps) {
  const [filters, setFilters] = useState<EnhancedRateCardFilterCriteria>({});
  const [clients, setClients] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/rate-cards/filter-options');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
        setSuppliers(data.suppliers || []);
        setCountries(data.countries || []);
      }
    } catch {
      // Error fetching filter options
    }
  };

  const updateFilter = (key: keyof EnhancedRateCardFilterCriteria, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const clearFilter = (key: keyof EnhancedRateCardFilterCriteria) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const activeFilterCount = Object.keys(filters).filter(
    (key) => filters[key as keyof EnhancedRateCardFilterCriteria] !== undefined
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <CardTitle>Filters</CardTitle>
            {activeFilterCount > 0 && (
              <span className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear All
            </Button>
          )}
        </div>
        {matchCount !== undefined && (
          <div className="text-sm text-muted-foreground">
            {matchCount} rate cards match your filters
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Client & Status Filters */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Client & Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clientName">Client</Label>
                <select
                  id="clientName"
                  value={filters.clientName || ''}
                  onChange={(e) => updateFilter('clientName', e.target.value)}
                  className="w-full border rounded-md p-2"
                >
                  <option value="">All Clients</option>
                  {clients.map((client) => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </select>
                {filters.clientName && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearFilter('clientName')}
                    className="mt-1"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              <div>
                <Label htmlFor="baselineType">Baseline Type</Label>
                <select
                  id="baselineType"
                  value={filters.baselineType || ''}
                  onChange={(e) => updateFilter('baselineType', e.target.value)}
                  className="w-full border rounded-md p-2"
                  disabled={!filters.isBaseline}
                >
                  <option value="">All Types</option>
                  {BASELINE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isBaseline"
                  checked={filters.isBaseline || false}
                  onCheckedChange={(checked) => updateFilter('isBaseline', checked)}
                />
                <Label htmlFor="isBaseline" className="font-normal">
                  Baseline Rates Only
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isNegotiated"
                  checked={filters.isNegotiated || false}
                  onCheckedChange={(checked) => updateFilter('isNegotiated', checked)}
                />
                <Label htmlFor="isNegotiated" className="font-normal">
                  Negotiated Rates Only
                </Label>
              </div>
            </div>
          </div>

          {/* Supplier & Role Filters */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Supplier & Role</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <select
                  id="supplier"
                  value={filters.supplier || ''}
                  onChange={(e) => updateFilter('supplier', e.target.value)}
                  className="w-full border rounded-md p-2"
                >
                  <option value="">All Suppliers</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier} value={supplier}>
                      {supplier}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={filters.role || ''}
                  onChange={(e) => updateFilter('role', e.target.value)}
                  placeholder="Search role..."
                />
              </div>

              <div>
                <Label htmlFor="seniority">Seniority</Label>
                <select
                  id="seniority"
                  value={filters.seniority || ''}
                  onChange={(e) => updateFilter('seniority', e.target.value)}
                  className="w-full border rounded-md p-2"
                >
                  <option value="">All Levels</option>
                  {SENIORITY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  value={filters.country || ''}
                  onChange={(e) => updateFilter('country', e.target.value)}
                  className="w-full border rounded-md p-2"
                >
                  <option value="">All Countries</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Rate Range Filter */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Rate Range (USD/day)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rateMin">Minimum</Label>
                <Input
                  id="rateMin"
                  type="number"
                  value={filters.rateMin || ''}
                  onChange={(e) => updateFilter('rateMin', parseFloat(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="rateMax">Maximum</Label>
                <Input
                  id="rateMax"
                  type="number"
                  value={filters.rateMax || ''}
                  onChange={(e) => updateFilter('rateMax', parseFloat(e.target.value))}
                  placeholder="10000"
                />
              </div>
            </div>
          </div>

          {/* Active Filters Summary */}
          {activeFilterCount > 0 && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-semibold mb-2">Active Filters</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(filters).map(([key, value]) => {
                  if (value === undefined || value === '') return null;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                    >
                      <span>
                        {key}: {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                      </span>
                      <button
                        onClick={() => clearFilter(key as keyof EnhancedRateCardFilterCriteria)}
                        className="hover:bg-secondary-foreground/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
