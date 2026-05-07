/**
 * SQL Server (MSSQL) Connector
 *
 * Mirrors the Postgres + MySQL connectors using the `mssql` driver. SQL
 * Server uses `[name]` bracket-quoting for identifiers and named
 * parameters via `@param`.
 *
 * Each row in the configured table is one Contigo `RemoteFile`. Body
 * column may be a VARBINARY(MAX) (`copy` mode) or a string URL
 * (`reference` mode).
 */

import {
  IContractSourceConnector,
  ConnectionTestResult,
  ListFilesResult,
  RemoteFile,
  DownloadedFile,
  SqlColumnMapping,
  isSupportedMimeType,
  matchesFilePattern,
} from './types';
import { ContractSourceProvider } from '@prisma/client';
import * as sql from 'mssql';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

export interface MssqlCredentials {
  type: 'mssql';
  /** Optional connection string. Otherwise host/port/database/user/password. */
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  /** Whether to TLS-encrypt the connection. Defaults to true (Azure SQL needs it). */
  encrypt?: boolean;
  /** Trust the server certificate (dev only). Defaults to false. */
  trustServerCertificate?: boolean;
  /** Required: schema-qualified or bare table. */
  table: string;
  /** Optional schema. Defaults to 'dbo'. */
  schema?: string;
  mapping: SqlColumnMapping;
  whereClause?: string;
}

/** Bracket-quote a SQL Server identifier defensively. */
function quoteIdent(ident: string): string {
  return '[' + String(ident).replace(/]/g, ']]') + ']';
}

function quoteTable(schema: string | undefined, table: string): string {
  return `${quoteIdent(schema || 'dbo')}.${quoteIdent(table)}`;
}

function inferMimeFromName(name: string | undefined | null): string {
  const lower = (name || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff';
  return 'application/pdf';
}

export class MssqlConnector implements IContractSourceConnector {
  readonly provider: ContractSourceProvider = ContractSourceProvider.MSSQL;

  private credentials: MssqlCredentials;
  private mapping: SqlColumnMapping;
  private mode: 'copy' | 'reference';
  private pool?: sql.ConnectionPool;
  private connectPromise?: Promise<sql.ConnectionPool>;

  constructor(credentials: MssqlCredentials) {
    if (!credentials.table) throw new Error('SQL Server connector requires a table name');
    if (!credentials.mapping?.idColumn || !credentials.mapping?.bodyColumn) {
      throw new Error('SQL Server connector requires mapping.idColumn and mapping.bodyColumn');
    }
    this.credentials = credentials;
    this.mapping = credentials.mapping;
    this.mode = credentials.mapping.mode || 'copy';
  }

  // ============================================
  // Connection management
  // ============================================

  private async getPool(): Promise<sql.ConnectionPool> {
    if (this.pool && this.pool.connected) return this.pool;
    if (this.connectPromise) return this.connectPromise;

    const cfg: sql.config = this.credentials.connectionString
      ? // mssql accepts a connection-string–style config; we rebuild it here
        // because parsing is driver-specific. Prefer field-based config below.
        ({ connectionString: this.credentials.connectionString } as unknown as sql.config)
      : {
          server: this.credentials.host || 'localhost',
          port: this.credentials.port || 1433,
          database: this.credentials.database,
          user: this.credentials.username,
          password: this.credentials.password,
          options: {
            encrypt: this.credentials.encrypt !== false,
            trustServerCertificate: Boolean(this.credentials.trustServerCertificate),
          },
          pool: { max: 4, min: 0, idleTimeoutMillis: 10_000 },
          connectionTimeout: 10_000,
          requestTimeout: 30_000,
        };

    this.connectPromise = new sql.ConnectionPool(cfg).connect().then(p => {
      this.pool = p;
      return p;
    });
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = undefined;
    }
  }

  // ============================================
  // Public API
  // ============================================

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const tableRef = quoteTable(this.credentials.schema, this.credentials.table);
      const where = this.credentials.whereClause ? `WHERE (${this.credentials.whereClause})` : '';
      const pool = await this.getPool();
      const result = await pool.request().query<{ n: number }>(
        `SELECT COUNT_BIG(*) AS n FROM ${tableRef} ${where}`,
      );
      const n = Number(result.recordset[0]?.n || 0);

      return {
        success: true,
        connected: true,
        message: `Connected. ${n.toLocaleString()} row(s) match the configured filter.`,
        accountInfo: { id: tableRef, name: tableRef },
        capabilities: {
          deltaSync: Boolean(this.mapping.modifiedAtColumn),
          folderListing: false,
          fileDownload: true,
          fileMetadata: true,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        connected: false,
        message: `SQL Server connection failed: ${message}`,
        error: message,
        errorCode: 'MSSQL_CONNECTION_FAILED',
      };
    }
  }

  async listFiles(
    _folderId?: string,
    options?: {
      pageToken?: string;
      pageSize?: number;
      filePatterns?: string[];
      recursive?: boolean;
    }
  ): Promise<ListFilesResult> {
    const tableRef = quoteTable(this.credentials.schema, this.credentials.table);
    const m = this.mapping;
    const pageSize = Math.min(options?.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = options?.pageToken ? parseInt(options.pageToken, 10) || 0 : 0;

    const cols: Array<{ alias: string; sql: string }> = [
      { alias: 'id', sql: quoteIdent(m.idColumn) },
    ];
    if (m.titleColumn) cols.push({ alias: 'title', sql: quoteIdent(m.titleColumn) });
    if (m.mimeTypeColumn) cols.push({ alias: 'mime', sql: quoteIdent(m.mimeTypeColumn) });
    if (m.modifiedAtColumn) cols.push({ alias: 'modified_at', sql: quoteIdent(m.modifiedAtColumn) });
    if (m.supplierColumn) cols.push({ alias: 'supplier', sql: quoteIdent(m.supplierColumn) });
    if (m.clientColumn) cols.push({ alias: 'client', sql: quoteIdent(m.clientColumn) });
    if (m.externalIdColumn) cols.push({ alias: 'external_id', sql: quoteIdent(m.externalIdColumn) });
    if (this.mode === 'reference') {
      cols.push({ alias: 'body_ref', sql: quoteIdent(m.bodyColumn) });
    }
    if (this.mode === 'copy') {
      cols.push({ alias: 'size_bytes', sql: `DATALENGTH(${quoteIdent(m.bodyColumn)})` });
    }

    const selectList = cols.map(c => `${c.sql} AS ${quoteIdent(c.alias)}`).join(', ');
    // SQL Server requires ORDER BY for OFFSET/FETCH paging.
    const orderBy = m.modifiedAtColumn
      ? `ORDER BY ${quoteIdent(m.modifiedAtColumn)} DESC, ${quoteIdent(m.idColumn)} DESC`
      : `ORDER BY ${quoteIdent(m.idColumn)} DESC`;
    const where = this.credentials.whereClause ? `WHERE (${this.credentials.whereClause})` : '';

    const sqlText = `
      SELECT ${selectList}
      FROM ${tableRef}
      ${where}
      ${orderBy}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const pool = await this.getPool();
    const req = pool.request();
    req.input('offset', sql.Int, offset);
    req.input('limit', sql.Int, pageSize + 1);
    const result = await req.query(sqlText);
    const rowList = result.recordset as Array<Record<string, unknown>>;

    const hasMore = rowList.length > pageSize;
    const page = rowList.slice(0, pageSize);

    const files: RemoteFile[] = page.map(row => {
      const id = String(row.id);
      const title = (row.title as string | undefined) ?? `${this.credentials.table}-${id}`;
      const mimeType = (row.mime as string | undefined) || inferMimeFromName(title);
      const modifiedAt = row.modified_at instanceof Date ? (row.modified_at as Date) : undefined;
      const sizeBytes = typeof row.size_bytes === 'number' ? row.size_bytes : 0;

      return {
        id,
        name: title,
        path: `${this.credentials.schema || 'dbo'}.${this.credentials.table}/${id}`,
        mimeType,
        size: Number.isFinite(sizeBytes) ? sizeBytes : 0,
        modifiedAt,
        isFolder: false,
        webUrl: this.mode === 'reference' && typeof row.body_ref === 'string' ? row.body_ref : undefined,
        downloadUrl: this.mode === 'reference' && typeof row.body_ref === 'string' ? row.body_ref : undefined,
        metadata: {
          mode: this.mode,
          supplier: row.supplier ?? undefined,
          client: row.client ?? undefined,
          externalId: row.external_id ?? undefined,
        },
      };
    });

    const patterns = options?.filePatterns || [];
    const filtered = files.filter(
      f => matchesFilePattern(f.name, patterns) && isSupportedMimeType(f.mimeType),
    );

    return {
      files: filtered,
      hasMore,
      nextPageToken: hasMore ? String(offset + pageSize) : undefined,
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    if (this.mode === 'reference') {
      throw new Error(
        'SQL Server connector is in reference mode; no body to download. ' +
          'sync-service should treat this source as metadata-only.',
      );
    }

    const tableRef = quoteTable(this.credentials.schema, this.credentials.table);
    const m = this.mapping;
    const titleSql = m.titleColumn ? `, ${quoteIdent(m.titleColumn)} AS ${quoteIdent('title')}` : '';
    const mimeSql = m.mimeTypeColumn ? `, ${quoteIdent(m.mimeTypeColumn)} AS ${quoteIdent('mime')}` : '';

    const sqlText = `
      SELECT TOP 1 ${quoteIdent(m.bodyColumn)} AS [body] ${titleSql} ${mimeSql}
      FROM ${tableRef}
      WHERE ${quoteIdent(m.idColumn)} = @fileId
    `;

    const pool = await this.getPool();
    const req = pool.request();
    req.input('fileId', sql.NVarChar, fileId);
    const result = await req.query(sqlText);
    const row = result.recordset[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error(`SQL Server row not found: ${fileId}`);

    const body = row.body;
    if (!Buffer.isBuffer(body)) {
      throw new Error(
        `SQL Server bodyColumn (${m.bodyColumn}) must be VARBINARY in copy mode; got ${typeof body}`,
      );
    }

    const title = (row.title as string | undefined) ?? `${this.credentials.table}-${fileId}`;
    const mimeType = (row.mime as string | undefined) || inferMimeFromName(title);

    return {
      content: body,
      mimeType,
      name: title,
      filename: title,
      size: body.length,
    };
  }

  supportsDeltaSync(): boolean {
    return Boolean(this.mapping.modifiedAtColumn);
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = undefined;
    }
  }
}

export function createMssqlConnector(credentials: MssqlCredentials): MssqlConnector {
  return new MssqlConnector(credentials);
}
