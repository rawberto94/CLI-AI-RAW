/**
 * Integration API Routes
 * Exposes integration layer functionality via REST API
 */

import { Router } from 'express';
import { 
  integrationManager, 
  IntegrationUtils, 
  IntegrationPatterns,
  healthCheck,
  getMetrics,
  getStatus
} from '../../core/integration';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const health = await healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
});

/**
 * System metrics endpoint
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await getMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error.message
    });
  }
});

/**
 * System status endpoint
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve status',
      message: error.message
    });
  }
});

/**
 * Process contract through integration layer
 */
router.post('/contracts/:contractId/process', async (req, res) => {
  try {
    const { contractId } = req.params;
    const { pipeline, priority, enableRealTimeUpdates } = req.body;
    
    // Create system context
    const context = IntegrationUtils.createSystemContext(
      req.headers['x-tenant-id'] as string || 'default',
      req.headers['x-user-id'] as string,
      req.headers['x-session-id'] as string,
      {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        source: 'api'
      }
    );

    // Get contract data (this would typically come from database)
    const contractData = {
      id: contractId,
      tenantId: context.tenantId,
      content: req.body.content || '',
      metadata: req.body.metadata || {}
    };

    // Process through integration layer
    const result = await integrationManager.processContract(
      contractData,
      context,
      {
        pipeline,
        priority,
        enableRealTimeUpdates
      }
    );

    res.json({
      success: result.success,
      contractId,
      results: result.results,
      metrics: result.metrics,
      errors: result.errors,
      warnings: result.warnings
    });

  } catch (error) {
    res.status(500).json({
      error: 'Contract processing failed',
      message: error.message,
      contractId: req.params.contractId
    });
  }
});

/**
 * Execute cross-system query
 */
router.post('/query', async (req, res) => {
  try {
    const { query, options } = req.body;
    
    const context = IntegrationUtils.createSystemContext(
      req.headers['x-tenant-id'] as string || 'default',
      req.headers['x-user-id'] as string,
      req.headers['x-session-id'] as string,
      {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        source: 'api'
      }
    );

    const result = await integrationManager.executeQuery(query, context, options);

    res.json({
      success: result.success,
      data: result.results,
      metrics: result.metrics,
      errors: result.errors
    });

  } catch (error) {
    res.status(500).json({
      error: 'Query execution failed',
      message: error.message
    });
  }
});

/**
 * Execute CQRS command
 */
router.post('/commands', async (req, res) => {
  try {
    const { type, aggregateId, payload } = req.body;
    
    const context = IntegrationUtils.createSystemContext(
      req.headers['x-tenant-id'] as string || 'default',
      req.headers['x-user-id'] as string,
      req.headers['x-session-id'] as string,
      {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        source: 'api'
      }
    );

    const result = await IntegrationPatterns.executeCommand(
      { type, aggregateId, payload },
      context
    );

    res.json({
      success: result.success,
      commandType: type,
      aggregateId,
      result: result.results
    });

  } catch (error) {
    res.status(500).json({
      error: 'Command execution failed',
      message: error.message
    });
  }
});

/**
 * Execute CQRS query
 */
router.post('/queries', async (req, res) => {
  try {
    const { type, parameters } = req.body;
    
    const context = IntegrationUtils.createSystemContext(
      req.headers['x-tenant-id'] as string || 'default',
      req.headers['x-user-id'] as string,
      req.headers['x-session-id'] as string,
      {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        source: 'api'
      }
    );

    const result = await IntegrationPatterns.executeQuery(
      { type, parameters },
      context
    );

    res.json({
      success: result.success,
      queryType: type,
      data: result.results
    });

  } catch (error) {
    res.status(500).json({
      error: 'Query execution failed',
      message: error.message
    });
  }
});

/**
 * Execute distributed saga
 */
router.post('/sagas', async (req, res) => {
  try {
    const { sagaId, steps } = req.body;
    
    const context = IntegrationUtils.createSystemContext(
      req.headers['x-tenant-id'] as string || 'default',
      req.headers['x-user-id'] as string,
      req.headers['x-session-id'] as string,
      {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        source: 'api'
      }
    );

    const results = await IntegrationPatterns.executeSaga(
      sagaId,
      steps,
      context
    );

    res.json({
      success: true,
      sagaId,
      results
    });

  } catch (error) {
    res.status(500).json({
      error: 'Saga execution failed',
      message: error.message,
      sagaId: req.body.sagaId
    });
  }
});

/**
 * Get event history for aggregate
 */
router.get('/events/:aggregateId', async (req, res) => {
  try {
    const { aggregateId } = req.params;
    const { fromVersion } = req.query;
    
    const events = await IntegrationPatterns.replayEvents(
      aggregateId,
      fromVersion ? parseInt(fromVersion as string) : 0
    );

    res.json({
      aggregateId,
      events,
      count: events.length
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve events',
      message: error.message,
      aggregateId: req.params.aggregateId
    });
  }
});

/**
 * Service mesh endpoints
 */
router.get('/services', async (req, res) => {
  try {
    // This would get service registry information
    const services = []; // Placeholder
    res.json({ services });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve services',
      message: error.message
    });
  }
});

router.post('/services/:serviceId/call', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { method, endpoint, payload, options } = req.body;
    
    const context = IntegrationUtils.createSystemContext(
      req.headers['x-tenant-id'] as string || 'default',
      req.headers['x-user-id'] as string,
      req.headers['x-session-id'] as string,
      {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        source: 'api'
      }
    );

    const result = await integrationManager.callService(
      serviceId,
      method,
      endpoint,
      payload,
      context,
      options
    );

    res.json({
      success: true,
      serviceId,
      result
    });

  } catch (error) {
    res.status(500).json({
      error: 'Service call failed',
      message: error.message,
      serviceId: req.params.serviceId
    });
  }
});

/**
 * WebSocket endpoint for real-time updates
 */
router.ws('/events/stream', (ws, req) => {
  const context = IntegrationUtils.createSystemContext(
    req.headers['x-tenant-id'] as string || 'default',
    req.headers['x-user-id'] as string,
    req.headers['x-session-id'] as string
  );

  // Subscribe to events
  const eventHandler = (event: any) => {
    if (event.metadata.tenantId === context.tenantId) {
      ws.send(JSON.stringify({
        type: 'event',
        data: event
      }));
    }
  };

  integrationManager.on('event:published', eventHandler);
  integrationManager.on('job:completed', (job, result) => {
    if (job.context.tenantId === context.tenantId) {
      ws.send(JSON.stringify({
        type: 'job_completed',
        data: { job, result }
      }));
    }
  });

  ws.on('close', () => {
    integrationManager.removeListener('event:published', eventHandler);
  });

  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    data: { timestamp: new Date(), context }
  }));
});

/**
 * Admin endpoints
 */
router.post('/admin/shutdown', async (req, res) => {
  try {
    await integrationManager.shutdown();
    res.json({
      success: true,
      message: 'Integration layer shutdown initiated'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Shutdown failed',
      message: error.message
    });
  }
});

router.get('/admin/config', async (req, res) => {
  try {
    const status = await getStatus();
    res.json({
      config: status.config
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve configuration',
      message: error.message
    });
  }
});

export default router;