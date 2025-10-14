'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EnhancedCard, MetricCard } from '@/components/ui/enhanced-card';
import { LoadingState } from '@/components/ui/loading-states';
import { ScoreGauge, DataPoint } from '@/components/ui/data-visualization';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, Building2, 
  Search, Filter, Download, RefreshCw, AlertCircle, CheckCircle,
  Globe, MapPin, Award, Briefcase, Target, Layers, BarChart3,
  Brain, Zap, Star, TrendingFlat
} from 'lucide-react';

interface EnhancedAnalytics {
  lineOfServiceAnalytics: {
    serviceBreakdown: Array<{
      service: string;
      serviceCategory: string;
      averageRate: number;
      rateCount: number;
      marketPosition: number;
      trendDirection: string;
      topRoles: string[];
    }>;
    totalServices: number;
    avgRateAcrossServices: number;
  };
  seniorityAnalytics: {
    seniorityProgression: Array<{
      level: string;
      levelOrder: number;
      averageRate: number;
      rateCount: number;
      progressionGap?: number;
    }>;
    totalLevels: number;
    avgProgressionIncrease: number;
  };
  geographicAnalytics: {
    locationBreakdown: Array<{
      location: {
        country: string;
        stateProvince?: string;
        city?: string;
      };
      averageRate: number;
      adjustedRate: number;
      marketCompetitiveness: number;
      costAdvantage: number;
      rateCount: number;
    }>;
    totalLocations: number;
    avgCostOfLiving: number;
  };
  skillPremiumAnalytics: {
    skillBreakdown: Array<{
      skill: string;
      category: string;
      averagePremium: number;
      marketDemand: string;
      rateCount: number;
      topRoles: string[];
    }>;
    certificationValue: Array<{
      certification: string;
      averagePremium: number;
      marketValue: string;
      rateCount: number;
    }>;
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function EnhancedRateIntelligencePage() {
  const [analytics, setAnalytics] = useState<EnhancedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    tenantId: 'default',
    lineOfService: '',
    country: '',
    seniorityLevel: '',
    role: '',
    engagementModel: ''
  });
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchEnhancedAnalytics();
  }, [filters]);

  const fetchEnhancedAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const response = await fetch(`/api/analytics/enhanced-rate-analytics?action=comprehensive&${queryParams}`);
      const result = await response.json();

      if (result.success) {
        setAnalytics(result.data);
      } else {
        setError(result.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      setError('Failed to fetch enhanced analytics');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <TrendingFlat className="h-4 w-4 text-gray-500" />;
    }
  };

  const getMarketDemandColor = (demand: string) => {
    switch (demand) {
      case 'Critical': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <LoadingState message="Loading enhanced rate intelligence..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
            <Button onClick={fetchEnhancedAnalytics} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Enhanced Rate Intelligence</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive multi-dimensional analytics for rate card data
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={fetchEnhancedAnalytics} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Select value={filters.lineOfService} onValueChange={(value) => setFilters({...filters, lineOfService: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Line of Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Services</SelectItem>
                <SelectItem value="Software Development">Software Development</SelectItem>
                <SelectItem value="Cloud Infrastructure">Cloud Infrastructure</SelectItem>
                <SelectItem value="Data Analytics">Data Analytics</SelectItem>
                <SelectItem value="Cybersecurity">Cybersecurity</SelectItem>
                <SelectItem value="Management Consulting">Management Consulting</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.country} onValueChange={(value) => setFilters({...filters, country: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Countries</SelectItem>
                <SelectItem value="USA">United States</SelectItem>
                <SelectItem value="CAN">Canada</SelectItem>
                <SelectItem value="GBR">United Kingdom</SelectItem>
                <SelectItem value="IND">India</SelectItem>
                <SelectItem value="AUS">Australia</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.seniorityLevel} onValueChange={(value) => setFilters({...filters, seniorityLevel: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Seniority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Levels</SelectItem>
                <SelectItem value="Junior">Junior</SelectItem>
                <SelectItem value="Mid-Level">Mid-Level</SelectItem>
                <SelectItem value="Senior">Senior</SelectItem>
                <SelectItem value="Lead">Lead</SelectItem>
                <SelectItem value="Principal">Principal</SelectItem>
                <SelectItem value="Director">Director</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.engagementModel} onValueChange={(value) => setFilters({...filters, engagementModel: value})}>
              <SelectTrigger>
                <SelectValue placeholder="Engagement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Models</SelectItem>
                <SelectItem value="Staff Augmentation">Staff Augmentation</SelectItem>
                <SelectItem value="Project">Project</SelectItem>
                <SelectItem value="Outcome">Outcome</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Role"
              value={filters.role}
              onChange={(e) => setFilters({...filters, role: e.target.value})}
            />

            <Button onClick={fetchEnhancedAnalytics} className="w-full">
              <Search className="h-4 w-4 mr-2" />
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Services"
            value={analytics.lineOfServiceAnalytics.totalServices}
            icon={<Layers className="h-5 w-5" />}
            trend={{ value: 12, isPositive: true }}
          />
          <MetricCard
            title="Avg Rate Across Services"
            value={`$${analytics.lineOfServiceAnalytics.avgRateAcrossServices.toFixed(0)}`}
            icon={<DollarSign className="h-5 w-5" />}
            trend={{ value: 8.5, isPositive: true }}
          />
          <MetricCard
            title="Seniority Levels"
            value={analytics.seniorityAnalytics.totalLevels}
            icon={<Target className="h-5 w-5" />}
            trend={{ value: 0, isPositive: true }}
          />
          <MetricCard
            title="Geographic Locations"
            value={analytics.geographicAnalytics.totalLocations}
            icon={<Globe className="h-5 w-5" />}
            trend={{ value: 15, isPositive: true }}
          />
        </div>
      )}

      {/* Main Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Line of Service</TabsTrigger>
          <TabsTrigger value="seniority">Seniority Analysis</TabsTrigger>
          <TabsTrigger value="geography">Geographic Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Service Category Distribution */}
              <EnhancedCard title="Service Category Distribution" icon={<BarChart3 />}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.lineOfServiceAnalytics.serviceBreakdown.slice(0, 6)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ service, averageRate }) => `${service}: $${averageRate.toFixed(0)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="averageRate"
                    >
                      {analytics.lineOfServiceAnalytics.serviceBreakdown.slice(0, 6).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`$${value}`, 'Average Rate']} />
                  </PieChart>
                </ResponsiveContainer>
              </EnhancedCard>

              {/* Seniority Progression */}
              <EnhancedCard title="Seniority Progression" icon={<TrendingUp />}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.seniorityAnalytics.seniorityProgression}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="level" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value}`, 'Average Rate']} />
                    <Area type="monotone" dataKey="averageRate" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </EnhancedCard>
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          {analytics && (
            <>
              {/* Service Breakdown Chart */}
              <EnhancedCard title="Line of Service Analysis" icon={<Briefcase />}>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.lineOfServiceAnalytics.serviceBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="service" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="averageRate" fill="#8884d8" name="Average Rate ($)" />
                    <Bar dataKey="rateCount" fill="#82ca9d" name="Rate Count" />
                  </BarChart>
                </ResponsiveContainer>
              </EnhancedCard>

              {/* Service Details Table */}
              <EnhancedCard title="Service Details" icon={<Layers />}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Service</th>
                        <th className="text-left p-2">Category</th>
                        <th className="text-right p-2">Avg Rate</th>
                        <th className="text-right p-2">Rate Count</th>
                        <th className="text-center p-2">Market Position</th>
                        <th className="text-center p-2">Trend</th>
                        <th className="text-left p-2">Top Roles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.lineOfServiceAnalytics.serviceBreakdown.map((service, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium">{service.service}</td>
                          <td className="p-2">
                            <Badge variant="outline">{service.serviceCategory}</Badge>
                          </td>
                          <td className="p-2 text-right">${service.averageRate.toFixed(0)}</td>
                          <td className="p-2 text-right">{service.rateCount}</td>
                          <td className="p-2 text-center">
                            <ScoreGauge score={service.marketPosition} size="sm" />
                          </td>
                          <td className="p-2 text-center">
                            {getTrendIcon(service.trendDirection)}
                          </td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {service.topRoles.slice(0, 2).map((role, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </EnhancedCard>
            </>
          )}
        </TabsContent>

        <TabsContent value="seniority" className="space-y-6">
          {analytics && (
            <>
              {/* Seniority Progression Chart */}
              <EnhancedCard title="Career Progression Analysis" icon={<Target />}>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={analytics.seniorityAnalytics.seniorityProgression}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="level" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="averageRate" stroke="#8884d8" strokeWidth={3} name="Average Rate ($)" />
                    <Line type="monotone" dataKey="rateCount" stroke="#82ca9d" strokeWidth={2} name="Rate Count" />
                  </LineChart>
                </ResponsiveContainer>
              </EnhancedCard>

              {/* Progression Gaps */}
              <EnhancedCard title="Progression Analysis" icon={<BarChart3 />}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {analytics.seniorityAnalytics.seniorityProgression.map((level, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">{level.level}</h4>
                        <Badge variant="outline">Level {level.levelOrder}</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Avg Rate:</span>
                          <span className="font-medium">${level.averageRate.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Rate Count:</span>
                          <span>{level.rateCount}</span>
                        </div>
                        {level.progressionGap && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Next Level Gap:</span>
                            <span className={level.progressionGap > 0 ? 'text-green-600' : 'text-red-600'}>
                              ${Math.abs(level.progressionGap).toFixed(0)}
                            </span>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </EnhancedCard>
            </>
          )}
        </TabsContent>

        <TabsContent value="geography" className="space-y-6">
          {analytics && (
            <>
              {/* Geographic Distribution */}
              <EnhancedCard title="Geographic Rate Distribution" icon={<Globe />}>
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart data={analytics.geographicAnalytics.locationBreakdown}>
                    <CartesianGrid />
                    <XAxis dataKey="averageRate" name="Average Rate" unit="$" />
                    <YAxis dataKey="costAdvantage" name="Cost Advantage" unit="%" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter name="Locations" data={analytics.geographicAnalytics.locationBreakdown} fill="#8884d8" />
                  </ScatterChart>
                </ResponsiveContainer>
              </EnhancedCard>

              {/* Location Details */}
              <EnhancedCard title="Location Analysis" icon={<MapPin />}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Location</th>
                        <th className="text-right p-2">Avg Rate</th>
                        <th className="text-right p-2">Adjusted Rate</th>
                        <th className="text-right p-2">Cost Advantage</th>
                        <th className="text-right p-2">Competitiveness</th>
                        <th className="text-right p-2">Rate Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.geographicAnalytics.locationBreakdown.map((location, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <div className="flex items-center space-x-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span>
                                {location.location.city && `${location.location.city}, `}
                                {location.location.stateProvince && `${location.location.stateProvince}, `}
                                {location.location.country}
                              </span>
                            </div>
                          </td>
                          <td className="p-2 text-right">${location.averageRate.toFixed(0)}</td>
                          <td className="p-2 text-right">${location.adjustedRate.toFixed(0)}</td>
                          <td className="p-2 text-right">
                            <span className={location.costAdvantage > 0 ? 'text-green-600' : 'text-red-600'}>
                              {location.costAdvantage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-2 text-right">
                            <ScoreGauge score={Math.abs(location.marketCompetitiveness)} size="sm" />
                          </td>
                          <td className="p-2 text-right">{location.rateCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </EnhancedCard>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Skills & Certifications Analysis */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Skills */}
          <EnhancedCard title="High-Value Skills" icon={<Brain />}>
            <div className="space-y-3">
              {analytics.skillPremiumAnalytics.skillBreakdown.slice(0, 8).map((skill, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Award className="h-4 w-4 text-blue-500" />
                    <div>
                      <span className="font-medium">{skill.skill}</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">{skill.category}</Badge>
                        <Badge className={`text-xs ${getMarketDemandColor(skill.marketDemand)}`}>
                          {skill.marketDemand}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">+{skill.averagePremium.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500">{skill.rateCount} rates</div>
                  </div>
                </div>
              ))}
            </div>
          </EnhancedCard>

          {/* Top Certifications */}
          <EnhancedCard title="Valuable Certifications" icon={<Star />}>
            <div className="space-y-3">
              {analytics.skillPremiumAnalytics.certificationValue.slice(0, 8).map((cert, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <div>
                      <span className="font-medium text-sm">{cert.certification}</span>
                      <div className="mt-1">
                        <Badge className={`text-xs ${getMarketDemandColor(cert.marketValue)}`}>
                          {cert.marketValue} Value
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">+{cert.averagePremium.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500">{cert.rateCount} rates</div>
                  </div>
                </div>
              ))}
            </div>
          </EnhancedCard>
        </div>
      )}
    </div>
  );
}