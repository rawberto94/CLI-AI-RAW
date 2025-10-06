# Upload and Display Status

## Current Status: ⚠️ PARTIALLY WORKING

### What's Working ✅

1. **File Upload**
   - Files can be uploaded via `/uploads` endpoint
   - PDF parsing works
   - Text extraction works
   - Files stored in memory or S3 (if configured)
   - Contract metadata saved in backend memory store

2. **Backend Processing**
   - Analysis pipeline triggers
   - Workers process documents (if Redis available)
   - Artifacts generated (overview, rates, risk, compliance, etc.)
   - Results stored in backend memory

### What's NOT Working ❌

1. **Frontend Display**
   - Frontend looks for contracts in `data/contracts/{id}.json` files
   - Backend stores contracts in memory (not in files)
   - **Mismatch**: Frontend can't find the data backend created

2. **The Problem**
   ```
   Backend (API):
   - Stores in memory: apps/api/store.ts
   - Data structure: Map<string, Contract>
   
   Frontend (Next.js):
   - Looks for files: data/contracts/{id}.json
   - Can't find the data!
   ```

## The Fix Needed

### Option 1: Make Backend Write Files (Quick Fix)

Update `apps/api/store.ts` to write JSON files when contracts are added:

```typescript
export function addContract(c: Contract) {
  contracts.set(c.id, c);
  
  // Also write to file for frontend
  const fs = require('fs');
  const path = require('path');
  const dataDir = path.join(process.cwd(), 'data', 'contracts');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(dataDir, `${c.id}.json`),
    JSON.stringify({
      id: c.id,
      filename: c.name,
      uploadDate: c.createdAt,
      status: c.status.toLowerCase(),
      tenantId: c.tenantId,
      fileSize: 0,
      mimeType: 'application/pdf',
      processing: {
        jobId: c.id,
        status: c.status,
        currentStage: 'completed',
        progress: 100,
        startTime: c.createdAt,
        completedAt: c.updatedAt
      },
      extractedData: {} // Will be populated by artifacts
    }, null, 2)
  );
  
  persist();
}
```

### Option 2: Make Frontend Use Backend API (Better Fix)

Update `apps/web/app/api/contracts/[id]/route.ts` to fetch from backend API instead of files:

```typescript
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const contractId = params.id;
  
  // Fetch from backend API instead of file
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  try {
    // Get contract metadata
    const contractRes = await fetch(`${API_URL}/api/contracts/${contractId}`);
    if (!contractRes.ok) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    const contract = await contractRes.json();
    
    // Get artifacts
    const artifactsRes = await fetch(`${API_URL}/api/contracts/${contractId}/artifacts`);
    const artifacts = artifactsRes.ok ? await artifactsRes.json() : {};
    
    // Combine and return
    return NextResponse.json({
      ...contract,
      extractedData: artifacts
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch contract" }, { status: 500 });
  }
}
```

## Current Workaround

The app shows "Error" and "0.0 MB" because:
1. Upload succeeds ✅
2. Backend processes file ✅
3. Frontend can't find the results ❌

## Recommended Action

**Implement Option 2** - Make the frontend fetch from the backend API. This is cleaner and doesn't require file I/O.

## Files to Modify

1. `apps/web/app/api/contracts/[id]/route.ts` - Change to fetch from backend
2. `apps/web/app/api/contracts/route.ts` - Change list endpoint too
3. Test upload → should now display results!

## Testing

After fix:
1. Upload a PDF
2. Wait for processing (check backend logs)
3. Click on the contract
4. Should see: overview, rates, risk analysis, etc.

---

**Status**: Issue identified, fix needed in frontend API routes
