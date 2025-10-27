'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Globe, Users, BarChart3 } from 'lucide-react';

interface MarketIntelligenceProps {
  tenantId: string;
}

export function MarketIntelligenceDashboard({ tenantId }: MarketIntelligenceProps) {
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedSeniority, setSelectedSeniority] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [periodMonths, setPeriodMonths] = useState<number>(12);
  const [intelligence, setIntelligence] = useState<any>(null);
  const [trendingRoles, setTrendingRoles] = useState<any[]>([]);
  const [supplierRankings, setSupplierRankings] = useState<any[]>([]);
  const [emergingTrends, setEmergingTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMarketIntelligence();
  }, [selectedRole, selectedSeniority, selectedCountry, periodMonths]);

  useEffect(() => {
    loadTrendingRoles();
    loadSupplierRankings();
    loadEmergingTrends();
  }, [periodMonths]);

  const loadMarketIntelligence = async () => {
    if (!selectedRole || !selectedSeniority) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        role: selectedRole,
        seniority: selectedSeniority,
        periodMonths: periodMonths.toString(),
      });
      if (selectedCountry) params.append('country', selectedCountry);

      const response = await fetch(`/api/rate-cards/market-intelligence?${params}`);
      const data = await response.json();
      setIntelligence(data);
    } catch (error) {
      console.error('Error loading market intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrendingRoles = async () => {
    try {
      const response = await fetch(`/api/rate-cards/market-intelligence/trending?periodMonths=${periodMonths}`);
      const data = await response.json();
      setTrendingRoles(data);
    } catch (error) {
      console.error('Error loading trending roles:', error);
    }
  };

  const loadSupplierRankings = async () => {
    try {
      const response = await fetch(`/api/rate-cards/market-intelligence/suppliers?periodMonths=${periodMonths}`);
      const data = await response.json();
      setSupplierRankings(data);
    } catch (error) {
      console.error('Error loading supplier rankings:', error);
    }
  };

  const loadEmergingTrends = async () => {
    try {
      const response = await fetch(`/api/rate-cards/market-intelligence/trends`);
      const data = await response.json();
      setEmergingTrends(data);
    } catch (error) {
      console.error('Error loading emerging trends:', error);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'UP':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'DOWN':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'default';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Market Intelligence</h1>
        <p className="text-muted-foreground">
          Comprehensive market insights, trends, and competitive analysis
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select criteria to view market intelligence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Senior Consultant">Senior Consultant</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Director">Director</SelectItem>
                  <SelectItem value="Partner">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Seniority</label>
              <Select value={selectedSeniority} onValueChange={setSelectedSeniority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select seniority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JUNIOR">Junior</SelectItem>
                  <SelectItem value="MID">Mid</SelectItem>
                  <SelectItem value="SENIOR">Senior</SelectItem>
                  <SelectItem value="PRINCIPAL">Principal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Country</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="All countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All countries</SelectItem>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                  <SelectItem value="Germany">Germany</SelectItem>
                  <SelectItem value="India">India</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Time Period</label>
              <Select value={periodMonths.toString()} onValueChange={(v) => setPeriodMonths(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Last 3 months</SelectItem>
                  <SelectItem value="6">Last 6 months</SelectItem>
                  <SelectItem value="12">Last 12 months</SelectItem>
                  <SelectItem value="24">Last 24 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trending">Trending Roles</TabsTrigger>
          <TabsTrigger value="suppliers">Supplier Rankings</TabsTrigger>
          <TabsTrigger value="trends">Emerging Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {intelligence ? (
            <>
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${intelligence.statistics.mean.toFixed(0)}</div>
                    <p className="text-xs text-muted-foreground">per day</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Median Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${intelligence.statistics.median.toFixed(0)}</div>
                    <p className="text-xs text-muted-foreground">per day</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Sample Size</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{intelligence.statistics.sampleSize}</div>
                    <p className="text-xs text-muted-foreground">data points</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Market Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(intelligence.trend.direction)}
                      <span className="text-2xl font-bold">{intelligence.trend.direction}</span>
                    </div>
                    {intelligence.trend.yearOverYear && (
                      <p className="text-xs text-muted-foreground">
                        {intelligence.trend.yearOverYear > 0 ? '+' : ''}
                        {intelligence.trend.yearOverYear.toFixed(1)}% YoY
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Percentile Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Rate Distribution</CardTitle>
                  <CardDescription>Percentile breakdown of market rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-5 gap-4 text-center">
                      <div>
                        <div className="text-sm text-muted-foreground">P10</div>
                        <div className="text-lg font-semibold">${intelligence.statistics.p10.toFixed(0)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">P25</div>
                        <div className="text-lg font-semibold">${intelligence.statistics.p25.toFixed(0)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">P50</div>
                        <div className="text-lg font-semibold">${intelligence.statistics.p50.toFixed(0)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">P75</div>
                        <div className="text-lg font-semibold">${intelligence.statistics.p75.toFixed(0)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">P90</div>
                        <div className="text-lg font-semibold">${intelligence.statistics.p90.toFixed(0)}</div>
                      </div>
                    </div>
                    <div className="h-2 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full" />
                  </div>
                </CardContent>
              </Card>

              {/* Top Suppliers */}
              <Card>
                <CardHeader>
                  <CardTitle>Most Competitive Suppliers</CardTitle>
                  <CardDescription>Suppliers with the lowest average rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {intelligence.topSuppliers.map((supplier: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{supplier.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {supplier.sampleSize} rate{supplier.sampleSize !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${supplier.averageRate.toFixed(0)}/day</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>Market Insights</CardTitle>
                  <CardDescription>AI-generated insights and recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {intelligence.insights.map((insight: string, index: number) => (
                      <div key={index} className="flex gap-3 p-3 bg-muted rounded-lg">
                        <BarChart3 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-sm">{insight}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              {intelligence.recommendations && intelligence.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                    <CardDescription>Actionable steps based on market analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {intelligence.recommendations.map((rec: string, index: number) => (
                        <div key={index} className="flex gap-3 p-3 border-l-4 border-primary bg-primary/5 rounded">
                          <p className="text-sm">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Select a role and seniority to view market intelligence
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trending Roles Tab */}
        <TabsContent value="trending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trending Roles</CardTitle>
              <CardDescription>Roles with significant rate changes</CardDescription>
            </CardHeader>
            <CardContent>
              {trendingRoles.length > 0 ? (
                <div className="space-y-3">
                  {trendingRoles.map((role, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{role.role}</span>
                          <Badge variant="outline">{role.seniority}</Badge>
                          <Badge variant="secondary">{role.country}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {role.lineOfService} • {role.sampleSize} data points
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end mb-1">
                          {getTrendIcon(role.trend)}
                          <span className={`font-semibold ${role.trend === 'UP' ? 'text-red-500' : 'text-green-500'}`}>
                            {role.changePercent > 0 ? '+' : ''}{role.changePercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ${role.currentAverage.toFixed(0)}/day
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No trending roles found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supplier Rankings Tab */}
        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Competitiveness Rankings</CardTitle>
              <CardDescription>Suppliers ranked by overall competitiveness</CardDescription>
            </CardHeader>
            <CardContent>
              {supplierRankings.length > 0 ? (
                <div className="space-y-3">
                  {supplierRankings.slice(0, 10).map((supplier) => (
                    <div key={supplier.supplierId} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                          #{supplier.rank}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{supplier.supplierName}</span>
                            <Badge variant="outline">{supplier.supplierTier}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {supplier.rolesCovered} roles • {supplier.countriesCovered} countries • {supplier.rateCount} rates
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold mb-1">
                          Score: {supplier.competitivenessScore.toFixed(0)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Avg: ${supplier.averageRate.toFixed(0)}/day
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No supplier rankings available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emerging Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Emerging Trends</CardTitle>
              <CardDescription>Detected market shifts and opportunities</CardDescription>
            </CardHeader>
            <CardContent>
              {emergingTrends.length > 0 ? (
                <div className="space-y-3">
                  {emergingTrends.map((trend, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-3 mb-2">
                        <AlertTriangle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                          trend.severity === 'HIGH' ? 'text-red-500' : 
                          trend.severity === 'MEDIUM' ? 'text-yellow-500' : 
                          'text-blue-500'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{trend.title}</span>
                            <Badge variant={getSeverityColor(trend.severity)}>{trend.severity}</Badge>
                            <Badge variant="outline">{trend.type.replace('_', ' ')}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{trend.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {trend.affectedRoles && (
                              <span>Roles: {trend.affectedRoles.join(', ')}</span>
                            )}
                            {trend.affectedCountries && (
                              <span>Countries: {trend.affectedCountries.join(', ')}</span>
                            )}
                            {trend.changePercent && (
                              <span>Change: {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%</span>
                            )}
                          </div>
                          <div className="mt-2 p-2 bg-muted rounded text-sm">
                            <strong>Recommendation:</strong> {trend.recommendation}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No emerging trends detected</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
