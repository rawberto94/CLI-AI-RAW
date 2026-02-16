/**
 * Rate Card Benchmarking Dashboard
 * Main dashboard with KPIs, charts, and insights
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  AlertCircle,
  FileText,
  Globe,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';

interface DashboardStats {
  totalRateCards: number;
  totalSuppliers: number;
  totalAnnualSpend: number;
  totalSavingsIdentified: number;
  totalSavingsRealized: number;
  avgRateVsMarket: number;
  ratesAboveMarket: number;
  ratesNegotiated: number;
  geographicCoverage: number;
  serviceLinesCovered: number;
}

interface TrendingRole {
  role: string;
  seniority: string;
  currentAvg: number;
  previousAvg: number;
  change: number;
  direction: 'up' | 'down';
  sampleSize: number;
}

interface TopSupplier {
  id: string;
  name: string;
  tier: string;
  competitivenessScore: number;
  averageRate: number;
  marketPosition: string;
  totalRoles: number;
}

interface SavingsOpportunity {
  id: string;
  title: string;
  category: string;
  annualSavings: number;
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
}

export function RateCardDashboard() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [trendingRoles, setTrendingRoles] = React.useState<TrendingRole[]>([]);
  const [topSuppliers, setTopSuppliers] = React.useState<TopSupplier[]>([]);
  const [opportunities, setOpportunities] = React.useState<SavingsOpportunity[]>([]);

  React.useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    // Load all dashboard data
    const [statsData, rolesData, suppliersData, oppsData] = await Promise.all([
      fetch('/api/rate-cards/stats').then(r => r.json()),
      fetch('/api/rate-cards/trending').then(r => r.json()),
      fetch('/api/suppliers/top').then(r => r.json()),
      fetch('/api/opportunities?status=IDENTIFIED&limit=5').then(r => r.json()),
    ]);

    setStats(statsData.data);
    setTrendingRoles(rolesData.data);
    setTopSuppliers(suppliersData.data);
    setOpportunities(oppsData.data.opportunities);
  };

  if (!stats) {
    return <div>Loading...</div>;
  }

  const savingsRealizationRate = (stats.totalSavingsRealized / stats.totalSavingsIdentified) * 100;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rate Card Benchmarking</h1>
          <p className="text-gray-600 mt-1">
            AI-powered insights to optimize your procurement spend
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button className="bg-gradient-to-r from-violet-600 to-purple-600">
            <Sparkles className="w-4 h-4 mr-2" />
            Add Rate Card
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Rate Cards */}
        <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-600">Total Rate Cards</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.totalRateCards.toLocaleString()}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="bg-white">
                    {stats.totalSuppliers} suppliers
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-violet-600 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Annual Spend */}
        <Card className="bg-gradient-to-br from-violet-50 to-violet-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Annual Spend</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">
                  ${(stats.totalAnnualSpend / 1000000).toFixed(1)}M
                </h3>
                <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                  <TrendingDown className="w-4 h-4" />
                  <span>12% below market avg</span>
                </div>
              </div>
              <div className="p-3 bg-green-600 rounded-lg">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Savings Identified */}
        <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Savings Identified</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">
                  ${(stats.totalSavingsIdentified / 1000000).toFixed(2)}M
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                      style={{ width: `${savingsRealizationRate}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600">
                    {savingsRealizationRate.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="p-3 bg-orange-600 rounded-lg">
                <Target className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Market Position */}
        <Card className="bg-gradient-to-br from-violet-50 to-pink-50 border-violet-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-600">Market Position</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-2">
                  {stats.avgRateVsMarket > 0 ? '+' : ''}{stats.avgRateVsMarket.toFixed(1)}%
                </h3>
                <p className="text-xs text-gray-600 mt-2">
                  {stats.ratesAboveMarket} rates above market
                </p>
              </div>
              <div className="p-3 bg-violet-600 rounded-lg">
                <Award className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trending Roles */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-600" />
              Market Trends - Roles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trendingRoles.map((role, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-gray-900">
                        {role.role}
                      </h4>
                      <Badge variant="outline">
                        {role.seniority}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Sample size: {role.sampleSize} rates
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      ${role.currentAvg.toLocaleString()}
                      <span className="text-sm text-gray-500">/day</span>
                    </div>
                    <div className={`flex items-center gap-1 justify-end mt-1 ${
                      role.direction === 'up' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {role.direction === 'up' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {Math.abs(role.change).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Savings Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              Top Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {opportunities.map((opp, idx) => (
                <div key={opp.id} className="p-3 bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-semibold text-sm text-gray-900 truncate">
                        {opp.title}
                      </h5>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="bg-white text-xs">
                          {opp.category}
                        </Badge>
                        <span className="text-xs text-gray-600">
                          {opp.effort} effort
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-lg font-bold text-orange-600">
                      ${((opp as any).annualSavingsPotential / 1000).toFixed(0)}K
                      <span className="text-xs text-gray-600">/year</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {(opp.confidence * 100).toFixed(0)}% confidence
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full">
                View All Opportunities
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supplier Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-600" />
            Top Suppliers by Competitiveness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {topSuppliers.map((supplier) => (
              <Card key={supplier.id} className="bg-gradient-to-br from-violet-50 to-purple-50 border-indigo-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">
                        {supplier.name}
                      </h4>
                      <Badge variant="outline" className="bg-white mt-1">
                        {supplier.tier}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Award
                          key={i}
                          className={`w-3 h-3 ${
                            i < Math.round(supplier.competitivenessScore)
                              ? 'text-yellow-500 fill-yellow-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Rate:</span>
                      <span className="font-semibold">${supplier.averageRate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Roles:</span>
                      <span className="font-semibold">{supplier.totalRoles}</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`w-full justify-center ${
                        supplier.marketPosition === 'COMPETITIVE' 
                          ? 'bg-green-100 text-green-700 border-green-300'
                          : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                      }`}
                    >
                      {supplier.marketPosition}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Globe className="w-8 h-8 text-violet-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.geographicCoverage}</div>
            <div className="text-sm text-gray-600">Countries</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.serviceLinesCovered}</div>
            <div className="text-sm text-gray-600">Service Lines</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{stats.ratesNegotiated}</div>
            <div className="text-sm text-gray-600">Negotiated Rates</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="w-8 h-8 text-violet-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {((stats.totalRateCards - stats.ratesAboveMarket) / stats.totalRateCards * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Below Market</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
