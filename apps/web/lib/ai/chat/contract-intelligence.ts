import { prisma } from '@/lib/prisma';

// ============================================
// COMPREHENSIVE CONTRACT INTELLIGENCE
// Get full contract details with artifacts for deep insights
// ============================================

export async function getContractIntelligence(contractId: string, tenantId: string) {
  try {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        artifacts: {
          where: { status: 'active' },
          select: {
            id: true,
            type: true,
            data: true,
            confidence: true } },
        contractMetadata: true,
        parentContract: {
          select: { id: true, contractTitle: true, contractType: true } },
        childContracts: {
          select: { id: true, contractTitle: true, contractType: true, status: true },
          take: 10 } } });

    if (!contract) return null;

    // Parse artifact data for insights
    const getArtifactData = (type: string): Record<string, any> => {
      const contractWithArtifacts = contract as { artifacts?: Array<{ type: string; data?: unknown }> };
      const artifact = contractWithArtifacts.artifacts?.find((a) => a.type === type);
      return (artifact?.data as Record<string, any>) || {};
    };

    const overview = getArtifactData('OVERVIEW');
    const financial = getArtifactData('FINANCIAL');
    const clauses = getArtifactData('CLAUSES');
    const risk = getArtifactData('RISK');
    const compliance = getArtifactData('COMPLIANCE');
    const renewal = getArtifactData('RENEWAL');
    const obligations = getArtifactData('OBLIGATIONS');
    const rates = getArtifactData('RATES');

    // Calculate days until expiry
    const daysUntilExpiry = contract.expirationDate
      ? Math.ceil((new Date(contract.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    // Build intelligence report
    return {
      contract: {
        id: contract.id,
        title: contract.contractTitle || contract.fileName,
        supplier: contract.supplierName,
        type: contract.contractType,
        status: contract.status,
        value: Number(contract.totalValue || 0),
        effectiveDate: contract.effectiveDate,
        expirationDate: contract.expirationDate,
        daysUntilExpiry,
        autoRenewal: contract.autoRenewalEnabled,
        category: contract.categoryL1,
        signatureStatus: (contract as any).signatureStatus || 'unknown',
        signatureDate: (contract as any).signatureDate || null,
        signatureRequiredFlag: (contract as any).signatureRequiredFlag || false,
        documentClassification: (contract as any).documentClassification || 'contract',
        documentClassificationWarning: (contract as any).documentClassificationWarning || null },
      insights: {
        summary: (overview as any)?.summary || (overview as any)?.keyTerms?.join(', ') || 'No summary available',
        keyTerms: (overview as any)?.keyTerms || [],
        paymentTerms: (financial as any)?.paymentTerms || (financial as any)?.paymentSchedule || 'Not specified',
        totalCommitment: (financial as any)?.totalContractValue || (financial as any)?.totalCommitment,
        criticalClauses: (clauses as any)?.clauses?.filter((c: { risk?: string; importance?: string }) => c.risk === 'high' || c.importance === 'critical')?.slice(0, 5) || [],
        terminationNotice: (renewal as any)?.noticePeriodDays || (clauses as any)?.terminationNoticeDays || 'Not specified',
        autoRenewalTerms: (renewal as any)?.autoRenewalTerms || (contract.autoRenewalEnabled ? 'Enabled' : 'Disabled') },
      risks: {
        level: (risk as any)?.overallRisk || (risk as any)?.riskLevel || (daysUntilExpiry && daysUntilExpiry < 30 ? 'HIGH' : 'MEDIUM'),
        factors: risk.riskFactors || risk.risks || [],
        mitigations: risk.mitigations || [] },
      compliance: {
        status: compliance.status || compliance.overallStatus || 'Unknown',
        issues: compliance.issues || compliance.nonCompliantItems || [],
        score: compliance.score || compliance.complianceScore },
      obligations: {
        ourObligations: obligations.partyObligations?.client || obligations.ourObligations || [],
        theirObligations: obligations.partyObligations?.supplier || obligations.theirObligations || [],
        keyDates: obligations.keyDates || [] },
      rates: rates.roles || rates.rateCard || [],
      relationships: {
        parent: (contract as any).parentContract,
        children: (contract as any).childContracts || [] } };
  } catch {
    return null;
  }
}

// Get recent system activity for context
export async function getRecentActivity(tenantId: string) {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentUploads = await prisma.contract.count({
      where: { tenantId, createdAt: { gte: last24h } } });

    const recentUpdates = await prisma.contract.count({
      where: { tenantId, updatedAt: { gte: last24h }, createdAt: { lt: last24h } } });

    const expiringThisWeek = await prisma.contract.count({
      where: {
        tenantId,
        expirationDate: { gte: now, lte: last7d },
        status: { notIn: ['EXPIRED', 'ARCHIVED'] } } });

    const totalActive = await prisma.contract.count({
      where: { tenantId, status: 'ACTIVE' } });

    const valueAgg = await prisma.contract.aggregate({
      where: { tenantId, status: 'ACTIVE' },
      _sum: { totalValue: true } });

    return {
      recentUploads,
      recentUpdates,
      expiringThisWeek,
      totalActive,
      totalValue: Number(valueAgg._sum.totalValue || 0) };
  } catch {
    return null;
  }
}

// Search contracts by any term (flexible search)
export async function searchContractsFlexible(searchTerm: string, tenantId: string, limit: number = 10) {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        OR: [
          { contractTitle: { contains: searchTerm, mode: 'insensitive' } },
          { fileName: { contains: searchTerm, mode: 'insensitive' } },
          { supplierName: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { categoryL1: { contains: searchTerm, mode: 'insensitive' } },
          { categoryL2: { contains: searchTerm, mode: 'insensitive' } },
        ] },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        supplierName: true,
        status: true,
        totalValue: true,
        expirationDate: true,
        contractType: true,
        categoryL1: true } });

    return contracts.map(c => ({
      id: c.id,
      title: c.contractTitle || c.fileName || 'Untitled',
      supplier: c.supplierName,
      status: c.status,
      value: Number(c.totalValue || 0),
      expirationDate: c.expirationDate,
      type: c.contractType,
      category: c.categoryL1,
      daysUntilExpiry: c.expirationDate 
        ? Math.ceil((new Date(c.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null }));
  } catch {
    return [];
  }
}

// Fetch proactive alerts and insights
export async function getProactiveInsights(tenantId: string): Promise<{
  criticalAlerts: string[];
  insights: string[];
  urgentContracts: Array<{ id: string; contractTitle?: string | null; expirationDate?: Date | null; totalValue?: number | null }>;
}> {
  try {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const criticalExpiring = await prisma.contract.findMany({
      where: {
        tenantId,
        expirationDate: { gte: now, lte: in7Days },
        status: { notIn: ['EXPIRED', 'ARCHIVED', 'CANCELLED'] } },
      orderBy: { expirationDate: 'asc' },
      take: 5 });
    
    const autoRenewals = await prisma.contract.findMany({
      where: {
        tenantId,
        autoRenewalEnabled: true,
        expirationDate: { gte: now, lte: in30Days },
        status: 'ACTIVE' },
      take: 5 });
    
    const highValueExpiring = await prisma.contract.findMany({
      where: {
        tenantId,
        totalValue: { gte: 100000 },
        expirationDate: { gte: now, lte: in30Days },
        status: { notIn: ['EXPIRED', 'ARCHIVED', 'CANCELLED'] } },
      orderBy: { totalValue: 'desc' },
      take: 3 });
    
    const criticalAlerts: string[] = [];
    const insights: string[] = [];
    
    if (criticalExpiring.length > 0) {
      criticalAlerts.push(`🔴 **${criticalExpiring.length} contract(s) expiring within 7 days!** Immediate attention required.`);
    }
    
    if (autoRenewals.length > 0) {
      criticalAlerts.push(`⚠️ **${autoRenewals.length} auto-renewal contract(s)** will renew within 30 days. Review cancellation options.`);
    }
    
    if (highValueExpiring.length > 0) {
      const totalValue = highValueExpiring.reduce((sum, c) => sum + Number(c.totalValue || 0), 0);
      insights.push(`💰 **$${totalValue.toLocaleString()}** in high-value contracts expiring soon. Consider renewal negotiations.`);
    }
    
    const activeCount = await prisma.contract.count({
      where: { tenantId, status: 'ACTIVE' } });
    
    const expiringCount = await prisma.contract.count({
      where: {
        tenantId,
        expirationDate: { lte: in30Days, gte: now },
        status: { notIn: ['EXPIRED', 'ARCHIVED', 'CANCELLED'] } } });
    
    if (expiringCount > 0 && activeCount > 0) {
      const expiringPct = Math.round((expiringCount / activeCount) * 100);
      if (expiringPct > 20) {
        insights.push(`📊 **${expiringPct}%** of your active contracts expire within 30 days. Consider batch renewal strategy.`);
      }
    }
    
    const allUrgent = [...criticalExpiring, ...highValueExpiring.filter(c => !criticalExpiring.find(ce => ce.id === c.id))];
    
    return {
      criticalAlerts,
      insights,
      urgentContracts: allUrgent.map(c => ({
        id: c.id,
        contractTitle: c.contractTitle,
        expirationDate: c.expirationDate,
        totalValue: c.totalValue ? Number(c.totalValue) : null })) };
  } catch {
    return { criticalAlerts: [], insights: [], urgentContracts: [] };
  }
}

// Compare two contracts side-by-side
export async function compareContracts(
  contractNameA: string,
  contractNameB: string,
  tenantId: string
): Promise<{
  contractA: Record<string, unknown> | null;
  contractB: Record<string, unknown> | null;
  comparison: {
    field: string;
    valueA: string;
    valueB: string;
    difference: 'same' | 'different' | 'better_a' | 'better_b' | 'na';
  }[];
  summary: string;
}> {
  try {
    const [contractA, contractB] = await Promise.all([
      prisma.contract.findFirst({
        where: {
          tenantId,
          OR: [
            { fileName: { contains: contractNameA, mode: 'insensitive' } },
            { supplierName: { contains: contractNameA, mode: 'insensitive' } },
          ] },
        include: {
          artifacts: {
            where: { 
              type: { in: ['OVERVIEW', 'RENEWAL', 'FINANCIAL', 'TERMINATION_CLAUSE', 'LIABILITY_CLAUSE'] },
              status: 'active' } } } }),
      prisma.contract.findFirst({
        where: {
          tenantId,
          OR: [
            { fileName: { contains: contractNameB, mode: 'insensitive' } },
            { supplierName: { contains: contractNameB, mode: 'insensitive' } },
          ] },
        include: {
          artifacts: {
            where: { 
              type: { in: ['OVERVIEW', 'RENEWAL', 'FINANCIAL', 'TERMINATION_CLAUSE', 'LIABILITY_CLAUSE'] },
              status: 'active' } } } }),
    ]);

    if (!contractA || !contractB) {
      return {
        contractA,
        contractB,
        comparison: [],
        summary: !contractA && !contractB 
          ? `Could not find either contract. Please check the names.`
          : !contractA 
            ? `Could not find contract matching "${contractNameA}".`
            : `Could not find contract matching "${contractNameB}".` };
    }

    const comparison: {
      field: string;
      valueA: string;
      valueB: string;
      difference: 'same' | 'different' | 'better_a' | 'better_b' | 'na';
    }[] = [];

    const formatValue = (v: unknown) => v ? String(v) : 'N/A';
    const formatMoney = (v: unknown) => v ? `$${Number(v).toLocaleString()}` : 'N/A';
    const formatDate = (d: Date | null) => d ? new Date(d).toLocaleDateString() : 'N/A';

    comparison.push({
      field: 'Supplier',
      valueA: formatValue(contractA.supplierName),
      valueB: formatValue(contractB.supplierName),
      difference: contractA.supplierName === contractB.supplierName ? 'same' : 'different' });

    comparison.push({
      field: 'Contract Type',
      valueA: formatValue(contractA.contractType),
      valueB: formatValue(contractB.contractType),
      difference: contractA.contractType === contractB.contractType ? 'same' : 'different' });

    comparison.push({
      field: 'Status',
      valueA: formatValue(contractA.status),
      valueB: formatValue(contractB.status),
      difference: contractA.status === contractB.status ? 'same' : 'different' });

    comparison.push({
      field: 'Total Value',
      valueA: formatMoney(contractA.totalValue),
      valueB: formatMoney(contractB.totalValue),
      difference: !contractA.totalValue || !contractB.totalValue ? 'na' :
        contractA.totalValue === contractB.totalValue ? 'same' :
        Number(contractA.totalValue) > Number(contractB.totalValue) ? 'better_a' : 'better_b' });

    comparison.push({
      field: 'Start Date',
      valueA: formatDate(contractA.effectiveDate),
      valueB: formatDate(contractB.effectiveDate),
      difference: contractA.effectiveDate?.getTime() === contractB.effectiveDate?.getTime() ? 'same' : 'different' });

    comparison.push({
      field: 'End Date',
      valueA: formatDate(contractA.expirationDate),
      valueB: formatDate(contractB.expirationDate),
      difference: !contractA.expirationDate || !contractB.expirationDate ? 'na' :
        contractA.expirationDate.getTime() === contractB.expirationDate.getTime() ? 'same' : 'different' });

    comparison.push({
      field: 'Auto-Renewal',
      valueA: contractA.autoRenewalEnabled ? 'Yes' : 'No',
      valueB: contractB.autoRenewalEnabled ? 'Yes' : 'No',
      difference: contractA.autoRenewalEnabled === contractB.autoRenewalEnabled ? 'same' : 'different' });

    const getArtifactData = (artifacts: Array<{ type?: string; data?: unknown }>, type: string): Record<string, any> => {
      const artifact = artifacts.find((a) => a.type === type);
      return (artifact?.data as Record<string, any>) || {};
    };

    const termA = getArtifactData(contractA.artifacts, 'RENEWAL');
    const termB = getArtifactData(contractB.artifacts, 'RENEWAL');

    if (termA.noticeRequiredDays || termB.noticeRequiredDays) {
      comparison.push({
        field: 'Notice Period (Days)',
        valueA: termA.noticeRequiredDays ? `${termA.noticeRequiredDays} days` : 'N/A',
        valueB: termB.noticeRequiredDays ? `${termB.noticeRequiredDays} days` : 'N/A',
        difference: termA.noticeRequiredDays === termB.noticeRequiredDays ? 'same' : 'different' });
    }

    const finA = getArtifactData(contractA.artifacts, 'FINANCIAL');
    const finB = getArtifactData(contractB.artifacts, 'FINANCIAL');

    if (finA.paymentTerms || finB.paymentTerms) {
      comparison.push({
        field: 'Payment Terms',
        valueA: formatValue(finA.paymentTerms),
        valueB: formatValue(finB.paymentTerms),
        difference: finA.paymentTerms === finB.paymentTerms ? 'same' : 'different' });
    }

    const liabA = getArtifactData(contractA.artifacts, 'LIABILITY_CLAUSE');
    const liabB = getArtifactData(contractB.artifacts, 'LIABILITY_CLAUSE');

    if (liabA.liabilityCap || liabB.liabilityCap) {
      comparison.push({
        field: 'Liability Cap',
        valueA: formatValue(liabA.liabilityCap),
        valueB: formatValue(liabB.liabilityCap),
        difference: liabA.liabilityCap === liabB.liabilityCap ? 'same' : 'different' });
    }

    const differences = comparison.filter(c => c.difference !== 'same' && c.difference !== 'na');
    const valueDiff = Number(contractA.totalValue || 0) - Number(contractB.totalValue || 0);
    
    let summary = `## Contract Comparison: ${contractA.fileName} vs ${contractB.fileName}\n\n`;
    summary += `**${differences.length} differences** found across ${comparison.length} compared fields.\n\n`;
    
    if (valueDiff !== 0) {
      summary += valueDiff > 0 
        ? `💰 **${contractA.fileName}** has higher value by ${formatMoney(Math.abs(valueDiff))}.\n`
        : `💰 **${contractB.fileName}** has higher value by ${formatMoney(Math.abs(valueDiff))}.\n`;
    }

    if (differences.length > 0) {
      summary += `\n**Key Differences:**\n`;
      differences.slice(0, 5).forEach(d => {
        summary += `- **${d.field}**: ${d.valueA} vs ${d.valueB}\n`;
      });
    }

    return { contractA, contractB, comparison, summary };
  } catch {
    return {
      contractA: null,
      contractB: null,
      comparison: [],
      summary: 'Error comparing contracts. Please try again.' };
  }
}
