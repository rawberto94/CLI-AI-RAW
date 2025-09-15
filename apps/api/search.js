// A simple in-memory search index for demo purposes.
// In a production environment, this would be replaced by a proper search engine like
// Elasticsearch, OpenSearch, or a vector database.
const documents = [];
export function addToIndex(doc) {
    // Avoid duplicates
    if (documents.some(d => d.docId === doc.docId)) {
        // Update existing document
        const index = documents.findIndex(d => d.docId === doc.docId);
        documents[index] = doc;
        return;
    }
    documents.push(doc);
}
export function searchIndex(query) {
    if (!query)
        return [];
    const lowerQuery = query.toLowerCase();
    return documents.filter(d => d.content.toLowerCase().includes(lowerQuery));
}
export function getIndexSize() {
    return documents.length;
}
//# sourceMappingURL=search.js.map