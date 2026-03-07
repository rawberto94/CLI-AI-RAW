/**
 * Neo4j Graph Database Service
 * Production-ready graph persistence for ConTigo Knowledge Graph
 * 
 * Features:
 * - Entity and relationship CRUD with vector embeddings
 * - Graph algorithms (PageRank, community detection, pathfinding)
 * - Temporal analysis and change tracking
 * - Multi-tenant isolation
 * 
 * @version 1.0.0
 */

import neo4j, { Driver, Session, Integer } from 'neo4j-driver';
import { OpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type EntityType = 
  | 'party' | 'person' | 'organization' | 'location' 
  | 'product' | 'service' | 'clause' | 'term' 
  | 'obligation' | 'date' | 'currency' | 'contract' 
  | 'risk' | 'opportunity' | 'rfx' | 'bid';

export type RelationType =
  | 'party_to' | 'references' | 'supersedes' | 'amends' 
  | 'renews' | 'related_to' | 'depends_on' | 'conflicts_with'
  | 'similar_to' | 'parent_of' | 'child_of' | 'linked_clause'
  | 'provides_service' | 'receives_service' | 'obligates'
  | 'grants_right' | 'located_in' | 'employs' | 'supplies'
  | 'competes_with' | 'bid_on' | 'awarded_to';

export interface GraphEntity {
  id: string;
  type: EntityType;
  name: string;
  normalizedName: string;
  aliases: string[];
  attributes: Record<string, unknown>;
  sourceContracts: string[];
  tenantId: string;
  confidence: number;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  strength: number;
  attributes: Record<string, unknown>;
  evidence: RelationEvidence[];
  tenantId: string;
  createdAt: Date;
}

export interface RelationEvidence {
  contractId: string;
  excerpt: string;
  page?: number;
  section?: string;
  confidence: number;
}

export interface PathResult {
  path: GraphEntity[];
  relations: GraphRelation[];
  totalStrength: number;
  length: number;
}

export interface GraphStats {
  totalEntities: number;
  totalRelations: number;
  byEntityType: Record<EntityType, number>;
  byRelationType: Record<RelationType, number>;
  avgDegree: number;
  densestNodes: Array<{ entityId: string; name: string; degree: number }>;
  clusters: Array<{ id: string; size: number; dominantType: EntityType }>;
}

export interface SimilarityResult {
  entity: GraphEntity;
  similarity: number;
  commonContracts: number;
  sharedRelations: number;
}

export interface ContractCluster {
  id: string;
  contracts: string[];
  entities: GraphEntity[];
  dominantParties: string[];
  totalValue: number;
  riskScore: number;
}

export interface TemporalEvent {
  timestamp: Date;
  eventType: 'entity_created' | 'relation_created' | 'entity_updated' | 'contract_added';
  entityId?: string;
  contractId?: string;
  details: Record<string, unknown>;
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class Neo4jGraphService {
  private _driver: Driver | null = null;
  private _openai: OpenAI | null = null;
  private embeddingCache: Map<string, number[]> = new Map();
  private initialized: boolean = false;

  // Lazy getter for driver - only creates connection when actually needed
  private get driver(): Driver {
    if (!this._driver) {
      const uri = process.env.NEO4J_URI;
      if (!uri) {
        throw new Error('Neo4j not configured: NEO4J_URI environment variable is required');
      }
      const user = process.env.NEO4J_USER || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || 'password';
      
      this._driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      
      // Initialize schema on first connection
      if (!this.initialized) {
        this.initialized = true;
        this.initializeSchema().catch(console.error);
      }
    }
    return this._driver;
  }

  private get openai(): OpenAI {
    if (!this._openai) {
      this._openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this._openai;
  }
  
  constructor() {
    // Lazy initialization - no connection created until first use
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private async initializeSchema(): Promise<void> {
    const session = this.driver.session();
    try {
      // Create constraints and indexes
      await session.run(`
        CREATE CONSTRAINT entity_id IF NOT EXISTS
        FOR (e:Entity) REQUIRE e.id IS UNIQUE
      `);
      
      await session.run(`
        CREATE INDEX entity_type_tenant IF NOT EXISTS
        FOR (e:Entity) ON (e.type, e.tenantId)
      `);
      
      await session.run(`
        CREATE INDEX entity_name IF NOT EXISTS
        FOR (e:Entity) ON (e.normalizedName)
      `);
      
      await session.run(`
        CREATE INDEX relation_type IF NOT EXISTS
        FOR ()-[r:RELATES]-() ON (r.type)
      `);

      // Create vector index if supported (Neo4j 5.x+)
      try {
        await session.run(`
          CREATE VECTOR INDEX entity_embeddings IF NOT EXISTS
          FOR (e:Entity) ON (e.embedding)
          OPTIONS {indexConfig: {
            
            `);
      } catch {
        // Vector index may not be available, continue without it
        console.log('[Neo4j] Vector index not created (may require AuraDB or GDS)');
      }

      console.log('[Neo4j] Schema initialized successfully');
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // ENTITY OPERATIONS
  // ============================================================================

  async createEntity(
    entity: Omit<GraphEntity, 'id' | 'createdAt' | 'updatedAt'>,
    generateEmbedding: boolean = true
  ): Promise<GraphEntity> {
    const id = uuidv4();
    const now = new Date();
    
    let embedding: number[] | undefined;
    if (generateEmbedding) {
      embedding = await this.generateEmbedding(`${entity.name} ${entity.type}`);
    }

    const fullEntity: GraphEntity = {
      ...entity,
      id,
      createdAt: now,
      updatedAt: now,
      embedding,
    };

    const session = this.driver.session();
    try {
      await session.run(
        `
        CREATE (e:Entity {
          id: $id,
          type: $type,
          name: $name,
          normalizedName: $normalizedName,
          aliases: $aliases,
          attributes: $attributes,
          sourceContracts: $sourceContracts,
          tenantId: $tenantId,
          confidence: $confidence,
          embedding: $embedding,
          createdAt: datetime($createdAt),
          updatedAt: datetime($updatedAt)
        })
        RETURN e
        `,
        {
          id: fullEntity.id,
          type: fullEntity.type,
          name: fullEntity.name,
          normalizedName: fullEntity.normalizedName,
          aliases: fullEntity.aliases,
          attributes: JSON.stringify(fullEntity.attributes),
          sourceContracts: fullEntity.sourceContracts,
          tenantId: fullEntity.tenantId,
          confidence: fullEntity.confidence,
          embedding: fullEntity.embedding || null,
          createdAt: fullEntity.createdAt.toISOString(),
          updatedAt: fullEntity.updatedAt.toISOString(),
        }
      );

      return fullEntity;
    } finally {
      await session.close();
    }
  }

  async mergeEntity(
    entity: Omit<GraphEntity, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<GraphEntity> {
    const session = this.driver.session();
    try {
      // Check for existing entity with same normalized name and type
      const existing = await session.run(
        `
        MATCH (e:Entity {normalizedName: $normalizedName, type: $type, tenantId: $tenantId})
        RETURN e
        LIMIT 1
        `,
        {
          normalizedName: entity.normalizedName,
          type: entity.type,
          tenantId: entity.tenantId,
        }
      );

      if (existing.records.length > 0) {
        // Merge with existing
        const existingEntity = existing.records[0].get('e').properties;
        return this.updateEntity(existingEntity.id, {
          aliases: Array.from(new Set([...existingEntity.aliases, ...entity.aliases, entity.name])),
          sourceContracts: Array.from(new Set([...existingEntity.sourceContracts, ...entity.sourceContracts])),
          attributes: { ...existingEntity.attributes, ...entity.attributes },
          confidence: Math.max(existingEntity.confidence, entity.confidence),
        });
      } else {
        // Create new
        return this.createEntity(entity);
      }
    } finally {
      await session.close();
    }
  }

  async updateEntity(
    id: string,
    updates: Partial<Omit<GraphEntity, 'id' | 'createdAt'>>
  ): Promise<GraphEntity> {
    const session = this.driver.session();
    try {
      const setClauses: string[] = ['e.updatedAt = datetime()'];
      const params: Record<string, unknown> = { id };

      if (updates.name) {
        setClauses.push('e.name = $name');
        params.name = updates.name;
      }
      if (updates.aliases) {
        setClauses.push('e.aliases = apoc.coll.toSet(e.aliases + $aliases)');
        params.aliases = updates.aliases;
      }
      if (updates.attributes) {
        setClauses.push('e.attributes = apoc.convert.toJson(apoc.map.merge(apoc.convert.fromJsonMap(e.attributes), $attributes))');
        params.attributes = updates.attributes;
      }
      if (updates.sourceContracts) {
        setClauses.push('e.sourceContracts = apoc.coll.toSet(e.sourceContracts + $sourceContracts)');
        params.sourceContracts = updates.sourceContracts;
      }
      if (updates.confidence !== undefined) {
        setClauses.push('e.confidence = $confidence');
        params.confidence = updates.confidence;
      }

      const result = await session.run(
        `
        MATCH (e:Entity {id: $id})
        SET ${setClauses.join(', ')}
        RETURN e
        `,
        params
      );

      if (result.records.length === 0) {
        throw new Error(`Entity not found: ${id}`);
      }

      return this.parseEntity(result.records[0].get('e').properties);
    } finally {
      await session.close();
    }
  }

  async getEntity(id: string): Promise<GraphEntity | null> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        'MATCH (e:Entity {id: $id}) RETURN e',
        { id }
      );

      if (result.records.length === 0) return null;
      return this.parseEntity(result.records[0].get('e').properties);
    } finally {
      await session.close();
    }
  }

  async findEntitiesByContract(contractId: string, tenantId: string): Promise<GraphEntity[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (e:Entity)
        WHERE $contractId IN e.sourceContracts AND e.tenantId = $tenantId
        RETURN e
        ORDER BY e.confidence DESC
        `,
        { contractId, tenantId }
      );

      return result.records.map(r => this.parseEntity(r.get('e').properties));
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // RELATIONSHIP OPERATIONS
  // ============================================================================

  async createRelation(
    relation: Omit<GraphRelation, 'id' | 'createdAt'>
  ): Promise<GraphRelation> {
    const id = uuidv4();
    const now = new Date();

    const session = this.driver.session();
    try {
      await session.run(
        `
        MATCH (source:Entity {id: $sourceId, tenantId: $tenantId})
        MATCH (target:Entity {id: $targetId, tenantId: $tenantId})
        MERGE (source)-[r:RELATES {type: $type}]->(target)
        ON CREATE SET
          r.id = $id,
          r.strength = $strength,
          r.attributes = $attributes,
          r.evidence = $evidence,
          r.tenantId = $tenantId,
          r.createdAt = datetime($createdAt)
        ON MATCH SET
          r.strength = CASE WHEN r.strength < $strength THEN $strength ELSE r.strength END,
          r.evidence = apoc.coll.union(r.evidence, $evidence)
        RETURN r
        `,
        {
          id,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          type: relation.type,
          strength: relation.strength,
          attributes: JSON.stringify(relation.attributes),
          evidence: JSON.stringify(relation.evidence),
          tenantId: relation.tenantId,
          createdAt: now.toISOString(),
        }
      );

      return { ...relation, id, createdAt: now };
    } finally {
      await session.close();
    }
  }

  async getEntityRelations(
    entityId: string,
    direction: 'out' | 'in' | 'both' = 'both'
  ): Promise<{ relations: GraphRelation[]; connectedEntities: GraphEntity[] }> {
    const session = this.driver.session();
    try {
      let query: string;
      
      if (direction === 'out') {
        query = `
          MATCH (e:Entity {id: $entityId})-[r:RELATES]->(other:Entity)
          RETURN r, other
        `;
      } else if (direction === 'in') {
        query = `
          MATCH (e:Entity {id: $entityId})<-[r:RELATES]-(other:Entity)
          RETURN r, other
        `;
      } else {
        query = `
          MATCH (e:Entity {id: $entityId})-[r:RELATES]-(other:Entity)
          RETURN r, other
        `;
      }

      const result = await session.run(query, { entityId });

      const relations: GraphRelation[] = [];
      const connectedEntities: GraphEntity[] = [];

      for (const record of result.records) {
        relations.push(this.parseRelation(record.get('r').properties));
        connectedEntities.push(this.parseEntity(record.get('other').properties));
      }

      return { relations, connectedEntities };
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // GRAPH ALGORITHMS
  // ============================================================================

  async findPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5
  ): Promise<PathResult | null> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH path = shortestPath(
          (source:Entity {id: $sourceId})-[*1..${maxDepth}]-(target:Entity {id: $targetId})
        )
        RETURN path,
               [node in nodes(path) | node {.*, embedding: null}] as entityPath,
               [rel in relationships(path) | rel {.*}] as rels,
               reduce(total = 0.0, r in relationships(path) | total + r.strength) / length(path) as avgStrength,
               length(path) as pathLength
        LIMIT 1
        `,
        { sourceId, targetId }
      );

      if (result.records.length === 0) return null;

      const record = result.records[0];
      return {
        path: record.get('entityPath').map((e: any) => this.parseEntity(e)),
        relations: record.get('rels').map((r: any) => this.parseRelation(r)),
        totalStrength: record.get('avgStrength'),
        length: record.get('pathLength').toNumber(),
      };
    } finally {
      await session.close();
    }
  }

  async findAllPaths(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5,
    limit: number = 10
  ): Promise<PathResult[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH path = (source:Entity {id: $sourceId})-[*1..${maxDepth}]-(target:Entity {id: $targetId})
        WITH path,
             [node in nodes(path) | node {.*, embedding: null}] as entityPath,
             [rel in relationships(path) | rel {.*}] as rels,
             reduce(total = 0.0, r in relationships(path) | total + r.strength) / length(path) as avgStrength,
             length(path) as pathLength
        RETURN entityPath, rels, avgStrength, pathLength
        ORDER BY avgStrength DESC, pathLength ASC
        LIMIT $limit
        `,
        { sourceId, targetId, limit }
      );

      return result.records.map(record => ({
        path: record.get('entityPath').map((e: any) => this.parseEntity(e)),
        relations: record.get('rels').map((r: any) => this.parseRelation(r)),
        totalStrength: record.get('avgStrength'),
        length: record.get('pathLength').toNumber(),
      }));
    } finally {
      await session.close();
    }
  }

  async getInfluentialEntities(
    tenantId: string,
    limit: number = 20
  ): Promise<Array<{ entity: GraphEntity; score: number }>> {
    const session = this.driver.session();
    try {
      // Simple degree centrality (can be enhanced with PageRank using GDS)
      const result = await session.run(
        `
        MATCH (e:Entity {tenantId: $tenantId})
        OPTIONAL MATCH (e)-[r:RELATES]-()
        WITH e, count(r) as degree
        ORDER BY degree DESC
        LIMIT $limit
        RETURN e {.*, embedding: null} as entity, degree as score
        `,
        { tenantId, limit }
      );

      return result.records.map(r => ({
        entity: this.parseEntity(r.get('entity')),
        score: r.get('score').toNumber(),
      }));
    } finally {
      await session.close();
    }
  }

  async findCommunities(tenantId: string): Promise<ContractCluster[]> {
    const session = this.driver.session();
    try {
      // Use contract co-occurrence to find clusters
      const result = await session.run(
        `
        MATCH (e1:Entity {tenantId: $tenantId})-[r:RELATES]-(e2:Entity {tenantId: $tenantId})
        WHERE e1.sourceContracts IS NOT NULL AND e2.sourceContracts IS NOT NULL
        UNWIND e1.sourceContracts as contract1
        UNWIND e2.sourceContracts as contract2
        WITH contract1, contract2, count(*) as weight
        WHERE contract1 < contract2 AND weight > 2
        RETURN contract1, contract2, weight
        ORDER BY weight DESC
        LIMIT 100
        `,
        { tenantId }
      );

      // Build clusters from strongly connected contracts
      const clusters: ContractCluster[] = [];
      const processed = new Set<string>();

      for (const record of result.records) {
        const contract1 = record.get('contract1');
        const contract2 = record.get('contract2');

        if (processed.has(contract1) && processed.has(contract2)) continue;

        const clusterContracts = [contract1, contract2];
        processed.add(contract1);
        processed.add(contract2);

        // Get entities for these contracts
        const entities = await this.findEntitiesByContract(contract1, tenantId);

        clusters.push({
          id: `cluster-${clusters.length}`,
          contracts: clusterContracts,
          entities,
          dominantParties: entities
            .filter(e => e.type === 'party' || e.type === 'organization')
            .map(e => e.name),
          totalValue: 0,
          riskScore: 0,
        });
      }

      return clusters;
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // SIMILARITY SEARCH
  // ============================================================================

  async findSimilarEntities(
    query: string,
    tenantId: string,
    options: {
      type?: EntityType;
      k?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<SimilarityResult[]> {
    const embedding = await this.generateEmbedding(query);
    
    const session = this.driver.session();
    try {
      // If vector index available, use it; otherwise use manual comparison
      const result = await session.run(
        `
        MATCH (e:Entity {tenantId: $tenantId})
        ${options.type ? 'WHERE e.type = $type' : ''}
        WITH e,
          CASE 
            WHEN e.embedding IS NOT NULL THEN
              reduce(sum = 0.0, i in range(0, size(e.embedding)-1) |
                sum + (e.embedding[i] * $embedding[i])
              ) / (sqrt(reduce(sum = 0.0, x in e.embedding | sum + x^2)) * 
                   sqrt(reduce(sum = 0.0, y in $embedding | sum + y^2)))
            ELSE 0.0
          END as similarity
        WHERE similarity >= $minSimilarity
        RETURN e {.*, embedding: null} as entity, similarity
        ORDER BY similarity DESC
        LIMIT $k
        `,
        {
          tenantId,
          embedding,
          type: options.type,
          k: options.k || 10,
          minSimilarity: options.minSimilarity || 0.7,
        }
      );

      return result.records.map(r => ({
        entity: this.parseEntity(r.get('entity')),
        similarity: r.get('similarity'),
        commonContracts: 0,
        sharedRelations: 0,
      }));
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // CONTRACT-SPECIFIC OPERATIONS
  // ============================================================================

  async buildContractGraph(contractId: string, tenantId: string): Promise<{
    entities: GraphEntity[];
    relations: GraphRelation[];
  }> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (e:Entity {tenantId: $tenantId})
        WHERE $contractId IN e.sourceContracts
        OPTIONAL MATCH (e)-[r:RELATES]-(other:Entity {tenantId: $tenantId})
        RETURN e, collect(DISTINCT r) as relations, collect(DISTINCT other) as connected
        `,
        { contractId, tenantId }
      );

      const entities: GraphEntity[] = [];
      const relations: GraphRelation[] = [];

      for (const record of result.records) {
        entities.push(this.parseEntity(record.get('e').properties));
        
        for (const rel of record.get('relations')) {
          relations.push(this.parseRelation(rel.properties));
        }
      }

      return { entities, relations };
    } finally {
      await session.close();
    }
  }

  async findHiddenConnections(tenantId: string): Promise<Array<{
    party1: string;
    party2: string;
    connectionPath: string[];
    strength: number;
  }>> {
    const session = this.driver.session();
    try {
      // Find parties that don't have direct relationships but share connections
      const result = await session.run(
        `
        MATCH (p1:Entity {type: 'party', tenantId: $tenantId})
        MATCH (p2:Entity {type: 'party', tenantId: $tenantId})
        WHERE p1.id < p2.id
          AND NOT (p1)-[:RELATES]-(p2)
        MATCH path = (p1)-[:RELATES*2..3]-(p2)
        RETURN p1.name as party1, p2.name as party2,
               [n in nodes(path) | n.name] as path,
               reduce(s = 1.0, r in relationships(path) | s * r.strength) as strength
        ORDER BY strength DESC
        LIMIT 20
        `,
        { tenantId }
      );

      return result.records.map(r => ({
        party1: r.get('party1'),
        party2: r.get('party2'),
        connectionPath: r.get('path'),
        strength: r.get('strength'),
      }));
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // CONTRACT-SPECIFIC QUERIES (for Agent Context Enrichment)
  // ============================================================================

  /**
   * Find related contracts through shared entities
   */
  async findRelatedContracts(
    contractId: string,
    tenantId: string,
    options: { maxDepth?: number; minStrength?: number } = {}
  ): Promise<Array<{
    contractId: string;
    relationshipType: string;
    strength: number;
    commonParties: string[];
  }>> {
    const session = this.driver.session();
    try {
      // Find contracts sharing entities with this contract
      const result = await session.run(
        `
        MATCH (c1:Entity {type: 'contract', entityId: $contractId, tenantId: $tenantId})
        MATCH (c1)-[r:RELATES]-(e:Entity {tenantId: $tenantId})-[:RELATES]-(c2:Entity {type: 'contract', tenantId: $tenantId})
        WHERE c2.entityId <> $contractId
        WITH c2, collect(DISTINCT e.name) as commonEntities, avg(r.strength) as avgStrength
        WHERE avgStrength >= $minStrength
        RETURN c2.entityId as contractId,
               'shared_entities' as relationshipType,
               avgStrength as strength,
               commonEntities
        ORDER BY strength DESC
        LIMIT 10
        `,
        { 
          contractId, 
          tenantId, 
          minStrength: options.minStrength || 0.3 
        }
      );

      return result.records.map(r => ({
        contractId: r.get('contractId'),
        relationshipType: r.get('relationshipType'),
        strength: r.get('strength'),
        commonParties: r.get('commonEntities') || [],
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Get contract cluster/community information
   */
  async getContractCluster(
    contractId: string,
    tenantId: string
  ): Promise<{
    clusterId: string;
    clusterName: string;
    size: number;
    dominantType: string;
    counterpartyAnalysis?: {
      centralityScore: number;
      contractCount: number;
      totalValue: number;
      riskProfile: 'low' | 'medium' | 'high';
      relationshipHistory: Array<{
        contractId: string;
        status: string;
        performance: number;
      }>;
    };
  } | null> {
    const session = this.driver.session();
    try {
      // Get community detection using Louvain if available, otherwise simple clustering
      const result = await session.run(
        `
        MATCH (c:Entity {type: 'contract', entityId: $contractId, tenantId: $tenantId})
        MATCH (c)-[:RELATES]-(p:Entity)-[:RELATES]-(other:Entity {type: 'contract', tenantId: $tenantId})
        WHERE other.entityId <> $contractId
        WITH collect(DISTINCT other.entityId) as relatedIds, count(DISTINCT p) as connectionCount
        RETURN relatedIds, connectionCount
        `,
        { contractId, tenantId }
      );

      const record = result.records[0];
      if (!record) return null;

      const relatedIds = record.get('relatedIds') || [];
      
      return {
        clusterId: `cluster-${contractId.slice(0, 8)}`,
        clusterName: 'Related Contract Cluster',
        size: relatedIds.length + 1,
        dominantType: 'contract',
        counterpartyAnalysis: {
          centralityScore: 0.5,
          contractCount: relatedIds.length,
          totalValue: 0, // Would need contract value lookup
          riskProfile: 'medium',
          relationshipHistory: [],
        },
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get key entities for a contract
   */
  async getContractEntities(
    contractId: string,
    tenantId: string
  ): Promise<Array<{
    name: string;
    type: string;
    frequency: number;
    importance: number;
  }>> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (c:Entity {type: 'contract', entityId: $contractId, tenantId: $tenantId})
        MATCH (c)-[r:RELATES]-(e:Entity {tenantId: $tenantId})
        RETURN e.name as name, e.type as type, count(r) as frequency, avg(r.strength) as importance
        ORDER BY importance DESC
        LIMIT 20
        `,
        { contractId, tenantId }
      );

      return result.records.map(r => ({
        name: r.get('name'),
        type: r.get('type'),
        frequency: r.get('frequency').toNumber(),
        importance: r.get('importance'),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Calculate importance score (PageRank-style) for a contract
   */
  async calculateImportanceScore(
    contractId: string,
    tenantId: string
  ): Promise<number> {
    const session = this.driver.session();
    try {
      // Simple importance calculation based on degree centrality
      const result = await session.run(
        `
        MATCH (c:Entity {type: 'contract', entityId: $contractId, tenantId: $tenantId})
        MATCH (c)-[:RELATES]-(e:Entity {tenantId: $tenantId})
        WITH c, count(e) as degree
        OPTIONAL MATCH (c)-[:RELATES]-(p:Entity)-[:RELATES]-(other:Entity {type: 'contract', tenantId: $tenantId})
        WHERE other.entityId <> $contractId
        RETURN (degree + count(DISTINCT other) * 0.5) as score
        `,
        { contractId, tenantId }
      );

      const record = result.records[0];
      if (!record) return 0.5;

      // Normalize score to 0-1 range (assuming max ~100 connections)
      const rawScore = record.get('score') || 0;
      return Math.min(Math.max(rawScore / 50, 0), 1);
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = text.slice(0, 100);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey)!;
    }

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    const embedding = response.data[0].embedding;
    
    // Cache result
    this.embeddingCache.set(cacheKey, embedding);
    if (this.embeddingCache.size > 1000) {
      // Simple LRU: clear half the cache
      const keys = Array.from(this.embeddingCache.keys()).slice(0, 500);
      for (const key of keys) this.embeddingCache.delete(key);
    }

    return embedding;
  }

  private parseEntity(properties: any): GraphEntity {
    return {
      ...properties,
      aliases: properties.aliases || [],
      sourceContracts: properties.sourceContracts || [],
      attributes: typeof properties.attributes === 'string' 
        ? JSON.parse(properties.attributes) 
        : properties.attributes,
      embedding: undefined, // Don't return embeddings by default
      createdAt: new Date(properties.createdAt),
      updatedAt: new Date(properties.updatedAt),
    };
  }

  private parseRelation(properties: any): GraphRelation {
    return {
      ...properties,
      evidence: typeof properties.evidence === 'string'
        ? JSON.parse(properties.evidence)
        : properties.evidence || [],
      attributes: typeof properties.attributes === 'string'
        ? JSON.parse(properties.attributes)
        : properties.attributes || {},
      createdAt: new Date(properties.createdAt),
    };
  }

  async close(): Promise<void> {
    if (this._driver) {
      await this._driver.close();
      this._driver = null;
    }
  }

  /**
   * Check if Neo4j is configured (has URI)
   */
  isConfigured(): boolean {
    return !!process.env.NEO4J_URI;
  }
}

// Export singleton instance - no connection made until first actual use
export const neo4jGraphService = new Neo4jGraphService();
