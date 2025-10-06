/**
 * Comprehensive Audit Logging Service
 * Tracks all user actions, data access, and system events for compliance
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  tenantId: string;
  userId?: string;
  sessionId?: string;
  eventType: string;
  category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'DATA_ACCESS' | 'DATA_MODIFICATION' | 'SYSTEM' | 'SECURITY';
  action: string;
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  outcome: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: {
    description: string;
    metadata?: Record<string, any>;
    changes?: Array<{
      field: string;
      oldValue?: any;
      newValue?: any;
    }>;
    error?: string;
  };
  context: {
    ip?: string;
    userAgent?: string;
    location?: string;
    source: string;
  };
  compliance: {
    regulations: string[];
    retentionPeriod: number; // days
    classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  };
}

export interface ComplianceReport {
  id: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  regulation: string;
  tenantId: string;
  summary: {
    totalEvents: number;
    eventsByCategory: Record<string, number>;
    eventsByOutcome: Record<string, number>;
    criticalEvents: number;
    complianceScore: number;
  };
  findings: Array<{
    type: 'VIOLATION' | 'WARNING' | 'OBSERVATION';
    description: string;
    events: string[];
    recommendation: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }>;
  recommendations: string[];
}

export interface AuditQuery {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  eventType?: string;
  category?: string;
  outcome?: string;
  severity?: string;
  resourceType?: string;
  resourceId?: string;
  limit?: number;
  offset?: number;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  regulation: string;
  categories: string[];
  retentionPeriod: number; // days
  archiveAfter: number; // days
  deleteAfter: number; // days
  encryptionRequired: boolean;
  backupRequired: boolean;
}

export class AuditLoggingService extends EventEmitter {
  private events: AuditEvent[] = [];
  private retentionPolicies = new Map<string, RetentionPolicy>();
  private complianceReports = new Map<string, ComplianceReport>();
  private eventIndex = new Map<string, Set<string>>(); // For fast querying

  constructor() {
    super();
    this.setupDefaultRetentionPolicies();
    this.startRetentionCleanup();
    this.startComplianceMonitoring();
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<string> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event
    };

    // Validate event
    this.validateEvent(auditEvent);

    // Store event
    this.events.push(auditEvent);
    this.indexEvent(auditEvent);

    // Apply retention policy
    this.applyRetentionPolicy(auditEvent);

    // Emit for real-time processing
    this.emit('audit:event', auditEvent);

    // Check for compliance violations
    this.checkComplianceViolations(auditEvent);

    return auditEvent.id;
  }

  /**
   * Log authentication event
   */
  async logAuthentication(
    tenantId: string,
    userId: string,
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'MFA_ENABLED' | 'MFA_DISABLED',
    outcome: AuditEvent['outcome'],
    context: AuditEvent['context'],
    details?: any
  ): Promise<string> {
    return this.logEvent({
      tenantId,
      userId,
      eventType: 'user.authentication',
      category: 'AUTHENTICATION',
      action,
      resource: {
        type: 'user',
        id: userId
      },
      outcome,
      severity: outcome === 'FAILURE' ? 'HIGH' : 'LOW',
      details: {
        description: `User ${action.toLowerCase().replace('_', ' ')}`,
        metadata: details
      },
      context,
      compliance: {
        regulations: ['SOX', 'GDPR', 'HIPAA'],
        retentionPeriod: 2555, // 7 years
        classification: 'CONFIDENTIAL'
      }
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    tenantId: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    action: 'READ' | 'search' | 'export' | 'download',
    outcome: AuditEvent['outcome'],
    context: AuditEvent['context'],
    details?: any
  ): Promise<string> {
    return this.logEvent({
      tenantId,
      userId,
      eventType: 'data.access',
      category: 'DATA_ACCESS',
      action,
      resource: {
        type: resourceType,
        id: resourceId,
        name: details?.resourceName
      },
      outcome,
      severity: 'MEDIUM',
      details: {
        description: `User accessed ${resourceType} ${resourceId}`,
        metadata: details
      },
      context,
      compliance: {
        regulations: ['GDPR', 'CCPA', 'HIPAA'],
        retentionPeriod: 1825, // 5 years
        classification: 'CONFIDENTIAL'
      }
    });
  }

  /**
   * Log data modification event
   */
  async logDataModification(
    tenantId: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    action: 'create' | 'update' | 'delete' | 'restore',
    outcome: AuditEvent['outcome'],
    context: AuditEvent['context'],
    changes?: Array<{ field: string; oldValue?: any; newValue?: any }>,
    details?: any
  ): Promise<string> {
    return this.logEvent({
      tenantId,
      userId,
      eventType: 'data.modification',
      category: 'DATA_MODIFICATION',
      action,
      resource: {
        type: resourceType,
        id: resourceId,
        name: details?.resourceName
      },
      outcome,
      severity: action === 'delete' ? 'HIGH' : 'MEDIUM',
      details: {
        description: `User ${action}d ${resourceType} ${resourceId}`,
        changes,
        metadata: details
      },
      context,
      compliance: {
        regulations: ['SOX', 'GDPR', 'CCPA'],
        retentionPeriod: 2555, // 7 years
        classification: 'CONFIDENTIAL'
      }
    });
  }

  /**
   * Log system event
   */
  async logSystemEvent(
    tenantId: string,
    eventType: string,
    action: string,
    outcome: AuditEvent['outcome'],
    severity: AuditEvent['severity'],
    details: string,
    metadata?: any
  ): Promise<string> {
    return this.logEvent({
      tenantId,
      eventType,
      category: 'SYSTEM',
      action,
      resource: {
        type: 'system',
        id: 'system'
      },
      outcome,
      severity,
      details: {
        description: details,
        metadata
      },
      context: {
        source: 'system'
      },
      compliance: {
        regulations: ['SOX'],
        retentionPeriod: 1825, // 5 years
        classification: 'INTERNAL'
      }
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    tenantId: string,
    userId: string | undefined,
    eventType: string,
    action: string,
    outcome: AuditEvent['outcome'],
    context: AuditEvent['context'],
    details: string,
    metadata?: any
  ): Promise<string> {
    return this.logEvent({
      tenantId,
      userId,
      eventType,
      category: 'SECURITY',
      action,
      resource: {
        type: 'security',
        id: eventType
      },
      outcome,
      severity: 'CRITICAL',
      details: {
        description: details,
        metadata
      },
      context,
      compliance: {
        regulations: ['SOX', 'GDPR', 'HIPAA', 'PCI-DSS'],
        retentionPeriod: 2555, // 7 years
        classification: 'RESTRICTED'
      }
    });
  }

  /**
   * Query audit events
   */
  queryEvents(query: AuditQuery): {
    events: AuditEvent[];
    total: number;
    hasMore: boolean;
  } {
    let filteredEvents = this.events.filter(event => {
      if (query.tenantId && event.tenantId !== query.tenantId) return false;
      if (query.userId && event.userId !== query.userId) return false;
      if (query.eventType && event.eventType !== query.eventType) return false;
      if (query.category && event.category !== query.category) return false;
      if (query.outcome && event.outcome !== query.outcome) return false;
      if (query.severity && event.severity !== query.severity) return false;
      if (query.resourceType && event.resource.type !== query.resourceType) return false;
      if (query.resourceId && event.resource.id !== query.resourceId) return false;
      if (query.startDate && event.timestamp < query.startDate) return false;
      if (query.endDate && event.timestamp > query.endDate) return false;
      return true;
    });

    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = filteredEvents.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;

    const events = filteredEvents.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return { events, total, hasMore };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(
    tenantId: string,
    regulation: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const reportId = this.generateReportId();
    
    // Query relevant events
    const { events } = this.queryEvents({
      tenantId,
      startDate,
      endDate
    });

    // Filter events relevant to the regulation
    const relevantEvents = events.filter(event =>
      event.compliance.regulations.includes(regulation)
    );

    // Calculate summary statistics
    const summary = this.calculateComplianceSummary(relevantEvents);
    
    // Identify findings
    const findings = this.identifyComplianceFindings(relevantEvents, regulation);
    
    // Generate recommendations
    const recommendations = this.generateComplianceRecommendations(findings);

    const report: ComplianceReport = {
      id: reportId,
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      regulation,
      tenantId,
      summary,
      findings,
      recommendations
    };

    this.complianceReports.set(reportId, report);
    this.emit('compliance:report_generated', report);

    return report;
  }

  /**
   * Get audit trail for specific resource
   */
  getResourceAuditTrail(
    tenantId: string,
    resourceType: string,
    resourceId: string,
    limit = 100
  ): AuditEvent[] {
    return this.events
      .filter(event =>
        event.tenantId === tenantId &&
        event.resource.type === resourceType &&
        event.resource.id === resourceId
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get user activity summary
   */
  getUserActivitySummary(
    tenantId: string,
    userId: string,
    startDate: Date,
    endDate: Date
  ): {
    totalEvents: number;
    eventsByCategory: Record<string, number>;
    eventsByOutcome: Record<string, number>;
    riskScore: number;
    suspiciousActivities: AuditEvent[];
  } {
    const userEvents = this.events.filter(event =>
      event.tenantId === tenantId &&
      event.userId === userId &&
      event.timestamp >= startDate &&
      event.timestamp <= endDate
    );

    const eventsByCategory: Record<string, number> = {};
    const eventsByOutcome: Record<string, number> = {};

    userEvents.forEach(event => {
      eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1;
      eventsByOutcome[event.outcome] = (eventsByOutcome[event.outcome] || 0) + 1;
    });

    // Calculate risk score based on activities
    const riskScore = this.calculateUserRiskScore(userEvents);
    
    // Identify suspicious activities
    const suspiciousActivities = this.identifySuspiciousActivities(userEvents);

    return {
      totalEvents: userEvents.length,
      eventsByCategory,
      eventsByOutcome,
      riskScore,
      suspiciousActivities
    };
  }

  /**
   * Export audit logs
   */
  async exportAuditLogs(
    query: AuditQuery,
    format: 'json' | 'csv' | 'xml' = 'json'
  ): Promise<string> {
    const { events } = this.queryEvents(query);
    
    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);
      
      case 'csv':
        return this.convertToCSV(events);
      
      case 'xml':
        return this.convertToXML(events);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get audit statistics
   */
  getAuditStats(tenantId?: string): {
    totalEvents: number;
    eventsByCategory: Record<string, number>;
    eventsByOutcome: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    recentCriticalEvents: AuditEvent[];
    complianceScore: number;
  } {
    let events = this.events;
    if (tenantId) {
      events = events.filter(e => e.tenantId === tenantId);
    }

    const eventsByCategory: Record<string, number> = {};
    const eventsByOutcome: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};

    events.forEach(event => {
      eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1;
      eventsByOutcome[event.outcome] = (eventsByOutcome[event.outcome] || 0) + 1;
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
    });

    const recentCriticalEvents = events
      .filter(e => e.severity === 'CRITICAL')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    const complianceScore = this.calculateOverallComplianceScore(events);

    return {
      totalEvents: events.length,
      eventsByCategory,
      eventsByOutcome,
      eventsBySeverity,
      recentCriticalEvents,
      complianceScore
    };
  }

  // Private helper methods

  private validateEvent(event: AuditEvent): void {
    if (!event.tenantId) {
      throw new Error('Tenant ID is required for audit events');
    }
    if (!event.eventType) {
      throw new Error('Event type is required for audit events');
    }
    if (!event.action) {
      throw new Error('Action is required for audit events');
    }
    if (!event.resource.type || !event.resource.id) {
      throw new Error('Resource type and ID are required for audit events');
    }
  }

  private indexEvent(event: AuditEvent): void {
    // Index by tenant
    if (!this.eventIndex.has(`tenant:${event.tenantId}`)) {
      this.eventIndex.set(`tenant:${event.tenantId}`, new Set());
    }
    this.eventIndex.get(`tenant:${event.tenantId}`)!.add(event.id);

    // Index by user
    if (event.userId) {
      if (!this.eventIndex.has(`user:${event.userId}`)) {
        this.eventIndex.set(`user:${event.userId}`, new Set());
      }
      this.eventIndex.get(`user:${event.userId}`)!.add(event.id);
    }

    // Index by resource
    const resourceKey = `resource:${event.resource.type}:${event.resource.id}`;
    if (!this.eventIndex.has(resourceKey)) {
      this.eventIndex.set(resourceKey, new Set());
    }
    this.eventIndex.get(resourceKey)!.add(event.id);
  }

  private applyRetentionPolicy(event: AuditEvent): void {
    const policy = this.getRetentionPolicy(event.category);
    if (policy) {
      event.compliance.retentionPeriod = policy.retentionPeriod;
    }
  }

  private getRetentionPolicy(category: string): RetentionPolicy | undefined {
    return Array.from(this.retentionPolicies.values())
      .find(policy => policy.categories.includes(category));
  }

  private checkComplianceViolations(event: AuditEvent): void {
    // Check for suspicious patterns
    if (event.outcome === 'FAILURE' && event.category === 'AUTHENTICATION') {
      this.checkFailedLoginPattern(event);
    }

    if (event.category === 'DATA_ACCESS' && event.severity === 'HIGH') {
      this.checkUnauthorizedAccess(event);
    }
  }

  private checkFailedLoginPattern(event: AuditEvent): void {
    // Check for multiple failed logins
    const recentFailures = this.events.filter(e =>
      e.tenantId === event.tenantId &&
      e.userId === event.userId &&
      e.category === 'AUTHENTICATION' &&
      e.outcome === 'FAILURE' &&
      e.timestamp > new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
    );

    if (recentFailures.length >= 5) {
      this.emit('compliance:violation', {
        type: 'MULTIPLE_FAILED_LOGINS',
        event,
        relatedEvents: recentFailures
      });
    }
  }

  private checkUnauthorizedAccess(event: AuditEvent): void {
    // Check for access outside normal hours
    const hour = event.timestamp.getHours();
    if (hour < 6 || hour > 22) {
      this.emit('compliance:violation', {
        type: 'OFF_HOURS_ACCESS',
        event
      });
    }
  }

  private calculateComplianceSummary(events: AuditEvent[]): ComplianceReport['summary'] {
    const eventsByCategory: Record<string, number> = {};
    const eventsByOutcome: Record<string, number> = {};
    let criticalEvents = 0;

    events.forEach(event => {
      eventsByCategory[event.category] = (eventsByCategory[event.category] || 0) + 1;
      eventsByOutcome[event.outcome] = (eventsByOutcome[event.outcome] || 0) + 1;
      if (event.severity === 'CRITICAL') {
        criticalEvents++;
      }
    });

    const complianceScore = this.calculateOverallComplianceScore(events);

    return {
      totalEvents: events.length,
      eventsByCategory,
      eventsByOutcome,
      criticalEvents,
      complianceScore
    };
  }

  private identifyComplianceFindings(
    events: AuditEvent[],
    regulation: string
  ): ComplianceReport['findings'] {
    const findings: ComplianceReport['findings'] = [];

    // Check for missing audit trails
    const dataModifications = events.filter(e => e.category === 'DATA_MODIFICATION');
    const dataAccess = events.filter(e => e.category === 'DATA_ACCESS');
    
    if (dataModifications.length === 0) {
      findings.push({
        type: 'OBSERVATION',
        description: 'No data modification events found in the audit period',
        events: [],
        recommendation: 'Ensure all data modifications are properly logged',
        severity: 'MEDIUM'
      });
    }

    // Check for failed events
    const failedEvents = events.filter(e => e.outcome === 'FAILURE');
    if (failedEvents.length > events.length * 0.1) {
      findings.push({
        type: 'WARNING',
        description: 'High failure rate detected in audit events',
        events: failedEvents.slice(0, 10).map(e => e.id),
        recommendation: 'Investigate causes of high failure rates',
        severity: 'HIGH'
      });
    }

    return findings;
  }

  private generateComplianceRecommendations(findings: ComplianceReport['findings']): string[] {
    const recommendations: string[] = [];

    if (findings.some(f => f.type === 'VIOLATION')) {
      recommendations.push('Address all compliance violations immediately');
    }

    if (findings.some(f => f.severity === 'CRITICAL')) {
      recommendations.push('Review and strengthen security controls');
    }

    recommendations.push('Implement regular compliance monitoring');
    recommendations.push('Provide additional security training to users');
    recommendations.push('Review and update audit logging policies');

    return recommendations;
  }

  private calculateUserRiskScore(events: AuditEvent[]): number {
    let score = 0;

    // Failed events increase risk
    const failedEvents = events.filter(e => e.outcome === 'FAILURE');
    score += failedEvents.length * 10;

    // Critical events increase risk significantly
    const criticalEvents = events.filter(e => e.severity === 'CRITICAL');
    score += criticalEvents.length * 25;

    // Off-hours activity increases risk
    const offHoursEvents = events.filter(e => {
      const hour = e.timestamp.getHours();
      return hour < 6 || hour > 22;
    });
    score += offHoursEvents.length * 5;

    return Math.min(score, 100);
  }

  private identifySuspiciousActivities(events: AuditEvent[]): AuditEvent[] {
    return events.filter(event => {
      // Failed authentication attempts
      if (event.category === 'AUTHENTICATION' && event.outcome === 'FAILURE') {
        return true;
      }

      // Off-hours data access
      const hour = event.timestamp.getHours();
      if (event.category === 'DATA_ACCESS' && (hour < 6 || hour > 22)) {
        return true;
      }

      // Critical security events
      if (event.category === 'SECURITY' && event.severity === 'CRITICAL') {
        return true;
      }

      return false;
    });
  }

  private calculateOverallComplianceScore(events: AuditEvent[]): number {
    if (events.length === 0) return 100;

    const failedEvents = events.filter(e => e.outcome === 'FAILURE').length;
    const criticalEvents = events.filter(e => e.severity === 'CRITICAL').length;
    
    const failureRate = failedEvents / events.length;
    const criticalRate = criticalEvents / events.length;
    
    const score = 100 - (failureRate * 50) - (criticalRate * 30);
    return Math.max(0, Math.min(100, score));
  }

  private convertToCSV(events: AuditEvent[]): string {
    const headers = [
      'ID', 'Timestamp', 'Tenant ID', 'User ID', 'Event Type', 'Category',
      'Action', 'Resource Type', 'Resource ID', 'Outcome', 'Severity', 'Description'
    ];

    const rows = events.map(event => [
      event.id,
      event.timestamp.toISOString(),
      event.tenantId,
      event.userId || '',
      event.eventType,
      event.category,
      event.action,
      event.resource.type,
      event.resource.id,
      event.outcome,
      event.severity,
      event.details.description
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToXML(events: AuditEvent[]): string {
    const xmlEvents = events.map(event => `
    <event>
      <id>${event.id}</id>
      <timestamp>${event.timestamp.toISOString()}</timestamp>
      <tenantId>${event.tenantId}</tenantId>
      <userId>${event.userId || ''}</userId>
      <eventType>${event.eventType}</eventType>
      <category>${event.category}</category>
      <action>${event.action}</action>
      <resource>
        <type>${event.resource.type}</type>
        <id>${event.resource.id}</id>
      </resource>
      <outcome>${event.outcome}</outcome>
      <severity>${event.severity}</severity>
      <description>${event.details.description}</description>
    </event>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<auditLog>${xmlEvents}\n</auditLog>`;
  }

  private setupDefaultRetentionPolicies(): void {
    this.retentionPolicies.set('sox', {
      id: 'sox',
      name: 'Sarbanes-Oxley Act',
      regulation: 'SOX',
      categories: ['DATA_MODIFICATION', 'AUTHENTICATION', 'SYSTEM'],
      retentionPeriod: 2555, // 7 years
      archiveAfter: 1825, // 5 years
      deleteAfter: 2555,
      encryptionRequired: true,
      backupRequired: true
    });

    this.retentionPolicies.set('gdpr', {
      id: 'gdpr',
      name: 'General Data Protection Regulation',
      regulation: 'GDPR',
      categories: ['DATA_ACCESS', 'DATA_MODIFICATION', 'AUTHENTICATION'],
      retentionPeriod: 1825, // 5 years
      archiveAfter: 1095, // 3 years
      deleteAfter: 1825,
      encryptionRequired: true,
      backupRequired: true
    });
  }

  private startRetentionCleanup(): void {
    // Run retention cleanup daily
    setInterval(() => {
      this.performRetentionCleanup();
    }, 24 * 60 * 60 * 1000);
  }

  private startComplianceMonitoring(): void {
    // Run compliance checks hourly
    setInterval(() => {
      this.performComplianceChecks();
    }, 60 * 60 * 1000);
  }

  private performRetentionCleanup(): void {
    const now = new Date();
    const eventsToRemove: string[] = [];

    this.events.forEach(event => {
      const retentionPeriod = event.compliance.retentionPeriod;
      const expiryDate = new Date(event.timestamp.getTime() + retentionPeriod * 24 * 60 * 60 * 1000);
      
      if (now > expiryDate) {
        eventsToRemove.push(event.id);
      }
    });

    // Remove expired events
    this.events = this.events.filter(event => !eventsToRemove.includes(event.id));
    
    if (eventsToRemove.length > 0) {
      this.emit('retention:cleanup', eventsToRemove.length);
    }
  }

  private performComplianceChecks(): void {
    // Check for compliance violations in recent events
    const recentEvents = this.events.filter(event =>
      event.timestamp > new Date(Date.now() - 60 * 60 * 1000) // Last hour
    );

    recentEvents.forEach(event => {
      this.checkComplianceViolations(event);
    });
  }

  private generateEventId(): string {
    return 'audit_' + crypto.randomBytes(8).toString('hex');
  }

  private generateReportId(): string {
    return 'report_' + crypto.randomBytes(8).toString('hex');
  }
}

// Export singleton instance
export const auditLoggingService = new AuditLoggingService();