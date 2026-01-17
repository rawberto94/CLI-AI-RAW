/**
 * Real-Time Extraction Streaming Service
 * 
 * Provides live progress updates during AI extraction:
 * - Field-by-field extraction progress
 * - Streaming partial results
 * - Progress percentage tracking
 * - Phase notifications (parsing, extracting, validating)
 * 
 * @version 1.0.0
 */

import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

const logger = createLogger('extraction-streaming');

// =============================================================================
// TYPES
// =============================================================================

export type ExtractionPhase = 
  | 'initializing'
  | 'parsing_document'
  | 'classifying_contract'
  | 'extracting_fields'
  | 'validating_results'
  | 'cross_checking'
  | 'finalizing'
  | 'completed'
  | 'error';

export interface ExtractionProgress {
  sessionId: string;
  contractId: string;
  phase: ExtractionPhase;
  phaseProgress: number; // 0-100 within current phase
  overallProgress: number; // 0-100 total
  currentField?: string;
  extractedFields: string[];
  pendingFields: string[];
  partialResults: Record<string, unknown>;
  startedAt: Date;
  estimatedCompletion?: Date;
  messages: ProgressMessage[];
}

export interface ProgressMessage {
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface StreamingConfig {
  includePartialResults: boolean;
  updateIntervalMs: number;
  includeFieldConfidence: boolean;
  verboseLogging: boolean;
}

export interface ExtractionSession {
  id: string;
  contractId: string;
  tenantId: string;
  artifactTypes: string[];
  config: StreamingConfig;
  progress: ExtractionProgress;
  subscribers: Set<(event: ExtractionEvent) => void>;
  createdAt: Date;
  completedAt?: Date;
}

export interface ExtractionEvent {
  type: 'progress' | 'field_extracted' | 'phase_change' | 'error' | 'complete';
  sessionId: string;
  timestamp: Date;
  data: unknown;
}

// =============================================================================
// PHASE WEIGHTS
// =============================================================================

const PHASE_WEIGHTS: Record<ExtractionPhase, { start: number; end: number }> = {
  initializing: { start: 0, end: 5 },
  parsing_document: { start: 5, end: 15 },
  classifying_contract: { start: 15, end: 25 },
  extracting_fields: { start: 25, end: 80 },
  validating_results: { start: 80, end: 90 },
  cross_checking: { start: 90, end: 95 },
  finalizing: { start: 95, end: 100 },
  completed: { start: 100, end: 100 },
  error: { start: 0, end: 0 },
};

// =============================================================================
// EXTRACTION STREAMING SERVICE
// =============================================================================

export class ExtractionStreamingService extends EventEmitter {
  private static instance: ExtractionStreamingService;
  private sessions: Map<string, ExtractionSession> = new Map();
  private readonly DEFAULT_CONFIG: StreamingConfig = {
    includePartialResults: true,
    updateIntervalMs: 100,
    includeFieldConfidence: true,
    verboseLogging: false,
  };

  private constructor() {
    super();
    this.setMaxListeners(1000); // Support many concurrent sessions
  }

  static getInstance(): ExtractionStreamingService {
    if (!ExtractionStreamingService.instance) {
      ExtractionStreamingService.instance = new ExtractionStreamingService();
    }
    return ExtractionStreamingService.instance;
  }

  // ===========================================================================
  // SESSION MANAGEMENT
  // ===========================================================================

  createSession(
    contractId: string,
    tenantId: string,
    artifactTypes: string[],
    config?: Partial<StreamingConfig>
  ): ExtractionSession {
    const sessionId = `extract_${contractId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const allFields = this.getFieldsForArtifacts(artifactTypes);
    
    const session: ExtractionSession = {
      id: sessionId,
      contractId,
      tenantId,
      artifactTypes,
      config: { ...this.DEFAULT_CONFIG, ...config },
      progress: {
        sessionId,
        contractId,
        phase: 'initializing',
        phaseProgress: 0,
        overallProgress: 0,
        extractedFields: [],
        pendingFields: allFields,
        partialResults: {},
        startedAt: new Date(),
        messages: [],
      },
      subscribers: new Set(),
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.addMessage(sessionId, 'info', 'Extraction session started');
    
    logger.info({ sessionId, contractId, artifactTypes }, 'Created extraction session');
    
    return session;
  }

  getSession(sessionId: string): ExtractionSession | undefined {
    return this.sessions.get(sessionId);
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.completedAt = new Date();
      // Keep session for 5 minutes for late subscribers
      setTimeout(() => this.sessions.delete(sessionId), 5 * 60 * 1000);
    }
  }

  // ===========================================================================
  // SUBSCRIPTION
  // ===========================================================================

  subscribe(
    sessionId: string,
    callback: (event: ExtractionEvent) => void
  ): () => void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.subscribers.add(callback);

    // Send current progress immediately
    callback({
      type: 'progress',
      sessionId,
      timestamp: new Date(),
      data: session.progress,
    });

    // Return unsubscribe function
    return () => {
      session.subscribers.delete(callback);
    };
  }

  // ===========================================================================
  // PROGRESS UPDATES
  // ===========================================================================

  updatePhase(
    sessionId: string,
    phase: ExtractionPhase,
    message?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.progress.phase = phase;
    session.progress.phaseProgress = 0;
    session.progress.overallProgress = PHASE_WEIGHTS[phase].start;

    if (message) {
      this.addMessage(sessionId, 'info', message);
    }

    this.emitEvent(sessionId, {
      type: 'phase_change',
      sessionId,
      timestamp: new Date(),
      data: { phase, message },
    });

    this.emitProgress(sessionId);
  }

  updateFieldProgress(
    sessionId: string,
    fieldName: string,
    status: 'extracting' | 'extracted' | 'failed',
    value?: unknown,
    confidence?: number
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (status === 'extracting') {
      session.progress.currentField = fieldName;
    } else if (status === 'extracted') {
      session.progress.extractedFields.push(fieldName);
      session.progress.pendingFields = session.progress.pendingFields.filter(f => f !== fieldName);
      session.progress.currentField = undefined;

      if (session.config.includePartialResults && value !== undefined) {
        session.progress.partialResults[fieldName] = session.config.includeFieldConfidence
          ? { value, confidence }
          : value;
      }

      this.addMessage(sessionId, 'success', `Extracted: ${fieldName}`, fieldName);

      this.emitEvent(sessionId, {
        type: 'field_extracted',
        sessionId,
        timestamp: new Date(),
        data: { field: fieldName, value, confidence },
      });
    } else if (status === 'failed') {
      this.addMessage(sessionId, 'warning', `Failed to extract: ${fieldName}`, fieldName);
    }

    // Update phase progress based on extracted fields
    const totalFields = session.progress.extractedFields.length + session.progress.pendingFields.length;
    if (totalFields > 0) {
      const fieldProgress = (session.progress.extractedFields.length / totalFields) * 100;
      session.progress.phaseProgress = fieldProgress;

      // Calculate overall progress during extraction phase
      if (session.progress.phase === 'extracting_fields') {
        const { start, end } = PHASE_WEIGHTS.extracting_fields;
        session.progress.overallProgress = start + ((end - start) * fieldProgress / 100);
      }
    }

    this.emitProgress(sessionId);
  }

  updateProgress(
    sessionId: string,
    phaseProgress: number,
    message?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.progress.phaseProgress = Math.min(100, Math.max(0, phaseProgress));

    // Calculate overall progress
    const phase = session.progress.phase;
    const { start, end } = PHASE_WEIGHTS[phase];
    session.progress.overallProgress = start + ((end - start) * phaseProgress / 100);

    if (message) {
      this.addMessage(sessionId, 'info', message);
    }

    this.emitProgress(sessionId);
  }

  setError(sessionId: string, error: string, details?: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.progress.phase = 'error';
    this.addMessage(sessionId, 'error', error, undefined, details);

    this.emitEvent(sessionId, {
      type: 'error',
      sessionId,
      timestamp: new Date(),
      data: { error, details },
    });

    this.endSession(sessionId);
  }

  complete(sessionId: string, results: Record<string, unknown>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.progress.phase = 'completed';
    session.progress.phaseProgress = 100;
    session.progress.overallProgress = 100;
    session.progress.partialResults = results;

    this.addMessage(sessionId, 'success', 'Extraction completed successfully');

    this.emitEvent(sessionId, {
      type: 'complete',
      sessionId,
      timestamp: new Date(),
      data: { results, duration: Date.now() - session.createdAt.getTime() },
    });

    this.endSession(sessionId);
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private addMessage(
    sessionId: string,
    type: ProgressMessage['type'],
    message: string,
    field?: string,
    details?: Record<string, unknown>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.progress.messages.push({
      timestamp: new Date(),
      type,
      message,
      field,
      details,
    });

    // Keep last 100 messages
    if (session.progress.messages.length > 100) {
      session.progress.messages = session.progress.messages.slice(-100);
    }
  }

  private emitProgress(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.emitEvent(sessionId, {
      type: 'progress',
      sessionId,
      timestamp: new Date(),
      data: session.progress,
    });
  }

  private emitEvent(sessionId: string, event: ExtractionEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const callback of session.subscribers) {
      try {
        callback(event);
      } catch (error) {
        logger.error({ error, sessionId }, 'Error in subscriber callback');
      }
    }

    // Also emit on EventEmitter for global listeners
    this.emit('extraction_event', event);
  }

  private getFieldsForArtifacts(artifactTypes: string[]): string[] {
    const fieldsByType: Record<string, string[]> = {
      KeyDatesArtifact: ['effectiveDate', 'expirationDate', 'renewalDate', 'terminationNoticeDate', 'signatureDate'],
      PartiesArtifact: ['parties', 'primaryParty', 'counterparties', 'signatories'],
      FinancialTermsArtifact: ['totalValue', 'paymentTerms', 'currency', 'penalties', 'bonuses'],
      ObligationsArtifact: ['buyerObligations', 'sellerObligations', 'mutualObligations', 'deliverables'],
      TerminationClausesArtifact: ['terminationConditions', 'noticePeriod', 'penalties', 'survivalClauses'],
      RenewalTermsArtifact: ['autoRenewal', 'renewalPeriod', 'renewalNotice', 'priceAdjustment'],
      ConfidentialityArtifact: ['scope', 'duration', 'exceptions', 'returnRequirements'],
      ComplianceArtifact: ['regulations', 'certifications', 'auditRights', 'dataProtection'],
    };

    const fields: string[] = [];
    for (const type of artifactTypes) {
      fields.push(...(fieldsByType[type] || []));
    }
    return [...new Set(fields)];
  }

  // ===========================================================================
  // SSE HELPERS
  // ===========================================================================

  formatSSEMessage(event: ExtractionEvent): string {
    const data = JSON.stringify(event);
    return `event: ${event.type}\ndata: ${data}\n\n`;
  }

  createSSEStream(sessionId: string): ReadableStream {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;

    return new ReadableStream({
      start: (controller) => {
        unsubscribe = this.subscribe(sessionId, (event) => {
          try {
            const message = this.formatSSEMessage(event);
            controller.enqueue(encoder.encode(message));

            if (event.type === 'complete' || event.type === 'error') {
              controller.close();
            }
          } catch {
            // Stream closed
          }
        });
      },
      cancel: () => {
        if (unsubscribe) {
          unsubscribe();
        }
      },
    });
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const extractionStreamingService = ExtractionStreamingService.getInstance();
