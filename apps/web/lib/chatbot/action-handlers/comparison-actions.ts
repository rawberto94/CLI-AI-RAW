/**
 * Comparison Actions Handler
 * Handles contract and supplier comparison operations
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';
import { prisma } from '@/lib/prisma';

export async function handleComparisonActions(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action, entities } = intent;
  const { tenantId } = context;

  try {
    switch (action) {
      case 'compare_contracts':
        return await compareContracts(entities.contractIds || [], tenantId);

      case 'compare_clauses':
        return await compareClauses(entities.contractIds || [], entities.clauseType, tenantId);

      case 'compare_suppliers':
        return await compareSuppliers(entities.supplierNames || [], tenantId);

      case 'compare_groups':
        return await compareGroups(entities, tenantId);

      case 'side_by_side':
        return await sideBySideComparison(entities.contractIds || [], tenantId);

      case 'find_differences':
        return await findDifferences(entities.contractIds || [], tenantId);

      case 'benchmark_contract':
        return await benchmarkContract(entities.contractId, tenantId);

      default:
        return {
          success: false,
          message: `Unknown comparison action: ${action}`,
        };
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: 'Failed to process comparison request',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

async function compareContracts(
  contractIds: string[],
  tenantId: string
): Promise<ActionResponse> {
  if (contractIds.length < 2) {
    return {
      success: false,
      message: 'Please specify at least 2 contracts to compare',
    };
  }

  const contracts = await prisma.contract.findMany({
    where: {
      id: { in: contractIds },
      tenantId,
    },
    include: {
      clauses: true,
    },
  });

  if (contracts.length < 2) {
    return {
      success: false,
      message: 'Could not find the specified contracts',
    };
  }

  // Build comparison matrix
  const comparison = contracts.map((c) => ({
    id: c.id,
    title: c.contractTitle,
    supplier: c.supplierName,
    status: c.status,
    value: c.totalValue,
    effectiveDate: c.effectiveDate,
    expirationDate: c.expirationDate,
    autoRenewal: c.autoRenewalEnabled,
    paymentTerms: c.paymentTerms,
    clauseCount: c.clauses.length,
    category: c.category,
  }));

  // Find differences
  const differences: Record<string, { values: (string | number | null | boolean | Date)[]; differs: boolean }> = {};
  const fields = ['supplier', 'status', 'autoRenewalEnabled', 'paymentTerms', 'category'];
  
  fields.forEach((field) => {
    const values = comparison.map((c) => (c as Record<string, unknown>)[field]);
    const unique = new Set(values.map((v) => JSON.stringify(v)));
    differences[field] = {
      values: values as (string | number | null | boolean | Date)[],
      differs: unique.size > 1,
    };
  });

  // Value comparison
  const values = comparison.map((c) => Number(c.value) || 0);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

  return {
    success: true,
    message: `Comparing ${contracts.length} contracts`,
    data: {
      contracts: comparison,
      differences,
      valueAnalysis: {
        min: minValue,
        max: maxValue,
        avg: avgValue,
        spread: maxValue - minValue,
      },
    },
    actions: [
      {
        label: 'View Side by Side',
        action: 'navigate',
        params: { url: `/compare?ids=${contractIds.join(',')}` },
      },
    ],
  };
}

async function compareClauses(
  contractIds: string[],
  clauseType: string | undefined,
  tenantId: string
): Promise<ActionResponse> {
  if (contractIds.length < 2) {
    return {
      success: false,
      message: 'Please specify at least 2 contracts to compare clauses',
    };
  }

  const where: Record<string, unknown> = {
    contract: { id: { in: contractIds }, tenantId },
  };
  
  if (clauseType) {
    where.category = { contains: clauseType, mode: 'insensitive' };
  }

  const clauses = await prisma.clause.findMany({
    where,
    include: {
      contract: { select: { id: true, contractTitle: true, supplierName: true } },
    },
    orderBy: [{ category: 'asc' }, { contractId: 'asc' }],
  });

  // Group by clause type
  const byType = clauses.reduce((acc, clause) => {
    const type = clause.category || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push({
      contractId: clause.contractId,
      contractTitle: clause.contract.contractTitle ?? '',
      supplier: clause.contract.supplierName,
      content: clause.text?.slice(0, 500),
      fullContent: clause.text,
    });
    return acc;
  }, {} as Record<string, Array<{ contractId: string; contractTitle: string; supplier: string | null; content: string | undefined; fullContent: string | null }>>);

  // Find clauses that differ
  const clauseTypes = Object.keys(byType);
  const differingTypes = clauseTypes.filter((type) => {
    const contents = byType[type].map((c) => c.fullContent);
    const unique = new Set(contents);
    return unique.size > 1;
  });

  return {
    success: true,
    message: clauseType
      ? `Comparing "${clauseType}" clauses across ${contractIds.length} contracts`
      : `Found ${clauseTypes.length} clause types, ${differingTypes.length} differ`,
    data: {
      byType,
      clauseTypes,
      differingTypes,
      stats: {
        totalClauses: clauses.length,
        uniqueTypes: clauseTypes.length,
        differingCount: differingTypes.length,
      },
    },
  };
}

async function compareSuppliers(
  supplierNames: string[],
  tenantId: string
): Promise<ActionResponse> {
  if (supplierNames.length < 2) {
    return {
      success: false,
      message: 'Please specify at least 2 suppliers to compare',
    };
  }

  const supplierData = await Promise.all(
    supplierNames.map(async (name) => {
      const contracts = await prisma.contract.findMany({
        where: {
          tenantId,
          supplierName: { contains: name, mode: 'insensitive' },
        },
        select: {
          id: true,
          status: true,
          totalValue: true,
          effectiveDate: true,
          expirationDate: true,
          category: true,
        },
      });

      const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);
      const active = contracts.filter((c) => c.status === 'ACTIVE').length;
      const categories = [...new Set(contracts.map((c) => c.category).filter(Boolean))];

      // Get average contract duration
      const durations = contracts
        .filter((c) => c.effectiveDate && c.expirationDate)
        .map((c) => {
          const start = new Date(c.effectiveDate!);
          const end = new Date(c.expirationDate!);
          return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
        });
      const avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      return {
        name,
        totalContracts: contracts.length,
        activeContracts: active,
        totalValue,
        avgDurationYears: Math.round(avgDuration * 10) / 10,
        categories,
      };
    })
  );

  // Ranking
  const byValue = [...supplierData].sort((a, b) => b.totalValue - a.totalValue);
  const byCount = [...supplierData].sort((a, b) => b.totalContracts - a.totalContracts);

  return {
    success: true,
    message: `Comparing ${supplierNames.length} suppliers`,
    data: {
      suppliers: supplierData,
      rankings: {
        byValue: byValue.map((s) => s.name),
        byContractCount: byCount.map((s) => s.name),
      },
    },
  };
}

async function compareGroups(
  entities: DetectedIntent['entities'],
  tenantId: string
): Promise<ActionResponse> {
  const { groupBy, category, dateRange } = entities;
  const groupField = groupBy || 'category';

  const where: Record<string, unknown> = { tenantId };
  if (category) {
    where.category = { contains: category, mode: 'insensitive' };
  }

  const contracts = await prisma.contract.findMany({
    where,
    select: {
      id: true,
      category: true,
      supplierName: true,
      status: true,
      totalValue: true,
      effectiveDate: true,
    },
  });

  // Group contracts
  const groups = contracts.reduce((acc, contract) => {
    let key: string;
    switch (groupField) {
      case 'supplier':
        key = contract.supplierName || 'Unknown';
        break;
      case 'status':
        key = contract.status;
        break;
      case 'year':
        key = contract.effectiveDate
          ? new Date(contract.effectiveDate).getFullYear().toString()
          : 'Unknown';
        break;
      default:
        key = contract.category || 'Uncategorized';
    }

    if (!acc[key]) {
      acc[key] = { count: 0, totalValue: 0, contracts: [] };
    }
    acc[key].count += 1;
    acc[key].totalValue += Number(contract.totalValue) || 0;
    acc[key].contracts.push(contract.id);
    return acc;
  }, {} as Record<string, { count: number; totalValue: number; contracts: string[] }>);

  const groupList = Object.entries(groups)
    .map(([name, data]) => ({
      name,
      ...data,
      avgValue: data.count > 0 ? data.totalValue / data.count : 0,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  return {
    success: true,
    message: `Grouped ${contracts.length} contracts by ${groupField}`,
    data: {
      groupBy: groupField,
      groups: groupList,
      summary: {
        totalGroups: groupList.length,
        largestGroup: groupList[0]?.name,
        highestValue: groupList[0]?.totalValue,
      },
    },
  };
}

async function sideBySideComparison(
  contractIds: string[],
  tenantId: string
): Promise<ActionResponse> {
  if (contractIds.length !== 2) {
    return {
      success: false,
      message: 'Side-by-side comparison requires exactly 2 contracts',
    };
  }

  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds }, tenantId },
    include: {
      clauses: { orderBy: { category: 'asc' } },
      artifacts: { where: { type: 'OVERVIEW' }, select: { data: true } },
    },
  });

  if (contracts.length !== 2) {
    return { success: false, message: 'Could not find both contracts' };
  }

  const [left, right] = contracts;

  // Build side-by-side structure
  const comparison = {
    basic: {
      title: [left.contractTitle, right.contractTitle],
      supplier: [left.supplierName, right.supplierName],
      status: [left.status, right.status],
      value: [left.totalValue, right.totalValue],
      effectiveDate: [left.effectiveDate, right.effectiveDate],
      expirationDate: [left.expirationDate, right.expirationDate],
    },
    terms: {
      paymentTerms: [left.paymentTerms, right.paymentTerms],
      autoRenewal: [left.autoRenewalEnabled, right.autoRenewalEnabled],
      noticePeriodDays: [left.noticePeriodDays, right.noticePeriodDays],
    },
    content: {
      clauseCount: [left.clauses.length, right.clauses.length],
      summary: [
        (left.artifacts[0]?.data as { summary?: string })?.summary || 'No summary',
        (right.artifacts[0]?.data as { summary?: string })?.summary || 'No summary',
      ],
    },
  };

  // Identify differences
  const differences: string[] = [];
  if (left.totalValue !== right.totalValue) differences.push('value');
  if (left.autoRenewalEnabled !== right.autoRenewalEnabled) differences.push('autoRenewal');
  if (left.paymentTerms !== right.paymentTerms) differences.push('paymentTerms');
  if (left.clauses.length !== right.clauses.length) differences.push('clauseCount');

  return {
    success: true,
    message: `Side-by-side: "${left.contractTitle}" vs "${right.contractTitle}"`,
    data: {
      comparison,
      differences,
      ids: contractIds,
    },
    actions: [
      {
        label: 'Open Comparison View',
        action: 'navigate',
        params: { url: `/compare/${contractIds[0]}/${contractIds[1]}` },
      },
    ],
  };
}

async function findDifferences(
  contractIds: string[],
  tenantId: string
): Promise<ActionResponse> {
  if (contractIds.length < 2) {
    return {
      success: false,
      message: 'Please specify at least 2 contracts to find differences',
    };
  }

  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds }, tenantId },
    include: {
      clauses: true,
    },
  });

  if (contracts.length < 2) {
    return { success: false, message: 'Could not find the specified contracts' };
  }

  const differences: Array<{
    field: string;
    values: Record<string, unknown>;
  }> = [];

  // Compare standard fields
  const fieldsToCompare = [
    'status',
    'category',
    'supplierName',
    'totalValue',
    'autoRenewalEnabled',
    'paymentTerms',
    'noticePeriodDays',
  ];

  fieldsToCompare.forEach((field) => {
    const values: Record<string, unknown> = {};
    contracts.forEach((c) => {
      values[c.id] = (c as Record<string, unknown>)[field];
    });

    const uniqueValues = new Set(Object.values(values).map((v) => JSON.stringify(v)));
    if (uniqueValues.size > 1) {
      differences.push({ field, values });
    }
  });

  // Compare clause types (using category field from Clause model)
  const clauseTypes: Record<string, Set<string>> = {};
  contracts.forEach((c) => {
    clauseTypes[c.id] = new Set(c.clauses.map((cl) => cl.category || 'Unknown'));
  });

  const allClauseTypes = new Set<string>();
  Object.values(clauseTypes).forEach((types) => {
    types.forEach((t) => allClauseTypes.add(t));
  });

  const clauseDifferences: string[] = [];
  allClauseTypes.forEach((type) => {
    const hasClause = contracts.map((c) => clauseTypes[c.id].has(type));
    if (!hasClause.every((v) => v === hasClause[0])) {
      clauseDifferences.push(type);
    }
  });

  if (clauseDifferences.length > 0) {
    differences.push({
      field: 'clauses',
      values: { missingInSome: clauseDifferences },
    });
  }

  return {
    success: true,
    message: `Found ${differences.length} differences across ${contracts.length} contracts`,
    data: {
      differences,
      contractTitles: contracts.map((c) => ({ id: c.id, title: c.contractTitle })),
    },
  };
}

async function benchmarkContract(
  contractId: string | undefined,
  tenantId: string
): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'Which contract would you like to benchmark?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  // Find similar contracts for benchmarking
  const similar = await prisma.contract.findMany({
    where: {
      tenantId,
      id: { not: contractId },
      OR: [
        { category: contract.category },
        { supplierName: contract.supplierName },
      ],
    },
    select: {
      id: true,
      contractTitle: true,
      totalValue: true,
      paymentTerms: true,
      autoRenewalEnabled: true,
      effectiveDate: true,
      expirationDate: true,
    },
  });

  if (similar.length === 0) {
    return {
      success: true,
      message: 'No similar contracts found for benchmarking',
      data: { contract, benchmarks: [] },
    };
  }

  // Calculate benchmarks
  const values = similar.map((c) => Number(c.totalValue) || 0).filter((v) => v > 0);
  const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const medianValue = values.length > 0
    ? values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
    : 0;

  const contractValue = Number(contract.totalValue) || 0;
  const percentile = values.length > 0
    ? (values.filter((v) => v <= contractValue).length / values.length) * 100
    : 50;

  const autoRenewalRate = similar.filter((c) => c.autoRenewalEnabled).length / similar.length;

  return {
    success: true,
    message: `Benchmarked "${contract.contractTitle}" against ${similar.length} similar contracts`,
    data: {
      contract: {
        title: contract.contractTitle,
        value: contractValue,
        category: contract.category,
        supplier: contract.supplierName,
      },
      benchmark: {
        sampleSize: similar.length,
        avgValue,
        medianValue,
        valuePercentile: Math.round(percentile),
        autoRenewalRate: Math.round(autoRenewalRate * 100),
        comparison: contractValue > avgValue ? 'above_average' : 'below_average',
      },
    },
  };
}

