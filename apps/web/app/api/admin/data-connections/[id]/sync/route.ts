import { NextRequest } from 'next/server';
import {
  getAuthenticatedApiContext,
  getApiContext,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { triggerArtifactGeneration, PROCESSING_PRIORITY } from '@/lib/artifact-trigger';
import { StorageService } from '@/lib/storage-service';
import { logger } from '@/lib/logger';

interface ConnectionConfig {
  host?: string;
  port?: string;
  database?: string;
  username?: string;
  password?: string;
  ssl?: string;
  connectionString?: string;
  contractTableName?: string;
}

interface ExternalContract {
  id?: string;
  title?: string;
  name?: string;
  filename?: string;
  content?: string;
  text?: string;
  body?: string;
  raw_text?: string;
  file_path?: string;
  contract_type?: string;
  type?: string;
  client_name?: string;
  client?: string;
  supplier_name?: string;
  supplier?: string;
  vendor?: string;
  start_date?: string | Date;
  end_date?: string | Date;
  status?: string;
  created_at?: string | Date;
}

/**
 * POST /api/admin/data-connections/[id]/sync
 * Trigger a sync for a data connection.
 *
 * Connects to the external database using stored credentials,
 * queries the contract table, and ingests each row into ConTigo
 * for AI processing.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(
      getApiContext(request),
      'UNAUTHORIZED',
      'Authentication required',
      401,
      { retryable: false }
    );
  }

  try {
    const { id } = await params;
    const startTime = Date.now();

    // Get the connection configuration
    const settings = await prisma.tenantSettings.findFirst({
      where: { tenantId: ctx.tenantId },
    });

    if (!settings?.customFields) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Connection not found', 404);
    }

    const customFields =
      typeof settings.customFields === 'string'
        ? JSON.parse(settings.customFields)
        : settings.customFields;

    const connections = customFields.dataConnections || [];
    const connection = connections.find((c: { id: string }) => c.id === id);

    if (!connection) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Connection not found', 404);
    }

    // Decrypt config
    let config: ConnectionConfig = {};
    if (connection.encryptedConfig) {
      try {
        const decoded = Buffer.from(connection.encryptedConfig, 'base64').toString('utf-8');
        config = JSON.parse(decoded);
      } catch {
        return createErrorResponse(ctx, 'CONFIGURATION_ERROR', 'Failed to decode connection configuration', 500);
      }
    }

    // Also get original password from the request body if provided (for re-auth)
    const body = await request.json().catch(() => ({}));
    if (body.password) config.password = body.password;

    const tableName = config.contractTableName || connection.contractTableName || 'contracts';

    // Execute sync based on connection type
    let syncResult: {
      newContracts: number;
      skippedContracts: number;
      failedContracts: number;
      errors: string[];
    };

    switch (connection.type) {
      case 'postgresql':
        syncResult = await syncPostgres(config, tableName, ctx.tenantId);
        break;
      case 'mysql':
        syncResult = await syncMySQL(config, tableName, ctx.tenantId);
        break;
      default:
        return createErrorResponse(
          ctx,
          'UNSUPPORTED',
          `Sync not supported for connection type: ${connection.type}. Supported: postgresql, mysql`,
          400
        );
    }

    // Update connection status
    const updatedConnections = connections.map((c: { id: string }) =>
      c.id === id
        ? {
            ...c,
            status: syncResult.failedContracts > 0 && syncResult.newContracts === 0 ? 'error' : 'connected',
            lastSync: new Date().toISOString(),
            contractCount: syncResult.newContracts + syncResult.skippedContracts,
          }
        : c
    );

    await prisma.tenantSettings.update({
      where: { id: settings.id },
      data: {
        customFields: JSON.stringify({
          ...customFields,
          dataConnections: updatedConnections,
        }),
      },
    });

    return createSuccessResponse(ctx, {
      message: `Sync completed in ${Date.now() - startTime}ms`,
      contractCount: syncResult.newContracts + syncResult.skippedContracts,
      syncMode: connection.syncMode,
      details: {
        newContracts: syncResult.newContracts,
        skippedContracts: syncResult.skippedContracts,
        failedContracts: syncResult.failedContracts,
        errors: syncResult.errors.length > 0 ? syncResult.errors.slice(0, 10) : undefined,
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * Map flexible column names from external DB to our normalized format.
 */
function normalizeRow(row: ExternalContract): {
  externalId: string;
  title: string;
  textContent: string | null;
  contractType: string;
  clientName: string | null;
  supplierName: string | null;
  startDate: Date | null;
  endDate: Date | null;
} {
  const externalId = String(row.id || row.title || row.name || `ext-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const title = row.title || row.name || row.filename || `External Contract ${externalId}`;
  const textContent = row.content || row.text || row.body || row.raw_text || null;
  const contractType = row.contract_type || row.type || 'UNKNOWN';
  const clientName = row.client_name || row.client || null;
  const supplierName = row.supplier_name || row.supplier || row.vendor || null;
  const startDate = row.start_date ? new Date(row.start_date) : null;
  const endDate = row.end_date ? new Date(row.end_date) : null;

  return { externalId, title, textContent, contractType, clientName, supplierName, startDate, endDate };
}

/**
 * Ingest a single contract into ConTigo, skipping duplicates.
 * Uses the Contract model's native source tracking fields:
 *   importSource, externalId, externalUrl, sourceMetadata, importedAt, lastSyncedAt
 */
async function ingestContract(
  tenantId: string,
  normalized: ReturnType<typeof normalizeRow>,
  sourceConnectionId: string
): Promise<'new' | 'skipped'> {
  // Skip if already imported (match by externalId + importSource)
  const existing = await prisma.contract.findFirst({
    where: {
      tenantId,
      importSource: 'DATA_CONNECTION',
      externalId: normalized.externalId,
    },
    select: { id: true },
  });

  if (existing) return 'skipped';

  // Upload text content to MinIO so the processing pipeline can read it
  let storagePath = `external/${sourceConnectionId}/${normalized.externalId}`;
  let storageProvider = 'external';
  if (normalized.textContent && normalized.textContent.length > 0) {
    try {
      const storage = new StorageService({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY || (process.env.NODE_ENV === 'production' ? '' : 'minioadmin'),
        secretKey: process.env.MINIO_SECRET_KEY || (process.env.NODE_ENV === 'production' ? '' : 'minioadmin'),
        bucket: process.env.MINIO_BUCKET || 'contigo-uploads',
      });

      const fileName = `${normalized.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)}.txt`;
      const objectKey = `contracts/${tenantId}/${Date.now()}-${fileName}`;
      const buffer = Buffer.from(normalized.textContent, 'utf-8');

      const uploadResult = await storage.upload({
        fileName: objectKey,
        buffer,
        contentType: 'text/plain',
        metadata: {
          'x-amz-meta-source': 'data-connection-sync',
          'x-amz-meta-external-id': normalized.externalId,
        },
      });

      if (uploadResult.success) {
        storagePath = objectKey;
        storageProvider = 's3';
      }
    } catch (err) {
      logger.error(`[DataSync] Failed to upload text to MinIO for ${normalized.externalId}:`, err);
      // Continue with 'external' storage — the rawText field will still be available
    }
  }

  // Create contract record using native source tracking fields
  const contract = await prisma.contract.create({
    data: {
      tenantId,
      fileName: `${normalized.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)}.txt`,
      originalName: normalized.title,
      fileSize: BigInt(normalized.textContent?.length || 0),
      mimeType: 'text/plain',
      storagePath,
      storageProvider,
      status: normalized.textContent ? 'PROCESSING' : 'UPLOADED',
      uploadedBy: 'data-connection-sync',
      contractType: normalized.contractType,
      contractTitle: normalized.title,
      clientName: normalized.clientName || undefined,
      supplierName: normalized.supplierName || undefined,
      startDate: normalized.startDate || undefined,
      endDate: normalized.endDate || undefined,
      rawText: normalized.textContent || undefined,
      // Native source tracking fields
      importSource: 'DATA_CONNECTION',
      externalId: normalized.externalId,
      importedAt: new Date(),
      lastSyncedAt: new Date(),
      sourceMetadata: {
        connectionId: sourceConnectionId,
        syncedAt: new Date().toISOString(),
      },
    },
  });

  // Create processing job
  const processingJob = await prisma.processingJob.create({
    data: {
      contractId: contract.id,
      tenantId,
      status: 'PENDING',
      progress: 0,
      currentStep: 'queued',
    },
  });

  // If we have text content, trigger AI processing
  if (normalized.textContent && normalized.textContent.length > 50) {
    try {
      const result = await triggerArtifactGeneration({
        contractId: contract.id,
        tenantId,
        filePath: contract.storagePath || '',
        mimeType: 'text/plain',
        useQueue: true,
        priority: PROCESSING_PRIORITY.LOW,
        source: 'api',
      });

      if (result.jobId) {
        await prisma.processingJob.update({
          where: { id: processingJob.id },
          data: { queueId: result.jobId, status: 'RUNNING' },
        }).catch(() => {});
      }
    } catch (err) {
      logger.error(`[DataSync] Failed to trigger processing for ${contract.id}:`, err);
    }
  }

  return 'new';
}

/**
 * Sync contracts from a PostgreSQL database.
 */
async function syncPostgres(
  config: ConnectionConfig,
  tableName: string,
  tenantId: string
): Promise<{ newContracts: number; skippedContracts: number; failedContracts: number; errors: string[] }> {
  const { default: pg } = await import('pg');

  const connConfig = config.connectionString
    ? { connectionString: config.connectionString, connectionTimeoutMillis: 15000 }
    : {
        host: config.host || 'localhost',
        port: parseInt(config.port || '5432', 10),
        database: config.database || 'postgres',
        user: config.username,
        password: config.password,
        ssl: config.ssl === 'true' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 15000,
      };

  const client = new pg.Client(connConfig);
  const result = { newContracts: 0, skippedContracts: 0, failedContracts: 0, errors: [] as string[] };

  try {
    await client.connect();

    // Verify the table exists
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = $1
      ) as exists`,
      [tableName]
    );

    if (!tableCheck.rows[0]?.exists) {
      result.errors.push(`Table "${tableName}" not found in database`);
      return result;
    }

    // Query contracts (limit to 500 per sync to avoid overwhelming)
    const rows = await client.query(`SELECT * FROM "${tableName}" LIMIT 500`);

    for (const row of rows.rows) {
      try {
        const normalized = normalizeRow(row as ExternalContract);
        const status = await ingestContract(tenantId, normalized, 'pg');
        if (status === 'new') result.newContracts++;
        else result.skippedContracts++;
      } catch (err) {
        result.failedContracts++;
        result.errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }

  return result;
}

/**
 * Sync contracts from a MySQL database.
 */
async function syncMySQL(
  config: ConnectionConfig,
  tableName: string,
  tenantId: string
): Promise<{ newContracts: number; skippedContracts: number; failedContracts: number; errors: string[] }> {
  const mysql = await import('mysql2/promise');

  const connConfig = config.connectionString
    ? { uri: config.connectionString, connectTimeout: 15000 }
    : {
        host: config.host || 'localhost',
        port: parseInt(config.port || '3306', 10),
        database: config.database || undefined,
        user: config.username,
        password: config.password,
        ssl: config.ssl === 'true' ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 15000,
      };

  const conn = await mysql.createConnection(connConfig as any);
  const result = { newContracts: 0, skippedContracts: 0, failedContracts: 0, errors: [] as string[] };

  try {
    // Query contracts (limit to 500 per sync)
    const [rows] = await conn.query(`SELECT * FROM \`${tableName.replace(/`/g, '')}\` LIMIT 500`) as [ExternalContract[], unknown];

    for (const row of rows) {
      try {
        const normalized = normalizeRow(row);
        const status = await ingestContract(tenantId, normalized, 'mysql');
        if (status === 'new') result.newContracts++;
        else result.skippedContracts++;
      } catch (err) {
        result.failedContracts++;
        result.errors.push(err instanceof Error ? err.message : String(err));
      }
    }
  } finally {
    try { await conn.end(); } catch { /* ignore */ }
  }

  return result;
}
