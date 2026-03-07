/**
 * Contract Health Score Calculator
 * Calculates overall health score based on multiple factors
 */

import { prisma } from '@/lib/prisma';

export interface HealthFactor {
  name: string;
  score: number; // 0-100
  weight: number; // Weight in final score
  status: 'good' | 'warning' | 'critical';
  message: string;
  recommendations?: string[];
}

export interface ContractHealthScore {
  contractId: string;
  overallScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'healthy' | 'needs-attention' | 'at-risk';
  factors: HealthFactor[];
  lastUpdated: Date;
}

export interface PortfolioHealthScore {
  tenantId: string;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalContracts: number;
  healthyContracts: number;
  atRiskContracts: number;
  needsAttentionContracts: number;
  topIssues: string[];
  trends: {
    period: string;
    score: number;
  }[];
}

/**
 * Calculate health score for a single contract
 */
export async function calculateContractHealth(
  contractId: string
): Promise<ContractHealthScore> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      artifacts: true,
    },
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  const factors: HealthFactor[] = [];

  // 1. Document Completeness (20%)
  const hasRawText = !!contract.rawText && contract.rawText.length > 100;
  const hasMetadata = contract.metadata && Object.keys(contract.metadata as Record<string, unknown>).length > 5;
  const hasArtifacts = contract.artifacts && contract.artifacts.length > 0;
  
  const completenessScore = (
    (hasRawText ? 40 : 0) +
    (hasMetadata ? 30 : 0) +
    (hasArtifacts ? 30 : 0)
  );
  
  factors.push({
    name: 'Document Completeness',
    score: completenessScore,
    weight: 0.20,
    status: completenessScore >= 80 ? 'good' : completenessScore >= 50 ? 'warning' : 'critical',
    message: completenessScore >= 80 
      ? 'All document data extracted successfully'
      : completenessScore >= 50
        ? 'Some document data is missing'
        : 'Critical document data is missing',
    recommendations: completenessScore < 80 ? [
      !hasRawText ? 'Re-run OCR extraction' : null,
      !hasMetadata ? 'Run metadata extraction' : null,
      !hasArtifacts ? 'Generate AI artifacts' : null,
    ].filter(Boolean) as string[] : undefined,
  });

  // 2. Key Terms Identified (20%)
  const keyTerms = (contract.metadata as Record<string, unknown>)?.keyTerms || [];
  const termsCount = Array.isArray(keyTerms) ? keyTerms.length : 0;
  const termsScore = Math.min(100, termsCount * 20); // 5 terms = 100%
  
  factors.push({
    name: 'Key Terms',
    score: termsScore,
    weight: 0.20,
    status: termsScore >= 80 ? 'good' : termsScore >= 40 ? 'warning' : 'critical',
    message: termsScore >= 80 
      ? `${termsCount} key terms identified`
      : termsScore >= 40
        ? 'Few key terms identified'
        : 'No key terms found',
  });

  // 3. Expiration Status (20%)
  const endDate = contract.endDate || (contract.metadata as Record<string, unknown>)?.endDate;
  let expirationScore = 100;
  let expirationStatus: 'good' | 'warning' | 'critical' = 'good';
  let expirationMessage = 'Contract expiration is not approaching';
  
  if (endDate) {
    const daysUntilExpiration = Math.ceil(
      (new Date(endDate as string).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilExpiration < 0) {
      expirationScore = 0;
      expirationStatus = 'critical';
      expirationMessage = 'Contract has expired';
    } else if (daysUntilExpiration < 30) {
      expirationScore = 25;
      expirationStatus = 'critical';
      expirationMessage = `Expires in ${daysUntilExpiration} days`;
    } else if (daysUntilExpiration < 90) {
      expirationScore = 60;
      expirationStatus = 'warning';
      expirationMessage = `Expires in ${daysUntilExpiration} days`;
    }
  }
  
  factors.push({
    name: 'Expiration Status',
    score: expirationScore,
    weight: 0.20,
    status: expirationStatus,
    message: expirationMessage,
    recommendations: expirationStatus !== 'good' ? [
      'Review renewal options',
      'Contact counterparty',
    ] : undefined,
  });

  // 4. Risk Level (20%)
  const riskLevel = (contract.metadata as Record<string, unknown>)?.riskLevel;
  let riskScore = 50; // Default to medium if unknown
  let riskStatus: 'good' | 'warning' | 'critical' = 'warning';
  
  if (riskLevel === 'low') {
    riskScore = 100;
    riskStatus = 'good';
  } else if (riskLevel === 'medium') {
    riskScore = 60;
    riskStatus = 'warning';
  } else if (riskLevel === 'high') {
    riskScore = 20;
    riskStatus = 'critical';
  }
  
  factors.push({
    name: 'Risk Assessment',
    score: riskScore,
    weight: 0.20,
    status: riskStatus,
    message: riskLevel ? `Risk level: ${riskLevel}` : 'Risk not assessed',
    recommendations: riskScore < 60 ? [
      'Review identified risk clauses',
      'Consult with legal team',
    ] : undefined,
  });

  // 5. Compliance Status (20%)
  const complianceIssues = (contract.metadata as Record<string, unknown>)?.complianceIssues;
  const issuesCount = Array.isArray(complianceIssues) ? complianceIssues.length : 0;
  const complianceScore = Math.max(0, 100 - issuesCount * 25);
  
  factors.push({
    name: 'Compliance',
    score: complianceScore,
    weight: 0.20,
    status: complianceScore >= 75 ? 'good' : complianceScore >= 50 ? 'warning' : 'critical',
    message: issuesCount === 0 
      ? 'No compliance issues detected'
      : `${issuesCount} compliance issue(s) found`,
    recommendations: issuesCount > 0 ? [
      'Review compliance report',
      'Address identified issues',
    ] : undefined,
  });

  // Calculate overall score
  const overallScore = Math.round(
    factors.reduce((sum, factor) => sum + factor.score * factor.weight, 0)
  );

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 80) grade = 'B';
  else if (overallScore >= 70) grade = 'C';
  else if (overallScore >= 60) grade = 'D';
  else grade = 'F';

  // Determine status
  let status: 'healthy' | 'needs-attention' | 'at-risk';
  if (overallScore >= 75) status = 'healthy';
  else if (overallScore >= 50) status = 'needs-attention';
  else status = 'at-risk';

  return {
    contractId,
    overallScore,
    grade,
    status,
    factors,
    lastUpdated: new Date(),
  };
}

/**
 * Calculate portfolio health score for a tenant
 */
export async function calculatePortfolioHealth(
  tenantId: string
): Promise<PortfolioHealthScore> {
  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    select: { id: true },
  });

  const healthScores = await Promise.all(
    contracts.slice(0, 100).map(c => calculateContractHealth(c.id).catch(() => null))
  );

  const validScores = healthScores.filter(Boolean) as ContractHealthScore[];
  
  const healthyContracts = validScores.filter(s => s.status === 'healthy').length;
  const needsAttentionContracts = validScores.filter(s => s.status === 'needs-attention').length;
  const atRiskContracts = validScores.filter(s => s.status === 'at-risk').length;

  const overallScore = validScores.length > 0
    ? Math.round(validScores.reduce((sum, s) => sum + s.overallScore, 0) / validScores.length)
    : 0;

  // Collect top issues
  const issueCount: Record<string, number> = {};
  validScores.forEach(score => {
    score.factors.forEach(factor => {
      if (factor.status !== 'good') {
        issueCount[factor.name] = (issueCount[factor.name] || 0) + 1;
      }
    });
  });
  
  const topIssues = Object.entries(issueCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => `${name}: ${count} contracts affected`);

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 80) grade = 'B';
  else if (overallScore >= 70) grade = 'C';
  else if (overallScore >= 60) grade = 'D';
  else grade = 'F';

  return {
    tenantId,
    overallScore,
    grade,
    totalContracts: contracts.length,
    healthyContracts,
    atRiskContracts,
    needsAttentionContracts,
    topIssues,
    trends: [], // Would be calculated from historical data
  };
}
