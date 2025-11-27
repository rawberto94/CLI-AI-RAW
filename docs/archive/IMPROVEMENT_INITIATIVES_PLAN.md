# Database & API Integration Improvement Initiatives

## Executive Summary

This document outlines comprehensive improvement initiatives to convert mock data components to real database/API integrations. The goal is to make the application production-ready with persistent data storage, real-time updates, and proper error handling.

---

## 🎯 Initiative 1: Template Manager Enhancement

### Current State
- `TemplateManager.tsx` uses `mockTemplates` array
- API exists at `/api/templates` with Prisma integration
- Database schema includes `ContractTemplate` model

### Implementation Tasks

```
Priority: HIGH | Effort: Medium | Impact: High
```

#### 1.1 Connect to Real API
```typescript
// Replace mockTemplates with API call
useEffect(() => {
  async function fetchTemplates() {
    const res = await fetch('/api/templates');
    const data = await res.json();
    setTemplates(data.templates);
  }
  fetchTemplates();
}, []);
```

#### 1.2 Add CRUD Operations
- [ ] Create template API call
- [ ] Update template API call
- [ ] Delete template API call
- [ ] Duplicate template API call (already exists: `/api/templates/[id]/duplicate`)

#### 1.3 Add Real-time Features
- [ ] Optimistic updates for better UX
- [ ] SWR or React Query for caching
- [ ] Mutation with automatic revalidation

#### 1.4 Files to Modify
- `apps/web/components/contract-generation/TemplateManager.tsx`
- `apps/web/app/api/templates/route.ts` (enhance if needed)

---

## 🎯 Initiative 2: Integration Hub Enhancement

### Current State
- `IntegrationHub.tsx` uses `mockIntegrations`, `mockSyncLogs`, `mockWebhooks`
- API exists at `/api/integrations` with mock data only
- No database model for integrations

### Implementation Tasks

```
Priority: MEDIUM | Effort: High | Impact: High
```

#### 2.1 Create Database Schema
```prisma
model Integration {
  id              String   @id @default(cuid())
  tenantId        String
  name            String
  type            String   // erp, procurement, signature, etc.
  provider        String
  status          String   // connected, disconnected, error, syncing
  apiKey          String?  @db.Text // Encrypted
  apiSecret       String?  @db.Text // Encrypted
  config          Json?
  lastSyncAt      DateTime?
  recordsProcessed Int     @default(0)
  health          Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  syncLogs        SyncLog[]
  webhooks        Webhook[]
  
  @@index([tenantId])
}

model SyncLog {
  id            String   @id @default(cuid())
  integrationId String
  direction     String   // inbound, outbound
  entity        String
  records       Int
  status        String   // success, partial, failed
  duration      Int      // milliseconds
  errors        Json?
  createdAt     DateTime @default(now())
  
  integration   Integration @relation(fields: [integrationId], references: [id])
  
  @@index([integrationId, createdAt])
}

model Webhook {
  id            String   @id @default(cuid())
  integrationId String
  name          String
  url           String
  events        String[]
  status        String   // active, inactive
  secret        String?  @db.Text
  lastTriggered DateTime?
  successCount  Int      @default(0)
  failureCount  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  integration   Integration @relation(fields: [integrationId], references: [id])
  
  @@index([integrationId])
}
```

#### 2.2 Update API Routes
- [ ] GET/POST/PUT/DELETE for integrations
- [ ] GET sync logs with pagination
- [ ] Webhook management endpoints
- [ ] Connection testing endpoint
- [ ] Manual sync trigger endpoint

#### 2.3 Security Considerations
- [ ] Encrypt API keys/secrets at rest
- [ ] OAuth2 flow for supported providers
- [ ] Webhook signature verification
- [ ] Rate limiting for sync operations

#### 2.4 Files to Create/Modify
- `prisma/schema.prisma` (add models)
- `apps/web/app/api/integrations/route.ts` (enhance)
- `apps/web/app/api/integrations/[id]/route.ts` (new)
- `apps/web/app/api/integrations/[id]/sync/route.ts` (new)
- `apps/web/app/api/integrations/webhooks/route.ts` (new)
- `apps/web/components/integrations/IntegrationHub.tsx`

---

## 🎯 Initiative 3: Contract Editor Enhancement

### Current State
- `ContractEditor.tsx` uses `mockClauses`, `mockLibraryClauses`, `mockVariables`
- API exists at `/api/clauses` with Prisma integration
- Database has `Clause` model

### Implementation Tasks

```
Priority: HIGH | Effort: Medium | Impact: Critical
```

#### 3.1 Connect Clause Management
- [ ] Fetch clauses from `/api/clauses`
- [ ] Real-time clause updates
- [ ] Version history tracking
- [ ] Clause risk analysis integration

#### 3.2 Add Collaborative Features
- [ ] Real-time collaboration (WebSocket/Supabase Realtime)
- [ ] User presence indicators
- [ ] Comment system with threading
- [ ] Change tracking with diff view

#### 3.3 AI-Powered Features
- [ ] Connect to `/api/ai/analyze` for clause risk assessment
- [ ] AI suggestions for clause improvements
- [ ] Automated compliance checking

#### 3.4 Files to Modify
- `apps/web/components/contract-generation/ContractEditor.tsx`
- `apps/web/app/api/clauses/route.ts` (enhance)
- `apps/web/app/api/clauses/[id]/route.ts` (enhance)

---

## 🎯 Initiative 4: Workflow Builder Enhancement

### Current State
- `WorkflowBuilder.tsx` uses `mockWorkflows`
- API exists at `/api/workflows` with Prisma integration
- Database has `ApprovalWorkflow` model

### Implementation Tasks

```
Priority: MEDIUM | Effort: Medium | Impact: High
```

#### 4.1 Connect to Real API
- [ ] Fetch workflows from `/api/workflows`
- [ ] CRUD operations for workflows
- [ ] Workflow execution tracking

#### 4.2 Enhanced Features
- [ ] Visual workflow designer with drag-drop
- [ ] Conditional logic builder
- [ ] Workflow templates
- [ ] Execution history and analytics

#### 4.3 Files to Modify
- `apps/web/components/contract-generation/WorkflowBuilder.tsx`
- Workflow API routes (already exist)

---

## 🎯 Initiative 5: Smart Drafting Canvas Enhancement

### Current State
- `SmartDraftingCanvas.tsx` uses:
  - `mockCollaborators`
  - `mockComments`
  - `mockSuggestions`
  - `mockVersions`

### Implementation Tasks

```
Priority: MEDIUM | Effort: High | Impact: High
```

#### 5.1 Create Collaboration Models
```prisma
model DraftCollaborator {
  id        String   @id @default(cuid())
  draftId   String
  userId    String
  role      String   // owner, editor, reviewer, viewer
  color     String
  isActive  Boolean  @default(true)
  lastSeenAt DateTime?
  createdAt DateTime @default(now())
  
  @@unique([draftId, userId])
  @@index([draftId])
}

model DraftComment {
  id        String   @id @default(cuid())
  draftId   String
  userId    String
  content   String   @db.Text
  position  Json?    // { start, end } for inline comments
  resolved  Boolean  @default(false)
  parentId  String?  // For threaded replies
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  parent    DraftComment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies   DraftComment[] @relation("CommentReplies")
  
  @@index([draftId])
}

model DraftVersion {
  id          String   @id @default(cuid())
  draftId     String
  version     Int
  content     Json
  changeType  String   // major, minor, revision
  description String?
  createdBy   String
  createdAt   DateTime @default(now())
  
  @@unique([draftId, version])
  @@index([draftId])
}

model AISuggestion {
  id          String   @id @default(cuid())
  draftId     String
  clauseId    String?
  type        String   // improvement, risk, compliance
  content     String   @db.Text
  severity    String   // info, warning, error
  status      String   // pending, accepted, dismissed
  createdAt   DateTime @default(now())
  
  @@index([draftId])
}
```

#### 5.2 Create API Endpoints
- [ ] `/api/drafts/[id]/collaborators`
- [ ] `/api/drafts/[id]/comments`
- [ ] `/api/drafts/[id]/versions`
- [ ] `/api/drafts/[id]/suggestions`

#### 5.3 Add Real-time Collaboration
- [ ] WebSocket or Server-Sent Events for live updates
- [ ] Cursor position sharing
- [ ] Conflict resolution

---

## 🎯 Initiative 6: Rate Card Components Enhancement

### Current State
- `ExtractFromContracts.tsx` uses `mockContracts`
- `RateCardDataRepository.tsx` uses `mockData`
- APIs exist at `/api/rate-cards`

### Implementation Tasks

```
Priority: HIGH | Effort: Low | Impact: High
```

#### 6.1 Connect to Existing APIs
- [ ] Use `/api/rate-cards` for data repository
- [ ] Use `/api/contracts` for extraction source
- [ ] Integrate with rate card ingestion pipeline

#### 6.2 Files to Modify
- `apps/web/components/rate-cards/ExtractFromContracts.tsx`
- `apps/web/components/rate-cards/RateCardDataRepository.tsx`

---

## 🎯 Initiative 7: Analytics & Forecasting Enhancement

### Current State
- `ForecastingDashboard.tsx` uses:
  - `mockForecastData`
  - `mockScenarios`
  - `mockOpportunities`
  - `mockSupplierSpend`

### Implementation Tasks

```
Priority: LOW | Effort: High | Impact: Medium
```

#### 7.1 Create Analytics API
- [ ] `/api/analytics/forecast` - ML-based predictions
- [ ] `/api/analytics/scenarios` - Cost scenarios
- [ ] `/api/analytics/opportunities` - Savings opportunities
- [ ] `/api/analytics/spend` - Supplier spend analysis

#### 7.2 Data Aggregation
- [ ] Create materialized views for performance
- [ ] Implement caching layer
- [ ] Schedule periodic recalculation

---

## 🎯 Initiative 8: Version Comparison Enhancement

### Current State
- `VersionComparison.tsx` uses `mockDifferences`
- No dedicated version comparison API

### Implementation Tasks

```
Priority: MEDIUM | Effort: Medium | Impact: Medium
```

#### 8.1 Create Diff API
- [ ] `/api/contracts/[id]/versions` - List versions
- [ ] `/api/contracts/[id]/diff` - Compare versions
- [ ] Store version metadata with diffs

---

## 🎯 Initiative 9: Signature Workflow Tracker

### Current State
- `SignatureWorkflowTracker.tsx` uses `mockWorkflows`
- Integration with DocuSign/Adobe Sign needed

### Implementation Tasks

```
Priority: MEDIUM | Effort: High | Impact: High
```

#### 9.1 Create Signature Models
```prisma
model SignatureRequest {
  id            String   @id @default(cuid())
  contractId    String
  provider      String   // docusign, adobe_sign
  externalId    String?  // Provider's envelope/agreement ID
  status        String   // draft, sent, delivered, signed, voided
  subject       String
  message       String?
  expiresAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  signers       Signer[]
  
  @@index([contractId])
}

model Signer {
  id          String   @id @default(cuid())
  requestId   String
  name        String
  email       String
  role        String
  order       Int
  status      String   // pending, sent, viewed, signed, declined
  signedAt    DateTime?
  createdAt   DateTime @default(now())
  
  request     SignatureRequest @relation(fields: [requestId], references: [id])
  
  @@index([requestId])
}
```

#### 9.2 Provider Integration
- [ ] DocuSign OAuth + API integration
- [ ] Adobe Sign integration
- [ ] Webhook handlers for status updates

---

## 📊 Implementation Roadmap

### Phase 1: Quick Wins (Week 1-2)
- [ ] Initiative 1: Template Manager (API exists)
- [ ] Initiative 6: Rate Card Components (API exists)
- [ ] Initiative 4: Workflow Builder (API exists)

### Phase 2: Core Features (Week 3-4)
- [ ] Initiative 3: Contract Editor clauses
- [ ] Initiative 8: Version Comparison
- [ ] Initiative 2: Integration Hub (schema + API)

### Phase 3: Advanced Features (Week 5-6)
- [ ] Initiative 5: Smart Drafting Canvas (collaboration)
- [ ] Initiative 9: Signature Workflow Tracker

### Phase 4: Analytics & AI (Week 7-8)
- [ ] Initiative 7: Forecasting Dashboard
- [ ] AI integration across all components

---

## 🔧 Technical Patterns to Apply

### 1. Data Fetching Pattern
```typescript
// Use SWR for data fetching with caching
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function useTemplates() {
  const { data, error, isLoading, mutate } = useSWR('/api/templates', fetcher);
  return {
    templates: data?.templates || [],
    isLoading,
    isError: error,
    refresh: mutate,
  };
}
```

### 2. Optimistic Updates
```typescript
async function deleteTemplate(id: string) {
  // Optimistically update UI
  mutate(
    '/api/templates',
    (current: any) => ({
      ...current,
      templates: current.templates.filter((t: any) => t.id !== id),
    }),
    false
  );
  
  // Actually delete
  await fetch(`/api/templates/${id}`, { method: 'DELETE' });
  
  // Revalidate
  mutate('/api/templates');
}
```

### 3. Error Handling with Fallback
```typescript
const { data } = useSWR('/api/templates', fetcher, {
  fallbackData: { templates: mockTemplates },
  onError: (error) => {
    console.error('Failed to fetch, using mock data:', error);
  },
});
```

### 4. DataMode Integration
```typescript
const { isMockData } = useDataMode();

useEffect(() => {
  if (isMockData) {
    setData(mockData);
  } else {
    fetchRealData();
  }
}, [isMockData]);
```

---

## 📋 Checklist Summary

| Initiative | Priority | Effort | Status |
|-----------|----------|--------|--------|
| 1. Template Manager | HIGH | Medium | Not Started |
| 2. Integration Hub | MEDIUM | High | Not Started |
| 3. Contract Editor | HIGH | Medium | Not Started |
| 4. Workflow Builder | MEDIUM | Medium | Not Started |
| 5. Smart Drafting Canvas | MEDIUM | High | Not Started |
| 6. Rate Card Components | HIGH | Low | Not Started |
| 7. Forecasting Dashboard | LOW | High | Not Started |
| 8. Version Comparison | MEDIUM | Medium | Not Started |
| 9. Signature Workflow | MEDIUM | High | Not Started |

---

## 🚀 Next Steps

1. **Start with Phase 1** - Connect existing APIs to components
2. **Add SWR/React Query** - For proper data fetching
3. **Implement useDataMode** - Consistent mock/real toggle
4. **Create missing schemas** - Prisma migrations
5. **Build missing APIs** - Following existing patterns

Would you like me to start implementing any of these initiatives?

