/**
 * Database Package - Advanced Architecture
 * 
 * This package provides a comprehensive database layer with:
 * - Query caching with intelligent invalidation
 * - Unit of Work pattern for transaction management
 * - Read replica support for horizontal scaling
 * - Optimistic locking for concurrent updates
 * - Audit trail for change tracking
 * - Type-safe query builder
 * - Categorized error handling
 * 
 * @example
 * ```typescript
 * import { 
 *   getEnhancedDatabaseManager,
 *   query,
 *   DatabaseErrorHandler 
 * } from '@your-org/db';
 * 
 * const db = getEnhancedDatabaseManager({
 *   cache: { enabled: true },
 *   audit: { enabled: true },
 * });
 * 
 * await db.initialize();
 * 
 * // Use query builder
 * const contracts = await db.getClient().contract.findMany(
 *   query<Contract>()
 *     .where('tenantId', tenantId)
 *     .whereOp('status', 'not', 'DELETED')
 *     .orderBy('createdAt', 'desc')
 *     .page(1, 20)
 *     .build()
 * );
 * 
 * // Use unit of work
 * await db.scopedWork(async (uow) => {
 *   uow.trackCreate('contract', contractData);
 *   uow.trackCreate('artifact', artifactData);
 *   // Changes committed atomically
 * });
 * ```
 */

// ============================================================================
// CACHE
// ============================================================================

export {
  QueryCache,
  getQueryCache,
  resetQueryCache,
  Cached,
  InvalidatesCache,
  type CacheConfig,
  type CacheEntry,
  type CacheStats,
  type CacheOptions,
  type CacheInvalidationStrategy,
} from '../cache/query-cache';

// ============================================================================
// PATTERNS
// ============================================================================

export {
  UnitOfWork,
  UnitOfWorkFactory,
  ScopedUnitOfWork,
  type ChangeType,
  type TrackedEntity,
  type UnitOfWorkOptions,
  type TransactionContext,
  type TransactionCallback,
  type UnitOfWorkStats,
  type Snapshot,
} from '../patterns/unit-of-work';

// ============================================================================
// REPLICATION
// ============================================================================

export {
  ReplicaManager,
  getReplicaManager,
  resetReplicaManager,
  type ReplicaConfig,
  type ReplicaManagerConfig,
  type LoadBalanceStrategy,
  type ReplicaStatus,
  type RoutingDecision,
} from '../replication/replica-manager';

// ============================================================================
// AUDIT
// ============================================================================

export {
  AuditTrail,
  getAuditTrail,
  resetAuditTrail,
  createAuditMiddleware,
  type AuditAction,
  type AuditEntry,
  type AuditConfig,
  type AuditContext,
  type AuditQueryOptions,
} from '../audit/audit-trail';

// ============================================================================
// QUERY BUILDER
// ============================================================================

export {
  QueryBuilder,
  query,
  where,
  search,
  commonQueries,
  type ComparisonOperator,
  type LogicalOperator,
  type SortDirection,
  type WhereCondition,
  type OrderByClause,
  type SelectField,
  type IncludeRelation,
  type PaginationOptions,
  type QueryResult,
} from '../query/query-builder';

// ============================================================================
// ERRORS
// ============================================================================

export {
  DatabaseError,
  ConnectionError,
  ConstraintViolationError,
  UniqueConstraintError,
  ForeignKeyError,
  NotFoundError,
  OptimisticLockingError,
  TimeoutError,
  ValidationError,
  DatabaseErrorParser,
  DatabaseErrorHandler,
  type DatabaseErrorCategory,
  type DatabaseErrorSeverity,
  type RecoveryStrategy,
  type RecoveryAction,
  type DatabaseErrorContext,
} from '../errors/database-errors';

// ============================================================================
// ENHANCED BASE REPOSITORY
// ============================================================================

export {
  AbstractRepository as EnhancedAbstractRepository,
  OptimisticLockError,
  EntityNotFoundError,
  withSoftDelete,
  type BaseRepository as EnhancedBaseRepository,
  type QueryOptions as EnhancedQueryOptions,
  type CacheQueryOptions,
  type OptimisticLockOptions,
  type RepositoryConfig,
} from '../repositories/enhanced-base.repository';

// ============================================================================
// ENHANCED DATABASE MANAGER
// ============================================================================

export {
  EnhancedDatabaseManager,
  getEnhancedDatabaseManager,
  resetEnhancedDatabaseManager,
  type EnhancedDatabaseConfig,
  type DatabaseHealthReport,
  type DatabaseMetrics as EnhancedDatabaseMetrics,
  type TransactionOptions,
} from '../manager/enhanced-database-manager';
