import db from 'clients-db';

// Local type and function to avoid cross-package dependencies
type SearchDocument = {
  docId: string;
  content: string;
};

const documents: SearchDocument[] = [];

function addToIndex(doc: SearchDocument) {
  // Avoid duplicates
  if (documents.some(d => d.docId === doc.docId)) {
    // Update existing document
    const index = documents.findIndex(d => d.docId === doc.docId);
    documents[index] = doc;
    return;
  }
  documents.push(doc);
}

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
