/**
 * Mock Data for Supplier Analytics
 * 
 * This module provides realistic mock data for supplier analytics functionality.
 */

import { SupplierAnalyticsData, SupplierAnalyticsRequest } from '../../../../packages/data-orchestration/src/types/data-provider.types';

// Sample suppliers with different profiles
const SUPPLIERS = [
  {
    id: 'SUP001',
    name: 'TechCorp Solutions',
    profile: 'large-enterprise',
    specialties: ['Software Development', 'Cloud Architecture'],
    region: 'North America'
  },
  {
    id: 'SUP002', 
    name: 'Global IT Services',
    profile: 'multinational',
    specialties: ['Data Analytics', 'Cybersecurity'],
    region: 'Global'
  },
  {
    id: 'SUP003',
    name: 'Innovation Partners',
    profile: 'boutique',
    specialties: ['UI/UX Design', 'Product Strategy'],
    region: 'Europe'
  },
  {
    id: 'SUP004',
    name: 'Digital Dynamics',
    profile: 'mid-market',
    specialties: ['DevOps Engineering', 'Quality Assurance'],
    region: 'Asia Pacific'
  },
  {
    id: 'SUP005',
    name: 'NextGen Technologies',
    profile: 'startup',
    specialties: ['AI/ML', 'Blockchain'],
    region: 'North America'
  }
];

/**
 * Generate mock supplier analytics data
 */
export function generateSupplierAnalyticsMock(
  request?: SupplierAnalyticsRequest
): SupplierAnalyticsData {
  const supplier = getSupplierById(request?.supplierId) || getRandomSupplier();
  const timeframe = request?.timeframe || '12months';
  
  return {
    performance: generatePerformanceMetrics(supplier),
    financialHealth: generateFinancialHealth(supplier),
    relationships: generateRelationshipMetrics(supplier),
    trends: generateTrendData(supplier, timeframe)
  };
}

/**
 * Generate performance metrics based on supplier profile
 */
function generatePerformanceMetrics(supplier: any): {
  deliveryScore: number;
  qualityScore: number;
  costEfficiency: number;
  riskScore: number;
} {
  // Base scores vary by supplier profile
  const profileMultipliers = {
    'large-enterprise': { delivery: 0.85, quality: 0.9, cost: 0.7, risk: 0.2 },
    'multinational': { delivery: 0.8, quality: 0.85, cost: 0.75, risk: 0.25 },
    'boutique': { delivery: 0.9, quality: 0.95, cost: 0.6, risk: 0.4 },
    'mid-market': { delivery: 0.85, quality: 0.8, cost: 0.85, risk: 0.3 },
    'startup': { delivery: 0.75, quality: 0.7, cost: 0.9, risk: 0.6 }
  };
  
  const multipliers = profileMultipliers[supplier.profile as keyof typeof profileMultipliers] || 
                      profileMultipliers['mid-market'];
  
  return {
    deliveryScore: Math.round(multipliers.delivery * 100),
    qualityScore: Math.round(multipliers.quality * 100),
    costEfficiency: Math.round(multipliers.cost * 100),
    riskScore: Math.round(multipliers.risk * 100)
  };
}

/**
 * Generate financial health metrics
 */
function generateFinancialHealth(supplier: any): {
  creditRating: string;
  revenue: number;
  profitMargin: number;
  debtRatio: number;
} {
  const profileFinancials = {
    'large-enterprise': { 
      rating: 'AAA', 
      revenue: 5000000000, 
      margin: 0.15, 
      debt: 0.3 
    },
    'multinational': { 
      rating: 'AA', 
      revenue: 10000000000, 
      margin: 0.12, 
      debt: 0.4 
    },
    'boutique': { 
      rating: 'A', 
      revenue: 50000000, 
      margin: 0.20, 
      debt: 0.2 
    },
    'mid-market': { 
      rating: 'BBB', 
      revenue: 500000000, 
      margin: 0.10, 
      debt: 0.5 
    },
    'startup': { 
      rating: 'BB', 
      revenue: 10000000, 
      margin: -0.05, 
      debt: 0.7 
    }
  };
  
  const financials = profileFinancials[supplier.profile as keyof typeof profileFinancials] || 
                     profileFinancials['mid-market'];
  
  return {
    creditRating: financials.rating,
    revenue: financials.revenue,
    profitMargin: financials.margin,
    debtRatio: financials.debt
  };
}

/**
 * Generate relationship metrics
 */
function generateRelationshipMetrics(supplier: any): {
  contractCount: number;
  totalValue: number;
  averageContractLength: number;
  renewalRate: number;
} {
  const profileRelationships = {
    'large-enterprise': { contracts: 25, value: 50000000, length: 36, renewal: 0.85 },
    'multinational': { contracts: 40, value: 75000000, length: 24, renewal: 0.80 },
    'boutique': { contracts: 8, value: 5000000, length: 12, renewal: 0.90 },
    'mid-market': { contracts: 15, value: 20000000, length: 24, renewal: 0.75 },
    'startup': { contracts: 5, value: 2000000, length: 12, renewal: 0.60 }
  };
  
  const relationships = profileRelationships[supplier.profile as keyof typeof profileRelationships] || 
                        profileRelationships['mid-market'];
  
  return {
    contractCount: relationships.contracts,
    totalValue: relationships.value,
    averageContractLength: relationships.length,
    renewalRate: relationships.renewal
  };
}

/**
 * Generate trend data
 */
function generateTrendData(supplier: any, timeframe: string): Array<{
  metric: string;
  values: { period: string; value: number }[];
}> {
  const months = timeframe === '12months' ? 12 : timeframe === '6months' ? 6 : 24;
  const metrics = ['deliveryScore', 'qualityScore', 'costEfficiency', 'riskScore'];
  
  return metrics.map(metric => ({
    metric,
    values: generateMetricTrend(metric, months)
  }));
}

/**
 * Generate trend values for a specific metric
 */
function generateMetricTrend(metric: string, months: number): Array<{
  period: string;
  value: number;
}> {
  const baseValue = Math.random() * 30 + 60; // 60-90 base
  const trend = Math.random() > 0.5 ? 1 : -1; // Improving or declining
  
  return Array.from({ length: months }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (months - i - 1));
    const period = date.toISOString().substring(0, 7);
    
    const trendEffect = (i / months) * trend * 10;
    const volatility = (Math.random() - 0.5) * 5;
    const value = Math.max(0, Math.min(100, baseValue + trendEffect + volatility));
    
    return {
      period,
      value: Math.round(value * 10) / 10
    };
  });
}

/**
 * Get supplier by ID
 */
function getSupplierById(id?: string): any {
  if (!id) return null;
  return SUPPLIERS.find(s => s.id === id);
}

/**
 * Get random supplier
 */
function getRandomSupplier(): any {
  return SUPPLIERS[Math.floor(Math.random() * SUPPLIERS.length)];
}

/**
 * Predefined scenarios
 */
export const supplierAnalyticsScenarios = {
  topPerformer: (): SupplierAnalyticsData => generateSupplierAnalyticsMock({
    supplierId: 'SUP003' // Boutique firm
  }),
  
  riskyCheap: (): SupplierAnalyticsData => generateSupplierAnalyticsMock({
    supplierId: 'SUP005' // Startup
  }),
  
  reliable: (): SupplierAnalyticsData => generateSupplierAnalyticsMock({
    supplierId: 'SUP001' // Large enterprise
  }),
  
  global: (): SupplierAnalyticsData => generateSupplierAnalyticsMock({
    supplierId: 'SUP002' // Multinational
  })
};

export const sampleSupplierAnalyticsRequests: SupplierAnalyticsRequest[] = [
  { supplierId: 'SUP001', timeframe: '12months' },
  { supplierId: 'SUP002', timeframe: '6months', metrics: ['deliveryScore', 'qualityScore'] },
  { supplierId: 'SUP003', timeframe: '24months' }
];
