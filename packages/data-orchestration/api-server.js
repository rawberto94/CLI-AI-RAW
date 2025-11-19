#!/usr/bin/env node
/**
 * Data Orchestration API Server
 * Provides REST API endpoints for integration testing and external services
 */

const { createServer } = require('http');
const { parse } = require('url');

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || '0.0.0.0';

// Simple request handler
const handleRequest = async (req, res) => {
  const parsedUrl = parse(req.url || '', true);
  const pathname = parsedUrl.pathname || '/';
  const method = req.method || 'GET';

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');

  // Handle preflight
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // Health check endpoint
    if (pathname === '/healthz' || pathname === '/health' || pathname === '/api/health') {
      const response = {
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
    const errorResponse = {
      error: 'Not Found',
      message: `Route ${pathname} not found`,
      statusCode: 404,
    };
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorResponse));

  } catch (error) {
    console.error('Error handling request:', error);
    
    const errorResponse = {
      error: 'Internal Server Error',
      message: error.message || 'Unknown error',
      statusCode: 500,
    };
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorResponse));
  }
};

// Start server
const startServer = async () => {
  const server = createServer(handleRequest);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use`);
      console.error(`   Try: lsof -ti:${PORT} | xargs kill -9`);
      process.exit(1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║  🚀 Data Orchestration API Server Running            ║
║                                                        ║
║  URL:      http://${HOST}:${PORT}                          ║
║  Health:   http://${HOST}:${PORT}/healthz                 ║
║  Version:  1.0.0                                       ║
║  PID:      ${process.pid}                                  ║
╚═══════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n⚠️  Shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('❌ Forced shutdown');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

// Run if executed directly
if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { startServer, handleRequest };
