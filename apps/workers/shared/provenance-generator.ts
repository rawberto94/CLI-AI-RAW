/**
 * Provenance Generation System
 * Handles audit trail, lineage tracking, and processing metadata
 */

// Provenance entry interface
export interface ProvenanceEntry {
  worker: string;
  timestamp: string;
  durationMs: number;
  model?: string;
  confidenceScore?: number;
  tokens?: TokenUsage;
  version?: string;
  environment?: string;
  correlationId?: string;
  parentId?: string;
  operation?: string;
  inputHash?: string;
  outputHash?: string;
  metadata?: Record<string, any>;
}

// Token usage interface
export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
  cost?: number;
}

// Processing metrics interface
export interface ProcessingMetrics {
  startTime: Date;
  endTime: Date;
  duration: number;
  memoryUsage?: MemoryUsage;
  cpuUsage?: number;
  errorCount?: number;
  retryCount?: number;
}

// Memory usage interface
export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

// Lineage entry interface
export interface LineageEntry {
  artifactId: string;
  artifactType: string;
  contractId: string;
  dependencies: string[];
  derivedFrom: string[];
  influences: string[];
  createdAt: string;
  version: string;
}

// Audit trail entry interface
export interface AuditTrailEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  resource: string;
  details: Record<string, any>;
  outcome: 'success' | 'failure' | 'partial';
  correlationId?: string;
}

/**
 * Provenance Generator
 * Creates comprehensive provenance and audit information
 */
export class ProvenanceGenerator {
  private lineageMap: Map<string, LineageEntry> = new Map();
  private auditTrail: AuditTrailEntry[] = [];
  private correlationIds: Map<string, string[]> = new Map();

  /**
   * Generate standardized provenance entry
   */
  generateProvenance(
    worker: string,
    metrics: ProcessingMetrics,
    options: {
      model?: string;
      confidence?: number;
      tokens?: TokenUsage;
      operation?: string;
      correlationId?: string;
      parentId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): ProvenanceEntry {
    const entry: ProvenanceEntry = {
      worker,
      timestamp: new Date().toISOString(),
      durationMs: metrics.duration,
      version: this.getWorkerVersion(worker),
      environment: process.env.NODE_ENV || 'development',
      ...options
    };

    // Add input/output hashes if metadata contains data
    if (options.metadata?.inputData) {
      entry.inputHash = this.generateHash(options.metadata.inputData);
    }
    if (options.metadata?.outputData) {
      entry.outputHash = this.generateHash(options.metadata.outputData);
    }

    return entry;
  }

  /**
   * Generate provenance for LLM operations
   */
  generateLLMProvenance(
    worker: string,
    operation: string,
    metrics: ProcessingMetrics,
    llmResponse: {
      model: string;
      confidence: number;
      tokens: TokenUsage;
    },
    correlationId?: string
  ): ProvenanceEntry {
    return this.generateProvenance(worker, metrics, {
      model: llmResponse.model,
      confidence: llmResponse.confidence,
      tokens: llmResponse.tokens,
      operation: `llm_${operation}`,
      correlationId,
      metadata: {
        llmOperation: operation,
        tokenCost: llmResponse.tokens.cost,
        modelVersion: llmResponse.model
      }
    });
  }

  /**
   * Generate provenance for database operations
   */
  generateDatabaseProvenance(
    worker: string,
    operation: string,
    metrics: ProcessingMetrics,
    details: {
      query?: string;
      affectedRows?: number;
      connectionPool?: string;
    },
    correlationId?: string
  ): ProvenanceEntry {
    return this.generateProvenance(worker, metrics, {
      operation: `db_${operation}`,
      correlationId,
      metadata: {
        databaseOperation: operation,
        queryType: details.query ? this.extractQueryType(details.query) : undefined,
        affectedRows: details.affectedRows,
        connectionPool: details.connectionPool
      }
    });
  }

  /**
   * Generate provenance for artifact creation
   */
  generateArtifactProvenance(
    worker: string,
    artifactType: string,
    contractId: string,
    metrics: ProcessingMetrics,
    options: {
      confidence?: number;
      dataSize?: number;
      validationResult?: any;
      correlationId?: string;
    } = {}
  ): ProvenanceEntry {
    return this.generateProvenance(worker, metrics, {
      operation: 'artifact_creation',
      confidence: options.confidence,
      correlationId: options.correlationId,
      metadata: {
        artifactType,
        contractId,
        dataSize: options.dataSize,
        validationPassed: options.validationResult?.isValid,
        validationErrors: options.validationResult?.errors?.length || 0
      }
    });
  }

  /**
   * Create lineage entry for artifact
   */
  createLineageEntry(
    artifactId: string,
    artifactType: string,
    contractId: string,
    dependencies: string[] = [],
    derivedFrom: string[] = []
  ): LineageEntry {
    const entry: LineageEntry = {
      artifactId,
      artifactType,
      contractId,
      dependencies,
      derivedFrom,
      influences: [],
      createdAt: new Date().toISOString(),
      version: '1.0'
    };

    // Update influences for derived artifacts
    for (const sourceId of derivedFrom) {
      const sourceEntry = this.lineageMap.get(sourceId);
      if (sourceEntry) {
        sourceEntry.influences.push(artifactId);
      }
    }

    this.lineageMap.set(artifactId, entry);
    return entry;
  }

  /**
   * Create audit trail entry
   */
  createAuditEntry(
    action: string,
    actor: string,
    resource: string,
    outcome: 'success' | 'failure' | 'partial',
    details: Record<string, any> = {},
    correlationId?: string
  ): AuditTrailEntry {
    const entry: AuditTrailEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      action,
      actor,
      resource,
      details,
      outcome,
      correlationId
    };

    this.auditTrail.push(entry);
    
    // Maintain audit trail size
    if (this.auditTrail.length > 10000) {
      this.auditTrail = this.auditTrail.slice(-5000);
    }

    return entry;
  }

  /**
   * Track correlation across operations
   */
  trackCorrelation(correlationId: string, operationId: string): void {
    if (!this.correlationIds.has(correlationId)) {
      this.correlationIds.set(correlationId, []);
    }
    this.correlationIds.get(correlationId)!.push(operationId);
  }

  /**
   * Get lineage for artifact
   */
  getArtifactLineage(artifactId: string): {
    entry: LineageEntry | null;
    ancestors: LineageEntry[];
    descendants: LineageEntry[];
  } {
    const entry = this.lineageMap.get(artifactId);
    if (!entry) {
      return { entry: null, ancestors: [], descendants: [] };
    }

    const ancestors = this.getAncestors(artifactId, new Set());
    const descendants = this.getDescendants(artifactId, new Set());

    return { entry, ancestors, descendants };
  }

  /**
   * Get operations by correlation ID
   */
  getCorrelatedOperations(correlationId: string): string[] {
    return this.correlationIds.get(correlationId) || [];
  }

  /**
   * Get audit trail for resource
   */
  getAuditTrail(
    resource?: string,
    timeRange?: { start: Date; end: Date },
    limit: number = 100
  ): AuditTrailEntry[] {
    let filtered = [...this.auditTrail];

    if (resource) {
      filtered = filtered.filter(entry => entry.resource === resource);
    }

    if (timeRange) {
      filtered = filtered.filter(entry => {
        const entryTime = new Date(entry.timestamp);
        return entryTime >= timeRange.start && entryTime <= timeRange.end;
      });
    }

    return filtered.slice(-limit);
  }

  /**
   * Generate processing integrity report
   */
  generateIntegrityReport(artifactId: string): {
    isValid: boolean;
    issues: string[];
    lineageComplete: boolean;
    provenanceComplete: boolean;
    auditTrailComplete: boolean;
  } {
    const issues: string[] = [];
    const lineage = this.lineageMap.get(artifactId);

    let lineageComplete = true;
    let provenanceComplete = true;
    let auditTrailComplete = true;

    if (!lineage) {
      issues.push('No lineage information found');
      lineageComplete = false;
    } else {
      // Check if all dependencies exist
      for (const depId of lineage.dependencies) {
        if (!this.lineageMap.has(depId)) {
          issues.push(`Missing dependency: ${depId}`);
          lineageComplete = false;
        }
      }
    }

    // Check audit trail
    const auditEntries = this.getAuditTrail(artifactId);
    if (auditEntries.length === 0) {
      issues.push('No audit trail entries found');
      auditTrailComplete = false;
    }

    return {
      isValid: issues.length === 0,
      issues,
      lineageComplete,
      provenanceComplete,
      auditTrailComplete
    };
  }

  /**
   * Export provenance data
   */
  exportProvenanceData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      lineage: Array.from(this.lineageMap.values()),
      auditTrail: this.auditTrail,
      correlations: Object.fromEntries(this.correlationIds),
      exportedAt: new Date().toISOString()
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // Simple CSV export for audit trail
      const headers = ['timestamp', 'action', 'actor', 'resource', 'outcome'];
      const rows = this.auditTrail.map(entry => [
        entry.timestamp,
        entry.action,
        entry.actor,
        entry.resource,
        entry.outcome
      ]);
      
      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }
  }

  /**
   * Get ancestors recursively
   */
  private getAncestors(artifactId: string, visited: Set<string>): LineageEntry[] {
    if (visited.has(artifactId)) return [];
    visited.add(artifactId);

    const entry = this.lineageMap.get(artifactId);
    if (!entry) return [];

    const ancestors: LineageEntry[] = [];
    
    for (const sourceId of entry.derivedFrom) {
      const sourceEntry = this.lineageMap.get(sourceId);
      if (sourceEntry) {
        ancestors.push(sourceEntry);
        ancestors.push(...this.getAncestors(sourceId, visited));
      }
    }

    return ancestors;
  }

  /**
   * Get descendants recursively
   */
  private getDescendants(artifactId: string, visited: Set<string>): LineageEntry[] {
    if (visited.has(artifactId)) return [];
    visited.add(artifactId);

    const entry = this.lineageMap.get(artifactId);
    if (!entry) return [];

    const descendants: LineageEntry[] = [];
    
    for (const influenceId of entry.influences) {
      const influenceEntry = this.lineageMap.get(influenceId);
      if (influenceEntry) {
        descendants.push(influenceEntry);
        descendants.push(...this.getDescendants(influenceId, visited));
      }
    }

    return descendants;
  }

  /**
   * Generate hash for data integrity
   */
  private generateHash(data: any): string {
    // Simple hash function - in production, use crypto.createHash
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get worker version
   */
  private getWorkerVersion(worker: string): string {
    // In a real implementation, this would read from package.json or version file
    return process.env.WORKER_VERSION || '1.0.0';
  }

  /**
   * Extract query type from SQL
   */
  private extractQueryType(query: string): string {
    const trimmed = query.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    if (trimmed.startsWith('CREATE')) return 'CREATE';
    if (trimmed.startsWith('DROP')) return 'DROP';
    return 'OTHER';
  }
}

/**
 * Singleton instance
 */
let provenanceGenerator: ProvenanceGenerator | null = null;

/**
 * Get shared provenance generator instance
 */
export function getProvenanceGenerator(): ProvenanceGenerator {
  if (!provenanceGenerator) {
    provenanceGenerator = new ProvenanceGenerator();
  }
  return provenanceGenerator;
}

/**
 * Convenience functions
 */
export const generateProvenance = (
  worker: string,
  metrics: ProcessingMetrics,
  options?: any
) => getProvenanceGenerator().generateProvenance(worker, metrics, options);

export const generateLLMProvenance = (
  worker: string,
  operation: string,
  metrics: ProcessingMetrics,
  llmResponse: any,
  correlationId?: string
) => getProvenanceGenerator().generateLLMProvenance(worker, operation, metrics, llmResponse, correlationId);

export const createLineageEntry = (
  artifactId: string,
  artifactType: string,
  contractId: string,
  dependencies?: string[],
  derivedFrom?: string[]
) => getProvenanceGenerator().createLineageEntry(artifactId, artifactType, contractId, dependencies, derivedFrom);

export const createAuditEntry = (
  action: string,
  actor: string,
  resource: string,
  outcome: 'success' | 'failure' | 'partial',
  details?: Record<string, any>,
  correlationId?: string
) => getProvenanceGenerator().createAuditEntry(action, actor, resource, outcome, details, correlationId);