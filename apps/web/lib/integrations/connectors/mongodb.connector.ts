/**
 * MongoDB Connector
 *
 * Treats each document in a configured collection as one Contigo
 * `RemoteFile`. The column-mapping shape is reused but interpreted as
 * document field names (dotted paths supported via lodash-style get).
 *
 * In `copy` mode, `bodyColumn` (= field name) must contain the document
 * bytes — either as a Node Buffer (Mongo BSON Binary), or as a GridFS
 * file id (string or ObjectId). When it's a GridFS id, we stream from
 * `fs.files`/`fs.chunks`. Plain string values are treated as URLs and
 * the source should be configured in `reference` mode instead.
 *
 * In `reference` mode, `bodyColumn` must be a string URL/path; no bytes
 * are pulled.
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
import {
  MongoClient,
  Db,
  Collection,
  Filter,
  Document,
  ObjectId,
  GridFSBucket,
} from 'mongodb';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

export interface MongoCredentials {
  type: 'mongodb';
  /** MongoDB connection string, e.g. mongodb+srv://user:pass@cluster/db. */
  connectionString: string;
  /** Optional database override; otherwise pulled from connection string. */
  database?: string;
  /** Required: collection holding contract documents. */
  collection: string;
  /** Reuses the SQL mapping shape. Field names may be dotted paths. */
  mapping: SqlColumnMapping;
  /**
   * Optional MongoDB filter applied to every list query. Plain JSON; will be
   * spread into a Mongo filter object. Example: { status: 'EXECUTED' }.
   */
  filter?: Filter<Document>;
  /**
   * If `bodyColumn` points to a GridFS file id, set this to the bucket name
   * (default 'fs'). The connector will stream the file from
   * `<bucket>.files` / `<bucket>.chunks`.
   */
  gridfsBucket?: string;
}

/** lodash.get-style nested field accessor. */
function getField(doc: unknown, path: string): unknown {
  if (!doc || typeof doc !== 'object') return undefined;
  if (!path.includes('.')) return (doc as Record<string, unknown>)[path];
  let cur: unknown = doc;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
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

export class MongoConnector implements IContractSourceConnector {
  readonly provider: ContractSourceProvider = ContractSourceProvider.MONGODB;

  private credentials: MongoCredentials;
  private mapping: SqlColumnMapping;
  private mode: 'copy' | 'reference';
  private client?: MongoClient;
  private db?: Db;

  constructor(credentials: MongoCredentials) {
    if (!credentials.connectionString)
      throw new Error('MongoDB connector requires a connectionString');
    if (!credentials.collection)
      throw new Error('MongoDB connector requires a collection name');
    if (!credentials.mapping?.idColumn || !credentials.mapping?.bodyColumn) {
      throw new Error('MongoDB connector requires mapping.idColumn and mapping.bodyColumn');
    }
    this.credentials = credentials;
    this.mapping = credentials.mapping;
    this.mode = credentials.mapping.mode || 'copy';
  }

  // ============================================
  // Connection management
  // ============================================

  private async getDb(): Promise<Db> {
    if (this.db) return this.db;
    this.client = new MongoClient(this.credentials.connectionString, {
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 4,
    });
    await this.client.connect();
    this.db = this.credentials.database
      ? this.client.db(this.credentials.database)
      : this.client.db();
    return this.db;
  }

  private async getCollection(): Promise<Collection<Document>> {
    const db = await this.getDb();
    return db.collection(this.credentials.collection);
  }

  // ============================================
  // Public API
  // ============================================

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const col = await this.getCollection();
      const filter = this.credentials.filter || {};
      const n = await col.countDocuments(filter, { limit: 1_000_000 });
      return {
        success: true,
        connected: true,
        message: `Connected. ${n.toLocaleString()} document(s) match the configured filter.`,
        accountInfo: {
          id: this.credentials.collection,
          name: this.credentials.collection,
        },
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
        message: `MongoDB connection failed: ${message}`,
        error: message,
        errorCode: 'MONGODB_CONNECTION_FAILED',
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
    const col = await this.getCollection();
    const m = this.mapping;
    const pageSize = Math.min(options?.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = options?.pageToken ? parseInt(options.pageToken, 10) || 0 : 0;

    const filter: Filter<Document> = { ...(this.credentials.filter || {}) };

    // Project only the fields we need. Always pull idColumn + bodyColumn
    // (for reference-mode URL); bodyColumn is excluded in copy mode to
    // avoid streaming the full bytes through list().
    const projection: Record<string, 0 | 1> = { [m.idColumn]: 1 };
    if (m.titleColumn) projection[m.titleColumn] = 1;
    if (m.mimeTypeColumn) projection[m.mimeTypeColumn] = 1;
    if (m.modifiedAtColumn) projection[m.modifiedAtColumn] = 1;
    if (m.supplierColumn) projection[m.supplierColumn] = 1;
    if (m.clientColumn) projection[m.clientColumn] = 1;
    if (m.externalIdColumn) projection[m.externalIdColumn] = 1;
    if (this.mode === 'reference') projection[m.bodyColumn] = 1;

    const sort: Record<string, 1 | -1> = m.modifiedAtColumn
      ? { [m.modifiedAtColumn]: -1, [m.idColumn]: -1 }
      : { [m.idColumn]: -1 };

    const docs = await col
      .find(filter, { projection, sort, skip: offset, limit: pageSize + 1 })
      .toArray();

    const hasMore = docs.length > pageSize;
    const page = docs.slice(0, pageSize);

    const files: RemoteFile[] = page.map(doc => {
      const idValue = getField(doc, m.idColumn);
      const id = idValue instanceof ObjectId ? idValue.toHexString() : String(idValue);
      const title = (getField(doc, m.titleColumn || '') as string | undefined) ||
        `${this.credentials.collection}-${id}`;
      const mimeRaw = m.mimeTypeColumn ? getField(doc, m.mimeTypeColumn) : undefined;
      const mimeType = (typeof mimeRaw === 'string' ? mimeRaw : '') || inferMimeFromName(title);
      const modifiedRaw = m.modifiedAtColumn ? getField(doc, m.modifiedAtColumn) : undefined;
      const modifiedAt = modifiedRaw instanceof Date ? modifiedRaw : undefined;

      const bodyRef =
        this.mode === 'reference'
          ? (() => {
              const v = getField(doc, m.bodyColumn);
              return typeof v === 'string' ? v : undefined;
            })()
          : undefined;

      return {
        id,
        name: title,
        path: `${this.credentials.collection}/${id}`,
        mimeType,
        size: 0, // unknown until download in copy mode; reference-mode has no local size
        modifiedAt,
        isFolder: false,
        webUrl: bodyRef,
        downloadUrl: bodyRef,
        metadata: {
          mode: this.mode,
          supplier: m.supplierColumn ? getField(doc, m.supplierColumn) : undefined,
          client: m.clientColumn ? getField(doc, m.clientColumn) : undefined,
          externalId: m.externalIdColumn ? getField(doc, m.externalIdColumn) : undefined,
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
        'MongoDB connector is in reference mode; no body to download. ' +
          'sync-service should treat this source as metadata-only.',
      );
    }

    const col = await this.getCollection();
    const m = this.mapping;

    // Build an id filter that handles both ObjectId and plain string keys.
    let idFilter: Filter<Document>;
    try {
      const oid = new ObjectId(fileId);
      idFilter = { $or: [{ [m.idColumn]: oid }, { [m.idColumn]: fileId }] } as Filter<Document>;
    } catch {
      idFilter = { [m.idColumn]: fileId } as Filter<Document>;
    }

    const projection: Record<string, 0 | 1> = {
      [m.bodyColumn]: 1,
    };
    if (m.titleColumn) projection[m.titleColumn] = 1;
    if (m.mimeTypeColumn) projection[m.mimeTypeColumn] = 1;

    const doc = await col.findOne(idFilter, { projection });
    if (!doc) throw new Error(`MongoDB document not found: ${fileId}`);

    const title =
      (getField(doc, m.titleColumn || '') as string | undefined) ||
      `${this.credentials.collection}-${fileId}`;
    const mimeRaw = m.mimeTypeColumn ? getField(doc, m.mimeTypeColumn) : undefined;
    let mimeType = (typeof mimeRaw === 'string' ? mimeRaw : '') || inferMimeFromName(title);

    const body = getField(doc, m.bodyColumn);

    // Case 1: inline Buffer/BSON Binary in the document.
    if (Buffer.isBuffer(body)) {
      return {
        content: body,
        mimeType,
        name: title,
        filename: title,
        size: body.length,
      };
    }
    // node-mongodb returns BSON Binary as { _bsontype: 'Binary', buffer: Buffer }
    // which Buffer.isBuffer() doesn't match; check for .buffer.
    if (
      body &&
      typeof body === 'object' &&
      'buffer' in (body as Record<string, unknown>) &&
      Buffer.isBuffer((body as { buffer: Buffer }).buffer)
    ) {
      const buf = (body as { buffer: Buffer }).buffer;
      return {
        content: buf,
        mimeType,
        name: title,
        filename: title,
        size: buf.length,
      };
    }

    // Case 2: GridFS file id (string or ObjectId) — stream the file.
    if (body && (typeof body === 'string' || body instanceof ObjectId)) {
      const db = await this.getDb();
      const bucket = new GridFSBucket(db, { bucketName: this.credentials.gridfsBucket || 'fs' });
      const gridId = body instanceof ObjectId ? body : (() => {
        try { return new ObjectId(body); } catch { return body as unknown as ObjectId; }
      })();
      const stream = bucket.openDownloadStream(gridId as ObjectId);
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve());
      });
      const buf = Buffer.concat(chunks);
      // Try to read GridFS metadata for filename/contentType
      const fileRecord = await db
        .collection(`${this.credentials.gridfsBucket || 'fs'}.files`)
        .findOne({ _id: gridId as ObjectId });
      const gridName = (fileRecord?.filename as string | undefined) || title;
      const gridMime =
        (fileRecord?.metadata as { contentType?: string } | undefined)?.contentType ||
        (fileRecord?.contentType as string | undefined) ||
        mimeType;
      mimeType = gridMime || mimeType;
      return {
        content: buf,
        mimeType,
        name: gridName,
        filename: gridName,
        size: buf.length,
      };
    }

    throw new Error(
      `MongoDB bodyColumn (${m.bodyColumn}) must be a Buffer, BSON Binary, or GridFS id in copy mode; got ${typeof body}`,
    );
  }

  supportsDeltaSync(): boolean {
    return Boolean(this.mapping.modifiedAtColumn);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = undefined;
      this.db = undefined;
    }
  }
}

export function createMongoConnector(credentials: MongoCredentials): MongoConnector {
  return new MongoConnector(credentials);
}
