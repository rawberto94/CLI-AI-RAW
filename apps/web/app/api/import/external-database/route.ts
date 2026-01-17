/**
 * External Database Import API
 * POST /api/import/external-database - Import contracts from external database
 */

import { NextRequest, NextResponse } from 'next/server';
import cors from '@/lib/security/cors';
import { getServerTenantId } from '@/lib/tenant-server';
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

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const body = await request.json() as ImportRequest;
    const { action, config, tableName, mapping, options } = body;

    // Validate config
    if (!config || !config.type || !config.host || !config.database) {
      return NextResponse.json(
        { error: 'Invalid database configuration' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'test': {
        const result = await testConnection(config);
        return NextResponse.json(result);
      }

      case 'list-tables': {
        const tables = await listTables(config);
        return NextResponse.json({ tables });
      }

      case 'preview': {
        if (!tableName) {
          return NextResponse.json(
            { error: 'Table name required for preview' },
            { status: 400 }
          );
        }
        const preview = await previewTable(config, tableName, 10);
        return NextResponse.json(preview);
      }

      case 'import': {
        if (!tableName || !mapping) {
          return NextResponse.json(
            { error: 'Table name and mapping required for import' },
            { status: 400 }
          );
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

        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: test, list-tables, preview, or import' },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Import failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return cors.optionsResponse(request, 'POST, OPTIONS');
}
