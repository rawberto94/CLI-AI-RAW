"use client";

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ArrowLeftRight, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign,
  Scale,
  Brain,
  Zap,
  Eye,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ContractComparison {
  contractA: {
    id: string;
    name: string;
    type: string;
    value: number;
    riskScore: number;
    complianceScore: number;
  };
  contractB: {
    id: string;
    name: string;
    type: string;
    value: number;
    riskScore: number;
    complianceScore: number;
  };
  similarityScore: number;
  keyDifferences: Array<{
    category: string;
    field: string;
    contractA: string;
    contractB: string;
    impact: 'high' | 'medium' | 'low';
    recommendation: string;
  }>;
  financialComparison: {
    ratesDifference: number;
    paymentTerms: {
      contractA: string;
      contractB: string;
    };
    totalValueDifference: number;
  };
  riskComparison: {
    contractA: Array<{ type: string; level: string; description: string }>;
    contractB: Array<{ type: string; level: string; description: string }>;
  };
  recommendations: Array<{
    type: 'optimization' | 'risk-mitigation' | 'compliance' | 'financial';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

export function SmartContractComparison() {
  const [comparison, setComparison] = useState<ContractComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'overview' | 'differences' | 'financial' | 'risk'>('overview');

  useEffect(() => {
    // Simulate AI-powered contract comparison
    const loadComparison = async () => {
      setTimeout(() => {
        setComparison({
          contractA: {
            id: 'contract-1',
            name: 'MSA-TechCorp-2024.pdf',
            type: 'Master Service Agreement',
            value: 2400000,
            riskScore: 23,
            complianceScore: 94
          },
          contractB: {
            id: 'contract-2', 
            name: 'MSA-DataSolutions-2024.pdf',
            type: 'Master Service Agreement',
            value: 1800000,
            riskScore: 31,
            complianceScore: 87
          },
          similarityScore: 78,
          keyDifferences: [
            {
              category: 'Payment Terms',
              field: 'Payment Schedule',
              contractA: 'Net 30 days',
              contractB: 'Net 45 days',
              impact: 'medium',
              recommendation: 'Standardize to Net 30 for better cash flow'
            },
            {
              category: 'Liability',
              field: 'Liability Cap',
              contractA: '$500,000',
              contractB: 'Unlimited',
              impact: 'high',
              recommendation: 'Add liability cap to Contract B to limit exposure'
            },
            {
              category: 'Termination',
              field: 'Notice Period',
              contractA: '60 days',
              contractB: '90 days',
              impact: 'low',
              recommendation: 'Consider standardizing notice periods'
            },
            {
              category: 'IP Rights',
              field: 'Work Product Ownership',
              contractA: 'Client owns all work product',
              contractB: 'Shared ownership model',
              impact: 'high',
              recommendation: 'Clarify IP ownership to avoid future disputes'
            }
          ],
          financialComparison: {
            ratesDifference: 15,
            paymentTerms: {
              contractA: 'Net 30',
              contractB: 'Net 45'
            },
            totalValueDifference: 600000
          },
          riskComparison: {
            contractA: [
              { type: 'Financial', level: 'low', description: 'Standard payment terms' },
              { type: 'Legal', level: 'medium', description: 'Limited liability clause' },
              { type: 'Operational', level: 'low', description: 'Clear SLA definitions' }
            ],
            contractB: [
              { type: 'Financial', level: 'medium', description: 'Extended payment terms' },
              { type: 'Legal', level: 'high', description: 'Unlimited liability exposure' },
              { type: 'Operational', level: 'medium', description: 'Vague performance metrics' }
            ]
          },
          recommendations: [
            {
              type: 'risk-mitigation',
              title: 'Add Liability Cap to Contract B',
              description: 'Unlimited liability creates significant financial exposure. Recommend adding a cap of $500K-$1M.',
              priority: 'high'
            },
            {
              type: 'financial',
              title: 'Standardize Payment Terms',
              description: 'Align payment terms to Net 30 across all contracts to improve cash flow management.',
              priority: 'medium'
            },
            {
              type: 'compliance',
              title: 'Clarify IP Ownership',
              description: 'Establish consistent IP ownership model to prevent future disputes and ensure compliance.',
              priority: 'high'
            },
            {
              type: 'optimization',
              title: 'Performance Metrics Alignment',
              description: 'Standardize SLA definitions and performance metrics across similar contract types.',
              priority: 'medium'
            }
          ]
        });
        setLoading(false);
      }, 2000);
    };

    loadComparison();
  }, []);

  const getRiskColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'risk-mitigation': return <AlertTriangle className="w-4 h-4" />;
      case 'financial': return <DollarSign className="w-4 h-4" />;
      case 'compliance': return <CheckCircle className="w-4 h-4" />;
      case 'optimization': return <TrendingUp className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-y-4">
              <div className="text-center">
                <Brain className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">AI Contract Analysis in Progress</h3>
                <p className="text-gray-500">Comparing contracts and generating insights...</p>
                <div className="mt-4 w-64 mx-auto">
                  <Progress value={65} className="h-2" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!comparison) return null;

  return (
    <div className="space-y-6">
      {/* Comparison Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            AI-Powered Contract Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Contract A */}
            <div className="text-center">
              <div className="p-4 bg-blue-50 rounded-lg mb-3">
                <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <h3 className="font-medium text-gray-900">{comparison.contractA.name}</h3>
                <p className="text-sm text-gray-500">{comparison.contractA.type}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Value:</span>
                  <span className="font-medium">${(comparison.contractA.value / 1000000).toFixed(1)}M</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk Score:</span>
                  <Badge className={getRiskColor(comparison.contractA.riskScore > 30 ? 'high' : 'low')}>
                    {comparison.contractA.riskScore}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Compliance:</span>
                  <span className="font-medium">{comparison.contractA.complianceScore}%</span>
                </div>
              </div>
            </div>

            {/* Similarity Score */}
            <div className="text-center">
              <div className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg">
                <ArrowLeftRight className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {comparison.similarityScore}%
                </div>
                <p className="text-sm text-gray-600">Similarity Score</p>
                <div className="mt-3">
                  <Progress value={comparison.similarityScore} className="h-2" />
                </div>
              </div>
            </div>

            {/* Contract B */}
            <div className="text-center">
              <div className="p-4 bg-green-50 rounded-lg mb-3">
                <FileText className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h3 className="font-medium text-gray-900">{comparison.contractB.name}</h3>
                <p className="text-sm text-gray-500">{comparison.contractB.type}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Value:</span>
                  <span className="font-medium">${(comparison.contractB.value / 1000000).toFixed(1)}M</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk Score:</span>
                  <Badge className={getRiskColor(comparison.contractB.riskScore > 30 ? 'high' : 'low')}>
                    {comparison.contractB.riskScore}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Compliance:</span>
                  <span className="font-medium">{comparison.contractB.complianceScore}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Selector */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'overview', label: 'Overview', icon: <Eye className="w-4 h-4" /> },
          { id: 'differences', label: 'Key Differences', icon: <ArrowLeftRight className="w-4 h-4" /> },
          { id: 'financial', label: 'Financial', icon: <DollarSign className="w-4 h-4" /> },
          { id: 'risk', label: 'Risk Analysis', icon: <AlertTriangle className="w-4 h-4" /> }
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setSelectedView(view.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedView === view.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {view.icon}
            {view.label}
          </button>
        ))}
      </div>

      {/* Content based on selected view */}
      {selectedView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comparison.recommendations.map((rec, index) => (
                  <div key={index} className="p-4 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gray-50 rounded-lg">
                        {getRecommendationIcon(rec.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{rec.title}</h4>
                          <Badge className={getPriorityColor(rec.priority)}>
                            {rec.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{rec.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Comparison Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Contract Value Difference</span>
                  <span className="text-lg font-bold text-green-600">
                    +${(comparison.financialComparison.totalValueDifference / 1000000).toFixed(1)}M
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Rate Difference</span>
                  <span className="text-lg font-bold text-blue-600">
                    +{comparison.financialComparison.ratesDifference}%
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Key Differences Found</span>
                  <span className="text-lg font-bold text-orange-600">
                    {comparison.keyDifferences.length}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">High Priority Issues</span>
                  <span className="text-lg font-bold text-red-600">
                    {comparison.keyDifferences.filter(d => d.impact === 'high').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedView === 'differences' && (
        <Card>
          <CardHeader>
            <CardTitle>Key Differences Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {comparison.keyDifferences.map((diff, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">{diff.category} - {diff.field}</h4>
                    <Badge className={getImpactColor(diff.impact)}>
                      {diff.impact} impact
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <h5 className="text-sm font-medium text-blue-900 mb-1">Contract A</h5>
                      <p className="text-sm text-blue-700">{diff.contractA}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <h5 className="text-sm font-medium text-green-900 mb-1">Contract B</h5>
                      <p className="text-sm text-green-700">{diff.contractB}</p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <h5 className="text-sm font-medium text-yellow-900 mb-1">AI Recommendation</h5>
                    <p className="text-sm text-yellow-700">{diff.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Options */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Export Comparison Report</h3>
              <p className="text-sm text-gray-500">Download detailed analysis and recommendations</p>
            </div>
            <Button className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}