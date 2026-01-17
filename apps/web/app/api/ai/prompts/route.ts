/**
 * Prompt Optimization API
 * 
 * Manages AI prompt versions and optimization:
 * - Create and track prompt versions
 * - Get optimization suggestions
 * - Activate optimized prompts
 * - Compare prompt versions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

// Dynamic import helper with proper typing
async function getAutoPromptOptimizerService() {
  const services = await import('@repo/data-orchestration/services');
  // Type assertion for runtime module
  return (services as any).autoPromptOptimizerService;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const autoPromptOptimizerService = await getAutoPromptOptimizerService();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';
    const artifactType = searchParams.get('artifactType');

    switch (action) {
      case 'list': {
        if (!artifactType) {
          return NextResponse.json(
            { error: 'artifactType is required' },
            { status: 400 }
          );
        }
        const versions = autoPromptOptimizerService.getAllVersions(artifactType, tenantId);
        const active = autoPromptOptimizerService.getActivePrompt(artifactType, tenantId);
        return NextResponse.json({ versions, activeVersion: active?.id });
      }

      case 'active': {
        if (!artifactType) {
          return NextResponse.json(
            { error: 'artifactType is required' },
            { status: 400 }
          );
        }
        const activePrompt = autoPromptOptimizerService.getActivePrompt(artifactType, tenantId);
        if (!activePrompt) {
          return NextResponse.json(
            { error: 'No active prompt found' },
            { status: 404 }
          );
        }
        return NextResponse.json(activePrompt);
      }

      case 'suggestions': {
        if (!artifactType) {
          return NextResponse.json(
            { error: 'artifactType is required' },
            { status: 400 }
          );
        }
        const promptId = searchParams.get('promptId');
        if (!promptId) {
          return NextResponse.json(
            { error: 'promptId is required' },
            { status: 400 }
          );
        }
        const suggestions = autoPromptOptimizerService.suggestOptimizations(promptId, artifactType);
        return NextResponse.json({ suggestions });
      }

      case 'compare': {
        if (!artifactType) {
          return NextResponse.json(
            { error: 'artifactType is required' },
            { status: 400 }
          );
        }
        const promptId1 = searchParams.get('promptId1');
        const promptId2 = searchParams.get('promptId2');
        if (!promptId1 || !promptId2) {
          return NextResponse.json(
            { error: 'promptId1 and promptId2 are required' },
            { status: 400 }
          );
        }
        const comparison = autoPromptOptimizerService.compareVersions(promptId1, promptId2, artifactType);
        if (!comparison) {
          return NextResponse.json(
            { error: 'Could not compare versions' },
            { status: 404 }
          );
        }
        return NextResponse.json(comparison);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: list, active, suggestions, compare' },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;

    const autoPromptOptimizerService = await getAutoPromptOptimizerService();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { artifactType, prompt, parentId } = body;
        if (!artifactType || !prompt) {
          return NextResponse.json(
            { error: 'artifactType and prompt are required' },
            { status: 400 }
          );
        }
        const version = autoPromptOptimizerService.createPromptVersion(
          artifactType,
          prompt,
          tenantId,
          parentId
        );
        return NextResponse.json(version, { status: 201 });
      }

      case 'activate': {
        const { artifactType, promptId, tenantId = 'default' } = body;
        if (!artifactType || !promptId) {
          return NextResponse.json(
            { error: 'artifactType and promptId are required' },
            { status: 400 }
          );
        }
        const success = autoPromptOptimizerService.activateVersion(promptId, artifactType, tenantId);
        if (!success) {
          return NextResponse.json(
            { error: 'Failed to activate version' },
            { status: 400 }
          );
        }
        return NextResponse.json({ success: true, activatedId: promptId });
      }

      case 'record-metrics': {
        const { artifactType, promptId, metrics, tenantId = 'default' } = body;
        if (!artifactType || !promptId || !metrics) {
          return NextResponse.json(
            { error: 'artifactType, promptId, and metrics are required' },
            { status: 400 }
          );
        }
        autoPromptOptimizerService.recordExtractionResult(
          promptId,
          artifactType,
          metrics.wasCorrect,
          metrics.confidence,
          metrics.fieldResults || {},
          tenantId
        );
        return NextResponse.json({ success: true });
      }

      case 'optimize': {
        const { artifactType, promptId, tenantId = 'default' } = body;
        if (!artifactType || !promptId) {
          return NextResponse.json(
            { error: 'artifactType and promptId are required' },
            { status: 400 }
          );
        }
        const optimized = await autoPromptOptimizerService.autoOptimize(
          promptId,
          artifactType,
          tenantId
        );
        if (!optimized) {
          return NextResponse.json(
            { error: 'Could not optimize prompt. Check if version exists and has metrics.' },
            { status: 400 }
          );
        }
        return NextResponse.json(optimized, { status: 201 });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: create, activate, record-metrics, optimize' },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
