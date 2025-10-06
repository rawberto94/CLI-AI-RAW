import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics Dashboard - Contract Intelligence',
  description: 'Business insights and contract portfolio analysis with AI-powered analytics',
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Shield,
  DollarSign,
  FileText,
  Users,
  Clock,
  Target,
  Award,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Download,
  Share,
  Filter,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'

// Mock analytics data
const analyticsData = {
  portfolioMetrics: {
    totalValue: 45600000,
    contractCount: 1247,
    avgContractValue: 36570,
    monthlyGrowth: 12.5,
    riskScore: 23,
    complianceScore: 94
  },
  categoryBreakdown: [
    { category: 'Software Development', value: 18500000, percentage: 40.6, contracts: 342 },
    { category: 'Consulting Services', value: 12300000, percentage: 27.0, contracts: 198 },
    { category: 'Infrastructure', value: 8900000, percentage: 19.5, contracts: 156 },
    { category: 'Analytics & Data', value: 5900000, percentage: 12.9, contracts: 89 }
  ],
  riskAnalysis: {
    highRisk: 23,
    mediumRisk: 156,
    lowRisk: 1068,
    totalRiskExposure: 8700000
  },
  complianceMetrics: {
    compliant: 1174,
    nonCompliant: 43,
    pending: 30,
    overallScore: 94.2
  }
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Business insights and contract portfolio analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Portfolio Value</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${(analyticsData.portfolioMetrics.totalValue / 1000000).toFixed(1)}M
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600 font-medium">+{analyticsData.portfolioMetrics.monthlyGrowth}%</span>
                  <span className="text-sm text-gray-500 ml-1">this month</span>
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Contracts</p>
                <p className="text-3xl font-bold text-gray-900">{analyticsData.portfolioMetrics.contractCount}</p>
                <div className="flex items-center mt-2">
                  <FileText className="w-4 h-4 text-gray-500 mr-1" />
                  <span className="text-sm text-gray-600">
                    Avg: ${(analyticsData.portfolioMetrics.avgContractValue / 1000).toFixed(0)}K
                  </span>
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Risk Score</p>
                <p className="text-3xl font-bold text-gray-900">{analyticsData.portfolioMetrics.riskScore}</p>
                <div className="flex items-center mt-2">
                  <Shield className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600">Low Risk</span>
                </div>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance Score</p>
                <p className="text-3xl font-bold text-gray-900">{analyticsData.portfolioMetrics.complianceScore}%</p>
                <div className="flex items-center mt-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600">Excellent</span>
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <Award className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/analytics/portfolio">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-blue-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Portfolio Overview</h3>
              <p className="text-gray-600 mb-4">Detailed contract portfolio metrics and trends</p>
              <div className="flex items-center text-sm text-blue-600 font-medium">
                View Details <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/analytics/risk">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-red-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-50 rounded-xl">
                  <Shield className="w-8 h-8 text-red-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Risk Analysis</h3>
              <p className="text-gray-600 mb-4">Risk assessment reports and mitigation strategies</p>
              <div className="flex items-center text-sm text-red-600 font-medium">
                View Details <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/analytics/compliance">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-purple-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-50 rounded-xl">
                  <Award className="w-8 h-8 text-purple-600" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Compliance Reports</h3>
              <p className="text-gray-600 mb-4">Compliance monitoring and regulatory tracking</p>
              <div className="flex items-center text-sm text-purple-600 font-medium">
                View Details <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Contract Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analyticsData.categoryBreakdown.map((category, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{category.category}</h4>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">
                        ${(category.value / 1000000).toFixed(1)}M
                      </span>
                      <span className="text-sm text-gray-500 ml-2">({category.percentage}%)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Progress value={category.percentage} className="flex-1 mr-4" />
                    <span className="text-sm text-gray-600">{category.contracts} contracts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk & Compliance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-red-600" />
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-gray-900">High Risk</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-red-600">{analyticsData.riskAnalysis.highRisk}</span>
                  <span className="text-sm text-gray-500 ml-1">contracts</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-gray-900">Medium Risk</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-yellow-600">{analyticsData.riskAnalysis.mediumRisk}</span>
                  <span className="text-sm text-gray-500 ml-1">contracts</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-900">Low Risk</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-green-600">{analyticsData.riskAnalysis.lowRisk}</span>
                  <span className="text-sm text-gray-500 ml-1">contracts</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-6 h-6 text-purple-600" />
              Compliance Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  {analyticsData.complianceMetrics.overallScore}%
                </div>
                <p className="text-gray-600">Overall Compliance Score</p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Compliant</span>
                  <span className="font-semibold text-green-600">{analyticsData.complianceMetrics.compliant}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Non-Compliant</span>
                  <span className="font-semibold text-red-600">{analyticsData.complianceMetrics.nonCompliant}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Pending Review</span>
                  <span className="font-semibold text-yellow-600">{analyticsData.complianceMetrics.pending}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}