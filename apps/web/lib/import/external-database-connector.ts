/**
 * External Database Connector
 * 
 * Connects to external client databases to import contracts
 * Supports: PostgreSQL, MySQL, SQL Server, Oracle, MongoDB, Snowflake, BigQuery
 */

import { Prisma } from '@prisma/client';

export interface ExternalDatabaseConfig {
  type: 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'mongodb' | 'snowflake' | 'bigquery';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  tableName?: string;
  schema?: string;
  // Additional options for specific databases
  warehouse?: string; // Snowflake
  projectId?: string; // BigQuery
  authKeyFile?: string; // BigQuery service account
}

export interface ContractMapping {
  // Source column -> target field
  fileNameColumn?: string;
  filePathColumn?: string;
  contractTypeColumn?: string;
  clientNameColumn?: string;
  supplierNameColumn?: string;
  valueColumn?: string;
  startDateColumn?: string;
  endDateColumn?: string;
  statusColumn?: string;
  rawTextColumn?: string;
  customMappings?: Record<string, string>;
}

export interface ImportResult {
  success: boolean;
  totalRecords: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  contractIds: string[];
}

export interface ExternalContract {
  id?: string;
  fileName: string;
  filePath?: string;
  contractType?: string;
  clientName?: string;
  supplierName?: string;
  totalValue?: number;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  rawText?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Test connection to external database
 */
export async function testConnection(config: ExternalDatabaseConfig): Promise<{
  success: boolean;
  message: string;
  tableCount?: number;
}> {
  try {
    const client = await createClient(config);
    
    // Test query based on database type
    let result;
    switch (config.type) {
      case 'postgresql':
        result = await client.query(
          "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = $1",
          [config.schema || 'public']
        );
        break;
      case 'mysql':
        result = await client.query(
          "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?",
          [config.database]
        );
        break;
      case 'mssql':
        result = await client.query(
          "SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_CATALOG = @database",
          { database: config.database }
        );
        break;
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
    
    await closeClient(client);
    
    return {
      success: true,
      message: 'Connection successful',
      tableCount: parseInt(result.rows?.[0]?.count || '0'),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * List tables in external database
 */
export async function listTables(config: ExternalDatabaseConfig): Promise<string[]> {
  const client = await createClient(config);
  
  let query: string;
  let params: unknown[];
  
  switch (config.type) {
    case 'postgresql':
      query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      params = [config.schema || 'public'];
      break;
    case 'mysql':
      query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ? 
        ORDER BY table_name
      `;
      params = [config.database];
      break;
    case 'mssql':
      query = `
        SELECT TABLE_NAME as table_name
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `;
      params = [];
      break;
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
  
  const result = await client.query(query, params);
  await closeClient(client);
  
  return result.rows.map((row: { table_name: string }) => row.table_name);
}

/**
 * Preview data from external table
 */
export async function previewTable(
  config: ExternalDatabaseConfig,
  tableName: string,
  limit: number = 10
): Promise<{
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}> {
  const client = await createClient(config);
  
  // Get column info
  const columnsResult = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  
  const columns = columnsResult.rows.map((r: { column_name: string }) => r.column_name);
  
  // Get sample data
  const dataResult = await client.query(
    `SELECT * FROM "${tableName}" LIMIT $1`,
    [limit]
  );
  
  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as count FROM "${tableName}"`
  );
  
  await closeClient(client);
  
  return {
    columns,
    rows: dataResult.rows,
    totalRows: parseInt(countResult.rows[0].count),
  };
}

/**
 * Import contracts from external database
 */
export async function importFromExternalDatabase(
  config: ExternalDatabaseConfig,
  tableName: string,
  mapping: ContractMapping,
  options: {
    tenantId: string;
    batchSize?: number;
    triggerProcessing?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<ImportResult> {
  const { prisma } = await import('@/lib/prisma');
  const { triggerArtifactGeneration } = await import('@/lib/artifact-trigger');
  
  const client = await createClient(config);
  const batchSize = options.batchSize || 100;
  const errors: Array<{ row: number; error: string }> = [];
  const contractIds: string[] = [];
  
  let imported = 0;
  let failed = 0;
  
  // Build SELECT query based on mapping
  const selectColumns = buildSelectColumns(mapping);
  let query = `SELECT ${selectColumns} FROM "${tableName}"`;
  
  if (options.limit) {
    query += ` LIMIT ${options.limit}`;
  }
  if (options.offset) {
    query += ` OFFSET ${options.offset}`;
  }
  
  const result = await client.query(query);
  const totalRecords = result.rows.length;
  
  // Process in batches
  for (let i = 0; i < result.rows.length; i += batchSize) {
    const batch = result.rows.slice(i, i + batchSize);
    
    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const rowIndex = i + j + 1;
      
      try {
        const contractData = mapRowToContract(row, mapping);
        
        // Create contract in our database
        const contract = await prisma.contract.create({
          data: {
            tenantId: options.tenantId,
            fileName: contractData.fileName || `imported-${rowIndex}`,
            originalName: contractData.fileName,
            fileSize: BigInt(0), // No file for imported records
            mimeType: 'text/plain',
            storagePath: '',
            storageProvider: 'external',
            status: 'PROCESSING',
            uploadedBy: 'external-import',
            contractType: contractData.contractType || 'UNKNOWN',
            contractTitle: contractData.fileName,
            clientName: contractData.clientName,
            supplierName: contractData.supplierName,
            rawText: contractData.rawText,
            importSource: 'EXTERNAL_DATABASE',
            externalId: contractData.id,
            sourceMetadata: {
              sourceType: config.type,
              sourceHost: config.host,
              sourcePort: config.port,
              sourceDatabase: config.database,
              sourceTable: tableName,
            },
            importedAt: new Date(),
          },
        });
        
        contractIds.push(contract.id);
        imported++;
        
        // Trigger processing if we have raw text
        if (options.triggerProcessing && contractData.rawText && contractData.rawText.length > 100) {
          await triggerArtifactGeneration({
            contractId: contract.id,
            tenantId: options.tenantId,
            filePath: '',
            mimeType: 'text/plain',
            useQueue: true,
            priority: 20, // Low priority for bulk imports
            source: 'bulk',
          }).catch((err) => {
            console.error(`Failed to queue processing for ${contract.id}:`, err);
          });
        }
      } catch (error) {
        failed++;
        errors.push({
          row: rowIndex,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }
  
  await closeClient(client);
  
  return {
    success: failed === 0,
    totalRecords,
    imported,
    failed,
    errors: errors.slice(0, 100), // Limit error list
    contractIds,
  };
}

// Helper functions

async function createClient(config: ExternalDatabaseConfig): Promise<any> {
  switch (config.type) {
    case 'postgresql': {
      const { Client } = await import('pg');
      const client = new Client({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      });
      await client.connect();
      return client;
    }
    case 'mysql': {
      const mysql = await import('mysql2/promise');
      return mysql.createConnection({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        ssl: config.ssl ? {} : undefined,
      });
    }
    case 'mssql': {
      const sql = await import('mssql');
      return sql.connect({
        server: config.host,
        port: config.port,
        database: config.database,
        user: config.username,
        password: config.password,
        options: {
          encrypt: config.ssl ?? true,
          trustServerCertificate: true,
        },
      });
    }
    default:
      throw new Error(`Unsupported database type: ${config.type}`);
  }
}

async function closeClient(client: any): Promise<void> {
  try {
    if (client.end) {
      await client.end();
    } else if (client.close) {
      await client.close();
    }
  } catch {
    // Ignore close errors
  }
}

function buildSelectColumns(mapping: ContractMapping): string {
  const columns: string[] = [];
  
  if (mapping.fileNameColumn) columns.push(`"${mapping.fileNameColumn}" as file_name`);
  if (mapping.filePathColumn) columns.push(`"${mapping.filePathColumn}" as file_path`);
  if (mapping.contractTypeColumn) columns.push(`"${mapping.contractTypeColumn}" as contract_type`);
  if (mapping.clientNameColumn) columns.push(`"${mapping.clientNameColumn}" as client_name`);
  if (mapping.supplierNameColumn) columns.push(`"${mapping.supplierNameColumn}" as supplier_name`);
  if (mapping.valueColumn) columns.push(`"${mapping.valueColumn}" as total_value`);
  if (mapping.startDateColumn) columns.push(`"${mapping.startDateColumn}" as start_date`);
  if (mapping.endDateColumn) columns.push(`"${mapping.endDateColumn}" as end_date`);
  if (mapping.statusColumn) columns.push(`"${mapping.statusColumn}" as status`);
  if (mapping.rawTextColumn) columns.push(`"${mapping.rawTextColumn}" as raw_text`);
  
  // Add custom mappings
  if (mapping.customMappings) {
    for (const [source, target] of Object.entries(mapping.customMappings)) {
      columns.push(`"${source}" as "${target}"`);
    }
  }
  
  return columns.length > 0 ? columns.join(', ') : '*';
}

function mapRowToContract(row: Record<string, unknown>, mapping: ContractMapping): ExternalContract {
  return {
    id: row.id as string | undefined,
    fileName: (row.file_name || row.fileName || row.name || 'Unknown') as string,
    filePath: row.file_path as string | undefined,
    contractType: row.contract_type as string | undefined,
    clientName: row.client_name as string | undefined,
    supplierName: row.supplier_name as string | undefined,
    totalValue: row.total_value ? Number(row.total_value) : undefined,
    startDate: row.start_date ? new Date(row.start_date as string) : undefined,
    endDate: row.end_date ? new Date(row.end_date as string) : undefined,
    status: row.status as string | undefined,
    rawText: row.raw_text as string | undefined,
    metadata: row,
  };
}
