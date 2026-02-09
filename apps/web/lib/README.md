# lib/ Directory Organization

**Last Updated**: February 2026

This directory contains shared code for the `apps/web` Next.js application.

## Structure

```
lib/
├── [CLIENT] — Safe for 'use client' components
│   ├── animations.ts, design-tokens.ts    — Design system
│   ├── contract-api.ts, data-fetching.ts  — Client fetch wrappers  
│   ├── feature-flags.tsx, state-machine.ts — Client state management
│   ├── query-client.tsx, propagation.ts   — React Query + cache sync
│   ├── tenant.ts, utils.ts, toast-utils   — Client utilities
│   └── contracts/                         — Contract UI helpers
│
├── [SERVER] — Server-only (marked 'server-only' or uses Node APIs)
│   ├── auth.ts, prisma.ts, tenant-server.ts — Core server singletons
│   ├── api-*.ts                           — API route middleware
│   ├── cache.ts, rate-limit*.ts, csrf.ts  — Server middleware
│   ├── ai/                                — AI processing services
│   ├── rag/                               — RAG pipeline
│   ├── security/                          — Security, audit, encryption
│   ├── import/                            — Data import pipeline  
│   ├── integrations/                      — External connectors
│   ├── chatbot/                           — Chatbot intent/actions
│   ├── services/                          — Business logic services
│   ├── storage/                           — S3/Azure Blob adapters
│   ├── middleware/                         — Request middleware
│   ├── email/                             — Email service
│   └── telemetry/                         — OpenTelemetry, tracing
│
├── [SHARED] — Used by both client and server
│   ├── constants.ts, result.ts            — Pure types/constants
│   ├── validation.ts, validation/         — Zod schemas
│   ├── types/                             — Type definitions
│   └── use-cases/                         — Business logic utilities
│
└── [COMPATIBILITY] — Re-exports from packages/
    ├── db.ts                              → prisma.ts
    └── data-orchestration.ts              → data-orchestration package
```

## Migration Target

Server-only directories should eventually migrate to `packages/data-orchestration/`:
- `lib/ai/` → `packages/data-orchestration/src/services/ai/`
- `lib/rag/` → `packages/agents/src/rag/` or `packages/clients/rag/`
- `lib/security/` → `packages/data-orchestration/src/security/`
- `lib/import/` → `packages/data-orchestration/src/import/`

**Rule**: New server-only business logic should go in `packages/data-orchestration/`,
not in `lib/`. lib/ should only contain:
- Client utilities and React hooks
- Auth/prisma singletons (Next.js config)
- API middleware (Next.js-specific request/response handling)
- Thin re-exports from packages
