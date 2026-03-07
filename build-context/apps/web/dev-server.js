#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Custom Next.js dev server with improved stability and error handling
 * Handles HMR connection issues and provides better error recovery
 */

const { createServer } = require('http');
const { parse } = require('url');
const os = require('os');
const path = require('path');
const next = require('next');

const allowHeapSnapshot = process.env.ALLOW_HEAP_SNAPSHOT === '1';
const v8 = allowHeapSnapshot ? require('v8') : null;

const envNumber = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || '0.0.0.0';
const port = parseInt(process.env.PORT || '3005', 10);

// Connection and rate limiting configuration
const MAX_CONCURRENT_REQUESTS = envNumber('MAX_CONCURRENT_REQUESTS', 100);
const RATE_LIMIT_WINDOW = envNumber('RATE_LIMIT_WINDOW_MS', 60000); // 1 minute
const MAX_REQUESTS_PER_WINDOW = envNumber('MAX_REQUESTS_PER_WINDOW', 1000);
const MEMORY_CHECK_INTERVAL = envNumber('MEMORY_CHECK_INTERVAL_MS', 30000); // 30 seconds
const MEMORY_SOFT_LIMIT_MB = envNumber('MEMORY_SOFT_LIMIT_MB', 6144);
const MEMORY_HARD_LIMIT_MB = envNumber('MEMORY_HARD_LIMIT_MB', 7168);
const MEMORY_RECOVERY_BUFFER_MB = envNumber('MEMORY_RECOVERY_BUFFER_MB', 512);
const MEMORY_PRESSURE_COOLDOWN = envNumber('MEMORY_PRESSURE_COOLDOWN_MS', 120000);
const CLEANUP_INTERVAL = envNumber('CLEANUP_INTERVAL_MS', 120000); // 2 minutes
const FORCE_SHUTDOWN_DELAY_MS = envNumber('FORCE_SHUTDOWN_DELAY_MS', 10000);

let activeRequests = 0;
const requestCounts = new Map();
let memoryWarningIssued = false;
const memoryState = {
  pressureActive: false,
  lastTriggeredAt: 0,
  forcedRestartTimer: null,
};
let lastSnapshotPath = null;

const getPublicMemoryState = () => ({
  pressureActive: memoryState.pressureActive,
  lastTriggeredAt: memoryState.lastTriggeredAt,
  forcedRestartScheduled: Boolean(memoryState.forcedRestartTimer),
});

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

    // Memory monitoring
    const memoryMonitor = setInterval(() => {
      const usage = process.memoryUsage();
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const rssMB = Math.round(usage.rss / 1024 / 1024);
      
      console.log(`[Memory] Heap: ${heapUsedMB}/${heapTotalMB}MB, RSS: ${rssMB}MB, Active Requests: ${activeRequests}`);
      
      const underRecoveryThreshold = heapUsedMB <= (MEMORY_SOFT_LIMIT_MB - MEMORY_RECOVERY_BUFFER_MB);

      if (heapUsedMB >= MEMORY_SOFT_LIMIT_MB && !memoryState.pressureActive) {
        memoryState.pressureActive = true;
        memoryState.lastTriggeredAt = Date.now();
        console.warn('⚠️  Memory pressure detected. Throttling new requests...');
      } else if (memoryState.pressureActive && underRecoveryThreshold) {
        memoryState.pressureActive = false;
        console.log('✅ Memory usage recovered; resuming normal traffic.');
      }

      if (heapUsedMB > MEMORY_SOFT_LIMIT_MB && !memoryWarningIssued) {
        console.warn('⚠️  WARNING: Memory usage high! Triggering garbage collection...');
        memoryWarningIssued = true;
        if (global.gc) {
          global.gc();
          console.log('✅ Garbage collection triggered');
        } else {
          console.warn('⚠️  Garbage collection not available. Start with --expose-gc flag.');
        }
        setTimeout(() => { memoryWarningIssued = false; }, 60000);
      }

      if (heapUsedMB >= MEMORY_HARD_LIMIT_MB) {
        if (!memoryState.forcedRestartTimer) {
          console.error('❌ Memory hard limit exceeded. Scheduling graceful restart.');
          memoryState.forcedRestartTimer = setTimeout(() => {
            console.error('❌ Forcing shutdown due to sustained memory pressure.');
            gracefulShutdown('MEMORY_LIMIT');
          }, FORCE_SHUTDOWN_DELAY_MS);
        }
      } else if (memoryState.forcedRestartTimer && heapUsedMB < MEMORY_SOFT_LIMIT_MB) {
        clearTimeout(memoryState.forcedRestartTimer);
        memoryState.forcedRestartTimer = null;
        console.log('✅ Hard limit timer cleared; memory back under control.');
      }
    }, MEMORY_CHECK_INTERVAL);

    // Periodic cleanup
    const cleanupInterval = setInterval(() => {
      // Clean up old rate limit entries
      const now = Date.now();
      const cutoff = Math.floor((now - RATE_LIMIT_WINDOW * 3) / RATE_LIMIT_WINDOW);
      let cleaned = 0;
      for (const [key] of requestCounts) {
        const timestamp = parseInt(key.split('-')[1]);
        if (timestamp < cutoff) {
          requestCounts.delete(key);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        console.log(`[Cleanup] Removed ${cleaned} old rate limit entries`);
      }
    }, CLEANUP_INTERVAL);

    // Rate limiting helper
    const checkRateLimit = (ip) => {
      const now = Date.now();
      const key = `${ip}-${Math.floor(now / RATE_LIMIT_WINDOW)}`;
      const count = requestCounts.get(key) || 0;
      
      if (count >= MAX_REQUESTS_PER_WINDOW) {
        return false;
      }
      
      requestCounts.set(key, count + 1);
      
      // Clean old entries
      if (requestCounts.size > 10000) {
        const cutoff = Math.floor((now - RATE_LIMIT_WINDOW * 2) / RATE_LIMIT_WINDOW);
        for (const [k] of requestCounts) {
          if (parseInt(k.split('-')[1]) < cutoff) {
            requestCounts.delete(k);
          }
        }
      }
      
      return true;
    };

    server = createServer(async (req, res) => {
      const isHealthEndpoint = req.url === '/api/health' || req.url === '/healthz';
      const isRuntimeEndpoint = req.url.startsWith('/api/runtime-info');

      // Health check endpoint
      if (isHealthEndpoint) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          uptime: process.uptime(),
          activeRequests,
          memoryPressure: getPublicMemoryState(),
          timestamp: new Date().toISOString(),
        }));
        return;
      }

      if (isRuntimeEndpoint) {
        const parsedUrl = parse(req.url, true);
        let snapshotPath = null;
        if (allowHeapSnapshot && parsedUrl.query.snapshot === '1') {
          try {
            const filename = path.join(os.tmpdir(), `heap-${Date.now()}.heapsnapshot`);
            v8.writeHeapSnapshot(filename);
            snapshotPath = filename;
            lastSnapshotPath = filename;
            console.log(`📝 Heap snapshot written to ${filename}`);
          } catch (err) {
            console.error('Failed to capture heap snapshot:', err);
          }
        }

        const usage = process.memoryUsage();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          memory: {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            rss: usage.rss,
          },
          memoryState: getPublicMemoryState(),
          lastSnapshotPath,
          snapshotEnabled: allowHeapSnapshot,
        }));
        return;
      }

      if (memoryState.pressureActive && !isRuntimeEndpoint) {
        const withinCooldown = Date.now() - memoryState.lastTriggeredAt < MEMORY_PRESSURE_COOLDOWN;
        if (withinCooldown) {
          res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '30' });
          res.end(JSON.stringify({ error: 'Server under memory pressure, please retry shortly.' }));
          return;
        }
      }

      // Connection limit check
      if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '5' });
        res.end(JSON.stringify({ error: 'Server busy, please retry' }));
        return;
      }

      // Rate limiting check
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(ip)) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
        res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
        return;
      }

      activeRequests++;
      
      // Set request timeout
      const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
          console.warn(`⏱️  Request timeout: ${req.url}`);
          res.writeHead(408, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request timeout' }));
        }
      }, 120000); // 120 seconds - allow time for initial compilation
      
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      } finally {
        clearTimeout(timeoutId);
        activeRequests--;
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

    // Configure server connection settings
    server.maxConnections = MAX_CONCURRENT_REQUESTS + 50;
    server.keepAliveTimeout = 65000; // Slightly longer than common load balancer timeouts
    server.headersTimeout = 66000;

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
      
      // Clear intervals
      if (memoryMonitor) clearInterval(memoryMonitor);
      if (cleanupInterval) clearInterval(cleanupInterval);
      
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
