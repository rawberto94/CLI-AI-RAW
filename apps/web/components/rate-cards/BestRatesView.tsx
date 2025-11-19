'use client';

/**
 * Best Rates View Component
 * 
 * Displays the best (lowest) rate for each unique role-geography-seniority combination
 * Allows filtering and highlights which supplier offers the best rate
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeletons';
import { TrendingDown, Award, Building2, MapPin, Briefcase, Calendar } from 'lucide-react';

interface BestRateEntry {
  id: string;
  supplierName: string;
  supplierId: string;
  effectiveDate: string;
  expiryDate?: string | null;
  roleOriginal: string;
  country: string;
  region: string;
  lineOfService: string;
}

interface BestRate {
  bestRate: number;
  bestRateEntry: BestRateEntry;
  cohortSize: number;
  confidence: number;
  averageRate: number;
  medianRate: number;
  savingsVsAverage: number;
  savingsVsMedian: number;
}

export function BestRatesView() {
  const [bestRates, setBestRates] = useState<BestRate[]>([]);
  const [filteredRates, setFilteredRates] = useState<BestRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [lineOfServiceFilter, setLineOfServiceFilter] = useState('all');

  // Fetch best rates
  useEffect(() => {
    fetchBestRates();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...bestRates];

    if (roleFilter) {
      filtered = filtered.filter(br =>
        br.bestRateEntry.roleOriginal.toLowerCase().includes(roleFilter.toLowerCase())
      );
    }

    if (countryFilter !== 'all') {
      filtered = filtered.filter(br => br.bestRateEntry.country === countryFilter);
    }

    if (lineOfServiceFilter !== 'all') {
      filtered = filtered.filter(br => br.bestRateEntry.lineOfService === lineOfServiceFilter);
    }

    setFilteredRates(filtered);
  }, [bestRates, roleFilter, countryFilter, lineOfServiceFilter]);

  const fetchBestRates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rate-cards/best-rates');
      
      if (!response.ok) {
        throw new Error('Failed to fetch best rates');
      }

      const data = await response.json();
      setBestRates(data.bestRates || []);
      setFilteredRates(data.bestRates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Get unique countries and lines of service for filters
  const uniqueCountries = Array.from(new Set(Array.isArray(bestRates) ? bestRates.map(br => br.bestRateEntry.country) : []));
  const uniqueLinesOfService = Array.from(new Set(Array.isArray(bestRates) ? bestRates.map(br => br.bestRateEntry.lineOfService) : []));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-red-500">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Award className="h-6 w-6 text-yellow-500" />
          Best Rates in Market
        </h2>
        <p className="text-muted-foreground mt-1">
          Lowest rates for each role-geography combination. Use these as negotiation targets.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Role</label>
              <Input
                placeholder="Search by role..."
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Country</label>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All countries</SelectItem>
                  {uniqueCountries.map(country => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Line of Service</label>
              <Select value={lineOfServiceFilter} onValueChange={setLineOfServiceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All services" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All services</SelectItem>
                  {uniqueLinesOfService.map(los => (
                    <SelectItem key={los} value={los}>
                      {los}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredRates.length}</div>
            <p className="text-sm text-muted-foreground">Unique Combinations</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              ${filteredRates.length > 0 
                ? Math.round(filteredRates.reduce((sum, br) => sum + br.bestRate, 0) / filteredRates.length)
                : 0}
            </div>
            <p className="text-sm text-muted-foreground">Average Best Rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {filteredRates.length > 0
                ? new Set(filteredRates.map(br => br.bestRateEntry.supplierName)).size
                : 0}
            </div>
            <p className="text-sm text-muted-foreground">Best Rate Suppliers</p>
          </CardContent>
        </Card>
      </div>

      {/* Best Rates List */}
      <div className="space-y-4">
        {filteredRates.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No best rates found matching your filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredRates.map((bestRate, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-500" />
                      {bestRate.bestRateEntry.roleOriginal}
                    </CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {bestRate.bestRateEntry.country}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {bestRate.bestRateEntry.lineOfService}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-600">
                      ${Math.round(bestRate.bestRate)}
                    </div>
                    <p className="text-sm text-muted-foreground">per day</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Best Rate Supplier */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{bestRate.bestRateEntry.supplierName}</span>
                      <Badge variant="secondary">Best Rate</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Effective: {new Date(bestRate.bestRateEntry.effectiveDate).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Market Comparison */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Market Average:</span>
                      <span className="font-medium">${Math.round(bestRate.averageRate)}/day</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Market Median:</span>
                      <span className="font-medium">${Math.round(bestRate.medianRate)}/day</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cohort Size:</span>
                      <span className="font-medium">{bestRate.cohortSize} rates</span>
                    </div>
                  </div>
                </div>

                {/* Savings Indicators */}
                <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-green-600" />
                    <span className="text-sm">
                      <span className="font-medium text-green-600">
                        ${Math.round(bestRate.savingsVsAverage)}/day
                      </span>
                      <span className="text-muted-foreground"> below average</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-green-600" />
                    <span className="text-sm">
                      <span className="font-medium text-green-600">
                        ${Math.round(bestRate.savingsVsMedian)}/day
                      </span>
                      <span className="text-muted-foreground"> below median</span>
                    </span>
                  </div>
                </div>

                {/* Confidence Badge */}
                <div className="mt-4">
                  <Badge 
                    variant={bestRate.confidence > 0.7 ? 'default' : bestRate.confidence > 0.4 ? 'secondary' : 'outline'}
                  >
                    {bestRate.confidence > 0.7 ? 'High' : bestRate.confidence > 0.4 ? 'Medium' : 'Low'} Confidence
                    ({Math.round(bestRate.confidence * 100)}%)
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
