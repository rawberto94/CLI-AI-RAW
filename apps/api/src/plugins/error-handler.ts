import { FastifyInstance } from 'fastify';
import { monitoring } from '../../monitoring';
import { AppError, errorHandler } from '../errors';

export async function registerErrorHandling(app: FastifyInstance) {
  // Wrap existing error handler to record metrics and sanitize output
  app.setErrorHandler((err, request, reply) => {
    try {
      monitoring.onError(request as any, reply as any, err as any);
    } catch {}
    errorHandler(err, request as any, reply as any);
  });

  // Defensive not-found handler to provide consistent shape
  app.setNotFoundHandler((request, reply) => {
    const err = new AppError(404, 'Not Found', true, { method: request.method, url: request.url });
    try { monitoring.onError(request as any, reply as any, err as any); } catch {}
    reply.code(404).send({ error: 'Not Found' });
  });
}
