/**
 * Contract Hierarchy Service
 * 
 * Advanced tree operations for contract relationships:
 * - Multi-level parent/child/grandchild hierarchies
 * - Amendment chains (v1 → v2 → v3)
 * - Visual tree data structures for UI rendering
 * - Breadcrumb navigation generation
 * - Cascade operations and impact analysis
 * - Contract lifecycle visualization
 * 
 * @version 2.0.0
 */

import { prisma } from '../lib/prisma';
import { createLogger } from '../utils/logger';
import { 
  relationshipDetectionService, 
  RelationshipType,
  RelationshipDirection,
  DetectedRelationship 
} from './relationship-detection.service';

const logger = createLogger('contract-hierarchy');

// ============================================================================
// TYPES
// ============================================================================

export interface ContractNode {
  id: string;
  title: string;
  type: string;
  status: string;
  party?: string;
  value?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  level: number; // Depth in hierarchy (0 = root)
  parentId?: string;
  children: ContractNode[];
  siblings: ContractNode[];
  ancestors: AncestorInfo[];
  descendants: DescendantInfo[];
  relationships: NodeRelationship[];
  metadata: {
    isRoot: boolean;
    isLeaf: boolean;
    branchCount: number; // Number of children + grandchildren
    depth: number; // Maximum depth of subtree
    riskScore?: number;
    healthScore?: number;
    renewalDate?: Date;
  };
  visual: {
    x?: number;
    y?: number;
    color: string;
    icon: string;
    size: 'small' | 'medium' | 'large';
    badges: string[];
  };
}

export interface AncestorInfo {
  id: string;
  title: string;
  relationshipType: RelationshipType;
  level: number; // How many levels up (1 = parent, 2 = grandparent)
}

export interface DescendantInfo {
  id: string;
  title: string;
  relationshipType: RelationshipType;
  level: number; // How many levels down (1 = child, 2 = grandchild)
  path: string[]; // IDs from current to descendant
}

export interface NodeRelationship {
  targetId: string;
  targetTitle: string;
  type: RelationshipType;
  direction: 'incoming' | 'outgoing';
  strength: number; // 0-1
  confidence: number;
}

export interface ContractTree {
  root: ContractNode;
  allNodes: Map<string, ContractNode>;
  levels: ContractNode[][]; // Nodes grouped by level
  stats: TreeStats;
  breadcrumbs: BreadcrumbItem[];
}

export interface TreeStats {
  totalNodes: number;
  maxDepth: number;
  totalValue: number;
  rootCount: number;
  leafCount: number;
  avgBranchingFactor: number;
  contractsByType: Record<string, number>;
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface BreadcrumbItem {
  id: string;
  title: string;
  type: string;
  relationship?: string;
  isActive: boolean;
}

export interface AmendmentChain {
  contractId: string;
  versions: AmendmentVersion[];
  currentVersion: number;
  isLatest: boolean;
  hasPendingAmendments: boolean;
  totalValueEvolution: Array<{
    version: number;
    value: number;
    date: Date;
    change: number; // percentage
  }>;
}

export interface AmendmentVersion {
  version: number;
  contractId: string;
  title: string;
  date: Date;
  amendedBy?: string; // Next version contract ID
  amends?: string; // Previous version contract ID
  changes: AmendmentChange[];
  status: 'draft' | 'pending' | 'executed' | 'superseded';
  value?: number;
}

export interface AmendmentChange {
  field: string;
  oldValue: string;
  newValue: string;
  type: 'added' | 'modified' | 'removed';
  significance: 'critical' | 'major' | 'minor';
}

export interface ImpactAnalysis {
  contractId: string;
  operation: 'terminate' | 'renew' | 'amend' | 'expire';
  directImpacts: DirectImpact[];
  indirectImpacts: IndirectImpact[];
  recommendations: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface DirectImpact {
  targetId: string;
  targetTitle: string;
  relationshipType: RelationshipType;
  impact: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  mitigation?: string;
}

export interface IndirectImpact {
  targetId: string;
  targetTitle: string;
  path: string[]; // Relationship path
  impact: 'high' | 'medium' | 'low';
  description: string;
}

export interface CascadeOperation {
  type: 'notify' | 'update_status' | 'extend_dates' | 'terminate';
  targetFilter: 'children' | 'descendants' | 'siblings' | 'family';
  params: Record<string, any>;
  dryRun: boolean;
  results?: CascadeResult[];
}

export interface CascadeResult {
  contractId: string;
  title: string;
  operation: string;
  success: boolean;
  oldValue?: any;
  newValue?: any;
  error?: string;
}

export interface VisualLayout {
  nodes: VisualNode[];
  edges: VisualEdge[];
  bounds: { width: number; height: number };
  config: LayoutConfig;
}

export interface VisualNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: ContractNode;
  style: {
    backgroundColor: string;
    borderColor: string;
    borderWidth: number;
    opacity: number;
    zIndex: number;
  };
}

export interface VisualEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  path: string; // SVG path
  style: {
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
    opacity: number;
  };
  label?: string;
}

export interface LayoutConfig {
  orientation: 'vertical' | 'horizontal' | 'radial';
  nodeWidth: number;
  nodeHeight: number;
  levelSpacing: number;
  siblingSpacing: number;
  animate: boolean;
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

class ContractHierarchyService {
  private static instance: ContractHierarchyService;

  private constructor() {
    logger.info('Contract Hierarchy Service initialized');
  }

  static getInstance(): ContractHierarchyService {
    if (!ContractHierarchyService.instance) {
      ContractHierarchyService.instance = new ContractHierarchyService();
    }
    return ContractHierarchyService.instance;
  }

  // ==========================================================================
  // TREE BUILDING
  // ==========================================================================

  /**
   * Build complete contract tree from any node
   */
  async buildTree(
    contractId: string,
    tenantId: string,
    options: {
      maxDepth?: number;
      includeSiblings?: boolean;
      minConfidence?: number;
    } = {}
  ): Promise<ContractTree> {
    const { maxDepth = 5, includeSiblings = true, minConfidence = 0.6 } = options;

    // Fetch all relationships for this contract family
    const allRelationships = await this.fetchFamilyRelationships(
      contractId,
      tenantId,
      maxDepth,
      minConfidence
    );

    // Find the root(s)
    const rootId = await this.findRoot(contractId, tenantId, allRelationships);

    // Build the tree structure
    const allNodes = new Map<string, ContractNode>();
    const root = await this.buildNodeRecursive(
      rootId,
      tenantId,
      allRelationships,
      allNodes,
      0,
      maxDepth,
      includeSiblings
    );

    // Calculate tree statistics
    const stats = this.calculateTreeStats(allNodes);

    // Generate breadcrumbs from root to original contract
    const breadcrumbs = this.generateBreadcrumbs(contractId, allNodes);

    // Group nodes by level
    const levels = this.groupByLevel(allNodes);

    return {
      root,
      allNodes,
      levels,
      stats,
      breadcrumbs,
    };
  }

  /**
   * Build multiple trees (forest) for a tenant
   */
  async buildForest(
    tenantId: string,
    options: {
      rootContractIds?: string[];
      maxTrees?: number;
      maxDepth?: number;
    } = {}
  ): Promise<ContractTree[]> {
    const { rootContractIds, maxTrees = 10, maxDepth = 3 } = options;

    let roots: string[];

    if (rootContractIds) {
      roots = rootContractIds;
    } else {
      // Find all root contracts (no parents or self-referenced as roots)
      const rootContracts = await prisma.contract.findMany({
        where: {
          tenantId,
          isDeleted: false,
          OR: [
            { sourceRelationships: { none: { direction: 'child', status: { in: ['confirmed', 'auto_confirmed'] } } } },
            { contractType: { contains: 'Master', mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: maxTrees,
      });
      roots = rootContracts.map(c => c.id);
    }

    const trees: ContractTree[] = [];
    for (const rootId of roots) {
      try {
        const tree = await this.buildTree(rootId, tenantId, { maxDepth });
        trees.push(tree);
      } catch (error) {
        logger.error({ error, rootId }, 'Failed to build tree');
      }
    }

    return trees;
  }

  // ==========================================================================
  // HIERARCHY OPERATIONS
  // ==========================================================================

  /**
   * Get complete ancestry chain (parent → grandparent → ...)
   */
  async getAncestry(
    contractId: string,
    tenantId: string,
    options: {
      maxLevels?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<AncestorInfo[]> {
    const { maxLevels = 10 } = options;
    const ancestry: AncestorInfo[] = [];
    let currentId = contractId;
    let level = 0;

    const visited = new Set<string>();

    while (level < maxLevels) {
      const parent = await prisma.contractRelationship.findFirst({
        where: {
          targetContractId: currentId,
          tenantId,
          direction: { in: ['parent', 'child'] },
          status: { in: ['confirmed', 'auto_confirmed'] },
        },
        include: {
          sourceContract: {
            select: { id: true, contractTitle: true },
          },
        },
        orderBy: { confidence: 'desc' },
      });

      if (!parent || visited.has(parent.sourceContractId)) break;

      visited.add(parent.sourceContractId);
      level++;

      ancestry.push({
        id: parent.sourceContractId,
        title: parent.sourceContract.contractTitle || 'Untitled',
        relationshipType: parent.relationshipType as RelationshipType,
        level,
      });

      currentId = parent.sourceContractId;
    }

    return ancestry;
  }

  /**
   * Get all descendants (children → grandchildren → ...)
   */
  async getDescendants(
    contractId: string,
    tenantId: string,
    options: {
      maxLevels?: number;
      relationshipTypes?: RelationshipType[];
    } = {}
  ): Promise<DescendantInfo[]> {
    const { maxLevels = 10, relationshipTypes } = options;
    const descendants: DescendantInfo[] = [];
    const queue: Array<{ id: string; level: number; path: string[] }> = [
      { id: contractId, level: 0, path: [contractId] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, level, path } = queue.shift()!;
      if (level >= maxLevels || visited.has(id)) continue;
      visited.add(id);

      const children = await prisma.contractRelationship.findMany({
        where: {
          sourceContractId: id,
          tenantId,
          status: { in: ['confirmed', 'auto_confirmed'] },
          ...(relationshipTypes ? { relationshipType: { in: relationshipTypes } } : {}),
        },
        include: {
          targetContract: {
            select: { id: true, contractTitle: true },
          },
        },
      });

      for (const child of children) {
        const newPath = [...path, child.targetContractId];
        descendants.push({
          id: child.targetContractId,
          title: child.targetContract.contractTitle || 'Untitled',
          relationshipType: child.relationshipType as RelationshipType,
          level: level + 1,
          path: newPath,
        });

        queue.push({
          id: child.targetContractId,
          level: level + 1,
          path: newPath,
        });
      }
    }

    return descendants;
  }

  /**
   * Get all siblings (same parent)
   */
  async getSiblings(
    contractId: string,
    tenantId: string
  ): Promise<Array<{ id: string; title: string; relationshipType: RelationshipType }>> {
    // Find parent
    const parentRel = await prisma.contractRelationship.findFirst({
      where: {
        targetContractId: contractId,
        tenantId,
        direction: { in: ['parent', 'child'] },
        status: { in: ['confirmed', 'auto_confirmed'] },
      },
    });

    if (!parentRel) return [];

    // Find all children of this parent (excluding self)
    const siblings = await prisma.contractRelationship.findMany({
      where: {
        sourceContractId: parentRel.sourceContractId,
        targetContractId: { not: contractId },
        tenantId,
        status: { in: ['confirmed', 'auto_confirmed'] },
      },
      include: {
        targetContract: {
          select: { id: true, contractTitle: true },
        },
      },
    });

    return siblings.map(s => ({
      id: s.targetContractId,
      title: s.targetContract.contractTitle || 'Untitled',
      relationshipType: s.relationshipType as RelationshipType,
    }));
  }

  // ==========================================================================
  // AMENDMENT CHAINS
  // ==========================================================================

  /**
   * Build amendment chain (v1 → v2 → v3)
   */
  async buildAmendmentChain(
    contractId: string,
    tenantId: string
  ): Promise<AmendmentChain> {
    // Find all amendments in the chain
    const allContracts = await this.fetchAmendmentChain(contractId, tenantId);
    
    if (allContracts.length === 0) {
      // Single contract, no amendments
      const contract = await prisma.contract.findFirst({
        where: { id: contractId, tenantId },
        select: {
          id: true,
          contractTitle: true,
          startDate: true,
          totalValue: true,
          status: true,
        },
      });

      if (!contract) throw new Error('Contract not found');

      return {
        contractId,
        versions: [{
          version: 1,
          contractId,
          title: contract.contractTitle || 'Untitled',
          date: contract.startDate || new Date(),
          changes: [],
          status: contract.status === 'ACTIVE' ? 'executed' : 'draft',
          value: Number(contract.totalValue || 0),
        }],
        currentVersion: 1,
        isLatest: true,
        hasPendingAmendments: false,
        totalValueEvolution: [{
          version: 1,
          value: Number(contract.totalValue || 0),
          date: contract.startDate || new Date(),
          change: 0,
        }],
      };
    }

    // Sort by version/date
    const sorted = allContracts.sort((a, b) => 
      (a.startDate?.getTime() || 0) - (b.startDate?.getTime() || 0)
    );

    const versions: AmendmentVersion[] = sorted.map((c, idx) => ({
      version: idx + 1,
      contractId: c.id,
      title: c.contractTitle || c.fileName || 'Untitled',
      date: c.startDate || c.createdAt,
      amendedBy: idx < sorted.length - 1 ? sorted[idx + 1].id : undefined,
      amends: idx > 0 ? sorted[idx - 1].id : undefined,
      changes: this.inferChanges(sorted[idx - 1], c),
      status: this.mapStatus(c.status),
      value: Number(c.totalValue || 0),
    }));

    const currentVersion = versions.findIndex(v => v.contractId === contractId) + 1;
    const isLatest = currentVersion === versions.length;

    // Calculate value evolution
    const totalValueEvolution = versions.map((v, idx) => ({
      version: v.version,
      value: v.value || 0,
      date: v.date,
      change: idx > 0 && versions[idx - 1].value
        ? ((v.value! - versions[idx - 1].value!) / versions[idx - 1].value!) * 100
        : 0,
    }));

    return {
      contractId,
      versions,
      currentVersion,
      isLatest,
      hasPendingAmendments: versions.some(v => v.status === 'draft' || v.status === 'pending'),
      totalValueEvolution,
    };
  }

  /**
   * Create new amendment version
   */
  async createAmendment(
    parentContractId: string,
    tenantId: string,
    userId: string,
    amendmentData: {
      title: string;
      description?: string;
      changes: AmendmentChange[];
      effectiveDate?: Date;
    }
  ): Promise<{ amendmentId: string; version: number }> {
    const parent = await prisma.contract.findFirst({
      where: { id: parentContractId, tenantId },
    });

    if (!parent) throw new Error('Parent contract not found');

    // Create amendment contract
    const amendment = await prisma.contract.create({
      data: {
        tenantId,
        contractTitle: amendmentData.title,
        description: amendmentData.description,
        fileName: `Amendment to ${parent.fileName}`,
        contractType: parent.contractType,
        clientId: parent.clientId,
        supplierId: parent.supplierId,
        clientName: parent.clientName,
        supplierName: parent.supplierName,
        startDate: amendmentData.effectiveDate || new Date(),
        status: 'DRAFT' as any,
        uploadedBy: userId,
        parentContractId: parentContractId,
        // Copy financial terms from parent
        currency: parent.currency,
        metadata: {
          amendmentOf: parentContractId,
          changes: amendmentData.changes,
          isAmendment: true,
        },
      } as any,
    });

    // Create relationship
    await prisma.contractRelationship.create({
      data: {
        tenantId,
        sourceContractId: parentContractId,
        targetContractId: amendment.id,
        relationshipType: 'AMENDMENT_TO_ORIGINAL',
        direction: 'parent',
        confidence: 1,
        status: 'auto_confirmed',
        detectedBy: 'manual',
        evidence: [{
          type: 'manual',
          description: 'Amendment created from parent contract',
          confidence: 1,
        }],
      },
    });

    // Get version number
    const chain = await this.buildAmendmentChain(parentContractId, tenantId);

    return {
      amendmentId: amendment.id,
      version: chain.versions.length + 1,
    };
  }

  // ==========================================================================
  // IMPACT ANALYSIS
  // ==========================================================================

  /**
   * Analyze impact of contract operation on related contracts
   */
  async analyzeImpact(
    contractId: string,
    operation: 'terminate' | 'renew' | 'amend' | 'expire',
    tenantId: string
  ): Promise<ImpactAnalysis> {
    const tree = await this.buildTree(contractId, tenantId, { maxDepth: 3 });
    const node = tree.allNodes.get(contractId);

    if (!node) throw new Error('Contract not found in tree');

    const directImpacts: DirectImpact[] = [];
    const indirectImpacts: IndirectImpact[] = [];
    const recommendations: string[] = [];

    // Analyze based on operation type
    switch (operation) {
      case 'terminate':
        // Children may be orphaned
        for (const child of node.children) {
          directImpacts.push({
            targetId: child.id,
            targetTitle: child.title,
            relationshipType: 'MASTER_TO_SUB',
            impact: 'critical',
            description: `Child contract will be orphaned if parent is terminated`,
            mitigation: `Transfer child to new parent or terminate together`,
          });
        }
        recommendations.push('Review all child contracts before termination');
        recommendations.push('Consider 30-day notice to counterparties');
        break;

      case 'renew':
        // Siblings may need alignment
        for (const sibling of node.siblings) {
          directImpacts.push({
            targetId: sibling.id,
            targetTitle: sibling.title,
            relationshipType: 'SAME_PARTY_BUNDLE',
            impact: 'medium',
            description: `Sibling contract may benefit from aligned renewal`,
          });
        }
        recommendations.push('Coordinate renewal timing with sibling contracts');
        break;

      case 'amend':
        // Amendments cascade to SOWs
        for (const child of node.children) {
          if (child.type?.includes('SOW')) {
            directImpacts.push({
              targetId: child.id,
              targetTitle: child.title,
              relationshipType: 'SOW_UNDER_MSA',
              impact: 'high',
              description: `SOW may need corresponding amendment`,
              mitigation: `Review SOW terms against MSA changes`,
            });
          }
        }
        recommendations.push('Review all SOWs for required updates');
        break;

      case 'expire':
        // Auto-renewal check
        const contract = await prisma.contract.findFirst({
          where: { id: contractId },
          include: { artifacts: { where: { type: 'RENEWAL' } } },
        });
        const renewalData = contract?.artifacts[0]?.data as any;
        
        if (renewalData?.autoRenewal) {
          directImpacts.push({
            targetId: contractId,
            targetTitle: node.title,
            relationshipType: 'RENEWAL_OF',
            impact: 'critical',
            description: `Contract has auto-renewal clause - will renew automatically`,
            mitigation: `Submit opt-out notice before deadline`,
          });
          recommendations.push(`URGENT: Submit opt-out notice by ${renewalData.renewalTerms?.optOutDeadline}`);
        }
        break;
    }

    // Calculate risk level
    const criticalCount = directImpacts.filter(i => i.impact === 'critical').length;
    const highCount = directImpacts.filter(i => i.impact === 'high').length;
    
    let riskLevel: ImpactAnalysis['riskLevel'] = 'low';
    if (criticalCount > 0) riskLevel = 'critical';
    else if (highCount > 0) riskLevel = 'high';
    else if (directImpacts.length > 0) riskLevel = 'medium';

    return {
      contractId,
      operation,
      directImpacts,
      indirectImpacts,
      recommendations,
      riskLevel,
    };
  }

  // ==========================================================================
  // CASCADE OPERATIONS
  // ==========================================================================

  /**
   * Perform cascade operation on contract family
   */
  async cascade(
    contractId: string,
    tenantId: string,
    operation: CascadeOperation
  ): Promise<CascadeResult[]> {
    const tree = await this.buildTree(contractId, tenantId);
    const node = tree.allNodes.get(contractId);

    if (!node) throw new Error('Contract not found');

    // Determine target contracts
    let targetIds: string[] = [];
    switch (operation.targetFilter) {
      case 'children':
        targetIds = node.children.map(c => c.id);
        break;
      case 'descendants':
        targetIds = node.descendants?.map(d => d.id) || [];
        break;
      case 'siblings':
        targetIds = node.siblings.map(s => s.id);
        break;
      case 'family':
        targetIds = Array.from(tree.allNodes.keys()).filter(id => id !== contractId);
        break;
    }

    const results: CascadeResult[] = [];

    if (operation.dryRun) {
      // Return preview only
      for (const targetId of targetIds) {
        const target = tree.allNodes.get(targetId);
        if (target) {
          results.push({
            contractId: targetId,
            title: target.title,
            operation: operation.type,
            success: true,
          });
        }
      }
      return results;
    }

    // Execute operations
    for (const targetId of targetIds) {
      try {
        const result = await this.executeCascadeOperation(
          targetId,
          operation.type,
          operation.params
        );
        results.push(result);
      } catch (error) {
        const target = tree.allNodes.get(targetId);
        results.push({
          contractId: targetId,
          title: target?.title || 'Unknown',
          operation: operation.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  // ==========================================================================
  // VISUAL LAYOUT
  // ==========================================================================

  /**
   * Generate visual layout for tree visualization
   */
  async generateVisualLayout(
    contractId: string,
    tenantId: string,
    config: Partial<LayoutConfig> = {}
  ): Promise<VisualLayout> {
    const tree = await this.buildTree(contractId, tenantId);
    
    const layoutConfig: LayoutConfig = {
      orientation: 'vertical',
      nodeWidth: 280,
      nodeHeight: 120,
      levelSpacing: 150,
      siblingSpacing: 50,
      animate: true,
      ...config,
    };

    const nodes: VisualNode[] = [];
    const edges: VisualEdge[] = [];

    // Calculate positions based on orientation
    if (layoutConfig.orientation === 'vertical') {
      this.calculateVerticalLayout(tree, layoutConfig, nodes, edges);
    } else if (layoutConfig.orientation === 'horizontal') {
      this.calculateHorizontalLayout(tree, layoutConfig, nodes, edges);
    } else {
      this.calculateRadialLayout(tree, layoutConfig, nodes, edges);
    }

    // Calculate bounds
    const allX = nodes.map(n => n.x);
    const allY = nodes.map(n => n.y);
    const minX = Math.min(...allX) - layoutConfig.nodeWidth;
    const maxX = Math.max(...allX) + layoutConfig.nodeWidth;
    const minY = Math.min(...allY) - layoutConfig.nodeHeight;
    const maxY = Math.max(...allY) + layoutConfig.nodeHeight;

    return {
      nodes,
      edges,
      bounds: {
        width: maxX - minX,
        height: maxY - minY,
      },
      config: layoutConfig,
    };
  }

  /**
   * Get UI-ready data structure
   */
  async getUITreeData(
    contractId: string,
    tenantId: string,
    options: {
      view?: 'tree' | 'timeline' | 'cluster' | 'minimap';
      expandLevel?: number;
    } = {}
  ): Promise<any> {
    const { view = 'tree', expandLevel = 2 } = options;

    switch (view) {
      case 'tree':
        return this.getTreeViewData(contractId, tenantId, expandLevel);
      case 'timeline':
        return this.getTimelineViewData(contractId, tenantId);
      case 'cluster':
        return this.getClusterViewData(contractId, tenantId);
      case 'minimap':
        return this.getMinimapData(contractId, tenantId);
      default:
        return this.getTreeViewData(contractId, tenantId, expandLevel);
    }
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async fetchFamilyRelationships(
    contractId: string,
    tenantId: string,
    maxDepth: number,
    minConfidence: number
  ) {
    // Use recursive CTE for efficient tree traversal
    const relationships = await prisma.$queryRaw<Array<{
      source_contract_id: string;
      target_contract_id: string;
      relationship_type: string;
      direction: string;
      confidence: number;
      depth: number;
    }>>`
      WITH RECURSIVE relationship_tree AS (
        -- Base case: direct relationships from contract
        SELECT 
          source_contract_id,
          target_contract_id,
          relationship_type,
          direction,
          confidence,
          1 as depth
        FROM contract_relationships
        WHERE tenant_id = ${tenantId}
          AND status IN ('confirmed', 'auto_confirmed')
          AND confidence >= ${minConfidence}
          AND (source_contract_id = ${contractId} OR target_contract_id = ${contractId})
        
        UNION ALL
        
        -- Recursive case: follow relationships
        SELECT 
          cr.source_contract_id,
          cr.target_contract_id,
          cr.relationship_type,
          cr.direction,
          cr.confidence,
          rt.depth + 1
        FROM contract_relationships cr
        INNER JOIN relationship_tree rt ON 
          (cr.source_contract_id = rt.target_contract_id OR 
           cr.target_contract_id = rt.source_contract_id)
        WHERE cr.tenant_id = ${tenantId}
          AND cr.status IN ('confirmed', 'auto_confirmed')
          AND cr.confidence >= ${minConfidence}
          AND rt.depth < ${maxDepth}
      )
      SELECT DISTINCT * FROM relationship_tree
    `;

    return relationships;
  }

  private async findRoot(
    contractId: string,
    tenantId: string,
    relationships: any[]
  ): Promise<string> {
    // Find the ultimate parent (no incoming parent relationships)
    let currentId = contractId;
    let visited = new Set<string>();

    while (!visited.has(currentId)) {
      visited.add(currentId);
      
      const parent = relationships.find(r => 
        r.target_contract_id === currentId && 
        (r.direction === 'parent' || r.relationship_type === 'SOW_UNDER_MSA')
      );

      if (!parent) break;
      currentId = parent.source_contract_id;
    }

    return currentId;
  }

  private async buildNodeRecursive(
    contractId: string,
    tenantId: string,
    relationships: any[],
    allNodes: Map<string, ContractNode>,
    level: number,
    maxDepth: number,
    includeSiblings: boolean
  ): Promise<ContractNode> {
    // Check if already built
    if (allNodes.has(contractId)) {
      return allNodes.get(contractId)!;
    }

    // Fetch contract data
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        contractArtifacts: { where: { type: 'RENEWAL' }, take: 1 },
      },
    });

    if (!contract) {
      throw new Error(`Contract ${contractId} not found`);
    }

    // Get ancestors
    const ancestors = await this.getAncestry(contractId, tenantId, { maxLevels: 3 });

    // Get descendants (if not at max depth)
    const descendants = level < maxDepth 
      ? await this.getDescendants(contractId, tenantId, { maxLevels: maxDepth - level })
      : [];

    // Build children
    const children: ContractNode[] = [];
    if (level < maxDepth) {
      const childRels = relationships.filter(r => 
        r.source_contract_id === contractId && 
        r.direction !== 'parent'
      );

      for (const childRel of childRels) {
        const child = await this.buildNodeRecursive(
          childRel.target_contract_id,
          tenantId,
          relationships,
          allNodes,
          level + 1,
          maxDepth,
          includeSiblings
        );
        children.push(child);
      }
    }

    // Get siblings
    const siblings: ContractNode[] = [];
    if (includeSiblings && level > 0) {
      const siblingList = await this.getSiblings(contractId, tenantId);
      for (const sib of siblingList) {
        if (!allNodes.has(sib.id)) {
          // Build sibling if not already built
          const sibNode = await this.buildNodeRecursive(
            sib.id,
            tenantId,
            relationships,
            allNodes,
            level,
            maxDepth,
            false // Don't include siblings of siblings to avoid loops
          );
          siblings.push(sibNode);
        }
      }
    }

    const renewalData = (contract as any).contractArtifacts?.[0]?.value as any;

    const node: ContractNode = {
      id: contractId,
      title: contract.contractTitle || contract.fileName || 'Untitled',
      type: contract.contractType || 'Unknown',
      status: contract.status,
      party: contract.supplierName ?? undefined,
      value: Number(contract.totalValue || 0),
      currency: contract.currency || 'USD',
      startDate: contract.startDate || undefined,
      endDate: contract.endDate || undefined,
      level,
      parentId: ancestors[0]?.id,
      children,
      siblings,
      ancestors,
      descendants,
      relationships: [], // Would populate from relationships
      metadata: {
        isRoot: level === 0,
        isLeaf: children.length === 0,
        branchCount: descendants.length,
        depth: Math.max(...descendants.map(d => d.level), 0),
        riskScore: undefined,
        healthScore: undefined,
        renewalDate: contract.endDate || undefined,
      },
      visual: {
        color: this.getNodeColor(contract),
        icon: this.getNodeIcon(contract),
        size: this.getNodeSize(contract),
        badges: this.getNodeBadges(contract, renewalData),
      },
    };

    allNodes.set(contractId, node);
    return node;
  }

  private calculateTreeStats(allNodes: Map<string, ContractNode>): TreeStats {
    const nodes = Array.from(allNodes.values());
    const totalValue = nodes.reduce((sum, n) => sum + (n.value || 0), 0);
    const maxDepth = Math.max(...nodes.map(n => n.level), 0);
    const roots = nodes.filter(n => n.metadata.isRoot);
    const leaves = nodes.filter(n => n.metadata.isLeaf);

    const contractsByType: Record<string, number> = {};
    const riskDistribution = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const node of nodes) {
      contractsByType[node.type] = (contractsByType[node.type] || 0) + 1;
      
      const risk = node.metadata.riskScore;
      if (risk && risk >= 70) riskDistribution.critical++;
      else if (risk && risk >= 50) riskDistribution.high++;
      else if (risk && risk >= 30) riskDistribution.medium++;
      else riskDistribution.low++;
    }

    return {
      totalNodes: nodes.length,
      maxDepth,
      totalValue,
      rootCount: roots.length,
      leafCount: leaves.length,
      avgBranchingFactor: nodes.length > 0 
        ? nodes.reduce((sum, n) => sum + n.children.length, 0) / nodes.length 
        : 0,
      contractsByType,
      riskDistribution,
    };
  }

  private generateBreadcrumbs(
    contractId: string,
    allNodes: Map<string, ContractNode>
  ): BreadcrumbItem[] {
    const breadcrumbs: BreadcrumbItem[] = [];
    let current = allNodes.get(contractId);

    // Build path from root to target
    const path: ContractNode[] = [];
    while (current) {
      path.unshift(current);
      current = current.parentId ? allNodes.get(current.parentId) : undefined;
    }

    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      breadcrumbs.push({
        id: node.id,
        title: node.title,
        type: node.type,
        relationship: i > 0 ? path[i - 1].children.find(c => c.id === node.id)?.type : undefined,
        isActive: node.id === contractId,
      });
    }

    return breadcrumbs;
  }

  private groupByLevel(allNodes: Map<string, ContractNode>): ContractNode[][] {
    const levels = new Map<number, ContractNode[]>();
    
    for (const node of allNodes.values()) {
      if (!levels.has(node.level)) {
        levels.set(node.level, []);
      }
      levels.get(node.level)!.push(node);
    }

    return Array.from(levels.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([_, nodes]) => nodes);
  }

  private async fetchAmendmentChain(contractId: string, tenantId: string) {
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });

    if (!contract) return [];

    // Find all related via amendment relationships
    const allRelated = await prisma.contract.findMany({
      where: {
        tenantId,
        OR: [
          { id: contractId },
          {
            sourceRelationships: {
              some: {
                targetContractId: contractId,
                relationshipType: { contains: 'AMENDMENT' },
              },
            },
          },
          {
            targetRelationships: {
              some: {
                sourceContractId: contractId,
                relationshipType: { contains: 'AMENDMENT' },
              },
            },
          },
        ],
      },
    });

    return allRelated;
  }

  private inferChanges(prev: any, current: any): AmendmentChange[] {
    const changes: AmendmentChange[] = [];

    if (prev && current) {
      if (prev.totalValue !== current.totalValue) {
        changes.push({
          field: 'Contract Value',
          oldValue: String(prev.totalValue || 0),
          newValue: String(current.totalValue || 0),
          type: 'modified',
          significance: 'critical',
        });
      }

      if (prev.endDate?.getTime() !== current.endDate?.getTime()) {
        changes.push({
          field: 'End Date',
          oldValue: prev.endDate?.toISOString().split('T')[0] || 'N/A',
          newValue: current.endDate?.toISOString().split('T')[0] || 'N/A',
          type: 'modified',
          significance: 'major',
        });
      }
    }

    return changes;
  }

  private mapStatus(status: string): AmendmentVersion['status'] {
    switch (status) {
      case 'DRAFT': return 'draft';
      case 'PENDING': return 'pending';
      case 'ACTIVE': return 'executed';
      case 'EXPIRED':
      case 'TERMINATED': return 'superseded';
      default: return 'draft';
    }
  }

  private async executeCascadeOperation(
    targetId: string,
    type: string,
    params: Record<string, any>
  ): Promise<CascadeResult> {
    const contract = await prisma.contract.findUnique({
      where: { id: targetId },
      select: { id: true, contractTitle: true, status: true },
    });

    if (!contract) {
      throw new Error('Contract not found');
    }

    let oldValue: any;
    let newValue: any;

    switch (type) {
      case 'update_status':
        oldValue = contract.status;
        newValue = params.status;
        await prisma.contract.update({
          where: { id: targetId },
          data: { status: params.status },
        });
        break;

      case 'extend_dates':
        const currentEnd = await prisma.contract.findUnique({
          where: { id: targetId },
          select: { endDate: true },
        });
        oldValue = currentEnd?.endDate;
        newValue = params.endDate;
        await prisma.contract.update({
          where: { id: targetId },
          data: { endDate: params.endDate },
        });
        break;

      case 'notify':
        // Notification logic would go here
        oldValue = 'pending';
        newValue = 'notified';
        break;

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    return {
      contractId: targetId,
      title: contract.contractTitle || 'Untitled',
      operation: type,
      success: true,
      oldValue,
      newValue,
    };
  }

  private calculateVerticalLayout(
    tree: ContractTree,
    config: LayoutConfig,
    nodes: VisualNode[],
    edges: VisualEdge[]
  ) {
    const levelWidth: Map<number, number> = new Map();

    // Calculate width needed for each level
    for (const [level, levelNodes] of tree.levels.entries()) {
      levelWidth.set(level, levelNodes.length * (config.nodeWidth + config.siblingSpacing));
    }

    const maxWidth = Math.max(...levelWidth.values());
    const startX = maxWidth / 2;

    // Position nodes
    for (const [level, levelNodes] of tree.levels.entries()) {
      const levelW = levelNodes.length * (config.nodeWidth + config.siblingSpacing);
      let currentX = startX - levelW / 2;
      const y = level * (config.nodeHeight + config.levelSpacing);

      for (const node of levelNodes) {
        nodes.push({
          id: node.id,
          x: currentX,
          y,
          width: config.nodeWidth,
          height: config.nodeHeight,
          data: node,
          style: {
            backgroundColor: node.visual.color,
            borderColor: node.level === 0 ? '#000' : '#ccc',
            borderWidth: node.level === 0 ? 3 : 1,
            opacity: 1,
            zIndex: 10 - node.level,
          },
        });

        currentX += config.nodeWidth + config.siblingSpacing;
      }
    }

    // Create edges
    for (const node of tree.allNodes.values()) {
      for (const child of node.children) {
        const parentNode = nodes.find(n => n.id === node.id);
        const childNode = nodes.find(n => n.id === child.id);
        
        if (parentNode && childNode) {
          edges.push({
            id: `${node.id}-${child.id}`,
            source: node.id,
            target: child.id,
            type: 'MASTER_TO_SUB',
            path: this.createCurvedPath(parentNode, childNode),
            style: {
              stroke: '#94a3b8',
              strokeWidth: 2,
              opacity: 0.8,
            },
          });
        }
      }
    }
  }

  private calculateHorizontalLayout(
    tree: ContractTree,
    config: LayoutConfig,
    nodes: VisualNode[],
    edges: VisualEdge[]
  ) {
    // Similar to vertical but rotated
    this.calculateVerticalLayout(tree, config, nodes, edges);
    // Rotate coordinates
    for (const node of nodes) {
      const tempX = node.x;
      node.x = node.y;
      node.y = tempX;
    }
  }

  private calculateRadialLayout(
    tree: ContractTree,
    config: LayoutConfig,
    nodes: VisualNode[],
    edges: VisualEdge[]
  ) {
    const centerX = 0;
    const centerY = 0;
    const radiusStep = config.levelSpacing;

    for (const [level, levelNodes] of tree.levels.entries()) {
      const radius = (level + 1) * radiusStep;
      const angleStep = (2 * Math.PI) / levelNodes.length;

      for (let i = 0; i < levelNodes.length; i++) {
        const node = levelNodes[i];
        const angle = i * angleStep - Math.PI / 2;
        
        nodes.push({
          id: node.id,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          width: config.nodeWidth,
          height: config.nodeHeight,
          data: node,
          style: {
            backgroundColor: node.visual.color,
            borderColor: node.level === 0 ? '#000' : '#ccc',
            borderWidth: node.level === 0 ? 3 : 1,
            opacity: 1,
            zIndex: 10 - node.level,
          },
        });
      }
    }
  }

  private createCurvedPath(parent: VisualNode, child: VisualNode): string {
    const startX = parent.x + parent.width / 2;
    const startY = parent.y + parent.height;
    const endX = child.x + child.width / 2;
    const endY = child.y;

    const midY = (startY + endY) / 2;

    return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  }

  private async getTreeViewData(contractId: string, tenantId: string, expandLevel: number) {
    const tree = await this.buildTree(contractId, tenantId, { maxDepth: expandLevel });
    return {
      type: 'tree',
      data: tree.root,
      stats: tree.stats,
      breadcrumbs: tree.breadcrumbs,
    };
  }

  private async getTimelineViewData(contractId: string, tenantId: string) {
    const chain = await this.buildAmendmentChain(contractId, tenantId);
    return {
      type: 'timeline',
      data: chain,
    };
  }

  private async getClusterViewData(contractId: string, tenantId: string) {
    const tree = await this.buildTree(contractId, tenantId);
    const clusters = this.identifyClusters(tree);
    return {
      type: 'cluster',
      clusters,
    };
  }

  private async getMinimapData(contractId: string, tenantId: string) {
    const tree = await this.buildTree(contractId, tenantId, { maxDepth: 2 });
    return {
      type: 'minimap',
      nodes: Array.from(tree.allNodes.values()).map(n => ({
        id: n.id,
        level: n.level,
        riskLevel: n.metadata.riskScore && n.metadata.riskScore >= 70 ? 'critical' :
                    n.metadata.riskScore && n.metadata.riskScore >= 50 ? 'high' :
                    n.metadata.riskScore && n.metadata.riskScore >= 30 ? 'medium' : 'low',
      })),
      totalCount: tree.stats.totalNodes,
    };
  }

  private identifyClusters(tree: ContractTree): any[] {
    // Simple clustering by relationship type
    const clusters = new Map<string, string[]>();
    
    for (const node of tree.allNodes.values()) {
      for (const child of node.children) {
        const type = child.type || 'Unknown';
        if (!clusters.has(type)) {
          clusters.set(type, []);
        }
        clusters.get(type)!.push(child.id);
      }
    }

    return Array.from(clusters.entries()).map(([type, ids]) => ({
      type,
      count: ids.length,
      ids,
    }));
  }

  private getNodeColor(contract: any): string {
    const typeColors: Record<string, string> = {
      'MSA': '#dbeafe', // blue
      'SOW': '#dcfce7', // green
      'NDA': '#fef3c7', // yellow
      'AMENDMENT': '#fce7f3', // pink
      'LICENSE': '#f3e8ff', // purple
    };
    return typeColors[contract.contractType] || '#f1f5f9';
  }

  private getNodeIcon(contract: any): string {
    const typeIcons: Record<string, string> = {
      'MSA': 'document-text',
      'SOW': 'clipboard-document',
      'NDA': 'lock-closed',
      'AMENDMENT': 'pencil-square',
      'LICENSE': 'key',
    };
    return typeIcons[contract.contractType] || 'document';
  }

  private getNodeSize(contract: any): 'small' | 'medium' | 'large' {
    const value = Number(contract.totalValue || 0);
    if (value > 100000) return 'large';
    if (value > 10000) return 'medium';
    return 'small';
  }

  private getNodeBadges(contract: any, renewalData?: any): string[] {
    const badges: string[] = [];

    if (contract.status === 'ACTIVE') badges.push('active');
    if (renewalData?.autoRenewal) badges.push('auto-renew');
    if (contract.healthScore?.riskScore && contract.healthScore.riskScore > 70) {
      badges.push('high-risk');
    }
    if (contract.endDate) {
      const daysUntil = Math.ceil((contract.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 30) badges.push('expiring-soon');
    }

    return badges;
  }
}

// Export singleton
export const contractHierarchyService = ContractHierarchyService.getInstance();
export { ContractHierarchyService };
