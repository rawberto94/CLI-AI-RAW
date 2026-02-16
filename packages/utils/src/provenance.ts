/**
 * Provenance Utilities
 * 
 * Provides comprehensive provenance tracking for data artifacts,
 * including source attribution, transformation history, and lineage.
 */

export interface ProvenanceSource {
  chunkIds: string[];
  pages: number[];
  documentId?: string;
  documentName?: string;
  extractedAt?: string;
}

export interface ProvenanceTransformation {
  operation: string;
  timestamp: string;
  inputHash?: string;
  outputHash?: string;
  parameters?: Record<string, unknown>;
  model?: string;
  version?: string;
}

export interface ProvenanceRecord {
  id: string;
  artifactId: string;
  artifactType: string;
  sources: ProvenanceSource[];
  transformations: ProvenanceTransformation[];
  createdAt: string;
  updatedAt: string;
  confidence?: number;
  validatedBy?: string;
  validatedAt?: string;
}

/**
 * Create a basic provenance record from chunk IDs and page numbers
 */
export const createProvenance = (
  chunkIds: string[], 
  pages: number[],
  options?: {
    documentId?: string;
    documentName?: string;
  }
): ProvenanceSource => {
  return { 
    chunkIds, 
    pages,
    documentId: options?.documentId,
    documentName: options?.documentName,
    extractedAt: new Date().toISOString(),
  };
};

/**
 * Create a full provenance record for an artifact
 */
export const createProvenanceRecord = (
  artifactId: string,
  artifactType: string,
  sources: ProvenanceSource[],
  transformations?: ProvenanceTransformation[]
): ProvenanceRecord => {
  const now = new Date().toISOString();
  return {
    id: `prov-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    artifactId,
    artifactType,
    sources,
    transformations: transformations || [],
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Add a transformation step to a provenance record
 */
export const addTransformation = (
  record: ProvenanceRecord,
  operation: string,
  options?: {
    inputHash?: string;
    outputHash?: string;
    parameters?: Record<string, unknown>;
    model?: string;
    version?: string;
  }
): ProvenanceRecord => {
  const transformation: ProvenanceTransformation = {
    operation,
    timestamp: new Date().toISOString(),
    ...options,
  };

  return {
    ...record,
    transformations: [...record.transformations, transformation],
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Merge multiple provenance sources
 */
export const mergeSources = (sources: ProvenanceSource[]): ProvenanceSource => {
  const allChunkIds = new Set<string>();
  const allPages = new Set<number>();
  let documentId: string | undefined;
  let documentName: string | undefined;
  let earliestExtraction: string | undefined;

  for (const source of sources) {
    source.chunkIds.forEach(id => allChunkIds.add(id));
    source.pages.forEach(page => allPages.add(page));
    if (source.documentId && !documentId) documentId = source.documentId;
    if (source.documentName && !documentName) documentName = source.documentName;
    if (source.extractedAt) {
      if (!earliestExtraction || source.extractedAt < earliestExtraction) {
        earliestExtraction = source.extractedAt;
      }
    }
  }

  return {
    chunkIds: Array.from(allChunkIds),
    pages: Array.from(allPages).sort((a, b) => a - b),
    documentId,
    documentName,
    extractedAt: earliestExtraction,
  };
};

/**
 * Calculate a hash for content (for tracking transformations)
 */
export const hashContent = async (content: string): Promise<string> => {
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js environment
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
};

/**
 * Validate provenance chain integrity
 */
export const validateProvenanceChain = (record: ProvenanceRecord): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  // Check required fields
  if (!record.id) errors.push('Missing provenance ID');
  if (!record.artifactId) errors.push('Missing artifact ID');
  if (!record.artifactType) errors.push('Missing artifact type');
  if (!record.sources || record.sources.length === 0) {
    errors.push('No sources defined - provenance requires at least one source');
  }

  // Check source integrity
  for (let i = 0; i < record.sources.length; i++) {
    const source = record.sources[i];
    if (!source) continue;
    if (!source.chunkIds || source.chunkIds.length === 0) {
      errors.push(`Source ${i}: No chunk IDs defined`);
    }
    if (!source.pages || source.pages.length === 0) {
      errors.push(`Source ${i}: No page numbers defined`);
    }
  }

  // Check transformation chain
  for (let i = 0; i < record.transformations.length; i++) {
    const transform = record.transformations[i];
    if (!transform) continue;
    if (!transform.operation) {
      errors.push(`Transformation ${i}: Missing operation name`);
    }
    if (!transform.timestamp) {
      errors.push(`Transformation ${i}: Missing timestamp`);
    }
    // Check chronological order
    if (i > 0) {
      const prev = record.transformations[i - 1];
      if (prev && transform.timestamp < prev.timestamp) {
        errors.push(`Transformation ${i}: Timestamp is earlier than previous transformation`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Create a citation string from provenance
 */
export const formatCitation = (source: ProvenanceSource): string => {
  const parts: string[] = [];
  
  if (source.documentName) {
    parts.push(source.documentName);
  } else if (source.documentId) {
    parts.push(`Document ${source.documentId}`);
  }
  
  if (source.pages.length > 0) {
    if (source.pages.length === 1) {
      parts.push(`p. ${source.pages[0]}`);
    } else if (source.pages.length <= 3) {
      parts.push(`pp. ${source.pages.join(', ')}`);
    } else {
      parts.push(`pp. ${source.pages[0]}-${source.pages[source.pages.length - 1]}`);
    }
  }

  return parts.join(', ') || 'Unknown source';
};

/**
 * Serialize provenance for storage
 */
export const serializeProvenance = (record: ProvenanceRecord): string => {
  return JSON.stringify(record);
};

/**
 * Deserialize provenance from storage
 */
export const deserializeProvenance = (data: string): ProvenanceRecord => {
  return JSON.parse(data) as ProvenanceRecord;
};
