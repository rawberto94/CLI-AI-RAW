/**
 * Data Lineage Tracker
 * Tracks data transformations and dependencies with enhanced propagation support
 */

import { eventBus, Events } from '../events/event-bus';

export interface LineageNode {
  id: string;
  type: 'contract' | 'artifact' | 'rate-card' | 'benchmark' | 'opportunity' | 'baseline';
  entityId: string;
  name: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface LineageEdge {
  from: string;
  to: string;
  transformationType: 'extract' | 'generate' | 'calculate' | 'derive' | 'aggregate';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface DependencyGraph {
  upstream: LineageNode[];   // What this depends on
  downstream: LineageNode[];  // What depends on this
  edges: LineageEdge[];
}

class DataLineageTracker {
  private static instance: DataLineageTracker;
  private nodes: Map<string, LineageNode>;
  private edges: LineageEdge[];
  private dependencyIndex: Map<string, Set<string>>; // nodeId -> Set of dependent nodeIds

  private constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.dependencyIndex = new Map();
    this.setupEventListeners();
  }

  public static getInstance(): DataLineageTracker {
    if (!DataLineageTracker.instance) {
      DataLineageTracker.instance = new DataLineageTracker();
    }
    return DataLineageTracker.instance;
  }

  /**
   * Setup event listeners to track lineage automatically
   */
  private setupEventListeners(): void {
    // Track artifact generation from contracts
    eventBus.on(Events.ARTIFACT_GENERATED, (data: { contractId: string; artifactId: string; type: string }) => {
      this.recordLineage({
        sourceType: 'contract',
        sourceId: data.contractId,
        targetType: 'artifact',
        targetId: data.artifactId,
        operation: 'generate',
        metadata: { artifactType: data.type }
      });
    });

    // Track rate card extraction from artifacts
    eventBus.on('artifact:extract-rates', (data: { artifactId: string; rateCardId: string; contractId: string }) => {
      this.recordLineage({
        sourceType: 'artifact',
        sourceId: data.artifactId,
        targetType: 'rate-card',
        targetId: data.rateCardId,
        operation: 'extract',
        metadata: { contractId: data.contractId }
      });
    });

    // Track benchmark calculation from rate cards
    eventBus.on(Events.BENCHMARK_CALCULATED, (data: { sourceRateCards?: string[]; benchmarkId: string }) => {
      if (data.sourceRateCards) {
        data.sourceRateCards.forEach((rateCardId: string) => {
          this.recordLineage({
            sourceType: 'rate-card',
            sourceId: rateCardId,
            targetType: 'benchmark',
            targetId: data.benchmarkId,
            operation: 'aggregate'
          });
        });
      }
    });
  }

  /**
   * Record a lineage relationship
   */
  recordLineage(params: {
    sourceType: string;
    sourceId: string;
    targetType: string;
    targetId: string;
    operation: string;
    metadata?: Record<string, unknown>;
  }): void {
    const { sourceType, sourceId, targetType, targetId, operation, metadata } = params;
    const timestamp = new Date();

    // Create nodes if they don't exist
    const sourceNodeId = `${sourceType}:${sourceId}`;
    const targetNodeId = `${targetType}:${targetId}`;

    if (!this.nodes.has(sourceNodeId)) {
      this.addNode({
        id: sourceNodeId,
        type: sourceType as any,
        entityId: sourceId,
        name: `${sourceType} ${sourceId}`,
        timestamp,
        metadata
      });
    }

    if (!this.nodes.has(targetNodeId)) {
      this.addNode({
        id: targetNodeId,
        type: targetType as any,
        entityId: targetId,
        name: `${targetType} ${targetId}`,
        timestamp,
        metadata
      });
    }

    // Add edge
    this.addEdge({
      from: sourceNodeId,
      to: targetNodeId,
      transformationType: operation as any,
      timestamp,
      metadata
    });

    // Update dependency index
    if (!this.dependencyIndex.has(sourceNodeId)) {
      this.dependencyIndex.set(sourceNodeId, new Set());
    }
    this.dependencyIndex.get(sourceNodeId)!.add(targetNodeId);
  }

  /**
   * Add a lineage node
   */
  addNode(node: LineageNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Add a lineage edge
   */
  addEdge(edge: LineageEdge): void {
    this.edges.push(edge);
  }

  /**
   * Get all downstream dependencies (what depends on this)
   */
  getDownstream(type: string, entityId: string): LineageNode[] {
    const nodeId = `${type}:${entityId}`;
    const downstream: LineageNode[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const dependents = this.dependencyIndex.get(currentId);
      if (dependents) {
        dependents.forEach(depId => {
          const node = this.nodes.get(depId);
          if (node) {
            downstream.push(node);
            traverse(depId);
          }
        });
      }
    };

    traverse(nodeId);
    return downstream;
  }

  /**
   * Get all upstream dependencies (what this depends on)
   */
  getUpstream(type: string, entityId: string): LineageNode[] {
    const nodeId = `${type}:${entityId}`;
    const upstream: LineageNode[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      // Find edges where current node is the target
      const incomingEdges = this.edges.filter(e => e.to === currentId);
      incomingEdges.forEach(edge => {
        const node = this.nodes.get(edge.from);
        if (node) {
          upstream.push(node);
          traverse(edge.from);
        }
      });
    };

    traverse(nodeId);
    return upstream;
  }

  /**
   * Get complete dependency graph for a node
   */
  getDependencyGraph(type: string, entityId: string): DependencyGraph {
    const nodeId = `${type}:${entityId}`;
    const upstream = this.getUpstream(type, entityId);
    const downstream = this.getDownstream(type, entityId);
    
    // Get all relevant edges
    const allNodeIds = new Set([
      nodeId,
      ...upstream.map(n => n.id),
      ...downstream.map(n => n.id)
    ]);
    
    const relevantEdges = this.edges.filter(e => 
      allNodeIds.has(e.from) || allNodeIds.has(e.to)
    );

    return {
      upstream,
      downstream,
      edges: relevantEdges
    };
  }

  /**
   * Get lineage for a specific node (legacy method)
   */
  getLineage(nodeId: string): { nodes: LineageNode[]; edges: LineageEdge[] } {
    const relatedNodes: LineageNode[] = [];
    const relatedEdges: LineageEdge[] = [];

    // Get all edges involving this node
    const edges = this.edges.filter(e => e.from === nodeId || e.to === nodeId);
    relatedEdges.push(...edges);

    // Get all related nodes
    edges.forEach(edge => {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);
      if (fromNode) relatedNodes.push(fromNode);
      if (toNode) relatedNodes.push(toNode);
    });

    return { nodes: relatedNodes, edges: relatedEdges };
  }

  /**
   * Get impact analysis - what will be affected if this node changes
   */
  getImpactAnalysis(type: string, entityId: string): {
    directImpact: LineageNode[];
    indirectImpact: LineageNode[];
    totalAffected: number;
  } {
    const downstream = this.getDownstream(type, entityId);
    const nodeId = `${type}:${entityId}`;
    
    // Direct impact: immediate children
    const directDeps = this.dependencyIndex.get(nodeId);
    const directImpact = directDeps 
      ? Array.from(directDeps).map(id => this.nodes.get(id)!).filter(Boolean)
      : [];
    
    // Indirect impact: everything else downstream
    const directIds = new Set(directImpact.map(n => n.id));
    const indirectImpact = downstream.filter(n => !directIds.has(n.id));

    return {
      directImpact,
      indirectImpact,
      totalAffected: downstream.length
    };
  }

  /**
   * Clear all lineage data
   */
  clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.dependencyIndex.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
  } {
    const nodesByType: Record<string, number> = {};
    
    this.nodes.forEach(node => {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    });

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.length,
      nodesByType
    };
  }
}

export const dataLineageTracker = DataLineageTracker.getInstance();
