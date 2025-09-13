# clients-rag

Lightweight RAG utilities for the Contract Intelligence repo.

- chunkText(text, size, overlap): split text into overlapping chunks.
- embedChunks(docId, chunks, { model, apiKey }): generate embeddings via OpenAI and persist in Prisma Embedding table.
- retrieve(docId, query, k, { model, apiKey }): cosine similarity retrieval using JSON vectors from Postgres.
- getDocChunks(docId, k): list stored chunks.

Notes: Intended for demo/dev; replace with pgvector or a vector DB for production.
