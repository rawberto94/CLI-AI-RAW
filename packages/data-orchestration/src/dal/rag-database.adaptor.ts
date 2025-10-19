/**
 * RAG Database Adaptor
 * 
 * Provides database persistence for RAG services
 */

import { PrismaClient } from '@prisma/client'
import pino from 'pino'

const logger = pino({ name: 'rag-database-adaptor' })

export class RAGDatabaseAdaptor {
  private static instance: RAGDatabaseAdaptor
  private prisma: PrismaClient

  private constructor() {
    this.prisma = new PrismaClient()
  }

  static getInstance(): RAGDatabaseAdaptor {
    if (!RAGDatabaseAdaptor.instance) {
      RAGDatabaseAdaptor.instance = new RAGDatabaseAdaptor()
    }
    return RAGDatabaseAdaptor.instance
  }

  // ============================================================================
  // KNOWLEDGE GRAPH PERSISTENCE
  // ============================================================================

  async saveGraphNode(node: {
    id: string
    nodeType: string
    tenantId: string
    properties: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_graph_nodes (id, node_type, tenant_id, properties)
      VALUES (${node.id}, ${node.nodeType}, ${node.tenantId}, ${JSON.stringify(node.properties)})
      ON DUPLICATE KEY UPDATE
        properties = ${JSON.stringify(node.properties)},
        updated_at = CURRENT_TIMESTAMP
    `
  }

  async saveGraphRelationship(rel: {
    id: string
    relationshipType: string
    fromNodeId: string
    toNodeId: string
    strength: number
    properties: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_graph_relationships (id, relationship_type, from_node_id, to_node_id, strength, properties)
      VALUES (${rel.id}, ${rel.relationshipType}, ${rel.fromNodeId}, ${rel.toNodeId}, ${rel.strength}, ${JSON.stringify(rel.properties)})
      ON DUPLICATE KEY UPDATE
        strength = ${rel.strength},
        properties = ${JSON.stringify(rel.properties)}
    `
  }

  async getGraphNodes(tenantId: string, nodeType?: string): Promise<any[]> {
    if (nodeType) {
      return this.prisma.$queryRaw`
        SELECT * FROM rag_graph_nodes
        WHERE tenant_id = ${tenantId} AND node_type = ${nodeType}
      `
    }
    return this.prisma.$queryRaw`
      SELECT * FROM rag_graph_nodes
      WHERE tenant_id = ${tenantId}
    `
  }

  async getGraphRelationships(nodeId: string): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT * FROM rag_graph_relationships
      WHERE from_node_id = ${nodeId} OR to_node_id = ${nodeId}
    `
  }

  // ============================================================================
  // LEARNING SYSTEM PERSISTENCE
  // ============================================================================

  async saveFeedback(feedback: {
    id: string
    conversationId: string
    query: string
    response: string
    rating: string
    userId: string
    tenantId: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_feedback (id, conversation_id, query, response, rating, user_id, tenant_id, metadata)
      VALUES (${feedback.id}, ${feedback.conversationId}, ${feedback.query}, ${feedback.response}, 
              ${feedback.rating}, ${feedback.userId}, ${feedback.tenantId}, ${JSON.stringify(feedback.metadata || {})})
    `
  }

  async saveInteraction(interaction: {
    id: string
    queryId: string
    query: string
    responseTime: number
    relevanceScore: number
    clicked: boolean
    timeSpent: number
    followUpQuestions: number
    sourcesCount: number
    confidence: number
    tenantId: string
    userId?: string
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_interactions 
      (id, query_id, query, response_time, relevance_score, clicked, time_spent, 
       follow_up_questions, sources_count, confidence, tenant_id, user_id)
      VALUES (${interaction.id}, ${interaction.queryId}, ${interaction.query}, ${interaction.responseTime},
              ${interaction.relevanceScore}, ${interaction.clicked}, ${interaction.timeSpent},
              ${interaction.followUpQuestions}, ${interaction.sourcesCount}, ${interaction.confidence},
              ${interaction.tenantId}, ${interaction.userId || null})
    `
  }

  async getFeedback(tenantId: string, limit: number = 100): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT * FROM rag_feedback
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  }

  async getInteractions(tenantId: string, limit: number = 100): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT * FROM rag_interactions
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  }

  // ============================================================================
  // OBSERVABILITY PERSISTENCE
  // ============================================================================

  async saveTrace(trace: {
    traceId: string
    operation: string
    tenantId: string
    userId?: string
    startTime: Date
    endTime?: Date
    duration?: number
    status: string
    query?: string
    retrievalResults?: number
    tokensUsed?: number
    cost?: number
    errorMessage?: string
    errorStack?: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_traces 
      (trace_id, operation, tenant_id, user_id, start_time, end_time, duration, status,
       query, retrieval_results, tokens_used, cost, error_message, error_stack, metadata)
      VALUES (${trace.traceId}, ${trace.operation}, ${trace.tenantId}, ${trace.userId || null},
              ${trace.startTime}, ${trace.endTime || null}, ${trace.duration || null}, ${trace.status},
              ${trace.query || null}, ${trace.retrievalResults || null}, ${trace.tokensUsed || null},
              ${trace.cost || null}, ${trace.errorMessage || null}, ${trace.errorStack || null},
              ${JSON.stringify(trace.metadata || {})})
      ON DUPLICATE KEY UPDATE
        end_time = ${trace.endTime || null},
        duration = ${trace.duration || null},
        status = ${trace.status},
        error_message = ${trace.errorMessage || null},
        error_stack = ${trace.errorStack || null}
    `
  }

  async saveTraceStep(step: {
    id: string
    traceId: string
    stepName: string
    startTime: Date
    endTime: Date
    duration: number
    status: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_trace_steps (id, trace_id, step_name, start_time, end_time, duration, status, metadata)
      VALUES (${step.id}, ${step.traceId}, ${step.stepName}, ${step.startTime}, ${step.endTime},
              ${step.duration}, ${step.status}, ${JSON.stringify(step.metadata || {})})
    `
  }

  async saveMetrics(metrics: {
    id: string
    tenantId: string
    metricType: string
    timePeriod: string
    timestamp: Date
    p50Latency?: number
    p95Latency?: number
    p99Latency?: number
    avgLatency?: number
    relevanceScore?: number
    confidenceScore?: number
    userSatisfaction?: number
    totalCost?: number
    costPerQuery?: number
    tokensUsed?: number
    totalErrors?: number
    errorRate?: number
    totalQueries?: number
    uniqueUsers?: number
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_metrics 
      (id, tenant_id, metric_type, time_period, timestamp, p50_latency, p95_latency, p99_latency,
       avg_latency, relevance_score, confidence_score, user_satisfaction, total_cost, cost_per_query,
       tokens_used, total_errors, error_rate, total_queries, unique_users, metadata)
      VALUES (${metrics.id}, ${metrics.tenantId}, ${metrics.metricType}, ${metrics.timePeriod},
              ${metrics.timestamp}, ${metrics.p50Latency || null}, ${metrics.p95Latency || null},
              ${metrics.p99Latency || null}, ${metrics.avgLatency || null}, ${metrics.relevanceScore || null},
              ${metrics.confidenceScore || null}, ${metrics.userSatisfaction || null}, ${metrics.totalCost || null},
              ${metrics.costPerQuery || null}, ${metrics.tokensUsed || null}, ${metrics.totalErrors || null},
              ${metrics.errorRate || null}, ${metrics.totalQueries || null}, ${metrics.uniqueUsers || null},
              ${JSON.stringify(metrics.metadata || {})})
    `
  }

  async saveAlert(alert: {
    id: string
    alertType: string
    severity: string
    message: string
    tenantId?: string
    resolved: boolean
    resolvedAt?: Date
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_alerts (id, alert_type, severity, message, tenant_id, resolved, resolved_at, metadata)
      VALUES (${alert.id}, ${alert.alertType}, ${alert.severity}, ${alert.message},
              ${alert.tenantId || null}, ${alert.resolved}, ${alert.resolvedAt || null},
              ${JSON.stringify(alert.metadata || {})})
      ON DUPLICATE KEY UPDATE
        resolved = ${alert.resolved},
        resolved_at = ${alert.resolvedAt || null}
    `
  }

  async getTraces(tenantId: string, limit: number = 50): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT * FROM rag_traces
      WHERE tenant_id = ${tenantId}
      ORDER BY start_time DESC
      LIMIT ${limit}
    `
  }

  async getAlerts(tenantId?: string, resolved: boolean = false): Promise<any[]> {
    if (tenantId) {
      return this.prisma.$queryRaw`
        SELECT * FROM rag_alerts
        WHERE tenant_id = ${tenantId} AND resolved = ${resolved}
        ORDER BY created_at DESC
      `
    }
    return this.prisma.$queryRaw`
      SELECT * FROM rag_alerts
      WHERE resolved = ${resolved}
      ORDER BY created_at DESC
    `
  }

  // ============================================================================
  // SECURITY PERSISTENCE
  // ============================================================================

  async saveAccessPolicy(policy: {
    id: string
    userId: string
    tenantId: string
    permissions: string[]
    contractAccess: string
    dataFilters: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_access_policies (id, user_id, tenant_id, permissions, contract_access, data_filters)
      VALUES (${policy.id}, ${policy.userId}, ${policy.tenantId}, ${JSON.stringify(policy.permissions)},
              ${policy.contractAccess}, ${JSON.stringify(policy.dataFilters)})
      ON DUPLICATE KEY UPDATE
        permissions = ${JSON.stringify(policy.permissions)},
        contract_access = ${policy.contractAccess},
        data_filters = ${JSON.stringify(policy.dataFilters)},
        updated_at = CURRENT_TIMESTAMP
    `
  }

  async getAccessPolicy(userId: string, tenantId: string): Promise<any | null> {
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM rag_access_policies
      WHERE user_id = ${userId} AND tenant_id = ${tenantId}
      LIMIT 1
    `
    return results[0] || null
  }

  async saveAuditLog(log: {
    id: string
    userId: string
    tenantId: string
    action: string
    resource: string
    result: string
    ipAddress?: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_audit_logs (id, user_id, tenant_id, action, resource, result, ip_address, metadata)
      VALUES (${log.id}, ${log.userId}, ${log.tenantId}, ${log.action}, ${log.resource},
              ${log.result}, ${log.ipAddress || null}, ${JSON.stringify(log.metadata || {})})
    `
  }

  async getAuditLogs(tenantId: string, limit: number = 100): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT * FROM rag_audit_logs
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  }

  // ============================================================================
  // MULTI-MODAL PERSISTENCE
  // ============================================================================

  async saveTable(table: {
    id: string
    contractId: string
    tenantId: string
    headers: string[]
    rows: string[][]
    page?: number
    section?: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_tables (id, contract_id, tenant_id, headers, rows, page, section, metadata)
      VALUES (${table.id}, ${table.contractId}, ${table.tenantId}, ${JSON.stringify(table.headers)},
              ${JSON.stringify(table.rows)}, ${table.page || null}, ${table.section || null},
              ${JSON.stringify(table.metadata || {})})
    `
  }

  async saveImage(image: {
    id: string
    contractId: string
    tenantId: string
    url: string
    ocrText?: string
    description?: string
    page?: number
    imageType?: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_images (id, contract_id, tenant_id, url, ocr_text, description, page, image_type, metadata)
      VALUES (${image.id}, ${image.contractId}, ${image.tenantId}, ${image.url},
              ${image.ocrText || null}, ${image.description || null}, ${image.page || null},
              ${image.imageType || null}, ${JSON.stringify(image.metadata || {})})
    `
  }

  async getTables(contractId: string): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT * FROM rag_tables
      WHERE contract_id = ${contractId}
    `
  }

  async getImages(contractId: string): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT * FROM rag_images
      WHERE contract_id = ${contractId}
    `
  }

  // ============================================================================
  // CONVERSATION PERSISTENCE
  // ============================================================================

  async saveConversation(conversation: {
    id: string
    userId: string
    tenantId: string
    title?: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_conversations (id, user_id, tenant_id, title, metadata)
      VALUES (${conversation.id}, ${conversation.userId}, ${conversation.tenantId},
              ${conversation.title || null}, ${JSON.stringify(conversation.metadata || {})})
      ON DUPLICATE KEY UPDATE
        title = ${conversation.title || null},
        metadata = ${JSON.stringify(conversation.metadata || {})},
        updated_at = CURRENT_TIMESTAMP
    `
  }

  async saveMessage(message: {
    id: string
    conversationId: string
    role: string
    content: string
    sources?: any[]
    confidence?: number
  }): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO rag_messages (id, conversation_id, role, content, sources, confidence)
      VALUES (${message.id}, ${message.conversationId}, ${message.role}, ${message.content},
              ${JSON.stringify(message.sources || [])}, ${message.confidence || null})
    `
  }

  async getConversation(conversationId: string): Promise<any | null> {
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM rag_conversations
      WHERE id = ${conversationId}
      LIMIT 1
    `
    return results[0] || null
  }

  async getMessages(conversationId: string): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT * FROM rag_messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `
  }

  async getConversations(userId: string, tenantId: string, limit: number = 20): Promise<any[]> {
    return this.prisma.$queryRaw`
      SELECT * FROM rag_conversations
      WHERE user_id = ${userId} AND tenant_id = ${tenantId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
  }
}

export const ragDatabaseAdaptor = RAGDatabaseAdaptor.getInstance()
