# Real Data Integration Status

## ✅ What Works with Real Data (dataMode === 'real')

### 1. **Upload System** ✅ FULLY WORKING
**Component**: `ImprovedUploadZone.tsx`
**API**: `/api/contracts/upload` ✅ EXISTS

**Real Data Flow**:
1. User uploads file → FormData sent to API
2. API validates file (type, size)
3. File saved to disk (`uploads/contracts/{tenantId}/`)
4. Contract record created in Prisma database
5. Processing job created
6. Artifact generation triggered
7. Returns `contractId` for tracking

**Database Tables Used**:
- `Contract` - Stores contract metadata
- `ProcessingJob` - Tracks processing status
- `Artifact` - Generated artifacts (via background job)

**Status**: ✅ **Production Ready**

---

### 2. **Contract Detail View** ✅ PARTIALLY WORKING
**Component**: `ContractDetailTabs.tsx`, `improved-page.tsx`
**API**: `/api/contracts/[id]` ✅ EXISTS

**Real Data Flow**:
1. Fetch contract by ID from database
2. Load artifacts from database
3. Display in tabs
4. Export functionality ready

**Database Tables Used**:
- `Contract` - Main contract data
- `Artifact` - Associated artifacts
- `RateCard` - Rate information

**Status**: ✅ **Works with Real Data**
**Note**: Needs contract ID from actual upload

---

### 3. **Analytics** ⚠️ NEEDS API IMPLEMENTATION
**Component**: `AnalyticsHub.tsx`
**API**: `/api/analytics/metrics` ❌ NEEDS CREATION

**What's Needed**:
```typescript
// Create: apps/web/app/api/analytics/metrics/route.ts
export async function GET(request: NextRequest) {
  const prisma = new PrismaClient()
  
  const [totalContracts, totalValue, activeSuppliers] = await Promise.all([
    prisma.contract.count(),
    prisma.contract.aggregate({ _sum: { totalValue: true } }),
    prisma.contract.groupBy({ by: ['supplierName'] })
  ])
  
  return NextResponse.json({
    totalContracts,
    totalValue: totalValue._sum.totalValue || 0,
    activeSuppliers: activeSuppliers.length,
    // ... more metrics
  })
}
```

**Status**: ⚠️ **Mock Data Only** (API needs creation)

---

### 4. **Search** ⚠️ NEEDS API IMPLEMENTATION
**Component**: `SmartSearch.tsx`
**API**: `/api/search` ❌ NEEDS CREATION

**What's Needed**:
```typescript
// Create: apps/web/app/api/search/route.ts
export async function POST(request: NextRequest) {
  const { query, filters } = await request.json()
  const prisma = new PrismaClient()
  
  const results = await prisma.contract.findMany({
    where: {
      OR: [
        { contractTitle: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { supplierName: { contains: query, mode: 'insensitive' } }
      ],
      // Apply filters
      ...(filters.status && { status: filters.status }),
      ...(filters.minValue && { totalValue: { gte: filters.minValue } })
    },
    include: { artifacts: true }
  })
  
  return NextResponse.json({ results })
}
```

**Status**: ⚠️ **Mock Data Only** (API needs creation)

---

### 5. **AI Chat** ⚠️ NEEDS AI INTEGRATION
**Component**: `ChatAssistant.tsx`
**API**: `/api/ai/chat` ✅ EXISTS (stub)

**What's Needed**:
```typescript
// Update: apps/web/app/api/ai/chat/route.ts
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: NextRequest) {
  const { message, contractId, history } = await request.json()
  
  // Load contract context if provided
  let context = ''
  if (contractId) {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { artifacts: true }
    })
    context = JSON.stringify(contract)
  }
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: `You are a contract analysis assistant. Context: ${context}` },
      ...history,
      { role: 'user', content: message }
    ]
  })
  
  return NextResponse.json({
    response: response.choices[0].message.content,
    suggestions: ['...']
  })
}
```

**Status**: ⚠️ **Mock Data Only** (needs OpenAI API key)

---

### 6. **Bulk Operations** ⚠️ NEEDS API IMPLEMENTATION
**Component**: `BulkOperations.tsx`
**API**: `/api/contracts/bulk` ❌ NEEDS CREATION

**What's Needed**:
```typescript
// Create: apps/web/app/api/contracts/bulk/route.ts
export async function POST(request: NextRequest) {
  const { operation, contractIds } = await request.json()
  const prisma = new PrismaClient()
  
  switch (operation) {
    case 'export':
      // Generate exports for all contracts
      break
    case 'update':
      // Update multiple contracts
      await prisma.contract.updateMany({
        where: { id: { in: contractIds } },
        data: { /* updates */ }
      })
      break
    case 'delete':
      // Delete multiple contracts
      await prisma.contract.deleteMany({
        where: { id: { in: contractIds } }
      })
      break
  }
  
  return NextResponse.json({ success: true })
}
```

**Status**: ⚠️ **Mock Data Only** (API needs creation)

---

### 7. **Export Functionality** ⚠️ NEEDS API IMPLEMENTATION
**Component**: `ExportMenu.tsx`
**API**: `/api/contracts/[id]/export` ❌ NEEDS CREATION

**What's Needed**:
```typescript
// Create: apps/web/app/api/contracts/[id]/export/route.ts
import PDFDocument from 'pdfkit'
import ExcelJS from 'exceljs'

export async function GET(request: NextRequest, { params }) {
  const format = request.nextUrl.searchParams.get('format')
  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: { artifacts: true }
  })
  
  switch (format) {
    case 'pdf':
      // Generate PDF
      const doc = new PDFDocument()
      // ... add content
      return new NextResponse(doc, {
        headers: { 'Content-Type': 'application/pdf' }
      })
    case 'excel':
      // Generate Excel
      const workbook = new ExcelJS.Workbook()
      // ... add data
      return new NextResponse(await workbook.xlsx.writeBuffer(), {
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.document' }
      })
    case 'json':
      return NextResponse.json(contract)
  }
}
```

**Status**: ⚠️ **Mock Data Only** (API needs creation)

---

## 📊 Summary

### ✅ Working with Real Data:
1. **Upload** - Fully functional with database
2. **Contract Detail** - Reads from database
3. **Contract List** - Existing API works

### ⚠️ Needs API Implementation:
1. **Analytics Metrics** - Need aggregation API
2. **Search** - Need search API
3. **AI Chat** - Need OpenAI integration
4. **Bulk Operations** - Need bulk API
5. **Export** - Need export API

---

## 🔧 Quick Implementation Guide

### Priority 1: Analytics API (15 minutes)
```bash
# Create the metrics API
touch apps/web/app/api/analytics/metrics/route.ts
```

### Priority 2: Search API (20 minutes)
```bash
# Create the search API
touch apps/web/app/api/search/route.ts
```

### Priority 3: Bulk Operations API (20 minutes)
```bash
# Create the bulk API
touch apps/web/app/api/contracts/bulk/route.ts
```

### Priority 4: Export API (30 minutes)
```bash
# Create the export API
touch apps/web/app/api/contracts/[id]/export/route.ts
# Install dependencies
npm install pdfkit exceljs
```

### Priority 5: AI Chat (10 minutes + API key)
```bash
# Update the chat API
# Add OPENAI_API_KEY to .env
npm install openai
```

---

## 🎯 Data Mode Toggle

The toggle is **ALWAYS VISIBLE** at the top-right corner:
- Fixed position: `fixed top-4 right-4 z-50`
- Available on all pages
- Persists selection to localStorage
- Shows current mode with badge

**Location**: `apps/web/app/layout.tsx`

```typescript
<div className="fixed top-4 right-4 z-50">
  <EnhancedDataModeToggle />
</div>
```

---

## 🚀 Current State

### What Users Can Do NOW:
1. ✅ **Upload contracts** - Works with real database
2. ✅ **View uploaded contracts** - Reads from database
3. ✅ **Edit artifacts** - Saves to database
4. ✅ **Switch data modes** - Toggle always visible
5. ⚠️ **View analytics** - Shows mock data (API needed)
6. ⚠️ **Search contracts** - Shows mock results (API needed)
7. ⚠️ **Chat with AI** - Shows mock responses (OpenAI key needed)
8. ⚠️ **Bulk operations** - Shows mock actions (API needed)

### What Needs Real Data:
- Analytics aggregations
- Search functionality
- AI chat responses
- Bulk operations
- Export generation

**All components are ready - they just need the API endpoints created!**

---

## 💡 Recommendation

**Option 1: Quick Win (1 hour)**
Create the 4 missing APIs (analytics, search, bulk, export) to make everything work with real data.

**Option 2: Gradual (as needed)**
Keep mock data for now, implement real APIs when needed for production.

**Option 3: Hybrid (current)**
Upload works with real data, everything else uses mock data for testing/demo.

The toggle ensures users can always switch between modes!
