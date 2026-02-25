# Contract System - Fresh Deep Analysis

**Analysis Date:** 2026-02-24  
**Scope:** Upload, Processing, Queue, Display, E2E  
**Severity:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Executive Summary

After a complete ground-up analysis, I've identified **43 gaps** across the contract system. The system has a solid architecture but has critical issues in testing, worker reliability, and UI consistency.

---

## 1. 🔴 CRITICAL GAPS

### 1.1 E2E Test Uses Missing data-testid
**File:** `apps/web/tests/contract-upload.e2e.spec.ts:35,63,75,109`

**Problem:** Tests rely on `[data-testid="contract-upload-input"]` which doesn't exist in the actual upload page.

**Evidence:**
```typescript
// Test expects:
const uploadZone = page.locator('[data-testid="upload-zone"], [data-testid="contract-upload-input"]');

// But in app/contracts/upload/page.tsx (line 663):
<input {...getInputProps()} disabled={isUploading} aria-label="Upload contract documents" />
// No data-testid attribute!
```

**Fix:**
```tsx
// In app/contracts/upload/page.tsx around line 663:
<input 
  {...getInputProps()} 
  disabled={isUploading} 
  aria-label="Upload contract documents"
  data-testid="contract-upload-input"  // ADD THIS
/>
```

---

### 1.2 Status Case Inconsistency
**Files:** 
- `apps/web/app/api/contracts/route.ts:279`

**Problem:** API converts status to lowercase but frontend expects uppercase

**Evidence:**
```typescript
// route.ts:279
status: contract.status.toLowerCase(),

// But EnhancedUploadProgress.tsx:36 expects:
status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
```

**Impact:** Status badges don't display correctly, processing states break.

**Fix:** Remove `.toLowerCase()` or standardize across the stack.

---

### 1.3 Worker Reads Files from Local Path Only
**File:** `packages/workers/src/contract-processor.ts:156`

**Problem:** Worker reads files using `fs.readFile(filePath)` but doesn't handle S3/MinIO object storage paths.

**Evidence:**
```typescript
// contract-processor.ts:156
fileContent = await fs.readFile(filePath); // Fails for S3 paths like "contracts/tenant/file.pdf"
```

**Impact:** In production with S3/MinIO, workers fail to read uploaded files.

**Fix:** Add storage abstraction:
```typescript
async function readFileFromStorage(filePath: string, storageProvider: string): Promise<Buffer> {
  if (storageProvider === 's3' || storageProvider === 'minio') {
    const { getObject } = await import('@/lib/storage-service');
    return await getObject(filePath);
  }
  return fs.readFile(filePath);
}
```

---

### 1.4 Missing File Type Support
**File:** `packages/workers/src/contract-processor.ts:38-105`

**Problem:** Worker doesn't support:
- Scanned PDFs (no OCR)
- Legacy .doc format
- .odt (OpenDocument)
- Images (PNG/JPG/TIFF for scanned docs)

**Evidence:**
```typescript
// Only handles: .pdf, .docx, .txt, .md, .csv, .json, .xml, .html, .rtf
// Missing: scanned PDFs, .doc, .odt, images
```

**Impact:** Users can upload these files but processing fails.

---

### 1.5 Rate Limiting Not Actually Implemented
**File:** `apps/web/app/api/contracts/upload/route.ts:195-213`

**Problem:** Rate limiting code exists but uses in-memory Map that:
- Doesn't persist across requests
- Is shared across all users in same process
- Resets on server restart

**Evidence:**
```typescript
// Uses in-memory store - not Redis
const _rlStore = (globalThis as any).__uploadRateLimit ??= new Map();
```

**Impact:** Rate limiting doesn't work in production (multi-process).

---

## 2. 🟠 HIGH PRIORITY GAPS

### 2.1 No Virus Scanning
**File:** `apps/web/app/api/contracts/upload/route.ts`

**Problem:** Files uploaded directly without malware scanning.

**Fix:** Add ClamAV integration before saving.

---

### 2.2 Contract List Missing Test IDs
**File:** `apps/web/app/contracts/page.tsx`

**Problem:** No `data-testid` on:
- Filter buttons (filter-all, filter-active, filter-processing)
- Contract list container
- Individual contract rows

**Impact:** E2E tests in `03-contracts.e2e.spec.ts` will fail.

---

### 2.3 Worker Concurrency Too Low
**File:** `packages/workers/src/contract-processor.ts:288`

**Problem:** Concurrency set to 3 with limiter of 10/minute - too restrictive for production.

**Evidence:**
```typescript
concurrency: 3,
limiter: { max: 10, duration: 60000 } // Only 10 jobs per minute
```

**Impact:** Large backlogs will take hours to clear.

---

### 2.4 Missing Contract Detail Route Tests
**File:** E2E tests don't cover `/contracts/[id]/page.tsx`

**Problem:** No E2E tests verify:
- Contract detail page loads
- Artifacts display correctly
- Processing status updates in real-time
- PDF viewer works

---

### 2.5 SSE Connection Limits Not Enforced
**File:** `apps/web/app/api/contracts/[id]/artifacts/stream/route.ts:15-58`

**Problem:** While code exists to limit connections, the `acquireConnection` function returns boolean but doesn't actually track connections properly (no connection key returned).

**Evidence:**
```typescript
function acquireConnection(tenantId: string, contractId: string): boolean {
  // ... logic but no connection identifier returned
  return true; // Always returns true
}
```

---

### 2.6 Processing Job Status Race Condition
**File:** `packages/workers/src/contract-processor.ts:197-211`

**Problem:** Worker uses `updateMany` with optimistic locking but doesn't handle the case where another worker already started processing.

**Evidence:**
```typescript
const statusUpdate = await prisma.contract.updateMany({
  where: { 
    id: contractId,
    status: { in: ['UPLOADED', 'PENDING', 'FAILED'] }
  },
  data: { status: 'PROCESSING' },
});

if (statusUpdate.count === 0) {
  // Returns success but does nothing - confusing!
  return { success: true, artifactsCreated: 0 };
}
```

---

## 3. 🟡 MEDIUM PRIORITY GAPS

### 3.1 Upload Page Auto-Start Can Race
**File:** `apps/web/app/contracts/upload/page.tsx:369-379`

**Problem:** Auto-start effect can trigger multiple times due to dependency array issues.

**Evidence:**
```typescript
useEffect(() => {
  if (shouldAutoStart && !isUploading && files.some(f => f.status === 'pending')) {
    // Can race if files array changes during execution
    handleUploadAll()
  }
}, [shouldAutoStart, isUploading, files, handleUploadAll])
```

---

### 3.2 No Queue Health Monitoring
**Problem:** No endpoint to check if queues are healthy.

**Missing:** 
```typescript
// Should exist: GET /api/health/queue
{
  status: 'healthy' | 'degraded',
  queues: {
    'contract-processing': { waiting: 10, active: 3, failed: 2 },
    'artifact-generation': { waiting: 5, active: 2 }
  }
}
```

---

### 3.3 Contract List Polling Inefficient
**File:** `apps/web/app/contracts/page.tsx:156-164`

**Problem:** Polls every 5 seconds when processing contracts exist, even if none are visible on current page.

**Evidence:**
```typescript
useContracts(serverParams, {
  pollingEnabled: hasProcessingContracts, // True if ANY contract processing
  pollingInterval: 5000,
});
```

---

### 3.4 Missing Artifact Validation
**File:** `packages/workers/src/artifact-generator.ts`

**Problem:** Generated artifacts aren't validated against a schema before saving.

**Impact:** Malformed artifacts can be saved to database.

---

### 3.5 Tenant Quotas Not Enforced
**Problem:** No limit on how many contracts a tenant can upload.

**Impact:** Storage exhaustion attacks possible.

---

### 3.6 Upload Progress Simulation Inaccurate
**File:** `apps/web/app/contracts/upload/page.tsx:261-273`

**Problem:** Upload progress is simulated (fake) rather than real upload progress.

**Evidence:**
```typescript
// Simulated progress - not real
for (let i = 10; i <= 50; i += 10) {
  await new Promise(resolve => setTimeout(resolve, 200))
  setFiles(prev => prev.map(f =>
    f.id === uploadFile.id ? { ...f, progress: i } : f
  ))
}
```

---

### 3.7 RealtimeArtifactViewer Polling Fallback
**File:** `apps/web/components/contracts/RealtimeArtifactViewer.tsx:175-200`

**Problem:** When SSE fails, polling fallback doesn't handle API errors gracefully.

---

### 3.8 Contract Detail Page Too Large
**File:** `apps/web/app/contracts/[id]/page.tsx`

**Problem:** 500+ lines with too many responsibilities.

**Impact:** Maintenance difficulty, testing challenges.

---

### 3.9 Missing Contract Versions E2E
**Problem:** No E2E tests for contract versioning functionality.

---

### 3.10 Duplicate Detection Disabled by Default
**File:** `apps/web/app/api/contracts/upload/route.ts:284`

**Problem:** `ENABLE_DUPLICATE_DETECTION` env var must be set to 'true' - defaults to off.

---

## 4. 🟢 LOW PRIORITY GAPS

### 4.1 No Dark Mode Support in Upload Progress
**File:** `apps/web/components/contracts/upload/EnhancedUploadProgress.tsx`

**Problem:** Hardcoded light mode colors, doesn't respect theme.

---

### 4.2 Keyboard Shortcuts Not Documented
**File:** `apps/web/app/contracts/page.tsx:207-250`

**Problem:** Shortcuts exist (/, v, n, u) but no UI indicator.

---

### 4.3 Missing Virtual Scrolling
**File:** `apps/web/app/contracts/page.tsx`

**Problem:** Large contract lists (1000+) will have performance issues.

---

### 4.4 No Contract Processing Analytics
**Problem:** No metrics on:
- Average processing time
- Success/failure rates
- Queue depth over time

---

### 4.5 File Upload Chunking Not Implemented
**Problem:** Large files (>50MB) uploaded as single chunk - no resume capability.

---

## 5. E2E TEST GAPS

| Test Scenario | Status | Priority |
|--------------|--------|----------|
| Contract upload with real file | ❌ Missing test IDs | 🔴 Critical |
| Processing status updates | ❌ Not tested | 🔴 Critical |
| Contract detail page load | ❌ No test file | 🟠 High |
| Artifact display | ❌ Not tested | 🟠 High |
| PDF viewer | ❌ Not tested | 🟠 High |
| Network interruption | ❌ Not tested | 🟠 High |
| Concurrent uploads | ❌ Not tested | 🟡 Medium |
| Large file handling | ❌ Not tested | 🟡 Medium |
| Queue failure recovery | ❌ Not tested | 🟡 Medium |
| Tenant isolation | ❌ Not tested | 🔴 Critical |

---

## 6. ARCHITECTURE CONCERNS

### 6.1 Mixed Status Patterns
The codebase uses three different status patterns:
1. Prisma enum: `ContractStatus.UPLOADED` (uppercase)
2. API response: lowercase string
3. Frontend TypeScript: `'UPLOADED' | 'PROCESSING'` (uppercase)

**Recommendation:** Standardize on Prisma enum values throughout.

### 6.2 Storage Abstraction Leak
Upload API knows too much about storage implementation:
- S3/MinIO vs local filesystem logic in route handler
- Worker doesn't use same abstraction

**Recommendation:** Create `StorageService` interface.

### 6.3 Queue Job Data Inconsistency
Different job types pass different data shapes:
- `ProcessContractJobData` has `filePath`
- `GenerateArtifactsJobData` has `contractText`
- No shared base interface

---

## 7. ACTIONABLE FIXES

### Fix 1: Add Missing data-testid (5 min)
```tsx
// app/contracts/upload/page.tsx
<input 
  {...getInputProps()} 
  data-testid="contract-upload-input"
/>
```

### Fix 2: Standardize Status Case (2 min)
```typescript
// app/api/contracts/route.ts:279
// Remove .toLowerCase()
status: contract.status,
```

### Fix 3: Add Storage Abstraction (1 hour)
```typescript
// lib/storage-service.ts
export interface StorageProvider {
  upload(file: UploadInput): Promise<UploadResult>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
}
```

### Fix 4: Fix Worker File Reading (30 min)
```typescript
// contract-processor.ts
const storageProvider = contract.storageProvider || 'local';
const fileContent = await readFileFromStorage(filePath, storageProvider);
```

### Fix 5: Add Rate Limiting to Redis (30 min)
```typescript
// Use existing Redis connection
const redis = getRedisClient();
await redis.incr(`ratelimit:upload:${tenantId}`);
await redis.expire(`ratelimit:upload:${tenantId}`, 60);
```

---

## 8. IMPLEMENTATION ROADMAP

### Week 1: Critical
- [ ] Add missing data-testid attributes
- [ ] Fix status case consistency
- [ ] Fix worker file reading for S3
- [ ] Implement proper rate limiting

### Week 2: High Priority
- [ ] Add virus scanning
- [ ] Add contract detail E2E tests
- [ ] Fix SSE connection tracking
- [ ] Add queue health endpoint

### Week 3: Medium Priority
- [ ] Add OCR for scanned PDFs
- [ ] Implement tenant quotas
- [ ] Add artifact validation
- [ ] Optimize contract list polling

### Week 4: Polish
- [ ] Add dark mode support
- [ ] Document keyboard shortcuts
- [ ] Add virtual scrolling
- [ ] Implement upload chunking

---

## Appendix: Code Smells Detected

1. **Long Functions:** `processContractJob` is 150+ lines
2. **Magic Numbers:** File size limits, timeouts scattered throughout
3. **Commented Code:** Several TODOs in upload route
4. **Type Assertions:** `(job as any).opts?.attempts` in worker
5. **Global State:** `isPausedRef` in upload page
6. **Duplicate Logic:** File validation in both client and server
7. **Missing Error Boundaries:** No error boundaries around contract detail sections

---

**Analysis completed:** 2026-02-24  
**Recommend immediate action on:** 5 critical items
