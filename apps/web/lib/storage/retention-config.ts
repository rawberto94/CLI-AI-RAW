/**
 * Document Storage Configuration
 * 
 * Controls how long original documents are retained.
 * For "interface-only" mode, documents can be auto-deleted after processing
 * while still allowing preview via signed URLs during retention period.
 */

export interface StorageRetentionConfig {
  /**
   * Storage mode
   * - 'full': Keep documents indefinitely (default)
   * - 'retention': Keep for specified days, then delete
   * - 'minimal': Delete immediately after processing (metadata only)
   */
  mode: 'full' | 'retention' | 'minimal';
  
  /**
   * Days to retain documents (only used in 'retention' mode)
   * Default: 90 days
   */
  retentionDays: number;
  
  /**
   * Keep thumbnail/preview images even after deleting original
   * Useful for showing visual previews in contract lists
   */
  keepThumbnails: boolean;
  
  /**
   * Keep extracted text for search (always recommended)
   */
  keepExtractedText: boolean;
}

// Default configuration - adjust based on client needs
export const DEFAULT_STORAGE_CONFIG: StorageRetentionConfig = {
  mode: 'retention',        // Keep docs for limited time
  retentionDays: 90,        // 90 days = ~3 months
  keepThumbnails: true,     // Keep visual previews
  keepExtractedText: true,  // Keep searchable text
};

// Minimal storage for GDPR-conscious deployments
export const MINIMAL_STORAGE_CONFIG: StorageRetentionConfig = {
  mode: 'minimal',
  retentionDays: 0,
  keepThumbnails: true,     // Still show previews
  keepExtractedText: true,  // Still searchable
};

// Full storage for clients who want document archive
export const FULL_STORAGE_CONFIG: StorageRetentionConfig = {
  mode: 'full',
  retentionDays: 0,         // Ignored in full mode
  keepThumbnails: true,
  keepExtractedText: true,
};

/**
 * Get storage config from environment
 */
export function getStorageConfig(): StorageRetentionConfig {
  const mode = process.env.STORAGE_MODE as StorageRetentionConfig['mode'] || 'retention';
  const retentionDays = parseInt(process.env.STORAGE_RETENTION_DAYS || '90', 10);
  
  return {
    mode,
    retentionDays,
    keepThumbnails: process.env.STORAGE_KEEP_THUMBNAILS !== 'false',
    keepExtractedText: process.env.STORAGE_KEEP_TEXT !== 'false',
  };
}

/**
 * Check if document should be accessible based on retention policy
 */
export function isDocumentAccessible(
  uploadedAt: Date,
  config: StorageRetentionConfig = getStorageConfig()
): boolean {
  if (config.mode === 'full') return true;
  if (config.mode === 'minimal') return false;
  
  // Retention mode - check if within retention period
  const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(uploadedAt.getTime() + retentionMs);
  return new Date() < expiresAt;
}

/**
 * Get documents that should be cleaned up
 */
export function getDocumentsForCleanup(
  documents: Array<{ id: string; uploadedAt: Date; storagePath?: string | null }>,
  config: StorageRetentionConfig = getStorageConfig()
): string[] {
  if (config.mode === 'full') return [];
  
  const now = new Date();
  const retentionMs = config.retentionDays * 24 * 60 * 60 * 1000;
  
  return documents
    .filter(doc => {
      if (!doc.storagePath) return false;
      if (config.mode === 'minimal') return true;
      
      const expiresAt = new Date(doc.uploadedAt.getTime() + retentionMs);
      return now >= expiresAt;
    })
    .map(doc => doc.id);
}

/**
 * Calculate storage estimate for a client
 */
export function estimateStorage(
  contractCount: number,
  config: StorageRetentionConfig = getStorageConfig()
): {
  documentsGB: number;
  metadataGB: number;
  totalGB: number;
  monthlyCostUSD: number;
} {
  const avgDocSizeMB = 2; // Average PDF size
  const avgMetadataKB = 50; // Metadata + embeddings + extracted text
  const avgThumbnailKB = 50;
  
  let documentsGB = 0;
  
  if (config.mode === 'full') {
    documentsGB = (contractCount * avgDocSizeMB) / 1024;
  } else if (config.mode === 'retention') {
    // Assume ~30% of contracts are within retention period
    documentsGB = (contractCount * 0.3 * avgDocSizeMB) / 1024;
  }
  // minimal mode = 0 documents stored
  
  const metadataGB = (contractCount * avgMetadataKB) / 1024 / 1024;
  const thumbnailsGB = config.keepThumbnails 
    ? (contractCount * avgThumbnailKB) / 1024 / 1024 
    : 0;
  
  const totalGB = documentsGB + metadataGB + thumbnailsGB;
  
  // Azure Blob Storage pricing: ~$0.02/GB/month
  const monthlyCostUSD = totalGB * 0.02;
  
  return {
    documentsGB: Math.round(documentsGB * 100) / 100,
    metadataGB: Math.round(metadataGB * 100) / 100,
    totalGB: Math.round(totalGB * 100) / 100,
    monthlyCostUSD: Math.round(monthlyCostUSD * 100) / 100,
  };
}
