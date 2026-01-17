/**
 * Contract Knowledge Graph Service
 * 
 * Build and query a semantic knowledge graph of contracts:
 * - Entity extraction (parties, locations, products)
 * - Relationship mapping between contracts
 * - Clause-level semantic linking
 * - Cross-contract dependency tracking
 * - Graph-based recommendations
 * 
 * @version 1.0.0
 */

import { randomUUID } from 'crypto';

// Types
export type EntityType = 
  | 'party'
  | 'person'
  | 'organization'
  | 'location'
  | 'product'
  | 'service'
  | 'date'
  | 'currency'
  | 'clause'
  | 'term'
  | 'obligation'
  | 'right';

export type RelationType =
  | 'party_to'
  | 'references'
  | 'supersedes'
  | 'amends'
  | 'renews'
  | 'related_to'
  | 'depends_on'
  | 'conflicts_with'
  | 'similar_to'
  | 'parent_of'
  | 'child_of'
  | 'linked_clause'
  | 'provides_service'
  | 'receives_service'
  | 'obligates'
  | 'grants_right';

export interface GraphEntity {
  id: string;
  type: EntityType;
  name: string;
  normalizedName: string;
  aliases: string[];
  attributes: Record<string, unknown>;
  sourceContracts: string[];
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GraphRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  strength: number; // 0-1
  attributes: Record<string, unknown>;
  evidence: RelationEvidence[];
  createdAt: Date;
}

export interface RelationEvidence {
  contractId: string;
  excerpt: string;
  page?: number;
  section?: string;
  confidence: number;
}

export interface GraphNode {
  entity: GraphEntity;
  inboundRelations: GraphRelation[];
  outboundRelations: GraphRelation[];
  degree: number;
  centrality: number;
}

export interface SubGraph {
  entities: GraphEntity[];
  relations: GraphRelation[];
  rootEntityId: string;
  depth: number;
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
  densestNodes: { entityId: string; name: string; degree: number }[];
  clusters: { id: string; size: number; dominantType: EntityType }[];
}

export interface GraphQuery {
  entityTypes?: EntityType[];
  relationTypes?: RelationType[];
  contractIds?: string[];
  namePattern?: string;
  minConfidence?: number;
  limit?: number;
}

export interface SimilarEntityResult {
  entity: GraphEntity;
  similarity: number;
  commonContracts: number;
  sharedRelations: number;
}

class ContractKnowledgeGraphService {
  private entities: Map<string, GraphEntity> = new Map();
  private relations: Map<string, GraphRelation> = new Map();
  private entityIndex: Map<string, Set<string>> = new Map(); // normalized name -> entity ids
  private contractEntities: Map<string, Set<string>> = new Map(); // contract id -> entity ids
  private contractRelations: Map<string, Set<string>> = new Map(); // contract id -> relation ids

  /**
   * Add or update an entity in the graph
   */
  addEntity(
    entity: Omit<GraphEntity, 'id' | 'normalizedName' | 'createdAt' | 'updatedAt'>
  ): GraphEntity {
    const normalizedName = this.normalizeName(entity.name);
    
    // Check for existing entity with same normalized name and type
    const existingIds = this.entityIndex.get(normalizedName);
    if (existingIds) {
      for (const id of existingIds) {
        const existing = this.entities.get(id);
        if (existing && existing.type === entity.type) {
          // Merge with existing entity
          return this.mergeEntity(existing, entity);
        }
      }
    }

    // Create new entity
    const id = randomUUID();
    const now = new Date();
    const newEntity: GraphEntity = {
      id,
      normalizedName,
      createdAt: now,
      updatedAt: now,
      ...entity,
    };

    this.entities.set(id, newEntity);

    // Index by normalized name
    if (!this.entityIndex.has(normalizedName)) {
      this.entityIndex.set(normalizedName, new Set());
    }
    this.entityIndex.get(normalizedName)!.add(id);

    // Index by contract
    for (const contractId of entity.sourceContracts) {
      if (!this.contractEntities.has(contractId)) {
        this.contractEntities.set(contractId, new Set());
      }
      this.contractEntities.get(contractId)!.add(id);
    }

    return newEntity;
  }

  /**
   * Add a relation between entities
   */
  addRelation(
    relation: Omit<GraphRelation, 'id' | 'createdAt'>
  ): GraphRelation {
    // Check for existing relation
    const existingKey = `${relation.sourceId}:${relation.targetId}:${relation.type}`;
    for (const [id, existing] of this.relations) {
      const key = `${existing.sourceId}:${existing.targetId}:${existing.type}`;
      if (key === existingKey) {
        // Merge evidence
        return this.mergeRelation(existing, relation);
      }
    }

    const id = randomUUID();
    const newRelation: GraphRelation = {
      id,
      createdAt: new Date(),
      ...relation,
    };

    this.relations.set(id, newRelation);

    // Index by contract
    for (const evidence of relation.evidence) {
      if (!this.contractRelations.has(evidence.contractId)) {
        this.contractRelations.set(evidence.contractId, new Set());
      }
      this.contractRelations.get(evidence.contractId)!.add(id);
    }

    return newRelation;
  }

  /**
   * Extract and add entities from contract artifacts
   */
  async extractFromContract(
    contractId: string,
    artifacts: Record<string, unknown>
  ): Promise<{ entities: GraphEntity[]; relations: GraphRelation[] }> {
    const extractedEntities: GraphEntity[] = [];
    const extractedRelations: GraphRelation[] = [];

    // Extract parties
    const parties = this.extractParties(artifacts);
    for (const party of parties) {
      const entity = this.addEntity({
        type: party.type as EntityType,
        name: party.name,
        aliases: party.aliases || [],
        attributes: party.attributes || {},
        sourceContracts: [contractId],
        confidence: party.confidence || 0.9,
      });
      extractedEntities.push(entity);
    }

    // Extract locations
    const locations = this.extractLocations(artifacts);
    for (const loc of locations) {
      const entity = this.addEntity({
        type: 'location',
        name: loc.name,
        aliases: [],
        attributes: { address: loc.address, jurisdiction: loc.jurisdiction },
        sourceContracts: [contractId],
        confidence: loc.confidence || 0.85,
      });
      extractedEntities.push(entity);
    }

    // Extract obligations
    const obligations = this.extractObligations(artifacts);
    for (const obl of obligations) {
      const entity = this.addEntity({
        type: 'obligation',
        name: obl.description.substring(0, 100),
        aliases: [],
        attributes: { 
          fullDescription: obl.description,
          dueDate: obl.dueDate,
          frequency: obl.frequency,
          responsible: obl.responsible,
        },
        sourceContracts: [contractId],
        confidence: obl.confidence || 0.8,
      });
      extractedEntities.push(entity);
    }

    // Create party relations
    if (extractedEntities.length >= 2) {
      const parties = extractedEntities.filter(e => 
        e.type === 'party' || e.type === 'organization' || e.type === 'person'
      );
      
      for (let i = 0; i < parties.length - 1; i++) {
        for (let j = i + 1; j < parties.length; j++) {
          const relation = this.addRelation({
            sourceId: parties[i].id,
            targetId: parties[j].id,
            type: 'party_to',
            strength: 1.0,
            attributes: { contractId },
            evidence: [{
              contractId,
              excerpt: `Parties to the same contract`,
              confidence: 0.95,
            }],
          });
          extractedRelations.push(relation);
        }
      }
    }

    return { entities: extractedEntities, relations: extractedRelations };
  }

  /**
   * Find path between two entities
   */
  findPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5
  ): PathResult | null {
    const visited = new Set<string>();
    const queue: { entityId: string; path: GraphEntity[]; relations: GraphRelation[] }[] = [];

    const source = this.entities.get(sourceId);
    if (!source) return null;

    queue.push({ entityId: sourceId, path: [source], relations: [] });

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.entityId === targetId) {
        const totalStrength = current.relations.reduce((sum, r) => sum + r.strength, 0) / 
          (current.relations.length || 1);
        return {
          path: current.path,
          relations: current.relations,
          totalStrength,
          length: current.path.length - 1,
        };
      }

      if (current.path.length > maxDepth) continue;
      if (visited.has(current.entityId)) continue;
      visited.add(current.entityId);

      // Get outbound relations
      const outbound = Array.from(this.relations.values())
        .filter(r => r.sourceId === current.entityId);

      for (const relation of outbound) {
        const nextEntity = this.entities.get(relation.targetId);
        if (nextEntity && !visited.has(relation.targetId)) {
          queue.push({
            entityId: relation.targetId,
            path: [...current.path, nextEntity],
            relations: [...current.relations, relation],
          });
        }
      }

      // Get inbound relations (bidirectional search)
      const inbound = Array.from(this.relations.values())
        .filter(r => r.targetId === current.entityId);

      for (const relation of inbound) {
        const nextEntity = this.entities.get(relation.sourceId);
        if (nextEntity && !visited.has(relation.sourceId)) {
          queue.push({
            entityId: relation.sourceId,
            path: [...current.path, nextEntity],
            relations: [...current.relations, relation],
          });
        }
      }
    }

    return null;
  }

  /**
   * Get subgraph around an entity
   */
  getSubGraph(entityId: string, depth: number = 2): SubGraph | null {
    const rootEntity = this.entities.get(entityId);
    if (!rootEntity) return null;

    const entities = new Map<string, GraphEntity>();
    const relations = new Set<GraphRelation>();
    const visited = new Set<string>();

    const explore = (id: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);

      const entity = this.entities.get(id);
      if (entity) {
        entities.set(id, entity);
      }

      // Get connected relations
      for (const relation of this.relations.values()) {
        if (relation.sourceId === id || relation.targetId === id) {
          relations.add(relation);
          
          if (currentDepth < depth) {
            const nextId = relation.sourceId === id ? relation.targetId : relation.sourceId;
            explore(nextId, currentDepth + 1);
          }
        }
      }
    };

    explore(entityId, 0);

    return {
      entities: Array.from(entities.values()),
      relations: Array.from(relations),
      rootEntityId: entityId,
      depth,
    };
  }

  /**
   * Find similar entities
   */
  findSimilarEntities(
    entityId: string,
    limit: number = 10
  ): SimilarEntityResult[] {
    const entity = this.entities.get(entityId);
    if (!entity) return [];

    const results: SimilarEntityResult[] = [];

    for (const [id, other] of this.entities) {
      if (id === entityId) continue;
      if (other.type !== entity.type) continue;

      // Calculate similarity based on name, contracts, and relations
      const nameSimilarity = this.calculateNameSimilarity(entity.name, other.name);
      
      const commonContracts = entity.sourceContracts.filter(c => 
        other.sourceContracts.includes(c)
      ).length;

      const entityRelations = new Set(
        Array.from(this.relations.values())
          .filter(r => r.sourceId === entityId || r.targetId === entityId)
          .map(r => r.sourceId === entityId ? r.targetId : r.sourceId)
      );

      const otherRelations = new Set(
        Array.from(this.relations.values())
          .filter(r => r.sourceId === id || r.targetId === id)
          .map(r => r.sourceId === id ? r.targetId : r.sourceId)
      );

      const sharedRelations = Array.from(entityRelations).filter(r => 
        otherRelations.has(r)
      ).length;

      const similarity = 
        nameSimilarity * 0.4 + 
        (commonContracts / Math.max(entity.sourceContracts.length, 1)) * 0.3 +
        (sharedRelations / Math.max(entityRelations.size, 1)) * 0.3;

      if (similarity > 0.1) {
        results.push({
          entity: other,
          similarity,
          commonContracts,
          sharedRelations,
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Query the knowledge graph
   */
  query(q: GraphQuery): { entities: GraphEntity[]; relations: GraphRelation[] } {
    let entities = Array.from(this.entities.values());
    let relations = Array.from(this.relations.values());

    // Filter entities
    if (q.entityTypes && q.entityTypes.length > 0) {
      entities = entities.filter(e => q.entityTypes!.includes(e.type));
    }

    if (q.contractIds && q.contractIds.length > 0) {
      entities = entities.filter(e => 
        e.sourceContracts.some(c => q.contractIds!.includes(c))
      );
    }

    if (q.namePattern) {
      const pattern = new RegExp(q.namePattern, 'i');
      entities = entities.filter(e => 
        pattern.test(e.name) || e.aliases.some(a => pattern.test(a))
      );
    }

    if (q.minConfidence !== undefined) {
      entities = entities.filter(e => e.confidence >= q.minConfidence!);
    }

    // Filter relations
    if (q.relationTypes && q.relationTypes.length > 0) {
      relations = relations.filter(r => q.relationTypes!.includes(r.type));
    }

    // Get entity IDs for relation filtering
    const entityIds = new Set(entities.map(e => e.id));
    relations = relations.filter(r => 
      entityIds.has(r.sourceId) && entityIds.has(r.targetId)
    );

    // Apply limit
    if (q.limit) {
      entities = entities.slice(0, q.limit);
    }

    return { entities, relations };
  }

  /**
   * Get graph statistics
   */
  getStats(): GraphStats {
    const byEntityType: Record<string, number> = {};
    const byRelationType: Record<string, number> = {};
    const degrees: Map<string, number> = new Map();

    // Count entity types
    for (const entity of this.entities.values()) {
      byEntityType[entity.type] = (byEntityType[entity.type] || 0) + 1;
      degrees.set(entity.id, 0);
    }

    // Count relation types and calculate degrees
    for (const relation of this.relations.values()) {
      byRelationType[relation.type] = (byRelationType[relation.type] || 0) + 1;
      degrees.set(relation.sourceId, (degrees.get(relation.sourceId) || 0) + 1);
      degrees.set(relation.targetId, (degrees.get(relation.targetId) || 0) + 1);
    }

    // Calculate average degree
    const degreeValues = Array.from(degrees.values());
    const avgDegree = degreeValues.length > 0 
      ? degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length 
      : 0;

    // Find densest nodes
    const densestNodes = Array.from(degrees.entries())
      .map(([id, degree]) => ({
        entityId: id,
        name: this.entities.get(id)?.name || '',
        degree,
      }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 10);

    return {
      totalEntities: this.entities.size,
      totalRelations: this.relations.size,
      byEntityType: byEntityType as Record<EntityType, number>,
      byRelationType: byRelationType as Record<RelationType, number>,
      avgDegree,
      densestNodes,
      clusters: [], // Simplified - would need community detection algorithm
    };
  }

  /**
   * Get entities for a contract
   */
  getContractEntities(contractId: string): GraphEntity[] {
    const entityIds = this.contractEntities.get(contractId);
    if (!entityIds) return [];

    return Array.from(entityIds)
      .map(id => this.entities.get(id)!)
      .filter(e => e !== undefined);
  }

  /**
   * Link contracts by shared entities
   */
  linkContracts(contractId1: string, contractId2: string): {
    sharedEntities: GraphEntity[];
    impliedRelation: RelationType;
    strength: number;
  } {
    const entities1 = new Set(this.contractEntities.get(contractId1) || []);
    const entities2 = new Set(this.contractEntities.get(contractId2) || []);

    const sharedIds = Array.from(entities1).filter(id => entities2.has(id));
    const sharedEntities = sharedIds
      .map(id => this.entities.get(id)!)
      .filter(e => e !== undefined);

    // Determine implied relation type based on shared entities
    let impliedRelation: RelationType = 'related_to';
    const sharedParties = sharedEntities.filter(e => 
      e.type === 'party' || e.type === 'organization'
    );

    if (sharedParties.length > 0) {
      impliedRelation = 'party_to';
    }

    const strength = sharedEntities.length / 
      Math.max(entities1.size, entities2.size, 1);

    return {
      sharedEntities,
      impliedRelation,
      strength,
    };
  }

  // Private helper methods

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mergeEntity(
    existing: GraphEntity,
    newData: Omit<GraphEntity, 'id' | 'normalizedName' | 'createdAt' | 'updatedAt'>
  ): GraphEntity {
    // Merge aliases
    const allAliases = new Set([...existing.aliases, ...newData.aliases, newData.name]);
    allAliases.delete(existing.name);

    // Merge source contracts
    const allContracts = new Set([...existing.sourceContracts, ...newData.sourceContracts]);

    // Update confidence (weighted average)
    const newConfidence = 
      (existing.confidence * existing.sourceContracts.length + newData.confidence) /
      (existing.sourceContracts.length + 1);

    existing.aliases = Array.from(allAliases);
    existing.sourceContracts = Array.from(allContracts);
    existing.attributes = { ...existing.attributes, ...newData.attributes };
    existing.confidence = newConfidence;
    existing.updatedAt = new Date();

    return existing;
  }

  private mergeRelation(
    existing: GraphRelation,
    newData: Omit<GraphRelation, 'id' | 'createdAt'>
  ): GraphRelation {
    // Merge evidence
    const existingExcerpts = new Set(existing.evidence.map(e => e.excerpt));
    for (const e of newData.evidence) {
      if (!existingExcerpts.has(e.excerpt)) {
        existing.evidence.push(e);
      }
    }

    // Update strength (max)
    existing.strength = Math.max(existing.strength, newData.strength);

    // Merge attributes
    existing.attributes = { ...existing.attributes, ...newData.attributes };

    return existing;
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    const n1 = this.normalizeName(name1);
    const n2 = this.normalizeName(name2);

    if (n1 === n2) return 1.0;
    if (n1.includes(n2) || n2.includes(n1)) return 0.8;

    // Simple Jaccard similarity on words
    const words1 = new Set(n1.split(' '));
    const words2 = new Set(n2.split(' '));
    const intersection = Array.from(words1).filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;

    return union > 0 ? intersection / union : 0;
  }

  private extractParties(artifacts: Record<string, unknown>): any[] {
    const parties: any[] = [];
    const overview = artifacts['overview'] || artifacts['OVERVIEW'];
    
    if (overview && typeof overview === 'object') {
      const o = overview as any;
      if (o.clientName) {
        parties.push({
          type: 'organization',
          name: o.clientName,
          confidence: o.clientConfidence || 0.9,
        });
      }
      if (o.vendorName || o.supplierName) {
        parties.push({
          type: 'organization',
          name: o.vendorName || o.supplierName,
          confidence: o.vendorConfidence || 0.9,
        });
      }
    }

    return parties;
  }

  private extractLocations(artifacts: Record<string, unknown>): any[] {
    const locations: any[] = [];
    const overview = artifacts['overview'] || artifacts['OVERVIEW'];
    
    if (overview && typeof overview === 'object') {
      const o = overview as any;
      if (o.governingLaw) {
        locations.push({
          name: o.governingLaw,
          jurisdiction: o.governingLaw,
          confidence: 0.85,
        });
      }
    }

    return locations;
  }

  private extractObligations(artifacts: Record<string, unknown>): any[] {
    const obligations: any[] = [];
    const clauses = artifacts['clauses'] || artifacts['CLAUSES'];
    
    if (clauses && Array.isArray(clauses)) {
      for (const clause of clauses as any[]) {
        if (clause.obligations) {
          obligations.push(...clause.obligations.map((o: any) => ({
            description: o.description || o.text || '',
            dueDate: o.dueDate,
            frequency: o.frequency,
            responsible: o.responsible || o.party,
            confidence: o.confidence || 0.8,
          })));
        }
      }
    }

    return obligations;
  }
}

// Export singleton
export const contractKnowledgeGraphService = new ContractKnowledgeGraphService();
export { ContractKnowledgeGraphService };
