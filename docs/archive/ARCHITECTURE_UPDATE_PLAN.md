# Architecture Update Plan

## Executive Summary

This document outlines the recommended improvements for the Contract Intelligence Platform's upload-to-storage and AI artifact extraction flows, along with overall system architecture enhancements.

## Current Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Next.js)                                 │
├───────────────────────────────────┬──────────────────────────────────────────┤
│        Upload Page                │         RealtimeArtifactViewer           │
│    (react-dropzone)               │          (SSE EventSource)               │
└───────────────┬───────────────────┴─────────────────────┬────────────────────┘
                │                                         │
                ▼                                         ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER (Next.js)                              │
├─────────────────────────┬─────────────────────┬───────────────────────────────┤
│  /api/contracts/upload  │  /api/contracts/[id]│  /api/contracts/[id]/stream   │
│    (File Upload)        │   (Get Contract)    │    (SSE Artifact Updates)     │
└────────────┬────────────┴──────────┬──────────┴───────────────────────────────┘
             │                       │
             ▼                       │
┌──────────────────────┐             │
│   Object Storage     │             │
│    (MinIO/S3)        │             │
└──────────┬───────────┘             │
           │                         │
           ▼                         ▼
┌──────────────────────┐  ┌──────────────────────┐
│   Job Queue (Redis   │  │    PostgreSQL        │
│   + BullMQ)          │  │    + pgvector        │
└──────────┬───────────┘  └──────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           WORKERS (packages/workers)                          │
├──────────────────────────┬──────────────────────┬─────────────────────────────┤
│   OCR Artifact Worker    │  Artifact Generator  │     Webhook Worker          │
│   (Mistral/GPT-4 OCR)    │  (AI Generation)     │   (Event Delivery)          │
└──────────────────────────┴──────────────────────┴─────────────────────────────┘
```

---

## Critical Fixes Applied ✅

### 1. Artifact Type Naming Consistency
**Issue:** Inconsistent artifact type naming between workers (`OVERVIEW`, `CLAUSES`) and mock data (`overview`, `key_clauses`).

**Fixed Files:**
- `apps/web/app/api/contracts/[id]/artifacts/stream/route.ts`
- `apps/web/components/contracts/RealtimeArtifactViewer.tsx`
- `packages/workers/src/artifact-generator.ts`
- `packages/workers/src/ocr-artifact-worker.ts`

**Solution:** Standardized on UPPERCASE types: `OVERVIEW`, `CLAUSES`, `FINANCIAL`, `RISK`, `COMPLIANCE`

### 2. SSE Stream Escape Character Issue
**Issue:** Double-escaped newlines (`\\n\\n`) in SSE stream route causing malformed events.

**Fixed File:** `apps/web/app/api/contracts/[id]/artifacts/stream/route.ts`

### 3. RealtimeArtifactViewer Type Normalization
**Issue:** Component couldn't handle mixed-case artifact types from different sources.

**Solution:** Added `normalizeType()` helper function to convert any format to uppercase.

---

## Recommended Architecture Improvements

### Phase 1: Core Infrastructure (Priority: HIGH)

#### 1.1 Queue Reliability Enhancement
**Current Issue:** Jobs can be lost if workers crash during processing.

**Recommendation:**
```typescript
// Implement dead-letter queue for failed jobs
const dlqQueue = new Queue('contract-processing-dlq', { connection });

// Add job lifecycle hooks
worker.on('failed', async (job, error) => {
  if (job.attemptsMade >= job.opts.attempts) {
    await dlqQueue.add('failed-job', {
      originalJob: job.data,
      error: error.message,
      failedAt: new Date()
    });
  }
});
```

#### 1.2 Idempotent Job Processing
**Current Issue:** Same contract might be processed multiple times if upload retries.

**Recommendation:**
```typescript
// Use contract ID as jobId to prevent duplicates
await queue.add('process-contract', data, {
  jobId: `contract-${contractId}`,
  removeOnComplete: { age: 3600 }, // Keep for 1 hour
  removeOnFail: { age: 86400 }     // Keep failed for 24 hours
});
```

#### 1.3 Storage Service Resilience
**Current Issue:** Storage service initialization can fail silently.

**Recommendation:**
```typescript
// Add health check endpoint
export async function checkStorageHealth(): Promise<HealthStatus> {
  try {
    await storageService.client.ping();
    return { healthy: true, latency: Date.now() - start };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}
```

### Phase 2: Performance Optimization (Priority: MEDIUM)

#### 2.1 Parallel Artifact Generation
**Current State:** Artifacts are generated in parallel but could be optimized further.

**Recommendation:**
```typescript
// Use worker threads for CPU-intensive OCR
import { Worker } from 'worker_threads';

const ocrWorker = new Worker('./ocr-thread.js');
ocrWorker.postMessage({ filePath, buffer });
```

#### 2.2 Caching Strategy
**Current State:** Basic in-memory cache in workers.

**Recommendation:**
```typescript
// Use Redis for distributed caching
const cacheKey = `artifact:${contractId}:${type}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const artifact = await generateArtifact();
await redis.setex(cacheKey, 3600, JSON.stringify(artifact));
```

#### 2.3 Stream Optimization
**Current State:** SSE polls every 1 second.

**Recommendation:**
```typescript
// Use Redis Pub/Sub for real-time updates
const pubsub = new Redis();
pubsub.subscribe(`contract:${contractId}:updates`);

pubsub.on('message', (channel, message) => {
  controller.enqueue(encoder.encode(`data: ${message}\n\n`));
});
```

### Phase 3: AI/ML Enhancement (Priority: MEDIUM)

#### 3.1 Real AI Integration
**Current State:** Placeholder artifact generation with mock data.

**Recommendation:**
```typescript
// Integrate with OpenAI for real artifact extraction
async function generateArtifactWithAI(type: string, text: string): Promise<Artifact> {
  const prompts = {
    OVERVIEW: `Analyze this contract and provide a summary including parties, dates, and key terms:\n\n${text}`,
    CLAUSES: `Extract key clauses from this contract, categorized by importance:\n\n${text}`,
    FINANCIAL: `Extract financial terms including values, payment schedules, and rates:\n\n${text}`,
    RISK: `Identify risks in this contract with severity levels and mitigation suggestions:\n\n${text}`,
    COMPLIANCE: `Check this contract for compliance with GDPR, SOC2, and standard regulations:\n\n${text}`
  };

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompts[type] }],
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

#### 3.2 RAG Enhancement
**Current State:** ChromaDB for vector storage but underutilized.

**Recommendation:**
```typescript
// Implement semantic search across artifacts
async function searchSimilarClauses(query: string, limit: number = 5) {
  const embedding = await getEmbedding(query);
  
  const results = await chromaClient.query({
    collection: 'contract_clauses',
    queryEmbeddings: [embedding],
    nResults: limit,
    include: ['documents', 'metadatas', 'distances']
  });
  
  return results;
}
```

### Phase 4: Observability & Monitoring (Priority: HIGH)

#### 4.1 Structured Logging
**Recommendation:**
```typescript
// Add correlation IDs for request tracing
const logger = pino({
  mixin() {
    return { 
      correlationId: asyncLocalStorage.getStore()?.correlationId,
      service: 'contract-processing'
    };
  }
});
```

#### 4.2 Metrics Collection
**Recommendation:**
```typescript
// Add Prometheus metrics
import { Registry, Counter, Histogram } from 'prom-client';

const registry = new Registry();

const uploadCounter = new Counter({
  name: 'contract_uploads_total',
  help: 'Total contract uploads',
  labelNames: ['status', 'tenant']
});

const processingDuration = new Histogram({
  name: 'artifact_generation_duration_seconds',
  help: 'Artifact generation duration',
  labelNames: ['type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});
```

#### 4.3 Health Checks Dashboard
**Recommendation:**
```typescript
// Add /api/health endpoint
export async function GET() {
  const checks = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkStorageHealth(),
    checkWorkerHealth()
  ]);
  
  return NextResponse.json({
    status: checks.every(c => c.healthy) ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  });
}
```

### Phase 5: Security Enhancements (Priority: HIGH)

#### 5.1 File Validation Enhancement
**Recommendation:**
```typescript
// Add magic byte validation
import fileType from 'file-type';

async function validateFile(buffer: Buffer): Promise<ValidationResult> {
  const type = await fileType.fromBuffer(buffer);
  
  if (!type || !ALLOWED_MIME_TYPES.includes(type.mime)) {
    throw new Error('Invalid file type detected');
  }
  
  // Scan for malware (in production)
  await scanForMalware(buffer);
  
  return { valid: true, mimeType: type.mime };
}
```

#### 5.2 Rate Limiting
**Recommendation:**
```typescript
// Add per-tenant rate limiting
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute per tenant
  keyGenerator: (req) => req.headers['x-tenant-id'] || req.ip
});
```

#### 5.3 API Key Rotation
**Current State:** Static API keys in environment variables.

**Recommendation:** Implement automated key rotation with AWS Secrets Manager or HashiCorp Vault.

---

## Database Schema Improvements

### Current Schema Issues
1. Prisma 7 deprecation warnings for datasource URL
2. Missing indexes for common queries
3. No soft delete support

### Recommended Changes

```prisma
// Add soft delete support
model Contract {
  id            String    @id @default(cuid())
  deletedAt     DateTime? // Soft delete
  
  // Add indexes for common queries
  @@index([tenantId, status])
  @@index([tenantId, createdAt])
  @@index([tenantId, contractType])
}

model Artifact {
  @@index([contractId, type])
  @@index([tenantId, createdAt])
}
```

---

## Deployment Recommendations

### 1. Docker Compose Improvements
```yaml
# Add healthcheck with dependencies
services:
  workers:
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 2. Kubernetes Ready
- Add HPA for auto-scaling workers based on queue depth
- Implement pod disruption budgets
- Add network policies for security

### 3. CI/CD Pipeline
- Add E2E tests for upload flow
- Run security scanning (Snyk, Trivy)
- Performance regression testing

---

## Implementation Roadmap

| Phase | Timeline | Priority | Effort |
|-------|----------|----------|--------|
| Phase 1: Core Infrastructure | Week 1-2 | HIGH | Medium |
| Phase 2: Performance | Week 3-4 | MEDIUM | High |
| Phase 3: AI/ML Enhancement | Week 5-8 | MEDIUM | High |
| Phase 4: Observability | Week 2-3 | HIGH | Medium |
| Phase 5: Security | Week 1-4 | HIGH | Medium |

---

## Quick Start Testing

### Test the Upload Flow:
```bash
# Start services
docker-compose -f docker-compose.dev.yml up -d

# Start workers
cd packages/workers && pnpm dev

# Start web app
cd apps/web && pnpm dev

# Test upload via CLI
curl -X POST http://localhost:3000/api/contracts/upload \
  -H "x-tenant-id: demo" \
  -F "file=@test-contract.pdf"
```

---

## Conclusion

The upload-to-storage and AI artifact extraction flows are now consistent and functional. The recommended improvements will enhance reliability, performance, and security of the platform. Priority should be given to:

1. **Queue reliability** - Prevent job loss
2. **Observability** - Know what's happening in production
3. **Security** - Protect uploaded files
4. **AI integration** - Replace placeholders with real AI

---

*Last Updated: November 26, 2025*

