import { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';

export interface PermissionRequirement { action: string; subject: string }

// Core implementation (non-curried)
function _permissionGuard(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
  requiredPermissions?: PermissionRequirement[],
) {
  try {
    // Check if auth is disabled via AUTH_MODE (same as authPreHandler)
    const mode = String(process.env.AUTH_MODE || '').toLowerCase();
    if (!mode) {
      done(); // auth disabled, skip permission check
      return;
    }
    
    const user = (request as any).user;
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    if (user.type === 'api-key') {
      done();
      return;
    }
    if (!requiredPermissions || requiredPermissions.length === 0) {
      done();
      return;
    }
    const userPermissions: PermissionRequirement[] = user.permissions || [];
    const hasPermission = requiredPermissions.every(requiredPermission =>
      userPermissions.some(
        (userPermission) =>
          userPermission.action === requiredPermission.action &&
          userPermission.subject === requiredPermission.subject,
      ),
    );
    if (!hasPermission) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }
    done();
  } catch (e) {
    reply.code(500).send({ error: 'Permission check failed' });
  }
}

// Overload: curried usage permissionGuard([{...}]) returns hook
export function permissionGuard(permissions: PermissionRequirement[]): (
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
) => void;
export function permissionGuard(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
  permissions?: PermissionRequirement[],
): void;
export function permissionGuard(
  arg1: any,
  arg2?: any,
  arg3?: any,
  arg4?: any,
) {
  // Curried form: first argument is an array of permission requirements
  if (Array.isArray(arg1) && !arg2) {
    const perms = arg1 as PermissionRequirement[];
    return (req: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction) =>
      _permissionGuard(req, reply, done, perms);
  }
  // Direct hook form
  return _permissionGuard(arg1 as FastifyRequest, arg2 as FastifyReply, arg3 as HookHandlerDoneFunction, arg4 as PermissionRequirement[] | undefined);
}

export function routePermissionGuard(permissions: PermissionRequirement[]) {
  return permissionGuard(permissions);
}
