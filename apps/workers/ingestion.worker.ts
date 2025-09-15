// Prefer workspace import, fallback to relative if needed
let IngestionArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  IngestionArtifactV1Schema = require('schemas').IngestionArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  IngestionArtifactV1Schema = require('../../packages/schemas/src').IngestionArtifactV1Schema;
}

let db: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('clients-db');
  db = mod.default || mod;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../packages/clients/db');
  db = mod.default || mod;
}

let getFileStream: any;
let getObjectBuffer: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const s = require('clients-storage');
  getFileStream = s.getFileStream;
  getObjectBuffer = s.getObjectBuffer;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const s = require('../../packages/clients/storage');
  getFileStream = s.getFileStream;
  getObjectBuffer = s.getObjectBuffer;
}

// Legacy queue setup removed - unused

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');

export type IngestionJob = { docId: string };

export async function runIngestion(job: { data: IngestionJob }) {
  const { docId } = job.data;
  console.log(`[worker:ingestion] Starting ingestion for ${docId}`);
  const startTime = Date.now();

  try {
    const contract = await db.contract.findUnique({ where: { id: docId } });
    if (!contract) throw new Error(`Contract ${docId} not found`);

    // Prefer buffer to avoid Invalid parameter object errors
    const buf: Buffer = typeof getObjectBuffer === 'function'
      ? await getObjectBuffer(contract.storagePath)
      : await (async () => {
          const s = await getFileStream(contract.storagePath);
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve, reject) => {
            s.on('data', (c: Buffer) => chunks.push(c));
            s.on('error', reject);
            s.on('end', () => resolve());
          });
          return Buffer.concat(chunks);
        })();

    // Detect file type by extension; default to pdf only when clearly a PDF
    const path = String(contract.storagePath || '').toLowerCase();
    const looksPdf = /\.pdf$/.test(path);
    let fileType: 'pdf' | 'txt' = looksPdf ? 'pdf' : 'txt';
    let totalPages = 1;
    let content = '';

    if (looksPdf) {
      try {
        const pdfData = await pdf(buf);
        totalPages = Number(pdfData?.numpages) || 1;
        content = String(pdfData?.text || '');
      } catch (e) {
        // Fallback: attempt UTF-8 decode if pdf-parse fails
        try { content = buf.toString('utf8'); fileType = 'txt'; totalPages = 1; }
        catch { content = ''; }
      }
    } else {
      try { content = buf.toString('utf8'); }
      catch { content = ''; }
    }

  const artifact = IngestionArtifactV1Schema.parse({
      metadata: {
        docId: docId,
        fileType,
        totalPages,
        ocrRate: 0, // Placeholder
        provenance: [{
          worker: 'ingestion',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        }],
      },
      content,
    });

    await db.artifact.create({
      data: {
        contractId: docId,
        type: 'INGESTION',
        data: artifact as any,
      },
    });
    
    await db.contract.update({
        where: { id: docId },
        data: { status: 'INGESTED' },
    });

    // When RAG is enabled, chunk + embed and persist vectors
    try {
      const enabled = (process.env['RAG_ENABLED'] || '').toLowerCase() === 'true';
      if (enabled && content && content.length > 0) {
        let rag: any;
        try {
          rag = require('clients-rag');
        } catch {
          rag = require('../../packages/clients/rag');
        }
        const size = Number(process.env['RAG_CHUNK_SIZE'] || 1200);
        const overlap = Number(process.env['RAG_CHUNK_OVERLAP'] || 150);
        const chunks = rag.chunkText(content, size, overlap);
        if (chunks.length) {
          await rag.embedChunks(docId, contract.tenantId, chunks, { model: process.env['RAG_EMBED_MODEL'], apiKey: process.env['OPENAI_API_KEY'] });
        }
      }
    } catch (e) {
      console.warn('[worker:ingestion] RAG embedding failed:', (e as any)?.message || e);
    }

    console.log(`[worker:ingestion] Finished ingestion for ${docId}`);
    return { docId };
  } catch (err) {
    console.error(`[worker:ingestion] Error processing ${docId}`, err);
    await db.contract.update({
        where: { id: docId },
        data: { status: 'FAILED', statusReason: 'Ingestion failed' },
    }).catch(() => {}); // Best effort
    throw err;
  }
}
