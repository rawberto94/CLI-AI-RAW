declare module 'clients-rag' {
  export type Chunk = {
    index: number;
    text: string;
    embedding?: number[];
  };
  
  export function chunkText(text: string, size?: number, overlap?: number): Chunk[];
  
  export function embedChunks(
    docId: string, 
    tenantId: string, 
    chunks: Chunk[], 
    opts?: { model?: string; apiKey?: string }
  ): Promise<Chunk[]>;
  
  export function retrieve(
    docId: string, 
    tenantId: string, 
    query: string, 
    k?: number, 
    opts?: { model?: string; apiKey?: string }
  ): Promise<{ text: string; score: number; chunkIndex: number }[]>;
  
  export function getDocChunks(docId: string, tenantId: string, k?: number): Promise<any>;
}
