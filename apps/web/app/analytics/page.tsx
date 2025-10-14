'use client'

import React from 'react'
import PerformanceAnalytics from '@/components/analytics/PerformanceAnalytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Target,
  Zap,
  Shield,
  DollarSign
} from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics & Performance</h1>
              <p className="text-gray-600">
                Comprehensive insights into your contract intelligence platform performance
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="usage" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usage
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Intelligence
            </TabsTrigger>
            <TabsTrigger value="business" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Business Impact
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-6">
            <PerformanceAnalytics />
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-blue-500" />
                    Active Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">247</div>
                  <div className="text-sm text-muted-foreground">+12% from last month</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-green-500" />
                    Avg Session Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">24m</div>
                  <div className="text-sm text-muted-foreground">+8% from last month</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    Daily Uploads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,234</div>
                  <div className="text-sm text-muted-foreground">+23% from last month</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-orange-500" />
                    Feature Adoption
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">89%</div>
                  <div className="text-sm text-muted-foreground">+5% from last month</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Usage Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Contract Upload & Analysis</span>
                    <span className="text-sm text-muted-foreground">45% of total usage</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Risk Assessment</span>
                    <span className="text-sm text-muted-foreground">28% of total usage</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-red-600 h-2 rounded-full" style={{ width: '28%' }}></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Compliance Monitoring</span>
                    <span className="text-sm text-muted-foreground">18% of total usage</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '18%' }}></div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Reporting & Analytics</span>
                    <span className="text-sm text-muted-foreground">9% of total usage</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: '9%' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="intelligence" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-green-500" />
                    AI Accuracy Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">94.7%</div>
                  <div className="text-sm text-muted-foreground">Above 95% target</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-red-500" />
                    Risks Detected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,847</div>
                  <div className="text-sm text-muted-foreground">This month</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Opportunities Found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">423</div>
                  <div className="text-sm text-muted-foreground">This month</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Intelligence Model Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Risk Detection Models</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Financial Risk</span>
                        <span className="text-sm font-medium">96.2%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Legal Risk</span>
                        <span className="text-sm font-medium">94.8%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Operational Risk</span>
                        <span className="text-sm font-medium">93.1%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Compliance Risk</span>
                        <span className="text-sm font-medium">97.5%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Opportunity Detection</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Cost Optimization</span>
                        <span className="text-sm font-medium">91.7%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Term Improvements</span>
                        <span className="text-sm font-medium">89.3%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Process Efficiency</span>
                        <span className="text-sm font-medium">92.8%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Revenue Enhancement</span>
                        <span className="text-sm font-medium">88.9%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    Cost Savings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$2.4M</div>
                  <div className="text-sm text-muted-foreground">This year</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Time Saved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,247</div>
                  <div className="text-sm text-muted-foreground">Hours this month</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-red-500" />
                    Risks Mitigated
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">89</div>
                  <div className="text-sm text-muted-foreground">High-risk issues</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    ROI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">340%</div>
                  <div className="text-sm text-muted-foreground">Annual return</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Savings Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Contract Optimization</span>
                      <span className="text-sm font-medium">$145K</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Risk Avoidance</span>
                      <span className="text-sm font-medium">$89K</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Process Automation</span>
                      <span className="text-sm font-medium">$67K</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Compliance Efficiency</span>
                      <span className="text-sm font-medium">$34K</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center font-medium">
                        <span>Total Monthly Savings</span>
                        <span>$335K</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Productivity Improvements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Contract Review Speed</span>
                      <span className="text-sm font-medium text-green-600">+67%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Risk Assessment Time</span>
                      <span className="text-sm font-medium text-green-600">-45%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Compliance Reporting</span>
                      <span className="text-sm font-medium text-green-600">-78%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Document Processing</span>
                      <span className="text-sm font-medium text-green-600">+89%</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between items-center font-medium">
                        <span>Overall Efficiency Gain</span>
                        <span className="text-green-600">+72%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}