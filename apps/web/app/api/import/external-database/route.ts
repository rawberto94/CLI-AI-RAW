/**
 * External Database Import API
 * POST /api/import/external-database - Import contracts from external database
 */

import { NextRequest } from 'next/server';
import cors from '@/lib/security/cors';
import { getServerTenantId } from '@/lib/tenant-server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import {
  testConnection,
  listTables,
  previewTable,
  importFromExternalDatabase,
  type ExternalDatabaseConfig,
  type ContractMapping,
} from '@/lib/import/external-database-connector';

interface ImportRequest {
  action: 'test' | 'list-tables' | 'preview' | 'import';
  config: ExternalDatabaseConfig;
  tableName?: string;
  mapping?: ContractMapping;
  options?: {
    batchSize?: number;
    triggerProcessing?: boolean;
    limit?: number;
    offset?: number;
  };
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await getServerTenantId();
  const body = await request.json() as ImportRequest;
  const { action, config, tableName, mapping, options } = body;

  // Validate config
  if (!config || !config.type || !config.host || !config.database) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid database configuration', 400);
  }

  switch (action) {
    case 'test': {
      const result = await testConnection(config);
      return createSuccessResponse(ctx, result);
    }

    case 'list-tables': {
      const tables = await listTables(config);
      return createSuccessResponse(ctx, { tables });
    }

    case 'preview': {
      if (!tableName) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Table name required for preview', 400);
      }
      const preview = await previewTable(config, tableName, 10);
      return createSuccessResponse(ctx, preview);
    }

    case 'import': {
      if (!tableName || !mapping) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Table name and mapping required for import', 400);
      }

      const result = await importFromExternalDatabase(
        config,
        tableName,
        mapping,
        {
          tenantId,
          batchSize: options?.batchSize || 100,
          triggerProcessing: options?.triggerProcessing ?? true,
          limit: options?.limit,
          offset: options?.offset,
        }
      );

      return createSuccessResponse(ctx, result);
    }

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action. Use: test, list-tables, preview, or import', 400);
  }
});

export const OPTIONS = withAuthApiHandler(async (request: NextRequest, ctx) => {
  return cors.optionsResponse(request, 'POST, OPTIONS');
});
