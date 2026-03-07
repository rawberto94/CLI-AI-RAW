/**
 * Knowledge Graph Service
 * Extends RAG with entity extraction and relationship mapping
 */

import { prisma } from '../lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================
// TYPES
// ============================================

export interface ExtractedEntity {
  type: 'company' | 'person' | 'clause' | 'obligation' | 'term' | 'location' | 'date';
  value: string;
  confidence: number;
  context: string;
  startChar: number;
  endChar: number;
}

export interface EntityRelationship {
  from: ExtractedEntity;
  to: ExtractedEntity;
  type: 'mentions' | 'obligates' | 'references' | 'depends_on' | 'similar_to' | 'conflicts_with';
  confidence: number;
  context: string;
}

export interface KnowledgeGraphNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, any>;
  contractIds: string[];
}

export interface KnowledgeGraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  weight: number;
  properties: Record<string, any>;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

// ============================================
// KNOWLEDGE GRAPH SERVICE
// ============================================

class KnowledgeGraphService {
  private static instance: KnowledgeGraphService;

  private constructor() {}

  public static getInstance(): KnowledgeGraphService {
    if (!KnowledgeGraphService.instance) {
      KnowledgeGraphService.instance = new KnowledgeGraphService();
    }
    return KnowledgeGraphService.instance;
  }

  // ============================================
  // ENTITY EXTRACTION
  // ============================================

  async extractEntities(text: string, contractId: string): Promise<ExtractedEntity[]> {
    const prompt = `Extract structured entities from this contract text. Identify:
- Companies (suppliers, clients, partners)
- People (signatories, contacts, stakeholders)
- Key clauses (termination, liability, indemnification, payment terms)
- Obligations (deliverables, commitments, requirements)
- Important terms (renewal dates, notice periods, values)
- Locations (jurisdiction, governing law)

Text:
${text.substring(0, 3000)}

Return JSON array with format:
[{
  "type": "company|person|clause|obligation|term|location|date",
  "value": "entity name",
  "confidence": 0-1,
  "context": "surrounding text",
  "startChar": number,
  "endChar": number
}]`;

    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0];
      if (content.type !== 'text') return [];

      // Extract JSON from response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const entities: ExtractedEntity[] = JSON.parse(jsonMatch[0]);

      // Store entities in database
      await this.storeEntities(entities, contractId);

      return entities;
    } catch {
      return [];
    }
  }

  private async storeEntities(entities: ExtractedEntity[], contractId: string): Promise<void> {
    // Store in contract metadata or separate entities table
    // For now, store as JSON in contract metadata
    try {
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          metadata: {
            entities: entities as any,
            extractedAt: new Date().toISOString(),
          } as any,
        },
      });
    } catch {
      // Silently handle entity storage errors
    }
  }

  // ============================================
  // RELATIONSHIP EXTRACTION
  // ============================================

  async extractRelationships(
    entities: ExtractedEntity[],
    text: string
  ): Promise<EntityRelationship[]> {
    const relationships: EntityRelationship[] = [];

    // Find co-occurrences and contextual relationships
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];

        // Check if entities appear near each other (within 200 chars)
        const distance = Math.abs(entity1.startChar - entity2.startChar);
        if (distance < 200) {
          const relationshipType = this.inferRelationshipType(entity1, entity2, text);
          if (relationshipType) {
            relationships.push({
              from: entity1,
              to: entity2,
              type: relationshipType,
              confidence: 0.7,
              context: text.substring(
                Math.min(entity1.startChar, entity2.startChar),
                Math.max(entity1.endChar, entity2.endChar)
              ),
            });
          }
        }
      }
    }

    return relationships;
  }

  private inferRelationshipType(
    entity1: ExtractedEntity,
    entity2: ExtractedEntity,
    text: string
  ): EntityRelationship['type'] | null {
    const context = text
      .substring(
        Math.min(entity1.startChar, entity2.startChar) - 50,
        Math.max(entity1.endChar, entity2.endChar) + 50
      )
      .toLowerCase();

    // Company-Person relationships
    if (entity1.type === 'company' && entity2.type === 'person') {
      if (context.includes('represent') || context.includes('behalf')) {
        return 'mentions';
      }
    }

    // Company-Clause relationships
    if (entity1.type === 'company' && entity2.type === 'clause') {
      return 'references';
    }

    // Clause-Obligation relationships
    if (entity1.type === 'clause' && entity2.type === 'obligation') {
      return 'obligates';
    }

    // Default: they mention each other
    return 'mentions';
  }

  // ============================================
  // KNOWLEDGE GRAPH CONSTRUCTION
  // ============================================

  async buildKnowledgeGraph(tenantId: string, contractIds?: string[]): Promise<KnowledgeGraph> {
    const where: any = { tenantId };
    if (contractIds && contractIds.length > 0) {
      where.id = { in: contractIds };
    }

    // Fetch contracts with metadata
    const contracts = await prisma.contract.findMany({
      where,
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        supplierName: true,
        metadata: true,
      },
    });

    const nodes: KnowledgeGraphNode[] = [];
    const edges: KnowledgeGraphEdge[] = [];
    const nodeMap = new Map<string, KnowledgeGraphNode>();

    // Build nodes from entities
    contracts.forEach((contract) => {
      const metadata = contract.metadata as any;
      const entities = metadata?.entities as ExtractedEntity[] || [];

      entities.forEach((entity) => {
        const nodeKey = `${entity.type}-${entity.value}`;
        
        if (!nodeMap.has(nodeKey)) {
          const node: KnowledgeGraphNode = {
            id: nodeKey,
            type: entity.type,
            label: entity.value,
            properties: {
              confidence: entity.confidence,
            },
            contractIds: [contract.id],
          };
          nodeMap.set(nodeKey, node);
        } else {
          // Entity appears in multiple contracts
          const node = nodeMap.get(nodeKey)!;
          if (!node.contractIds.includes(contract.id)) {
            node.contractIds.push(contract.id);
          }
        }
      });
    });

    nodes.push(...Array.from(nodeMap.values()));

    // Build edges from supplier relationships
    contracts.forEach((contract) => {
      if (contract.supplierName) {
        const supplierKey = `company-${contract.supplierName}`;
        const contractKey = `contract-${contract.id}`;

        // Create contract node if not exists
        if (!nodeMap.has(contractKey)) {
          const contractNode: KnowledgeGraphNode = {
            id: contractKey,
            type: 'contract',
            label: contract.contractTitle || contract.fileName || 'Untitled',
            properties: {},
            contractIds: [contract.id],
          };
          nodeMap.set(contractKey, contractNode);
          nodes.push(contractNode);
        }

        // Create edge from supplier to contract
        if (nodeMap.has(supplierKey)) {
          edges.push({
            id: `${supplierKey}-${contractKey}`,
            from: supplierKey,
            to: contractKey,
            type: 'has_contract',
            weight: 1,
            properties: {},
          });
        }
      }
    });

    // Find similar clauses across contracts
    const clauseNodes = nodes.filter((n) => n.type === 'clause');
    for (let i = 0; i < clauseNodes.length; i++) {
      for (let j = i + 1; j < clauseNodes.length; j++) {
        const similarity = this.calculateTextSimilarity(clauseNodes[i].label, clauseNodes[j].label);
        if (similarity > 0.7) {
          edges.push({
            id: `${clauseNodes[i].id}-${clauseNodes[j].id}`,
            from: clauseNodes[i].id,
            to: clauseNodes[j].id,
            type: 'similar_to',
            weight: similarity,
            properties: { similarity },
          });
        }
      }
    }

    return { nodes, edges };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  // ============================================
  // GRAPH QUERIES
  // ============================================

  async findRelatedContracts(
    tenantId: string,
    entityValue: string,
    maxDepth: number = 2
  ): Promise<string[]> {
    // Find contracts that mention this entity
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        OR: [
          { supplierName: { contains: entityValue, mode: 'insensitive' } },
          { contractTitle: { contains: entityValue, mode: 'insensitive' } },
          { description: { contains: entityValue, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    return contracts.map((c) => c.id);
  }

  async findSimilarClauses(
    tenantId: string,
    clauseText: string,
    minSimilarity: number = 0.7
  ): Promise<Array<{ contractId: string; clause: string; similarity: number }>> {
    // This would ideally use vector similarity search
    // For now, return empty array - would need pgvector or similar
    return [];
  }

  async getEntityNetwork(
    tenantId: string,
    entityValue: string
  ): Promise<{ entity: string; relatedEntities: Array<{ entity: string; relationship: string; count: number }> }> {
    const contracts = await prisma.contract.findMany({
      where: {
        tenantId,
        OR: [
          { supplierName: { contains: entityValue, mode: 'insensitive' } },
          { contractTitle: { contains: entityValue, mode: 'insensitive' } },
        ],
      },
      select: {
        metadata: true,
        supplierName: true,
      },
    });

    const relatedEntities = new Map<string, { relationship: string; count: number }>();

    contracts.forEach((contract) => {
      // Extract related entities from metadata
      const metadata = contract.metadata as any;
      const entities = metadata?.entities as ExtractedEntity[] || [];

      entities.forEach((entity) => {
        if (entity.value !== entityValue) {
          const key = entity.value;
          if (!relatedEntities.has(key)) {
            relatedEntities.set(key, { relationship: 'co_occurs', count: 0 });
          }
          relatedEntities.get(key)!.count++;
        }
      });
    });

    return {
      entity: entityValue,
      relatedEntities: Array.from(relatedEntities.entries())
        .map(([entity, data]) => ({ entity, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }
}

export const knowledgeGraphService = KnowledgeGraphService.getInstance();
