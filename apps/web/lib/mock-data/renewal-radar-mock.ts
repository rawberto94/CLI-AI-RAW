/**
 * Mock Data for Renewal Radar
 * 
 * This module provides realistic mock data for contract renewal tracking functionality.
 */

import { RenewalRadarData, RenewalRadarRequest } from '../../../../packages/data-orchestration/src/types/data-provider.types';

/**
 * Generate mock renewal radar data
 */
export function generateRenewalRadarMock(
  request?: RenewalRadarRequest
): RenewalRadarData {
  const upcomingRenewals = generateUpcomingRenewals(request);
  
  return {
    upcomingRenewals,
    riskAnalysis: calculateRiskAnalysis(upcomingRenewals),
    actionItems: generateActionItems(upcomingRenewals)
  };
}

/**
 * Generate upcoming renewals
 */
function generateUpcomingRenewals(request?: RenewalRadarRequest): Array<{
  contractId: string;
  supplier: string;
  renewalDate: Date;
  value: number;
  riskLevel: 'high' | 'medium' | 'low';
  autoRenewal: boolean;
  noticePeriod: number;
}> {
  const suppliers = [
    'TechCorp Solutions',
    'Global IT Services',
    'Innovation Partners',
    'Digital Dynamics',
    'NextGen Technologies',
    'CloudFirst Consulting',
    'DataDriven Inc',
    'SecureCode Ltd',
    'Agile Experts',
    'ScaleUp Systems'
  ];
  
  const timeframeMonths = request?.timeframe === '3months' ? 3 : 
                          request?.timeframe === '6months' ? 6 : 12;
  
  const renewals = [];
  const count = Math.floor(Math.random() * 15) + 10; // 10-25 renewals
  
  for (let i = 0; i < count; i++) {
    const daysUntilRenewal = Math.floor(Math.random() * (timeframeMonths * 30));
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + daysUntilRenewal);
    
    const value = Math.floor(Math.random() * 5000000) + 100000; // $100K - $5M
    const riskLevel = determineRiskLevel(daysUntilRenewal, value);
    const autoRenewal = Math.random() > 0.6; // 40% have auto-renewal
    const noticePeriod = [30, 60, 90, 120][Math.floor(Math.random() * 4)];
    
    // Filter by risk level if specified
    if (request?.riskLevel && riskLevel !== request.riskLevel) {
      continue;
    }
    
    renewals.push({
      contractId: `CNT${String(i + 1).padStart(4, '0')}`,
      supplier: suppliers[i % suppliers.length],
      renewalDate,
      value,
      riskLevel,
      autoRenewal,
      noticePeriod
    });
  }
  
  // Sort by renewal date
  return renewals.sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime());
}

/**
 * Determine risk level based on time and value
 */
function determineRiskLevel(
  daysUntilRenewal: number,
  value: number
): 'high' | 'medium' | 'low' {
  // High risk: < 60 days and high value, or < 30 days
  if (daysUntilRenewal < 30 || (daysUntilRenewal < 60 && value > 1000000)) {
    return 'high';
  }
  
  // Medium risk: 60-120 days or medium value
  if (daysUntilRenewal < 120 || value > 500000) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Calculate risk analysis
 */
function calculateRiskAnalysis(renewals: Array<{
  value: number;
  riskLevel: string;
}>): {
  totalContracts: number;
  totalValue: number;
  riskDistribution: Record<string, number>;
} {
  const riskDistribution: Record<string, number> = {
    high: 0,
    medium: 0,
    low: 0
  };
  
  let totalValue = 0;
  
  renewals.forEach(renewal => {
    totalValue += renewal.value;
    riskDistribution[renewal.riskLevel]++;
  });
  
  return {
    totalContracts: renewals.length,
    totalValue: Math.round(totalValue),
    riskDistribution
  };
}

/**
 * Generate action items
 */
function generateActionItems(renewals: Array<{
  contractId: string;
  supplier: string;
  renewalDate: Date;
  value: number;
  riskLevel: 'high' | 'medium' | 'low';
  autoRenewal: boolean;
  noticePeriod: number;
}>): Array<{
  contractId: string;
  action: string;
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
}> {
  const actionItems = [];
  
  for (const renewal of renewals) {
    const daysUntilRenewal = Math.floor(
      (renewal.renewalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    // Generate actions based on timeline and risk
    if (daysUntilRenewal <= renewal.noticePeriod) {
      // Notice period action
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Math.max(1, daysUntilRenewal - 7));
      
      actionItems.push({
        contractId: renewal.contractId,
        action: renewal.autoRenewal 
          ? `Review auto-renewal terms for ${renewal.supplier}`
          : `Submit renewal notice for ${renewal.supplier}`,
        dueDate,
        priority: renewal.riskLevel
      });
    }
    
    if (daysUntilRenewal <= 90 && renewal.value > 500000) {
      // High-value contract review
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Math.max(1, daysUntilRenewal - 60));
      
      actionItems.push({
        contractId: renewal.contractId,
        action: `Conduct market analysis for ${renewal.supplier} contract`,
        dueDate,
        priority: 'high'
      });
    }
    
    if (daysUntilRenewal <= 120) {
      // Negotiation preparation
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Math.max(1, daysUntilRenewal - 90));
      
      actionItems.push({
        contractId: renewal.contractId,
        action: `Prepare negotiation strategy for ${renewal.supplier}`,
        dueDate,
        priority: renewal.value > 1000000 ? 'high' : 'medium'
      });
    }
  }
  
  // Sort by due date
  return actionItems.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * Predefined scenarios
 */
export const renewalRadarScenarios = {
  urgent: (): RenewalRadarData => {
    const today = new Date();
    const upcomingRenewals = [
      {
        contractId: 'CNT0001',
        supplier: 'TechCorp Solutions',
        renewalDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days
        value: 2000000,
        riskLevel: 'high' as const,
        autoRenewal: true,
        noticePeriod: 30
      },
      {
        contractId: 'CNT0002',
        supplier: 'Global IT Services',
        renewalDate: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000), // 25 days
        value: 1500000,
        riskLevel: 'high' as const,
        autoRenewal: false,
        noticePeriod: 60
      },
      {
        contractId: 'CNT0003',
        supplier: 'Innovation Partners',
        renewalDate: new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000), // 45 days
        value: 800000,
        riskLevel: 'high' as const,
        autoRenewal: true,
        noticePeriod: 90
      }
    ];
    
    return {
      upcomingRenewals,
      riskAnalysis: calculateRiskAnalysis(upcomingRenewals),
      actionItems: generateActionItems(upcomingRenewals)
    };
  },
  
  manageable: (): RenewalRadarData => {
    const today = new Date();
    const upcomingRenewals = [
      {
        contractId: 'CNT0001',
        supplier: 'Digital Dynamics',
        renewalDate: new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000), // 4 months
        value: 500000,
        riskLevel: 'medium' as const,
        autoRenewal: false,
        noticePeriod: 60
      },
      {
        contractId: 'CNT0002',
        supplier: 'NextGen Technologies',
        renewalDate: new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000), // 6 months
        value: 300000,
        riskLevel: 'low' as const,
        autoRenewal: true,
        noticePeriod: 30
      }
    ];
    
    return {
      upcomingRenewals,
      riskAnalysis: calculateRiskAnalysis(upcomingRenewals),
      actionItems: generateActionItems(upcomingRenewals)
    };
  },
  
  standard: (): RenewalRadarData => generateRenewalRadarMock()
};

export const sampleRenewalRadarRequests: RenewalRadarRequest[] = [
  { timeframe: '3months' },
  { timeframe: '6months', riskLevel: 'high' },
  { timeframe: '12months' }
];
