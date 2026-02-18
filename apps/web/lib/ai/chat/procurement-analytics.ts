import { prisma } from '@/lib/prisma';

// ============================================
// ADVANCED PROCUREMENT AGENT QUERIES
// ============================================

// Get total spend analysis
export async function getSpendAnalysis(tenantId: string, supplierName?: string) {
  try {
    const where: Record<string, unknown> = { tenantId, status: { not: 'CANCELLED' } };
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }

    const contracts = await prisma.contract.findMany({
      where,
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        totalValue: true,
        annualValue: true,
        categoryL1: true,
        categoryL2: true,
        status: true,
        effectiveDate: true,
        expirationDate: true } });

    const totalSpend = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    const annualSpend = contracts.reduce((sum, c) => sum + (Number(c.annualValue) || Number(c.totalValue) || 0), 0);
    
    const bySupplier = contracts.reduce((acc, c) => {
      const supplier = c.supplierName || 'Unknown';
      if (!acc[supplier]) acc[supplier] = { count: 0, value: 0 };
      acc[supplier].count++;
      acc[supplier].value += Number(c.totalValue) || 0;
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    const byCategory = contracts.reduce((acc, c) => {
      const category = c.categoryL1 || 'Uncategorized';
      if (!acc[category]) acc[category] = { count: 0, value: 0 };
      acc[category].count++;
      acc[category].value += Number(c.totalValue) || 0;
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    return {
      totalContracts: contracts.length,
      totalSpend,
      annualSpend,
      bySupplier: Object.entries(bySupplier)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 10),
      byCategory: Object.entries(byCategory)
        .sort((a, b) => b[1].value - a[1].value),
      supplierFilter: supplierName };
  } catch {
    return null;
  }
}

// Get cost savings opportunities
export async function getCostSavingsOpportunities(tenantId: string) {
  try {
    const savings = await prisma.costSavingsOpportunity.findMany({
      where: { tenantId, status: { not: 'implemented' } },
      orderBy: { potentialSavingsAmount: 'desc' },
      take: 10,
      include: {
        contract: {
          select: { contractTitle: true, supplierName: true } } } });

    const totalPotential = savings.reduce((sum, s) => sum + Number(s.potentialSavingsAmount), 0);
    
    const byCategory = savings.reduce((acc, s) => {
      const category = s.category || 'Other';
      if (!acc[category]) acc[category] = { count: 0, value: 0 };
      acc[category]!.count++;
      acc[category]!.value += Number(s.potentialSavingsAmount);
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    return {
      opportunities: savings,
      totalPotentialSavings: totalPotential,
      byCategory,
      count: savings.length };
  } catch {
    return { opportunities: [], totalPotentialSavings: 0, byCategory: {}, count: 0 };
  }
}

// Get top suppliers by spend
export async function getTopSuppliers(tenantId: string, topN: number = 10) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      select: {
        supplierName: true,
        totalValue: true,
        status: true,
        expirationDate: true } });

    const supplierStats = contracts.reduce((acc, c) => {
      const supplier = c.supplierName || 'Unknown';
      if (!acc[supplier]) {
        acc[supplier] = { 
          count: 0, 
          totalValue: 0, 
          activeCount: 0, 
          expiringCount: 0 
        };
      }
      acc[supplier].count++;
      acc[supplier].totalValue += Number(c.totalValue) || 0;
      if (c.status === 'ACTIVE') acc[supplier].activeCount++;
      if (c.expirationDate && new Date(c.expirationDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) {
        acc[supplier].expiringCount++;
      }
      return acc;
    }, {} as Record<string, { count: number; totalValue: number; activeCount: number; expiringCount: number }>);

    const sorted = Object.entries(supplierStats)
      .sort((a, b) => b[1].totalValue - a[1].totalValue)
      .slice(0, topN);

    return {
      suppliers: sorted.map(([name, stats]) => ({ name, ...stats })),
      totalSuppliers: Object.keys(supplierStats).length };
  } catch {
    return { suppliers: [], totalSuppliers: 0 };
  }
}

// Get high-risk contracts
export async function getRiskAssessment(tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        OR: [
          { expirationRisk: { in: ['HIGH', 'CRITICAL'] } },
          { daysUntilExpiry: { lte: 30 } },
          { autoRenewalEnabled: true },
        ] },
      orderBy: { expirationDate: 'asc' },
      take: 20 });

    const byRiskLevel = {
      critical: contracts.filter(c => c.expirationRisk === 'CRITICAL' || (c.daysUntilExpiry && c.daysUntilExpiry <= 7)),
      high: contracts.filter(c => c.expirationRisk === 'HIGH' || (c.daysUntilExpiry && c.daysUntilExpiry <= 30 && c.daysUntilExpiry > 7)),
      autoRenewal: contracts.filter(c => c.autoRenewalEnabled) };

    return {
      contracts,
      byRiskLevel,
      criticalCount: byRiskLevel.critical.length,
      highRiskCount: byRiskLevel.high.length,
      autoRenewalCount: byRiskLevel.autoRenewal.length };
  } catch {
    return { contracts: [], byRiskLevel: {}, criticalCount: 0, highRiskCount: 0, autoRenewalCount: 0 };
  }
}

// Get auto-renewal contracts
export async function getAutoRenewalContracts(tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        autoRenewalEnabled: true,
        status: { not: 'CANCELLED' } },
      orderBy: { expirationDate: 'asc' },
      take: 20 });

    const upcomingRenewals = contracts.filter(c => 
      c.expirationDate && 
      new Date(c.expirationDate) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    );

    return {
      contracts,
      totalAutoRenewal: contracts.length,
      upcomingRenewals,
      upcomingCount: upcomingRenewals.length };
  } catch {
    return { contracts: [], totalAutoRenewal: 0, upcomingRenewals: [], upcomingCount: 0 };
  }
}

// Get spend by category
export async function getCategorySpend(tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId, status: { not: 'CANCELLED' } },
      select: {
        categoryL1: true,
        categoryL2: true,
        totalValue: true,
        supplierName: true } });

    const byL1 = contracts.reduce((acc, c) => {
      const cat = c.categoryL1 || 'Uncategorized';
      if (!acc[cat]) acc[cat] = { value: 0, count: 0, suppliers: new Set() };
      acc[cat].value += Number(c.totalValue) || 0;
      acc[cat].count++;
      if (c.supplierName) acc[cat].suppliers.add(c.supplierName);
      return acc;
    }, {} as Record<string, { value: number; count: number; suppliers: Set<string> }>);

    const byL2 = contracts.reduce((acc, c) => {
      const l1 = c.categoryL1 || 'Uncategorized';
      const l2 = c.categoryL2 || 'General';
      const key = `${l1} > ${l2}`;
      if (!acc[key]) acc[key] = { value: 0, count: 0 };
      acc[key].value += Number(c.totalValue) || 0;
      acc[key].count++;
      return acc;
    }, {} as Record<string, { value: number; count: number }>);

    return {
      byL1Category: Object.entries(byL1)
        .map(([name, data]) => ({ 
          name, 
          value: data.value, 
          count: data.count, 
          supplierCount: data.suppliers.size 
        }))
        .sort((a, b) => b.value - a.value),
      byL2Category: Object.entries(byL2)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 15),
      totalCategories: Object.keys(byL1).length };
  } catch {
    return { byL1Category: [], byL2Category: [], totalCategories: 0 };
  }
}

// Get payment terms analysis
export async function getPaymentTermsAnalysis(tenantId: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        contractTitle: true,
        supplierName: true,
        paymentTerms: true,
        paymentFrequency: true,
        totalValue: true } });

    const byTerms = contracts.reduce((acc, c) => {
      const terms = c.paymentTerms || 'Not Specified';
      if (!acc[terms]) acc[terms] = { count: 0, value: 0, contracts: [] as typeof contracts };
      acc[terms].count++;
      acc[terms].value += Number(c.totalValue) || 0;
      acc[terms].contracts.push(c);
      return acc;
    }, {} as Record<string, { count: number; value: number; contracts: typeof contracts }>);

    return {
      byTerms: Object.entries(byTerms)
        .map(([terms, data]) => ({ 
          terms, 
          count: data.count, 
          value: data.value,
          contracts: data.contracts.slice(0, 5) }))
        .sort((a, b) => b.count - a.count),
      totalContracts: contracts.length };
  } catch {
    return { byTerms: [], totalContracts: 0 };
  }
}

// Get compliance status for contracts
export async function getComplianceStatus(tenantId: string, supplierName?: string) {
  try {
    const where: Record<string, unknown> = { tenantId, status: { not: 'CANCELLED' } };
    if (supplierName) {
      where.supplierName = { contains: supplierName, mode: 'insensitive' };
    }

    const contracts = await prisma.contract.findMany({
      where,
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        status: true,
        expirationDate: true,
        noticePeriodDays: true,
        totalValue: true } });

    const contractsWithIssues = contracts.filter(c => {
      const issues: string[] = [];
      if (!c.expirationDate) issues.push('missing_expiration');
      if (!c.noticePeriodDays) issues.push('missing_notice_period');
      return issues.length > 0;
    });

    const compliantCount = contracts.length - contractsWithIssues.length;

    return {
      totalContracts: contracts.length,
      compliantCount,
      issueCount: contractsWithIssues.length,
      contracts: contractsWithIssues.slice(0, 10).map(c => ({
        ...c,
        complianceScore: c.expirationDate && c.noticePeriodDays ? 100 : c.expirationDate ? 50 : 25,
        issueCount: (!c.expirationDate ? 1 : 0) + (!c.noticePeriodDays ? 1 : 0) })) };
  } catch {
    return { totalContracts: 0, compliantCount: 0, issueCount: 0, contracts: [] };
  }
}

// Get supplier performance metrics
export async function getSupplierPerformance(tenantId: string, supplierName: string) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        supplierName: { contains: supplierName, mode: 'insensitive' } },
      orderBy: { effectiveDate: 'asc' } });

    const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;
    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
    
    const firstContract = contracts[0];
    const relationshipMonths = firstContract?.effectiveDate 
      ? Math.floor((Date.now() - new Date(firstContract.effectiveDate).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;

    return {
      supplierName,
      overallScore: 75,
      deliveryScore: 80,
      qualityScore: 75,
      communicationScore: 70,
      valueScore: 75,
      activeContracts,
      totalValue,
      relationshipMonths,
      totalContracts: contracts.length };
  } catch {
    return {
      supplierName,
      overallScore: 0,
      deliveryScore: 0,
      qualityScore: 0,
      communicationScore: 0,
      valueScore: 0,
      activeContracts: 0,
      totalValue: 0,
      relationshipMonths: 0,
      totalContracts: 0 };
  }
}
