/**
 * Helpers for API routes that do not use withAuthApiHandler wrappers
 * (streaming, binary downloads, legacy handlers).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedApiContextWithSessionFallback,
  getApiContext,
  createErrorResponse,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';
import {
  enforceRequestRbac,
  type RbacHandlerOptions,
} from '@/lib/security/rbac-enforcement';
import {
  checkContractReadPermission,
  checkContractWritePermission,
  type AclDecision,
} from '@/lib/security/contract-acl';

export type ApiAccessOk = {
  ok: true;
  context: AuthenticatedApiContext;
};

export type ApiAccessDenied = {
  ok: false;
  response: NextResponse;
};

/**
 * Authenticate + enforce path/method RBAC.
 */
export async function requireAuthenticatedRbac(
  request: NextRequest,
  options?: RbacHandlerOptions,
): Promise<ApiAccessOk | ApiAccessDenied> {
  const context = await getAuthenticatedApiContextWithSessionFallback(request);
  if (!context) {
    return {
      ok: false,
      response: createErrorResponse(
        getApiContext(request),
        'UNAUTHORIZED',
        'Authentication required',
        401,
        { retryable: false },
      ),
    };
  }

  const rbac = enforceRequestRbac(request, context.userRole, options);
  if (!rbac.allowed) {
    return {
      ok: false,
      response: createErrorResponse(
        context,
        'FORBIDDEN',
        rbac.reason || 'Forbidden',
        403,
        { retryable: false, details: rbac.required?.join(', ') },
      ),
    };
  }

  return { ok: true, context };
}

/**
 * Contract read access (RBAC path rules already applied by requireAuthenticatedRbac).
 */
export async function requireContractReadAccess(args: {
  request: NextRequest;
  contractId: string;
  options?: RbacHandlerOptions;
}): Promise<
  | (ApiAccessOk & { contractId: string })
  | ApiAccessDenied
> {
  const access = await requireAuthenticatedRbac(args.request, {
    anyOf: ['contracts:view'],
    ...args.options,
  });
  if (!access.ok) return access;

  const decision: AclDecision = await checkContractReadPermission({
    contractId: args.contractId,
    tenantId: access.context.tenantId,
    userId: access.context.userId,
    userRole: access.context.userRole,
  });

  if (!decision.allowed) {
    return {
      ok: false,
      response: createErrorResponse(
        access.context,
        'FORBIDDEN',
        'You do not have permission to access this contract',
        403,
        { retryable: false },
      ),
    };
  }

  return { ok: true, context: access.context, contractId: args.contractId };
}

export async function requireContractWriteAccess(args: {
  request: NextRequest;
  contractId: string;
  required?: 'EDIT' | 'ADMIN';
  options?: RbacHandlerOptions;
}): Promise<
  | (ApiAccessOk & { contractId: string })
  | ApiAccessDenied
> {
  const required = args.required ?? 'EDIT';
  const access = await requireAuthenticatedRbac(args.request, args.options);
  if (!access.ok) return access;

  const decision = await checkContractWritePermission({
    contractId: args.contractId,
    tenantId: access.context.tenantId,
    userId: access.context.userId,
    userRole: access.context.userRole,
    required,
  });

  if (!decision.allowed) {
    return {
      ok: false,
      response: createErrorResponse(
        access.context,
        'FORBIDDEN',
        'You do not have permission to modify this contract',
        403,
        { retryable: false },
      ),
    };
  }

  return { ok: true, context: access.context, contractId: args.contractId };
}
