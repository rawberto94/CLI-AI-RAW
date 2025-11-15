#!/usr/bin/env node

/**
 * Custom Next.js dev server with improved stability and error handling
 * Handles HMR connection issues and provides better error recovery
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3005', 10);

// Configure Next.js with custom options
const app = next({
  dev,
  hostname,
  port,
  customServer: true,
  // Disable unnecessary features in dev
  experimental: {
    isrMemoryCacheSize: 0, // Disable ISR memory cache
  },
});

const handle = app.getRequestHandler();

let server;
let isShuttingDown = false;

async function startServer() {
  try {
    console.log('🚀 Preparing Next.js application...');
    await app.prepare();
    console.log('✅ Next.js ready!');

    server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    // Handle server errors
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
        console.error(`   Try: lsof -ti:${port} | xargs kill -9`);
        process.exit(1);
      } else {
        console.error('Server error:', err);
      }
    });

    // Handle client connection errors gracefully
    server.on('clientError', (err, socket) => {
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        // Ignore common connection errors
        return;
      }
      console.error('Client error:', err.message);
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    await new Promise((resolve, reject) => {
      server.listen(port, hostname, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    console.log(`
╔═══════════════════════════════════════════════════════╗
║  🎉 Next.js Dev Server Running                       ║
║                                                        ║
║  Local:    http://localhost:${port}                     ║
║  Network:  http://${hostname}:${port}                      ║
║                                                        ║
║  Environment: ${dev ? 'development' : 'production'}                            ║
║  PID: ${process.pid}                                      ║
╚═══════════════════════════════════════════════════════╝
    `);

    // Handle graceful shutdown
    const gracefulShutdown = async (signal) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);
      
      if (server) {
        server.close(() => {
          console.log('✅ Server closed');
          process.exit(0);
        });

        // Force close after 10 seconds
        setTimeout(() => {
          console.error('❌ Forced shutdown after timeout');
          process.exit(1);
        }, 10000);
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err);
      gracefulShutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Start the server
startServer().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
