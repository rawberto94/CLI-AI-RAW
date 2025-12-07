/**
 * Services Index
 * 
 * Central export point for all service classes.
 */

// Metadata Schema Service
export {
  MetadataSchemaService,
  type MetadataFieldDefinition,
  type MetadataFieldType,
  type MetadataSchema,
  type MetadataCategory,
  type SelectOption,
  type ValidationRule,
  type CreateFieldInput,
  type UpdateFieldInput,
} from './metadata-schema.service';

// Auto-Populate Service
export {
  AutoPopulateService,
  getAutoPopulateService,
  autoPopulateContract,
  DEFAULT_AUTO_POPULATE_CONFIG,
  type AutoPopulateConfig,
  type AutoPopulateResult,
  type ReviewQueueItem,
} from './auto-populate.service';

// Analytical Intelligence Service
export {
  AnalyticalIntelligenceService,
} from './analytical-intelligence.service';
