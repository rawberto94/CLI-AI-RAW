/**
 * Knowledge Graph Service (Phase 3)
 * 
 * Builds and queries a knowledge graph of contract entities and relationships
 * Uses Neo4j-style graph operations with in-memory fallback
 */

import pino from 'pino'

const logger = pino({ name: 'knowledge-graph-service' })

export interface GraphNode {
  id: string
  type: 'contract' | 'party' | 'clause' | 'term' | 'amount' | 'date'
  properties: Record<string, any>
  tenantId: string
}

export interface GraphRelationship {
  id: string
  type: string
  from: string
  to: string
  properties: Record<string, any>
  strength: number
}

export interface GraphQuery {
  nodeType?: string
  relationshipType?: string
  properties?: Record<string, any>
  depth?: number
  limit?: number
}

export class KnowledgeGraphService {
  private static instance: KnowledgeGraphService
  private nodes: Map<string, GraphNode> = new Map()
  private relationships: Map<string, GraphRelationship> = new Map()
  private nodeIndex: Map<string, Set<string>> = new Map() // tenantId -> nodeIds

  private constructor() {}

  static getInstance(): KnowledgeGraphService {
    if (!KnowledgeGraphService.instance) {
      KnowledgeGraphService.instance = new KnowledgeGraphService()
    }
    return KnowledgeGraphService.instance
  }

  /**
   * Extract entities from contract and build graph
   */
  async buildGraphFromContract(
    contractId: string,
    tenantId: string,
    artifacts: any[]
  ): Promise<{ nodesCreated: number; relationshipsCreated: number }> {
    let nodesCreated = 0
    let relationshipsCreated = 0

    try {
      // Create contract node
      const contractNode: GraphNode = {
        id: `contract:${contractId}`,
        type: 'contract',
        properties: {
          contractId,
          title: artifacts.find(a => a.type === 'title')?.content || 'Unknown',
          type: artifacts.find(a => a.type === 'contract_type')?.content || 'Unknown'
        },
        tenantId
      }
      this.addNode(contractNode)
      nodesCreated++

      // Extract and create party nodes
      const parties = artifacts.filter(a => a.type === 'parties')
      for (const party of parties) {
        const partyNode: GraphNode = {
          id: `party:${party.content}`,
          type: 'party',
          properties: { name: party.content },
          tenantId
        }
        this.addNode(partyNode)
        nodesCreated++

        // Create relationship
        this.addRelationship({
          id: `rel:${contractId}:${party.content}`,
          type: 'HAS_PARTY',
          from: contractNode.id,
          to: partyNode.id,
          properties: {},
          strength: 1.0
        })
        relationshipsCreated++
      }

      // Extract and create clause nodes
      const clauses = artifacts.filter(a => a.type === 'clause')
      for (const clause of clauses) {
        const clauseNode: GraphNode = {
          id: `clause:${contractId}:${clause.id}`,
          type: 'clause',
          properties: {
            content: clause.content,
            clauseType: clause.metadata?.clauseType || 'general'
          },
          tenantId
        }
        this.addNode(clauseNode)
        nodesCreated++

        this.addRelationship({
          id: `rel:${contractId}:clause:${clause.id}`,
          type: 'CONTAINS_CLAUSE',
          from: contractNode.id,
          to: clauseNode.id,
          properties: { clauseType: clause.metadata?.clauseType },
          strength: 0.9
        })
        relationshipsCreated++
      }

      // Extract amounts and dates
      const amounts = artifacts.filter(a => a.type === 'amount')
      for (const amount of amounts) {
        const amountNode: GraphNode = {
          id: `amount:${contractId}:${amount.id}`,
          type: 'amount',
          properties: { value: amount.content, currency: amount.metadata?.currency },
          tenantId
        }
        this.addNode(amountNode)
        nodesCreated++

        this.addRelationship({
          id: `rel:${contractId}:amount:${amount.id}`,
          type: 'HAS_AMOUNT',
          from: contractNode.id,
          to: amountNode.id,
          properties: {},
          strength: 0.8
        })
        relationshipsCreated++
      }

      logger.info({ contractId, nodesCreated, relationshipsCreated }, 'Graph built from contract')

      return { nodesCreated, relationshipsCreated }
    } catch (error) {
      logger.error({ error, contractId }, 'Failed to build graph')
      throw error
    }
  }

  /**
   * Query the graph
   */
  async query(tenantId: string, query: GraphQuery): Promise<GraphNode[]> {
    const tenantNodes = this.nodeIndex.get(tenantId) || new Set()
    let results: GraphNode[] = []

    for (const nodeId of tenantNodes) {
      const node = this.nodes.get(nodeId)
      if (!node) continue

      // Filter by type
      if (query.nodeType && node.type !== query.nodeType) continue

      // Filter by properties
      if (query.properties) {
        const matches = Object.entries(query.properties).every(
          ([key, value]) => node.properties[key] === value
        )
        if (!matches) continue
      }

      results.push(node)
    }

    return results.slice(0, query.limit || 100)
  }

  /**
   * Find related contracts
   */
  async findRelatedContracts(
    contractId: string,
    tenantId: string,
    depth: number = 2
  ): Promise<Array<{ contractId: string; relationshipPath: string[]; strength: number }>> {
    const contractNodeId = `contract:${contractId}`
    const visited = new Set<string>()
    const related: Array<{ contractId: string; relationshipPath: string[]; strength: number }> = []

    const traverse = (nodeId: string, path: string[], currentDepth: number, strength: number) => {
      if (currentDepth > depth || visited.has(nodeId)) return
      visited.add(nodeId)

      const relationships = Array.from(this.relationships.values()).filter(
        r => r.from === nodeId || r.to === nodeId
      )

      for (const rel of relationships) {
        const nextNodeId = rel.from === nodeId ? rel.to : rel.from
        const nextNode = this.nodes.get(nextNodeId)

        if (!nextNode || nextNode.tenantId !== tenantId) continue

        const newPath = [...path, rel.type]
        const newStrength = strength * rel.strength

        if (nextNode.type === 'contract' && nextNodeId !== contractNodeId) {
          related.push({
            contractId: nextNode.properties.contractId,
            relationshipPath: newPath,
            strength: newStrength
          })
        }

        traverse(nextNodeId, newPath, currentDepth + 1, newStrength)
      }
    }

    traverse(contractNodeId, [], 0, 1.0)

    return related.sort((a, b) => b.strength - a.strength).slice(0, 10)
  }

  /**
   * Find similar clauses across contracts
   */
  async findSimilarClauses(
    clauseContent: string,
    tenantId: string,
    threshold: number = 0.7
  ): Promise<Array<{ contractId: string; clause: string; similarity: number }>> {
    const clauseNodes = await this.query(tenantId, { nodeType: 'clause' })
    const similar: Array<{ contractId: string; clause: string; similarity: number }> = []

    for (const node of clauseNodes) {
      const similarity = this.calculateTextSimilarity(
        clauseContent,
        node.properties.content
      )

      if (similarity >= threshold) {
        // Find parent contract
        const contractRel = Array.from(this.relationships.values()).find(
          r => r.to === node.id && r.type === 'CONTAINS_CLAUSE'
        )

        if (contractRel) {
          const contractNode = this.nodes.get(contractRel.from)
          if (contractNode) {
            similar.push({
              contractId: contractNode.properties.contractId,
              clause: node.properties.content,
              similarity
            })
          }
        }
      }
    }

    return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 10)
  }

  /**
   * Get party network (all contracts for a party)
   */
  async getPartyNetwork(
    partyName: string,
    tenantId: string
  ): Promise<{
    party: string
    contracts: string[]
    totalValue: number
    relationships: Array<{ party: string; sharedContracts: number }>
  }> {
    const partyNodeId = `party:${partyName}`
    const partyNode = this.nodes.get(partyNodeId)

    if (!partyNode || partyNode.tenantId !== tenantId) {
      return { party: partyName, contracts: [], totalValue: 0, relationships: [] }
    }

    // Find all contracts for this party
    const contractRels = Array.from(this.relationships.values()).filter(
      r => r.to === partyNodeId && r.type === 'HAS_PARTY'
    )

    const contracts = contractRels
      .map(r => this.nodes.get(r.from))
      .filter(n => n && n.tenantId === tenantId)
      .map(n => n!.properties.contractId)

    // Calculate total value
    let totalValue = 0
    for (const contractId of contracts) {
      const amountRels = Array.from(this.relationships.values()).filter(
        r => r.from === `contract:${contractId}` && r.type === 'HAS_AMOUNT'
      )
      for (const rel of amountRels) {
        const amountNode = this.nodes.get(rel.to)
        if (amountNode) {
          totalValue += parseFloat(amountNode.properties.value) || 0
        }
      }
    }

    // Find related parties (parties that share contracts)
    const relatedParties = new Map<string, number>()
    for (const contractId of contracts) {
      const otherPartyRels = Array.from(this.relationships.values()).filter(
        r => r.from === `contract:${contractId}` && r.type === 'HAS_PARTY' && r.to !== partyNodeId
      )
      for (const rel of otherPartyRels) {
        const otherParty = this.nodes.get(rel.to)
        if (otherParty) {
          const count = relatedParties.get(otherParty.properties.name) || 0
          relatedParties.set(otherParty.properties.name, count + 1)
        }
      }
    }

    const relationships = Array.from(relatedParties.entries())
      .map(([party, sharedContracts]) => ({ party, sharedContracts }))
      .sort((a, b) => b.sharedContracts - a.sharedContracts)

    return { party: partyName, contracts, totalValue, relationships }
  }

  private addNode(node: GraphNode): void {
    this.nodes.set(node.id, node)
    
    if (!this.nodeIndex.has(node.tenantId)) {
      this.nodeIndex.set(node.tenantId, new Set())
    }
    this.nodeIndex.get(node.tenantId)!.add(node.id)
  }

  private addRelationship(rel: GraphRelationship): void {
    this.relationships.set(rel.id, rel)
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(w => words2.has(w)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }

  async getStats(tenantId: string): Promise<{
    totalNodes: number
    totalRelationships: number
    nodesByType: Record<string, number>
  }> {
    const tenantNodes = this.nodeIndex.get(tenantId) || new Set()
    const nodesByType: Record<string, number> = {}

    for (const nodeId of tenantNodes) {
      const node = this.nodes.get(nodeId)
      if (node) {
        nodesByType[node.type] = (nodesByType[node.type] || 0) + 1
      }
    }

    const tenantRelationships = Array.from(this.relationships.values()).filter(r => {
      const fromNode = this.nodes.get(r.from)
      return fromNode?.tenantId === tenantId
    })

    return {
      totalNodes: tenantNodes.size,
      totalRelationships: tenantRelationships.length,
      nodesByType
    }
  }
}

export const knowledgeGraphService = KnowledgeGraphService.getInstance()
