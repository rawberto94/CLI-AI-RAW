/**
 * RAG Security Service (Phase 11)
 * 
 * Access control, data privacy, rate limiting, and audit logging
 */

import pino from 'pino'

const logger = pino({ name: 'rag-security' })

export interface AccessPolicy {
  userId: string
  tenantId: string
  permissions: Array<'read' | 'write' | 'delete' | 'admin'>
  contractAccess: 'all' | 'assigned' | 'department'
  dataFilters: Record<string, any>
}

export interface RateLimitConfig {
  userId: string
  tenantId: string
  limits: {
    queriesPerMinute: number
    queriesPerHour: number
    queriesPerDay: number
  }
  currentUsage: {
    minute: number
    hour: number
    day: number
    lastReset: Date
  }
}

export interface AuditLog {
  id: string
  timestamp: Date
  userId: string
  tenantId: string
  action: string
  resource: string
  result: 'success' | 'denied' | 'error'
  metadata: Record<string, any>
  ipAddress?: string
}

export class RAGSecurityService {
  private static instance: RAGSecurityService
  private accessPolicies: Map<string, AccessPolicy> = new Map()
  private rateLimits: Map<string, RateLimitConfig> = new Map()
  private auditLogs: AuditLog[] = []
  private piiPatterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{16}\b/g, // Credit card
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
    /\b\d{3}-\d{3}-\d{4}\b/g // Phone
  ]

  private constructor() {}

  static getInstance(): RAGSecurityService {
    if (!RAGSecurityService.instance) {
      RAGSecurityService.instance = new RAGSecurityService()
    }
    return RAGSecurityService.instance
  }

  /**
   * Check if user has access to perform action
   */
  async checkAccess(
    userId: string,
    tenantId: string,
    action: 'read' | 'write' | 'delete',
    resource?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const policyKey = `${userId}:${tenantId}`
      const policy = this.accessPolicies.get(policyKey)

      if (!policy) {
        this.logAudit({
          userId,
          tenantId,
          action: `check_access:${action}`,
          resource: resource || 'unknown',
          result: 'denied',
          metadata: { reason: 'No policy found' }
        })

        return { allowed: false, reason: 'No access policy found' }
      }

      if (!policy.permissions.includes(action) && !policy.permissions.includes('admin')) {
        this.logAudit({
          userId,
          tenantId,
          action: `check_access:${action}`,
          resource: resource || 'unknown',
          result: 'denied',
          metadata: { reason: 'Insufficient permissions' }
        })

        return { allowed: false, reason: 'Insufficient permissions' }
      }

      this.logAudit({
        userId,
        tenantId,
        action: `check_access:${action}`,
        resource: resource || 'unknown',
        result: 'success',
        metadata: {}
      })

      return { allowed: true }
    } catch (error) {
      logger.error({ error, userId, tenantId }, 'Access check failed')
      return { allowed: false, reason: 'Access check error' }
    }
  }

  /**
   * Apply row-level security filters
   */
  async applyDataFilters(
    userId: string,
    tenantId: string,
    query: any
  ): Promise<any> {
    const policyKey = `${userId}:${tenantId}`
    const policy = this.accessPolicies.get(policyKey)

    if (!policy) return query

    // Apply tenant isolation
    query.tenantId = tenantId

    // Apply additional filters based on policy
    if (policy.contractAccess === 'assigned') {
      query.assignedTo = userId
    } else if (policy.contractAccess === 'department') {
      query.department = policy.dataFilters.department
    }

    return query
  }

  /**
   * Check rate limits
   */
  async checkRateLimit(
    userId: string,
    tenantId: string
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    try {
      const limitKey = `${userId}:${tenantId}`
      let config = this.rateLimits.get(limitKey)

      if (!config) {
        // Create default rate limit config
        config = {
          userId,
          tenantId,
          limits: {
            queriesPerMinute: 10,
            queriesPerHour: 100,
            queriesPerDay: 1000
          },
          currentUsage: {
            minute: 0,
            hour: 0,
            day: 0,
            lastReset: new Date()
          }
        }
        this.rateLimits.set(limitKey, config)
      }

      // Reset counters if needed
      this.resetRateLimitCounters(config)

      // Check limits
      if (config.currentUsage.minute >= config.limits.queriesPerMinute) {
        this.logAudit({
          userId,
          tenantId,
          action: 'rate_limit_exceeded',
          resource: 'query',
          result: 'denied',
          metadata: { limit: 'minute', usage: config.currentUsage.minute }
        })

        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + 60000)
        }
      }

      if (config.currentUsage.hour >= config.limits.queriesPerHour) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + 3600000)
        }
      }

      if (config.currentUsage.day >= config.limits.queriesPerDay) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + 86400000)
        }
      }

      // Increment counters
      config.currentUsage.minute++
      config.currentUsage.hour++
      config.currentUsage.day++

      return {
        allowed: true,
        remaining: config.limits.queriesPerMinute - config.currentUsage.minute,
        resetAt: new Date(Date.now() + 60000)
      }
    } catch (error) {
      logger.error({ error, userId, tenantId }, 'Rate limit check failed')
      return { allowed: true, remaining: 0, resetAt: new Date() }
    }
  }

  /**
   * Mask PII in text
   */
  maskPII(text: string): string {
    let masked = text

    // Mask SSN
    masked = masked.replace(this.piiPatterns[0], 'XXX-XX-XXXX')

    // Mask credit card
    masked = masked.replace(this.piiPatterns[1], 'XXXX-XXXX-XXXX-XXXX')

    // Mask email
    masked = masked.replace(this.piiPatterns[2], '[EMAIL]')

    // Mask phone
    masked = masked.replace(this.piiPatterns[3], 'XXX-XXX-XXXX')

    return masked
  }

  /**
   * Set access policy for user
   */
  setAccessPolicy(policy: AccessPolicy): void {
    const key = `${policy.userId}:${policy.tenantId}`
    this.accessPolicies.set(key, policy)
    logger.info({ userId: policy.userId, tenantId: policy.tenantId }, 'Access policy set')
  }

  /**
   * Set rate limits for user
   */
  setRateLimits(config: RateLimitConfig): void {
    const key = `${config.userId}:${config.tenantId}`
    this.rateLimits.set(key, config)
    logger.info({ userId: config.userId, tenantId: config.tenantId }, 'Rate limits set')
  }

  /**
   * Get audit logs
   */
  getAuditLogs(
    tenantId: string,
    filters?: {
      userId?: string
      action?: string
      startDate?: Date
      endDate?: Date
    }
  ): AuditLog[] {
    let logs = this.auditLogs.filter(log => log.tenantId === tenantId)

    if (filters?.userId) {
      logs = logs.filter(log => log.userId === filters.userId)
    }

    if (filters?.action) {
      logs = logs.filter(log => log.action === filters.action)
    }

    if (filters?.startDate) {
      logs = logs.filter(log => log.timestamp >= filters.startDate!)
    }

    if (filters?.endDate) {
      logs = logs.filter(log => log.timestamp <= filters.endDate!)
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Detect and prevent abuse
   */
  async detectAbuse(
    userId: string,
    tenantId: string
  ): Promise<{ isAbusive: boolean; reasons: string[] }> {
    const reasons: string[] = []

    // Check for excessive queries
    const recentLogs = this.auditLogs.filter(
      log => log.userId === userId &&
      log.tenantId === tenantId &&
      Date.now() - log.timestamp.getTime() < 3600000 // Last hour
    )

    if (recentLogs.length > 200) {
      reasons.push('Excessive query volume')
    }

    // Check for repeated failed attempts
    const failedAttempts = recentLogs.filter(log => log.result === 'denied').length
    if (failedAttempts > 20) {
      reasons.push('Multiple failed access attempts')
    }

    // Check for unusual patterns
    const uniqueActions = new Set(recentLogs.map(log => log.action))
    if (uniqueActions.size > 50) {
      reasons.push('Unusual activity pattern')
    }

    return {
      isAbusive: reasons.length > 0,
      reasons
    }
  }

  private logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const auditLog: AuditLog = {
      ...log,
      id: `audit:${Date.now()}`,
      timestamp: new Date()
    }

    this.auditLogs.push(auditLog)

    // Keep only last 10000 logs
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000)
    }

    logger.info({
      auditId: auditLog.id,
      userId: log.userId,
      action: log.action,
      result: log.result
    }, 'Audit log created')
  }

  private resetRateLimitCounters(config: RateLimitConfig): void {
    const now = Date.now()
    const lastReset = config.currentUsage.lastReset.getTime()

    // Reset minute counter
    if (now - lastReset > 60000) {
      config.currentUsage.minute = 0
    }

    // Reset hour counter
    if (now - lastReset > 3600000) {
      config.currentUsage.hour = 0
    }

    // Reset day counter
    if (now - lastReset > 86400000) {
      config.currentUsage.day = 0
      config.currentUsage.lastReset = new Date()
    }
  }
}

export const ragSecurityService = RAGSecurityService.getInstance()
