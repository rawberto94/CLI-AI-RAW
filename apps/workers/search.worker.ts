import db from 'clients-db';
import { addToIndex } from '../api/search';

export type SearchJob = {
  docId: string;
};

export async function runSearch(job: { data: SearchJob }) {
  const { docId } = job.data;
  console.log(`[worker:search] Starting indexing for ${docId}`);

  try {

    const artifact = await db.artifact.findFirst({
      where: {
        contractId: docId,
        type: 'INGESTION',
      },
    });

    if (!artifact) {
      throw new Error(`Ingestion artifact for ${docId} not found`);
    }

    const content = (artifact.data as any)?.content || '';
    if (!content) {
      console.warn(`[worker:search] No content found for ${docId}`);
      return;
    }

    addToIndex({ docId, content });
    console.log(`[worker:search] Finished indexing for ${docId}`);
  } catch (err) {
    console.error(`[worker:search] Error processing ${docId}`, err);
    throw err;
  }
}
