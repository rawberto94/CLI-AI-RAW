'use client';

/**
 * Rate Comparison Tool Component
 * 
 * Multi-select comparison interface for rate cards
 * Allows selection of multiple rate cards and comparison types
 * Requirements: 6.1
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  GitCompare, 
  X, 
  Search, 
  Filter,
  Download,
  Save,
  Share2,
  TrendingUp,
  Building2,
  Calendar,
  MapPin
} from 'lucide-react';
import { RateCardFilterCriteria } from './RateCardFilters';

interface RateCardEntry {
  id: string;
  supplierName: string;
  roleStandardized: string;
  roleOriginal: string;
  seniority: string;
  lineOfService: string;
  country: string;
  region: string;
  dailyRate: number;
  dailyRateUSD: number;
  currency: string;
  effectiveDate: string;
  source: string;
  isNegotiated: boolean;
}

type ComparisonType = 'supplier' | 'year-over-year' | 'role' | 'region' | 'custom';

interface RateComparisonToolProps {
  initialFilters?: RateCardFilterCriteria;
  onCompare?: (selectedIds: string[], comparisonType: ComparisonType) => void;
}

export function RateComparisonTool({ initialFilters, onCompare }: RateComparisonToolProps) {
  const [rateCards, setRateCards] = useState<RateCardEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [comparisonType, setComparisonType] = useState<ComparisonType>('supplier');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<RateCardFilterCriteria>(initialFilters || {});
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchRateCards();
  }, [filters]);

  const fetchRateCards = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Add filters to query params
      if (filters.supplier) params.append('supplierName', filters.supplier);
      if (filters.role) params.append('roleStandardized', filters.role);
      if (filters.seniority) params.append('seniority', filters.seniority);
      if (filters.lineOfService) params.append('lineOfService', filters.lineOfService);
      if (filters.country) params.append('country', filters.country);
      if (filters.region) params.append('region', filters.region);
      if (filters.rateMin) params.append('minRate', filters.rateMin.toString());
      if (filters.rateMax) params.append('maxRate', filters.rateMax.toString());
      if (filters.dateFrom) params.append('effectiveDateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) params.append('effectiveDateTo', filters.dateTo.toISOString());

      const response = await fetch(`/api/rate-cards?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRateCards(data.entries || []);
      }
    } catch (error) {
      console.error('Error fetching rate cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    const filteredIds = getFilteredRateCards().map(rc => rc.id);
    setSelectedIds(new Set(filteredIds));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const getFilteredRateCards = () => {
    if (!searchTerm) return rateCards;
    
    const term = searchTerm.toLowerCase();
    return rateCards.filter(rc => 
      rc.supplierName.toLowerCase().includes(term) ||
      rc.roleStandardized.toLowerCase().includes(term) ||
      rc.roleOriginal.toLowerCase().includes(term) ||
      rc.country.toLowerCase().includes(term)
    );
  };

  const handleCompare = () => {
    if (selectedIds.size < 2) {
      toast.warning('Please select at least 2 rate cards to compare');
      return;
    }
    
    if (onCompare) {
      onCompare(Array.from(selectedIds), comparisonType);
    }
  };

  const getQuickFilterSuggestions = () => {
    // Suggest filters based on comparison type
    switch (comparisonType) {
      case 'supplier':
        return 'Filter by role and geography to compare suppliers';
      case 'year-over-year':
        return 'Filter by supplier and role to compare across years';
      case 'role':
        return 'Filter by supplier and geography to compare roles';
      case 'region':
        return 'Filter by supplier and role to compare regions';
      default:
        return 'Apply filters to find comparable rates';
    }
  };

  const filteredRateCards = getFilteredRateCards();
  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitCompare className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>Rate Comparison Tool</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Select multiple rate cards to compare side-by-side
                </p>
              </div>
            </div>
            <Badge variant={selectedCount >= 2 ? "default" : "secondary"}>
              {selectedCount} selected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Comparison Type Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Comparison Type</Label>
              <Select value={comparisonType} onValueChange={(value) => setComparisonType(value as ComparisonType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Supplier vs Supplier
                    </div>
                  </SelectItem>
                  <SelectItem value="year-over-year">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Year over Year
                    </div>
                  </SelectItem>
                  <SelectItem value="role">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Role vs Role
                    </div>
                  </SelectItem>
                  <SelectItem value="region">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Region vs Region
                    </div>
                  </SelectItem>
                  <SelectItem value="custom">Custom Comparison</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getQuickFilterSuggestions()}
              </p>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by supplier, role, or country..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? 'Hide' : 'Show'} Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={filteredRateCards.length === 0}
              >
                Select All ({filteredRateCards.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                disabled={selectedCount === 0}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Selection
              </Button>
            </div>

            <Button
              onClick={handleCompare}
              disabled={selectedCount < 2}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              Compare Selected ({selectedCount})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  placeholder="e.g., Software Engineer"
                  value={filters.role || ''}
                  onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  placeholder="e.g., United States"
                  value={filters.country || ''}
                  onChange={(e) => setFilters({ ...filters, country: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Seniority</Label>
                <Select 
                  value={filters.seniority || ''} 
                  onValueChange={(value) => setFilters({ ...filters, seniority: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All levels</SelectItem>
                    <SelectItem value="JUNIOR">Junior</SelectItem>
                    <SelectItem value="MID">Mid</SelectItem>
                    <SelectItem value="SENIOR">Senior</SelectItem>
                    <SelectItem value="PRINCIPAL">Principal</SelectItem>
                    <SelectItem value="PARTNER">Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rate Cards List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Available Rate Cards ({filteredRateCards.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading rate cards...
            </div>
          ) : filteredRateCards.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No rate cards found. Try adjusting your filters.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredRateCards.map((rateCard) => (
                <div
                  key={rateCard.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedIds.has(rateCard.id)
                      ? 'bg-blue-50 border-blue-300'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleSelection(rateCard.id)}
                >
                  <Checkbox
                    checked={selectedIds.has(rateCard.id)}
                    onCheckedChange={() => toggleSelection(rateCard.id)}
                  />
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <p className="font-medium text-sm">{rateCard.supplierName}</p>
                      <p className="text-xs text-muted-foreground">{rateCard.source}</p>
                    </div>
                    <div>
                      <p className="text-sm">{rateCard.roleStandardized}</p>
                      <p className="text-xs text-muted-foreground">{rateCard.seniority}</p>
                    </div>
                    <div>
                      <p className="text-sm">{rateCard.country}</p>
                      <p className="text-xs text-muted-foreground">{rateCard.region}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">
                        ${rateCard.dailyRate.toLocaleString()} {rateCard.currency}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${rateCard.dailyRateUSD.toLocaleString()} USD
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
