'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Download, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Columns3,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { FilterCriteria } from './AdvancedFilters';
import { useToast } from '@/hooks/use-toast';

interface RateCardEntry {
  id: string;
  roleOriginal: string;
  roleStandardized: string;
  seniority: string;
  supplierName: string;
  supplierTier: string;
  dailyRateUSD: number;
  currency: string;
  country: string;
  region: string;
  lineOfService: string;
  effectiveDate: string;
  volumeCommitted?: number;
  isNegotiated: boolean;
  confidence: number;
  source: string;
  marketPosition?: 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE';
  deviationFromMarket?: number;
}

interface RateCardDataRepositoryProps {
  filters?: FilterCriteria;
}

type SortField = keyof RateCardEntry;
type SortDirection = 'asc' | 'desc';

export function RateCardDataRepository({ filters }: RateCardDataRepositoryProps) {
  const { toast } = useToast();
  
  const [data, setData] = useState<RateCardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('dailyRateUSD');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set([
      'roleStandardized',
      'seniority',
      'supplierName',
      'dailyRateUSD',
      'country',
      'lineOfService',
      'effectiveDate',
      'marketPosition',
    ])
  );

  const fetchRateCards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.roles?.length) params.set('roles', filters.roles.join(','));
      if (filters?.suppliers?.length) params.set('suppliers', filters.suppliers.join(','));
      if (filters?.regions?.length) params.set('regions', filters.regions.join(','));

      const response = await fetch(`/api/rate-cards/entries?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch rate cards');
      
      const result = await response.json();
      if (result.success && result.entries?.length > 0) {
        setData(result.entries.map((entry: any) => ({
          id: entry.id,
          roleOriginal: entry.roleOriginal || entry.role,
          roleStandardized: entry.roleStandardized || entry.standardizedRole,
          seniority: entry.seniority || 'MID',
          supplierName: entry.supplierName || 'Unknown',
          supplierTier: entry.supplierTier || 'TIER_2',
          dailyRateUSD: entry.dailyRateUSD || entry.rate || 0,
          currency: entry.currency || 'USD',
          country: entry.country || 'Unknown',
          region: entry.region || 'Unknown',
          lineOfService: entry.lineOfService || 'General',
          effectiveDate: entry.effectiveDate || new Date().toISOString().split('T')[0],
          volumeCommitted: entry.volumeCommitted || 0,
          isNegotiated: entry.isNegotiated || false,
          confidence: entry.confidence || 0.5,
          source: entry.source || 'IMPORT',
          marketPosition: entry.marketPosition,
          deviationFromMarket: entry.deviationFromMarket,
        })));
      } else {
        setData([]);
      }
    } catch {
      setError('Failed to load rate cards');
      setData([]);
    } finally {
      setLoading(false);
    }
    
  }, [filters]);

  useEffect(() => {
    fetchRateCards();
  }, [fetchRateCards]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    const multiplier = sortDirection === 'asc' ? 1 : -1;

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * multiplier;
    }
    return String(aValue).localeCompare(String(bValue)) * multiplier;
  });

  const toggleColumn = (column: string) => {
    const newVisible = new Set(visibleColumns);
    if (newVisible.has(column)) {
      newVisible.delete(column);
    } else {
      newVisible.add(column);
    }
    setVisibleColumns(newVisible);
  };

  const handleExport = () => {
    // Convert to CSV
    const headers = Array.from(visibleColumns);
    const csv = [
      headers.join(','),
      ...sortedData.map(row => 
        headers.map(h => row[h as keyof RateCardEntry]).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate-cards-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 text-gray-400 dark:text-slate-500" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const getMarketPositionBadge = (position?: string, deviation?: number) => {
    if (!position) return null;
    
    const config = {
      ABOVE_AVERAGE: { 
        label: 'Above Market', 
        className: 'bg-orange-100 text-orange-800',
        icon: TrendingUp 
      },
      AVERAGE: { 
        label: 'At Market', 
        className: 'bg-green-100 text-green-800',
        icon: Minus 
      },
      BELOW_AVERAGE: { 
        label: 'Below Market', 
        className: 'bg-violet-100 text-violet-800',
        icon: TrendingDown 
      },
    };

    const { label, className, icon: Icon } = config[position as keyof typeof config];
    return (
      <Badge variant="outline" className={className}>
        <Icon className="mr-1 h-3 w-3" />
        {label}
        {deviation && (
          <span className="ml-1 font-mono text-xs">
            {deviation > 0 ? '+' : ''}{deviation}
          </span>
        )}
      </Badge>
    );
  };

  const getTierBadge = (tier: string) => {
    const colors = {
      TIER_1: 'bg-violet-100 text-violet-800',
      TIER_2: 'bg-violet-100 text-violet-800',
      TIER_3: 'bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-300',
      TIER_4: 'bg-slate-100 text-slate-800',
    };
    return (
      <Badge variant="outline" className={colors[tier as keyof typeof colors]}>
        {tier.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl flex items-center gap-2">
                <Database className="h-5 w-5" />
                Rate Card Repository
              </CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Live Data
              </Badge>
            </div>
            <CardDescription>
              Complete repository of {data.length} rate card entries across all contracts
            </CardDescription>
            {error && (
              <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={fetchRateCards}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="mr-2 h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {[
                  { key: 'roleStandardized', label: 'Role' },
                  { key: 'roleOriginal', label: 'Original Role' },
                  { key: 'seniority', label: 'Seniority' },
                  { key: 'supplierName', label: 'Supplier' },
                  { key: 'supplierTier', label: 'Tier' },
                  { key: 'dailyRateUSD', label: 'Daily Rate' },
                  { key: 'country', label: 'Country' },
                  { key: 'region', label: 'Region' },
                  { key: 'lineOfService', label: 'Line of Service' },
                  { key: 'effectiveDate', label: 'Effective Date' },
                  { key: 'volumeCommitted', label: 'Volume' },
                  { key: 'marketPosition', label: 'Market Position' },
                  { key: 'isNegotiated', label: 'Negotiated' },
                  { key: 'confidence', label: 'Confidence' },
                  { key: 'source', label: 'Source' },
                ].map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleColumns.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-slate-800/50 sticky top-0 z-10">
                <TableRow>
                  {visibleColumns.has('roleStandardized') && (
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('roleStandardized')}
                        className="h-8 flex items-center"
                      >
                        Role
                        <SortIcon field="roleStandardized" />
                      </Button>
                    </TableHead>
                  )}
                  {visibleColumns.has('roleOriginal') && (
                    <TableHead>Original Role</TableHead>
                  )}
                  {visibleColumns.has('seniority') && (
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('seniority')}
                        className="h-8 flex items-center"
                      >
                        Seniority
                        <SortIcon field="seniority" />
                      </Button>
                    </TableHead>
                  )}
                  {visibleColumns.has('supplierName') && (
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('supplierName')}
                        className="h-8 flex items-center"
                      >
                        Supplier
                        <SortIcon field="supplierName" />
                      </Button>
                    </TableHead>
                  )}
                  {visibleColumns.has('supplierTier') && (
                    <TableHead>Tier</TableHead>
                  )}
                  {visibleColumns.has('dailyRateUSD') && (
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('dailyRateUSD')}
                        className="h-8 flex items-center ml-auto"
                      >
                        Daily Rate
                        <SortIcon field="dailyRateUSD" />
                      </Button>
                    </TableHead>
                  )}
                  {visibleColumns.has('country') && (
                    <TableHead>Country</TableHead>
                  )}
                  {visibleColumns.has('region') && (
                    <TableHead>Region</TableHead>
                  )}
                  {visibleColumns.has('lineOfService') && (
                    <TableHead>Line of Service</TableHead>
                  )}
                  {visibleColumns.has('effectiveDate') && (
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('effectiveDate')}
                        className="h-8 flex items-center"
                      >
                        Effective Date
                        <SortIcon field="effectiveDate" />
                      </Button>
                    </TableHead>
                  )}
                  {visibleColumns.has('volumeCommitted') && (
                    <TableHead className="text-center">Volume</TableHead>
                  )}
                  {visibleColumns.has('marketPosition') && (
                    <TableHead>Market Position</TableHead>
                  )}
                  {visibleColumns.has('isNegotiated') && (
                    <TableHead className="text-center">Negotiated</TableHead>
                  )}
                  {visibleColumns.has('confidence') && (
                    <TableHead className="text-center">Confidence</TableHead>
                  )}
                  {visibleColumns.has('source') && (
                    <TableHead>Source</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.size} className="text-center py-8">
                      Loading data...
                    </TableCell>
                  </TableRow>
                ) : sortedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={visibleColumns.size} className="text-center py-8 text-gray-500 dark:text-slate-400">
                      No data found. Try adjusting your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedData.map((row) => (
                    <TableRow key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                      {visibleColumns.has('roleStandardized') && (
                        <TableCell className="font-medium">{row.roleStandardized}</TableCell>
                      )}
                      {visibleColumns.has('roleOriginal') && (
                        <TableCell className="text-sm text-gray-600 dark:text-slate-400">{row.roleOriginal}</TableCell>
                      )}
                      {visibleColumns.has('seniority') && (
                        <TableCell>
                          <Badge variant="secondary">{row.seniority}</Badge>
                        </TableCell>
                      )}
                      {visibleColumns.has('supplierName') && (
                        <TableCell>{row.supplierName}</TableCell>
                      )}
                      {visibleColumns.has('supplierTier') && (
                        <TableCell>{getTierBadge(row.supplierTier)}</TableCell>
                      )}
                      {visibleColumns.has('dailyRateUSD') && (
                        <TableCell className="text-right font-semibold">
                          ${row.dailyRateUSD.toLocaleString()}/day
                        </TableCell>
                      )}
                      {visibleColumns.has('country') && (
                        <TableCell>{row.country}</TableCell>
                      )}
                      {visibleColumns.has('region') && (
                        <TableCell className="text-sm text-gray-600 dark:text-slate-400">{row.region}</TableCell>
                      )}
                      {visibleColumns.has('lineOfService') && (
                        <TableCell>{row.lineOfService}</TableCell>
                      )}
                      {visibleColumns.has('effectiveDate') && (
                        <TableCell>
                          {new Date(row.effectiveDate).toLocaleDateString()}
                        </TableCell>
                      )}
                      {visibleColumns.has('volumeCommitted') && (
                        <TableCell className="text-center">
                          {row.volumeCommitted || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.has('marketPosition') && (
                        <TableCell>
                          {getMarketPositionBadge(row.marketPosition, row.deviationFromMarket)}
                        </TableCell>
                      )}
                      {visibleColumns.has('isNegotiated') && (
                        <TableCell className="text-center">
                          {row.isNegotiated ? '✓' : '-'}
                        </TableCell>
                      )}
                      {visibleColumns.has('confidence') && (
                        <TableCell className="text-center text-sm">
                          {(row.confidence * 100).toFixed(0)}%
                        </TableCell>
                      )}
                      {visibleColumns.has('source') && (
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {row.source}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
