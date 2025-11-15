'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  DollarSign, 
  FileCheck, 
  TrendingUp, 
  Shield, 
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  RefreshCw
} from 'lucide-react';

export interface ArtifactData {
  type: 'OVERVIEW' | 'FINANCIAL' | 'CLAUSES' | 'RATES' | 'COMPLIANCE' | 'RISK';
  data: any;
  confidence?: number;
  completeness?: number;
  validation?: {
    valid: boolean;
    issues: Array<{
      field: string;
      severity: 'critical' | 'warning' | 'info';
      message: string;
    }>;
    criticalIssues: number;
    warnings: number;
  };
  method?: 'ai' | 'hybrid' | 'rule-based';
  processingTime?: number;
}

interface ArtifactDisplayProps {
  artifacts: ArtifactData[];
  onRegenerate?: (type: string) => void;
}

const artifactIcons: Record<string, React.ReactNode> = {
  OVERVIEW: <FileText className="h-5 w-5" />,
  FINANCIAL: <DollarSign className="h-5 w-5" />,
  CLAUSES: <FileCheck className="h-5 w-5" />,
  RATES: <TrendingUp className="h-5 w-5" />,
  COMPLIANCE: <Shield className="h-5 w-5" />,
  RISK: <AlertTriangle className="h-5 w-5" />
};

const artifactLabels: Record<string, string> = {
  OVERVIEW: 'Overview',
  FINANCIAL: 'Financial',
  CLAUSES: 'Clauses',
  RATES: 'Rate Cards',
  COMPLIANCE: 'Compliance',
  RISK: 'Risk Assessment'
};

export function ArtifactDisplay({ artifacts, onRegenerate }: ArtifactDisplayProps) {
  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'bg-gray-100 text-gray-800';
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getCompletenessColor = (completeness?: number) => {
    if (!completeness) return 'bg-gray-100 text-gray-800';
    if (completeness >= 80) return 'bg-green-100 text-green-800';
    if (completeness >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {artifacts.map((artifact) => (
          <Card key={artifact.type} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 bg-blue-50 rounded-full">
                  {artifactIcons[artifact.type]}
                </div>
                <div className="font-semibold text-sm">{artifactLabels[artifact.type]}</div>
                {artifact.confidence !== undefined && (
                  <Badge className={getConfidenceColor(artifact.confidence)}>
                    {Math.round(artifact.confidence * 100)}%
                  </Badge>
                )}
                {artifact.validation && !artifact.validation.valid && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    {artifact.validation.criticalIssues} issues
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Artifact Details</CardTitle>
          <CardDescription>
            Detailed view of all extracted artifacts with confidence scores and validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={artifacts[0]?.type} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              {artifacts.map((artifact) => (
                <TabsTrigger key={artifact.type} value={artifact.type} className="flex items-center gap-2">
                  {artifactIcons[artifact.type]}
                  <span className="hidden md:inline">{artifactLabels[artifact.type]}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {artifacts.map((artifact) => (
              <TabsContent key={artifact.type} value={artifact.type} className="space-y-4">
                {/* Artifact Header */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{artifactLabels[artifact.type]}</h3>
                      {artifact.method && (
                        <Badge variant="outline">
                          {artifact.method === 'ai' ? 'AI Generated' : 
                           artifact.method === 'hybrid' ? 'Hybrid' : 'Rule-Based'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {artifact.confidence !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Confidence:</span>
                          <Badge className={getConfidenceColor(artifact.confidence)}>
                            {Math.round(artifact.confidence * 100)}%
                          </Badge>
                        </div>
                      )}
                      {artifact.completeness !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Completeness:</span>
                          <Badge className={getCompletenessColor(artifact.completeness)}>
                            {artifact.completeness}%
                          </Badge>
                        </div>
                      )}
                      {artifact.processingTime && (
                        <div className="text-gray-600">
                          Generated in {(artifact.processingTime / 1000).toFixed(2)}s
                        </div>
                      )}
                    </div>
                  </div>
                  {onRegenerate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRegenerate(artifact.type)}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate
                    </Button>
                  )}
                </div>

                {/* Validation Issues */}
                {artifact.validation && artifact.validation.issues.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Validation Issues</h4>
                    {artifact.validation.issues.map((issue, index) => (
                      <div
                        key={index}
                        className={`flex items-start gap-2 p-3 rounded-lg ${
                          issue.severity === 'critical' ? 'bg-red-50 border border-red-200' :
                          issue.severity === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                          'bg-blue-50 border border-blue-200'
                        }`}
                      >
                        {issue.severity === 'critical' && <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />}
                        {issue.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />}
                        {issue.severity === 'info' && <Info className="h-4 w-4 text-blue-600 mt-0.5" />}
                        <div className="flex-1">
                          <div className="font-medium text-sm">{issue.field}</div>
                          <div className="text-sm text-gray-600">{issue.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Artifact Data */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Extracted Data</h4>
                  <ArtifactDataDisplay type={artifact.type} data={artifact.data} />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

interface ArtifactDataDisplayProps {
  type: string;
  data: any;
}

function ArtifactDataDisplay({ type, data }: ArtifactDataDisplayProps) {
  if (!data) {
    return <div className="text-gray-500 text-sm">No data available</div>;
  }

  switch (type) {
    case 'OVERVIEW':
      return <OverviewDisplay data={data} />;
    case 'FINANCIAL':
      return <FinancialDisplay data={data} />;
    case 'CLAUSES':
      return <ClausesDisplay data={data} />;
    case 'RATES':
      return <RatesDisplay data={data} />;
    case 'COMPLIANCE':
      return <ComplianceDisplay data={data} />;
    case 'RISK':
      return <RiskDisplay data={data} />;
    default:
      return <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto">{JSON.stringify(data, null, 2)}</pre>;
  }
}

function OverviewDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700">Summary</label>
        <p className="text-sm text-gray-900 mt-1">{data.summary}</p>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Contract Type</label>
        <p className="text-sm text-gray-900 mt-1">{data.contractType}</p>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700">Parties</label>
        <div className="mt-2 space-y-2">
          {data.parties?.map((party: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{party.role}</Badge>
              <span>{party.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Effective Date</label>
          <p className="text-sm text-gray-900 mt-1">{data.effectiveDate || 'Not specified'}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Expiration Date</label>
          <p className="text-sm text-gray-900 mt-1">{data.expirationDate || 'Not specified'}</p>
        </div>
      </div>
    </div>
  );
}

function FinancialDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Total Value</label>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {data.currency} {data.totalValue?.toLocaleString()}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Currency</label>
          <p className="text-sm text-gray-900 mt-1">{data.currency}</p>
        </div>
      </div>
      {data.paymentTerms && data.paymentTerms.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-700">Payment Terms</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.paymentTerms.map((term: string, index: number) => (
              <Badge key={index} variant="secondary">{term}</Badge>
            ))}
          </div>
        </div>
      )}
      {data.costSavingsOpportunities && data.costSavingsOpportunities.length > 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <label className="text-sm font-medium text-green-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Cost Savings Opportunities
          </label>
          <div className="mt-2 space-y-2">
            {data.costSavingsOpportunities.map((opp: any, index: number) => (
              <div key={index} className="text-sm">
                <div className="font-medium">{opp.title}</div>
                <div className="text-green-700">
                  {opp.currency} {opp.amount?.toLocaleString()} potential savings
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClausesDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      {data.clauses?.map((clause: any, index: number) => (
        <div key={index} className="p-4 border rounded-lg">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{clause.type}</Badge>
              <Badge className={
                clause.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                clause.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }>
                {clause.riskLevel} risk
              </Badge>
            </div>
          </div>
          <p className="text-sm text-gray-700">{clause.content}</p>
        </div>
      ))}
    </div>
  );
}

function RatesDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">Level</th>
              <th className="px-4 py-2 text-right">Rate</th>
              <th className="px-4 py-2 text-left">Unit</th>
              <th className="px-4 py-2 text-left">Location</th>
            </tr>
          </thead>
          <tbody>
            {data.rateCards?.map((rate: any, index: number) => (
              <tr key={index} className="border-t">
                <td className="px-4 py-2">{rate.role}</td>
                <td className="px-4 py-2">{rate.level}</td>
                <td className="px-4 py-2 text-right font-medium">
                  {rate.currency} {rate.rate}
                </td>
                <td className="px-4 py-2">{rate.unit}</td>
                <td className="px-4 py-2">{rate.location || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComplianceDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {data.regulations && data.regulations.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-700">Regulations</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.regulations.map((reg: string, index: number) => (
              <Badge key={index} variant="secondary">{reg}</Badge>
            ))}
          </div>
        </div>
      )}
      {data.certifications && data.certifications.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-700">Certifications</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.certifications.map((cert: string, index: number) => (
              <Badge key={index} variant="secondary">{cert}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskDisplay({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Overall Risk Score</label>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.overallScore}/100</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Risk Level</label>
          <Badge className={
            data.riskLevel === 'critical' ? 'bg-red-600 text-white' :
            data.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
            data.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }>
            {data.riskLevel}
          </Badge>
        </div>
      </div>
      {data.riskFactors && data.riskFactors.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-700">Risk Factors</label>
          <div className="mt-2 space-y-2">
            {data.riskFactors.map((factor: any, index: number) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{factor.category}</Badge>
                  <Badge className={
                    factor.severity === 'high' ? 'bg-red-100 text-red-800' :
                    factor.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }>
                    {factor.severity}
                  </Badge>
                </div>
                <p className="text-sm text-gray-700">{factor.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Auto-generated default export
export default ArtifactDisplay;
