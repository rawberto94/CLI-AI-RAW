import React from 'react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Compliance Reports - Contract Intelligence',
  description: 'Regulatory compliance monitoring and reporting dashboard',
}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Award,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  FileText,
  Users,
  Calendar,
  Target,
  TrendingUp,
  TrendingDown,
  Download,
  Share,
  Filter,
  RefreshCw,
  Eye,
  Bell,
  Search,
  BookOpen
} from 'lucide-react'
import Link from 'next/link'

// Mock compliance data
const complianceData = {
  overview: {
    overallScore: 94.2,
    compliantContracts: 1174,
    nonCompliantContracts: 43,
    pendingReview: 30,
    complianceTrend: 8.5
  },
  regulations: [
    {
      name: 'GDPR',
      description: 'General Data Protection Regulation',
      compliantContracts: 234,
      nonCompliantContracts: 12,
      pendingContracts: 8,
      complianceRate: 92.1,
      lastAudit: '2024-01-15',
      nextAudit: '2024-04-15'
    },
    {
      name: 'SOX',
      description: 'Sarbanes-Oxley Act',
      compliantContracts: 189,
      nonCompliantContracts: 6,
      pendingContracts: 3,
      complianceRate: 95.5,
      lastAudit: '2024-01-10',
      nextAudit: '2024-04-10'
    },
    {
      name: 'HIPAA',
      description: 'Health Insurance Portability and Accountability Act',
      compliantContracts: 67,
      nonCompliantContracts: 3,
      pendingContracts: 2,
      complianceRate: 93.1,
      lastAudit: '2024-01-20',
      nextAudit: '2024-04-20'
    },
    {
      name: 'PCI DSS',
      description: 'Payment Card Industry Data Security Standard',
      compliantContracts: 45,
      nonCompliantContracts: 2,
      pendingContracts: 1,
      complianceRate: 93.8,
      lastAudit: '2024-01-12',
      nextAudit: '2024-04-12'
    }
  ],
  nonCompliantContracts: [
    {
      id: 'contract-001',
      name: 'DataProcessor Service Agreement',
      supplier: 'DataCorp Solutions',
      regulation: 'GDPR',
      issues: ['Missing data retention clauses', 'Unclear data processing terms', 'No DPO contact'],
      severity: 'High',
      dueDate: '2024-02-15',
      assignedTo: 'Legal Team'
    },
    {
      id: 'contract-002',
      name: 'Payment Gateway Integration',
      supplier: 'PayTech Inc',
      regulation: 'PCI DSS',
      issues: ['Insufficient security requirements', 'Missing audit clauses'],
      severity: 'Medium',
      dueDate: '2024-02-28',
      assignedTo: 'Security Team'
    },
    {
      id: 'contract-003',
      name: 'Healthcare Analytics Platform',
      supplier: 'HealthTech Systems',
      regulation: 'HIPAA',
      issues: ['Incomplete BAA terms', 'Missing breach notification procedures'],
      severity: 'High',
      dueDate: '2024-02-10',
      assignedTo: 'Compliance Team'
    }
  ],
  upcomingAudits: [
    {
      regulation: 'GDPR',
      auditor: 'External Compliance Firm',
      date: '2024-04-15',
      scope: 'Data processing agreements',
      preparation: 85
    },
    {
      regulation: 'SOX',
      auditor: 'Internal Audit Team',
      date: '2024-04-10',
      scope: 'Financial controls in vendor contracts',
      preparation: 92
    },
    {
      regulation: 'HIPAA',
      auditor: 'Healthcare Compliance Specialists',
      date: '2024-04-20',
      scope: 'PHI handling agreements',
      preparation: 78
    }
  ],
  complianceActions: [
    {
      action: 'Update GDPR data processing clauses',
      priority: 'High',
      affectedContracts: 12,
      deadline: '2024-02-15',
      status: 'In Progress',
      owner: 'Legal Team'
    },
    {
      action: 'Implement automated compliance monitoring',
      priority: 'Medium',
      affectedContracts: 247,
      deadline: '2024-03-30',
      status: 'Planned',
      owner: 'IT Team'
    },
    {
      action: 'Conduct quarterly compliance training',
      priority: 'Medium',
      affectedContracts: 0,
      deadline: '2024-03-15',
      status: 'Scheduled',
      owner: 'HR Team'
    }
  ]
}

export default function ComplianceReportsPage() {
  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600 bg-green-50'
    if (rate >= 90) return 'text-blue-600 bg-blue-50'
    if (rate >= 80) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
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
            <span className="text-gray-900">Compliance Reports</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">Compliance Reports</h1>
          <p className="text-gray-600 mt-1">Regulatory compliance monitoring and reporting</p>
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

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overall Compliance Score</p>
                <p className="text-3xl font-bold text-gray-900">{complianceData.overview.overallScore}%</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600 font-medium">+{complianceData.overview.complianceTrend}%</span>
                  <span className="text-sm text-gray-500 ml-1">this quarter</span>
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <Award className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliant Contracts</p>
                <p className="text-3xl font-bold text-gray-900">{complianceData.overview.compliantContracts}</p>
                <div className="flex items-center mt-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                  <span className="text-sm text-gray-600">Fully compliant</span>
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <CheckCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Non-Compliant</p>
                <p className="text-3xl font-bold text-gray-900">{complianceData.overview.nonCompliantContracts}</p>
                <div className="flex items-center mt-2">
                  <XCircle className="w-4 h-4 text-red-600 mr-1" />
                  <span className="text-sm text-red-600">Require action</span>
                </div>
              </div>
              <div className="p-3 bg-red-50 rounded-xl">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-3xl font-bold text-gray-900">{complianceData.overview.pendingReview}</p>
                <div className="flex items-center mt-2">
                  <Clock className="w-4 h-4 text-yellow-600 mr-1" />
                  <span className="text-sm text-yellow-600">Under review</span>
                </div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-xl">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regulatory Compliance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            Regulatory Compliance Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceData.regulations.map((regulation, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{regulation.name}</h4>
                    <p className="text-sm text-gray-600">{regulation.description}</p>
                  </div>
                  <div className="text-right">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getComplianceColor(regulation.complianceRate)}`}>
                      {regulation.complianceRate}% Compliant
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-lg font-bold text-green-600">{regulation.compliantContracts}</div>
                    <div className="text-xs text-gray-600">Compliant</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-lg font-bold text-red-600">{regulation.nonCompliantContracts}</div>
                    <div className="text-xs text-gray-600">Non-Compliant</div>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <div className="text-lg font-bold text-yellow-600">{regulation.pendingContracts}</div>
                    <div className="text-xs text-gray-600">Pending</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-blue-600">{regulation.nextAudit}</div>
                    <div className="text-xs text-gray-600">Next Audit</div>
                  </div>
                </div>
                <Progress value={regulation.complianceRate} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Non-Compliant Contracts */}
      <Card className="border-l-4 border-l-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="w-6 h-6 text-red-600" />
            Non-Compliant Contracts Requiring Action
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceData.nonCompliantContracts.map((contract, index) => (
              <div key={index} className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{contract.name}</h4>
                    <p className="text-sm text-gray-600 mb-2">{contract.supplier}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      <span>Regulation: {contract.regulation}</span>
                      <span>Due: {contract.dueDate}</span>
                      <span>Assigned: {contract.assignedTo}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getSeverityColor(contract.severity)} variant="outline">
                      {contract.severity} Severity
                    </Badge>
                    <div className="mt-2">
                      <Button size="sm" variant="outline">
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Compliance Issues:</p>
                  <div className="flex flex-wrap gap-2">
                    {contract.issues.map((issue, issueIndex) => (
                      <Badge key={issueIndex} variant="outline" className="text-xs">
                        {issue}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Audits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Upcoming Compliance Audits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceData.upcomingAudits.map((audit, index) => (
              <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{audit.regulation} Audit</h4>
                    <p className="text-sm text-gray-600">{audit.auditor}</p>
                    <p className="text-sm text-gray-600">Scope: {audit.scope}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600 mb-1">{audit.date}</div>
                    <div className="text-sm text-gray-600">Audit Date</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Preparation Progress:</span>
                  <span className="text-sm font-medium text-blue-600">{audit.preparation}%</span>
                </div>
                <Progress value={audit.preparation} className="mt-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compliance Action Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-6 h-6 text-green-600" />
            Compliance Action Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {complianceData.complianceActions.map((action, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{action.action}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>Owner: {action.owner}</span>
                      <span>Deadline: {action.deadline}</span>
                      {action.affectedContracts > 0 && (
                        <span>Affects: {action.affectedContracts} contracts</span>
                      )}
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
                Set Compliance Alerts
              </Button>
              <Button variant="outline">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Audit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}