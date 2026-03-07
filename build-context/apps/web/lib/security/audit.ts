/**
 * Audit Logger
 * Track and log sensitive operations for security auditing
 * 
 * @example
 * import { auditLog, AuditAction } from '@/lib/security/audit';
 * 
 * await auditLog({
 *   action: AuditAction.CONTRACT_CREATED,
 *   userId: session.user.id,
 *   resourceId: contract.id,
 *   resourceType: 'contract',
 *   metadata: { contractType: 'vendor' },
 * });
 */

// ============================================================================
// Types
// ============================================================================

export enum AuditAction {
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  MFA_SETUP_STARTED = 'MFA_SETUP_STARTED',
  MFA_VERIFIED = 'MFA_VERIFIED',
  MFA_FAILED = 'MFA_FAILED',
  MFA_BACKUP_CODES_REGENERATED = 'MFA_BACKUP_CODES_REGENERATED',
  SESSION_CREATED = 'SESSION_CREATED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  SESSION_REVOKED_ALL = 'SESSION_REVOKED_ALL',
  
  // User Management
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_PERMISSIONS_CHANGED = 'USER_PERMISSIONS_CHANGED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  USER_DEPARTMENTS_UPDATED = 'USER_DEPARTMENTS_UPDATED',
  USERS_BULK_IMPORTED = 'USERS_BULK_IMPORTED',
  
  // Department Management
  DEPARTMENT_CREATED = 'DEPARTMENT_CREATED',
  DEPARTMENT_UPDATED = 'DEPARTMENT_UPDATED',
  DEPARTMENT_DELETED = 'DEPARTMENT_DELETED',
  
  // Group Management
  GROUP_CREATED = 'GROUP_CREATED',
  GROUP_UPDATED = 'GROUP_UPDATED',
  GROUP_DELETED = 'GROUP_DELETED',
  GROUP_MEMBERS_ADDED = 'GROUP_MEMBERS_ADDED',
  GROUP_MEMBERS_REMOVED = 'GROUP_MEMBERS_REMOVED',
  
  // Contract Management
  CONTRACT_CREATED = 'CONTRACT_CREATED',
  CONTRACT_UPDATED = 'CONTRACT_UPDATED',
  CONTRACT_DELETED = 'CONTRACT_DELETED',
  CONTRACT_VIEWED = 'CONTRACT_VIEWED',
  CONTRACT_DOWNLOADED = 'CONTRACT_DOWNLOADED',
  CONTRACT_SHARED = 'CONTRACT_SHARED',
  CONTRACT_STATUS_CHANGED = 'CONTRACT_STATUS_CHANGED',
  CONTRACT_ACCESS_GRANTED = 'CONTRACT_ACCESS_GRANTED',
  CONTRACT_ACCESS_REVOKED = 'CONTRACT_ACCESS_REVOKED',
  
  // Collaborator Management
  COLLABORATOR_INVITED = 'COLLABORATOR_INVITED',
  COLLABORATOR_REVOKED = 'COLLABORATOR_REVOKED',
  COLLABORATOR_ACCESSED = 'COLLABORATOR_ACCESSED',
  COLLABORATOR_COMMENTED = 'COLLABORATOR_COMMENTED',
  
  // Approval Workflow
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
  APPROVAL_APPROVED = 'APPROVAL_APPROVED',
  APPROVAL_REJECTED = 'APPROVAL_REJECTED',
  APPROVAL_DELEGATED = 'APPROVAL_DELEGATED',
  APPROVAL_ESCALATED = 'APPROVAL_ESCALATED',
  APPROVAL_CANCELLED = 'APPROVAL_CANCELLED',
  
  // Document Management
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',
  DOCUMENT_DOWNLOADED = 'DOCUMENT_DOWNLOADED',
  DOCUMENT_DELETED = 'DOCUMENT_DELETED',
  DOCUMENT_SIGNED = 'DOCUMENT_SIGNED',
  
  // Data Operations
  DATA_EXPORTED = 'DATA_EXPORTED',
  DATA_IMPORTED = 'DATA_IMPORTED',
  BULK_OPERATION = 'BULK_OPERATION',
  
  // API Operations
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  API_KEY_USED = 'API_KEY_USED',
  WEBHOOK_CREATED = 'WEBHOOK_CREATED',
  WEBHOOK_DELETED = 'WEBHOOK_DELETED',
  
  // System
  SETTINGS_CHANGED = 'SETTINGS_CHANGED',
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
  INTEGRATION_CONNECTED = 'INTEGRATION_CONNECTED',
  INTEGRATION_DISCONNECTED = 'INTEGRATION_DISCONNECTED',
  
  // Security
  RATE_LIMITED = 'RATE_LIMITED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SECURITY_SETTINGS_UPDATED = 'SECURITY_SETTINGS_UPDATED',
  IP_ALLOWLIST_ADDED = 'IP_ALLOWLIST_ADDED',
  IP_ALLOWLIST_REMOVED = 'IP_ALLOWLIST_REMOVED',
}

export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface AuditEntry {
  /** Unique ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Action performed */
  action: AuditAction;
  /** Severity level */
  severity: AuditSeverity;
  /** User who performed the action */
  userId?: string;
  /** User email */
  userEmail?: string;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Resource type */
  resourceType?: string;
  /** Resource ID */
  resourceId?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Session ID */
  sessionId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Previous state (for updates) */
  previousState?: Record<string, unknown>;
  /** New state (for updates) */
  newState?: Record<string, unknown>;
  /** Was the operation successful */
  success: boolean;
  /** Error message if failed */
  errorMessage?: string;
  /** Organization/tenant ID */
  organizationId?: string;
}

export interface AuditLogOptions {
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  tenantId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  organizationId?: string;
  request?: Request | { headers: { get: (key: string) => string | null } };
}

// ============================================================================
// Severity Mapping
// ============================================================================

const ACTION_SEVERITY: Partial<Record<AuditAction, AuditSeverity>> = {
  // Critical
  [AuditAction.USER_DELETED]: AuditSeverity.CRITICAL,
  [AuditAction.CONTRACT_DELETED]: AuditSeverity.CRITICAL,
  [AuditAction.PASSWORD_RESET_COMPLETED]: AuditSeverity.CRITICAL,
  [AuditAction.API_KEY_REVOKED]: AuditSeverity.CRITICAL,
  [AuditAction.SUSPICIOUS_ACTIVITY]: AuditSeverity.CRITICAL,
  [AuditAction.SYSTEM_CONFIG_CHANGED]: AuditSeverity.CRITICAL,
  
  // High
  [AuditAction.LOGIN_FAILED]: AuditSeverity.HIGH,
  [AuditAction.PASSWORD_CHANGED]: AuditSeverity.HIGH,
  [AuditAction.USER_ROLE_CHANGED]: AuditSeverity.HIGH,
  [AuditAction.USER_PERMISSIONS_CHANGED]: AuditSeverity.HIGH,
  [AuditAction.MFA_DISABLED]: AuditSeverity.HIGH,
  [AuditAction.SESSION_REVOKED]: AuditSeverity.HIGH,
  [AuditAction.API_KEY_CREATED]: AuditSeverity.HIGH,
  [AuditAction.DATA_EXPORTED]: AuditSeverity.HIGH,
  [AuditAction.ACCESS_DENIED]: AuditSeverity.HIGH,
  [AuditAction.PERMISSION_DENIED]: AuditSeverity.HIGH,
  
  // Medium
  [AuditAction.LOGIN_SUCCESS]: AuditSeverity.MEDIUM,
  [AuditAction.LOGOUT]: AuditSeverity.MEDIUM,
  [AuditAction.USER_CREATED]: AuditSeverity.MEDIUM,
  [AuditAction.USER_UPDATED]: AuditSeverity.MEDIUM,
  [AuditAction.CONTRACT_CREATED]: AuditSeverity.MEDIUM,
  [AuditAction.CONTRACT_STATUS_CHANGED]: AuditSeverity.MEDIUM,
  [AuditAction.APPROVAL_APPROVED]: AuditSeverity.MEDIUM,
  [AuditAction.APPROVAL_REJECTED]: AuditSeverity.MEDIUM,
  [AuditAction.DOCUMENT_SIGNED]: AuditSeverity.MEDIUM,
  [AuditAction.BULK_OPERATION]: AuditSeverity.MEDIUM,
  [AuditAction.RATE_LIMITED]: AuditSeverity.MEDIUM,
};

function getSeverity(action: AuditAction): AuditSeverity {
  return ACTION_SEVERITY[action] ?? AuditSeverity.LOW;
}

// ============================================================================
// Storage Interface
// ============================================================================

export interface AuditStorage {
  save(entry: AuditEntry): Promise<void>;
  query(options: AuditQueryOptions): Promise<AuditEntry[]>;
  getById(id: string): Promise<AuditEntry | null>;
}

export interface AuditQueryOptions {
  userId?: string;
  action?: AuditAction | AuditAction[];
  resourceType?: string;
  resourceId?: string;
  severity?: AuditSeverity | AuditSeverity[];
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'severity';
  orderDir?: 'asc' | 'desc';
}

// ============================================================================
// Memory Storage (Development/Testing)
// ============================================================================

class MemoryAuditStorage implements AuditStorage {
  private entries: AuditEntry[] = [];
  private maxEntries = 10000;

  async save(entry: AuditEntry): Promise<void> {
    this.entries.unshift(entry);
    
    // Trim to max entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(0, this.maxEntries);
    }
  }

  async query(options: AuditQueryOptions): Promise<AuditEntry[]> {
    let results = [...this.entries];
    
    // Apply filters
    if (options.userId) {
      results = results.filter(e => e.userId === options.userId);
    }
    
    if (options.action) {
      const actions = Array.isArray(options.action) ? options.action : [options.action];
      results = results.filter(e => actions.includes(e.action));
    }
    
    if (options.resourceType) {
      results = results.filter(e => e.resourceType === options.resourceType);
    }
    
    if (options.resourceId) {
      results = results.filter(e => e.resourceId === options.resourceId);
    }
    
    if (options.severity) {
      const severities = Array.isArray(options.severity) ? options.severity : [options.severity];
      results = results.filter(e => severities.includes(e.severity));
    }
    
    if (options.startDate) {
      results = results.filter(e => e.timestamp >= options.startDate!);
    }
    
    if (options.endDate) {
      results = results.filter(e => e.timestamp <= options.endDate!);
    }
    
    if (options.success !== undefined) {
      results = results.filter(e => e.success === options.success);
    }
    
    // Sort
    const orderDir = options.orderDir ?? 'desc';
    const orderBy = options.orderBy ?? 'timestamp';
    
    results.sort((a, b) => {
      if (orderBy === 'severity') {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const diff = severityOrder[a.severity] - severityOrder[b.severity];
        return orderDir === 'asc' ? diff : -diff;
      }
      
      const diff = a.timestamp.getTime() - b.timestamp.getTime();
      return orderDir === 'asc' ? diff : -diff;
    });
    
    // Pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    
    return results.slice(offset, offset + limit);
  }

  async getById(id: string): Promise<AuditEntry | null> {
    return this.entries.find(e => e.id === id) ?? null;
  }
}

// ============================================================================
// Console Logger (Always active)
// ============================================================================

class ConsoleAuditLogger {
  log(_entry: AuditEntry): void {
    // In production, send audit entries to your audit log storage
    // Entry contains: timestamp, action, severity, userId, resourceType, resourceId, success, metadata, errorMessage
  }
}

// ============================================================================
// Audit Logger Service
// ============================================================================

class AuditLogger {
  private storage: AuditStorage;
  private consoleLogger: ConsoleAuditLogger;
  private hooks: Array<(entry: AuditEntry) => void | Promise<void>> = [];

  constructor(storage?: AuditStorage) {
    this.storage = storage ?? new MemoryAuditStorage();
    this.consoleLogger = new ConsoleAuditLogger();
  }

  /**
   * Log an audit entry
   */
  async log(options: AuditLogOptions): Promise<AuditEntry> {
    // Extract context from request if provided
    let requestContext: Partial<AuditLogOptions> = {};
    if (options.request) {
      requestContext = {
        ipAddress: options.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 
                   options.request.headers.get('x-real-ip') ?? 
                   options.ipAddress ?? 
                   'unknown',
        userAgent: options.request.headers.get('user-agent') ?? options.userAgent ?? undefined,
        requestId: options.request.headers.get('x-request-id') ?? options.requestId ?? crypto.randomUUID(),
      };
    }
    
    // Exclude request from final entry (not serializable)
    const { request: _request, ...restOptions } = options;
    
    const entry: AuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      severity: getSeverity(options.action),
      success: options.success ?? true,
      ...restOptions,
      ...requestContext,
    };
    
    // Log to console
    this.consoleLogger.log(entry);
    
    // Save to storage
    await this.storage.save(entry);
    
    // Run hooks
    for (const hook of this.hooks) {
      try {
        await hook(entry);
      } catch {
        // Hook error - continue with other hooks
      }
    }
    
    return entry;
  }

  /**
   * Query audit logs
   */
  async query(options: AuditQueryOptions = {}): Promise<AuditEntry[]> {
    return this.storage.query(options);
  }

  /**
   * Get audit entry by ID
   */
  async getById(id: string): Promise<AuditEntry | null> {
    return this.storage.getById(id);
  }

  /**
   * Add a hook to be called on every audit entry
   */
  addHook(hook: (entry: AuditEntry) => void | Promise<void>): () => void {
    this.hooks.push(hook);
    return () => {
      const index = this.hooks.indexOf(hook);
      if (index > -1) {
        this.hooks.splice(index, 1);
      }
    };
  }

  /**
   * Set custom storage
   */
  setStorage(storage: AuditStorage): void {
    this.storage = storage;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let auditLoggerInstance: AuditLogger | null = null;

function getAuditLogger(): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger();
  }
  return auditLoggerInstance;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Log an audit entry
 */
export async function auditLog(options: AuditLogOptions): Promise<AuditEntry> {
  return getAuditLogger().log(options);
}

/**
 * Query audit logs
 */
export async function queryAuditLogs(options: AuditQueryOptions = {}): Promise<AuditEntry[]> {
  return getAuditLogger().query(options);
}

/**
 * Get audit entry by ID
 */
export async function getAuditEntry(id: string): Promise<AuditEntry | null> {
  return getAuditLogger().getById(id);
}

/**
 * Add audit hook
 */
export function addAuditHook(hook: (entry: AuditEntry) => void | Promise<void>): () => void {
  return getAuditLogger().addHook(hook);
}

/**
 * Set custom audit storage
 */
export function setAuditStorage(storage: AuditStorage): void {
  getAuditLogger().setStorage(storage);
}

// ============================================================================
// Request Context Helper
// ============================================================================

/**
 * Extract audit context from request
 */
export function getAuditContext(req: Request): Partial<AuditLogOptions> {
  return {
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 
               req.headers.get('x-real-ip') ?? 
               'unknown',
    userAgent: req.headers.get('user-agent') ?? undefined,
    requestId: req.headers.get('x-request-id') ?? crypto.randomUUID(),
  };
}

/**
 * Create audit log middleware
 */
export function withAuditLog(
  action: AuditAction,
  options: Partial<AuditLogOptions> = {}
) {
  return function decorator<T extends (...args: unknown[]) => Promise<unknown>>(
    target: T
  ): T {
    return (async (...args: unknown[]) => {
      const startTime = Date.now();
      let success = true;
      let errorMessage: string | undefined;
      
      try {
        return await target(...args);
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        await auditLog({
          action,
          success,
          errorMessage,
          metadata: {
            ...options.metadata,
            duration: Date.now() - startTime,
          },
          ...options,
        });
      }
    }) as T;
  };
}

// ============================================================================
// Exports
// ============================================================================

export { AuditLogger, MemoryAuditStorage, ConsoleAuditLogger };
export default auditLog;
