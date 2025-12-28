/**
 * Contract Hierarchy & Linking System
 * 
 * Utilities for managing parent-child relationships between contracts
 * with full taxonomy integration.
 */

import getClient from 'clients-db';
import { createLogger } from '../utils/logger';
import { 
  ContractCategoryId, 
  DocumentRoleId
} from '../types/contract-taxonomy.types';
import { getCategoryById } from '../utils/contract-taxonomy.utils';

const logger = createLogger('contract-hierarchy');

// ============================================================================
// RELATIONSHIP TYPES
// ============================================================================

export type ContractRelationshipType =
  | 'SOW_UNDER_MSA'              // Statement of Work under Master Agreement
  | 'WORK_ORDER_UNDER_MSA'        // Work Order under Master Agreement
  | 'TASK_ORDER_UNDER_MSA'        // Task Order under Master Agreement
  | 'PO_UNDER_SUPPLY_AGREEMENT'   // Purchase Order under Supply Agreement
  | 'AMENDMENT'                   // Amendment to existing contract
  | 'ADDENDUM'                    // Addendum to existing contract
  | 'RENEWAL'                     // Renewal of existing contract
  | 'CHANGE_ORDER'                // Change Order for scope change
  | 'APPENDIX'                    // Appendix/attachment to main contract
  | 'EXHIBIT'                     // Exhibit to main contract
  | 'SCHEDULE'                    // Schedule to main contract
  | 'SLA_UNDER_MSA'               // SLA attached to MSA
  | 'DPA_UNDER_MSA'               // DPA attached to MSA
  | 'RATE_CARD_UNDER_MSA'         // Rate card attached to MSA
  | 'SUPERSEDES'                  // Replaces/supersedes another contract
  | 'RELATED';                    // Generic related contract

// ============================================================================
// TYPES
// ============================================================================

export interface ContractHierarchyNode {
  id: string;
  fileName: string;
  contractCategoryId?: string | null;
  contractSubtype?: string | null;
  documentRole?: string | null;
  relationshipType?: string | null;
  relationshipNote?: string | null;
  linkedAt?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  totalValue?: number | null;
  children?: ContractHierarchyNode[];
}

export interface ContractLinkingOptions {
  relationshipType: ContractRelationshipType;
  relationshipNote?: string;
  validateCompatibility?: boolean;
}

export interface LinkingValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

// ============================================================================
// RELATIONSHIP RULES
// ============================================================================

/**
 * Define which parent-child relationships are valid based on taxonomy
 */
const VALID_RELATIONSHIPS: Record<
  ContractCategoryId,
  {
    canBeParentOf: ContractCategoryId[];
    canBeChildOf: ContractCategoryId[];
    typicalRelationship: ContractRelationshipType[];
  }
> = {
  master_framework: {
    canBeParentOf: [
      'scope_work_authorization',
      'performance_operations',
      'data_security_privacy',
      'commercial_finance'
    ],
    canBeChildOf: [],
    typicalRelationship: [
      'SOW_UNDER_MSA',
      'WORK_ORDER_UNDER_MSA',
      'SLA_UNDER_MSA',
      'DPA_UNDER_MSA',
      'RATE_CARD_UNDER_MSA'
    ]
  },
  scope_work_authorization: {
    canBeParentOf: ['commercial_finance', 'performance_operations'],
    canBeChildOf: ['master_framework'],
    typicalRelationship: ['SCHEDULE', 'APPENDIX', 'CHANGE_ORDER']
  },
  purchase_supply: {
    canBeParentOf: ['purchase_supply'],
    canBeChildOf: ['master_framework', 'purchase_supply'],
    typicalRelationship: ['PO_UNDER_SUPPLY_AGREEMENT', 'RENEWAL']
  },
  services_delivery: {
    canBeParentOf: ['scope_work_authorization', 'performance_operations'],
    canBeChildOf: ['master_framework'],
    typicalRelationship: ['SOW_UNDER_MSA', 'SLA_UNDER_MSA']
  },
  software_cloud: {
    canBeParentOf: ['performance_operations', 'data_security_privacy'],
    canBeChildOf: ['master_framework'],
    typicalRelationship: ['SLA_UNDER_MSA', 'DPA_UNDER_MSA']
  },
  performance_operations: {
    canBeParentOf: [],
    canBeChildOf: [
      'master_framework',
      'scope_work_authorization',
      'services_delivery',
      'software_cloud'
    ],
    typicalRelationship: ['APPENDIX', 'EXHIBIT']
  },
  confidentiality_ip: {
    canBeParentOf: [],
    canBeChildOf: [],
    typicalRelationship: ['RELATED']
  },
  data_security_privacy: {
    canBeParentOf: [],
    canBeChildOf: ['master_framework', 'software_cloud'],
    typicalRelationship: ['APPENDIX', 'EXHIBIT']
  },
  commercial_finance: {
    canBeParentOf: [],
    canBeChildOf: ['master_framework', 'scope_work_authorization'],
    typicalRelationship: ['SCHEDULE', 'APPENDIX']
  },
  corporate_legal_changes: {
    canBeParentOf: [],
    canBeChildOf: [
      'master_framework',
      'scope_work_authorization',
      'purchase_supply',
      'services_delivery',
      'software_cloud'
    ],
    typicalRelationship: ['AMENDMENT', 'ADDENDUM']
  }
};

// ============================================================================
// LINKING FUNCTIONS
// ============================================================================

/**
 * Link a child contract to a parent contract
 */
export async function linkContracts(
  parentId: string,
  childId: string,
  options: ContractLinkingOptions
): Promise<{ success: boolean; validation?: LinkingValidationResult }> {
  const prisma = getClient();

  try {
    // Get both contracts
    const [parent, child] = await Promise.all([
      prisma.contract.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          tenantId: true,
          contractCategoryId: true,
          documentRole: true,
          fileName: true
        }
      }),
      prisma.contract.findUnique({
        where: { id: childId },
        select: {
          id: true,
          tenantId: true,
          contractCategoryId: true,
          documentRole: true,
          fileName: true,
          parentContractId: true
        }
      })
    ]);

    if (!parent || !child) {
      return {
        success: false,
        validation: {
          valid: false,
          errors: ['Parent or child contract not found'],
          warnings: [],
          suggestions: []
        }
      };
    }

    // Check tenant match
    if (parent.tenantId !== child.tenantId) {
      return {
        success: false,
        validation: {
          valid: false,
          errors: ['Contracts must belong to the same tenant'],
          warnings: [],
          suggestions: []
        }
      };
    }

    // Check if child already has a parent
    if (child.parentContractId) {
      return {
        success: false,
        validation: {
          valid: false,
          errors: [`Child contract already linked to parent ${child.parentContractId}`],
          warnings: [],
          suggestions: ['Unlink existing parent first or use a different relationship']
        }
      };
    }

    // Validate compatibility if requested
    let validation: LinkingValidationResult | undefined;
    if (options.validateCompatibility) {
      validation = await validateLinking(
        parent.contractCategoryId as ContractCategoryId | null,
        child.contractCategoryId as ContractCategoryId | null,
        options.relationshipType
      );

      if (!validation.valid) {
        logger.warn(
          { parentId, childId, validation },
          'Contract linking validation failed'
        );
        return { success: false, validation };
      }
    }

    // Link the contracts
    await prisma.contract.update({
      where: { id: childId },
      data: {
        parentContractId: parentId,
        relationshipType: options.relationshipType,
        relationshipNote: options.relationshipNote,
        linkedAt: new Date()
      }
    });

    logger.info(
      {
        parentId,
        parentFile: parent.fileName,
        childId,
        childFile: child.fileName,
        relationshipType: options.relationshipType
      },
      'Contracts linked successfully'
    );

    return { success: true, validation };
  } catch (error) {
    logger.error({ error, parentId, childId }, 'Failed to link contracts');
    return {
      success: false,
      validation: {
        valid: false,
        errors: ['Internal error linking contracts'],
        warnings: [],
        suggestions: []
      }
    };
  }
}

/**
 * Unlink a child contract from its parent
 */
export async function unlinkContract(childId: string): Promise<boolean> {
  const prisma = getClient();

  try {
    await prisma.contract.update({
      where: { id: childId },
      data: {
        parentContractId: null,
        relationshipType: null,
        relationshipNote: null,
        linkedAt: null
      }
    });

    logger.info({ childId }, 'Contract unlinked from parent');
    return true;
  } catch (error) {
    logger.error({ error, childId }, 'Failed to unlink contract');
    return false;
  }
}

/**
 * Validate if a parent-child relationship is compatible
 */
export async function validateLinking(
  parentCategoryId: ContractCategoryId | null,
  childCategoryId: ContractCategoryId | null,
  relationshipType: ContractRelationshipType
): Promise<LinkingValidationResult> {
  const result: LinkingValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
    suggestions: []
  };

  // If no taxonomy classification, allow but warn
  if (!parentCategoryId || !childCategoryId) {
    result.warnings.push(
      'One or both contracts lack taxonomy classification. Validation limited.'
    );
    return result;
  }

  const parentCategory = getCategoryById(parentCategoryId);
  const childCategory = getCategoryById(childCategoryId);

  if (!parentCategory || !childCategory) {
    result.warnings.push('Could not find category definitions');
    return result;
  }

  const rules = VALID_RELATIONSHIPS[parentCategoryId];

  // Check if parent can have this type of child
  if (!rules.canBeParentOf.includes(childCategoryId)) {
    result.valid = false;
    result.errors.push(
      `${parentCategory.label} cannot typically be a parent of ${childCategory.label}`
    );
    result.suggestions.push(
      `Consider if these contracts should be related differently`
    );
  }

  // Check if relationship type is typical for this category
  if (!rules.typicalRelationship.includes(relationshipType)) {
    result.warnings.push(
      `${relationshipType} is not a typical relationship for ${parentCategory.label}`
    );
    result.suggestions.push(
      `Typical relationships: ${rules.typicalRelationship.join(', ')}`
    );
  }

  // Specific rules based on document roles
  if (
    parentCategory.default_role === 'modification' ||
    childCategory.default_role === 'modification'
  ) {
    if (relationshipType !== 'AMENDMENT' && relationshipType !== 'ADDENDUM') {
      result.warnings.push(
        'Modification documents typically use AMENDMENT or ADDENDUM relationship'
      );
    }
  }

  return result;
}

/**
 * Get full contract hierarchy (tree structure)
 */
export async function getContractHierarchy(
  contractId: string,
  includeAncestors: boolean = true,
  maxDepth: number = 5
): Promise<ContractHierarchyNode | null> {
  const prisma = getClient();

  try {
    // Find the root (top-most parent)
    let rootId = contractId;
    if (includeAncestors) {
      let current = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { parentContractId: true }
      });

      let depth = 0;
      while (current?.parentContractId && depth < maxDepth) {
        rootId = current.parentContractId;
        current = await prisma.contract.findUnique({
          where: { id: rootId },
          select: { parentContractId: true }
        });
        depth++;
      }
    }

    // Build tree from root
    return await buildHierarchyTree(rootId, maxDepth);
  } catch (error) {
    logger.error({ error, contractId }, 'Failed to get contract hierarchy');
    return null;
  }
}

/**
 * Build hierarchy tree recursively
 */
async function buildHierarchyTree(
  contractId: string,
  maxDepth: number,
  currentDepth: number = 0
): Promise<ContractHierarchyNode | null> {
  if (currentDepth >= maxDepth) return null;

  const prisma = getClient();

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      fileName: true,
      contractCategoryId: true,
      contractSubtype: true,
      documentRole: true,
      relationshipType: true,
      relationshipNote: true,
      linkedAt: true,
      startDate: true,
      endDate: true,
      totalValue: true,
      childContracts: {
        select: {
          id: true
        }
      }
    }
  });

  if (!contract) return null;

  // Recursively get children
  const children = await Promise.all(
    contract.childContracts.map(child =>
      buildHierarchyTree(child.id, maxDepth, currentDepth + 1)
    )
  );

  return {
    id: contract.id,
    fileName: contract.fileName,
    contractCategoryId: contract.contractCategoryId,
    contractSubtype: contract.contractSubtype,
    documentRole: contract.documentRole,
    relationshipType: contract.relationshipType,
    relationshipNote: contract.relationshipNote,
    linkedAt: contract.linkedAt,
    startDate: contract.startDate,
    endDate: contract.endDate,
    totalValue: contract.totalValue ? Number(contract.totalValue) : null,
    children: children.filter((c): c is ContractHierarchyNode => c !== null)
  };
}

/**
 * Get suggested parent contracts for a given contract
 */
export async function getSuggestedParents(
  contractId: string
): Promise<
  Array<{
    id: string;
    fileName: string;
    categoryLabel: string;
    score: number;
    reason: string;
  }>
> {
  const prisma = getClient();

  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        tenantId: true,
        contractCategoryId: true,
        documentRole: true,
        clientName: true,
        supplierName: true,
        startDate: true,
        fileName: true
      }
    });

    if (!contract) return [];

    // Build search criteria
    const suggestions: Array<{
      id: string;
      fileName: string;
      categoryLabel: string;
      score: number;
      reason: string;
    }> = [];

    // Get potential parent categories
    const childCategoryId = contract.contractCategoryId as ContractCategoryId | null;
    let parentCategories: ContractCategoryId[] = [];

    if (childCategoryId) {
      const rules = VALID_RELATIONSHIPS[childCategoryId];
      if (rules) {
        // Find categories that can be parent of this category
        parentCategories = Object.entries(VALID_RELATIONSHIPS)
          .filter(([_, r]) => r.canBeParentOf.includes(childCategoryId))
          .map(([catId]) => catId as ContractCategoryId);
      }
    }

    // Search for potential parents
    const candidates = await prisma.contract.findMany({
      where: {
        tenantId: contract.tenantId,
        id: { not: contractId },
        ...(parentCategories.length > 0 && {
          contractCategoryId: { in: parentCategories }
        }),
        // Match client/supplier
        OR: [
          { clientName: contract.clientName },
          { supplierName: contract.supplierName }
        ]
      },
      take: 20,
      select: {
        id: true,
        fileName: true,
        contractCategoryId: true,
        startDate: true,
        endDate: true,
        clientName: true,
        supplierName: true
      }
    });

    for (const candidate of candidates) {
      let score = 0;
      const reasons: string[] = [];

      // Category match
      if (
        candidate.contractCategoryId &&
        parentCategories.includes(candidate.contractCategoryId as ContractCategoryId)
      ) {
        score += 50;
        reasons.push('Compatible category');
      }

      // Client match
      if (candidate.clientName === contract.clientName) {
        score += 20;
        reasons.push('Same client');
      }

      // Supplier match
      if (candidate.supplierName === contract.supplierName) {
        score += 20;
        reasons.push('Same supplier');
      }

      // Date overlap
      if (
        contract.startDate &&
        candidate.startDate &&
        candidate.endDate &&
        contract.startDate >= candidate.startDate &&
        contract.startDate <= candidate.endDate
      ) {
        score += 10;
        reasons.push('Date overlap');
      }

      if (score > 0) {
        const category = getCategoryById(
          candidate.contractCategoryId as ContractCategoryId
        );
        suggestions.push({
          id: candidate.id,
          fileName: candidate.fileName,
          categoryLabel: category?.label || 'Unknown',
          score,
          reason: reasons.join(', ')
        });
      }
    }

    // Sort by score
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 10);
  } catch (error) {
    logger.error({ error, contractId }, 'Failed to get suggested parents');
    return [];
  }
}

/**
 * Get contract family (all related contracts in hierarchy)
 */
export async function getContractFamily(
  contractId: string
): Promise<{
  root: ContractHierarchyNode | null;
  totalContracts: number;
  totalValue: number;
  categories: Record<string, number>;
}> {
  const hierarchy = await getContractHierarchy(contractId, true, 10);

  if (!hierarchy) {
    return {
      root: null,
      totalContracts: 0,
      totalValue: 0,
      categories: {}
    };
  }

  // Flatten hierarchy
  function flatten(node: ContractHierarchyNode): ContractHierarchyNode[] {
    return [
      node,
      ...(node.children?.flatMap(flatten) || [])
    ];
  }

  const allContracts = flatten(hierarchy);

  // Calculate statistics
  const totalValue = allContracts.reduce(
    (sum, c) => sum + (c.totalValue || 0),
    0
  );

  const categories: Record<string, number> = {};
  allContracts.forEach(c => {
    if (c.contractCategoryId) {
      categories[c.contractCategoryId] = (categories[c.contractCategoryId] || 0) + 1;
    }
  });

  return {
    root: hierarchy,
    totalContracts: allContracts.length,
    totalValue,
    categories
  };
}

/**
 * Format relationship type for display
 */
export function formatRelationshipType(type: ContractRelationshipType): string {
  const labels: Record<ContractRelationshipType, string> = {
    SOW_UNDER_MSA: 'SOW under MSA',
    WORK_ORDER_UNDER_MSA: 'Work Order under MSA',
    TASK_ORDER_UNDER_MSA: 'Task Order under MSA',
    PO_UNDER_SUPPLY_AGREEMENT: 'PO under Supply Agreement',
    AMENDMENT: 'Amendment',
    ADDENDUM: 'Addendum',
    RENEWAL: 'Renewal',
    CHANGE_ORDER: 'Change Order',
    APPENDIX: 'Appendix',
    EXHIBIT: 'Exhibit',
    SCHEDULE: 'Schedule',
    SLA_UNDER_MSA: 'SLA under MSA',
    DPA_UNDER_MSA: 'DPA under MSA',
    RATE_CARD_UNDER_MSA: 'Rate Card under MSA',
    SUPERSEDES: 'Supersedes',
    RELATED: 'Related'
  };

  return labels[type] || type;
}
