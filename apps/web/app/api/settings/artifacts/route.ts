/**
 * Artifact Configuration API Route
 * 
 * Manages tenant-level artifact generation settings including:
 * - Enabling/disabling artifact types
 * - Setting quality thresholds
 * - Configuring generation behavior
 * - Adding custom artifact types
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { 
  artifactConfigService,
  DEFAULT_ARTIFACT_TYPES,
  DEFAULT_GENERATION_CONFIG,
  type ArtifactType,
} from 'data-orchestration/services';

/**
 * GET /api/settings/artifacts
 * Get current artifact configuration for the tenant
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const config = await artifactConfigService.getTenantConfig(tenantId);
    const enabledTypes = await artifactConfigService.getEnabledArtifactTypes(tenantId);
    const generationConfig = await artifactConfigService.getGenerationConfig(tenantId);

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        artifactTypes: config.artifactTypes,
        generationConfig,
        enabledTypes: enabledTypes.map(t => ({
          type: t.type,
          enabled: t.enabled,
          priority: t.priority,
          label: t.label,
          description: t.description,
          category: t.category,
          qualityThreshold: t.qualityThreshold,
        })),
        defaults: {
          artifactTypes: DEFAULT_ARTIFACT_TYPES,
          generationConfig: DEFAULT_GENERATION_CONFIG,
        },
        updatedAt: config.updatedAt,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch artifact configuration' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/artifacts
 * Update artifact configuration for the tenant
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const body = await request.json();

    const { artifactTypes, generationConfig } = body;

    // Validate artifact types if provided
    if (artifactTypes) {
      const validTypes = DEFAULT_ARTIFACT_TYPES.map(t => t.type);
      for (const type of Object.keys(artifactTypes)) {
        if (!validTypes.includes(type as any) && type !== 'CUSTOM') {
          return NextResponse.json(
            { error: `Invalid artifact type: ${type}` },
            { status: 400 }
          );
        }
      }
    }

    // Validate generation config if provided
    if (generationConfig) {
      if (generationConfig.globalQualityThreshold !== undefined) {
        if (generationConfig.globalQualityThreshold < 0 || generationConfig.globalQualityThreshold > 1) {
          return NextResponse.json(
            { error: 'globalQualityThreshold must be between 0 and 1' },
            { status: 400 }
          );
        }
      }
      if (generationConfig.maxParallelArtifacts !== undefined) {
        if (generationConfig.maxParallelArtifacts < 1 || generationConfig.maxParallelArtifacts > 10) {
          return NextResponse.json(
            { error: 'maxParallelArtifacts must be between 1 and 10' },
            { status: 400 }
          );
        }
      }
    }

    const updatedConfig = await artifactConfigService.updateTenantConfig(tenantId, {
      artifactTypes,
      generationConfig,
    });

    return NextResponse.json({
      success: true,
      data: updatedConfig,
      message: 'Artifact configuration updated successfully',
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update artifact configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/artifacts
 * Bulk operations: toggle types, add custom types, reset to defaults
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const body = await request.json();

    const { action, payload } = body;

    switch (action) {
      case 'toggle': {
        // Toggle a single artifact type on/off
        const { type, enabled } = payload;
        if (!type || typeof enabled !== 'boolean') {
          return NextResponse.json(
            { error: 'Missing type or enabled in payload' },
            { status: 400 }
          );
        }
        await artifactConfigService.toggleArtifactType(tenantId, type as ArtifactType, enabled);
        return NextResponse.json({
          success: true,
          message: `Artifact type ${type} ${enabled ? 'enabled' : 'disabled'}`,
        });
      }

      case 'addCustomType': {
        // Add a new custom artifact type
        const { name, label, description, prompt, outputSchema } = payload;
        if (!name || !label || !prompt) {
          return NextResponse.json(
            { error: 'Missing required fields: name, label, prompt' },
            { status: 400 }
          );
        }
        const customType = await artifactConfigService.addCustomArtifactType(tenantId, {
          name,
          label,
          description: description || '',
          prompt,
          outputSchema: outputSchema || {},
          enabled: true,
          priority: 100, // Custom types get lower priority by default
        });
        return NextResponse.json({
          success: true,
          data: customType,
          message: 'Custom artifact type added',
        });
      }

      case 'removeCustomType': {
        // Remove a custom artifact type
        const { customTypeId } = payload;
        if (!customTypeId) {
          return NextResponse.json(
            { error: 'Missing customTypeId in payload' },
            { status: 400 }
          );
        }
        await artifactConfigService.removeCustomArtifactType(tenantId, customTypeId);
        return NextResponse.json({
          success: true,
          message: 'Custom artifact type removed',
        });
      }

      case 'resetToDefaults': {
        // Reset all settings to defaults
        await artifactConfigService.resetToDefaults(tenantId);
        return NextResponse.json({
          success: true,
          message: 'Artifact configuration reset to defaults',
        });
      }

      case 'enableAll': {
        // Enable all artifact types
        const _config = await artifactConfigService.getTenantConfig(tenantId);
        const updates: Record<string, { enabled: boolean }> = {};
        DEFAULT_ARTIFACT_TYPES.forEach(t => {
          updates[t.type] = { enabled: true };
        });
        await artifactConfigService.updateTenantConfig(tenantId, {
          artifactTypes: updates as any,
        });
        return NextResponse.json({
          success: true,
          message: 'All artifact types enabled',
        });
      }

      case 'disableAdvanced': {
        // Disable advanced artifact types (keep only core)
        const updates: Record<string, { enabled: boolean }> = {};
        DEFAULT_ARTIFACT_TYPES.forEach(t => {
          updates[t.type] = { enabled: t.category === 'core' };
        });
        await artifactConfigService.updateTenantConfig(tenantId, {
          artifactTypes: updates as any,
        });
        return NextResponse.json({
          success: true,
          message: 'Advanced artifact types disabled, core types enabled',
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to perform artifact configuration action' },
      { status: 500 }
    );
  }
}
