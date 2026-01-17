/**
 * AI Obligation Tracker Service
 * 
 * Intelligent extraction and tracking of contract obligations:
 * - Automatic obligation extraction from contracts
 * - Deadline and milestone tracking
 * - Obligation categorization and prioritization
 * - Proactive alerts and reminders
 * - Compliance monitoring
 * 
 * @version 1.0.0
 */

import { randomUUID } from 'crypto';

// Types
export type ObligationType = 
  | 'payment'
  | 'delivery'
  | 'service_level'
  | 'reporting'
  | 'compliance'
  | 'notice'
  | 'renewal'
  | 'termination'
  | 'confidentiality'
  | 'audit'
  | 'insurance'
  | 'indemnification'
  | 'warranty'
  | 'other';

export type ObligationStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'waived'
  | 'disputed';

export type ObligationPriority = 'critical' | 'high' | 'medium' | 'low';

export type RecurrencePattern = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

export interface Obligation {
  id: string;
  tenantId: string;
  contractId: string;
  
  // Core details
  title: string;
  description: string;
  type: ObligationType;
  priority: ObligationPriority;
  status: ObligationStatus;
  
  // Responsible parties
  obligor: string; // Who must fulfill
  obligee: string; // Who benefits
  assignedTo?: string; // Internal user
  
  // Timing
  dueDate?: Date;
  startDate?: Date;
  endDate?: Date;
  recurrence?: RecurrencePattern;
  reminderDays?: number[];
  
  // Source
  clauseReference?: string;
  pageNumber?: number;
  excerpt?: string;
  extractionConfidence: number;
  
  // Compliance
  completionCriteria?: string;
  evidenceRequired?: string[];
  attachments?: string[];
  completedAt?: Date;
  completedBy?: string;
  completionNotes?: string;
  
  // Metadata
  tags?: string[];
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ObligationAlert {
  id: string;
  obligationId: string;
  type: 'upcoming' | 'due_today' | 'overdue' | 'at_risk';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  daysUntilDue: number;
  sentAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
}

export interface ObligationSummary {
  total: number;
  byStatus: Record<ObligationStatus, number>;
  byType: Record<ObligationType, number>;
  byPriority: Record<ObligationPriority, number>;
  upcoming7Days: number;
  upcoming30Days: number;
  overdue: number;
  atRisk: number;
  completionRate: number;
}

export interface ExtractionResult {
  obligations: Obligation[];
  confidence: number;
  warnings: string[];
  suggestions: string[];
}

export interface ComplianceSnapshot {
  date: Date;
  contractId: string;
  totalObligations: number;
  compliantCount: number;
  nonCompliantCount: number;
  complianceRate: number;
  overdueObligations: Obligation[];
  upcomingObligations: Obligation[];
  riskScore: number;
}

const OBLIGATION_PATTERNS: Record<ObligationType, RegExp[]> = {
  payment: [
    /shall pay|payment due|invoice|billing|remit|compensat/i,
    /net \d+|within \d+ days|upon receipt/i,
  ],
  delivery: [
    /shall deliver|delivery date|ship|provide.*within/i,
    /deliverables|milestones|completion/i,
  ],
  service_level: [
    /service level|SLA|uptime|availability|response time/i,
    /performance metric|target|threshold/i,
  ],
  reporting: [
    /shall report|provide.*report|submit.*report/i,
    /monthly report|quarterly report|annual report/i,
  ],
  compliance: [
    /comply with|compliance|adherence|conform/i,
    /regulation|law|statute|requirement/i,
  ],
  notice: [
    /shall notify|provide notice|written notice/i,
    /days.*(notice|prior)|advance notice/i,
  ],
  renewal: [
    /renewal|renew|extend.*term|automatic.*renewal/i,
    /opt.out|non.renewal/i,
  ],
  termination: [
    /termination|terminate|cancellation|cancel/i,
    /right to terminate|grounds for termination/i,
  ],
  confidentiality: [
    /confidential|non.disclosure|proprietary/i,
    /shall not disclose|protect.*information/i,
  ],
  audit: [
    /audit right|inspection|examine.*records/i,
    /access to.*books|financial records/i,
  ],
  insurance: [
    /maintain insurance|insurance coverage|liability insurance/i,
    /certificate of insurance|proof of insurance/i,
  ],
  indemnification: [
    /indemnif|hold harmless|defend and indemnify/i,
    /claims|damages|losses/i,
  ],
  warranty: [
    /warrant|warranty|representation/i,
    /defect|workmanship|merchantability/i,
  ],
  other: [],
};

class AIObligationTrackerService {
  private obligations: Map<string, Obligation> = new Map();
  private alerts: Map<string, ObligationAlert[]> = new Map();
  private contractObligations: Map<string, Set<string>> = new Map();

  /**
   * Extract obligations from contract text using AI
   */
  async extractObligations(
    tenantId: string,
    contractId: string,
    contractText: string,
    existingParties?: { client?: string; vendor?: string }
  ): Promise<ExtractionResult> {
    const obligations: Obligation[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Split into sentences for analysis
    const sentences = contractText.split(/[.;]\s+/);
    let overallConfidence = 0;
    let matchCount = 0;

    for (const sentence of sentences) {
      const extracted = this.analyzeSentence(
        sentence,
        tenantId,
        contractId,
        existingParties
      );

      if (extracted) {
        obligations.push(extracted);
        overallConfidence += extracted.extractionConfidence;
        matchCount++;
      }
    }

    // Add extracted obligations to storage
    for (const obl of obligations) {
      this.obligations.set(obl.id, obl);
      
      if (!this.contractObligations.has(contractId)) {
        this.contractObligations.set(contractId, new Set());
      }
      this.contractObligations.get(contractId)!.add(obl.id);
    }

    // Generate warnings
    if (obligations.length === 0) {
      warnings.push('No obligations were detected. The contract may lack clear obligation language.');
    }

    const paymentObls = obligations.filter(o => o.type === 'payment');
    if (paymentObls.length === 0) {
      suggestions.push('No payment obligations detected. Consider reviewing payment terms manually.');
    }

    const noDueDateCount = obligations.filter(o => !o.dueDate).length;
    if (noDueDateCount > obligations.length * 0.5) {
      warnings.push(`${noDueDateCount} obligations lack specific due dates. Manual review recommended.`);
    }

    return {
      obligations,
      confidence: matchCount > 0 ? overallConfidence / matchCount : 0,
      warnings,
      suggestions,
    };
  }

  /**
   * Analyze a sentence for obligations
   */
  private analyzeSentence(
    sentence: string,
    tenantId: string,
    contractId: string,
    parties?: { client?: string; vendor?: string }
  ): Obligation | null {
    // Check for obligation indicators
    const obligationIndicators = [
      /shall|must|will|agrees? to|obligat/i,
      /required to|responsible for|undertakes/i,
    ];

    const hasIndicator = obligationIndicators.some(p => p.test(sentence));
    if (!hasIndicator) return null;

    // Determine obligation type
    let detectedType: ObligationType = 'other';
    let maxConfidence = 0;

    for (const [type, patterns] of Object.entries(OBLIGATION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(sentence)) {
          const confidence = this.calculatePatternConfidence(sentence, pattern);
          if (confidence > maxConfidence) {
            maxConfidence = confidence;
            detectedType = type as ObligationType;
          }
        }
      }
    }

    if (maxConfidence < 0.3) return null;

    // Determine obligor and obligee
    let obligor = 'Unknown';
    let obligee = 'Unknown';

    if (parties?.client && sentence.toLowerCase().includes(parties.client.toLowerCase())) {
      if (/shall|must|will|agrees/i.test(sentence)) {
        obligor = parties.client;
        obligee = parties.vendor || 'Vendor';
      }
    } else if (parties?.vendor && sentence.toLowerCase().includes(parties.vendor.toLowerCase())) {
      obligor = parties.vendor;
      obligee = parties.client || 'Client';
    }

    // Extract due date if present
    const dueDate = this.extractDueDate(sentence);

    // Determine priority
    const priority = this.determinePriority(detectedType, sentence);

    // Generate title
    const title = this.generateTitle(sentence, detectedType);

    return {
      id: randomUUID(),
      tenantId,
      contractId,
      title,
      description: sentence.trim(),
      type: detectedType,
      priority,
      status: 'pending',
      obligor,
      obligee,
      dueDate,
      excerpt: sentence.trim(),
      extractionConfidence: maxConfidence,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Calculate pattern match confidence
   */
  private calculatePatternConfidence(sentence: string, pattern: RegExp): number {
    const match = sentence.match(pattern);
    if (!match) return 0;

    // Base confidence
    let confidence = 0.6;

    // Increase for specific obligation language
    if (/shall|must/i.test(sentence)) confidence += 0.2;
    if (/within \d+/i.test(sentence)) confidence += 0.1;
    if (/by [A-Z]/i.test(sentence)) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract due date from text
   */
  private extractDueDate(text: string): Date | undefined {
    // Look for explicit dates
    const datePatterns = [
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const date = new Date(match[0]);
          if (!isNaN(date.getTime())) return date;
        } catch {
          // Continue to next pattern
        }
      }
    }

    // Look for relative dates
    const daysMatch = text.match(/within (\d+) days/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date;
    }

    return undefined;
  }

  /**
   * Determine obligation priority
   */
  private determinePriority(type: ObligationType, text: string): ObligationPriority {
    // Critical types
    if (['payment', 'compliance', 'termination'].includes(type)) {
      return 'critical';
    }

    // High priority indicators
    if (/immediately|urgent|critical|material/i.test(text)) {
      return 'high';
    }

    // High types
    if (['delivery', 'service_level', 'insurance'].includes(type)) {
      return 'high';
    }

    // Medium types
    if (['reporting', 'notice', 'audit'].includes(type)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate obligation title
   */
  private generateTitle(sentence: string, type: ObligationType): string {
    const typeLabels: Record<ObligationType, string> = {
      payment: 'Payment Obligation',
      delivery: 'Delivery Requirement',
      service_level: 'Service Level Commitment',
      reporting: 'Reporting Requirement',
      compliance: 'Compliance Obligation',
      notice: 'Notice Requirement',
      renewal: 'Renewal Obligation',
      termination: 'Termination Provision',
      confidentiality: 'Confidentiality Obligation',
      audit: 'Audit Right',
      insurance: 'Insurance Requirement',
      indemnification: 'Indemnification Obligation',
      warranty: 'Warranty Commitment',
      other: 'Contract Obligation',
    };

    // Try to extract a more specific title
    const words = sentence.split(' ').slice(0, 8);
    const shortTitle = words.join(' ').replace(/[,;:].*/, '');

    if (shortTitle.length > 10 && shortTitle.length < 60) {
      return shortTitle;
    }

    return typeLabels[type];
  }

  /**
   * Get obligations for a contract
   */
  async getContractObligations(
    tenantId: string,
    contractId: string,
    filters?: {
      status?: ObligationStatus[];
      type?: ObligationType[];
      priority?: ObligationPriority[];
      dueBefore?: Date;
      dueAfter?: Date;
    }
  ): Promise<Obligation[]> {
    const obligationIds = this.contractObligations.get(contractId);
    if (!obligationIds) return [];

    let obligations = Array.from(obligationIds)
      .map(id => this.obligations.get(id)!)
      .filter(o => o && o.tenantId === tenantId);

    if (filters?.status && filters.status.length > 0) {
      obligations = obligations.filter(o => filters.status!.includes(o.status));
    }

    if (filters?.type && filters.type.length > 0) {
      obligations = obligations.filter(o => filters.type!.includes(o.type));
    }

    if (filters?.priority && filters.priority.length > 0) {
      obligations = obligations.filter(o => filters.priority!.includes(o.priority));
    }

    if (filters?.dueBefore) {
      obligations = obligations.filter(o => 
        o.dueDate && o.dueDate <= filters.dueBefore!
      );
    }

    if (filters?.dueAfter) {
      obligations = obligations.filter(o => 
        o.dueDate && o.dueDate >= filters.dueAfter!
      );
    }

    return obligations.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }

  /**
   * Update obligation status
   */
  async updateObligationStatus(
    obligationId: string,
    status: ObligationStatus,
    details?: {
      completedBy?: string;
      completionNotes?: string;
      attachments?: string[];
    }
  ): Promise<Obligation | null> {
    const obligation = this.obligations.get(obligationId);
    if (!obligation) return null;

    obligation.status = status;
    obligation.updatedAt = new Date();

    if (status === 'completed') {
      obligation.completedAt = new Date();
      obligation.completedBy = details?.completedBy;
      obligation.completionNotes = details?.completionNotes;
      if (details?.attachments) {
        obligation.attachments = [
          ...(obligation.attachments || []),
          ...details.attachments,
        ];
      }
    }

    return obligation;
  }

  /**
   * Get summary for tenant
   */
  async getObligationSummary(tenantId: string): Promise<ObligationSummary> {
    const obligations = Array.from(this.obligations.values())
      .filter(o => o.tenantId === tenantId);

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let upcoming7Days = 0;
    let upcoming30Days = 0;
    let overdue = 0;
    let atRisk = 0;
    let completed = 0;

    for (const obl of obligations) {
      byStatus[obl.status] = (byStatus[obl.status] || 0) + 1;
      byType[obl.type] = (byType[obl.type] || 0) + 1;
      byPriority[obl.priority] = (byPriority[obl.priority] || 0) + 1;

      if (obl.status === 'completed') {
        completed++;
      }

      if (obl.dueDate) {
        if (obl.dueDate < now && obl.status !== 'completed') {
          overdue++;
        } else if (obl.dueDate <= in7Days) {
          upcoming7Days++;
        } else if (obl.dueDate <= in30Days) {
          upcoming30Days++;
        }

        // At risk: due within 7 days and not in progress
        if (obl.dueDate <= in7Days && obl.status === 'pending') {
          atRisk++;
        }
      }
    }

    return {
      total: obligations.length,
      byStatus: byStatus as Record<ObligationStatus, number>,
      byType: byType as Record<ObligationType, number>,
      byPriority: byPriority as Record<ObligationPriority, number>,
      upcoming7Days,
      upcoming30Days,
      overdue,
      atRisk,
      completionRate: obligations.length > 0 ? completed / obligations.length : 0,
    };
  }

  /**
   * Generate alerts for upcoming/overdue obligations
   */
  async generateAlerts(tenantId: string): Promise<ObligationAlert[]> {
    const obligations = Array.from(this.obligations.values())
      .filter(o => o.tenantId === tenantId && o.status !== 'completed');

    const now = new Date();
    const alerts: ObligationAlert[] = [];

    for (const obl of obligations) {
      if (!obl.dueDate) continue;

      const daysUntilDue = Math.ceil(
        (obl.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      let alertType: ObligationAlert['type'] | null = null;
      let severity: ObligationAlert['severity'] = 'medium';

      if (daysUntilDue < 0) {
        alertType = 'overdue';
        severity = 'critical';
      } else if (daysUntilDue === 0) {
        alertType = 'due_today';
        severity = 'high';
      } else if (daysUntilDue <= 3 && obl.status === 'pending') {
        alertType = 'at_risk';
        severity = 'high';
      } else if (obl.reminderDays?.includes(daysUntilDue)) {
        alertType = 'upcoming';
        severity = obl.priority === 'critical' ? 'high' : 'medium';
      } else if (daysUntilDue <= 7) {
        alertType = 'upcoming';
        severity = 'medium';
      }

      if (alertType) {
        const alert: ObligationAlert = {
          id: randomUUID(),
          obligationId: obl.id,
          type: alertType,
          severity,
          message: this.generateAlertMessage(obl, alertType, daysUntilDue),
          daysUntilDue,
        };
        alerts.push(alert);
      }
    }

    // Store alerts
    this.alerts.set(tenantId, alerts);

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(
    obl: Obligation,
    type: ObligationAlert['type'],
    daysUntilDue: number
  ): string {
    switch (type) {
      case 'overdue':
        return `OVERDUE: "${obl.title}" was due ${Math.abs(daysUntilDue)} days ago`;
      case 'due_today':
        return `DUE TODAY: "${obl.title}" - ${obl.type} obligation`;
      case 'at_risk':
        return `AT RISK: "${obl.title}" is due in ${daysUntilDue} days and not yet started`;
      case 'upcoming':
        return `UPCOMING: "${obl.title}" is due in ${daysUntilDue} days`;
      default:
        return `"${obl.title}" - ${obl.type}`;
    }
  }

  /**
   * Get compliance snapshot for a contract
   */
  async getComplianceSnapshot(
    tenantId: string,
    contractId: string
  ): Promise<ComplianceSnapshot> {
    const obligations = await this.getContractObligations(tenantId, contractId);
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const compliant = obligations.filter(o => 
      o.status === 'completed' || o.status === 'waived' ||
      (o.status === 'in_progress' && (!o.dueDate || o.dueDate > now))
    );

    const nonCompliant = obligations.filter(o => 
      o.status === 'overdue' || o.status === 'disputed' ||
      (o.dueDate && o.dueDate < now && o.status !== 'completed')
    );

    const overdue = obligations.filter(o => 
      o.dueDate && o.dueDate < now && o.status !== 'completed'
    );

    const upcoming = obligations.filter(o => 
      o.dueDate && o.dueDate >= now && o.dueDate <= in7Days && o.status !== 'completed'
    );

    // Calculate risk score (0-100)
    let riskScore = 0;
    if (obligations.length > 0) {
      const overdueWeight = overdue.length / obligations.length * 50;
      const criticalOverdue = overdue.filter(o => o.priority === 'critical').length;
      const criticalWeight = criticalOverdue * 10;
      const pendingHighPriority = obligations.filter(o => 
        o.status === 'pending' && ['critical', 'high'].includes(o.priority)
      ).length;
      const pendingWeight = pendingHighPriority * 5;

      riskScore = Math.min(100, overdueWeight + criticalWeight + pendingWeight);
    }

    return {
      date: now,
      contractId,
      totalObligations: obligations.length,
      compliantCount: compliant.length,
      nonCompliantCount: nonCompliant.length,
      complianceRate: obligations.length > 0 
        ? compliant.length / obligations.length 
        : 1,
      overdueObligations: overdue,
      upcomingObligations: upcoming,
      riskScore,
    };
  }

  /**
   * Get obligation by ID
   */
  getObligation(obligationId: string): Obligation | null {
    return this.obligations.get(obligationId) || null;
  }

  /**
   * Add manual obligation
   */
  addObligation(obligation: Omit<Obligation, 'id' | 'createdAt' | 'updatedAt'>): Obligation {
    const now = new Date();
    const newObligation: Obligation = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...obligation,
    };

    this.obligations.set(newObligation.id, newObligation);

    if (!this.contractObligations.has(obligation.contractId)) {
      this.contractObligations.set(obligation.contractId, new Set());
    }
    this.contractObligations.get(obligation.contractId)!.add(newObligation.id);

    return newObligation;
  }
}

// Export singleton
export const aiObligationTrackerService = new AIObligationTrackerService();
export { AIObligationTrackerService };
