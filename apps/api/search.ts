// A simple in-memory search index for demo purposes.
// In a production environment, this would be replaced by a proper search engine like
// Elasticsearch, OpenSearch, or a vector database.

type SearchDocument = {
  docId: string;
  content: string;
};

const documents: SearchDocument[] = [];

export function addToIndex(doc: SearchDocument) {
  // Avoid duplicates
  if (documents.some(d => d.docId === doc.docId)) {
    // Update existing document
    const index = documents.findIndex(d => d.docId === doc.docId);
    documents[index] = doc;
    return;
  }
  documents.push(doc);
}

export function searchIndex(query: string): SearchDocument[] {
  if (!query) return [];
  const lowerQuery = query.toLowerCase();
  return documents.filter(d => d.content.toLowerCase().includes(lowerQuery));
}

export function getIndexSize() {
  return documents.length;
}
