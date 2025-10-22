/**
 * Data Lineage Tracker
 * Tracks data transformations and dependencies
 */

export interface LineageNode {
  id: string;
  type: 'source' | 'transformation' | 'target';
  name: string;
  timestamp: Date;
  metadata?: any;
}

export interface LineageEdge {
  from: string;
  to: string;
  transformationType: string;
}

class DataLineageTracker {
  private static instance: DataLineageTracker;
  private nodes: Map<string, LineageNode>;
  private edges: LineageEdge[];

  private constructor() {
    this.nodes = new Map();
    this.edges = [];
  }

  public static getInstance(): DataLineageTracker {
    if (!DataLineageTracker.instance) {
      DataLineageTracker.instance = new DataLineageTracker();
    }
    return DataLineageTracker.instance;
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
   * Track data transformation
   */
  trackTransformation(sourceId: string, targetId: string, transformationType: string): void {
    this.addEdge({ from: sourceId, to: targetId, transformationType });
  }

  /**
   * Get lineage for a specific node
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
   * Clear all lineage data
   */
  clear(): void {
    this.nodes.clear();
    this.edges = [];
  }
}

export const dataLineageTracker = DataLineageTracker.getInstance();
