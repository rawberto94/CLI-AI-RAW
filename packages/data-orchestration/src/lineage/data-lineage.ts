import { eventBus, Events } from "../events/event-bus";
import { cacheAdaptor } from "../dal/cache.adaptor";
import pino from "pino";

const logger = pino({ name: "data-lineage" });

export interface DataLineageNode {
  id: string;
  type: "contract" | "artifact" | "rate_card" | "insight" | "pattern";
  name: string;
  tenantId: string;
  createdAt: Date;
  metadata: {
    source?: string;
    version?: string;
    size?: number;
    processingTime?: number;
    confidence?: number;
    [key: string]: any;
  };
}

export interface DataLineageEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationship: "generates" | "derives_from" | "influences" | "references" | "transforms";
  strength: number; // 0-1, how strong the relationship is
  metadata: {
    transformationType?: string;
    processingStep?: string;
    timestamp: Date;
    [key: string]: any;
  };
}

export interface DataLineageGraph {
  nodes: DataLineageNode[];
  edges: DataLineageEdge[];
  metadata: {
    tenantId: string;
    generatedAt: Date;
    totalNodes: number;
    totalEdges: number;
    depth: number;
  };
}

export class DataLineageTracker {
  private static instance: DataLineageTracker;
  private lineageCache = new Map<string, DataLineageGraph>();

  private constructor() {
    this.setupEventHandlers();
  }

  static getInstance(): DataLineageTracker {
    if (!DataLineageTracker.instance) {
      DataLineageTracker.instance = new DataLineageTracker();
    }
    return DataLineageTracker.instance;
  }

  private setupEventHandlers(): void {
    // Track contract lifecycle
    eventBus.subscribe(Events.CONTRACT_CREATED, this.handleContractCreated.bind(this));
    eventBus.subscribe(Events.CONTRACT_UPDATED, this.handleContractUpdated.bind(this));
    
    // Track artifact generation
    eventBus.subscribe(Events.ARTIFACT_CREATED, this.handleArtifactCreated.bind(this));
    
    // Track processing pipeline
    eventBus.subscribe(Events.PROCESSING_STARTED, this.handleProcessingStarted.bind(this));
    eventBus.subscribe(Events.PROCESSING_COMPLETED, this.handleProcessingCompleted.bind(this));
    
    // Track intelligence generation
    eventBus.subscribe(Events.PATTERN_DETECTED, this.handlePatternDetected.bind(this));
    eventBus.subscribe(Events.INSIGHT_GENERATED, this.handleInsightGenerated.bind(this));
  }

  /**
   * Handle contract creation - create root node
   */
  private async handleContractCreated(payload: any): Promise<void> {
    try {
      const { contractId, tenantId, contract } = payload.data;
      
      const node: DataLineageNode = {
        id: contractId,
        type: "contract",
        name: contract.fileName || contract.contractTitle || `Contract ${contractId}`,
        tenantId,
        createdAt: new Date(contract.createdAt),
        metadata: {
          source: "upload",
          size: Number(contract.fileSize),
          mimeType: contract.mimeType,
          status: contract.status,
        },
      };

      await this.addNode(tenantId, node);
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle contract created for lineage");
    }
  }

  /**
   * Handle contract updates - track changes
   */
  private async handleContractUpdated(payload: any): Promise<void> {
    try {
      const { contractId, tenantId, changes } = payload.data;
      
      // Update node metadata
      await this.updateNodeMetadata(tenantId, contractId, {
        lastUpdated: new Date(),
        changes: Object.keys(changes),
      });
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle contract updated for lineage");
    }
  }

  /**
   * Handle artifact creation - create derived nodes
   */
  private async handleArtifactCreated(payload: any): Promise<void> {
    try {
      const { artifactId, contractId, tenantId, type, data } = payload.data;
      
      const artifactNode: DataLineageNode = {
        id: artifactId,
        type: "artifact",
        name: `${type} Analysis`,
        tenantId,
        createdAt: new Date(),
        metadata: {
          artifactType: type,
          source: "processing_pipeline",
          dataSize: JSON.stringify(data).length,
          confidence: data.confidence || data._meta?.confidence,
        },
      };

      const edge: DataLineageEdge = {
        id: `${contractId}->${artifactId}`,
        sourceId: contractId,
        targetId: artifactId,
        relationship: "generates",
        strength: 1.0,
        metadata: {
          transformationType: "ai_analysis",
          processingStep: type.toLowerCase(),
          timestamp: new Date(),
        },
      };

      await this.addNode(tenantId, artifactNode);
      await this.addEdge(tenantId, edge);
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle artifact created for lineage");
    }
  }

  /**
   * Handle processing pipeline events
   */
  private async handleProcessingStarted(payload: any): Promise<void> {
    try {
      const { contractId, tenantId } = payload.data;
      
      await this.updateNodeMetadata(tenantId, contractId, {
        processingStarted: new Date(),
        processingStatus: "in_progress",
      });
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle processing started for lineage");
    }
  }

  private async handleProcessingCompleted(payload: any): Promise<void> {
    try {
      const { contractId, tenantId, duration, artifactsGenerated } = payload.data;
      
      await this.updateNodeMetadata(tenantId, contractId, {
        processingCompleted: new Date(),
        processingStatus: "completed",
        processingDuration: duration,
        artifactsGenerated: artifactsGenerated || 0,
      });
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle processing completed for lineage");
    }
  }

  /**
   * Handle intelligence events - track derived insights
   */
  private async handlePatternDetected(payload: any): Promise<void> {
    try {
      const { patternId, tenantId, contractId, pattern } = payload.data;
      
      const patternNode: DataLineageNode = {
        id: patternId,
        type: "pattern",
        name: pattern.description,
        tenantId,
        createdAt: new Date(pattern.detectedAt),
        metadata: {
          patternType: pattern.type,
          confidence: pattern.confidence,
          impact: pattern.impact,
          affectedContracts: pattern.affectedContracts?.length || 0,
        },
      };

      // Create edges from all affected contracts to this pattern
      const edges: DataLineageEdge[] = (pattern.affectedContracts || [contractId]).map((cId: string) => ({
        id: `${cId}->${patternId}`,
        sourceId: cId,
        targetId: patternId,
        relationship: "influences" as const,
        strength: pattern.confidence,
        metadata: {
          transformationType: "pattern_detection",
          timestamp: new Date(),
        },
      }));

      await this.addNode(tenantId, patternNode);
      for (const edge of edges) {
        await this.addEdge(tenantId, edge);
      }
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle pattern detected for lineage");
    }
  }

  private async handleInsightGenerated(payload: any): Promise<void> {
    try {
      const { insightId, tenantId, insight } = payload.data;
      
      const insightNode: DataLineageNode = {
        id: insightId,
        type: "insight",
        name: insight.title,
        tenantId,
        createdAt: new Date(insight.generatedAt),
        metadata: {
          insightType: insight.type,
          confidence: insight.confidence,
          impact: insight.impact,
          priority: insight.priority,
          potentialSavings: insight.potentialSavings,
        },
      };

      await this.addNode(tenantId, insightNode);
      
      // If insight references specific contracts, create edges
      if (insight.metadata?.contractIds) {
        for (const contractId of insight.metadata.contractIds) {
          const edge: DataLineageEdge = {
            id: `${contractId}->${insightId}`,
            sourceId: contractId,
            targetId: insightId,
            relationship: "influences",
            strength: insight.confidence,
            metadata: {
              transformationType: "insight_generation",
              timestamp: new Date(),
            },
          };
          await this.addEdge(tenantId, edge);
        }
      }
      
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle insight generated for lineage");
    }
  }

  /**
   * Add a node to the lineage graph
   */
  private async addNode(tenantId: string, node: DataLineageNode): Promise<void> {
    const graph = await this.getLineageGraph(tenantId);
    
    // Check if node already exists
    const existingIndex = graph.nodes.findIndex(n => n.id === node.id);
    if (existingIndex >= 0) {
      // Update existing node
      graph.nodes[existingIndex] = { ...graph.nodes[existingIndex], ...node };
    } else {
      // Add new node
      graph.nodes.push(node);
    }
    
    await this.saveLineageGraph(tenantId, graph);
  }

  /**
   * Add an edge to the lineage graph
   */
  private async addEdge(tenantId: string, edge: DataLineageEdge): Promise<void> {
    const graph = await this.getLineageGraph(tenantId);
    
    // Check if edge already exists
    const existingIndex = graph.edges.findIndex(e => e.id === edge.id);
    if (existingIndex >= 0) {
      // Update existing edge
      graph.edges[existingIndex] = { ...graph.edges[existingIndex], ...edge };
    } else {
      // Add new edge
      graph.edges.push(edge);
    }
    
    await this.saveLineageGraph(tenantId, graph);
  }

  /**
   * Update node metadata
   */
  private async updateNodeMetadata(tenantId: string, nodeId: string, metadata: any): Promise<void> {
    const graph = await this.getLineageGraph(tenantId);
    
    const nodeIndex = graph.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex >= 0) {
      graph.nodes[nodeIndex].metadata = {
        ...graph.nodes[nodeIndex].metadata,
        ...metadata,
      };
      await this.saveLineageGraph(tenantId, graph);
    }
  }

  /**
   * Get lineage graph for a tenant
   */
  private async getLineageGraph(tenantId: string): Promise<DataLineageGraph> {
    // Try cache first
    const cached = this.lineageCache.get(tenantId);
    if (cached) return cached;

    // Try Redis cache
    const cacheKey = `lineage:${tenantId}`;
    const redisCached = await cacheAdaptor.get<DataLineageGraph>(cacheKey);
    if (redisCached) {
      this.lineageCache.set(tenantId, redisCached);
      return redisCached;
    }

    // Create new empty graph
    const newGraph: DataLineageGraph = {
      nodes: [],
      edges: [],
      metadata: {
        tenantId,
        generatedAt: new Date(),
        totalNodes: 0,
        totalEdges: 0,
        depth: 0,
      },
    };

    this.lineageCache.set(tenantId, newGraph);
    return newGraph;
  }

  /**
   * Save lineage graph
   */
  private async saveLineageGraph(tenantId: string, graph: DataLineageGraph): Promise<void> {
    // Update metadata
    graph.metadata.totalNodes = graph.nodes.length;
    graph.metadata.totalEdges = graph.edges.length;
    graph.metadata.generatedAt = new Date();
    graph.metadata.depth = this.calculateGraphDepth(graph);

    // Save to cache
    this.lineageCache.set(tenantId, graph);
    
    // Save to Redis with TTL
    const cacheKey = `lineage:${tenantId}`;
    await cacheAdaptor.set(cacheKey, graph, 3600); // 1 hour TTL
  }

  /**
   * Calculate graph depth (longest path)
   */
  private calculateGraphDepth(graph: DataLineageGraph): number {
    // Simple depth calculation - can be optimized
    const visited = new Set<string>();
    let maxDepth = 0;

    const dfs = (nodeId: string, depth: number): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      maxDepth = Math.max(maxDepth, depth);

      const outgoingEdges = graph.edges.filter(e => e.sourceId === nodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.targetId, depth + 1);
      }
    };

    // Find root nodes (nodes with no incoming edges)
    const hasIncoming = new Set(graph.edges.map(e => e.targetId));
    const rootNodes = graph.nodes.filter(n => !hasIncoming.has(n.id));

    for (const root of rootNodes) {
      dfs(root.id, 0);
    }

    return maxDepth;
  }

  /**
   * Public API methods
   */

  /**
   * Get lineage for a specific contract
   */
  async getContractLineage(contractId: string, tenantId: string): Promise<DataLineageGraph> {
    const fullGraph = await this.getLineageGraph(tenantId);
    
    // Find all nodes connected to this contract
    const connectedNodes = new Set<string>([contractId]);
    const connectedEdges: DataLineageEdge[] = [];

    // BFS to find all connected nodes
    const queue = [contractId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Find outgoing edges
      const outgoing = fullGraph.edges.filter(e => e.sourceId === currentId);
      for (const edge of outgoing) {
        connectedNodes.add(edge.targetId);
        connectedEdges.push(edge);
        queue.push(edge.targetId);
      }

      // Find incoming edges
      const incoming = fullGraph.edges.filter(e => e.targetId === currentId);
      for (const edge of incoming) {
        connectedNodes.add(edge.sourceId);
        connectedEdges.push(edge);
        queue.push(edge.sourceId);
      }
    }

    const filteredNodes = fullGraph.nodes.filter(n => connectedNodes.has(n.id));

    return {
      nodes: filteredNodes,
      edges: connectedEdges,
      metadata: {
        tenantId,
        generatedAt: new Date(),
        totalNodes: filteredNodes.length,
        totalEdges: connectedEdges.length,
        depth: this.calculateGraphDepth({ nodes: filteredNodes, edges: connectedEdges, metadata: fullGraph.metadata }),
      },
    };
  }

  /**
   * Get full lineage graph for a tenant
   */
  async getTenantLineage(tenantId: string): Promise<DataLineageGraph> {
    return this.getLineageGraph(tenantId);
  }

  /**
   * Get lineage statistics
   */
  async getLineageStats(tenantId: string): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    edgesByRelationship: Record<string, number>;
    averageConnectivity: number;
    graphDensity: number;
  }> {
    const graph = await this.getLineageGraph(tenantId);

    const nodesByType = graph.nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const edgesByRelationship = graph.edges.reduce((acc, edge) => {
      acc[edge.relationship] = (acc[edge.relationship] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalConnections = graph.edges.length * 2; // Each edge connects 2 nodes
    const averageConnectivity = graph.nodes.length > 0 ? totalConnections / graph.nodes.length : 0;
    
    const maxPossibleEdges = graph.nodes.length * (graph.nodes.length - 1);
    const graphDensity = maxPossibleEdges > 0 ? graph.edges.length / maxPossibleEdges : 0;

    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      nodesByType,
      edgesByRelationship,
      averageConnectivity,
      graphDensity,
    };
  }
}

export const dataLineageTracker = DataLineageTracker.getInstance();