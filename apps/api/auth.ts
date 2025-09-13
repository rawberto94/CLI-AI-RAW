import { PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Optional authentication middleware supporting API key or JWT (Bearer) modes.
// Configure via env:
// - AUTH_MODE: 'apikey' | 'jwt' | 'hybrid' (optional; if unset, auth is disabled)
// - API_KEY: string (when using apikey/hybrid)
// - JWT_SECRET: string (when using jwt/hybrid)

function verifyJwt(token: string, secret:string): any | null {
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

export async function authPreHandler(request: FastifyRequest, reply: FastifyReply) {
  const mode = String(process.env.AUTH_MODE || '').toLowerCase();
  if (!mode) return; // auth disabled

  // Allow health and metrics without auth
  const openPaths = new Set<string>([
    '/', '/healthz', '/metrics', '/metrics/system', '/metrics/requests', '/metrics/endpoints', '/metrics/slow', '/metrics/health', '/metrics/prom',
    '/api/health', '/api/ready', '/api/live'
  ]);
  if (openPaths.has(request.url)) return;

  const authz = String(request.headers['authorization'] || '');
  const apiKeyHeader = String(request.headers['x-api-key'] || '');

  const needApiKey = mode === 'apikey' || mode === 'hybrid';
  const needJwt = mode === 'jwt' || mode === 'hybrid';

  let ok = false;

  if (needApiKey) {
    const expected = process.env.API_KEY || '';
    if (expected && apiKeyHeader && apiKeyHeader === expected) {
      (request as any).user = { type: 'api-key' };
      ok = true;
    }
  }

  if (!ok && needJwt) {
    const secret = process.env.JWT_SECRET || '';
    const m = authz.match(/^Bearer\s+(.+)$/i);
    if (secret && m) {
      const payload = verifyJwt(m[1], secret);
      if (payload && payload.userId) {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        });

        if (user) {
          const { password, ...userWithoutPassword } = user;
          (request as any).user = {
            ...userWithoutPassword,
            permissions: user.role.permissions.map(p => ({
              action: p.permission.action,
              subject: p.permission.subject,
            })),
          };
          ok = true;
        }
      }
    }
  }

  if (!ok) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}
