import { prisma } from '@/lib/prisma';

export async function getTaxonomyCategories(tenantId: string) {
  try {
    const categories = await prisma.taxonomyCategory.findMany({
      where: { tenantId },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } } } });

    // Get top-level categories (L1)
    const topLevel = categories.filter(c => !c.parentId);
    
    // Build hierarchical structure
    const hierarchy = topLevel.map(parent => ({
      id: parent.id,
      name: parent.name,
      path: parent.path,
      description: parent.description,
      level: parent.level,
      children: categories
        .filter(c => c.parentId === parent.id)
        .map(child => ({
          id: child.id,
          name: child.name,
          path: child.path,
          description: child.description,
          children: categories
            .filter(c => c.parentId === child.id)
            .map(grandchild => ({
              id: grandchild.id,
              name: grandchild.name,
              path: grandchild.path })) })) }));

    // Calculate totals
    const totalCategories = categories.length;
    const totalL1 = topLevel.length;
    const totalL2 = categories.filter(c => c.level === 2).length;
    const totalL3 = categories.filter(c => c.level === 3).length;

    return {
      hierarchy,
      categories,
      stats: {
        totalCategories,
        totalL1,
        totalL2,
        totalL3 } };
  } catch {
    return { hierarchy: [], categories: [], stats: { totalCategories: 0, totalL1: 0, totalL2: 0, totalL3: 0, totalContracts: 0 } };
  }
}

// Get category details with contracts
export async function getCategoryDetails(categoryName: string, tenantId: string) {
  try {
    // Find category by name (fuzzy match)
    const category = await prisma.taxonomyCategory.findFirst({
      where: {
        tenantId,
        name: { contains: categoryName, mode: 'insensitive' } },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          select: { id: true, name: true, path: true },
          orderBy: { sortOrder: 'asc' } } } });

    if (!category) {
      return null;
    }

    return {
      id: category.id,
      name: category.name,
      path: category.path,
      description: category.description,
      level: category.level,
      parentId: category.parentId,
      children: category.children };
  } catch {
    return null;
  }
}

// Suggest category for a contract based on title/description
export async function suggestCategoryForContract(contractName: string, tenantId: string) {
  try {
    // Find the contract
    const contract = await prisma.contract.findFirst({
      where: {
        tenantId,
        OR: [
          { contractTitle: { contains: contractName, mode: 'insensitive' } },
          { supplierName: { contains: contractName, mode: 'insensitive' } },
        ] },
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        categoryL1: true,
        categoryL2: true,
        procurementCategoryId: true } });

    // Get all categories for suggestion
    const categories = await prisma.taxonomyCategory.findMany({
      where: { tenantId, level: { lte: 2 } },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        path: true,
        level: true,
        keywords: true } });

    // Simple keyword matching for suggestions
    const contractText = (contract?.contractTitle || contractName).toLowerCase();
    const suggestions = categories
      .filter(cat => {
        const keywords = cat.keywords || [];
        return keywords.some(kw => contractText.includes(kw.toLowerCase())) ||
          contractText.includes(cat.name.toLowerCase());
      })
      .slice(0, 5);

    return {
      contract,
      currentCategory: contract?.procurementCategoryId ? { id: contract.procurementCategoryId, name: contract.categoryL1 || 'Uncategorized' } : null,
      suggestions: suggestions.length > 0 ? suggestions : categories.slice(0, 5),
      allCategories: categories };
  } catch {
    return { contract: null, currentCategory: null, suggestions: [], allCategories: [] };
  }
}

// Get contracts in a specific category
export async function getContractsInCategory(categoryName: string, tenantId: string) {
  try {
    // Find category
    const category = await prisma.taxonomyCategory.findFirst({
      where: {
        tenantId,
        name: { contains: categoryName, mode: 'insensitive' } } });

    if (!category) {
      return null;
    }

    // Get contracts in this category using procurementCategoryId
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        procurementCategoryId: category.id },
      orderBy: { totalValue: 'desc' },
      take: 20,
      select: {
        id: true,
        contractTitle: true,
        supplierName: true,
        totalValue: true,
        status: true,
        expirationDate: true } });

    const totalValue = contracts.reduce((sum, c) => sum + (Number(c.totalValue) || 0), 0);

    return {
      category: {
        id: category.id,
        name: category.name,
        path: category.path },
      contracts,
      totalContracts: contracts.length,
      totalValue };
  } catch {
    return null;
  }
}
