/**
 * Postgres Connector
 *
 * Reads contracts from a customer-owned PostgreSQL table. Each row in the
 * configured table becomes one Contigo `RemoteFile`, and the configured
 * `bodyColumn` provides the document content.
 *
 * Two ingestion modes (set via `mapping.mode` in credentials):
 *   - 'copy' (default)  bodyColumn must be a bytea/BLOB column. The bytes
 *                       are pulled into Contigo and run through the full
 *                       OCR + artifact pipeline.
 *   - 'reference'       bodyColumn must be a string URL or path. No bytes
 *                       are pulled; only metadata is stored. The contract
 *                       record carries the original URL via externalUrl.
 *
 * Setup required by the customer:
 *   1. Create a read-only role in their Postgres for the configured table.
 *   2. Provide either a connectionString or host/port/database/username/password.
 *   3. Map their column names to Contigo's concepts (id, body, title, etc.).
 *   4. Optionally provide a WHERE clause to scope which rows to ingest.
 *
 * SECURITY: identifiers (table/schema/column names) come from operator-trusted
 * configuration, not end-user input. They're still defensively quoted via
 * pg_quote_ident-style escaping to prevent any accidental injection if a
 * misconfigured tenant tries to use a name that contains a quote.
 */

import {
  IContractSourceConnector,
  ConnectionTestResult,
  ListFilesResult,
  RemoteFile,
  DownloadedFile,
  PostgresCredentials,
  SqlColumnMapping,
  isSupportedMimeType,
  matchesFilePattern,
} from './types';
import { ContractSourceProvider } from '@prisma/client';
import { Pool, PoolClient, PoolConfig } from 'pg';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

/** Quote a Postgres identifier defensively (table/column/schema names). */
function quoteIdent(ident: string): string {
  // Postgres identifier escaping: wrap in double quotes, double any embedded quotes.
  return '"' + String(ident).replace(/"/g, '""') + '"';
}

/** Quote an optionally schema-qualified table reference. */
function quoteTable(schema: string | undefined, table: string): string {
  return `${quoteIdent(schema || 'public')}.${quoteIdent(table)}`;
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

export class PostgresConnector implements IContractSourceConnector {
  readonly provider: ContractSourceProvider = ContractSourceProvider.POSTGRES;

  private credentials: PostgresCredentials;
  private mapping: SqlColumnMapping;
  private mode: 'copy' | 'reference';
  private pool?: Pool;

  constructor(credentials: PostgresCredentials) {
    if (!credentials.table) {
      throw new Error('Postgres connector requires a table name');
    }
    if (!credentials.mapping?.idColumn || !credentials.mapping?.bodyColumn) {
      throw new Error('Postgres connector requires mapping.idColumn and mapping.bodyColumn');
    }
    this.credentials = credentials;
    this.mapping = credentials.mapping;
    this.mode = credentials.mapping.mode || 'copy';
  }

  // ============================================
  // Connection management
  // ============================================

  private getPool(): Pool {
    if (this.pool) return this.pool;
    const cfg: PoolConfig = {};
    if (this.credentials.connectionString) {
      cfg.connectionString = this.credentials.connectionString;
    } else {
      cfg.host = this.credentials.host;
      cfg.port = this.credentials.port || 5432;
      cfg.database = this.credentials.database;
      cfg.user = this.credentials.username;
      cfg.password = this.credentials.password;
    }
    if (this.credentials.ssl) {
      cfg.ssl = { rejectUnauthorized: false };
    }
    cfg.max = 4;
    cfg.idleTimeoutMillis = 10_000;
    cfg.connectionTimeoutMillis = 10_000;
    this.pool = new Pool(cfg);
    return this.pool;
  }

  private async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getPool().connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  // ============================================
  // Public API
  // ============================================

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const tableRef = quoteTable(this.credentials.schema, this.credentials.table);
      const where = this.credentials.whereClause
        ? `WHERE (${this.credentials.whereClause})`
        : '';
      const sql = `SELECT COUNT(*)::bigint AS n FROM ${tableRef} ${where}`;

      const result = await this.withClient(c => c.query<{ n: string }>(sql));
      const count = Number(result.rows[0]?.n || 0);

      return {
        success: true,
        connected: true,
        message: `Connected. ${count.toLocaleString()} row(s) match the configured filter.`,
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
        message: `Postgres connection failed: ${message}`,
        error: message,
        errorCode: 'POSTGRES_CONNECTION_FAILED',
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

    // Build the SELECT list — only project the columns we know about.
    const cols: Array<{ alias: string; sql: string }> = [
      { alias: 'id', sql: quoteIdent(m.idColumn) },
    ];
    if (m.titleColumn) cols.push({ alias: 'title', sql: quoteIdent(m.titleColumn) });
    if (m.mimeTypeColumn) cols.push({ alias: 'mime', sql: quoteIdent(m.mimeTypeColumn) });
    if (m.modifiedAtColumn) cols.push({ alias: 'modified_at', sql: quoteIdent(m.modifiedAtColumn) });
    if (m.supplierColumn) cols.push({ alias: 'supplier', sql: quoteIdent(m.supplierColumn) });
    if (m.clientColumn) cols.push({ alias: 'client', sql: quoteIdent(m.clientColumn) });
    if (m.externalIdColumn) cols.push({ alias: 'external_id', sql: quoteIdent(m.externalIdColumn) });

    // For reference mode, also pull the body URL into list results so the
    // contract record can carry it without a second fetch.
    if (this.mode === 'reference') {
      cols.push({ alias: 'body_ref', sql: quoteIdent(m.bodyColumn) });
    }

    // Approximate file size via octet_length on the body column (only in
    // copy mode; cheap because Postgres tracks the toast size).
    if (this.mode === 'copy') {
      cols.push({ alias: 'size_bytes', sql: `octet_length(${quoteIdent(m.bodyColumn)})::bigint` });
    }

    const selectList = cols.map(c => `${c.sql} AS "${c.alias}"`).join(', ');
    const orderBy = m.modifiedAtColumn
      ? `ORDER BY ${quoteIdent(m.modifiedAtColumn)} DESC, ${quoteIdent(m.idColumn)} DESC`
      : `ORDER BY ${quoteIdent(m.idColumn)} DESC`;
    const where = this.credentials.whereClause ? `WHERE (${this.credentials.whereClause})` : '';

    const sql = `SELECT ${selectList} FROM ${tableRef} ${where} ${orderBy} LIMIT $1 OFFSET $2`;
    const rows = await this.withClient(c =>
      c.query(sql, [pageSize + 1, offset]),
    ).then(r => r.rows as Array<Record<string, unknown>>);

    const hasMore = rows.length > pageSize;
    const page = rows.slice(0, pageSize);

    const files: RemoteFile[] = page.map(row => {
      const id = String(row.id);
      const title = (row.title as string | undefined) ?? `${this.credentials.table}-${id}`;
      const mimeType = (row.mime as string | undefined) || inferMimeFromName(title);
      const modifiedAt = row.modified_at instanceof Date ? (row.modified_at as Date) : undefined;
      const sizeBytes = typeof row.size_bytes === 'string' ? parseInt(row.size_bytes, 10) : 0;

      const remoteFile: RemoteFile = {
        id,
        name: title,
        path: `${this.credentials.schema || 'public'}.${this.credentials.table}/${id}`,
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
      return remoteFile;
    });

    // Apply filename-pattern + supported MIME filtering up-front so we don't
    // download files we'd reject later.
    const patterns = options?.filePatterns || [];
    const filtered = files.filter(f => matchesFilePattern(f.name, patterns) && isSupportedMimeType(f.mimeType));

    return {
      files: filtered,
      hasMore,
      nextPageToken: hasMore ? String(offset + pageSize) : undefined,
    };
  }

  async downloadFile(fileId: string): Promise<DownloadedFile> {
    const tableRef = quoteTable(this.credentials.schema, this.credentials.table);
    const m = this.mapping;

    if (this.mode === 'reference') {
      // In reference mode we don't pull bytes ourselves — the sync service
      // will skip the document body. Return a tiny stub so the interface
      // contract holds; sync-service stores the URL via webUrl/downloadUrl
      // on the RemoteFile (already set in listFiles).
      throw new Error(
        'Postgres connector is in reference mode; no body to download. ' +
        'sync-service should treat this source as metadata-only.',
      );
    }

    const titleSql = m.titleColumn ? `, ${quoteIdent(m.titleColumn)} AS "title"` : '';
    const mimeSql = m.mimeTypeColumn ? `, ${quoteIdent(m.mimeTypeColumn)} AS "mime"` : '';

    const sql = `
      SELECT ${quoteIdent(m.bodyColumn)} AS "body" ${titleSql} ${mimeSql}
      FROM ${tableRef}
      WHERE ${quoteIdent(m.idColumn)} = $1
      LIMIT 1
    `;
    const result = await this.withClient(c => c.query(sql, [fileId]));
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error(`Postgres row not found: ${fileId}`);
    }

    const body = row.body;
    if (!Buffer.isBuffer(body)) {
      throw new Error(
        `Postgres bodyColumn (${m.bodyColumn}) must be bytea in copy mode; got ${typeof body}`,
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
      await this.pool.end();
      this.pool = undefined;
    }
  }
}

export function createPostgresConnector(credentials: PostgresCredentials): PostgresConnector {
  return new PostgresConnector(credentials);
}
