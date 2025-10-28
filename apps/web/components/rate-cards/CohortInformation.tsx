'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, Calendar, TrendingUp, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface BenchmarkCohortCriteria {
  roleStandardized: string;
  seniority: string;
  country?: string;
  region?: string;
  lineOfService?: string;
  supplierTier?: string;
  periodMonths?: number;
}

interface CohortInformationProps {
  cohortDefinition?: BenchmarkCohortCriteria;
  sampleSize?: number;
  competitorCount?: number;
  periodStart?: Date;
  periodEnd?: Date;
  confidence?: number;
  calculatedAt?: Date;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getConfidenceLevel(confidence: number): {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  label: string;
  color: string;
  icon: React.ElementType;
} {
  if (confidence >= 0.8) {
    return {
      level: 'HIGH',
      label: 'High Confidence',
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: CheckCircle2,
    };
  } else if (confidence >= 0.5) {
    return {
      level: 'MEDIUM',
      label: 'Medium Confidence',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: Info,
    };
  } else {
    return {
      level: 'LOW',
      label: 'Low Confidence',
      color: 'bg-orange-100 text-orange-800 border-orange-300',
      icon: AlertTriangle,
    };
  }
}

function getSampleSizeQuality(sampleSize: number): {
  quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  label: string;
  color: string;
} {
  if (sampleSize >= 50) {
    return { quality: 'EXCELLENT', label: 'Excellent', color: 'text-green-600' };
  } else if (sampleSize >= 20) {
    return { quality: 'GOOD', label: 'Good', color: 'text-blue-600' };
  } else if (sampleSize >= 10) {
    return { quality: 'FAIR', label: 'Fair', color: 'text-yellow-600' };
  } else {
    return { quality: 'POOR', label: 'Limited', color: 'text-orange-600' };
  }
}

function formatDateRange(start: Date, end: Date): string {
  const startStr = new Date(start).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
  const endStr = new Date(end).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
  return `${startStr} - ${endStr}`;
}

function getDataQualityInsights(
  sampleSize: number,
  competitorCount: number,
  confidence: number
): string[] {
  const insights: string[] = [];

  // Sample size insights
  if (sampleSize >= 50) {
    insights.push('✓ Large sample size provides highly reliable benchmark data');
  } else if (sampleSize >= 20) {
    insights.push('✓ Good sample size for reliable benchmarking');
  } else if (sampleSize >= 10) {
    insights.push('⚠ Moderate sample size - benchmark should be validated with additional sources');
  } else if (sampleSize >= 5) {
    insights.push('⚠ Small sample size - use benchmark with caution');
  } else {
    insights.push('⚠ Very limited data - benchmark may not be representative');
  }

  // Competitor diversity insights
  if (competitorCount >= 10) {
    insights.push('✓ High supplier diversity ensures competitive market view');
  } else if (competitorCount >= 5) {
    insights.push('✓ Good supplier diversity in cohort');
  } else if (competitorCount >= 3) {
    insights.push('⚠ Limited supplier diversity - consider expanding market research');
  } else {
    insights.push('⚠ Very few suppliers in cohort - market may be concentrated or data limited');
  }

  // Confidence insights
  if (confidence >= 0.8) {
    insights.push('✓ High confidence in benchmark accuracy');
  } else if (confidence < 0.5) {
    insights.push('⚠ Low confidence - recommend gathering more market data');
  }

  // Data recency
  insights.push('ℹ Benchmark based on rates from the last 12 months');

  return insights;
}

// ============================================================================
// Cohort Criteria Display Component
// ============================================================================

function CohortCriteriaDisplay({ criteria }: { criteria: BenchmarkCohortCriteria }) {
  const criteriaItems = [
    { label: 'Role', value: criteria.roleStandardized },
    { label: 'Seniority', value: criteria.seniority },
    { label: 'Country', value: criteria.country || 'All' },
    { label: 'Region', value: criteria.region || 'All' },
    { label: 'Line of Service', value: criteria.lineOfService || 'All' },
    { label: 'Supplier Tier', value: criteria.supplierTier || 'All' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {criteriaItems.map((item, idx) => (
        <div key={idx} className="flex flex-col">
          <span className="text-xs text-gray-500 mb-1">{item.label}</span>
          <span className="text-sm font-medium text-gray-900 truncate" title={item.value}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Metric Card Component
// ============================================================================

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  quality,
  qualityLabel,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtitle?: string;
  quality?: string;
  qualityLabel?: string;
}) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-sm text-gray-600">{label}</div>
        </div>
        {qualityLabel && (
          <Badge variant="outline" className="text-xs">
            {qualityLabel}
          </Badge>
        )}
      </div>
      <div className={`text-2xl font-bold ${quality || 'text-gray-900'}`}>
        {value}
      </div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

// ============================================================================
// Main Cohort Information Component
// ============================================================================

// Mock/Default data
const defaultCohortDefinition: BenchmarkCohortCriteria = {
  roleStandardized: 'Senior Software Developer',
  seniority: 'SENIOR',
  country: 'United States',
  region: 'North America',
  lineOfService: 'Technology Consulting',
  supplierTier: 'TIER_1',
  periodMonths: 12,
};

const defaultPeriodStart = new Date('2024-10-28');
const defaultPeriodEnd = new Date('2025-10-28');

export function CohortInformation(props: CohortInformationProps = {}) {
  const {
    cohortDefinition = defaultCohortDefinition,
    sampleSize = 45,
    competitorCount = 12,
    periodStart = defaultPeriodStart,
    periodEnd = defaultPeriodEnd,
    confidence = 0.85,
    calculatedAt = new Date(),
  } = props || {};
  
  const confidenceInfo = getConfidenceLevel(confidence);
  const sampleQuality = getSampleSizeQuality(sampleSize);
  const insights = getDataQualityInsights(sampleSize, competitorCount, confidence);
  const ConfidenceIcon = confidenceInfo.icon;

  const isInsufficientData = sampleSize < 10 || competitorCount < 3;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Cohort Information
          </CardTitle>
          <Badge className={confidenceInfo.color}>
            <ConfidenceIcon className="w-3 h-3 mr-1" />
            {confidenceInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Insufficient Data Warning */}
        {isInsufficientData && (
          <div className="flex items-start gap-2 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-orange-900 mb-1">
                Insufficient Cohort Data
              </div>
              <div className="text-sm text-orange-800">
                {sampleSize < 10 && `Only ${sampleSize} comparable rates found. `}
                {competitorCount < 3 && `Only ${competitorCount} competing suppliers. `}
                Benchmark results should be validated with additional market research.
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">Cohort Metrics</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={TrendingUp}
              label="Sample Size"
              value={sampleSize}
              subtitle="comparable rates"
              quality={sampleQuality.color}
              qualityLabel={sampleQuality.label}
            />
            <MetricCard
              icon={Building2}
              label="Competitors"
              value={competitorCount}
              subtitle="unique suppliers"
            />
            <MetricCard
              icon={Calendar}
              label="Time Period"
              value={cohortDefinition.periodMonths || 12}
              subtitle="months of data"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Confidence"
              value={`${(confidence * 100).toFixed(0)}%`}
              subtitle={confidenceInfo.label.toLowerCase()}
              quality={
                confidence >= 0.8
                  ? 'text-green-600'
                  : confidence >= 0.5
                  ? 'text-yellow-600'
                  : 'text-orange-600'
              }
            />
          </div>
        </div>

        {/* Date Range */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600 mb-1">Data Period</div>
              <div className="text-base font-semibold text-gray-900">
                {formatDateRange(periodStart, periodEnd)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Last Updated</div>
              <div className="text-sm font-medium text-gray-900">
                {new Date(calculatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Cohort Criteria */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">Cohort Definition</div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <CohortCriteriaDisplay criteria={cohortDefinition} />
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Rates matching these criteria were used to calculate the benchmark
          </div>
        </div>

        {/* Data Quality Insights */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-3">Data Quality Insights</div>
          <div className="space-y-2">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div className="text-sm text-gray-700 leading-relaxed">{insight}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations for improving data quality */}
        {(sampleSize < 20 || competitorCount < 5) && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-900 mb-2">
                  Improve Benchmark Accuracy
                </div>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  {sampleSize < 20 && (
                    <li>Add more rate card entries for this role and location</li>
                  )}
                  {competitorCount < 5 && (
                    <li>Include rates from additional suppliers to increase market coverage</li>
                  )}
                  <li>Consider broadening criteria (e.g., include adjacent regions or seniority levels)</li>
                  <li>Supplement with external market research or industry reports</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
