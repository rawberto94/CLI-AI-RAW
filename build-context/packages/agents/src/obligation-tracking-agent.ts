/**
 * Obligation Tracking Agent Extension
 * 
 * This module extends the Autonomous Agent Orchestrator with comprehensive
 * obligation tracking, deadline management, and proactive monitoring capabilities.
 * 
 * Features:
 * - Automatic obligation extraction from contracts
 * - Deadline monitoring and escalation
 * - Milestone tracking
 * - Compliance verification
 * - Proactive alerting
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from './lib/prisma';
import OpenAI from 'openai';

// ============================================================================
// TYPES
// ============================================================================

export type ObligationStatus = 
  | 'pending' 
  | 'in_progress' 
  | 'completed' 
  | 'overdue' 
  | 'at_risk' 
  | 'waived' 
  | 'cancelled';

export type ObligationPriority = 'critical' | 'high' | 'medium' | 'low';
export type ObligationType = 
  | 'payment' 
  | 'delivery' 
  | 'performance' 
  | 'reporting' 
  | 'compliance' 
  | 'notification' 
  | 'renewal' 
  | 'termination'
  | 'audit'
  | 'insurance'
  | 'milestone'
  | 'other';

export type ObligationOwner = 'us' | 'counterparty' | 'both';

export interface ContractObligation {
  id: string;
  tenantId: string;
  contractId: string;
  
  // Core details
  title: string;
  description: string;
  type: ObligationType;
  owner: ObligationOwner;
  priority: ObligationPriority;
  status: ObligationStatus;
  
  // Timing
  dueDate: Date;
  reminderDays: number[];
  recurrence?: ObligationRecurrence;
  
  // Tracking
  completedAt?: Date;
  completedBy?: string;
  completionNotes?: string;
  
  // Source reference
  sourceClause: string;
  sourceSection?: string;
  sourcePageNumber?: number;
  
  // Risk assessment
  riskScore: number;
  riskFactors: string[];
  penaltyForMissing?: string;
  
  // Dependencies
  dependencies: string[];
  blockedBy: string[];
  
  // Evidence
  requiredEvidence: string[];
  attachedEvidence: ObligationEvidence[];
  
  // Audit trail
  history: ObligationHistoryEntry[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  tags: string[];
  customFields: Record<string, unknown>;
}

export interface ObligationRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  interval: number;
  endDate?: Date;
  occurrences?: number;
  nextDueDate?: Date;
}

export interface ObligationEvidence {
  id: string;
  type: 'document' | 'email' | 'screenshot' | 'report' | 'other';
  name: string;
  url?: string;
  uploadedAt: Date;
  uploadedBy?: string;
}

export interface ObligationHistoryEntry {
  id: string;
  action: 'created' | 'updated' | 'status_changed' | 'reminder_sent' | 'escalated' | 'evidence_added' | 'comment_added';
  description: string;
  previousStatus?: ObligationStatus;
  newStatus?: ObligationStatus;
  performedBy?: string;
  performedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ObligationAlert {
  id: string;
  tenantId: string;
  obligationId: string;
  type: 'reminder' | 'at_risk' | 'overdue' | 'escalation' | 'completion';
  message: string;
  priority: ObligationPriority;
  recipients: string[];
  sentAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface ObligationExtractionResult {
  obligations: Omit<ContractObligation, 'id' | 'createdAt' | 'updatedAt' | 'history'>[];
  summary: {
    total: number;
    byType: Record<ObligationType, number>;
    byOwner: Record<ObligationOwner, number>;
    byPriority: Record<ObligationPriority, number>;
  };
  confidence: number;
  warnings: string[];
}

export interface ObligationDashboardMetrics {
  totalObligations: number;
  byStatus: Record<ObligationStatus, number>;
  byPriority: Record<ObligationPriority, number>;
  byType: Record<ObligationType, number>;
  overdueCount: number;
  atRiskCount: number;
  dueSoon: number; // Due within 7 days
  completedThisMonth: number;
  complianceRate: number;
  avgCompletionTime: number; // Days
  upcomingDeadlines: Array<{
    obligationId: string;
    title: string;
    dueDate: Date;
    daysRemaining: number;
    contractId: string;
    contractName?: string;
  }>;
}

// ============================================================================
// OBLIGATION TRACKING AGENT
// ============================================================================

export class ObligationTrackingAgent extends EventEmitter {
  private prisma: PrismaClient;
  private openai: OpenAI;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(prisma?: PrismaClient) {
    super();
    this.prisma = prisma || defaultPrisma;
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // ============================================================================
  // OBLIGATION EXTRACTION
  // ============================================================================

  /**
   * Extract obligations from contract text using AI
   */
  async extractObligations(
    contractId: string,
    contractText: string,
    tenantId: string,
    options: {
      contractType?: string;
      startDate?: Date;
      endDate?: Date;
      parties?: { us: string; counterparty: string };
    } = {}
  ): Promise<ObligationExtractionResult> {
    const prompt = `You are a legal AI assistant specialized in contract analysis. Extract all contractual obligations from the following contract text.

Contract Type: ${options.contractType || 'Unknown'}
Our Party: ${options.parties?.us || 'Company'}
Counterparty: ${options.parties?.counterparty || 'Vendor'}
Contract Start: ${options.startDate?.toISOString() || 'Not specified'}
Contract End: ${options.endDate?.toISOString() || 'Not specified'}

For each obligation, provide:
1. title: Brief title (max 100 chars)
2. description: Detailed description
3. type: One of: payment, delivery, performance, reporting, compliance, notification, renewal, termination, audit, insurance, milestone, other
4. owner: Who is responsible - "us", "counterparty", or "both"
5. priority: critical, high, medium, or low based on business impact
6. dueDate: ISO date string (if specific date) or relative timeframe description
7. reminderDays: Array of days before due date to send reminders [14, 7, 1]
8. sourceClause: The exact text that defines this obligation
9. sourceSection: Section number/name if identifiable
10. penaltyForMissing: What happens if obligation is missed
11. riskFactors: Array of risk factors
12. requiredEvidence: What evidence is needed to prove completion
13. recurrence: If recurring, specify frequency (daily, weekly, monthly, quarterly, annually) and interval

CONTRACT TEXT:
${contractText.slice(0, 30000)}

Return a JSON object with:
{
  "obligations": [...],
  "summary": { "total": number, "byType": {...}, "byOwner": {...}, "byPriority": {...} },
  "confidence": number (0-1),
  "warnings": [...any issues or ambiguities found...]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert legal analyst. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 8000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const result = JSON.parse(content) as ObligationExtractionResult;

      // Process and validate extracted obligations
      const processedObligations = result.obligations.map(obligation => ({
        ...obligation,
        tenantId,
        contractId,
        status: 'pending' as ObligationStatus,
        riskScore: this.calculateRiskScore(obligation),
        dependencies: obligation.dependencies || [],
        blockedBy: obligation.blockedBy || [],
        attachedEvidence: [],
        tags: [],
        customFields: {}
      }));

      return {
        ...result,
        obligations: processedObligations
      };
    } catch (error) {
      console.error('Obligation extraction failed:', error);
      throw error;
    }
  }

  /**
   * Save extracted obligations to database
   */
  async saveObligations(
    obligations: Omit<ContractObligation, 'id' | 'createdAt' | 'updatedAt' | 'history'>[]
  ): Promise<ContractObligation[]> {
    const savedObligations: ContractObligation[] = [];

    for (const obligation of obligations) {
      const id = uuidv4();
      const now = new Date();

      // Store in database (assuming Obligation model exists)
      // In production, this would use Prisma to save
      const saved: ContractObligation = {
        ...obligation,
        id,
        createdAt: now,
        updatedAt: now,
        history: [{
          id: uuidv4(),
          action: 'created',
          description: 'Obligation extracted from contract',
          performedAt: now
        }]
      };

      savedObligations.push(saved);
      this.emit('obligation:created', saved);
    }

    return savedObligations;
  }

  // ============================================================================
  // MONITORING & ALERTS
  // ============================================================================

  /**
   * Start continuous monitoring of obligations
   */
  startMonitoring(intervalMs: number = 3600000): void { // Default: 1 hour
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAllObligations();
      } catch (error) {
        console.error('Obligation monitoring error:', error);
        this.emit('monitoring:error', error);
      }
    }, intervalMs);

    // Run immediately
    this.checkAllObligations();
    this.emit('monitoring:started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    this.emit('monitoring:stopped');
  }

  /**
   * Check all obligations and generate alerts
   */
  async checkAllObligations(): Promise<void> {
    const now = new Date();
    
    // In production, this would query from database
    // For now, we emit events for the orchestrator to handle
    this.emit('obligations:check_started', { timestamp: now });

    // Check for overdue obligations
    const overdueCheck = {
      type: 'obligation_overdue_check',
      description: 'Check for overdue obligations and send alerts',
      timestamp: now
    };
    this.emit('trigger:obligation_check', overdueCheck);

    // Check for at-risk obligations (due within reminder period)
    const atRiskCheck = {
      type: 'obligation_at_risk_check',
      description: 'Check for at-risk obligations and send reminders',
      timestamp: now
    };
    this.emit('trigger:obligation_check', atRiskCheck);

    // Check for recurring obligation generation
    const recurringCheck = {
      type: 'obligation_recurring_check',
      description: 'Generate next occurrence for recurring obligations',
      timestamp: now
    };
    this.emit('trigger:obligation_check', recurringCheck);
  }

  /**
   * Update obligation status
   */
  async updateObligationStatus(
    obligationId: string,
    newStatus: ObligationStatus,
    performedBy: string,
    notes?: string
  ): Promise<ContractObligation | null> {
    // In production, this would update in database
    const historyEntry: ObligationHistoryEntry = {
      id: uuidv4(),
      action: 'status_changed',
      description: `Status changed to ${newStatus}${notes ? `: ${notes}` : ''}`,
      newStatus,
      performedBy,
      performedAt: new Date()
    };

    this.emit('obligation:status_changed', {
      obligationId,
      newStatus,
      historyEntry
    });

    return null; // Would return updated obligation from DB
  }

  /**
   * Mark obligation as completed
   */
  async completeObligation(
    obligationId: string,
    completedBy: string,
    notes?: string,
    evidence?: Omit<ObligationEvidence, 'id' | 'uploadedAt'>[]
  ): Promise<ContractObligation | null> {
    const historyEntry: ObligationHistoryEntry = {
      id: uuidv4(),
      action: 'status_changed',
      description: `Marked as completed${notes ? `: ${notes}` : ''}`,
      previousStatus: 'in_progress',
      newStatus: 'completed',
      performedBy: completedBy,
      performedAt: new Date(),
      metadata: { evidence: evidence?.length || 0 }
    };

    this.emit('obligation:completed', {
      obligationId,
      completedBy,
      notes,
      evidence,
      historyEntry
    });

    return null;
  }

  /**
   * Send reminder for upcoming obligation
   */
  async sendReminder(
    obligation: ContractObligation,
    daysRemaining: number,
    recipients: string[]
  ): Promise<ObligationAlert> {
    const alert: ObligationAlert = {
      id: uuidv4(),
      tenantId: obligation.tenantId,
      obligationId: obligation.id,
      type: daysRemaining <= 0 ? 'overdue' : daysRemaining <= 3 ? 'at_risk' : 'reminder',
      message: this.generateAlertMessage(obligation, daysRemaining),
      priority: daysRemaining <= 0 ? 'critical' : obligation.priority,
      recipients,
      sentAt: new Date(),
      acknowledged: false
    };

    this.emit('alert:sent', alert);
    return alert;
  }

  /**
   * Escalate overdue obligation
   */
  async escalateObligation(
    obligation: ContractObligation,
    escalationLevel: number,
    reason: string
  ): Promise<void> {
    const escalation = {
      obligationId: obligation.id,
      level: escalationLevel,
      reason,
      timestamp: new Date()
    };

    this.emit('obligation:escalated', escalation);
  }

  // ============================================================================
  // ANALYTICS & REPORTING
  // ============================================================================

  /**
   * Get dashboard metrics for a tenant
   * Note: ContractObligation model not yet in schema, returns placeholder metrics
   */
  async getDashboardMetrics(_tenantId: string): Promise<ObligationDashboardMetrics> {
    // ContractObligation model doesn't exist in schema yet
    // Return placeholder metrics until model is added
    return {
      totalObligations: 0,
      byStatus: {
        pending: 0,
        in_progress: 0,
        completed: 0,
        overdue: 0,
        at_risk: 0,
        waived: 0,
        cancelled: 0
      },
      byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
      byType: {
        payment: 0, delivery: 0, performance: 0, reporting: 0,
        compliance: 0, notification: 0, renewal: 0, termination: 0,
        audit: 0, insurance: 0, milestone: 0, other: 0
      },
      overdueCount: 0,
      atRiskCount: 0,
      dueSoon: 0,
      completedThisMonth: 0,
      complianceRate: 100,
      avgCompletionTime: 0,
      upcomingDeadlines: []
    };
  }

  /**
   * Generate obligation report for a contract
   */
  async generateContractObligationReport(
    contractId: string
  ): Promise<{
    contractId: string;
    summary: string;
    obligations: ContractObligation[];
    metrics: {
      total: number;
      completed: number;
      pending: number;
      overdue: number;
      complianceRate: number;
    };
    recommendations: string[];
    generatedAt: Date;
  }> {
    // In production, this would fetch real data
    return {
      contractId,
      summary: 'Obligation report generated',
      obligations: [],
      metrics: {
        total: 0,
        completed: 0,
        pending: 0,
        overdue: 0,
        complianceRate: 100
      },
      recommendations: [],
      generatedAt: new Date()
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Calculate risk score for an obligation
   */
  private calculateRiskScore(
    obligation: Partial<ContractObligation>
  ): number {
    let score = 50; // Base score

    // Priority impact
    switch (obligation.priority) {
      case 'critical': score += 30; break;
      case 'high': score += 20; break;
      case 'medium': score += 10; break;
      case 'low': score += 0; break;
    }

    // Type impact
    if (['payment', 'compliance', 'termination'].includes(obligation.type || '')) {
      score += 10;
    }

    // Owner impact
    if (obligation.owner === 'us') {
      score += 5;
    }

    // Penalty impact
    if (obligation.penaltyForMissing) {
      score += 15;
    }

    // Risk factors
    score += (obligation.riskFactors?.length || 0) * 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate alert message based on obligation and days remaining
   */
  private generateAlertMessage(
    obligation: ContractObligation,
    daysRemaining: number
  ): string {
    if (daysRemaining < 0) {
      return `OVERDUE: "${obligation.title}" was due ${Math.abs(daysRemaining)} days ago. ${
        obligation.penaltyForMissing ? `Penalty: ${obligation.penaltyForMissing}` : ''
      }`;
    } else if (daysRemaining === 0) {
      return `DUE TODAY: "${obligation.title}" is due today. Please complete or update status.`;
    } else if (daysRemaining <= 3) {
      return `URGENT: "${obligation.title}" is due in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}. Priority: ${obligation.priority}`;
    } else {
      return `REMINDER: "${obligation.title}" is due in ${daysRemaining} days (${obligation.dueDate.toLocaleDateString()}).`;
    }
  }

  /**
   * Check if obligation is at risk based on timeline
   */
  isAtRisk(obligation: ContractObligation): boolean {
    if (obligation.status === 'completed' || obligation.status === 'cancelled' || obligation.status === 'waived') {
      return false;
    }

    const now = new Date();
    const dueDate = new Date(obligation.dueDate);
    const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // At risk if due within minimum reminder days
    const minReminderDays = Math.min(...(obligation.reminderDays || [7]));
    return daysRemaining <= minReminderDays && daysRemaining > 0;
  }

  /**
   * Check if obligation is overdue
   */
  isOverdue(obligation: ContractObligation): boolean {
    if (obligation.status === 'completed' || obligation.status === 'cancelled' || obligation.status === 'waived') {
      return false;
    }

    const now = new Date();
    const dueDate = new Date(obligation.dueDate);
    return now > dueDate;
  }
}

// ============================================================================
// GOAL TEMPLATES FOR OBLIGATION TRACKING
// ============================================================================

export const OBLIGATION_GOAL_TEMPLATES = {
  obligation_extraction: {
    type: 'obligation_extraction',
    description: 'Extract and catalog all obligations from a contract',
    priority: 'high' as const,
    planningHints: [
      'Parse contract document text',
      'Use AI to identify obligations',
      'Categorize by type and owner',
      'Set appropriate deadlines and reminders',
      'Calculate risk scores',
      'Save to obligation tracking system'
    ]
  },
  obligation_deadline_monitor: {
    type: 'obligation_deadline_monitor',
    description: 'Monitor upcoming obligation deadlines and send alerts',
    priority: 'high' as const,
    planningHints: [
      'Query all active obligations',
      'Identify obligations due within reminder windows',
      'Check for already sent reminders',
      'Send appropriate alerts',
      'Update obligation status if needed',
      'Generate summary report'
    ]
  },
  obligation_overdue_escalation: {
    type: 'obligation_overdue_escalation',
    description: 'Escalate overdue obligations to appropriate stakeholders',
    priority: 'critical' as const,
    planningHints: [
      'Identify all overdue obligations',
      'Determine escalation level based on days overdue',
      'Identify appropriate escalation contacts',
      'Send escalation notifications',
      'Update obligation status to overdue',
      'Create action items for resolution'
    ]
  },
  obligation_compliance_audit: {
    type: 'obligation_compliance_audit',
    description: 'Audit obligation compliance across contracts',
    priority: 'medium' as const,
    planningHints: [
      'Query all obligations for the audit period',
      'Calculate completion rates by type and owner',
      'Identify patterns in missed obligations',
      'Assess financial impact of compliance issues',
      'Generate compliance report',
      'Recommend process improvements'
    ]
  },
  obligation_recurring_generation: {
    type: 'obligation_recurring_generation',
    description: 'Generate next occurrence for recurring obligations',
    priority: 'medium' as const,
    planningHints: [
      'Query completed recurring obligations',
      'Calculate next due dates',
      'Create new obligation instances',
      'Copy relevant details and evidence requirements',
      'Notify responsible parties',
      'Update recurrence tracking'
    ]
  }
};

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

let obligationAgent: ObligationTrackingAgent | null = null;

export function getObligationTrackingAgent(prisma?: PrismaClient): ObligationTrackingAgent {
  if (!obligationAgent) {
    obligationAgent = new ObligationTrackingAgent(prisma);
  }
  return obligationAgent;
}

export default ObligationTrackingAgent;
