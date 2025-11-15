'use client';

/**
 * Rate Card Filters Component
 * 
 * Advanced multi-criteria filtering for rate card entries
 * Supports filtering by supplier, role, seniority, line of service, country, region, date range, and rate range
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { X, Filter, Save, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

export interface RateCardFilterCriteria {
  supplier?: string;
  role?: string;
  seniority?: string;
  lineOfService?: string;
  country?: string;
  region?: string;
  dateFrom?: Date;
  dateTo?: Date;
  rateMin?: number;
  rateMax?: number;
}

interface RateCardFiltersProps {
  onFilterChange: (filters: RateCardFilterCriteria) => void;
  onSaveFilter?: (name: string, filters: RateCardFilterCriteria) => void;
  matchCount?: number;
}

const SENIORITY_LEVELS = ['JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'PARTNER'];
const REGIONS = ['EMEA', 'Americas', 'APAC'];

export function RateCardFilters({ onFilterChange, onSaveFilter, matchCount }: RateCardFiltersProps) {
  const [filters, setFilters] = useState<RateCardFilterCriteria>({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');

  // Available options (would typically come from API)
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [linesOfService, setLinesOfService] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    // Fetch available filter options
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    // Notify parent of filter changes
    onFilterChange(filters);
  }, [filters, onFilterChange]);

  const fetchFilterOptions = async () => {
    try {
      // Fetch unique values for dropdowns
      const response = await fetch('/api/rate-cards/filter-options');
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data.suppliers || []);
        setLinesOfService(data.linesOfService || []);
        setCountries(data.countries || []);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const updateFilter = (key: keyof RateCardFilterCriteria, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const clearFilter = (key: keyof RateCardFilterCriteria) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const handleSaveFilter = () => {
    if (filterName && onSaveFilter) {
      onSaveFilter(filterName, filters);
      setFilterName('');
      setShowSaveDialog(false);
    }
  };

  const activeFilterCount = Object.keys(filters).filter(key => filters[key as keyof RateCardFilterCriteria] !== undefined).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} active</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {matchCount !== undefined && (
              <span className="text-sm text-muted-foreground">
                {matchCount} matches
              </span>
            )}
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear All
              </Button>
            )}
            {onSaveFilter && activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
                <Save className="h-4 w-4 mr-2" />
                Save Filter
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Supplier Filter */}
        <div className="space-y-2">
          <Label>Supplier</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Search supplier..."
              value={filters.supplier || ''}
              onChange={(e) => updateFilter('supplier', e.target.value)}
              className="flex-1"
            />
            {filters.supplier && (
              <Button variant="ghost" size="icon" onClick={() => clearFilter('supplier')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Role Filter */}
        <div className="space-y-2">
          <Label>Role</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Search role..."
              value={filters.role || ''}
              onChange={(e) => updateFilter('role', e.target.value)}
              className="flex-1"
            />
            {filters.role && (
              <Button variant="ghost" size="icon" onClick={() => clearFilter('role')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Seniority Filter */}
        <div className="space-y-2">
          <Label>Seniority</Label>
          <div className="flex gap-2">
            <Select value={filters.seniority || ''} onValueChange={(value) => updateFilter('seniority', value)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All levels</SelectItem>
                {SENIORITY_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.seniority && (
              <Button variant="ghost" size="icon" onClick={() => clearFilter('seniority')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Line of Service Filter */}
        <div className="space-y-2">
          <Label>Line of Service</Label>
          <div className="flex gap-2">
            <Select value={filters.lineOfService || ''} onValueChange={(value) => updateFilter('lineOfService', value)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All services</SelectItem>
                {linesOfService.map(los => (
                  <SelectItem key={los} value={los}>
                    {los}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.lineOfService && (
              <Button variant="ghost" size="icon" onClick={() => clearFilter('lineOfService')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Country Filter */}
        <div className="space-y-2">
          <Label>Country</Label>
          <div className="flex gap-2">
            <Select value={filters.country || ''} onValueChange={(value) => updateFilter('country', value)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All countries</SelectItem>
                {countries.map(country => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.country && (
              <Button variant="ghost" size="icon" onClick={() => clearFilter('country')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Region Filter */}
        <div className="space-y-2">
          <Label>Region</Label>
          <div className="flex gap-2">
            <Select value={filters.region || ''} onValueChange={(value) => updateFilter('region', value)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All regions</SelectItem>
                {REGIONS.map(region => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filters.region && (
              <Button variant="ghost" size="icon" onClick={() => clearFilter('region')}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-2">
          <Label>Effective Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, 'PP') : 'From date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => updateFilter('dateFrom', date)}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, 'PP') : 'To date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => updateFilter('dateTo', date)}
                />
              </PopoverContent>
            </Popover>
          </div>
          {(filters.dateFrom || filters.dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => {
              clearFilter('dateFrom');
              clearFilter('dateTo');
            }}>
              Clear dates
            </Button>
          )}
        </div>

        {/* Rate Range Filter */}
        <div className="space-y-2">
          <Label>Daily Rate Range (USD)</Label>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.rateMin || ''}
                  onChange={(e) => updateFilter('rateMin', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.rateMax || ''}
                  onChange={(e) => updateFilter('rateMax', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            </div>
            {(filters.rateMin || filters.rateMax) && (
              <div className="text-sm text-muted-foreground">
                ${filters.rateMin || 0} - ${filters.rateMax || '∞'} per day
              </div>
            )}
          </div>
        </div>

        {/* Active Filters Summary */}
        {activeFilterCount > 0 && (
          <div className="pt-4 border-t">
            <Label className="mb-2 block">Active Filters</Label>
            <div className="flex flex-wrap gap-2">
              {filters.supplier && (
                <Badge variant="secondary">
                  Supplier: {filters.supplier}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => clearFilter('supplier')} />
                </Badge>
              )}
              {filters.role && (
                <Badge variant="secondary">
                  Role: {filters.role}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => clearFilter('role')} />
                </Badge>
              )}
              {filters.seniority && (
                <Badge variant="secondary">
                  Seniority: {filters.seniority}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => clearFilter('seniority')} />
                </Badge>
              )}
              {filters.lineOfService && (
                <Badge variant="secondary">
                  Service: {filters.lineOfService}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => clearFilter('lineOfService')} />
                </Badge>
              )}
              {filters.country && (
                <Badge variant="secondary">
                  Country: {filters.country}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => clearFilter('country')} />
                </Badge>
              )}
              {filters.region && (
                <Badge variant="secondary">
                  Region: {filters.region}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => clearFilter('region')} />
                </Badge>
              )}
              {(filters.dateFrom || filters.dateTo) && (
                <Badge variant="secondary">
                  Date: {filters.dateFrom ? format(filters.dateFrom, 'PP') : '...'} - {filters.dateTo ? format(filters.dateTo, 'PP') : '...'}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => {
                    clearFilter('dateFrom');
                    clearFilter('dateTo');
                  }} />
                </Badge>
              )}
              {(filters.rateMin || filters.rateMax) && (
                <Badge variant="secondary">
                  Rate: ${filters.rateMin || 0} - ${filters.rateMax || '∞'}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => {
                    clearFilter('rateMin');
                    clearFilter('rateMax');
                  }} />
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Save Filter Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Save Filter Preset</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Filter Name</Label>
                <Input
                  placeholder="e.g., Senior Developers in EMEA"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveFilter} disabled={!filterName}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}

// Auto-generated default export
export default RateCardFilters;
