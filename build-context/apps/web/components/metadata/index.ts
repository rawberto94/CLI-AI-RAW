/**
 * Metadata Components Index
 * 
 * Export all metadata-related components for easy importing.
 */

// Main components
export { AIMetadataExtractor } from './AIMetadataExtractor';
export { SmartMetadataValidator } from './SmartMetadataValidator';
export { SmartReExtraction } from './SmartReExtraction';
export { MetadataExtractionStatus } from './MetadataExtractionStatus';
export { BulkExtractionDashboard } from './BulkExtractionDashboard';

// Re-export types from extractor
export type {
  ExtractionResult,
  ExtractionSummary,
  MetadataExtractionResult,
  ExtractionOptions,
} from '@/lib/ai/metadata-extractor';
