'use client';

/**
 * Cluster Visualization Component
 * 
 * Displays rate card clustering results with consolidation opportunities
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingDown,
  Users,
  DollarSign,
  MapPin,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Building2,
} from 'lucide-react';

interface ClusterCharacteristics {
  avgRate: number;
  minRate: number;
  maxRate: number;
  rateRange: { min: number; max: number };
  commonRoles: string[];
  commonGeographies: string[];
  supplierCount: number;
  seniorityDistribution: Record<string, number>;
  serviceLineDistribution: Record<string, number>;
}

interface Cluster {
  id: string;
  name: string;
  memberCount: number;
  avgRate: number;
  minRate: number;
  maxRate: number;
  characteristics: ClusterCharacteristics;
  consolidationSavings: number;
  supplierCount: number;
}

interface ConsolidationOpportunity {
  id: string;
  clusterId: string;
  opportunityName: string;
  currentSupplierCount: number;
  recommendedSupplierName: string;
  annualSavings: number;
  savingsPercentage: number;
  riskLevel: string;
  implementationComplexity: string;
  confidence: number;
}

interface ArbitrageOpportunity {
  id: string;
  clusterId: string;
  sourceCountry: string;
  targetCountry: string;
  annualSavingsPotential: number;
  savingsPercentage: number;
  riskLevel: string;
  feasibility: string;
}

interface ClusterVisualizationProps {
  clusters: Cluster[];
  consolidationOpportunities: ConsolidationOpportunity[];
  arbitrageOpportunities: ArbitrageOpportunity[];
  onClusterClick?: (clusterId: string) => void;
}

export function ClusterVisualization({
  clusters,
  consolidationOpportunities,
  arbitrageOpportunities,
  onClusterClick,
}: ClusterVisualizationProps) {
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW':
        return 'bg-green-100 text-green-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'LOW':
        return 'bg-green-100 text-green-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleCluster = (clusterId: string) => {
    setExpandedCluster(expandedCluster === clusterId ? null : clusterId);
  };

  const getClusterOpportunities = (clusterId: string) => {
    const consolidation = consolidationOpportunities.find((o) => o.clusterId === clusterId);
    const arbitrage = arbitrageOpportunities.filter((o) => o.clusterId === clusterId);
    return { consolidation, arbitrage };
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Clusters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clusters.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Savings Potential
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${Math.round(
                clusters.reduce((sum, c) => sum + parseFloat(c.consolidationSavings.toString()), 0)
              ).toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-1">Annual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Consolidation Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consolidationOpportunities.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Arbitrage Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{arbitrageOpportunities.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Cluster List */}
      <div className="space-y-4">
        {clusters.map((cluster) => {
          const { consolidation, arbitrage } = getClusterOpportunities(cluster.id);
          const isExpanded = expandedCluster === cluster.id;

          return (
            <Card key={cluster.id} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => toggleCluster(cluster.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{cluster.name}</CardTitle>
                      {consolidation && (
                        <Badge variant="outline" className="bg-green-50">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          ${Math.round(consolidation.annualSavings).toLocaleString()}/yr
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      {cluster.memberCount} rate cards • {cluster.supplierCount} suppliers
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {/* Cluster Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <div className="text-xs text-gray-500">Avg Rate</div>
                    <div className="text-sm font-semibold">
                      ${Math.round(parseFloat(cluster.avgRate.toString()))}/day
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Rate Range</div>
                    <div className="text-sm font-semibold">
                      ${Math.round(parseFloat(cluster.minRate.toString()))} - $
                      {Math.round(parseFloat(cluster.maxRate.toString()))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Common Roles</div>
                    <div className="text-sm font-semibold">
                      {cluster.characteristics.commonRoles.slice(0, 2).join(', ')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Geographies</div>
                    <div className="text-sm font-semibold">
                      {cluster.characteristics.commonGeographies.slice(0, 2).join(', ')}
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Expanded Content */}
              {isExpanded && (
                <CardContent className="border-t bg-gray-50">
                  <div className="space-y-4 pt-4">
                    {/* Consolidation Opportunity */}
                    {consolidation && (
                      <div className="bg-white rounded-lg p-4 border">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold flex items-center gap-2">
                              <Building2 className="w-4 h-4" />
                              Consolidation Opportunity
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Consolidate {consolidation.currentSupplierCount} suppliers to{' '}
                              {consolidation.recommendedSupplierName}
                            </p>
                          </div>
                          <Badge className={getRiskColor(consolidation.riskLevel)}>
                            {consolidation.riskLevel} Risk
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-xs text-gray-500">Annual Savings</div>
                            <div className="text-lg font-bold text-green-600">
                              ${Math.round(consolidation.annualSavings).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Savings %</div>
                            <div className="text-lg font-bold">
                              {consolidation.savingsPercentage.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Complexity</div>
                            <Badge className={getComplexityColor(consolidation.implementationComplexity)}>
                              {consolidation.implementationComplexity}
                            </Badge>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">Confidence</div>
                            <div className="text-lg font-bold">
                              {Math.round(consolidation.confidence)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Geographic Arbitrage Opportunities */}
                    {arbitrage.length > 0 && (
                      <div className="bg-white rounded-lg p-4 border">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <MapPin className="w-4 h-4" />
                          Geographic Arbitrage Opportunities ({arbitrage.length})
                        </h4>
                        <div className="space-y-2">
                          {arbitrage.slice(0, 3).map((opp) => (
                            <div
                              key={opp.id}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded"
                            >
                              <div className="flex-1">
                                <div className="text-sm font-medium">
                                  {opp.sourceCountry} → {opp.targetCountry}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {opp.savingsPercentage.toFixed(1)}% savings potential
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold text-green-600">
                                  ${Math.round(opp.annualSavings).toLocaleString()}
                                </div>
                                <Badge className={getRiskColor(opp.riskLevel)} variant="outline">
                                  {opp.riskLevel}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cluster Members Preview */}
                    <div className="bg-white rounded-lg p-4 border">
                      <h4 className="font-semibold flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4" />
                        Cluster Members ({cluster.memberCount})
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onClusterClick?.(cluster.id)}
                      >
                        View All Members
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {clusters.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              No clusters found. Run clustering analysis to identify consolidation opportunities.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
