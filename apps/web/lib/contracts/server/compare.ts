import type { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

import { createErrorResponse, createSuccessResponse, type ContractApiContext } from '@/lib/api-middleware';

interface ComparisonResult {
  contracts: Array<{
    id: string;
    name: string;
  }>;
  comparison: {
    commonClauses: string[];
    differences: Array<{
      category: string;
      differences: Array<{
        contractId: string;
        value: string;
      }>;
    }>;
    metrics: Array<{
      metric: string;
      values: Array<{
        contractId: string;
        value: number | string;
      }>;
    }>;
    summary: string;
  };
}

interface ContractWithMetadata {
  id: string;
  contractTitle?: string | null;
  supplierName?: string | null;
  status: string;
  totalValue?: number | Prisma.Decimal | null;
  annualValue?: number | Prisma.Decimal | null;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
  categoryL1?: string | null;
  categoryL2?: string | null;
  paymentTerms?: string | null;
  paymentFrequency?: string | null;
  autoRenewalEnabled?: boolean | null;
  noticePeriodDays?: number | null;
  currency?: string | null;
  contractType?: string | null;
  name?: string | null;
  fileName?: string | null;
  metadata?: Prisma.JsonValue | null;
  type?: string | null;
  value?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  contractMetadata?: unknown;
  artifacts?: unknown[];
}

interface ComparisonDifference {
  field: string;
  label: string;
  value1: string | number | boolean;
  value2: string | number | boolean;
  analysis: string;
  advantage?: 'entity1' | 'entity2' | 'neutral';
}

interface ComparisonSimilarity {
  field: string;
  label: string;
  sharedValue: string | number | boolean;
}

interface ContractTerm {
  id: string;
  name: string;
  terms: string[];
  value: number;
  startDate?: string;
  endDate?: string;
  parties: string[];
  riskLevel: string;
  contractType: string;
}

const smartCompareSchema = z.object({
  contractId1: z.string().min(1, 'contractId1 is required'),
  contractId2: z.string().min(1, 'contractId2 is required'),
});

export async function postContractsCompare(
  request: NextRequest,
  context: ContractApiContext,
) {
  const body = await request.json();
  let contractIds: string[];

  if (body.contractId1 && body.contractId2) {
    contractIds = [body.contractId1, body.contractId2];
  } else if (body.contractIds && Array.isArray(body.contractIds)) {
    contractIds = body.contractIds;
  } else {
    return createErrorResponse(
      context,
      'VALIDATION_ERROR',
      'Provide either contractIds array or contractId1 and contractId2',
      400,
    );
  }

  if (contractIds.length < 2) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'At least 2 contractIds are required for comparison', 400);
  }

  if (contractIds.length > 5) {
    return createErrorResponse(context, 'VALIDATION_ERROR', 'Maximum 5 contracts can be compared at once', 400);
  }

  const { prisma } = await import('@/lib/prisma');
  const contracts = await prisma.contract.findMany({
    where: {
      id: { in: contractIds },
      tenantId: context.tenantId,
    },
    include: {
      contractMetadata: true,
      artifacts: {
        select: {
          id: true,
          type: true,
          data: true,
          status: true,
        },
        take: 30,
      },
    },
  });

  if (contracts.length < contractIds.length) {
    return createErrorResponse(context, 'NOT_FOUND', 'Could not find all specified contracts', 404);
  }

  const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));
  const orderedContracts = contractIds
    .map((contractId) => contractsById.get(contractId))
    .filter((contract): contract is typeof contracts[number] => Boolean(contract));

  if (body.contractId1 && body.contractId2) {
    const result = await compareContractsEnhanced(orderedContracts[0], orderedContracts[1]);
    return createSuccessResponse(context, result);
  }

  const result = await compareContracts(orderedContracts);
  return createSuccessResponse(context, result);
}

export async function postSmartContractsCompare(
  request: NextRequest,
  context: ContractApiContext,
) {
  const body = await request.json();

  let validated;
  try {
    validated = smartCompareSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(
        context,
        'VALIDATION_ERROR',
        error.errors.map((issue) => issue.message).join(', '),
        400,
      );
    }

    throw error;
  }

  const { contractId1, contractId2 } = validated;
  if (contractId1 === contractId2) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Cannot compare a contract with itself', 400);
  }

  try {
    const { generateSmartComparison } = await import('@/lib/ai/smart-comparison.service');
    const report = await generateSmartComparison({
      contractId1,
      contractId2,
      tenantId: context.tenantId,
    });

    return createSuccessResponse(context, { report });
  } catch (error) {
    return createErrorResponse(
      context,
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'Smart comparison failed',
      500,
    );
  }
}

async function compareContractsEnhanced(
  contract1: ContractWithMetadata,
  contract2: ContractWithMetadata,
) {
  const differences: ComparisonDifference[] = [];
  const similarities: ComparisonSimilarity[] = [];
  const keyInsights: string[] = [];

  const formatCurrency = (value: number, currency = 'USD') => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);

  const getDuration = (contract: ContractWithMetadata) => {
    if (!contract.effectiveDate || !contract.expirationDate) return 0;
    const start = new Date(contract.effectiveDate);
    const end = new Date(contract.expirationDate);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
  };

  const getDaysUntil = (dateValue: string | Date | null) => {
    if (!dateValue) return null;
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const value1 = Number(contract1.totalValue) || 0;
  const value2 = Number(contract2.totalValue) || 0;
  if (value1 !== value2) {
    const diff = value1 - value2;
    const pct = value2 > 0 ? Math.round((diff / value2) * 100) : 0;
    differences.push({
      field: 'totalValue',
      label: 'Total Value',
      value1: formatCurrency(value1, contract1.currency || 'USD'),
      value2: formatCurrency(value2, contract2.currency || 'USD'),
      analysis: `${Math.abs(pct)}% ${diff > 0 ? 'higher' : 'lower'}`,
      advantage: diff < 0 ? 'entity1' : diff > 0 ? 'entity2' : 'neutral',
    });

    if (Math.abs(diff) > 100000) {
      keyInsights.push(`Significant value difference of ${formatCurrency(Math.abs(diff))}`);
    }
  } else {
    similarities.push({
      field: 'totalValue',
      label: 'Total Value',
      sharedValue: formatCurrency(value1),
    });
  }

  if (contract1.status !== contract2.status) {
    differences.push({
      field: 'status',
      label: 'Status',
      value1: contract1.status,
      value2: contract2.status,
      analysis: 'Different contract states',
    });
  } else {
    similarities.push({
      field: 'status',
      label: 'Status',
      sharedValue: contract1.status,
    });
  }

  const duration1 = getDuration(contract1);
  const duration2 = getDuration(contract2);
  if (duration1 !== duration2 && (duration1 > 0 || duration2 > 0)) {
    differences.push({
      field: 'duration',
      label: 'Duration',
      value1: `${duration1} months`,
      value2: `${duration2} months`,
      analysis: `${Math.abs(duration1 - duration2)} months difference`,
    });
  }

  if (contract1.categoryL1 !== contract2.categoryL1) {
    differences.push({
      field: 'category',
      label: 'Category',
      value1: contract1.categoryL1 || 'Uncategorized',
      value2: contract2.categoryL1 || 'Uncategorized',
      analysis: 'Different categories',
    });
  } else if (contract1.categoryL1) {
    similarities.push({
      field: 'category',
      label: 'Category',
      sharedValue: contract1.categoryL1,
    });
  }

  if (contract1.paymentTerms !== contract2.paymentTerms) {
    differences.push({
      field: 'paymentTerms',
      label: 'Payment Terms',
      value1: contract1.paymentTerms || 'Not specified',
      value2: contract2.paymentTerms || 'Not specified',
      analysis: 'Different payment terms',
    });
  }

  if (contract1.autoRenewalEnabled !== contract2.autoRenewalEnabled) {
    differences.push({
      field: 'autoRenewal',
      label: 'Auto-Renewal',
      value1: contract1.autoRenewalEnabled ? 'Enabled' : 'Disabled',
      value2: contract2.autoRenewalEnabled ? 'Enabled' : 'Disabled',
      analysis: 'Different renewal settings',
    });

    if (contract1.autoRenewalEnabled || contract2.autoRenewalEnabled) {
      keyInsights.push('One contract has auto-renewal enabled - monitor notice periods');
    }
  }

  const days1 = getDaysUntil(contract1.expirationDate ?? null);
  const days2 = getDaysUntil(contract2.expirationDate ?? null);
  if (days1 && days1 <= 90) {
    keyInsights.push(`Warning: ${contract1.supplierName} contract expires in ${days1} days`);
  }
  if (days2 && days2 <= 90) {
    keyInsights.push(`Warning: ${contract2.supplierName} contract expires in ${days2} days`);
  }

  const recommendations: string[] = [];
  if (contract1.autoRenewalEnabled || contract2.autoRenewalEnabled) {
    recommendations.push('Review auto-renewal terms before expiration');
  }
  if (differences.some((difference) => difference.field === 'paymentTerms')) {
    recommendations.push('Consider standardizing payment terms across suppliers');
  }
  if ((days1 && days1 <= 90) || (days2 && days2 <= 90)) {
    recommendations.push('Initiate renewal discussions for expiring contracts');
  }

  const recommendation = recommendations.length > 0
    ? `${recommendations.join('. ')}.`
    : 'Both contracts are similar in key terms. Monitor expiration dates for timely renewal decisions.';

  return {
    entity1: {
      id: contract1.id,
      contractTitle: contract1.contractTitle,
      supplierName: contract1.supplierName,
      status: contract1.status,
      totalValue: value1,
      annualValue: Number(contract1.annualValue) || 0,
      effectiveDate: contract1.effectiveDate,
      expirationDate: contract1.expirationDate,
      categoryL1: contract1.categoryL1,
      categoryL2: contract1.categoryL2,
      paymentTerms: contract1.paymentTerms,
      paymentFrequency: contract1.paymentFrequency,
      autoRenewalEnabled: contract1.autoRenewalEnabled || false,
      noticePeriodDays: contract1.noticePeriodDays,
      currency: contract1.currency,
      contractType: contract1.contractType,
    },
    entity2: {
      id: contract2.id,
      contractTitle: contract2.contractTitle,
      supplierName: contract2.supplierName,
      status: contract2.status,
      totalValue: value2,
      annualValue: Number(contract2.annualValue) || 0,
      effectiveDate: contract2.effectiveDate,
      expirationDate: contract2.expirationDate,
      categoryL1: contract2.categoryL1,
      categoryL2: contract2.categoryL2,
      paymentTerms: contract2.paymentTerms,
      paymentFrequency: contract2.paymentFrequency,
      autoRenewalEnabled: contract2.autoRenewalEnabled || false,
      noticePeriodDays: contract2.noticePeriodDays,
      currency: contract2.currency,
      contractType: contract2.contractType,
    },
    differences,
    similarities,
    summary: `Comparison of ${contract1.supplierName} vs ${contract2.supplierName}`,
    keyInsights,
    recommendation,
  };
}

async function compareContracts(contracts: ContractWithMetadata[]): Promise<ComparisonResult> {
  const contractTerms = contracts.map((contract) => {
    const metadata = (contract.metadata || {}) as Record<string, unknown>;
    return {
      id: contract.id,
      name: contract.name || contract.fileName || 'Unnamed Contract',
      terms: (metadata.keyTerms || []) as string[],
      value: (metadata.totalValue as number) || contract.value || 0,
      startDate: (metadata.startDate as string) || contract.startDate?.toISOString(),
      endDate: (metadata.endDate as string) || contract.endDate?.toISOString(),
      parties: (metadata.parties || []) as string[],
      riskLevel: (metadata.riskLevel as string) || 'unknown',
      contractType: (metadata.contractType as string) || contract.type || 'Unknown',
    };
  });

  const allTerms = contractTerms.flatMap((contract) => contract.terms);
  const termCounts = allTerms.reduce((accumulator, term) => {
    accumulator[term] = (accumulator[term] || 0) + 1;
    return accumulator;
  }, {} as Record<string, number>);

  const commonClauses = Object.entries(termCounts)
    .filter(([, count]) => count === contracts.length)
    .map(([term]) => term);

  const differences: ComparisonResult['comparison']['differences'] = [];

  const typeValues = contractTerms.map((contract) => ({ contractId: contract.id, value: contract.contractType }));
  if (new Set(typeValues.map((value) => value.value)).size > 1) {
    differences.push({
      category: 'Contract Type',
      differences: typeValues,
    });
  }

  const riskValues = contractTerms.map((contract) => ({ contractId: contract.id, value: String(contract.riskLevel || 'Unknown') }));
  if (new Set(riskValues.map((value) => value.value)).size > 1) {
    differences.push({
      category: 'Risk Level',
      differences: riskValues,
    });
  }

  const partiesMatch = contractTerms.every((contract) =>
    JSON.stringify(contract.parties.sort()) === JSON.stringify((contractTerms[0]?.parties || []).sort()),
  );
  if (!partiesMatch) {
    differences.push({
      category: 'Parties',
      differences: contractTerms.map((contract) => ({
        contractId: contract.id,
        value: contract.parties.join(', ') || 'Not specified',
      })),
    });
  }

  const metrics: ComparisonResult['comparison']['metrics'] = [
    {
      metric: 'Contract Value',
      values: contractTerms.map((contract) => ({
        contractId: contract.id,
        value: typeof contract.value === 'number' ? contract.value : 0,
      })),
    },
    {
      metric: 'Start Date',
      values: contractTerms.map((contract) => ({
        contractId: contract.id,
        value: contract.startDate || 'Not specified',
      })),
    },
    {
      metric: 'End Date',
      values: contractTerms.map((contract) => ({
        contractId: contract.id,
        value: contract.endDate || 'Not specified',
      })),
    },
    {
      metric: 'Key Terms Count',
      values: contractTerms.map((contract) => ({
        contractId: contract.id,
        value: contract.terms.length,
      })),
    },
  ];

  return {
    contracts: contracts.map((contract) => ({
      id: contract.id,
      name: contract.name || contract.fileName || 'Unnamed Contract',
    })),
    comparison: {
      commonClauses,
      differences,
      metrics,
      summary: generateComparisonSummary(contractTerms, commonClauses, differences),
    },
  };
}

function generateComparisonSummary(
  contracts: ContractTerm[],
  commonClauses: string[],
  differences: ComparisonResult['comparison']['differences'],
): string {
  const parts: string[] = [];
  parts.push(`Comparing ${contracts.length} contracts.`);

  if (commonClauses.length > 0) {
    parts.push(`Found ${commonClauses.length} common clauses/terms.`);
  }

  if (differences.length > 0) {
    parts.push(`Identified ${differences.length} categories with differences.`);
  } else {
    parts.push('Contracts appear to have similar structure and terms.');
  }

  const totalValue = contracts.reduce((sum, contract) => sum + (contract.value || 0), 0);
  if (totalValue > 0) {
    parts.push(`Combined contract value: $${totalValue.toLocaleString()}.`);
  }

  return parts.join(' ');
}