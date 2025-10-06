import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portfolio Analytics - Contract Intelligence',
  description: 'Detailed contract portfolio metrics and performance analysis',
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Users,
  Calendar,
  Target,
  ArrowRight,
  Download,
  Share,
  Filter,
  RefreshCw,
  Building,
  Clock,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'

// Mock portfolio data
const portfolioData = {
  overview: {
    totalValue: 45600000,
    contractCount: 1247,
    activeContracts: 892,
    avgContractValue: 36570,
    monthlyGrowth: 12.5,
    yearlyGrowth: 34.2
  },
  topSuppliers: [
    { name: 'TechCorp Solutions', contracts: 89, value: 12500000, growth: 15.2 },
    { name: 'CloudServices Inc', contracts: 67, value: 9800000, growth: 8.7 },
    { name: 'DataPro Systems', contracts: 45, value: 7200000, growth: -2.1 },
    { name: 'ConsultingPro LLC', contracts: 34, value: 5900000, growth: 22.3 },
    { name: 'InfraTech Partners', contracts: 28, value: 4100000, growth: 11.8 }
  ],
  contractTypes: [
    { type: 'Master Service Agreement', count: 234, value: 18900000, avgDuration: 24 },
    { type: 'Statement of Work', count: 456, value: 15600000, avgDuration: 12 },
    { type: 'Software License', count: 189, value: 7800000, avgDuration: 36 },
    { type: 'Consulting Agreement', count: 167, value: 6200000, avgDuration: 18 },
    { type: 'Support & Maintenance', count: 201, value: 4100000, avgDuration: 12 }
  ],
  monthlyTrends: [
    { month: 'Jan', value: 3800000, contracts: 89 },
    { month: 'Feb', value: 4200000, contracts: 95 },
    { month: 'Mar', value: 3900000, contracts: 87 },
    { month: 'Apr', value: 4500000, contracts: 102 },
    { month: 'May', value: 4800000, contracts: 108 },
    { month: 'Jun', value: 5200000, contracts: 115 }
  ],
  expiringContracts: [
    { name: 'TechCorp MSA Renewal', value: 2400000, expiryDate: '2024-03-15', daysLeft: 45 },
    { name: 'CloudServices License', value: 1800000, expiryDate: '2024-04-22', daysLeft: 82 },
    { name: 'DataPro Analytics SOW', value: 950000, expiryDate: '2024-02-28', daysLeft: 28 },
    { name: 'ConsultingPro Agreement', value: 750000, expiryDate: '2024-05-10', daysLeft: 100 }
  ]
}

export default function PortfolioAnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <Link href="/analytics" className="hover:text-gray-700">Analytics</Link>
            <span>/</span>
            <span className="text-gray-900">Portfolio Overview</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Analytics</h1>
          <p className="text-gray-600 mt-1">Detailed contract portfolio metrics and performance analysis</p>
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
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Portfolio Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Portfolio Value</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${(portfolioData.overview.totalValue / 1000000).toFixed(1)}M
                </p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600 font-medium">+{portfolioData.overview.yearlyGrowth}%</span>
                  <span className="text-sm text-gray-500 ml-1">YoY</span>
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
                <p className="text-3xl font-bold text-gray-900">{portfolioData.overview.activeContracts}</p>
                <div className="flex items-center mt-2">
                  <FileText className="w-4 h-4 text-gray-500 mr-1" />
                  <span className="text-sm text-gray-600">
                    of {portfolioData.overview.contractCount} total
                  </span>
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Contract Value</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${(portfolioData.overview.avgContractValue / 1000).toFixed(0)}K
                </p>
                <div className="flex items-center mt-2">
                  <Target className="w-4 h-4 text-purple-600 mr-1" />
                  <span className="text-sm text-gray-600">per contract</span>
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Monthly Growth</p>
                <p className="text-3xl font-bold text-gray-900">+{portfolioData.overview.monthlyGrowth}%</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600">Strong growth</span>
                </div>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Suppliers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-6 h-6 text-blue-600" />
            Top Suppliers by Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {portfolioData.topSuppliers.map((supplier, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{supplier.name}</h4>
                    <p className="text-sm text-gray-600">{supplier.contracts} contracts</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    ${(supplier.value / 1000000).toFixed(1)}M
                  </div>
                  <div className="flex items-center justify-end">
                    {supplier.growth > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${
                      supplier.growth > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {supplier.growth > 0 ? '+' : ''}{supplier.growth}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contract Types Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-green-600" />
            Contract Types Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {portfolioData.contractTypes.map((type, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{type.type}</h4>
                  <div className="text-right">
                    <span className="text-lg font-bold text-gray-900">
                      ${(type.value / 1000000).toFixed(1)}M
                    </span>
                    <span className="text-sm text-gray-500 ml-2">({type.count} contracts)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Progress value={(type.value / portfolioData.overview.totalValue) * 100} className="flex-1 mr-4" />
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-1" />
                    {type.avgDuration} months avg
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Expiring Contracts Alert */}
      <Card className="border-l-4 border-l-yellow-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-yellow-600" />
            Contracts Expiring Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {portfolioData.expiringContracts.map((contract, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{contract.name}</h4>
                  <p className="text-sm text-gray-600">Expires: {contract.expiryDate}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    ${(contract.value / 1000000).toFixed(1)}M
                  </div>
                  <Badge variant={contract.daysLeft < 30 ? "destructive" : contract.daysLeft < 60 ? "secondary" : "outline"}>
                    {contract.daysLeft} days left
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-yellow-200">
            <Button className="w-full" variant="outline">
              <Calendar className="w-4 h-4 mr-2" />
              View All Expiring Contracts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            Monthly Portfolio Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {portfolioData.monthlyTrends.map((month, index) => (
              <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-600 mb-2">{month.month}</div>
                <div className="text-xl font-bold text-gray-900 mb-1">
                  ${(month.value / 1000000).toFixed(1)}M
                </div>
                <div className="text-sm text-gray-500">{month.contracts} contracts</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}