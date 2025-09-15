type SearchDocument = {
    docId: string;
    content: string;
};
export declare function addToIndex(doc: SearchDocument): void;
export declare function searchIndex(query: string): SearchDocument[];
export declare function getIndexSize(): number;
export {};
//# sourceMappingURL=search.d.ts.map