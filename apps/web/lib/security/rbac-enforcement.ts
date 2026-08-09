/**
 * Central RBAC enforcement for API routes.
 *
 * Applied automatically by withAuthApiHandler / withContractApiHandler /
 * withContractSessionApiHandler so individual routes do not need to
 * re-implement role checks. Routes may still call hasPermission() for
 * finer-grained logic (e.g. edit_own ownership).
 *
 * Resolution order for a request:
 *  1. Explicit options.permission / options.anyOf / options.minRole (if provided)
 *  2. Path + method rules below (first match wins)
 *  3. Safe defaults: GET requires a basic view permission; mutations require member+
 */

import type { NextRequest } from 'next/server';
import {
  getRoleLevel,
  hasPermissionForRole,
  normalizeRole,
  roleHasAnyPermission,
  type RbacRole,
} from '@/lib/permissions';

export type RbacDecision =
  | { allowed: true }
  | { allowed: false; reason: string; required?: string[] };

export interface RbacHandlerOptions {
  /** Single required permission */
  permission?: string;
  /** User needs any of these permissions */
  anyOf?: string[];
  /** User needs all of these permissions */
  allOf?: string[];
  /** Minimum role level (viewer < member < manager < admin < owner) */
  minRole?: RbacRole | string;
  /** Skip automatic RBAC (use sparingly — public auth already uses other wrappers) */
  skipRbac?: boolean;
}

interface PathRule {
  /** Return true if this rule applies to the path */
  test: (pathname: string) => boolean;
  /** HTTP methods this rule applies to (uppercase). Omit = all methods. */
  methods?: string[];
  anyOf?: string[];
  allOf?: string[];
  minRole?: RbacRole;
  /** When true, only authentication is required (still logged-in) */
  authOnly?: boolean;
}

/**
 * Paths where authenticated viewers may perform limited write actions
 * (self-service profile, session, notifications mark-read, etc.).
 */
const VIEWER_MUTATION_ALLOWLIST: Array<(pathname: string) => boolean> = [
  (p) => p.startsWith('/api/auth/'),
  (p) => p === '/api/csrf' || p.startsWith('/api/csrf/'),
  (p) => p.startsWith('/api/settings/profile'),
  (p) => p.startsWith('/api/settings/notifications'),
  (p) => p.startsWith('/api/notifications'),
  (p) => p.startsWith('/api/me'),
  (p) => p.startsWith('/api/user/preferences'),
  (p) => p.startsWith('/api/users/me'),
  (p) => p.startsWith('/api/sessions'),
  (p) => p.startsWith('/api/activity'),
  (p) => p === '/api/ux/events' || p.startsWith('/api/ux/'),
  (p) => p.startsWith('/api/ai/chat/feedback'),
  (p) => p.startsWith('/api/health'),
];

/**
 * Ordered rules — first match wins.
 * Keep more specific paths above broader prefixes.
 */
const PATH_RULES: PathRule[] = [
  // Platform / admin (defense-in-depth; middleware also gates these)
  {
    test: (p) => p.startsWith('/api/admin') || p.startsWith('/api/platform'),
    minRole: 'admin',
  },

  // Audit
  {
    test: (p) => p.startsWith('/api/audit-logs') || p.startsWith('/api/audit/'),
    anyOf: ['audit:view'],
  },
  {
    test: (p) => p.includes('/export') && (p.includes('audit') || p.startsWith('/api/admin/audit')),
    anyOf: ['audit:export', 'audit:view'],
  },

  // User administration
  {
    test: (p) => p.startsWith('/api/users') && (p.includes('/role') || p.includes('/invite')),
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    anyOf: ['users:manage', 'users:invite', 'users:roles'],
  },
  {
    test: (p) => p.startsWith('/api/users'),
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    anyOf: ['users:manage', 'users:invite', 'users:delete'],
  },
  {
    test: (p) => p.startsWith('/api/users'),
    methods: ['GET', 'HEAD'],
    anyOf: ['users:view', 'collaborators:view', 'contracts:view'],
  },

  // Collaborators
  {
    test: (p) => p.startsWith('/api/collaborators'),
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    anyOf: ['collaborators:manage'],
  },
  {
    test: (p) => p.startsWith('/api/collaborators'),
    methods: ['GET', 'HEAD'],
    anyOf: ['collaborators:view', 'contracts:view'],
  },

  // Billing
  {
    test: (p) => p.startsWith('/api/billing'),
    anyOf: ['billing:view', 'billing:manage'],
  },
  {
    test: (p) => p.startsWith('/api/billing'),
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    anyOf: ['billing:manage'],
  },

  // Security / settings management
  {
    test: (p) =>
      p.startsWith('/api/settings/security') ||
      p.startsWith('/api/settings/sso') ||
      p.startsWith('/api/settings/webhooks') ||
      p.startsWith('/api/settings/api-tokens') ||
      p.startsWith('/api/settings/api-keys'),
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    anyOf: ['settings:manage', 'security:manage', 'api:manage'],
  },

  // Contract upload / create
  {
    test: (p) =>
      p === '/api/contracts/upload' ||
      p.startsWith('/api/contracts/upload/') ||
      p === '/api/contracts' ||
      p.startsWith('/api/contracts/batch') ||
      p.startsWith('/api/upload'),
    methods: ['POST'],
    anyOf: ['contracts:create'],
  },

  // Contract delete (single resource DELETE or bulk delete endpoints)
  {
    test: (p) =>
      /^\/api\/contracts\/[^/]+$/.test(p) ||
      (p.startsWith('/api/contracts/') && (p.endsWith('/delete') || p.includes('/bulk/delete') || p.includes('/bulk-delete'))),
    methods: ['DELETE'],
    anyOf: ['contracts:delete', 'contracts:manage'],
  },
  {
    test: (p) =>
      p.startsWith('/api/contracts') &&
      (p.includes('/bulk/delete') || p.includes('/bulk-delete') || p.includes('bulk') && p.includes('delete')),
    methods: ['POST', 'DELETE'],
    anyOf: ['contracts:delete', 'contracts:manage'],
  },

  // Contract write (edit metadata, status, etc.)
  {
    test: (p) => p.startsWith('/api/contracts'),
    methods: ['PUT', 'PATCH'],
    anyOf: ['contracts:edit', 'contracts:edit_own', 'contracts:manage'],
  },
  {
    test: (p) =>
      p.startsWith('/api/contracts') &&
      (p.includes('/access') || p.includes('/share') || p.includes('/assign')),
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    anyOf: ['contracts:manage', 'contracts:assign', 'collaborators:manage'],
  },

  // Contract read
  {
    test: (p) => p.startsWith('/api/contracts'),
    methods: ['GET', 'HEAD'],
    anyOf: ['contracts:view'],
  },

  // AI chat send vs view
  {
    test: (p) =>
      p.startsWith('/api/ai/chat') ||
      p.startsWith('/api/agents/chat') ||
      p.startsWith('/api/chat'),
    methods: ['POST', 'PUT', 'PATCH'],
    anyOf: ['chat:send'],
  },
  {
    test: (p) =>
      p.startsWith('/api/ai/') ||
      p.startsWith('/api/agents/'),
    methods: ['GET', 'HEAD'],
    anyOf: ['chat:view', 'contracts:view', 'dashboard:view'],
  },

  // Analytics / reports
  {
    test: (p) => p.startsWith('/api/analytics') || p.startsWith('/api/reports'),
    methods: ['GET', 'HEAD'],
    anyOf: ['analytics:view', 'reports:view', 'dashboard:view'],
  },
  {
    test: (p) => p.startsWith('/api/analytics') || p.startsWith('/api/reports'),
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    anyOf: ['reports:create', 'reports:export', 'analytics:export', 'analytics:view'],
  },

  // Workflows
  {
    test: (p) => p.startsWith('/api/workflows') || p.startsWith('/api/approvals'),
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    anyOf: ['workflow:manage', 'contracts:manage', 'contracts:edit'],
  },
  {
    test: (p) => p.startsWith('/api/workflows') || p.startsWith('/api/approvals'),
    methods: ['GET', 'HEAD'],
    anyOf: ['contracts:view', 'workflow:manage', 'dashboard:view'],
  },
];

function pathnameFromRequest(request: NextRequest): string {
  try {
    return request.nextUrl?.pathname || new URL(request.url).pathname;
  } catch {
    return '/';
  }
}

function isViewerMutationAllowed(pathname: string): boolean {
  return VIEWER_MUTATION_ALLOWLIST.some((fn) => fn(pathname));
}

function evaluateRule(
  role: string | null | undefined,
  rule: Pick<PathRule, 'anyOf' | 'allOf' | 'minRole' | 'authOnly'>,
): RbacDecision {
  if (rule.authOnly) {
    return { allowed: true };
  }

  if (rule.minRole) {
    if (getRoleLevel(normalizeRole(role)) < getRoleLevel(rule.minRole)) {
      return {
        allowed: false,
        reason: `Requires role ${rule.minRole} or higher`,
        required: [`role:${rule.minRole}`],
      };
    }
  }

  if (rule.allOf && rule.allOf.length > 0) {
    const missing = rule.allOf.filter((p) => !hasPermissionForRole(role, p));
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `Missing required permissions: ${missing.join(', ')}`,
        required: rule.allOf,
      };
    }
  }

  if (rule.anyOf && rule.anyOf.length > 0) {
    if (!roleHasAnyPermission(role, rule.anyOf)) {
      return {
        allowed: false,
        reason: `Requires one of: ${rule.anyOf.join(', ')}`,
        required: rule.anyOf,
      };
    }
  }

  return { allowed: true };
}

/**
 * Resolve RBAC for a request from explicit options and/or path rules.
 */
export function evaluateRbac(args: {
  method: string;
  pathname: string;
  role?: string | null;
  options?: RbacHandlerOptions;
}): RbacDecision {
  const method = args.method.toUpperCase();
  const role = args.role;
  const options = args.options;

  if (options?.skipRbac) {
    return { allowed: true };
  }

  // Explicit options take precedence
  if (options?.permission || options?.anyOf || options?.allOf || options?.minRole) {
    return evaluateRule(role, {
      anyOf: options.permission ? [options.permission, ...(options.anyOf || [])] : options.anyOf,
      allOf: options.allOf,
      minRole: options.minRole as RbacRole | undefined,
    });
  }

  // Path rules
  for (const rule of PATH_RULES) {
    if (rule.methods && !rule.methods.includes(method)) {
      continue;
    }
    if (!rule.test(args.pathname)) {
      continue;
    }
    return evaluateRule(role, rule);
  }

  // Defaults
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  if (isMutation) {
    // Viewers: only allowlisted self-service mutations
    if (normalizeRole(role) === 'viewer') {
      if (isViewerMutationAllowed(args.pathname)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: 'Viewers have read-only access',
        required: ['contracts:create', 'contracts:edit'],
      };
    }

    // Other roles: need at least member-level create/edit/chat permission for generic APIs
    if (
      !roleHasAnyPermission(role, [
        'contracts:create',
        'contracts:edit',
        'contracts:edit_own',
        'chat:send',
        'comments:create',
        'reports:create',
        'workflow:manage',
        'settings:manage',
        'users:manage',
      ])
    ) {
      return {
        allowed: false,
        reason: 'Insufficient permissions for write operations',
      };
    }
    return { allowed: true };
  }

  // Read defaults: any basic view permission
  if (
    roleHasAnyPermission(role, [
      'contracts:view',
      'dashboard:view',
      'reports:view',
      'chat:view',
      'analytics:view',
    ])
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: 'Insufficient permissions to view this resource',
    required: ['contracts:view', 'dashboard:view'],
  };
}

/**
 * Evaluate RBAC for a NextRequest + role.
 */
export function enforceRequestRbac(
  request: NextRequest,
  role: string | null | undefined,
  options?: RbacHandlerOptions,
): RbacDecision {
  return evaluateRbac({
    method: request.method,
    pathname: pathnameFromRequest(request),
    role,
    options,
  });
}

/** Exported for unit tests */
export const __rbacTestUtils = {
  PATH_RULES,
  VIEWER_MUTATION_ALLOWLIST,
  pathnameFromRequest,
};
