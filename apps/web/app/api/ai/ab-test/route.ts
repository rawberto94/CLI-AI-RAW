/**
 * AI Model A/B Testing API
 * 
 * POST /api/ai/ab-test - Execute A/B test request
 * GET /api/ai/ab-test - List active tests or get test analysis
 * PUT /api/ai/ab-test - Create or update test
 * DELETE /api/ai/ab-test - Delete test
 */

import { NextRequest } from 'next/server';
import { abTestingService, type ABTestConfig } from '@/lib/ai/ab-testing.service';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

// POST - Execute A/B test or record rating
export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { action, testId, prompt, systemPrompt, requestId, rating, model, compare } = body;

    if (action === 'rate') {
      // Record user rating
      if (!testId || !requestId || rating === undefined || !model) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'testId, requestId, rating, and model are required', 400);
      }

      abTestingService.recordRating(testId, requestId, rating, model);
      return createSuccessResponse(ctx, { message: 'Rating recorded' });
    }

    // Execute A/B test
    if (!testId || !prompt) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'testId and prompt are required', 400);
    }

    if (compare) {
      // Execute both models and return comparison
      const comparison = await abTestingService.executeComparison(testId, prompt, systemPrompt);
      return createSuccessResponse(ctx, {
        comparison: {
          modelA: {
            requestId: comparison.modelA.requestId,
            response: comparison.modelA.response,
            metrics: comparison.modelA.metrics,
            modelConfig: {
              provider: comparison.modelA.modelConfig.provider,
              modelId: comparison.modelA.modelConfig.modelId } },
          modelB: {
            requestId: comparison.modelB.requestId,
            response: comparison.modelB.response,
            metrics: comparison.modelB.metrics,
            modelConfig: {
              provider: comparison.modelB.modelConfig.provider,
              modelId: comparison.modelB.modelConfig.modelId } } } });
    }

    // Execute single test (A/B split)
    const result = await abTestingService.executeTest(testId, prompt, systemPrompt);
    
    return createSuccessResponse(ctx, {
      result: {
        requestId: result.requestId,
        selectedModel: result.selectedModel,
        response: result.response,
        metrics: result.metrics,
        modelConfig: {
          provider: result.modelConfig.provider,
          modelId: result.modelConfig.modelId } } });
  });

// GET - List tests or get analysis
export const GET = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const testId = searchParams.get('testId');
    const action = searchParams.get('action');

    if (testId) {
      const test = abTestingService.getTest(testId);
      if (!test) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Test not found', 404);
      }

      if (action === 'analyze') {
        const analysis = abTestingService.analyzeTest(testId);
        return createSuccessResponse(ctx, { analysis });
      }

      if (action === 'results') {
        const results = abTestingService.getResults(testId);
        return createSuccessResponse(ctx, { 
          test,
          results: results.slice(-100), // Last 100 results
          totalResults: results.length });
      }

      return createSuccessResponse(ctx, { test });
    }

    // List all active tests
    const tests = abTestingService.getActiveTests();
    return createSuccessResponse(ctx, {
      tests,
      totalActive: tests.length });
  });

// PUT - Create or update test
export const PUT = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { testId, name, description, modelA, modelB, trafficSplit, metrics, status } = body;

    // Update existing test status
    if (testId && status) {
      abTestingService.updateTestStatus(testId, status);
      return createSuccessResponse(ctx, { 
        message: `Test status updated to ${status}`,
        test: abTestingService.getTest(testId) });
    }

    // Create new test
    if (!name || !modelA || !modelB) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'name, modelA, and modelB are required', 400);
    }

    const testConfig: Omit<ABTestConfig, 'id' | 'status' | 'startDate'> = {
      name,
      description,
      modelA: {
        provider: modelA.provider || 'openai',
        modelId: modelA.modelId,
        temperature: modelA.temperature,
        maxTokens: modelA.maxTokens,
        systemPrompt: modelA.systemPrompt },
      modelB: {
        provider: modelB.provider || 'openai',
        modelId: modelB.modelId,
        temperature: modelB.temperature,
        maxTokens: modelB.maxTokens,
        systemPrompt: modelB.systemPrompt },
      trafficSplit: trafficSplit ?? 50,
      metrics: metrics || ['latency', 'token_usage', 'response_length', 'user_rating'] };

    const test = abTestingService.createTest(testConfig);

    return createSuccessResponse(ctx, {
      message: 'A/B test created',
      test });
  });

// DELETE - Delete test
export const DELETE = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const testId = searchParams.get('testId');

    if (!testId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'testId is required', 400);
    }

    abTestingService.deleteTest(testId);

    return createSuccessResponse(ctx, {
      message: 'Test deleted' });
  });
