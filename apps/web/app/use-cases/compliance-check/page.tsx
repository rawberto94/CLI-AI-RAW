'use client'

import React, { useState } from 'react'
import UseCaseHero from '@/components/use-cases/shared/UseCaseHero'
import BeforeAfterComparison from '@/components/use-cases/shared/BeforeAfterComparison'
import UseCaseCTA from '@/components/use-cases/shared/UseCaseCTA'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Shield, AlertTriangle, CheckCircle2, FileText, Download } from 'lucide-react'
import { mockComplianceData, complianceTemplates } from '@/lib/use-cases/compliance-data'

export default function ComplianceCheckPage() {
  const [scanning, setScanning] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Compliant': return 'bg-green-500'
      case 'Partial': return 'bg-yellow-500'
      case 'Non-Compliant': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <UseCaseHero
          title="Compliance Health Check"
          description="Instant compliance scanning across GDPR, CCPA, SOX, and more. Identify gaps and get remediation templates."
          icon={Shield}
          category="scalable"
          metrics={{
            roi: '20x',
            savings: '$890K risk avoided',
            timeToValue: '1 day',
            complexity: 'Low'
          }}
        />

        <BeforeAfterComparison
          before={[
            { label: 'Review time', value: '2-3 weeks', color: 'red' },
            { label: 'Coverage', value: 'Manual sampling', color: 'yellow' },
            { label: 'Accuracy', value: '70-80%', color: 'yellow' },
            { label: 'Cost per review', value: '$5,000', color: 'red' }
          ]}
          after={[
            { label: 'Review time', value: '5 minutes', color: 'green' },
            { label: 'Coverage', value: '100% automated', color: 'green' },
            { label: 'Accuracy', value: '95%+', color: 'green' },
            { label: 'Cost per review', value: '$50', color: 'green' }
          ]}
          highlights={[
            'Reduced compliance review time by 99%',
            'Avoided $890K in potential regulatory fines',
            'Improved audit readiness by 85%'
          ]}
        />

        {/* Overall Score */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Compliance Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center mb-6">
              <div className="text-6xl font-bold text-yellow-600 mb-2">
                {mockComplianceData.overallScore}
              </div>
              <div className="text-lg text-gray-600">Overall Compliance Score</div>
              <Progress value={mockComplianceData.overallScore} className="mt-4" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  ${(mockComplianceData.riskExposure / 1000).toFixed(0)}K
                </div>
                <div className="text-sm text-gray-600">Risk Exposure</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {mockComplianceData.remediationTime}
                </div>
                <div className="text-sm text-gray-600">Remediation Time</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regulation Breakdown */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Regulation Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(mockComplianceData.regulations).map(([reg, data]) => (
                <div key={reg} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold text-lg">{reg}</h4>
                      <Badge className={getStatusColor(data.status)}>
                        {data.status}
                      </Badge>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{data.score}</div>
                  </div>
                  <Progress value={data.score} className="mb-3" />
                  <div className="text-sm text-gray-600 mb-2">
                    {data.foundClauses} of {data.requiredClauses} required clauses found
                  </div>
                  {data.gaps.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium mb-2">Gaps:</div>
                      <div className="space-y-1">
                        {data.gaps.map((gap, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-red-600">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{gap}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Critical Issues */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Critical Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockComplianceData.criticalIssues.map((issue, idx) => (
                <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                  issue.severity === 'Critical' ? 'bg-red-50 border-red-500' :
                  issue.severity === 'High' ? 'bg-orange-50 border-orange-500' :
                  'bg-yellow-50 border-yellow-500'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <Badge variant={issue.severity === 'Critical' ? 'destructive' : 'default'} className="mb-2">
                        {issue.severity}
                      </Badge>
                      <h4 className="font-semibold mb-1">{issue.regulation}: {issue.issue}</h4>
                      <p className="text-sm text-gray-600 mb-2">{issue.impact}</p>
                      <div className="text-sm">
                        <span className="font-medium">Remediation: </span>
                        <span className="text-gray-700">{issue.remediation}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Clause Analysis */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Clause Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockComplianceData.clauseAnalysis.map((clause, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {clause.status === 'Present' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : clause.status === 'Weak' ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    )}
                    <div>
                      <div className="font-medium">{clause.clause}</div>
                      <div className="text-sm text-gray-600">{clause.notes}</div>
                    </div>
                  </div>
                  <Badge variant={
                    clause.strength === 'Strong' ? 'default' :
                    clause.strength === 'Moderate' ? 'secondary' :
                    'destructive'
                  }>
                    {clause.strength}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Remediation Plan */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Remediation Action Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockComplianceData.remediationPlan.map((action) => (
                <div key={action.priority} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                        {action.priority}
                      </div>
                      <div>
                        <div className="font-semibold">{action.action}</div>
                        <div className="text-sm text-gray-600">
                          {action.owner} • {action.effort} • Due: {action.deadline}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Templates */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Compliance Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {complianceTemplates.map((template, idx) => (
                <div key={idx} className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">{template.name}</h4>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  <div className="text-sm text-gray-500 mb-3">{template.clauses} clauses</div>
                  <Button size="sm" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <UseCaseCTA
          primaryAction={{
            label: 'Start Pilot',
            onClick: () => console.log('Start pilot')
          }}
          secondaryAction={{
            label: 'Schedule Demo',
            onClick: () => console.log('Schedule demo')
          }}
          downloadAction={{
            label: 'Download Report',
            onClick: () => console.log('Download report')
          }}
        />
      </div>
    </div>
  )
}
