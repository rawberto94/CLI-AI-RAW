/**
 * Architecture Utilities
 * Central export for all architecture patterns and utilities
 * 
 * @module @/lib/architecture
 */

// ============================================================================
// Result Pattern
// ============================================================================
export {
  // Core types
  Result,
  Success,
  Failure,
  type AppResult,
  type AppError,
  AppError as AppErrorFactory,
  
  // Utilities
  resultify,
  assert,
  validate as validateResult,
} from './result';

// ============================================================================
// API Responses
// ============================================================================
export {
  // Response creators
  success,
  created,
  noContent,
  paginated,
  error,
  errors,
  fromAppError,
  
  // Types
  type ApiSuccessResponse,
  type ApiErrorResponse,
  type ApiResponse,
  type ResponseMeta,
  type PaginatedData,
  
  // Helpers
  withErrorHandler,
  parseBody,
  parseQuery,
  withCors,
  withCache,
  getErrorMessage,
} from './api-response';

// ============================================================================
// Constants
// ============================================================================
export {
  API,
  UPLOAD,
  PAGINATION,
  CACHE,
  UI,
  CONTRACT,
  VALIDATION as VALIDATION_RULES,
  FEATURES,
  ERROR_CODES,
  STORAGE_KEYS,
  DATE_FORMATS,
  CURRENCY,
  CONSTANTS,
} from './constants';

// ============================================================================
// Service Base
// ============================================================================
export {
  BaseService,
  createSingleton,
  registerService,
  getService,
  hasService,
  type ServiceConfig,
  type FetchOptions,
} from './service-base';

// ============================================================================
// Event Emitter
// ============================================================================
export {
  TypedEventEmitter,
  eventBus,
  useEvent,
  useEmit,
  createNamespacedEmitter,
  createDebouncedEmitter,
  waitForEvent,
  type AppEvents,
  type EventHandler,
  type Unsubscribe,
} from './event-emitter';

// ============================================================================
// Validation
// ============================================================================
export {
  // Core
  validate,
  validateField,
  createSchema,
  
  // Validators
  required,
  optional,
  string,
  minLength,
  maxLength,
  pattern,
  email,
  url,
  uuid,
  trim,
  number,
  integer,
  min,
  max,
  range,
  positive,
  boolean,
  date,
  pastDate,
  futureDate,
  array,
  arrayLength,
  arrayOf,
  oneOf,
  custom,
  transform,
  
  // Preset schemas
  schemas,
  
  // Types
  type Validator,
  type ValidationResult,
  type SchemaValidationResult,
  type Schema,
} from './validation';

// ============================================================================
// Query Builder
// ============================================================================
export {
  QueryBuilder,
  query,
  parseQueryString,
  toPrismaQuery,
  type FilterOperator,
  type SortDirection,
  type Filter,
  type Sort,
  type Pagination,
  type QueryParams,
} from './query-builder';

// ============================================================================
// Data Layer
// ============================================================================
export {
  BaseRepository,
  PrismaRepository,
  InMemoryRepository,
  TransactionScope,
  createQuery,
  type Entity,
  type PaginatedResult,
  type Repository,
  type UnitOfWork,
} from './data-layer';

// ============================================================================
// Async Utilities
// ============================================================================
export {
  // Core async patterns
  retry,
  timeout,
  debounceAsync,
  throttleAsync,
  
  // Parallel execution
  pLimit as parallel,
  pSeries as sequential,
  
  // Data processing
  pMap as asyncMap,
  pFilter as asyncFilter,
  asyncReduce,
  
  // Error handling
  tryCatch,
  to,
  
  // Utilities
  sleep,
  defer,
  poll,
  createAbortController,
  abortableFetch,
  retryable,
  
  // Classes
  Mutex,
  Semaphore,
  
  // Types
  type Deferred,
  type RetryOptions,
} from './async-utils';

// ============================================================================
// Request Utilities
// ============================================================================
export {
  // Request deduplication
  createDeduplicatedFetcher,
  
  // Batching (DataLoader pattern)
  Batcher,
  createBatcher,
  
  // Request queue
  RequestQueue,
  createRequestQueue,
  
  // SWR-like caching
  SWRCache,
  createSWRCache,
} from './request-utils';

// ============================================================================
// State Machine
// ============================================================================
export {
  // Core
  createMachine,
  useMachine,
  
  // Helpers
  createLoadingMachine,
  createUploadMachine,
  createFormMachine,
  createWizardMachine,
  
  // Types
  type MachineConfig,
  type StateNode,
  type MachineState,
  type MachineEvent,
  type UseMachineReturn,
} from './state-machine';

// ============================================================================
// Formatters (re-export existing)
// ============================================================================
export {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercentage,
  formatFileSize,
  formatDuration,
  formatRelativeTime,
  truncate,
  capitalize,
  titleCase,
} from './utils/formatters';
