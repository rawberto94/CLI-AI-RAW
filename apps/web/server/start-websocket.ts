#!/usr/bin/env node
/**
 * Standalone WebSocket Server
 * 
 * Run with: npx ts-node apps/web/server/start-websocket.ts
 * Or: node --loader ts-node/esm apps/web/server/start-websocket.ts
 */

import { createServer } from 'http';
import { createWebSocketServer } from './websocket-server';

const PORT = parseInt(process.env.WEBSOCKET_PORT || '3001', 10);
const REDIS_URL = process.env.REDIS_URL;

// Create HTTP server
const httpServer = createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      stats: wsServer.getStats(),
    }));
    return;
  }

  // Stats endpoint
  if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(wsServer.getStats()));
    return;
  }

  // Default response
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket Server Running');
});

// Create WebSocket server
const wsServer = createWebSocketServer(httpServer, {
  redisUrl: REDIS_URL,
});

// Start listening
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                 WebSocket Server Started                     ║
╠════════════════════════════════════════════════════════════╣
║  Port:    ${PORT.toString().padEnd(48)}║
║  Redis:   ${(REDIS_URL ? 'Connected' : 'In-Memory Mode').padEnd(48)}║
║  Health:  http://localhost:${PORT}/health${' '.repeat(25)}║
║  Stats:   http://localhost:${PORT}/stats${' '.repeat(26)}║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('\nShutting down WebSocket server...');
  await wsServer.close();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { wsServer, httpServer };
