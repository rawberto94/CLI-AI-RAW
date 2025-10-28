'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, DollarSign, Target, Lightbulb, AlertTriangle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SavingsAnalysis {
  currentRate: number;
  marketMedian: number;
  marketP25: number;
  marketP10: number;
  savingsToMedian: number;
  savingsToP25: number;
  savingsToP10: number;
  savingsPercentToMedian: number;
  savingsPercentToP25: number;
  savingsPercentToP10: number;
  annualSavings?: number;
  isAboveMarket: boolean;
}

interface BestRateComparison {
  bestRate: number;
  bestRateSupplier: string;
  dailySavings: number;
  savingsPercentage: number;
  annualSavings?: number;
  recommendation: string;
}

interface SavingsAnalysisSectionProps {
  savingsAnalysis?: SavingsAnalysis;
  bestRateComparison?: BestRateComparison;
  volumeCommitted?: number;
  roleStandardized?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getSavingsColor(savingsPercent: number): string {
  if (savingsPercent >= 20) return 'text-red-600';
  if (savingsPercent >= 10) return 'text-orange-600';
  if (savingsPercent >= 5) return 'text-yellow-600';
  return 'text-green-600';
}

function generateRecommendations(
  savingsAnalysis: SavingsAnalysis,
  bestRateComparison?: BestRateComparison,
  roleStandardized?: string
): string[] {
  const recommendations: string[] = [];

  // Check if rate is above market
  if (savingsAnalysis.isAboveMarket) {
    if (savingsAnalysis.savingsPercentToP25 >= 20) {
      recommendations.push(
        `🔴 High Priority: Current rate is ${formatPercent(savingsAnalysis.savingsPercentToP25)} above market P25. Immediate renegotiation recommended.`
      );
    } else if (savingsAnalysis.savingsPercentToP25 >= 10) {
      recommendations.push(
        `🟡 Medium Priority: Rate is ${formatPercent(savingsAnalysis.savingsPercentToP25)} above market P25. Schedule renegotiation within next quarter.`
      );
    } else if (savingsAnalysis.savingsPercentToMedian > 0) {
      recommendations.push(
        `🟢 Low Priority: Rate is slightly above market median. Consider renegotiation at contract renewal.`
      );
    }

    // Add specific target recommendation
    recommendations.push(
      `Target rate: ${formatCurrency(savingsAnalysis.marketP25)}/day (market 25th percentile) for competitive positioning.`
    );

    // Add annual savings context if available
    if (savingsAnalysis.annualSavings && savingsAnalysis.annualSavings > 10000) {
      recommendations.push(
        `Potential annual savings: ${formatCurrency(savingsAnalysis.annualSavings)} by moving to P25 rate.`
      );
    }
  } else {
    recommendations.push(
      `✅ Excellent: Your rate is at or below market median. No immediate action needed.`
    );
  }

  // Add best rate comparison if available
  if (bestRateComparison && bestRateComparison.dailySavings > 0) {
    if (bestRateComparison.savingsPercentage >= 15) {
      recommendations.push(
        `Consider ${bestRateComparison.bestRateSupplier} who offers ${formatCurrency(bestRateComparison.bestRate)}/day (${formatPercent(bestRateComparison.savingsPercentage)} savings).`
      );
    }
  }

  // Add volume-based recommendation
  if (savingsAnalysis.annualSavings && savingsAnalysis.annualSavings > 50000) {
    recommendations.push(
      `High savings potential justifies dedicated negotiation effort and potential supplier switch evaluation.`
    );
  }

  return recommendations;
}

// ============================================================================
// Savings Card Component
// ============================================================================

function SavingsCard({
  title,
  targetRate,
  currentRate,
  dailySavings,
  savingsPercent,
  annualSavings,
  icon: Icon,
  variant = 'default',
}: {
  title: string;
  targetRate: number;
  currentRate: number;
  dailySavings: number;
  savingsPercent: number;
  annualSavings?: number;
  icon: React.ElementType;
  variant?: 'default' | 'best';
}) {
  const hasSavings = dailySavings > 0;

  return (
    <div className={`p-4 rounded-lg border ${variant === 'best' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${variant === 'best' ? 'text-blue-600' : 'text-gray-600'}`} />
          <div className="text-sm font-medium text-gray-700">{title}</div>
        </div>
        {hasSavings && (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            Save {formatPercent(savingsPercent)}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-600">Target Rate:</span>
          <span className="text-lg font-bold text-gray-900">{formatCurrency(targetRate)}/day</span>
        </div>
        
        {hasSavings ? (
          <>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-600">Daily Savings:</span>
              <span className={`text-base font-semibold ${getSavingsColor(savingsPercent)}`}>
                {formatCurrency(dailySavings)}
              </span>
            </div>
            
            {annualSavings && (
              <div className="flex justify-between items-baseline pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-600">Annual Savings:</span>
                <span className={`text-xl font-bold ${getSavingsColor(savingsPercent)}`}>
                  {formatCurrency(annualSavings)}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-green-600 font-medium">
            ✓ Already at or below this benchmark
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Savings Analysis Section Component
// ============================================================================

// Mock/Default data
const defaultSavingsAnalysis: SavingsAnalysis = {
  currentRate: 920,
  marketMedian: 825,
  marketP25: 725,
  marketP10: 650,
  savingsToMedian: 95,
  savingsToP25: 195,
  savingsToP10: 270,
  savingsPercentToMedian: 11.5,
  savingsPercentToP25: 26.9,
  savingsPercentToP10: 41.5,
  annualSavings: 20900,
  isAboveMarket: true,
};

const defaultBestRateComparison: BestRateComparison = {
  bestRate: 650,
  bestRateSupplier: 'TechStaff Solutions',
  dailySavings: 270,
  savingsPercentage: 41.5,
  annualSavings: 59400,
  recommendation: 'Consider negotiating with TechStaff Solutions for significant cost reduction',
};

export function SavingsAnalysisSection(props: SavingsAnalysisSectionProps = {}) {
  const {
    savingsAnalysis = defaultSavingsAnalysis,
    bestRateComparison = defaultBestRateComparison,
    volumeCommitted = 1,
    roleStandardized = 'Senior Software Developer',
  } = props || {};
  
  const recommendations = generateRecommendations(
    savingsAnalysis,
    bestRateComparison,
    roleStandardized
  );

  const hasSignificantSavings = savingsAnalysis.savingsPercentToP25 >= 5;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-green-600" />
            Savings Analysis
          </CardTitle>
          {hasSignificantSavings && (
            <Badge className="bg-orange-100 text-orange-800 border-orange-300">
              Savings Opportunity
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Rate Display */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-700 mb-1">Current Rate</div>
              <div className="text-3xl font-bold text-blue-900">
                {formatCurrency(savingsAnalysis.currentRate)}
                <span className="text-base font-normal text-blue-700">/day</span>
              </div>
              {volumeCommitted && (
                <div className="text-xs text-blue-600 mt-1">
                  {volumeCommitted} days/year committed
                </div>
              )}
            </div>
            <DollarSign className="w-12 h-12 text-blue-400" />
          </div>
        </div>

        {/* Savings Opportunities Grid */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">Potential Savings Targets</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Savings to Median */}
            <SavingsCard
              title="vs Market Median (P50)"
              targetRate={savingsAnalysis.marketMedian}
              currentRate={savingsAnalysis.currentRate}
              dailySavings={savingsAnalysis.savingsToMedian}
              savingsPercent={savingsAnalysis.savingsPercentToMedian}
              annualSavings={volumeCommitted ? savingsAnalysis.savingsToMedian * volumeCommitted : undefined}
              icon={Target}
            />

            {/* Savings to P25 */}
            <SavingsCard
              title="vs Market P25 (Competitive)"
              targetRate={savingsAnalysis.marketP25}
              currentRate={savingsAnalysis.currentRate}
              dailySavings={savingsAnalysis.savingsToP25}
              savingsPercent={savingsAnalysis.savingsPercentToP25}
              annualSavings={savingsAnalysis.annualSavings}
              icon={TrendingDown}
            />
          </div>
        </div>

        {/* Best Rate Comparison */}
        {bestRateComparison && bestRateComparison.dailySavings > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-3">Best Rate in Market</div>
            <SavingsCard
              title={`Best Rate (${bestRateComparison.bestRateSupplier})`}
              targetRate={bestRateComparison.bestRate}
              currentRate={savingsAnalysis.currentRate}
              dailySavings={bestRateComparison.dailySavings}
              savingsPercent={bestRateComparison.savingsPercentage}
              annualSavings={bestRateComparison.annualSavings}
              icon={Target}
              variant="best"
            />
          </div>
        )}

        {/* Annual Savings Summary */}
        {savingsAnalysis.annualSavings && savingsAnalysis.annualSavings > 0 && (
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-700" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-green-900 mb-1">
                  Total Annual Savings Potential
                </div>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(savingsAnalysis.annualSavings)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  By negotiating to market P25 rate ({formatCurrency(savingsAnalysis.marketP25)}/day)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-600" />
            <div className="text-sm font-medium text-gray-700">Actionable Recommendations</div>
          </div>
          <div className="space-y-2">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg"
              >
                <div className="text-sm text-amber-900 leading-relaxed">{rec}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Warning for no savings */}
        {!savingsAnalysis.isAboveMarket && (
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <strong>Excellent Rate:</strong> Your current rate is at or below market median. 
              Focus on maintaining this competitive position at renewal.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
