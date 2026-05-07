/**
 * MySQL Connector
 *
 * Mirrors the Postgres connector but uses the `mysql2` driver and MySQL
 * identifier/parameter syntax (backtick quoting, `?` placeholders).
 *
 * Each row in the configured table is one Contigo `RemoteFile`. Body
 * column may be a BLOB/MEDIUMBLOB/LONGBLOB (`copy` mode) or a string URL
 * (`reference` mode).
 *
 * SECURITY: identifiers come from operator-trusted configuration. They're
 * still defensively backtick-escaped to prevent injection from a typo.
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
import mysql from 'mysql2/promise';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

/**
 * MySQL credentials. Same shape as Postgres credentials minus `schema`
 * (MySQL combines schema + database). We keep the type local rather than
 * cluttering the global types union with another SQL variant; the factory
 * passes through the credentials object as `unknown` and casts here.
 */
export interface MysqlCredentials {
  type: 'mysql';
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  table: string;
  mapping: SqlColumnMapping;
  whereClause?: string;
}

/** Backtick-quote a MySQL identifier defensively. */
function quoteIdent(ident: string): string {
  return '`' + String(ident).replace(/`/g, '``') + '`';
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

export class MysqlConnector implements IContractSourceConnector {
  readonly provider: ContractSourceProvider = ContractSourceProvider.MYSQL;

  private credentials: MysqlCredentials;
  private mapping: SqlColumnMapping;
  private mode: 'copy' | 'reference';
  private pool?: mysql.Pool;

  constructor(credentials: MysqlCredentials) {
    if (!credentials.table) throw new Error('MySQL connector requires a table name');
    if (!credentials.mapping?.idColumn || !credentials.mapping?.bodyColumn) {
      throw new Error('MySQL connector requires mapping.idColumn and mapping.bodyColumn');
    }
    this.credentials = credentials;
    this.mapping = credentials.mapping;
    this.mode = credentials.mapping.mode || 'copy';
  }

  // ============================================
  // Connection management
  // ============================================

  private getPool(): mysql.Pool {
    if (this.pool) return this.pool;

    const cfg: mysql.PoolOptions = this.credentials.connectionString
      ? { uri: this.credentials.connectionString }
      : {
          host: this.credentials.host,
          port: this.credentials.port || 3306,
          database: this.credentials.database,
          user: this.credentials.username,
          password: this.credentials.password,
        };
    if (this.credentials.ssl) {
      cfg.ssl = { rejectUnauthorized: false };
    }
    cfg.connectionLimit = 4;
    cfg.connectTimeout = 10_000;
    this.pool = mysql.createPool(cfg);
    return this.pool;
  }

  // ============================================
  // Public API
  // ============================================

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const tableRef = quoteIdent(this.credentials.table);
      const where = this.credentials.whereClause ? `WHERE (${this.credentials.whereClause})` : '';
      const sql = `SELECT COUNT(*) AS n FROM ${tableRef} ${where}`;
      const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(sql);
      const n = Number((rows[0] as { n: number | string } | undefined)?.n || 0);

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
        message: `MySQL connection failed: ${message}`,
        error: message,
        errorCode: 'MYSQL_CONNECTION_FAILED',
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
    const tableRef = quoteIdent(this.credentials.table);
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
      cols.push({ alias: 'size_bytes', sql: `OCTET_LENGTH(${quoteIdent(m.bodyColumn)})` });
    }

    const selectList = cols.map(c => `${c.sql} AS ${quoteIdent(c.alias)}`).join(', ');
    const orderBy = m.modifiedAtColumn
      ? `ORDER BY ${quoteIdent(m.modifiedAtColumn)} DESC, ${quoteIdent(m.idColumn)} DESC`
      : `ORDER BY ${quoteIdent(m.idColumn)} DESC`;
    const where = this.credentials.whereClause ? `WHERE (${this.credentials.whereClause})` : '';

    const sql = `SELECT ${selectList} FROM ${tableRef} ${where} ${orderBy} LIMIT ? OFFSET ?`;
    const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(sql, [pageSize + 1, offset]);
    const rowList = rows as Array<Record<string, unknown>>;

    const hasMore = rowList.length > pageSize;
    const page = rowList.slice(0, pageSize);

    const files: RemoteFile[] = page.map(row => {
      const id = String(row.id);
      const title = (row.title as string | undefined) ?? `${this.credentials.table}-${id}`;
      const mimeType = (row.mime as string | undefined) || inferMimeFromName(title);
      const modifiedAt = row.modified_at instanceof Date ? (row.modified_at as Date) : undefined;
      const sizeBytes =
        typeof row.size_bytes === 'number'
          ? row.size_bytes
          : typeof row.size_bytes === 'string'
          ? parseInt(row.size_bytes, 10)
          : 0;

      return {
        id,
        name: title,
        path: `${this.credentials.database || ''}.${this.credentials.table}/${id}`,
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
        'MySQL connector is in reference mode; no body to download. ' +
          'sync-service should treat this source as metadata-only.',
      );
    }

    const tableRef = quoteIdent(this.credentials.table);
    const m = this.mapping;
    const titleSql = m.titleColumn ? `, ${quoteIdent(m.titleColumn)} AS ${quoteIdent('title')}` : '';
    const mimeSql = m.mimeTypeColumn ? `, ${quoteIdent(m.mimeTypeColumn)} AS ${quoteIdent('mime')}` : '';

    const sql = `
      SELECT ${quoteIdent(m.bodyColumn)} AS \`body\` ${titleSql} ${mimeSql}
      FROM ${tableRef}
      WHERE ${quoteIdent(m.idColumn)} = ?
      LIMIT 1
    `;
    const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(sql, [fileId]);
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) throw new Error(`MySQL row not found: ${fileId}`);

    const body = row.body;
    if (!Buffer.isBuffer(body)) {
      throw new Error(
        `MySQL bodyColumn (${m.bodyColumn}) must be BLOB in copy mode; got ${typeof body}`,
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

export function createMysqlConnector(credentials: MysqlCredentials): MysqlConnector {
  return new MysqlConnector(credentials);
}
