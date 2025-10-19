/**
 * RAG Persistence Integration
 * 
 * Integrates RAG services with database persistence
 */

import { ragDatabaseAdaptor } from '../../dal/rag-database.adaptor'
import { knowledgeGraphService } from './knowledge-graph.service'
import { ragLearningService } from './rag-learning.service'
import { ragObservabilityService } from './rag-observability.service'
import { ragSecurityService } from './rag-security.service'
import { multiModalRAGService } from './multi-modal-rag.service'
import pino from 'pino'

const logger = pino({ name: 'rag-persistence-integration' })

/**
 * Sync in-memory data to database periodically
 */
export class RAGPersistenceIntegration {
  private static instance: RAGPersistenceIntegration
  private syncInterval: NodeJS.Timeout | null = null

  private constructor() {}

  static getInstance(): RAGPersistenceIntegration {
    if (!RAGPersistenceIntegration.instance) {
      RAGPersistenceIntegration.instance = new RAGPersistenceIntegration()
    }
    return RAGPersistenceIntegration.instance
  }

  /**
   * Start automatic sync to database
   */
  startAutoSync(intervalMs: number = 60000): void {
    if (this.syncInterval) {
      logger.warn('Auto-sync already running')
      return
    }

    logger.info({ intervalMs }, 'Starting auto-sync to database')

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncAll()
      } catch (error) {
        logger.error({ error }, 'Auto-sync failed')
      }
    }, intervalMs)
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      logger.info('Auto-sync stopped')
    }
  }

  /**
   * Sync all data to database
   */
  async syncAll(): Promise<void> {
    logger.info('Syncing all RAG data to database')

    await Promise.all([
      this.syncKnowledgeGraph(),
      this.syncLearningData(),
      this.syncObservabilityData(),
      this.syncSecurityData()
    ])

    logger.info('Sync complete')
  }

  /**
   * Sync knowledge graph to database
   */
  private async syncKnowledgeGraph(): Promise<void> {
    // Knowledge graph service uses in-memory maps
    // This would need to be extended to persist nodes and relationships
    logger.debug('Knowledge graph sync - implementation needed')
  }

  /**
   * Sync learning data to database
   */
  private async syncLearningData(): Promise<void> {
    // Learning service uses in-memory maps
    // This would need to be extended to persist feedback and interactions
    logger.debug('Learning data sync - implementation needed')
  }

  /**
   * Sync observability data to database
   */
  private async syncObservabilityData(): Promise<void> {
    // Observability service uses in-memory maps
    // This would need to be extended to persist traces and metrics
    logger.debug('Observability data sync - implementation needed')
  }

  /**
   * Sync security data to database
   */
  private async syncSecurityData(): Promise<void> {
    // Security service uses in-memory maps
    // This would need to be extended to persist policies and audit logs
    logger.debug('Security data sync - implementation needed')
  }

  /**
   * Load data from database on startup
   */
  async loadFromDatabase(tenantId: string): Promise<void> {
    logger.info({ tenantId }, 'Loading RAG data from database')

    try {
      // Load graph nodes
      const nodes = await ragDatabaseAdaptor.getGraphNodes(tenantId)
      logger.info({ count: nodes.length }, 'Loaded graph nodes')

      // Load feedback
      const feedback = await ragDatabaseAdaptor.getFeedback(tenantId)
      logger.info({ count: feedback.length }, 'Loaded feedback')

      // Load traces
      const traces = await ragDatabaseAdaptor.getTraces(tenantId)
      logger.info({ count: traces.length }, 'Loaded traces')

      // Load alerts
      const alerts = await ragDatabaseAdaptor.getAlerts(tenantId)
      logger.info({ count: alerts.length }, 'Loaded alerts')

      logger.info('Database load complete')
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to load from database')
      throw error
    }
  }
}

export const ragPersistenceIntegration = RAGPersistenceIntegration.getInstance()

// Auto-start sync on import (can be disabled if needed)
if (process.env.NODE_ENV !== 'test') {
  ragPersistenceIntegration.startAutoSync(60000) // Sync every minute
}
