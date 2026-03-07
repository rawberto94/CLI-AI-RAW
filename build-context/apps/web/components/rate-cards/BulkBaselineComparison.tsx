'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, TrendingUp, Download } from 'lucide-react';

interface ComparisonEntry {
  entryId: string;
  resourceType: string;
  lineOfService: string;
  actualRate: number;
  comparisons: Array<{
    baselineName: string;
    baselineType: string;
    variance: number;
    variancePercentage: number;
    potentialSavings: number;
    status: string;
  }>;
  maxSavings: number;
}

export function BulkBaselineComparison() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    totalEntries: number;
    entriesWithMatches: number;
    totalSavingsOpportunity: number;
    comparisons: ComparisonEntry[];
  } | null>(null);
  const [filters, setFilters] = useState({
    minVariancePercentage: 5,
    baselineTypes: [] as string[],
    categoryL1: '',
    categoryL2: '',
  });

  const handleCompare = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rate-cards/baselines/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        throw new Error('Failed to perform comparison');
      }

      const data = await response.json();
      setResults(data);
    } catch {
      // Error performing comparison
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!results) return;

    const csv = [
      ['Resource Type', 'Line of Service', 'Actual Rate', 'Max Savings', 'Baseline Comparisons'],
      ...results.comparisons.map(entry => [
        entry.resourceType,
        entry.lineOfService,
        entry.actualRate.toString(),
        entry.maxSavings.toString(),
        entry.comparisons.length.toString(),
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baseline-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Bulk Baseline Comparison</h2>
        <p className="text-gray-600 mb-6">
          Compare all rate cards against approved baselines to identify rates exceeding targets.
        </p>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="minVariance" className="block text-sm font-medium mb-1">
              Minimum Variance % to Show
            </label>
            <input
              id="minVariance"
              type="number"
              className="w-full border rounded px-3 py-2"
              value={filters.minVariancePercentage}
              onChange={(e) =>
                setFilters({ ...filters, minVariancePercentage: Number(e.target.value) })
              }
              min="0"
              step="1"
            />
          </div>
          <div>
            <label htmlFor="baselineTypes" className="block text-sm font-medium mb-1">
              Baseline Types (optional)
            </label>
            <select
              id="baselineTypes"
              multiple
              className="w-full border rounded px-3 py-2"
              value={filters.baselineTypes}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  baselineTypes: Array.from(e.target.selectedOptions, option => option.value),
                })
              }
            >
              <option value="TARGET_RATE">Target Rate</option>
              <option value="MARKET_BENCHMARK">Market Benchmark</option>
              <option value="HISTORICAL_BEST">Historical Best</option>
              <option value="NEGOTIATED_CAP">Negotiated Cap</option>
              <option value="INTERNAL_POLICY">Internal Policy</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
          </div>
        </div>

        <Button onClick={handleCompare} disabled={loading}>
          {loading ? 'Comparing...' : 'Run Comparison'}
        </Button>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500 mb-1">Total Rate Cards</p>
              <p className="text-3xl font-bold">{results.totalEntries}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500 mb-1">Rates with Variances</p>
              <p className="text-3xl font-bold text-orange-600">
                {results.entriesWithMatches}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500 mb-1">Total Savings Opportunity</p>
              <p className="text-3xl font-bold text-green-600">
                ${results.totalSavingsOpportunity.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">Comparison Results</h3>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {results.comparisons.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No rates found exceeding baselines by the specified threshold.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource Type</TableHead>
                    <TableHead>Line of Service</TableHead>
                    <TableHead>Actual Rate</TableHead>
                    <TableHead>Baseline Comparisons</TableHead>
                    <TableHead>Max Savings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.comparisons.map((entry) => (
                    <TableRow key={entry.entryId}>
                      <TableCell className="font-medium">
                        {entry.resourceType}
                      </TableCell>
                      <TableCell>{entry.lineOfService}</TableCell>
                      <TableCell>${entry.actualRate.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {entry.comparisons.slice(0, 2).map((comp, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{comp.baselineName}:</span>{' '}
                              <span className={
                                comp.variance > 0 ? 'text-red-600' : 'text-green-600'
                              }>
                                {comp.variance > 0 ? '+' : ''}
                                {comp.variancePercentage.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                          {entry.comparisons.length > 2 && (
                            <p className="text-xs text-gray-500">
                              +{entry.comparisons.length - 2} more
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600 font-semibold">
                          ${entry.maxSavings.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {entry.maxSavings > 100 ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            High Priority
                          </Badge>
                        ) : entry.maxSavings > 50 ? (
                          <Badge variant="default">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Medium
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Low</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
