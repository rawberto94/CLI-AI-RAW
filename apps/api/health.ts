import { FastifyInstance } from 'fastify';

interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  dependencies: {
    database?: { status: 'up' | 'down'; responseTime?: number };
    redis?: { status: 'up' | 'down'; responseTime?: number };
    storage?: { status: 'up' | 'down'; responseTime?: number };
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  contracts: {
    total: number;
    processing: number;
    completed: number;
  };
}

export async function healthRoutes(fastify: FastifyInstance) {
  // Detailed health check endpoint
  fastify.get('/api/health', async (request, reply) => {
    const startTime = Date.now();
    const memUsage = process.memoryUsage();
    
    // Import store dynamically to avoid circular dependencies
  const { listContracts } = await import('./store');
    
    // Calculate contract statistics
    const allContracts = listContracts();
    const contractStats = {
      total: allContracts.length,
      processing: allContracts.filter((c: any) => c.status === 'processing').length,
      completed: allContracts.filter((c: any) => c.status === 'completed').length,
    };
    
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      dependencies: {},
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      contracts: contractStats,
    };

    // Check database connectivity (if available)
    try {
      // This is a placeholder - implement actual DB health check
      health.dependencies.database = { status: 'up', responseTime: 5 };
    } catch (error) {
      health.dependencies.database = { status: 'down' };
      health.status = 'unhealthy';
    }

    // Check Redis connectivity (if available)
    try {
      // This is a placeholder - implement actual Redis health check
      health.dependencies.redis = { status: 'up', responseTime: 2 };
    } catch (error) {
      health.dependencies.redis = { status: 'down' };
      health.status = 'unhealthy';
    }

    // Check storage connectivity (if available)
    try {
      // This is a placeholder - implement actual storage health check
      health.dependencies.storage = { status: 'up', responseTime: 10 };
    } catch (error) {
      health.dependencies.storage = { status: 'down' };
      health.status = 'unhealthy';
    }

    const responseTime = Date.now() - startTime;
    
    reply
      .code(health.status === 'healthy' ? 200 : 503)
      .header('X-Response-Time', `${responseTime}ms`)
      .send(health);
  });

  // Simple health check endpoint (for load balancers)
  fastify.get('/healthz', async (request, reply) => {
    reply.code(200).send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Readiness check endpoint
  fastify.get('/api/ready', async (request, reply) => {
    // Check if the application is ready to serve traffic
    const isReady = true; // Implement actual readiness checks
    
    reply
      .code(isReady ? 200 : 503)
      .send({ 
        ready: isReady, 
        timestamp: new Date().toISOString(),
        message: isReady ? 'Service ready' : 'Service not ready',
      });
  });

  // Liveness check endpoint
  fastify.get('/api/live', async (request, reply) => {
    // Check if the application is alive (not deadlocked)
    const isAlive = true; // Implement actual liveness checks
    
    reply
      .code(isAlive ? 200 : 503)
      .send({ 
        alive: isAlive, 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
  });
}
