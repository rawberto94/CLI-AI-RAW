import { FastifyReply, FastifyRequest } from 'fastify';

export function permissionGuard(permissions: { action: string; subject: string }[]) {
  return (request: FastifyRequest, reply: FastifyReply, done: () => void) => {
    const user = (request as any).user;

    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    if (user.type === 'api-key') {
      // API keys have full access
      return done();
    }

    const userPermissions = user.permissions || [];
    const hasPermission = permissions.every(requiredPermission =>
      userPermissions.some(
        (userPermission: { action: string; subject: string }) =>
          userPermission.action === requiredPermission.action &&
          userPermission.subject === requiredPermission.subject
      )
    );

    if (!hasPermission) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    done();
  };
}
