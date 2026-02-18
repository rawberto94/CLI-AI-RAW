/**
 * Taxonomy Actions Handler
 * Handles taxonomy/category operations
 */

import { DetectedIntent, ActionResponse, ChatContext } from '../types';
import { prisma } from '@/lib/prisma';
import { addActivityLogEntry } from '@/lib/activity-log';
import type { TaxonomyCategory } from '@prisma/client';

export async function handleTaxonomyActions(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ActionResponse> {
  const { action, entities } = intent;
  const { tenantId, userId, currentContractId } = context;

  try {
    switch (action) {
      case 'list_categories':
        return await listCategories(tenantId);

      case 'browse_taxonomy':
        return await browseTaxonomy(tenantId, entities.category);

      case 'categorize_contract':
        return await categorizeContract(entities.contractId || currentContractId, entities, tenantId, userId ?? '');

      case 'category_details':
        return await getCategoryDetails(entities.category, tenantId);

      case 'suggest_category':
        return await suggestCategory(entities.contractId || currentContractId, tenantId);

      case 'update_category':
        return await updateCategory(entities.contractId || currentContractId, entities, tenantId, userId ?? '');

      case 'category_stats':
        return await getCategoryStats(tenantId);

      case 'uncategorized':
        return await getUncategorizedContracts(tenantId);

      default:
        return {
          success: false,
          message: `Unknown taxonomy action: ${action}`,
        };
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: 'Failed to process taxonomy request',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
}

async function listCategories(tenantId: string): Promise<ActionResponse> {
  const where: Record<string, unknown> = {
    OR: [{ tenantId }, { tenantId: null }], // Include global and tenant-specific
  };

  const categories = await prisma.taxonomyCategory.findMany({
    where,
    orderBy: [{ level: 'asc' }, { name: 'asc' }],
  });

  // Group by level
  const byLevel = categories.reduce((acc, cat) => {
    const lvl = cat.level || 0;
    if (!acc[lvl]) acc[lvl] = [];
    acc[lvl].push(cat);
    return acc;
  }, {} as Record<number, typeof categories>);

  return {
    success: true,
    message: `Found ${categories.length} categories across ${Object.keys(byLevel).length} levels`,
    data: {
      total: categories.length,
      byLevel,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
        parentId: c.parentId,
      })),
    },
  };
}

async function browseTaxonomy(tenantId: string, parentId?: string): Promise<ActionResponse> {
  const where: Record<string, unknown> = {
    OR: [{ tenantId }, { tenantId: null }],
  };

  if (parentId) {
    where.parentId = parentId;
  } else {
    where.parentId = null; // Top level only
    where.level = 1;
  }

  const categories = await prisma.taxonomyCategory.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      children: {
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      },
    },
  });

  const parent = parentId
    ? await prisma.taxonomyCategory.findUnique({
        where: { id: parentId },
        select: { id: true, name: true, parentId: true },
      })
    : null;

  return {
    success: true,
    message: parent
      ? `Showing subcategories of "${parent.name}"`
      : `Showing top-level categories`,
    data: {
      parent,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        hasChildren: c.children.length > 0,
      })),
    },
    actions: categories.map((c) => ({
      label: c.children.length > 0 ? `Browse ${c.name} →` : c.name,
      action: 'browse_taxonomy',
      params: { parentCategory: c.id },
    })),
  };
}

async function categorizeContract(
  contractId: string | undefined,
  entities: DetectedIntent['entities'],
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'Which contract would you like to categorize?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  // Find category by name from entities
  let category: TaxonomyCategory | null = null;
  if (entities.category) {
    category = await prisma.taxonomyCategory.findFirst({
      where: {
        name: { contains: entities.category, mode: 'insensitive' },
        tenantId,
      },
    });
  }

  if (!category) {
    // Suggest categories
    const suggestions = await prisma.taxonomyCategory.findMany({
      where: {
        tenantId,
        level: 2, // L2 categories
      },
      take: 10,
      orderBy: { name: 'asc' },
    });

    return {
      success: false,
      message: 'Category not found. Did you mean one of these?',
      data: { suggestions },
      actions: suggestions.map((s) => ({
        label: s.name,
        action: 'categorize_contract',
        params: { contractId, categoryId: s.id },
      })),
    };
  }

  // Update contract with new category
  await prisma.contract.update({
    where: { id: contractId },
    data: {
      contractCategoryId: category.id,
      category: category.name,
    },
  });

  await addActivityLogEntry({
    tenantId,
    contractId,
    action: 'CATEGORY_UPDATED',
    performedBy: userId,
    details: { categoryId: category.id, categoryName: category.name, source: 'chatbot' },
  });

  return {
    success: true,
    message: `Categorized "${contract.contractTitle}" as "${category.name}"`,
    data: { contractId, categoryId: category.id, categoryName: category.name },
  };
}

async function getCategoryDetails(categoryId: string | undefined, tenantId: string): Promise<ActionResponse> {
  if (!categoryId) {
    return {
      success: false,
      message: 'Which category would you like details for?',
    };
  }

  const category = await prisma.taxonomyCategory.findUnique({
    where: { id: categoryId },
    include: {
      parent: true,
      children: true,
    },
  });

  if (!category) {
    return { success: false, message: 'Category not found' };
  }

  // Get contracts count separately
  const contractCount = await prisma.contract.count({
    where: { contractCategoryId: categoryId },
  });

  const totalValue = await prisma.contract.aggregate({
    where: { contractCategoryId: categoryId },
    _sum: { totalValue: true },
  });

  // Get top contracts
  const topContracts = await prisma.contract.findMany({
    where: { contractCategoryId: categoryId },
    take: 5,
    orderBy: { totalValue: 'desc' },
    select: {
      id: true,
      contractTitle: true,
      supplierName: true,
      totalValue: true,
    },
  });

  return {
    success: true,
    message: `Category: ${category.name}`,
    data: {
      id: category.id,
      name: category.name,
      description: category.description,
      level: category.level,
      parent: category.parent?.name,
      children: category.children.map((c) => ({
        name: c.name,
      })),
      contractCount,
      totalSpend: totalValue._sum.totalValue || 0,
      topContracts,
    },
  };
}

async function suggestCategory(contractId: string | undefined, tenantId: string): Promise<ActionResponse> {
  if (!contractId) {
    return {
      success: false,
      message: 'Which contract would you like category suggestions for?',
    };
  }

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: {
      artifacts: {
        where: { type: 'OVERVIEW' },
        select: { data: true },
      },
    },
  });

  if (!contract) {
    return { success: false, message: 'Contract not found' };
  }

  // No AI suggestions model exists - suggest based on similar contracts
  const similarContracts = await prisma.contract.findMany({
    where: {
      tenantId,
      supplierName: contract.supplierName,
      contractCategoryId: { not: null },
      id: { not: contractId },
    },
    select: { contractCategoryId: true },
    take: 10,
  });

  if (similarContracts.length > 0) {
    const categoryIds = [...new Set(similarContracts.map((c) => c.contractCategoryId!))];
    const categories = await prisma.taxonomyCategory.findMany({
      where: { id: { in: categoryIds } },
    });

    return {
      success: true,
      message: `Based on similar contracts with ${contract.supplierName}`,
      data: { suggestions: categories },
      actions: categories.map((c) => ({
        label: `Apply "${c.name}"`,
        action: 'categorize_contract',
        params: { contractId, category: c.name },
      })),
    };
  }

  return {
    success: true,
    message: 'No category suggestions available. Please select a category manually.',
    actions: [
      { label: 'Browse Categories', action: 'browse_taxonomy', params: {} },
    ],
  };
}

async function updateCategory(
  contractId: string | undefined,
  entities: DetectedIntent['entities'],
  tenantId: string,
  userId: string
): Promise<ActionResponse> {
  // Alias for categorize_contract with update semantics
  return categorizeContract(contractId, entities, tenantId, userId);
}

async function getCategoryStats(tenantId: string): Promise<ActionResponse> {
  const stats = await prisma.taxonomyCategory.findMany({
    where: {
      tenantId,
      level: 1, // L1 categories
    },
    include: {
      children: true,
    },
    orderBy: { name: 'asc' },
  });

  const totalCategorized = await prisma.contract.count({
    where: { tenantId, contractCategoryId: { not: null } },
  });

  const totalContracts = await prisma.contract.count({ where: { tenantId } });
  const categorizedPercent = totalContracts > 0 ? ((totalCategorized / totalContracts) * 100).toFixed(1) : '0';

  return {
    success: true,
    message: `${categorizedPercent}% of contracts are categorized`,
    data: {
      totalContracts,
      totalCategorized,
      uncategorized: totalContracts - totalCategorized,
      categorizedPercent: parseFloat(categorizedPercent),
      byL1: stats.map((l1) => ({
        name: l1.name,
        l2Categories: l1.children.map((l2) => ({
          name: l2.name,
        })),
      })),
    },
  };
}

async function getUncategorizedContracts(tenantId: string): Promise<ActionResponse> {
  const uncategorized = await prisma.contract.findMany({
    where: {
      tenantId,
      contractCategoryId: null,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      contractTitle: true,
      supplierName: true,
      totalValue: true,
    },
    orderBy: { totalValue: 'desc' },
    take: 20,
  });

  if (uncategorized.length === 0) {
    return {
      success: true,
      message: 'All active contracts are categorized! 🎉',
      data: { contracts: [] },
    };
  }

  return {
    success: true,
    message: `Found ${uncategorized.length} uncategorized contracts`,
    data: { contracts: uncategorized },
    actions: uncategorized.slice(0, 5).map((c) => ({
      label: `Categorize "${c.contractTitle}"`,
      action: 'suggest_category',
      params: { contractId: c.id },
    })),
  };
}

