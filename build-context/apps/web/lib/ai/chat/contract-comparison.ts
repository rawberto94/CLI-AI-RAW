import { prisma } from '@/lib/prisma';

export interface ContractComparisonData {
  id: string;
  contractTitle: string;
  supplierName: string;
  status: string;
  totalValue: number;
  annualValue: number;
  effectiveDate: Date | null;
  expirationDate: Date | null;
  durationMonths: number;
  categoryL1: string | null;
  categoryL2: string | null;
  paymentTerms: string | null;
  paymentFrequency: string | null;
  autoRenewalEnabled: boolean;
  noticePeriodDays: number | null;
  terminationClause: string | null;
  currency: string | null;
  artifacts: Array<{
    id: string;
    type: string;
    title: string;
    content: Record<string, unknown>;
  }>;
  metadata: Record<string, unknown>;
  keyTerms: string[];
  clauses: Record<string, string | null>;
  rates?: Array<{
    roleName: string;
    rate: number;
    currency: string;
    unit: string;
  }>;
}

export interface ComparisonResult {
  entity1: ContractComparisonData | null;
  entity2: ContractComparisonData | null;
  entity1Name: string;
  entity2Name: string;
  differences: {
    field: string;
    label: string;
    value1: unknown;
    value2: unknown;
    analysis: string;
  }[];
  similarities: {
    field: string;
    label: string;
    sharedValue: unknown;
  }[];
  summary: string;
  keyInsights: string[];
  recommendation: string;
}

/**
 * Find contracts matching a supplier or contract name for comparison
 */
export async function findContractsForComparison(
  searchTerm: string,
  tenantId: string
): Promise<ContractComparisonData[]> {
  try {
    
    // Search by supplier name OR contract title
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        OR: [
          { supplierName: { contains: searchTerm, mode: 'insensitive' } },
          { contractTitle: { contains: searchTerm, mode: 'insensitive' } },
        ] },
      include: {
        contractMetadata: true },
      orderBy: { totalValue: 'desc' },
      take: 5, // Get top 5 by value
    });
    
    
    // For each contract, get artifacts and rate cards
    const contractsWithData: ContractComparisonData[] = [];
    
    for (const contract of contracts) {
      // Get artifacts
      const artifacts = await prisma.artifact.findMany({
        where: { contractId: contract.id },
        select: {
          id: true,
          type: true,
          title: true,
          data: true,
          status: true },
        take: 20 });
      
      // Get rate card entries
      const rateCards = await prisma.rateCardEntry.findMany({
        where: { contractId: contract.id },
        select: {
          roleStandardized: true,
          roleOriginal: true,
          dailyRate: true,
          currency: true,
          unit: true },
        take: 20 });
      
      // Extract key terms from metadata
      const customFields = (contract.contractMetadata as any)?.customFields || {};
      const appliedMetadata = typeof customFields === 'object' && customFields
        ? Object.fromEntries(Object.entries(customFields).filter(([k]) => !String(k).startsWith('_')))
        : {};

      if ((appliedMetadata as any).contract_name !== undefined && (appliedMetadata as any).contract_title === undefined) {
        (appliedMetadata as any).contract_title = (appliedMetadata as any).contract_name;
      }
      if ((appliedMetadata as any).notice_period_days !== undefined && (appliedMetadata as any).notice_period === undefined) {
        (appliedMetadata as any).notice_period = (appliedMetadata as any).notice_period_days;
      }
      if ((appliedMetadata as any).party_a_name !== undefined && (appliedMetadata as any).client_name === undefined) {
        (appliedMetadata as any).client_name = (appliedMetadata as any).party_a_name;
      }
      if ((appliedMetadata as any).party_b_name !== undefined && (appliedMetadata as any).supplier_name === undefined) {
        (appliedMetadata as any).supplier_name = (appliedMetadata as any).party_b_name;
      }
      const metadata = {
        ...(typeof contract.aiMetadata === 'object' && contract.aiMetadata ? (contract.aiMetadata as any) : {}),
        ...(appliedMetadata as any) };
      const keyTerms: string[] = [];
      
      // Parse metadata for key terms
      if (typeof metadata === 'object') {
        const meta = metadata as any;
        if (meta.termination_clause) keyTerms.push(`Termination: ${meta.termination_clause}`);
        if (meta.liability_cap) keyTerms.push(`Liability Cap: ${meta.liability_cap}`);
        if (meta.indemnification) keyTerms.push(`Indemnification: ${meta.indemnification}`);
        if (meta.sla_terms) keyTerms.push(`SLA: ${meta.sla_terms}`);
        if (meta.payment_terms) keyTerms.push(`Payment: ${meta.payment_terms}`);
      }
      
      // Build clauses object from artifacts
      const clauses: Record<string, string | null> = {
        termination: null,
        liability: null,
        indemnification: null,
        confidentiality: null,
        intellectualProperty: null,
        sla: null,
        warranty: null,
        insurance: null };
      
      // Extract clauses from artifacts
      for (const artifact of artifacts) {
        if (artifact.type === 'TERMINATION_CLAUSE' || artifact.title?.toLowerCase().includes('termination')) {
          clauses.termination = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
        if (artifact.type === 'LIABILITY_CLAUSE' || artifact.title?.toLowerCase().includes('liability')) {
          clauses.liability = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
        if (artifact.title?.toLowerCase().includes('indemnif')) {
          clauses.indemnification = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
        if (artifact.title?.toLowerCase().includes('confidential')) {
          clauses.confidentiality = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
        if (artifact.title?.toLowerCase().includes('intellectual') || artifact.title?.toLowerCase().includes('ip')) {
          clauses.intellectualProperty = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
        if (artifact.type === 'SLA_TERMS' || artifact.title?.toLowerCase().includes('sla')) {
          clauses.sla = typeof artifact.data === 'string' 
            ? artifact.data 
            : JSON.stringify(artifact.data).substring(0, 500);
        }
      }
      
      // Calculate duration
      const effectiveDate = contract.effectiveDate ? new Date(contract.effectiveDate) : null;
      const expirationDate = contract.expirationDate ? new Date(contract.expirationDate) : null;
      const durationMonths = effectiveDate && expirationDate
        ? Math.round((expirationDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
        : 0;
      
      contractsWithData.push({
        id: contract.id,
        contractTitle: contract.contractTitle || 'Untitled Contract',
        supplierName: contract.supplierName || 'Unknown Supplier',
        status: contract.status,
        totalValue: Number(contract.totalValue) || 0,
        annualValue: Number(contract.annualValue) || 0,
        effectiveDate,
        expirationDate,
        durationMonths,
        categoryL1: contract.categoryL1,
        categoryL2: contract.categoryL2,
        paymentTerms: contract.paymentTerms,
        paymentFrequency: contract.paymentFrequency,
        autoRenewalEnabled: contract.autoRenewalEnabled || false,
        noticePeriodDays: contract.noticePeriodDays,
        terminationClause: contract.terminationClause,
        currency: contract.currency,
        artifacts: artifacts.map(a => ({
          id: a.id,
          type: a.type as string,
          title: a.title || 'Untitled',
          content: (a.data as Record<string, unknown>) || {} })),
        metadata,
        keyTerms,
        clauses,
        rates: rateCards.map(r => ({
          roleName: r.roleStandardized || r.roleOriginal || 'Unknown Role',
          rate: Number(r.dailyRate) || 0,
          currency: r.currency || 'USD',
          unit: r.unit || 'day' })) });
    }
    
    return contractsWithData;
  } catch {
    return [];
  }
}

/**
 * Perform comprehensive comparison between two entities (suppliers or contracts)
 */
export async function performContractComparison(
  entity1Name: string,
  entity2Name: string,
  tenantId: string,
  aspectsToCompare?: {
    value?: boolean;
    duration?: boolean;
    terms?: boolean;
    risk?: boolean;
    rates?: boolean;
    clauses?: boolean;
  }
): Promise<ComparisonResult> {
  
  // Find contracts for both entities
  const [contracts1, contracts2] = await Promise.all([
    findContractsForComparison(entity1Name, tenantId),
    findContractsForComparison(entity2Name, tenantId),
  ]);
  
  // Get the top contract for each entity (highest value)
  const contract1 = contracts1[0] || null;
  const contract2 = contracts2[0] || null;
  
  const differences: ComparisonResult['differences'] = [];
  const similarities: ComparisonResult['similarities'] = [];
  const keyInsights: string[] = [];
  
  // Helper function to format currency
  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0 }).format(value);
  };
  
  // Helper function to analyze difference
  const analyzeDifference = (field: string, val1: unknown, val2: unknown): string => {
    if (val1 === null && val2 === null) return 'Both contracts are missing this information';
    if (val1 === null) return `Only ${entity2Name} has this defined`;
    if (val2 === null) return `Only ${entity1Name} has this defined`;
    
    if (typeof val1 === 'number' && typeof val2 === 'number') {
      const diff = val1 - val2;
      const pct = val2 !== 0 ? Math.round((diff / val2) * 100) : 0;
      if (diff > 0) {
        return `${entity1Name} is ${Math.abs(pct)}% higher`;
      } else if (diff < 0) {
        return `${entity2Name} is ${Math.abs(pct)}% higher`;
      }
      return 'Both are equal';
    }
    
    return 'Values differ';
  };
  
  if (contract1 && contract2) {
    // Compare values
    if (aspectsToCompare?.value !== false) {
      if (contract1.totalValue !== contract2.totalValue) {
        differences.push({
          field: 'totalValue',
          label: 'Total Contract Value',
          value1: formatCurrency(contract1.totalValue, contract1.currency || 'USD'),
          value2: formatCurrency(contract2.totalValue, contract2.currency || 'USD'),
          analysis: analyzeDifference('totalValue', contract1.totalValue, contract2.totalValue) });
        
        // Generate insight
        const valueDiff = Math.abs(contract1.totalValue - contract2.totalValue);
        if (valueDiff > 100000) {
          keyInsights.push(`Significant value difference of ${formatCurrency(valueDiff)} between contracts`);
        }
      } else {
        similarities.push({
          field: 'totalValue',
          label: 'Total Contract Value',
          sharedValue: formatCurrency(contract1.totalValue, contract1.currency || 'USD') });
      }
      
      // Annual value
      if (contract1.annualValue !== contract2.annualValue) {
        differences.push({
          field: 'annualValue',
          label: 'Annual Value',
          value1: formatCurrency(contract1.annualValue, contract1.currency || 'USD'),
          value2: formatCurrency(contract2.annualValue, contract2.currency || 'USD'),
          analysis: analyzeDifference('annualValue', contract1.annualValue, contract2.annualValue) });
      }
    }
    
    // Compare duration
    if (aspectsToCompare?.duration !== false) {
      if (contract1.durationMonths !== contract2.durationMonths) {
        differences.push({
          field: 'duration',
          label: 'Contract Duration',
          value1: `${contract1.durationMonths} months`,
          value2: `${contract2.durationMonths} months`,
          analysis: contract1.durationMonths > contract2.durationMonths
            ? `${entity1Name} has a longer commitment (${contract1.durationMonths - contract2.durationMonths} months more)`
            : `${entity2Name} has a longer commitment (${contract2.durationMonths - contract1.durationMonths} months more)` });
      } else if (contract1.durationMonths > 0) {
        similarities.push({
          field: 'duration',
          label: 'Contract Duration',
          sharedValue: `${contract1.durationMonths} months` });
      }
    }
    
    // Compare payment terms
    if (aspectsToCompare?.terms !== false) {
      if (contract1.paymentTerms !== contract2.paymentTerms) {
        differences.push({
          field: 'paymentTerms',
          label: 'Payment Terms',
          value1: contract1.paymentTerms || 'Not specified',
          value2: contract2.paymentTerms || 'Not specified',
          analysis: 'Different payment terms may affect cash flow planning' });
      } else if (contract1.paymentTerms) {
        similarities.push({
          field: 'paymentTerms',
          label: 'Payment Terms',
          sharedValue: contract1.paymentTerms });
      }
      
      // Notice period
      if (contract1.noticePeriodDays !== contract2.noticePeriodDays) {
        differences.push({
          field: 'noticePeriod',
          label: 'Notice Period',
          value1: contract1.noticePeriodDays ? `${contract1.noticePeriodDays} days` : 'Not specified',
          value2: contract2.noticePeriodDays ? `${contract2.noticePeriodDays} days` : 'Not specified',
          analysis: 'Different notice periods affect exit flexibility' });
      }
    }
    
    // Compare risk factors
    if (aspectsToCompare?.risk !== false) {
      // Auto-renewal comparison
      if (contract1.autoRenewalEnabled !== contract2.autoRenewalEnabled) {
        differences.push({
          field: 'autoRenewal',
          label: 'Auto-Renewal',
          value1: contract1.autoRenewalEnabled ? 'Enabled' : 'Disabled',
          value2: contract2.autoRenewalEnabled ? 'Enabled' : 'Disabled',
          analysis: contract1.autoRenewalEnabled
            ? `${entity1Name} auto-renews - monitor notice period`
            : `${entity2Name} auto-renews - monitor notice period` });
        
        if (contract1.autoRenewalEnabled || contract2.autoRenewalEnabled) {
          keyInsights.push('Auto-renewal is enabled on one contract - ensure timely review before renewal date');
        }
      }
      
      // Expiration dates
      if (contract1.expirationDate && contract2.expirationDate) {
        const now = Date.now();
        const days1 = Math.ceil((contract1.expirationDate.getTime() - now) / (1000 * 60 * 60 * 24));
        const days2 = Math.ceil((contract2.expirationDate.getTime() - now) / (1000 * 60 * 60 * 24));
        
        if (days1 <= 90 || days2 <= 90) {
          if (days1 <= 90) {
            keyInsights.push(`⚠️ ${entity1Name} contract expires in ${days1} days`);
          }
          if (days2 <= 90) {
            keyInsights.push(`⚠️ ${entity2Name} contract expires in ${days2} days`);
          }
        }
      }
    }
    
    // Compare rates if available
    if (aspectsToCompare?.rates !== false && contract1.rates && contract2.rates) {
      const roles1 = new Map(contract1.rates.map(r => [r.roleName.toLowerCase(), r]));
      const roles2 = new Map(contract2.rates.map(r => [r.roleName.toLowerCase(), r]));
      
      // Find common roles and compare
      const roles1Entries = Array.from(roles1.entries());
      for (const [roleName, rate1] of roles1Entries) {
        const rate2 = roles2.get(roleName);
        if (rate2) {
          if (rate1.rate !== rate2.rate) {
            const diff = rate1.rate - rate2.rate;
            const pctDiff = rate2.rate > 0 ? Math.round((diff / rate2.rate) * 100) : 0;
            differences.push({
              field: `rate_${roleName}`,
              label: `Rate: ${rate1.roleName}`,
              value1: `${formatCurrency(rate1.rate)}/${rate1.unit}`,
              value2: `${formatCurrency(rate2.rate)}/${rate2.unit}`,
              analysis: diff > 0
                ? `${entity1Name} is ${Math.abs(pctDiff)}% more expensive for this role`
                : `${entity2Name} is ${Math.abs(pctDiff)}% more expensive for this role` });
          }
        }
      }
      
      // Overall rate comparison insight
      const avgRate1 = contract1.rates.length > 0
        ? contract1.rates.reduce((sum, r) => sum + r.rate, 0) / contract1.rates.length
        : 0;
      const avgRate2 = contract2.rates.length > 0
        ? contract2.rates.reduce((sum, r) => sum + r.rate, 0) / contract2.rates.length
        : 0;
      
      if (avgRate1 > 0 && avgRate2 > 0) {
        const avgDiff = Math.round(((avgRate1 - avgRate2) / avgRate2) * 100);
        if (Math.abs(avgDiff) > 5) {
          keyInsights.push(
            avgDiff > 0
              ? `Average rates with ${entity1Name} are ${avgDiff}% higher than ${entity2Name}`
              : `Average rates with ${entity2Name} are ${Math.abs(avgDiff)}% higher than ${entity1Name}`
          );
        }
      }
    }
    
    // Compare clauses
    if (aspectsToCompare?.clauses !== false) {
      const clauseLabels: Record<string, string> = {
        termination: 'Termination Clause',
        liability: 'Liability Clause',
        indemnification: 'Indemnification',
        confidentiality: 'Confidentiality',
        intellectualProperty: 'Intellectual Property',
        sla: 'Service Level Agreement' };
      
      for (const [clauseKey, label] of Object.entries(clauseLabels)) {
        const clause1 = contract1.clauses[clauseKey];
        const clause2 = contract2.clauses[clauseKey];
        
        if (clause1 && clause2 && clause1 !== clause2) {
          differences.push({
            field: `clause_${clauseKey}`,
            label,
            value1: clause1.substring(0, 200) + (clause1.length > 200 ? '...' : ''),
            value2: clause2.substring(0, 200) + (clause2.length > 200 ? '...' : ''),
            analysis: 'Clause text differs - recommend legal review' });
        } else if (clause1 && !clause2) {
          differences.push({
            field: `clause_${clauseKey}`,
            label,
            value1: clause1.substring(0, 200) + (clause1.length > 200 ? '...' : ''),
            value2: 'Not found in contract',
            analysis: `${entity2Name} contract is missing this clause` });
        } else if (!clause1 && clause2) {
          differences.push({
            field: `clause_${clauseKey}`,
            label,
            value1: 'Not found in contract',
            value2: clause2.substring(0, 200) + (clause2.length > 200 ? '...' : ''),
            analysis: `${entity1Name} contract is missing this clause` });
        }
      }
    }
    
    // Category comparison
    if (contract1.categoryL1 !== contract2.categoryL1) {
      differences.push({
        field: 'category',
        label: 'Category',
        value1: contract1.categoryL1 || 'Uncategorized',
        value2: contract2.categoryL1 || 'Uncategorized',
        analysis: 'Contracts are in different categories' });
    } else if (contract1.categoryL1) {
      similarities.push({
        field: 'category',
        label: 'Category',
        sharedValue: contract1.categoryL1 });
    }
  }
  
  // Generate summary and recommendation
  let summary = '';
  let recommendation = '';
  
  if (!contract1 && !contract2) {
    summary = `Could not find contracts matching "${entity1Name}" or "${entity2Name}". Please check the supplier or contract names.`;
    recommendation = 'Try searching with more specific names or check the contract database.';
  } else if (!contract1) {
    summary = `Could not find contracts for "${entity1Name}". Found ${contracts2.length} contract(s) for "${entity2Name}".`;
    recommendation = `Consider verifying the name "${entity1Name}" or searching in the contracts list.`;
  } else if (!contract2) {
    summary = `Could not find contracts for "${entity2Name}". Found ${contracts1.length} contract(s) for "${entity1Name}".`;
    recommendation = `Consider verifying the name "${entity2Name}" or searching in the contracts list.`;
  } else {
    // Generate comprehensive summary
    const valueDiff = contract1.totalValue - contract2.totalValue;
    const valueWinner = valueDiff > 0 ? entity1Name : entity2Name;
    const durationDiff = contract1.durationMonths - contract2.durationMonths;
    
    summary = `**Comparison: ${contract1.supplierName} vs ${contract2.supplierName}**\n\n`;
    summary += `Found **${differences.length}** key differences and **${similarities.length}** similarities between the contracts.\n\n`;
    
    if (valueDiff !== 0) {
      summary += `💰 **Value**: ${valueWinner} has a ${formatCurrency(Math.abs(valueDiff))} ${valueDiff > 0 ? 'higher' : 'lower'} total contract value.\n`;
    }
    
    if (durationDiff !== 0) {
      const durationWinner = durationDiff > 0 ? entity1Name : entity2Name;
      summary += `📅 **Duration**: ${durationWinner} has a ${Math.abs(durationDiff)} month longer commitment.\n`;
    }
    
    // Build recommendation based on findings
    const recommendations: string[] = [];
    
    if (contract1.autoRenewalEnabled || contract2.autoRenewalEnabled) {
      recommendations.push('Review auto-renewal terms before expiration to avoid unwanted extensions');
    }
    
    if (differences.some(d => d.field.startsWith('rate_'))) {
      recommendations.push('Consider rate renegotiation based on the rate comparison');
    }
    
    if (differences.some(d => d.field.startsWith('clause_'))) {
      recommendations.push('Recommend legal review of clause differences between contracts');
    }
    
    recommendation = recommendations.length > 0
      ? recommendations.join('. ') + '.'
      : 'Both contracts are similar in key terms. Monitor expiration dates for timely renewal decisions.';
  }
  
  return {
    entity1: contract1,
    entity2: contract2,
    entity1Name,
    entity2Name,
    differences,
    similarities,
    summary,
    keyInsights,
    recommendation };
}

/**
 * Compare specific clauses between two contracts using RAG
 */
export async function compareContractClauses(
  entity1Name: string,
  entity2Name: string,
  clauseType: string,
  tenantId: string
): Promise<{
  entity1Clause: string | null;
  entity2Clause: string | null;
  analysis: string;
  differences: string[];
  recommendation: string;
}> {
  
  // Find contracts
  const [contracts1, contracts2] = await Promise.all([
    findContractsForComparison(entity1Name, tenantId),
    findContractsForComparison(entity2Name, tenantId),
  ]);
  
  const contract1 = contracts1[0];
  const contract2 = contracts2[0];
  
  if (!contract1 || !contract2) {
    return {
      entity1Clause: contract1 ? 'Contract found but clause not extracted' : null,
      entity2Clause: contract2 ? 'Contract found but clause not extracted' : null,
      analysis: `Could not find one or both contracts. ${entity1Name}: ${contract1 ? 'found' : 'not found'}, ${entity2Name}: ${contract2 ? 'found' : 'not found'}`,
      differences: [],
      recommendation: 'Please verify the contract/supplier names.' };
  }
  
  // Map clause type to key
  const clauseKeyMap: Record<string, string> = {
    'termination': 'termination',
    'terminate': 'termination',
    'liability': 'liability',
    'limit': 'liability',
    'indemnif': 'indemnification',
    'indemnity': 'indemnification',
    'confidential': 'confidentiality',
    'nda': 'confidentiality',
    'intellectual': 'intellectualProperty',
    'ip': 'intellectualProperty',
    'sla': 'sla',
    'service level': 'sla',
    'warranty': 'warranty',
    'insurance': 'insurance' };
  
  const clauseKey = Object.entries(clauseKeyMap).find(([pattern]) => 
    clauseType.toLowerCase().includes(pattern)
  )?.[1] || 'termination';
  
  const clause1 = contract1.clauses[clauseKey];
  const clause2 = contract2.clauses[clauseKey];
  
  const differences: string[] = [];
  let analysis = '';
  
  if (clause1 && clause2) {
    analysis = `Both contracts have ${clauseType} clauses defined. `;
    
    // Simple text comparison
    if (clause1.length !== clause2.length) {
      const lengthDiff = Math.abs(clause1.length - clause2.length);
      analysis += `${entity1Name}'s clause is ${clause1.length > clause2.length ? 'more' : 'less'} detailed (${lengthDiff} characters ${clause1.length > clause2.length ? 'longer' : 'shorter'}). `;
      differences.push(`Clause length differs by ${lengthDiff} characters`);
    }
    
    // Check for key terms
    const keyTermsToCheck = ['days', 'notice', 'liability', 'cap', 'limit', 'indemnify', 'material breach', 'convenience'];
    for (const term of keyTermsToCheck) {
      const in1 = clause1.toLowerCase().includes(term);
      const in2 = clause2.toLowerCase().includes(term);
      if (in1 && !in2) {
        differences.push(`"${term}" mentioned in ${entity1Name} but not in ${entity2Name}`);
      } else if (!in1 && in2) {
        differences.push(`"${term}" mentioned in ${entity2Name} but not in ${entity1Name}`);
      }
    }
  } else if (clause1 && !clause2) {
    analysis = `Only ${entity1Name} has the ${clauseType} clause defined. ${entity2Name} contract is missing this clause.`;
    differences.push(`${entity2Name} is missing the ${clauseType} clause entirely`);
  } else if (!clause1 && clause2) {
    analysis = `Only ${entity2Name} has the ${clauseType} clause defined. ${entity1Name} contract is missing this clause.`;
    differences.push(`${entity1Name} is missing the ${clauseType} clause entirely`);
  } else {
    analysis = `Neither contract has the ${clauseType} clause extracted. This may indicate the clauses exist but weren't automatically detected.`;
  }
  
  const recommendation = differences.length > 0
    ? `Review the ${clauseType} clause differences with legal counsel. Key differences: ${differences.slice(0, 3).join('; ')}.`
    : `Both contracts appear similar for ${clauseType} terms. Verify with legal review if needed.`;
  
  return {
    entity1Clause: clause1 ?? null,
    entity2Clause: clause2 ?? null,
    analysis,
    differences,
    recommendation };
}

// ============================================
// MULTI-CONTRACT GROUP COMPARISON
// ============================================

export interface GroupComparisonResult {
  groups: Array<{
    label: string;
    supplier?: string;
    year?: string;
    category?: string;
    contractCount: number;
    totalValue: number;
    avgValue: number;
    avgDurationMonths: number;
    activeCount: number;
    expiringSoonCount: number;
    contracts: Array<{ id: string; title: string; value: number }>;
  }>;
  categoryBreakdown?: Record<string, Array<{ count: number; value: number }>>;
  rateComparison?: Array<{ role: string; rates: number[] }>;
  insights: string[];
  recommendation: string;
}

/**
 * Compare multiple groups of contracts (e.g., all Deloitte 2024 contracts vs Accenture 2024)
 */
export async function performGroupComparison(
  groups: Array<{ supplier?: string; year?: string; category?: string; name?: string }>,
  tenantId: string
): Promise<GroupComparisonResult> {
  
  const formatCurrency = (val: number, curr: string = 'USD') =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: curr, maximumFractionDigits: 0 }).format(val);
  
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  // Helper to convert Decimal to number
  const toNumber = (val: unknown): number => {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(String(val)) || 0;
  };
  
  // Helper to compute duration in months from dates
  const computeDurationMonths = (startDate: Date | null, endDate: Date | null): number => {
    if (!startDate || !endDate) return 0;
    const diffMs = endDate.getTime() - startDate.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30)));
  };
  
  const result: GroupComparisonResult = {
    groups: [],
    categoryBreakdown: {},
    rateComparison: [],
    insights: [],
    recommendation: '' };
  
  // Fetch contracts for each group
  for (const group of groups) {
    const whereClause: Record<string, unknown> = { tenantId };
    
    // Build filter based on group criteria
    if (group.supplier) {
      whereClause.supplierName = { contains: group.supplier, mode: 'insensitive' };
    }
    
    if (group.year) {
      const year = parseInt(group.year);
      whereClause.startDate = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`) };
    }
    
    if (group.category) {
      whereClause.OR = [
        { categoryL1: { contains: group.category, mode: 'insensitive' } },
        { categoryL2: { contains: group.category, mode: 'insensitive' } },
      ];
    }
    
    const contracts = await prisma.contract.findMany({
      where: whereClause,
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        totalValue: true,
        annualValue: true,
        startDate: true,
        endDate: true,
        expirationDate: true,
        status: true,
        categoryL1: true,
        categoryL2: true,
        currency: true },
      orderBy: { totalValue: 'desc' } });
    
    // Calculate aggregates
    const totalValue = contracts.reduce((sum, c) => sum + toNumber(c.totalValue), 0);
    const avgValue = contracts.length > 0 ? totalValue / contracts.length : 0;
    
    // Calculate average duration
    const durations = contracts.map(c => computeDurationMonths(c.startDate, c.endDate || c.expirationDate));
    const avgDuration = contracts.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / contracts.length
      : 0;
    
    const activeCount = contracts.filter(c => c.status === 'ACTIVE').length;
    const expiringSoonCount = contracts.filter(c => {
      if (!c.expirationDate) return false;
      return c.expirationDate >= now && c.expirationDate <= thirtyDaysLater;
    }).length;
    
    // Build group label
    const label = group.name || [
      group.supplier,
      group.year,
      group.category,
    ].filter(Boolean).join(' ');
    
    result.groups.push({
      label,
      supplier: group.supplier,
      year: group.year,
      category: group.category,
      contractCount: contracts.length,
      totalValue,
      avgValue,
      avgDurationMonths: avgDuration,
      activeCount,
      expiringSoonCount,
      contracts: contracts.slice(0, 10).map(c => ({
        id: c.id,
        title: c.contractTitle || c.supplierName || 'Untitled',
        value: toNumber(c.totalValue) })) });
    
    // Build category breakdown
    for (const contract of contracts) {
      const cat = contract.categoryL1 || 'Uncategorized';
      if (!result.categoryBreakdown![cat]) {
        result.categoryBreakdown![cat] = groups.map(() => ({ count: 0, value: 0 }));
      }
      const groupIndex = result.groups.length - 1;
      if (result.categoryBreakdown![cat][groupIndex]) {
        result.categoryBreakdown![cat][groupIndex].count++;
        result.categoryBreakdown![cat][groupIndex].value += toNumber(contract.totalValue);
      }
    }
  }
  
  // Fetch rates for comparison
  if (result.groups.length >= 2) {
    const roleRates: Record<string, number[]> = {};
    
    for (let i = 0; i < result.groups.length; i++) {
      const group = result.groups[i];
      if (!group) continue;
      const contractIds = group.contracts.map(c => c.id);
      
      if (contractIds.length > 0) {
        const rates = await prisma.rateCardEntry.findMany({
          where: {
            contractId: { in: contractIds } },
          select: {
            roleStandardized: true,
            dailyRateUSD: true } });
        
        // Aggregate rates by role
        const roleAvgRates: Record<string, { sum: number; count: number }> = {};
        for (const rate of rates) {
          const role = rate.roleStandardized.toLowerCase();
          if (!roleAvgRates[role]) {
            roleAvgRates[role] = { sum: 0, count: 0 };
          }
          roleAvgRates[role].sum += toNumber(rate.dailyRateUSD);
          roleAvgRates[role].count++;
        }
        
        // Store average rates for this group
        for (const [role, data] of Object.entries(roleAvgRates)) {
          if (!roleRates[role]) {
            roleRates[role] = groups.map(() => 0);
          }
          roleRates[role][i] = data.sum / data.count;
        }
      }
    }
    
    // Convert to array format
    result.rateComparison = Object.entries(roleRates)
      .filter(([, rates]) => rates.some(r => r > 0))
      .map(([role, rates]) => ({
        role: role.charAt(0).toUpperCase() + role.slice(1),
        rates }))
      .sort((a, b) => (b.rates[0] ?? 0) - (a.rates[0] ?? 0));
  }
  
  // Generate insights
  if (result.groups.length >= 2) {
    const g1 = result.groups[0]!;
    const g2 = result.groups[1]!;
    
    // Contract count insight
    if (g1.contractCount !== g2.contractCount) {
      const diff = Math.abs(g1.contractCount - g2.contractCount);
      const higher = g1.contractCount > g2.contractCount ? g1 : g2;
      result.insights.push(`${higher.label} has ${diff} more contracts`);
    }
    
    // Total value insight
    if (g1.totalValue !== g2.totalValue) {
      const diff = Math.abs(g1.totalValue - g2.totalValue);
      const higher = g1.totalValue > g2.totalValue ? g1 : g2;
      const pctDiff = g2.totalValue > 0 ? Math.round((diff / g2.totalValue) * 100) : 0;
      result.insights.push(`${higher.label} represents ${formatCurrency(diff)} (${pctDiff}%) more in total value`);
    }
    
    // Average value insight
    if (g1.avgValue !== g2.avgValue && g1.contractCount > 0 && g2.contractCount > 0) {
      const diff = Math.abs(g1.avgValue - g2.avgValue);
      const higher = g1.avgValue > g2.avgValue ? g1 : g2;
      result.insights.push(`${higher.label} has ${formatCurrency(diff)} higher average contract value`);
    }
    
    // Duration insight
    if (Math.abs(g1.avgDurationMonths - g2.avgDurationMonths) > 3) {
      const longer = g1.avgDurationMonths > g2.avgDurationMonths ? g1 : g2;
      result.insights.push(`${longer.label} contracts average ${Math.abs(g1.avgDurationMonths - g2.avgDurationMonths).toFixed(1)} months longer duration`);
    }
    
    // Expiring soon warning
    if (g1.expiringSoonCount > 0 || g2.expiringSoonCount > 0) {
      result.insights.push(`⚠️ ${g1.expiringSoonCount + g2.expiringSoonCount} contracts expiring in the next 30 days`);
    }
    
    // Rate comparison insights
    if (result.rateComparison && result.rateComparison.length > 0) {
      const avgRateDiffs = result.rateComparison
        .filter(r => (r.rates[0] ?? 0) > 0 && (r.rates[1] ?? 0) > 0)
        .map(r => (((r.rates[0] ?? 0) - (r.rates[1] ?? 1)) / (r.rates[1] ?? 1)) * 100);
      
      if (avgRateDiffs.length > 0) {
        const avgDiff = avgRateDiffs.reduce((a, b) => a + b, 0) / avgRateDiffs.length;
        if (Math.abs(avgDiff) > 5) {
          const cheaper = avgDiff > 0 ? g2 : g1;
          result.insights.push(`💰 ${cheaper.label} averages ${Math.abs(avgDiff).toFixed(1)}% lower rates across comparable roles`);
        }
      }
    }
  }
  
  // Generate recommendation
  if (result.groups.length === 0 || result.groups.every(g => g.contractCount === 0)) {
    result.recommendation = 'No contracts found matching the specified criteria. Try broader search terms or verify supplier names.';
  } else if (result.groups.length >= 2) {
    const g1 = result.groups[0]!;
    const g2 = result.groups[1]!;
    
    const recommendations: string[] = [];
    
    // Value-based recommendation
    if (g1.totalValue > g2.totalValue * 1.5) {
      recommendations.push(`Consider negotiating volume discounts with ${g1.label} given the larger portfolio`);
    } else if (g2.totalValue > g1.totalValue * 1.5) {
      recommendations.push(`Consider negotiating volume discounts with ${g2.label} given the larger portfolio`);
    }
    
    // Rate-based recommendation
    if (result.rateComparison && result.rateComparison.length > 0) {
      const roleDiffs = result.rateComparison
        .filter(r => (r.rates[0] ?? 0) > 0 && (r.rates[1] ?? 0) > 0)
        .map(r => ({ role: r.role, diff: (((r.rates[0] ?? 0) - (r.rates[1] ?? 1)) / (r.rates[1] ?? 1)) * 100 }));
      
      const significantDiffs = roleDiffs.filter(r => Math.abs(r.diff) > 10);
      if (significantDiffs.length > 0) {
        recommendations.push(`Review rate differences for ${significantDiffs.slice(0, 3).map(r => r.role).join(', ')} - potential for rate optimization`);
      }
    }
    
    // Expiration warning
    if (g1.expiringSoonCount > 0 || g2.expiringSoonCount > 0) {
      recommendations.push('Prioritize renewal discussions for contracts expiring soon');
    }
    
    result.recommendation = recommendations.length > 0
      ? recommendations.join('. ') + '.'
      : 'Both groups show comparable metrics. Continue monitoring and evaluate consolidation opportunities.';
  } else {
    result.recommendation = `Found ${result.groups[0]?.contractCount || 0} contracts for ${result.groups[0]?.label || 'unknown'}. Add another group to enable comparison.`;
  }
  
  return result;
}
