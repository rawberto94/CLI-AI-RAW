#!/usr/bin/env node
/**
 * Data Orchestration API Server
 * Provides REST API endpoints for integration testing and external services
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || '0.0.0.0';

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  service: string;
  version: string;
}

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

// Simple request handler
const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
  const parsedUrl = parse(req.url || '', true);
  const pathname = parsedUrl.pathname || '/';
  const method = req.method || 'GET';

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // Health check endpoint
    if (pathname === '/healthz' || pathname === '/health' || pathname === '/api/health') {
      const response: HealthResponse = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'data-orchestration',
        version: '1.0.0',
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }

    // API v1 routes
    if (pathname.startsWith('/api/v1/')) {
      // Contracts endpoints
      if (pathname === '/api/v1/contracts' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: [],
          total: 0,
          page: 1,
          limit: 10,
        }));
        return;
      }

      if (pathname.startsWith('/api/v1/contracts/') && method === 'GET') {
        const id = pathname.split('/').pop();
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Not Found',
          message: `Contract ${id} not found`,
        }));
        return;
      }

      // Rate cards endpoints
      if (pathname === '/api/v1/rate-cards' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: [],
          total: 0,
          page: 1,
          limit: 10,
        }));
        return;
      }

      // Artifacts endpoints
      if (pathname === '/api/v1/artifacts' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: [],
          total: 0,
        }));
        return;
      }
    }

    // 404 for unknown routes
    const errorResponse: ErrorResponse = {
      error: 'Not Found',
      message: `Route ${pathname} not found`,
      statusCode: 404,
    };
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorResponse));

  } catch (error) {
    const errorResponse: ErrorResponse = {
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
      statusCode: 500,
    };
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorResponse));
  }
};

// Start server
const startServer = async (): Promise<void> => {
  const server = createServer(handleRequest);

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      process.exit(1);
    }
  });

  server.listen(PORT, HOST, () => {
    // Server started successfully
  });

  // Graceful shutdown
  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });

    setTimeout(() => {
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

// Run if executed directly
if (require.main === module) {
  startServer().catch(() => {
    process.exit(1);
  });
}

export { startServer, handleRequest };
