'use client';

/**
 * Comparison Analytics Component
 * 
 * Provides analytics for rate card comparisons including:
 * - Potential savings calculations
 * - Market position analysis
 * - Switching recommendations
 * Requirements: 6.4
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingDown,
  TrendingUp,
  DollarSign,
  Award,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  BarChart3
} from 'lucide-react';

interface RateCardEntry {
  id: string;
  supplierName: string;
  roleStandardized: string;
  seniority: string;
  dailyRateUSD: number;
  volumeCommitted?: number;
  isNegotiated: boolean;
  country: string;
}

interface SavingsAnalysis {
  rateCardId: string;
  supplierName: string;
  currentRate: number;
  bestRate: number;
  dailySavings: number;
  annualSavings: number;
  annualSavingsPotential: number;
  savingsPercentage: number;
  volumeCommitted?: number;
}

interface MarketPosition {
  rateCardId: string;
  supplierName: string;
  percentileRank: number;
  position: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'ABOVE_AVERAGE' | 'POOR';
  competitorsBelow: number;
  competitorsAbove: number;
}

interface SwitchingRecommendation {
  fromRateCardId: string;
  toRateCardId: string;
  fromSupplier: string;
  toSupplier: string;
  potentialSavings: number;
  annualSavings: number;
  annualSavingsPotential: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  risks: string[];
  benefits: string[];
  recommendation: string;
}

interface ComparisonAnalyticsProps {
  rateCards: RateCardEntry[];
}

export function ComparisonAnalytics({ rateCards }: ComparisonAnalyticsProps) {
  const [savingsAnalysis, setSavingsAnalysis] = useState<SavingsAnalysis[]>([]);
  const [marketPositions, setMarketPositions] = useState<MarketPosition[]>([]);
  const [recommendations, setRecommendations] = useState<SwitchingRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateCards]);

  const calculateAnalytics = async () => {
    setLoading(true);
    try {
      // Calculate savings analysis
      const bestRate = Math.min(...rateCards.map(rc => rc.dailyRateUSD));
      const savings: SavingsAnalysis[] = rateCards.map(rc => {
        const dailySavings = rc.dailyRateUSD - bestRate;
        const annualSavings = rc.volumeCommitted 
          ? dailySavings * rc.volumeCommitted 
          : dailySavings * 220; // Assume 220 working days if not specified
        const savingsPercentage = bestRate > 0 ? (dailySavings / bestRate) * 100 : 0;

        return {
          rateCardId: rc.id,
          supplierName: rc.supplierName,
          currentRate: rc.dailyRateUSD,
          bestRate,
          dailySavings,
          annualSavings,
          annualSavingsPotential: annualSavings,
          savingsPercentage,
          volumeCommitted: rc.volumeCommitted || 220,
        };
      });
      setSavingsAnalysis(savings);

      // Calculate market positions
      const sortedRates = [...rateCards].sort((a, b) => a.dailyRateUSD - b.dailyRateUSD);
      const positions: MarketPosition[] = rateCards.map(rc => {
        const index = sortedRates.findIndex(sr => sr.id === rc.id);
        const percentileRank = ((index + 1) / sortedRates.length) * 100;
        
        let position: MarketPosition['position'];
        if (percentileRank <= 25) position = 'EXCELLENT';
        else if (percentileRank <= 50) position = 'GOOD';
        else if (percentileRank <= 75) position = 'AVERAGE';
        else if (percentileRank <= 90) position = 'ABOVE_AVERAGE';
        else position = 'POOR';

        return {
          rateCardId: rc.id,
          supplierName: rc.supplierName,
          percentileRank,
          position,
          competitorsBelow: index,
          competitorsAbove: sortedRates.length - index - 1,
        };
      });
      setMarketPositions(positions);

      // Generate switching recommendations
      const recs: SwitchingRecommendation[] = [];
      const bestRateCard = sortedRates[0];
      
      if (!bestRateCard) {
        setRecommendations(recs);
        return;
      }
      
      rateCards.forEach(rc => {
        if (rc.id !== bestRateCard.id) {
          const savings = rc.dailyRateUSD - bestRateCard.dailyRateUSD;
          const annualSavings = rc.volumeCommitted 
            ? savings * rc.volumeCommitted 
            : savings * 220;

          const risks: string[] = [];
          const benefits: string[] = [];
          let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';

          // Assess risks
          if (rc.country !== bestRateCard.country) {
            risks.push('Different geographic location may affect service delivery');
            confidence = 'MEDIUM';
          }
          if (!bestRateCard.isNegotiated) {
            risks.push('Best rate may not be negotiated yet');
            confidence = 'MEDIUM';
          }
          if (savings / rc.dailyRateUSD > 0.3) {
            risks.push('Large price difference may indicate quality concerns');
            confidence = 'LOW';
          }

          // Assess benefits
          benefits.push(`Save $${savings.toLocaleString()} per day`);
          benefits.push(`Annual savings of $${annualSavings.toLocaleString()}`);
          if (bestRateCard.isNegotiated) {
            benefits.push('Rate is already negotiated');
          }
          if (rc.country === bestRateCard.country) {
            benefits.push('Same geographic location');
          }

          let recommendation = '';
          if (confidence === 'HIGH') {
            recommendation = `Strong recommendation to switch from ${rc.supplierName} to ${bestRateCard.supplierName}. Significant savings with minimal risk.`;
          } else if (confidence === 'MEDIUM') {
            recommendation = `Consider switching from ${rc.supplierName} to ${bestRateCard.supplierName}. Good savings potential but evaluate risks carefully.`;
          } else {
            recommendation = `Cautiously evaluate switching from ${rc.supplierName} to ${bestRateCard.supplierName}. Large price difference warrants thorough due diligence.`;
          }

          recs.push({
            fromRateCardId: rc.id,
            toRateCardId: bestRateCard.id,
            fromSupplier: rc.supplierName,
            toSupplier: bestRateCard.supplierName,
            potentialSavings: savings,
            annualSavings,
            annualSavingsPotential: annualSavings,
            confidence,
            risks,
            benefits,
            recommendation,
          });
        }
      });
      setRecommendations(recs);

    } catch {
      // Error calculating analytics
    } finally {
      setLoading(false);
    }
  };

  const getPositionBadge = (position: MarketPosition['position']) => {
    const config = {
      EXCELLENT: { color: 'bg-green-600', label: 'Excellent' },
      GOOD: { color: 'bg-violet-600', label: 'Good' },
      AVERAGE: { color: 'bg-yellow-600', label: 'Average' },
      ABOVE_AVERAGE: { color: 'bg-orange-600', label: 'Above Average' },
      POOR: { color: 'bg-red-600', label: 'Poor' },
    };
    const { color, label } = config[position];
    return <Badge className={color}>{label}</Badge>;
  };

  const getConfidenceBadge = (confidence: 'HIGH' | 'MEDIUM' | 'LOW') => {
    const config = {
      HIGH: { color: 'bg-green-600', label: 'High Confidence' },
      MEDIUM: { color: 'bg-yellow-600', label: 'Medium Confidence' },
      LOW: { color: 'bg-red-600', label: 'Low Confidence' },
    };
    const { color, label } = config[confidence];
    return <Badge className={color}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Calculating analytics...</p>
      </div>
    );
  }

  const totalPotentialSavings = savingsAnalysis.reduce((sum, s) => sum + s.annualSavingsPotential, 0);
  const avgSavingsPercentage = savingsAnalysis.length > 0
    ? savingsAnalysis.reduce((sum, s) => sum + s.savingsPercentage, 0) / savingsAnalysis.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Potential Savings</p>
                <p className="text-2xl font-bold text-green-600">
                  ${totalPotentialSavings.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">per year</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-violet-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Savings Potential</p>
                <p className="text-2xl font-bold text-violet-600">
                  {avgSavingsPercentage.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">vs best rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recommendations</p>
                <p className="text-2xl font-bold text-purple-600">
                  {recommendations.length}
                </p>
                <p className="text-xs text-muted-foreground">switching options</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Savings Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Savings Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {savingsAnalysis.map((analysis) => (
              <div
                key={analysis.rateCardId}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{analysis.supplierName}</p>
                  <p className="text-sm text-muted-foreground">
                    Current: ${analysis.currentRate.toLocaleString()} USD/day
                  </p>
                </div>
                <div className="text-right">
                  {analysis.dailySavings === 0 ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <Award className="h-5 w-5" />
                      <span className="font-semibold">Best Rate</span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-bold text-red-600">
                        ${analysis.dailySavings.toLocaleString()}/day
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ${analysis.annualSavingsPotential.toLocaleString()}/year potential
                      </p>
                      <Badge variant="outline" className="mt-1">
                        +{analysis.savingsPercentage.toFixed(1)}% vs best
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Market Position Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market Position</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {marketPositions.map((position) => (
              <div
                key={position.rateCardId}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">{position.supplierName}</p>
                    {getPositionBadge(position.position)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {position.percentileRank.toFixed(0)}th percentile
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Better than</p>
                      <p className="text-lg font-semibold text-green-600">
                        {position.competitorsBelow} options
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Worse than</p>
                      <p className="text-lg font-semibold text-red-600">
                        {position.competitorsAbove} options
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Switching Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Switching Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{rec.fromSupplier}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-green-600">{rec.toSupplier}</span>
                    </div>
                    {getConfidenceBadge(rec.confidence)}
                  </div>

                  {/* Savings */}
                  <div className="flex items-center gap-6 p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Daily Savings</p>
                      <p className="text-xl font-bold text-green-600">
                        ${rec.potentialSavings.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Annual Savings</p>
                      <p className="text-xl font-bold text-green-600">
                        ${rec.annualSavingsPotential.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Recommendation */}
                  <div className="p-3 bg-violet-50 rounded-lg">
                    <p className="text-sm">{rec.recommendation}</p>
                  </div>

                  {/* Benefits and Risks */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Benefits
                      </p>
                      <ul className="space-y-1">
                        {rec.benefits.map((benefit, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-green-600 mt-0.5">•</span>
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        Risks to Consider
                      </p>
                      <ul className="space-y-1">
                        {rec.risks.map((risk, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-orange-600 mt-0.5">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
