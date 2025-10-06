import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Risk Analysis - Contract Intelligence',
  description: 'Contract risk assessment and mitigation strategies with AI-powered insights',
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Shield,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  FileText,
  Users,
  DollarSign,
  Calendar,
  Target,
  ArrowRight,
  Download,
  Share,
  Filter,
  RefreshCw,
  Eye,
  Bell
} from 'lucide-react'
import Link from 'next/link'

// Mock risk data
const riskData = {
  overview: {
    totalRiskScore: 23,
    riskTrend: -12.5, // negative is good (risk decreasing)
    highRiskContracts: 23,
    mediumRiskContracts: 156,
    lowRiskContracts: 1068,
    totalRiskExposure: 8700000
  },
  riskCategories: [
    { category: 'Payment Terms', riskLevel: 'High', contracts: 12, exposure: 3200000, trend: -5.2 },
    { category: 'Auto-Renewal Clauses', riskLevel: 'High', contracts: 8, exposure: 2800000, trend: -8.1 },
    { category: 'Liability Caps', riskLevel: 'Medium', contracts: 45, exposure: 1900000, trend: 2.3 },
    { category: 'Termination Rights', riskLevel: 'Medium', contracts: 34, exposure: 1200000, trend: -1.7 },
    { category: 'IP Ownership', riskLevel: 'Medium', contracts: 28, exposure: 800000, trend: -3.4 },
    { category: 'Data Security', riskLevel: 'Low', contracts: 67, exposure: 600000, trend: -15.2 }
  ],
  highRiskContracts: [
    {
      id: 'contract-001',
      name: 'TechCorp Master Service Agreement',
      supplier: 'TechCorp Solutions',
      value: 2400000,
      riskScore: 85,
      primaryRisks: ['Unlimited liability', 'Auto-renewal without notice', 'Unfavorable payment terms'],
      expiryDate: '2024-06-15',
      lastReviewed: '2024-01-10'
    },
    {
      id: 'contract-002',
      name: 'CloudServices Infrastructure Agreement',
      supplier: 'CloudServices Inc',
      value: 1800000,
      riskScore: 78,
      primaryRisks: ['Data sovereignty issues', 'Weak SLA penalties', 'Broad indemnification'],
      expiryDate: '2024-08-22',
      lastReviewed: '2024-01-08'
    },
    {
      id: 'contract-003',
      name: 'DataPro Analytics License',
      supplier: 'DataPro Systems',
      value: 950000,
      riskScore: 72,
      primaryRisks: ['IP ownership unclear', 'Restrictive usage terms', 'High termination fees'],
      expiryDate: '2024-04-30',
      lastReviewed: '2024-01-05'
    }
  ],
  riskMitigation: [
    {
      action: 'Renegotiate liability caps with TechCorp',
      priority: 'High',
      impact: 'Reduce exposure by $2.4M',
      timeline: '30 days',
      status: 'In Progress'
    },
    {
      action: 'Review auto-renewal clauses across portfolio',
      priority: 'High',
      impact: 'Prevent unwanted renewals',
      timeline: '45 days',
      status: 'Planned'
    },
    {
      action: 'Standardize payment terms template',
      priority: 'Medium',
      impact: 'Improve cash flow by 15%',
      timeline: '60 days',
      status: 'Planned'
    },
    {
      action: 'Implement quarterly risk reviews',
      priority: 'Medium',
      impact: 'Early risk identification',
      timeline: 'Ongoing',
      status: 'In Progress'
    }
  ]
}

export default function RiskAnalysisPage() {
  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getRiskIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return <XCircle className="w-5 h-5" />
      case 'medium': return <AlertTriangle className="w-5 h-5" />
      case 'low': return <CheckCircle className="w-5 h-5" />
      default: return <Shield className="w-5 h-5" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <Link href="/analytics" className="hover:text-gray-700">Analytics</Link>
            <span>/</span>
            <span className="text-gray-900">Risk Analysis</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">Risk Analysis</h1>
          <p className="text-gray-600 mt-1">Contract risk assessment and mitigation strategies</p>
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

      {/* Risk Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overall Risk Score</p>
                <p className="text-3xl font-bold text-gray-900">{riskData.overview.totalRiskScore}</p>
                <div className="flex items-center mt-2">
                  <TrendingDown className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600 font-medium">{Math.abs(riskData.overview.riskTrend)}% lower</span>
                  <span className="text-sm text-gray-500 ml-1">vs last month</span>
                </div>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Risk Contracts</p>
                <p className="text-3xl font-bold text-gray-900">{riskData.overview.highRiskContracts}</p>
                <div className="flex items-center mt-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600 mr-1" />
                  <span className="text-sm text-gray-600">Require immediate attention</span>
                </div>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Medium Risk Contracts</p>
                <p className="text-3xl font-bold text-gray-900">{riskData.overview.mediumRiskContracts}</p>
                <div className="flex items-center mt-2">
                  <Clock className="w-4 h-4 text-yellow-600 mr-1" />
                  <span className="text-sm text-gray-600">Monitor closely</span>
                </div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-xl">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Risk Exposure</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${(riskData.overview.totalRiskExposure / 1000000).toFixed(1)}M
                </p>
                <div className="flex items-center mt-2">
                  <DollarSign className="w-4 h-4 text-gray-500 mr-1" />
                  <span className="text-sm text-gray-600">Financial impact</span>
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-600" />
            Risk Categories Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {riskData.riskCategories.map((category, index) => (
              <div key={index} className={`p-4 rounded-lg border-2 ${getRiskColor(category.riskLevel)}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getRiskIcon(category.riskLevel)}
                    <div>
                      <h4 className="font-medium text-gray-900">{category.category}</h4>
                      <p className="text-sm text-gray-600">{category.contracts} contracts affected</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      ${(category.exposure / 1000000).toFixed(1)}M
                    </div>
                    <div className="flex items-center justify-end">
                      {category.trend < 0 ? (
                        <TrendingDown className="w-4 h-4 text-green-600 mr-1" />
                      ) : (
                        <TrendingUp className="w-4 h-4 text-red-600 mr-1" />
                      )}
                      <span className={`text-sm font-medium ${
                        category.trend < 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {category.trend > 0 ? '+' : ''}{category.trend}%
                      </span>
                    </div>
                  </div>
                </div>
                <Badge className={getRiskColor(category.riskLevel)}>
                  {category.riskLevel} Risk
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* High Risk Contracts */}
      <Card className="border-l-4 border-l-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="w-6 h-6 text-red-600" />
            High Risk Contracts Requiring Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {riskData.highRiskContracts.map((contract, index) => (
              <div key={index} className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{contract.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{contract.supplier}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Value: ${(contract.value / 1000000).toFixed(1)}M</span>
                      <span>Expires: {contract.expiryDate}</span>
                      <span>Last Review: {contract.lastReviewed}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="mb-2">
                      Risk Score: {contract.riskScore}
                    </Badge>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Primary Risk Factors:</p>
                  <div className="flex flex-wrap gap-2">
                    {contract.primaryRisks.map((risk, riskIndex) => (
                      <Badge key={riskIndex} variant="outline" className="text-xs">
                        {risk}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Mitigation Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-600" />
            Risk Mitigation Action Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {riskData.riskMitigation.map((action, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{action.action}</h4>
                    <p className="text-sm text-gray-600 mb-2">{action.impact}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Timeline: {action.timeline}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      className={`mb-2 ${
                        action.priority === 'High' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {action.priority} Priority
                    </Badge>
                    <div>
                      <Badge 
                        variant={action.status === 'In Progress' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {action.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="flex gap-3">
              <Button>
                <Bell className="w-4 h-4 mr-2" />
                Set Risk Alerts
              </Button>
              <Button variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Review
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}