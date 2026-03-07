/**
 * Services Index
 * 
 * Central export point for all service classes.
 */

// API Client Service
export {
  ApiClient,
  getApiClient,
  contractsApi,
  templatesApi,
  approvalsApi,
  analyticsApi,
  uploadApi,
  // Query keys for React Query
  queryKeys,
  // Hooks
  useContracts,
  useContract,
  useContractSummary,
  useCreateContract,
  useUpdateContract,
  useDeleteContract,
  usePendingApprovals,
  useApproveContract,
  useDashboardMetrics,
  // Types
  type Contract,
  type ContractSummary,
  type CreateContractInput,
  type UpdateContractInput,
  type ListContractsParams,
  type PaginatedResponse,
  type Artifact,
  type Template,
  type Approval,
} from './api-client.service';

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

// Email Service
export {
  EmailService,
  type SendEmailOptions,
} from './email.service';
