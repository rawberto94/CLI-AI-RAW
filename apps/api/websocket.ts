/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import type { FastifyInstance } from 'fastify';

export function setupWebSocket(fastify: FastifyInstance) {
  let ServerCtor: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ServerCtor = require('socket.io').Server;
  } catch {
    fastify.log.warn('socket.io not installed; skipping websocket setup');
    return null;
  }

  const io: any = new ServerCtor(fastify.server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || 'http://localhost:3002').split(','),
      credentials: true,
    },
    path: '/ws',
  });

  const contractSubscriptions = new Map<string, Set<string>>();

  io.on('connection', (socket: any) => {
    fastify.log.info({ id: socket.id }, 'WebSocket connected');

    socket.on('subscribe:contract', (data: { contractId: string; tenantId: string }) => {
      const room = `contract:${data.contractId}`;
      socket.join(room);
      if (!contractSubscriptions.has(data.contractId)) {
        contractSubscriptions.set(data.contractId, new Set());
      }
      contractSubscriptions.get(data.contractId)!.add(socket.id);
    });

    socket.on('unsubscribe:contract', (data: { contractId: string }) => {
      const room = `contract:${data.contractId}`;
      socket.leave(room);
      const subs = contractSubscriptions.get(data.contractId);
      if (subs) {
        subs.delete(socket.id);
        if (subs.size === 0) contractSubscriptions.delete(data.contractId);
      }
    });

    socket.on('disconnect', () => {
      for (const [contractId, subs] of contractSubscriptions) {
        if (subs.has(socket.id)) {
          subs.delete(socket.id);
          if (subs.size === 0) contractSubscriptions.delete(contractId);
        }
      }
      fastify.log.info({ id: socket.id }, 'WebSocket disconnected');
    });
  });

  const emitContractUpdate = (contractId: string, data: any) => {
    io.to(`contract:${contractId}`).emit('contract:update', data);
  };

  const emitProgressUpdate = (contractId: string, progress: number, stage: string) => {
    io.to(`contract:${contractId}`).emit('contract:progress', { contractId, progress, stage });
  };

  return { io, emitContractUpdate, emitProgressUpdate };
}
