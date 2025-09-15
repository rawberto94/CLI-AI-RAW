/**
 * AI Orchestrator API Routes
 * Multi-model LLM management and analysis endpoints
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { aiOrchestrator } from '../ai/orchestrator';
import { AppError } from '../errors';

// Validation schemas
const analysisRequestSchema = z.object({
  content: z.string().min(10).max(200000),
  taskType: z.enum(['risk-analysis', 'compliance-check', 'clause-extraction', 'summary', 'classification']),
  complexity: z.enum(['simple', 'medium', 'complex']).default('medium'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  maxCost: z.number().positive().optional(),
  timeoutMs: z.number().min(1000).max(120000).optional(),
  requiresStructuredOutput: z.boolean().default(false)
});

export function registerAIRoutes(fastify: FastifyInstance) {

  /**
   * Main AI analysis endpoint
   */
  fastify.post('/api/ai/analyze', async (request, reply) => {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    try {
      const parsed = analysisRequestSchema.parse(request.body);
      
      const analysisRequest = {
        content: parsed.content,
        taskType: parsed.taskType,
        complexity: parsed.complexity,
        priority: parsed.priority,
        tenantId,
        requiresStructuredOutput: parsed.requiresStructuredOutput,
        ...(parsed.maxCost && { maxCost: parsed.maxCost }),
        ...(parsed.timeoutMs && { timeoutMs: parsed.timeoutMs })
      };

      const result = await aiOrchestrator.analyze(analysisRequest);
      
      return {
        success: true,
        data: result.result,
        metadata: {
          modelUsed: result.modelUsed,
          cost: result.cost,
          processingTime: result.processingTime,
          tokensUsed: result.tokensUsed,
          confidence: result.confidence,
          cacheHit: result.cacheHit || false
        }
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid analysis request', true, {
          validationErrors: error.errors
        });
      }
      throw new AppError(500, `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  /**
   * Batch analysis endpoint
   */
  fastify.post('/api/ai/analyze/batch', async (request, reply) => {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    const batchSchema = z.object({
      requests: z.array(analysisRequestSchema).min(1).max(10), // Limit batch size
      concurrent: z.boolean().default(true)
    });

    try {
      const { requests, concurrent } = batchSchema.parse(request.body);
      
      const analysisRequests = requests.map(req => ({
        content: req.content,
        taskType: req.taskType,
        complexity: req.complexity,
        priority: req.priority,
        tenantId,
        requiresStructuredOutput: req.requiresStructuredOutput,
        ...(req.maxCost && { maxCost: req.maxCost }),
        ...(req.timeoutMs && { timeoutMs: req.timeoutMs })
      }));
      
      let results;
      if (concurrent) {
        // Process all requests concurrently
        results = await Promise.allSettled(
          analysisRequests.map(req => aiOrchestrator.analyze(req))
        );
      } else {
        // Process sequentially to manage costs/rate limits
        results = [];
        for (const req of analysisRequests) {
          try {
            const result = await aiOrchestrator.analyze(req);
            results.push({ status: 'fulfilled', value: result });
          } catch (error) {
            results.push({ status: 'rejected', reason: error });
          }
        }
      }

      const successful = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as any).value);
      
      const failed = results
        .filter(r => r.status === 'rejected')
        .map(r => (r as any).reason);

      return {
        success: true,
        totalRequests: requests.length,
        successful: successful.length,
        failed: failed.length,
        results: successful,
        errors: failed.map(err => err?.message || 'Unknown error'),
        totalCost: successful.reduce((sum, result) => sum + result.cost, 0)
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid batch request', true, {
          validationErrors: error.errors
        });
      }
      throw new AppError(500, `Batch analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  /**
   * AI model metrics and performance
   */
  fastify.get('/api/ai/metrics', async () => {
    try {
      const metrics = aiOrchestrator.getMetrics();
      
      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new AppError(500, `Failed to get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  /**
   * AI model health check
   */
  fastify.get('/api/ai/health', async () => {
    try {
      const healthStatus = await aiOrchestrator.healthCheck();
      
      const overallHealth = Object.values(healthStatus).every(status => status);
      
      return {
        success: true,
        healthy: overallHealth,
        models: healthStatus,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new AppError(500, `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  /**
   * Get available models and capabilities
   */
  fastify.get('/api/ai/models', async () => {
    // This would normally come from the orchestrator, but for now return static config
    const models = {
      'gpt-4-turbo': {
        provider: 'openai',
        name: 'GPT-4 Turbo',
        description: 'Most capable model for complex analysis tasks',
        capabilities: ['analysis', 'reasoning', 'complex-tasks'],
        costPer1kTokens: 0.01,
        maxTokens: 128000
      },
      'gpt-4o': {
        provider: 'openai',
        name: 'GPT-4o',
        description: 'Fast and efficient model with vision capabilities',
        capabilities: ['analysis', 'reasoning', 'complex-tasks', 'vision'],
        costPer1kTokens: 0.005,
        maxTokens: 128000
      },
      'gpt-3.5-turbo': {
        provider: 'openai',
        name: 'GPT-3.5 Turbo', 
        description: 'Fast and cost-effective for simple tasks',
        capabilities: ['simple-analysis', 'classification'],
        costPer1kTokens: 0.001,
        maxTokens: 16000
      },
      'claude-3-opus': {
        provider: 'anthropic',
        name: 'Claude 3 Opus',
        description: 'Superior reasoning for complex analysis',
        capabilities: ['analysis', 'reasoning', 'long-documents'],
        costPer1kTokens: 0.015,
        maxTokens: 200000
      },
      'claude-3-sonnet': {
        provider: 'anthropic',
        name: 'Claude 3 Sonnet',
        description: 'Balanced performance and cost',
        capabilities: ['analysis', 'reasoning', 'long-documents'],
        costPer1kTokens: 0.003,
        maxTokens: 200000
      },
      'claude-3-haiku': {
        provider: 'anthropic',
        name: 'Claude 3 Haiku',
        description: 'Fast and economical for simple tasks',
        capabilities: ['simple-analysis', 'classification', 'fast-response'],
        costPer1kTokens: 0.00025,
        maxTokens: 200000
      }
    };

    return {
      success: true,
      models,
      totalModels: Object.keys(models).length
    };
  });

  /**
   * Estimate cost for analysis request
   */
  fastify.post('/api/ai/estimate-cost', async (request) => {
    const estimateSchema = z.object({
      content: z.string().min(1),
      taskType: z.enum(['risk-analysis', 'compliance-check', 'clause-extraction', 'summary', 'classification']),
      complexity: z.enum(['simple', 'medium', 'complex']).default('medium'),
      preferredModel: z.string().optional()
    });

    try {
      const { content, complexity } = estimateSchema.parse(request.body);
      
      // Rough token estimation (1 token ≈ 3-4 characters for English)
      const estimatedInputTokens = Math.ceil(content.length / 3.5);
      const estimatedOutputTokens = {
        'simple': 200,
        'medium': 500,
        'complex': 1000
      }[complexity];

      const totalTokens = estimatedInputTokens + estimatedOutputTokens;

      // Get cost estimates for suitable models
      const models = {
        'gpt-4-turbo': 0.01,
        'gpt-4o': 0.005,
        'gpt-3.5-turbo': 0.001,
        'claude-3-opus': 0.015,
        'claude-3-sonnet': 0.003,
        'claude-3-haiku': 0.00025
      };

      const estimates = Object.entries(models).map(([modelId, costPer1k]) => ({
        model: modelId,
        estimatedCost: (totalTokens / 1000) * costPer1k,
        estimatedTokens: totalTokens
      }));

      // Sort by cost
      estimates.sort((a, b) => a.estimatedCost - b.estimatedCost);

      return {
        success: true,
        estimates,
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        totalTokens,
        recommended: estimates[Math.floor(estimates.length / 2)] // Middle option
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid cost estimation request', true, {
          validationErrors: error.errors
        });
      }
      throw new AppError(500, `Cost estimation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  /**
   * AI analysis templates for common contract tasks
   */
  fastify.get('/api/ai/templates', async () => {
    const templates = {
      'contract-review': {
        name: 'Comprehensive Contract Review',
        description: 'Full analysis including risk, compliance, and key terms',
        tasks: [
          { taskType: 'risk-analysis', complexity: 'complex' },
          { taskType: 'compliance-check', complexity: 'medium' },
          { taskType: 'clause-extraction', complexity: 'medium' },
          { taskType: 'summary', complexity: 'simple' }
        ],
        estimatedCost: 0.15,
        estimatedTime: '2-5 minutes'
      },
      'quick-assessment': {
        name: 'Quick Contract Assessment',
        description: 'Fast overview with basic risk and summary',
        tasks: [
          { taskType: 'classification', complexity: 'simple' },
          { taskType: 'summary', complexity: 'simple' },
          { taskType: 'risk-analysis', complexity: 'simple' }
        ],
        estimatedCost: 0.03,
        estimatedTime: '30-60 seconds'
      },
      'compliance-focused': {
        name: 'Compliance-Focused Review',
        description: 'Detailed compliance and regulatory analysis',
        tasks: [
          { taskType: 'compliance-check', complexity: 'complex' },
          { taskType: 'risk-analysis', complexity: 'medium' },
          { taskType: 'clause-extraction', complexity: 'medium' }
        ],
        estimatedCost: 0.08,
        estimatedTime: '1-3 minutes'
      },
      'risk-assessment': {
        name: 'Risk Assessment',
        description: 'Comprehensive risk analysis and mitigation suggestions',
        tasks: [
          { taskType: 'risk-analysis', complexity: 'complex' },
          { taskType: 'clause-extraction', complexity: 'medium' }
        ],
        estimatedCost: 0.06,
        estimatedTime: '1-2 minutes'
      }
    };

    return {
      success: true,
      templates,
      totalTemplates: Object.keys(templates).length
    };
  });

  /**
   * Execute analysis template
   */
  fastify.post('/api/ai/templates/:templateId/execute', async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    const executeSchema = z.object({
      content: z.string().min(10).max(200000),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium')
    });

    try {
      const { content, priority } = executeSchema.parse(request.body);
      
      // Get template configuration (this would come from database in production)
      const templates: Record<string, any> = {
        'contract-review': [
          { taskType: 'risk-analysis', complexity: 'complex' },
          { taskType: 'compliance-check', complexity: 'medium' },
          { taskType: 'clause-extraction', complexity: 'medium' },
          { taskType: 'summary', complexity: 'simple' }
        ],
        'quick-assessment': [
          { taskType: 'classification', complexity: 'simple' },
          { taskType: 'summary', complexity: 'simple' },
          { taskType: 'risk-analysis', complexity: 'simple' }
        ],
        'compliance-focused': [
          { taskType: 'compliance-check', complexity: 'complex' },
          { taskType: 'risk-analysis', complexity: 'medium' },
          { taskType: 'clause-extraction', complexity: 'medium' }
        ],
        'risk-assessment': [
          { taskType: 'risk-analysis', complexity: 'complex' },
          { taskType: 'clause-extraction', complexity: 'medium' }
        ]
      };

      const templateTasks = templates[templateId];
      if (!templateTasks) {
        throw new AppError(404, 'Template not found');
      }

      // Execute all tasks in the template
      const results = await Promise.allSettled(
        templateTasks.map((task: any) => 
          aiOrchestrator.analyze({
            content,
            tenantId,
            priority,
            requiresStructuredOutput: true,
            ...task
          })
        )
      );

      const successful = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as any).value);
      
      const failed = results
        .filter(r => r.status === 'rejected')
        .map(r => (r as any).reason);

      // Combine results into structured response
      const combinedResults: Record<string, any> = {};
      templateTasks.forEach((task: any, index: number) => {
        if (index < results.length) {
          const result = results[index];
          if (result && result.status === 'fulfilled') {
            combinedResults[task.taskType] = (result as any).value.result;
          }
        }
      });

      return {
        success: true,
        templateId,
        results: combinedResults,
        metadata: {
          totalTasks: templateTasks.length,
          successful: successful.length,
          failed: failed.length,
          totalCost: successful.reduce((sum, result) => sum + result.cost, 0),
          processingTime: Math.max(...successful.map(r => r.processingTime)),
          modelsUsed: [...new Set(successful.map(r => r.modelUsed))]
        },
        errors: failed.map(err => err?.message || 'Unknown error')
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof z.ZodError) {
        throw new AppError(400, 'Invalid template execution request', true, {
          validationErrors: error.errors
        });
      }
      throw new AppError(500, `Template execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}