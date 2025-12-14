'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Filter } from 'lucide-react';

interface FilterOptions {
  roles: string[];
  seniorities: string[];
  countries: string[];
  linesOfService: string[];
  roleCategories: string[];
}

interface MarketIntelligenceFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
}

export interface FilterState {
  role?: string;
  seniority?: string;
  country?: string;
  lineOfService?: string;
  roleCategory?: string;
  periodMonths: number;
}

export function MarketIntelligenceFilters({ 
  onFilterChange, 
  initialFilters 
}: MarketIntelligenceFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(
    initialFilters || { periodMonths: 12 }
  );
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    roles: [],
    seniorities: [],
    countries: [],
    linesOfService: [],
    roleCategories: [],
  });

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    onFilterChange(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadFilterOptions = async () => {
    try {
      const response = await fetch('/api/rate-cards/filter-options');
      const data = await response.json();
      setFilterOptions(data);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilter = (key: keyof FilterState) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setFilters({ periodMonths: 12 });
  };

  const activeFilterCount = Object.keys(filters).filter(
    key => key !== 'periodMonths' && filters[key as keyof FilterState]
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Market Intelligence Filters
            </CardTitle>
            <CardDescription>
              Refine your market analysis with specific criteria
            </CardDescription>
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters}>
              Clear all ({activeFilterCount})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active Filters */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 pb-4 border-b">
            {filters.role && (
              <Badge variant="secondary" className="gap-1">
                Role: {filters.role}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => clearFilter('role')}
                />
              </Badge>
            )}
            {filters.seniority && (
              <Badge variant="secondary" className="gap-1">
                Seniority: {filters.seniority}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => clearFilter('seniority')}
                />
              </Badge>
            )}
            {filters.country && (
              <Badge variant="secondary" className="gap-1">
                Country: {filters.country}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => clearFilter('country')}
                />
              </Badge>
            )}
            {filters.lineOfService && (
              <Badge variant="secondary" className="gap-1">
                Line of Service: {filters.lineOfService}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => clearFilter('lineOfService')}
                />
              </Badge>
            )}
            {filters.roleCategory && (
              <Badge variant="secondary" className="gap-1">
                Category: {filters.roleCategory}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => clearFilter('roleCategory')}
                />
              </Badge>
            )}
          </div>
        )}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Role</label>
            <Select 
              value={filters.role || ''} 
              onValueChange={(v) => updateFilter('role', v || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All roles</SelectItem>
                {filterOptions.roles.map(role => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Seniority</label>
            <Select 
              value={filters.seniority || ''} 
              onValueChange={(v) => updateFilter('seniority', v || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All levels</SelectItem>
                {filterOptions.seniorities.map(seniority => (
                  <SelectItem key={seniority} value={seniority}>{seniority}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Country</label>
            <Select 
              value={filters.country || ''} 
              onValueChange={(v) => updateFilter('country', v || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All countries</SelectItem>
                {filterOptions.countries.map(country => (
                  <SelectItem key={country} value={country}>{country}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Line of Service</label>
            <Select 
              value={filters.lineOfService || ''} 
              onValueChange={(v) => updateFilter('lineOfService', v || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All services</SelectItem>
                {filterOptions.linesOfService.map(los => (
                  <SelectItem key={los} value={los}>{los}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Time Period</label>
            <Select 
              value={filters.periodMonths.toString()} 
              onValueChange={(v) => updateFilter('periodMonths', parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last month</SelectItem>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
                <SelectItem value="24">Last 24 months</SelectItem>
                <SelectItem value="36">Last 36 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Filters */}
        <details className="pt-4 border-t">
          <summary className="text-sm font-medium cursor-pointer hover:text-primary">
            Advanced Filters
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Role Category</label>
              <Select 
                value={filters.roleCategory || ''} 
                onValueChange={(v) => updateFilter('roleCategory', v || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All categories</SelectItem>
                  {filterOptions.roleCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
