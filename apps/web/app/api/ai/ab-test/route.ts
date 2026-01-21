/**
 * AI Model A/B Testing API
 * 
 * POST /api/ai/ab-test - Execute A/B test request
 * GET /api/ai/ab-test - List active tests or get test analysis
 * PUT /api/ai/ab-test - Create or update test
 * DELETE /api/ai/ab-test - Delete test
 */

import { NextRequest, NextResponse } from 'next/server';
import { abTestingService, type ABTestConfig } from '@/lib/ai/ab-testing.service';
import { getServerSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST - Execute A/B test or record rating
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, testId, prompt, systemPrompt, requestId, rating, model, compare } = body;

    if (action === 'rate') {
      // Record user rating
      if (!testId || !requestId || rating === undefined || !model) {
        return NextResponse.json(
          { error: 'testId, requestId, rating, and model are required' },
          { status: 400 }
        );
      }

      abTestingService.recordRating(testId, requestId, rating, model);
      return NextResponse.json({ success: true, message: 'Rating recorded' });
    }

    // Execute A/B test
    if (!testId || !prompt) {
      return NextResponse.json(
        { error: 'testId and prompt are required' },
        { status: 400 }
      );
    }

    if (compare) {
      // Execute both models and return comparison
      const comparison = await abTestingService.executeComparison(testId, prompt, systemPrompt);
      return NextResponse.json({
        success: true,
        comparison: {
          modelA: {
            requestId: comparison.modelA.requestId,
            response: comparison.modelA.response,
            metrics: comparison.modelA.metrics,
            modelConfig: {
              provider: comparison.modelA.modelConfig.provider,
              modelId: comparison.modelA.modelConfig.modelId,
            },
          },
          modelB: {
            requestId: comparison.modelB.requestId,
            response: comparison.modelB.response,
            metrics: comparison.modelB.metrics,
            modelConfig: {
              provider: comparison.modelB.modelConfig.provider,
              modelId: comparison.modelB.modelConfig.modelId,
            },
          },
        },
      });
    }

    // Execute single test (A/B split)
    const result = await abTestingService.executeTest(testId, prompt, systemPrompt);
    
    return NextResponse.json({
      success: true,
      result: {
        requestId: result.requestId,
        selectedModel: result.selectedModel,
        response: result.response,
        metrics: result.metrics,
        modelConfig: {
          provider: result.modelConfig.provider,
          modelId: result.modelConfig.modelId,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test execution failed' },
      { status: 500 }
    );
  }
}

// GET - List tests or get analysis
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const testId = searchParams.get('testId');
    const action = searchParams.get('action');

    if (testId) {
      const test = abTestingService.getTest(testId);
      if (!test) {
        return NextResponse.json({ error: 'Test not found' }, { status: 404 });
      }

      if (action === 'analyze') {
        const analysis = abTestingService.analyzeTest(testId);
        return NextResponse.json({ success: true, analysis });
      }

      if (action === 'results') {
        const results = abTestingService.getResults(testId);
        return NextResponse.json({ 
          success: true, 
          test,
          results: results.slice(-100), // Last 100 results
          totalResults: results.length,
        });
      }

      return NextResponse.json({ success: true, test });
    }

    // List all active tests
    const tests = abTestingService.getActiveTests();
    return NextResponse.json({
      success: true,
      tests,
      totalActive: tests.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get tests' },
      { status: 500 }
    );
  }
}

// PUT - Create or update test
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { testId, name, description, modelA, modelB, trafficSplit, metrics, status } = body;

    // Update existing test status
    if (testId && status) {
      abTestingService.updateTestStatus(testId, status);
      return NextResponse.json({ 
        success: true, 
        message: `Test status updated to ${status}`,
        test: abTestingService.getTest(testId),
      });
    }

    // Create new test
    if (!name || !modelA || !modelB) {
      return NextResponse.json(
        { error: 'name, modelA, and modelB are required' },
        { status: 400 }
      );
    }

    const testConfig: Omit<ABTestConfig, 'id' | 'status' | 'startDate'> = {
      name,
      description,
      modelA: {
        provider: modelA.provider || 'openai',
        modelId: modelA.modelId,
        temperature: modelA.temperature,
        maxTokens: modelA.maxTokens,
        systemPrompt: modelA.systemPrompt,
      },
      modelB: {
        provider: modelB.provider || 'openai',
        modelId: modelB.modelId,
        temperature: modelB.temperature,
        maxTokens: modelB.maxTokens,
        systemPrompt: modelB.systemPrompt,
      },
      trafficSplit: trafficSplit ?? 50,
      metrics: metrics || ['latency', 'token_usage', 'response_length', 'user_rating'],
    };

    const test = abTestingService.createTest(testConfig);

    return NextResponse.json({
      success: true,
      message: 'A/B test created',
      test,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create test' },
      { status: 500 }
    );
  }
}

// DELETE - Delete test
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const testId = searchParams.get('testId');

    if (!testId) {
      return NextResponse.json(
        { error: 'testId is required' },
        { status: 400 }
      );
    }

    abTestingService.deleteTest(testId);

    return NextResponse.json({
      success: true,
      message: 'Test deleted',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete test' },
      { status: 500 }
    );
  }
}
