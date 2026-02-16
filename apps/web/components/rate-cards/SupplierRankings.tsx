'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trophy,
  Medal,
  Award,
  Star,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MapPin,
  Briefcase,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react';
import Link from 'next/link';

interface SupplierRanking {
  supplierId: string;
  supplierName: string;
  averageRate: number;
  medianRate: number;
  marketAverage: number;
  competitivenessScore: number;
  totalRoles: number;
  totalContracts: number;
  geographicCoverage: {
    countries: string[];
    regions: string[];
    coverageScore: number;
  };
  serviceLineCoverage: {
    linesOfService: string[];
    diversityScore: number;
  };
  dataQualityScore: number;
  totalAnnualValue: number;
  potentialSavings: number;
  costRank?: number;
  qualityRank?: number;
  overallRank?: number;
}

type SortBy = 'overall' | 'cost' | 'competitiveness' | 'coverage' | 'quality';

export function SupplierRankings() {
  const [rankings, setRankings] = useState<SupplierRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('overall');
  const [periodMonths, setPeriodMonths] = useState(12);

  const fetchRankings = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(
        `/api/rate-cards/suppliers/rankings?periodMonths=${periodMonths}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch rankings');
      }

      const data = await response.json();
      setRankings(data.rankings);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRankings();
    
  }, [periodMonths]);

  const getSortedRankings = () => {
    const sorted = [...rankings];
    switch (sortBy) {
      case 'cost':
        return sorted.sort((a, b) => a.averageRate - b.averageRate);
      case 'competitiveness':
        return sorted.sort(
          (a, b) => b.competitivenessScore - a.competitivenessScore
        );
      case 'coverage':
        return sorted.sort(
          (a, b) =>
            b.geographicCoverage.countries.length -
            a.geographicCoverage.countries.length
        );
      case 'quality':
        return sorted.sort((a, b) => b.dataQualityScore - a.dataQualityScore);
      case 'overall':
      default:
        return sorted.sort((a, b) => (a.overallRank || 0) - (b.overallRank || 0));
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <Award className="h-5 w-5 text-gray-400" />;
  };

  const getCompetitivenessStars = (score: number) => {
    const stars = Math.round((score / 100) * 5);
    return (
      <div className="flex">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const sortedRankings = getSortedRankings();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Supplier Rankings</h2>
          <p className="text-sm text-gray-600">
            Performance rankings for {rankings.length} suppliers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={periodMonths.toString()}
            onValueChange={(value) => setPeriodMonths(parseInt(value))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
              <SelectItem value="24">Last 24 months</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => fetchRankings(true)}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sort Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium mr-3">Sort by:</span>
            <div className="flex gap-2">
              <Button
                variant={sortBy === 'overall' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('overall')}
              >
                Overall Rank
              </Button>
              <Button
                variant={sortBy === 'cost' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('cost')}
              >
                Cost
              </Button>
              <Button
                variant={sortBy === 'competitiveness' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('competitiveness')}
              >
                Competitiveness
              </Button>
              <Button
                variant={sortBy === 'coverage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('coverage')}
              >
                Coverage
              </Button>
              <Button
                variant={sortBy === 'quality' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortBy('quality')}
              >
                Quality
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top 3 Suppliers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sortedRankings.slice(0, 3).map((supplier, index) => (
          <Card
            key={supplier.supplierId}
            className={`${
              index === 0
                ? 'border-yellow-500 border-2'
                : index === 1
                ? 'border-gray-400 border-2'
                : 'border-amber-600 border-2'
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{supplier.supplierName}</CardTitle>
                {getRankIcon(index + 1)}
              </div>
              <CardDescription>
                Rank #{index + 1} - {sortBy === 'overall' ? 'Overall' : sortBy}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Average Rate</p>
                  <p className="text-xl font-bold">
                    ${supplier.averageRate.toFixed(0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Competitiveness</p>
                  {getCompetitivenessStars(supplier.competitivenessScore)}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Coverage:</span>
                  <span className="font-medium">
                    {supplier.geographicCoverage.countries.length} countries
                  </span>
                </div>
                <Link href={`/rate-cards/suppliers/${supplier.supplierId}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Details
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Full Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
          <CardDescription>
            Complete ranking of all suppliers based on selected criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Rank</th>
                  <th className="text-left py-3 px-4 font-medium">Supplier</th>
                  <th className="text-left py-3 px-4 font-medium">
                    Avg Rate
                  </th>
                  <th className="text-left py-3 px-4 font-medium">
                    Competitiveness
                  </th>
                  <th className="text-left py-3 px-4 font-medium">Roles</th>
                  <th className="text-left py-3 px-4 font-medium">Coverage</th>
                  <th className="text-left py-3 px-4 font-medium">
                    Potential Savings
                  </th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRankings.map((supplier, index) => (
                  <tr key={supplier.supplierId} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {index < 3 && getRankIcon(index + 1)}
                        <span className="font-medium">#{index + 1}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">{supplier.supplierName}</p>
                        <p className="text-xs text-gray-600">
                          {supplier.totalContracts} contracts
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">
                          ${supplier.averageRate.toFixed(0)}
                        </p>
                        {supplier.averageRate < supplier.marketAverage ? (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <TrendingDown className="h-3 w-3" />
                            <span>
                              {(
                                ((supplier.marketAverage - supplier.averageRate) /
                                  supplier.marketAverage) *
                                100
                              ).toFixed(0)}
                              % below market
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-red-600">
                            <TrendingUp className="h-3 w-3" />
                            <span>
                              {(
                                ((supplier.averageRate - supplier.marketAverage) /
                                  supplier.marketAverage) *
                                100
                              ).toFixed(0)}
                              % above market
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        {getCompetitivenessStars(supplier.competitivenessScore)}
                        <p className="text-xs text-gray-600 mt-1">
                          {supplier.competitivenessScore.toFixed(0)}%
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{supplier.totalRoles}</p>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium">
                          {supplier.geographicCoverage.countries.length}
                        </p>
                        <p className="text-xs text-gray-600">countries</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-green-600">
                        ${supplier.potentialSavings.toLocaleString()}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/rate-cards/suppliers/${supplier.supplierId}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Best Value Suppliers by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Best Value Suppliers</CardTitle>
          <CardDescription>
            Top performers in specific categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                <p className="font-medium text-green-900">Lowest Cost</p>
              </div>
              {sortedRankings
                .sort((a, b) => a.averageRate - b.averageRate)
                .slice(0, 1)
                .map((supplier) => (
                  <div key={supplier.supplierId}>
                    <p className="text-lg font-bold text-green-900">
                      {supplier.supplierName}
                    </p>
                    <p className="text-sm text-green-700">
                      ${supplier.averageRate.toFixed(0)} average rate
                    </p>
                  </div>
                ))}
            </div>

            <div className="p-4 bg-violet-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-violet-600" />
                <p className="font-medium text-violet-900">Most Competitive</p>
              </div>
              {sortedRankings
                .sort((a, b) => b.competitivenessScore - a.competitivenessScore)
                .slice(0, 1)
                .map((supplier) => (
                  <div key={supplier.supplierId}>
                    <p className="text-lg font-bold text-violet-900">
                      {supplier.supplierName}
                    </p>
                    <p className="text-sm text-violet-700">
                      {supplier.competitivenessScore.toFixed(0)}% score
                    </p>
                  </div>
                ))}
            </div>

            <div className="p-4 bg-violet-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-violet-600" />
                <p className="font-medium text-violet-900">Best Coverage</p>
              </div>
              {sortedRankings
                .sort(
                  (a, b) =>
                    b.geographicCoverage.countries.length -
                    a.geographicCoverage.countries.length
                )
                .slice(0, 1)
                .map((supplier) => (
                  <div key={supplier.supplierId}>
                    <p className="text-lg font-bold text-violet-900">
                      {supplier.supplierName}
                    </p>
                    <p className="text-sm text-violet-700">
                      {supplier.geographicCoverage.countries.length} countries
                    </p>
                  </div>
                ))}
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-5 w-5 text-orange-600" />
                <p className="font-medium text-orange-900">Most Diverse</p>
              </div>
              {sortedRankings
                .sort(
                  (a, b) =>
                    b.serviceLineCoverage.linesOfService.length -
                    a.serviceLineCoverage.linesOfService.length
                )
                .slice(0, 1)
                .map((supplier) => (
                  <div key={supplier.supplierId}>
                    <p className="text-lg font-bold text-orange-900">
                      {supplier.supplierName}
                    </p>
                    <p className="text-sm text-orange-700">
                      {supplier.serviceLineCoverage.linesOfService.length}{' '}
                      service lines
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
