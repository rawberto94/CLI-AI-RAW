'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, DollarSign, Shield, AlertTriangle, CheckCircle2, 
  Calendar, Users, MapPin, Clock, TrendingUp, AlertCircle,
  Scale, Award, Target, Sparkles
} from 'lucide-react';

interface ArtifactViewerProps {
  type: string;
  data: any;
  confidence?: number;
  processingTime?: number;
}

export function ArtifactViewer({ type, data, confidence, processingTime }: ArtifactViewerProps) {
  const renderOverview = (data: any) => (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-6 border border-violet-200">
        <div className="flex items-start gap-3">
          <FileText className="h-6 w-6 text-violet-600 flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
            <p className="text-gray-700 leading-relaxed">{data.summary}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Contract Details */}
        <Card className="border-violet-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-violet-600" />
              Contract Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <Badge variant="outline" className="bg-violet-50">{data.contractType || 'N/A'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Effective Date:</span>
              <span className="font-medium">{data.effectiveDate || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Expiration Date:</span>
              <span className="font-medium">{data.expirationDate || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Jurisdiction:</span>
              <span className="font-medium">{data.jurisdiction || 'N/A'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Parties */}
        <Card className="border-purple-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              Parties Involved
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.parties?.map((party: any, idx: number) => (
              <div key={idx} className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="font-medium text-gray-900">{party.name || party}</div>
                {party.role && <div className="text-sm text-gray-600">{party.role}</div>}
                {party.address && (
                  <div className="text-sm text-gray-500 flex items-start gap-1 mt-1">
                    <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{party.address}</span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Key Terms */}
      {data.keyTerms && data.keyTerms.length > 0 && (
        <Card className="border-green-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Key Terms & Obligations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.keyTerms.map((term: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-medium">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700 pt-0.5">{term}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderFinancial = (data: any) => (
    <div className="space-y-6">
      {/* Total Value */}
      <div className="bg-gradient-to-br from-violet-50 to-violet-50 rounded-xl p-6 border border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Contract Value</p>
            <p className="text-4xl font-bold text-green-700">
              {data.totalValue?.currency || '$'} {data.totalValue?.amount?.toLocaleString() || 'N/A'}
            </p>
            {data.totalValue?.confidence && (
              <Badge variant="outline" className="mt-2 bg-green-100 text-green-700 border-green-300">
                {data.totalValue.confidence} confidence
              </Badge>
            )}
          </div>
          <DollarSign className="h-16 w-16 text-green-600 opacity-20" />
        </div>
      </div>

      {/* Payment Schedule */}
      {data.paymentSchedule && data.paymentSchedule.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-violet-600" />
              Payment Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.paymentSchedule.map((payment: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{payment.milestone}</div>
                    <div className="text-sm text-gray-600">{payment.dueDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-700">
                      ${payment.amount?.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">{payment.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rate Cards */}
      {data.rateCards && data.rateCards.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-600" />
              Professional Services Rate Cards
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {data.rateCards.length} role{data.rateCards.length !== 1 ? 's' : ''} identified
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {data.rateCards.map((rate: any, idx: number) => (
                <div key={idx} className="border border-purple-200 rounded-lg p-4 bg-gradient-to-br from-purple-50 to-pink-50 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{rate.role}</h4>
                        {rate.seniority && (
                          <Badge variant="outline" className="bg-white">
                            {rate.seniority}
                          </Badge>
                        )}
                      </div>
                      {rate.lineOfService && (
                        <p className="text-sm text-gray-600 mb-2">{rate.lineOfService}</p>
                      )}
                      {rate.location && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <span className="text-xs">📍</span>
                          <span>{rate.location}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-700">
                        ${typeof rate.dailyRate === 'number' ? rate.dailyRate.toLocaleString() : rate.rate?.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">
                        /{rate.unit || 'day'} {rate.currency || ''}
                      </div>
                    </div>
                  </div>
                  
                  {rate.skills && rate.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t border-purple-200">
                      {rate.skills.slice(0, 5).map((skill: string, skillIdx: number) => (
                        <Badge key={skillIdx} variant="outline" className="text-xs bg-white">
                          {skill}
                        </Badge>
                      ))}
                      {rate.skills.length > 5 && (
                        <Badge variant="outline" className="text-xs bg-gray-100">
                          +{rate.skills.length - 5} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-violet-50 rounded-lg border border-violet-200">
              <p className="text-sm text-gray-700">
                <strong>💡 Tip:</strong> These rates have been automatically extracted and saved to your Rate Card Benchmarking system for market analysis and savings opportunities.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Terms */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-violet-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Payment Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-900">{data.paymentTerms || 'Not specified'}</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Late Payment Penalties</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-900">{data.penalties || 'None specified'}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderRisk = (data: any) => (
    <div className="space-y-6">
      {/* Overall Risk Score */}
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Overall Risk Score</p>
            <p className="text-4xl font-bold text-orange-700">{data.overallRiskScore}/10</p>
            <Badge 
              variant="outline" 
              className={`mt-2 ${
                data.riskLevel === 'high' ? 'bg-red-100 text-red-700 border-red-300' :
                data.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                'bg-green-100 text-green-700 border-green-300'
              }`}
            >
              {data.riskLevel?.toUpperCase()} RISK
            </Badge>
          </div>
          <Shield className="h-16 w-16 text-orange-600 opacity-20" />
        </div>
      </div>

      {/* Identified Risks */}
      {data.identifiedRisks && data.identifiedRisks.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Identified Risks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.identifiedRisks.map((risk: any, idx: number) => (
                <div key={idx} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-violet-50">
                        {risk.category}
                      </Badge>
                      <Badge 
                        variant="outline"
                        className={
                          risk.severity === 'high' ? 'bg-red-100 text-red-700' :
                          risk.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }
                      >
                        {risk.severity}
                      </Badge>
                    </div>
                    <span className="text-sm text-gray-500">
                      {risk.likelihood} likelihood
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 mb-2">{risk.description}</p>
                  <div className="bg-green-50 rounded-md p-3 border border-green-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-green-700">Mitigation: </span>
                      {risk.mitigation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Red Flags */}
      {data.redFlags && data.redFlags.length > 0 && (
        <Card className="border-red-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              Red Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.redFlags.map((flag: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-sm bg-red-50 p-3 rounded-lg border border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{flag}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <Card className="border-violet-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-600" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-violet-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderCompliance = (data: any) => (
    <div className="space-y-6">
      {/* Compliance Score */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-50 rounded-xl p-6 border border-purple-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Compliance Score</p>
            <p className="text-4xl font-bold text-purple-700">{data.complianceScore}/10</p>
            <div className="mt-2 w-48 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${(data.complianceScore / 10) * 100}%` }}
              ></div>
            </div>
          </div>
          <Scale className="h-16 w-16 text-purple-600 opacity-20" />
        </div>
      </div>

      {/* Applicable Regulations */}
      {data.applicableRegulations && data.applicableRegulations.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Applicable Regulations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.applicableRegulations.map((reg: string, idx: number) => (
                <Badge key={idx} variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  {reg}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Protection */}
      {data.dataProtection && (
        <Card className="border-violet-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-600" />
              Data Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">GDPR Compliant:</span>
              <Badge variant="outline" className={data.dataProtection.gdprCompliant === 'yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {data.dataProtection.gdprCompliant}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Has Data Clauses:</span>
              <Badge variant="outline" className={data.dataProtection.hasDataClauses ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                {data.dataProtection.hasDataClauses ? 'Yes' : 'No'}
              </Badge>
            </div>
            {data.dataProtection.dataRetention && (
              <div className="pt-2 border-t">
                <p className="text-gray-600">Data Retention:</p>
                <p className="text-gray-900 mt-1">{data.dataProtection.dataRetention}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Compliance Issues */}
      {data.complianceIssues && data.complianceIssues.length > 0 && (
        <Card className="border-orange-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Compliance Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.complianceIssues.map((issue: any, idx: number) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      variant="outline"
                      className={
                        issue.severity === 'high' ? 'bg-red-100 text-red-700' :
                        issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-violet-100 text-violet-700'
                      }
                    >
                      {issue.severity}
                    </Badge>
                    <span className="text-sm text-gray-600">{issue.regulation}</span>
                  </div>
                  <p className="text-gray-900 mb-2">{issue.issue}</p>
                  <div className="bg-violet-50 rounded-md p-3 border border-violet-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-violet-700">Recommendation: </span>
                      {issue.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Clauses */}
      {data.missingClauses && data.missingClauses.length > 0 && (
        <Card className="border-yellow-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              Missing Clauses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.missingClauses.map((clause: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <span className="flex-shrink-0 w-5 h-5 bg-yellow-200 text-yellow-700 rounded-full flex items-center justify-center text-xs">
                    !
                  </span>
                  <span className="text-gray-700">{clause}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {data.recommendations && data.recommendations.length > 0 && (
        <Card className="border-green-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-600" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderClauses = (data: any) => (
    <div className="space-y-4">
      {data.clauses && data.clauses.length > 0 ? (
        data.clauses.map((clause: any, idx: number) => (
          <Card key={idx} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-violet-50">
                    {clause.type}
                  </Badge>
                  <CardTitle className="text-base">{clause.title}</CardTitle>
                </div>
                <Badge 
                  variant="outline"
                  className={
                    clause.riskLevel === 'high' ? 'bg-red-100 text-red-700' :
                    clause.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }
                >
                  {clause.riskLevel}
                </Badge>
              </div>
              {clause.pageReference && (
                <p className="text-sm text-gray-500">{clause.pageReference}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Summary:</p>
                <p className="text-sm text-gray-700">{clause.summary}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border">
                <p className="text-sm font-medium text-gray-600 mb-1">Full Text:</p>
                <p className="text-sm text-gray-700">{clause.content}</p>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <p className="text-gray-500 text-center py-8">No clauses extracted</p>
      )}
    </div>
  );

  const renderDefault = (data: any) => (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
      <pre className="text-sm overflow-auto max-h-96 text-gray-700 whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );

  const renderContent = () => {
    const artifactType = type.toUpperCase();
    
    switch (artifactType) {
      case 'OVERVIEW':
        return renderOverview(data);
      case 'FINANCIAL':
        return renderFinancial(data);
      case 'RISK':
        return renderRisk(data);
      case 'COMPLIANCE':
        return renderCompliance(data);
      case 'CLAUSES':
        return renderClauses(data);
      default:
        return renderDefault(data);
    }
  };

  return (
    <div className="space-y-4">
      {renderContent()}
      
      {/* Processing Stats */}
      {(processingTime || confidence) && (
        <div className="flex items-center gap-4 text-sm text-gray-600 pt-4 border-t">
          {processingTime && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Processed in {processingTime}ms</span>
            </div>
          )}
          {confidence && (
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span>Confidence: {(confidence * 100).toFixed(0)}%</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Sparkles className="h-4 w-4" />
            <span>AI-powered extraction</span>
          </div>
        </div>
      )}
    </div>
  );
}
