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
  Star,
  TrendingUp,
  TrendingDown,
  Award,
  DollarSign,
  MapPin,
  Briefcase,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

interface SupplierMetrics {
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

interface SupplierComparisonViewProps {
  supplierIds: string[];
  onRemoveSupplier?: (supplierId: string) => void;
}

export function SupplierComparisonView({
  supplierIds,
  onRemoveSupplier,
}: SupplierComparisonViewProps) {
  const [suppliers, setSuppliers] = useState<SupplierMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoading(true);
        setError(null);

        const promises = supplierIds.map((id) =>
          fetch(`/api/rate-cards/suppliers/${id}/scorecard`).then((res) =>
            res.json()
          )
        );

        const results = await Promise.all(promises);
        const scorecards = results.map((r) => r.scorecard);
        setSuppliers(scorecards);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (supplierIds.length > 0) {
      fetchSuppliers();
    }
  }, [supplierIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  if (error || suppliers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-600">
            {error || 'No suppliers selected for comparison'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getCompetitivenessRating = (score: number) => {
    if (score >= 80) return { stars: 5, label: 'Excellent' };
    if (score >= 60) return { stars: 4, label: 'Good' };
    if (score >= 40) return { stars: 3, label: 'Average' };
    if (score >= 20) return { stars: 2, label: 'Below Average' };
    return { stars: 1, label: 'Poor' };
  };

  const bestRate = Math.min(...suppliers.map((s) => s.averageRate));
  const bestCompetitiveness = Math.max(
    ...suppliers.map((s) => s.competitivenessScore)
  );
  const bestCoverage = Math.max(
    ...suppliers.map((s) => s.geographicCoverage.coverageScore)
  );
  const bestDiversity = Math.max(
    ...suppliers.map((s) => s.serviceLineCoverage.diversityScore)
  );

  // Prepare data for charts
  const rateComparisonData = suppliers.map((s) => ({
    name: s.supplierName,
    'Average Rate': s.averageRate,
    'Market Average': s.marketAverage,
  }));

  const radarData = [
    {
      metric: 'Competitiveness',
      ...Object.fromEntries(
        suppliers.map((s) => [s.supplierName, s.competitivenessScore])
      ),
    },
    {
      metric: 'Geographic Coverage',
      ...Object.fromEntries(
        suppliers.map((s) => [
          s.supplierName,
          s.geographicCoverage.coverageScore,
        ])
      ),
    },
    {
      metric: 'Service Diversity',
      ...Object.fromEntries(
        suppliers.map((s) => [
          s.supplierName,
          s.serviceLineCoverage.diversityScore,
        ])
      ),
    },
    {
      metric: 'Data Quality',
      ...Object.fromEntries(
        suppliers.map((s) => [s.supplierName, s.dataQualityScore])
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Supplier Comparison</h2>
        <p className="text-sm text-gray-600">
          Comparing {suppliers.length} suppliers across key performance metrics
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {suppliers.map((supplier) => (
          <Card key={supplier.supplierId}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{supplier.supplierName}</CardTitle>
                {onRemoveSupplier && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveSupplier(supplier.supplierId)}
                    className="h-6 w-6 p-0"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Average Rate</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-bold">
                      ${supplier.averageRate.toFixed(0)}
                    </p>
                    {supplier.averageRate === bestRate && (
                      <Badge variant="default" className="text-xs">
                        Best
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Competitiveness</p>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i <
                            getCompetitivenessRating(
                              supplier.competitivenessScore
                            ).stars
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs">
                      {supplier.competitivenessScore.toFixed(0)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Coverage</p>
                  <p className="text-sm font-medium">
                    {supplier.geographicCoverage.countries.length} countries
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Rate Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Comparison</CardTitle>
          <CardDescription>
            Average rates compared to market average
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={rateComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => `$${value.toFixed(0)}`} />
              <Legend />
              <Bar dataKey="Average Rate" fill="#3b82f6" />
              <Bar dataKey="Market Average" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
          <CardDescription>
            Multi-dimensional performance comparison
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              {suppliers.map((supplier, index) => (
                <Radar
                  key={supplier.supplierId}
                  name={supplier.supplierName}
                  dataKey={supplier.supplierName}
                  stroke={
                    ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][
                      index % 5
                    ]
                  }
                  fill={
                    ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][
                      index % 5
                    ]
                  }
                  fillOpacity={0.3}
                />
              ))}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Metric</th>
                  {suppliers.map((supplier) => (
                    <th
                      key={supplier.supplierId}
                      className="text-left py-3 px-4 font-medium"
                    >
                      {supplier.supplierName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4 text-sm">Average Rate</td>
                  {suppliers.map((supplier) => (
                    <td key={supplier.supplierId} className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          ${supplier.averageRate.toFixed(0)}
                        </span>
                        {supplier.averageRate === bestRate && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                <tr className="border-b">
                  <td className="py-3 px-4 text-sm">Competitiveness Score</td>
                  {suppliers.map((supplier) => (
                    <td key={supplier.supplierId} className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {supplier.competitivenessScore.toFixed(0)}
                        </span>
                        {supplier.competitivenessScore ===
                          bestCompetitiveness && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                <tr className="border-b">
                  <td className="py-3 px-4 text-sm">Total Roles</td>
                  {suppliers.map((supplier) => (
                    <td
                      key={supplier.supplierId}
                      className="py-3 px-4 font-medium"
                    >
                      {supplier.totalRoles}
                    </td>
                  ))}
                </tr>

                <tr className="border-b">
                  <td className="py-3 px-4 text-sm">Total Contracts</td>
                  {suppliers.map((supplier) => (
                    <td
                      key={supplier.supplierId}
                      className="py-3 px-4 font-medium"
                    >
                      {supplier.totalContracts}
                    </td>
                  ))}
                </tr>

                <tr className="border-b">
                  <td className="py-3 px-4 text-sm">Geographic Coverage</td>
                  {suppliers.map((supplier) => (
                    <td key={supplier.supplierId} className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {supplier.geographicCoverage.countries.length}{' '}
                          countries
                        </span>
                        {supplier.geographicCoverage.coverageScore ===
                          bestCoverage && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                <tr className="border-b">
                  <td className="py-3 px-4 text-sm">Service Line Diversity</td>
                  {suppliers.map((supplier) => (
                    <td key={supplier.supplierId} className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {supplier.serviceLineCoverage.linesOfService.length}{' '}
                          services
                        </span>
                        {supplier.serviceLineCoverage.diversityScore ===
                          bestDiversity && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                <tr className="border-b">
                  <td className="py-3 px-4 text-sm">Data Quality Score</td>
                  {suppliers.map((supplier) => (
                    <td
                      key={supplier.supplierId}
                      className="py-3 px-4 font-medium"
                    >
                      {supplier.dataQualityScore.toFixed(0)}%
                    </td>
                  ))}
                </tr>

                <tr className="border-b">
                  <td className="py-3 px-4 text-sm">Total Annual Value</td>
                  {suppliers.map((supplier) => (
                    <td
                      key={supplier.supplierId}
                      className="py-3 px-4 font-medium"
                    >
                      ${supplier.totalAnnualValue.toLocaleString()}
                    </td>
                  ))}
                </tr>

                <tr className="border-b">
                  <td className="py-3 px-4 text-sm">Potential Savings</td>
                  {suppliers.map((supplier) => (
                    <td
                      key={supplier.supplierId}
                      className="py-3 px-4 font-medium text-green-600"
                    >
                      ${supplier.potentialSavings.toLocaleString()}
                    </td>
                  ))}
                </tr>

                {suppliers.some((s) => s.costRank) && (
                  <tr className="border-b">
                    <td className="py-3 px-4 text-sm">Cost Rank</td>
                    {suppliers.map((supplier) => (
                      <td
                        key={supplier.supplierId}
                        className="py-3 px-4 font-medium"
                      >
                        #{supplier.costRank || 'N/A'}
                      </td>
                    ))}
                  </tr>
                )}

                {suppliers.some((s) => s.overallRank) && (
                  <tr>
                    <td className="py-3 px-4 text-sm">Overall Rank</td>
                    {suppliers.map((supplier) => (
                      <td
                        key={supplier.supplierId}
                        className="py-3 px-4 font-medium"
                      >
                        #{supplier.overallRank || 'N/A'}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {suppliers
              .sort((a, b) => a.averageRate - b.averageRate)
              .slice(0, 1)
              .map((supplier) => (
                <div
                  key={supplier.supplierId}
                  className="flex items-start gap-3 p-3 bg-green-50 rounded-lg"
                >
                  <Award className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">
                      Best Value: {supplier.supplierName}
                    </p>
                    <p className="text-sm text-green-700">
                      Offers the lowest average rate at $
                      {supplier.averageRate.toFixed(0)} with{' '}
                      {supplier.competitivenessScore.toFixed(0)}%
                      competitiveness score
                    </p>
                  </div>
                </div>
              ))}

            {suppliers
              .sort((a, b) => b.competitivenessScore - a.competitivenessScore)
              .slice(0, 1)
              .map((supplier) => (
                <div
                  key={supplier.supplierId}
                  className="flex items-start gap-3 p-3 bg-violet-50 rounded-lg"
                >
                  <Star className="h-5 w-5 text-violet-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-violet-900">
                      Most Competitive: {supplier.supplierName}
                    </p>
                    <p className="text-sm text-violet-700">
                      Highest competitiveness score of{' '}
                      {supplier.competitivenessScore.toFixed(0)}% with strong
                      market positioning
                    </p>
                  </div>
                </div>
              ))}

            {suppliers
              .sort(
                (a, b) =>
                  b.geographicCoverage.countries.length -
                  a.geographicCoverage.countries.length
              )
              .slice(0, 1)
              .map((supplier) => (
                <div
                  key={supplier.supplierId}
                  className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg"
                >
                  <MapPin className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-purple-900">
                      Best Coverage: {supplier.supplierName}
                    </p>
                    <p className="text-sm text-purple-700">
                      Operates in {supplier.geographicCoverage.countries.length}{' '}
                      countries with the widest geographic reach
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
