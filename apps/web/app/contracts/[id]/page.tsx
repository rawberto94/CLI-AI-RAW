'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArtifactDisplay, ArtifactData } from '@/components/contracts/ArtifactDisplay';
import { CostSavingsCard, CostSavingsAnalysis } from '@/components/contracts/CostSavingsCard';
import { 
  FileText, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Download
} from 'lucide-react';

interface ContractData {
  id: string;
  name: string;
  status: string;
  uploadedAt: string;
  artifacts?: ArtifactData[];
  costSavings?: CostSavingsAnalysis;
}

export default function ContractDetailPage() {
  const params = useParams();
  const contractId = params.id as string;
  
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  useEffect(() => {
    loadContractData();
  }, [contractId]);

  const loadContractData = async () => {
    try {
      setLoading(true);
      
      // In production, this would fetch from API
      // const response = await fetch(`/api/contracts/${contractId}`);
      // const data = await response.json();
      
      // Mock data for demonstration
      const mockData: ContractData = {
        id: contractId,
        name: 'Professional Services Agreement - Acme Corp',
        status: 'active',
        uploadedAt: new Date().toISOString(),
        artifacts: [
          {
            type: 'OVERVIEW',
            data: {
              summary: 'Professional services agreement for software development',
              contractType: 'Professional Services Agreement',
              parties: [
                { name: 'Acme Corp', role: 'client', type: 'corporation' },
                { name: 'Tech Solutions LLC', role: 'vendor', type: 'llc' }
              ],
              effectiveDate: '2024-01-01',
              expirationDate: '2025-01-01',
              term: '12 months'
            },
            confidence: 0.92,
            completeness: 95,
            method: 'ai',
            processingTime: 3200
          },
          {
            type: 'FINANCIAL',
            data: {
              totalValue: 500000,
              currency: 'USD',
              paymentTerms: ['Net 30', 'Monthly invoicing'],
              costSavingsOpportunities: [
                {
                  title: 'Early Payment Discount',
                  amount: 12500,
                  currency: 'USD',
                  confidence: 'high'
                }
              ]
            },
            confidence: 0.88,
            completeness: 85,
            method: 'ai',
            processingTime: 4100
          },
          {
            type: 'RATES',
            data: {
              rateCards: [
                { role: 'Senior Developer', level: 'L4', rate: 175, unit: 'hour', currency: 'USD', location: 'US' },
                { role: 'Junior Developer', level: 'L2', rate: 125, unit: 'hour', currency: 'USD', location: 'US' }
              ]
            },
            confidence: 0.85,
            completeness: 80,
            method: 'ai',
            processingTime: 3800
          },
          {
            type: 'CLAUSES',
            data: {
              clauses: [
                {
                  type: 'Termination',
                  content: 'Either party may terminate with 30 days notice',
                  riskLevel: 'low'
                }
              ]
            },
            confidence: 0.78,
            completeness: 75,
            method: 'hybrid',
            processingTime: 5200
          },
          {
            type: 'COMPLIANCE',
            data: {
              regulations: ['GDPR', 'SOC 2'],
              certifications: ['ISO 27001']
            },
            confidence: 0.82,
            completeness: 70,
            method: 'ai',
            processingTime: 3500
          },
          {
            type: 'RISK',
            data: {
              overallScore: 45,
              riskLevel: 'medium',
              riskFactors: [
                {
                  category: 'Financial',
                  severity: 'medium',
                  description: 'No rate increase cap specified'
                }
              ]
            },
            confidence: 0.80,
            completeness: 85,
            method: 'ai',
            processingTime: 4500
          }
        ],
        costSavings: {
          totalPotentialSavings: {
            amount: 125000,
            currency: 'USD',
            percentage: 25
          },
          opportunities: [
            {
              id: 'opp-1',
              category: 'rate_optimization',
              title: 'Location-Based Rate Optimization',
              description: 'Consider offshore/nearshore resources for suitable work',
              potentialSavings: {
                amount: 62500,
                currency: 'USD',
                percentage: 25,
                timeframe: 'annual'
              },
              confidence: 'high',
              effort: 'medium',
              priority: 5,
              actionItems: [
                'Identify work suitable for offshore delivery',
                'Request offshore rate cards from supplier',
                'Pilot offshore resources on non-critical work'
              ],
              implementationTimeline: '3-4 months',
              risks: ['Communication challenges', 'Time zone differences']
            },
            {
              id: 'opp-2',
              category: 'payment_terms',
              title: 'Early Payment Discount',
              description: 'Negotiate 2-3% discount for payment within 10-15 days',
              potentialSavings: {
                amount: 12500,
                currency: 'USD',
                percentage: 2.5,
                timeframe: 'annual'
              },
              confidence: 'high',
              effort: 'low',
              priority: 5,
              actionItems: [
                'Propose early payment discount to supplier',
                'Ensure cash flow supports early payment'
              ],
              implementationTimeline: '1 month',
              risks: ['Cash flow impact']
            },
            {
              id: 'opp-3',
              category: 'volume_discount',
              title: 'Volume Commitment Discount',
              description: 'Negotiate volume-based discounts by committing to minimum spend',
              potentialSavings: {
                amount: 25000,
                currency: 'USD',
                percentage: 5,
                timeframe: 'annual'
              },
              confidence: 'high',
              effort: 'low',
              priority: 4,
              actionItems: [
                'Analyze historical spend patterns',
                'Propose tiered volume discount structure'
              ],
              implementationTimeline: '1-2 months',
              risks: ['Commitment may reduce flexibility']
            }
          ],
          quickWins: [],
          strategicInitiatives: [],
          summary: {
            opportunityCount: 3,
            averageSavingsPerOpportunity: 33333,
            highConfidenceOpportunities: 3
          }
        }
      };

      // Categorize opportunities
      mockData.costSavings!.quickWins = mockData.costSavings!.opportunities.filter(
        opp => opp.confidence === 'high' && opp.effort === 'low'
      );
      mockData.costSavings!.strategicInitiatives = mockData.costSavings!.opportunities.filter(
        opp => opp.potentialSavings.amount > 50000 || opp.effort === 'high'
      );

      setContract(mockData);
    } catch (error) {
      console.error('Failed to load contract:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (artifactType: string) => {
    try {
      setRegenerating(artifactType);
      
      // In production, this would call the API
      // await fetch(`/api/contracts/${contractId}/artifacts/regenerate`, {
      //   method: 'POST',
      //   body: JSON.stringify({ artifactType, tenantId, userId, contractText })
      // });
      
      // Simulate regeneration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reload contract data
      await loadContractData();
    } catch (error) {
      console.error('Regeneration failed:', error);
    } finally {
      setRegenerating(null);
    }
  };

  const handleImplementOpportunity = async (opportunityId: string) => {
    try {
      // In production, this would call the API
      // await fetch('/api/analytics/cost-savings/track', {
      //   method: 'POST',
      //   body: JSON.stringify({ opportunityId, contractId, tenantId, userId, status: 'in_progress' })
      // });
      
      console.log('Tracking implementation for opportunity:', opportunityId);
    } catch (error) {
      console.error('Failed to track opportunity:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4" />
              <p>Contract not found</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const avgConfidence = contract.artifacts
    ? contract.artifacts.reduce((sum, a) => sum + (a.confidence || 0), 0) / contract.artifacts.length
    : 0;

  const avgCompleteness = contract.artifacts
    ? contract.artifacts.reduce((sum, a) => sum + (a.completeness || 0), 0) / contract.artifacts.length
    : 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{contract.name}</h1>
          <p className="text-gray-600 mt-2">Contract ID: {contract.id}</p>
          <div className="flex items-center gap-4 mt-4">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {contract.status}
            </Badge>
            <span className="text-sm text-gray-600">
              Uploaded {new Date(contract.uploadedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            View Document
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Artifacts</p>
                <p className="text-2xl font-bold">{contract.artifacts?.length || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Confidence</p>
                <p className="text-2xl font-bold">{Math.round(avgConfidence * 100)}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completeness</p>
                <p className="text-2xl font-bold">{Math.round(avgCompleteness)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Potential Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  ${(contract.costSavings?.totalPotentialSavings.amount || 0).toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="artifacts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="artifacts">
            <FileText className="h-4 w-4 mr-2" />
            Artifacts
          </TabsTrigger>
          <TabsTrigger value="savings">
            <DollarSign className="h-4 w-4 mr-2" />
            Cost Savings
          </TabsTrigger>
          <TabsTrigger value="analysis">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="artifacts" className="mt-6">
          {contract.artifacts && contract.artifacts.length > 0 ? (
            <ArtifactDisplay
              artifacts={contract.artifacts}
              onRegenerate={handleRegenerate}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No artifacts available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="savings" className="mt-6">
          {contract.costSavings ? (
            <CostSavingsCard
              analysis={contract.costSavings}
              contractId={contract.id}
              onImplement={handleImplementOpportunity}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No cost savings analysis available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Contract Analysis</CardTitle>
              <CardDescription>
                Detailed analysis and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Additional analysis features coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Regenerating Overlay */}
      {regenerating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardContent className="py-8 text-center">
              <RefreshCw className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-lg font-semibold">Regenerating {regenerating}...</p>
              <p className="text-sm text-gray-600 mt-2">This may take a few moments</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
