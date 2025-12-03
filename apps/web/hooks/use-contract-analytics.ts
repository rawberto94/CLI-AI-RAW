/**
 * Contract Analytics Hook
 * 
 * Provides computed analytics, trends, and insights for contracts.
 * Aggregates data for dashboards and reporting.
 */

import { useMemo, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface Contract {
  id: string;
  title: string;
  status: 'active' | 'pending' | 'expired' | 'draft' | 'cancelled';
  type: string;
  vendor?: string;
  value?: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  tags?: string[];
  department?: string;
  hasAutoRenewal?: boolean;
}

export interface ContractStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byRisk: Record<string, number>;
  byDepartment: Record<string, number>;
  totalValue: number;
  averageValue: number;
  expiringThisMonth: number;
  expiringThisQuarter: number;
  newThisMonth: number;
  renewalPipeline: number;
}

export interface ContractTrend {
  period: string;
  count: number;
  value: number;
}

export interface ExpirationForecast {
  month: string;
  count: number;
  value: number;
  contracts: Contract[];
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  unknown: number;
}

export interface VendorAnalytics {
  vendor: string;
  contractCount: number;
  totalValue: number;
  activeCount: number;
  expiringCount: number;
  riskProfile: RiskDistribution;
}

export interface DepartmentAnalytics {
  department: string;
  contractCount: number;
  totalValue: number;
  byStatus: Record<string, number>;
}

export interface ContractInsight {
  id: string;
  type: 'warning' | 'info' | 'success' | 'critical';
  title: string;
  description: string;
  action?: {
    label: string;
    filters: Record<string, any>;
  };
  priority: number;
}

export interface UseContractAnalyticsReturn {
  // Summary stats
  stats: ContractStats;
  
  // Time-based analysis
  monthlyTrends: ContractTrend[];
  quarterlyTrends: ContractTrend[];
  expirationForecast: ExpirationForecast[];
  
  // Distribution analysis
  riskDistribution: RiskDistribution;
  statusDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  
  // Entity analysis
  topVendors: VendorAnalytics[];
  departmentBreakdown: DepartmentAnalytics[];
  
  // Insights
  insights: ContractInsight[];
  criticalInsights: ContractInsight[];
  
  // Utility functions
  getContractsByMonth: (date: Date) => Contract[];
  getExpiringBetween: (startDate: Date, endDate: Date) => Contract[];
  getHighValueContracts: (threshold?: number) => Contract[];
  getHighRiskContracts: () => Contract[];
}

// ============================================================================
// Utility Functions
// ============================================================================

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getQuarterKey(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

function isWithinDays(date: Date, days: number): boolean {
  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + days);
  return date >= now && date <= future;
}

function isThisMonth(date: Date): boolean {
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function isThisQuarter(date: Date): boolean {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const dateQuarter = Math.floor(date.getMonth() / 3);
  return dateQuarter === currentQuarter && date.getFullYear() === now.getFullYear();
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useContractAnalytics(contracts: Contract[]): UseContractAnalyticsReturn {
  
  // ============================================================================
  // Summary Stats
  // ============================================================================
  
  const stats = useMemo((): ContractStats => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byRisk: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};
    
    let totalValue = 0;
    let expiringThisMonth = 0;
    let expiringThisQuarter = 0;
    let newThisMonth = 0;
    let renewalPipeline = 0;
    
    contracts.forEach((contract) => {
      // Status distribution
      byStatus[contract.status] = (byStatus[contract.status] || 0) + 1;
      
      // Type distribution
      byType[contract.type] = (byType[contract.type] || 0) + 1;
      
      // Risk distribution
      const risk = contract.riskLevel || 'unknown';
      byRisk[risk] = (byRisk[risk] || 0) + 1;
      
      // Department distribution
      if (contract.department) {
        byDepartment[contract.department] = (byDepartment[contract.department] || 0) + 1;
      }
      
      // Total value
      if (contract.value) {
        totalValue += contract.value;
      }
      
      // Expiration analysis
      const endDate = parseDate(contract.endDate);
      if (endDate) {
        if (isThisMonth(endDate)) expiringThisMonth++;
        if (isThisQuarter(endDate)) expiringThisQuarter++;
        
        // Renewal pipeline (expiring in next 90 days with auto-renewal)
        if (isWithinDays(endDate, 90) && contract.hasAutoRenewal) {
          renewalPipeline++;
        }
      }
      
      // New this month
      const createdDate = parseDate(contract.createdAt);
      if (createdDate && createdDate >= thisMonth) {
        newThisMonth++;
      }
    });
    
    return {
      total: contracts.length,
      byStatus,
      byType,
      byRisk,
      byDepartment,
      totalValue,
      averageValue: contracts.length > 0 ? totalValue / contracts.length : 0,
      expiringThisMonth,
      expiringThisQuarter,
      newThisMonth,
      renewalPipeline,
    };
  }, [contracts]);

  // ============================================================================
  // Time-based Trends
  // ============================================================================
  
  const monthlyTrends = useMemo((): ContractTrend[] => {
    const trendMap = new Map<string, { count: number; value: number }>();
    
    // Get last 12 months
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = getMonthKey(date);
      trendMap.set(key, { count: 0, value: 0 });
    }
    
    contracts.forEach((contract) => {
      const createdDate = parseDate(contract.createdAt);
      if (createdDate) {
        const key = getMonthKey(createdDate);
        if (trendMap.has(key)) {
          const current = trendMap.get(key)!;
          current.count++;
          current.value += contract.value || 0;
        }
      }
    });
    
    return Array.from(trendMap.entries()).map(([period, data]) => ({
      period,
      count: data.count,
      value: data.value,
    }));
  }, [contracts]);

  const quarterlyTrends = useMemo((): ContractTrend[] => {
    const trendMap = new Map<string, { count: number; value: number }>();
    
    // Get last 4 quarters
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
      const key = getQuarterKey(date);
      if (!trendMap.has(key)) {
        trendMap.set(key, { count: 0, value: 0 });
      }
    }
    
    contracts.forEach((contract) => {
      const createdDate = parseDate(contract.createdAt);
      if (createdDate) {
        const key = getQuarterKey(createdDate);
        if (trendMap.has(key)) {
          const current = trendMap.get(key)!;
          current.count++;
          current.value += contract.value || 0;
        }
      }
    });
    
    return Array.from(trendMap.entries()).map(([period, data]) => ({
      period,
      count: data.count,
      value: data.value,
    }));
  }, [contracts]);

  // ============================================================================
  // Expiration Forecast
  // ============================================================================
  
  const expirationForecast = useMemo((): ExpirationForecast[] => {
    const forecastMap = new Map<string, { count: number; value: number; contracts: Contract[] }>();
    
    // Get next 6 months
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = getMonthKey(date);
      forecastMap.set(key, { count: 0, value: 0, contracts: [] });
    }
    
    contracts
      .filter((c) => c.status === 'active')
      .forEach((contract) => {
        const endDate = parseDate(contract.endDate);
        if (endDate && endDate >= now) {
          const key = getMonthKey(endDate);
          if (forecastMap.has(key)) {
            const current = forecastMap.get(key)!;
            current.count++;
            current.value += contract.value || 0;
            current.contracts.push(contract);
          }
        }
      });
    
    return Array.from(forecastMap.entries()).map(([month, data]) => ({
      month,
      count: data.count,
      value: data.value,
      contracts: data.contracts,
    }));
  }, [contracts]);

  // ============================================================================
  // Risk Distribution
  // ============================================================================
  
  const riskDistribution = useMemo((): RiskDistribution => {
    return {
      low: contracts.filter((c) => c.riskLevel === 'low').length,
      medium: contracts.filter((c) => c.riskLevel === 'medium').length,
      high: contracts.filter((c) => c.riskLevel === 'high').length,
      unknown: contracts.filter((c) => !c.riskLevel).length,
    };
  }, [contracts]);

  const statusDistribution = useMemo(() => stats.byStatus, [stats]);
  const typeDistribution = useMemo(() => stats.byType, [stats]);

  // ============================================================================
  // Vendor Analytics
  // ============================================================================
  
  const topVendors = useMemo((): VendorAnalytics[] => {
    const vendorMap = new Map<string, VendorAnalytics>();
    
    contracts.forEach((contract) => {
      const vendor = contract.vendor || 'Unknown';
      
      if (!vendorMap.has(vendor)) {
        vendorMap.set(vendor, {
          vendor,
          contractCount: 0,
          totalValue: 0,
          activeCount: 0,
          expiringCount: 0,
          riskProfile: { low: 0, medium: 0, high: 0, unknown: 0 },
        });
      }
      
      const analytics = vendorMap.get(vendor)!;
      analytics.contractCount++;
      analytics.totalValue += contract.value || 0;
      
      if (contract.status === 'active') {
        analytics.activeCount++;
      }
      
      const endDate = parseDate(contract.endDate);
      if (endDate && isWithinDays(endDate, 90)) {
        analytics.expiringCount++;
      }
      
      const risk = contract.riskLevel || 'unknown';
      analytics.riskProfile[risk as keyof RiskDistribution]++;
    });
    
    return Array.from(vendorMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [contracts]);

  // ============================================================================
  // Department Analytics
  // ============================================================================
  
  const departmentBreakdown = useMemo((): DepartmentAnalytics[] => {
    const deptMap = new Map<string, DepartmentAnalytics>();
    
    contracts.forEach((contract) => {
      const dept = contract.department || 'Unassigned';
      
      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          department: dept,
          contractCount: 0,
          totalValue: 0,
          byStatus: {},
        });
      }
      
      const analytics = deptMap.get(dept)!;
      analytics.contractCount++;
      analytics.totalValue += contract.value || 0;
      analytics.byStatus[contract.status] = (analytics.byStatus[contract.status] || 0) + 1;
    });
    
    return Array.from(deptMap.values())
      .sort((a, b) => b.contractCount - a.contractCount);
  }, [contracts]);

  // ============================================================================
  // Insights
  // ============================================================================
  
  const insights = useMemo((): ContractInsight[] => {
    const insightList: ContractInsight[] = [];
    
    // Critical: High-risk expiring soon
    const highRiskExpiring = contracts.filter((c) => {
      const endDate = parseDate(c.endDate);
      return c.riskLevel === 'high' && endDate && isWithinDays(endDate, 30);
    });
    
    if (highRiskExpiring.length > 0) {
      insightList.push({
        id: 'high-risk-expiring',
        type: 'critical',
        title: `${highRiskExpiring.length} high-risk contracts expiring soon`,
        description: 'These contracts require immediate attention before expiration.',
        action: {
          label: 'View contracts',
          filters: { riskLevel: 'high', expiringWithin: 30 },
        },
        priority: 1,
      });
    }
    
    // Warning: Many contracts expiring this month
    if (stats.expiringThisMonth > 5) {
      insightList.push({
        id: 'many-expiring',
        type: 'warning',
        title: `${stats.expiringThisMonth} contracts expiring this month`,
        description: 'Review these contracts for renewal or termination decisions.',
        action: {
          label: 'View expiring',
          filters: { expiringWithin: 30 },
        },
        priority: 2,
      });
    }
    
    // Warning: High concentration with single vendor
    const topVendor = topVendors[0];
    if (topVendor && topVendor.contractCount > contracts.length * 0.3) {
      insightList.push({
        id: 'vendor-concentration',
        type: 'warning',
        title: `High vendor concentration: ${topVendor.vendor}`,
        description: `${Math.round(topVendor.contractCount / contracts.length * 100)}% of contracts are with a single vendor.`,
        action: {
          label: 'View vendor contracts',
          filters: { vendor: topVendor.vendor },
        },
        priority: 3,
      });
    }
    
    // Info: Renewal pipeline
    if (stats.renewalPipeline > 0) {
      insightList.push({
        id: 'renewal-pipeline',
        type: 'info',
        title: `${stats.renewalPipeline} contracts in renewal pipeline`,
        description: 'Auto-renewal contracts expiring in the next 90 days.',
        action: {
          label: 'View renewals',
          filters: { hasAutoRenewal: true, expiringWithin: 90 },
        },
        priority: 4,
      });
    }
    
    // Success: Low risk portfolio
    const highRiskPercentage = riskDistribution.high / contracts.length;
    if (highRiskPercentage < 0.1 && contracts.length > 10) {
      insightList.push({
        id: 'low-risk-portfolio',
        type: 'success',
        title: 'Portfolio risk is well managed',
        description: 'Less than 10% of contracts are high-risk.',
        priority: 5,
      });
    }
    
    // Info: New contracts this month
    if (stats.newThisMonth > 0) {
      insightList.push({
        id: 'new-contracts',
        type: 'info',
        title: `${stats.newThisMonth} new contracts this month`,
        description: 'Recently added contracts that may need review.',
        action: {
          label: 'View new contracts',
          filters: { createdWithin: 30 },
        },
        priority: 6,
      });
    }
    
    // Warning: Missing data
    const missingDepartment = contracts.filter((c) => !c.department).length;
    if (missingDepartment > contracts.length * 0.2) {
      insightList.push({
        id: 'missing-department',
        type: 'warning',
        title: `${missingDepartment} contracts missing department`,
        description: 'Assign departments for better organization and reporting.',
        action: {
          label: 'View unassigned',
          filters: { department: null },
        },
        priority: 7,
      });
    }
    
    return insightList.sort((a, b) => a.priority - b.priority);
  }, [contracts, stats, topVendors, riskDistribution]);

  const criticalInsights = useMemo(
    () => insights.filter((i) => i.type === 'critical' || i.type === 'warning'),
    [insights]
  );

  // ============================================================================
  // Utility Functions
  // ============================================================================
  
  const getContractsByMonth = useCallback((date: Date): Contract[] => {
    const targetMonth = getMonthKey(date);
    return contracts.filter((c) => {
      const createdDate = parseDate(c.createdAt);
      return createdDate && getMonthKey(createdDate) === targetMonth;
    });
  }, [contracts]);

  const getExpiringBetween = useCallback((startDate: Date, endDate: Date): Contract[] => {
    return contracts.filter((c) => {
      const expDate = parseDate(c.endDate);
      return expDate && expDate >= startDate && expDate <= endDate && c.status === 'active';
    });
  }, [contracts]);

  const getHighValueContracts = useCallback((threshold: number = 100000): Contract[] => {
    return contracts
      .filter((c) => (c.value || 0) >= threshold)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [contracts]);

  const getHighRiskContracts = useCallback((): Contract[] => {
    return contracts.filter((c) => c.riskLevel === 'high');
  }, [contracts]);

  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    stats,
    monthlyTrends,
    quarterlyTrends,
    expirationForecast,
    riskDistribution,
    statusDistribution,
    typeDistribution,
    topVendors,
    departmentBreakdown,
    insights,
    criticalInsights,
    getContractsByMonth,
    getExpiringBetween,
    getHighValueContracts,
    getHighRiskContracts,
  };
}

export default useContractAnalytics;
