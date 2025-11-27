# Contract Intelligence Platform - Innovation Roadmap

## Executive Summary

Transform from a **Contract Analysis Tool** → **Intelligent CLM + S2P Orchestration Hub**

This roadmap implements features from the Core Innovation Catalogue (13.1) and Moonshot Features (14.1) in a phased, value-driven approach.

---

## Current State Assessment

### What We Have ✅
- Contract upload & OCR processing
- AI-powered extraction & analysis
- Rate card management & benchmarking
- Dashboard with KPIs & analytics
- Real-time processing pipeline
- Multi-tenant architecture

### What We're Building 🚀
- Contract Generation & Authoring
- Workflow Orchestration Engine
- Supplier Collaboration Portal
- Predictive Intelligence Layer
- S2P Integration Hub

---

## Phase Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PHASE 1: FOUNDATION                                 │
│  Contract Generation • Template Engine • Basic Workflows • Approval Routes  │
├─────────────────────────────────────────────────────────────────────────────┤
│                          PHASE 2: INTELLIGENCE                               │
│  Knowledge Graph • Health Scores • Negotiation Co-Pilot • RAG Search        │
├─────────────────────────────────────────────────────────────────────────────┤
│                          PHASE 3: COLLABORATION                              │
│  Supplier Portal • Smart Drafting Canvas • Multi-Party Editing              │
├─────────────────────────────────────────────────────────────────────────────┤
│                          PHASE 4: ORCHESTRATION                              │
│  Autonomous Workflows • S2P Hub • Execution Coordination                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                          PHASE 5: PREDICTION                                 │
│  Renewal Forecasting • Scenario Modeling • Opportunity Discovery            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (Weeks 1-4)
### "Enable Contract Creation & Basic Workflow"

### 1.1 Contract Generation Module

**Goal**: Transform from read-only analysis to full authoring capability

```
/contracts/new           → Contract creation wizard
/contracts/[id]/edit     → Contract editor with AI assistance
/templates               → Template library management
/templates/[id]/builder  → Visual template builder
```

**Components**:
| Component | Purpose |
|-----------|---------|
| `ContractWizard` | Step-by-step contract creation flow |
| `ClauseLibrary` | Reusable clause bank with categorization |
| `TemplateBuilder` | Visual drag-drop template designer |
| `ContractEditor` | Rich text editor with AI suggestions |
| `VariableManager` | Dynamic field placeholders & autofill |

**Database Schema Additions**:
```prisma
model ContractDraft {
  id              String   @id @default(cuid())
  tenantId        String
  title           String
  templateId      String?
  template        Template? @relation(fields: [templateId], references: [id])
  content         Json     // Rich text content with variables
  variables       Json     // Variable values
  status          DraftStatus @default(DRAFT)
  version         Int      @default(1)
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relationships
  clauses         DraftClause[]
  approvals       Approval[]
  collaborators   Collaborator[]
}

model Clause {
  id              String   @id @default(cuid())
  tenantId        String
  name            String
  category        String   // e.g., "Liability", "Termination", "Payment"
  content         String   @db.Text
  riskLevel       RiskLevel @default(LOW)
  isStandard      Boolean  @default(true)
  alternatives    Json?    // Alternative clause versions
  guidance        String?  // Usage guidance
  tags            String[]
  usageCount      Int      @default(0)
  createdAt       DateTime @default(now())
}

model Template {
  id              String   @id @default(cuid())
  tenantId        String
  name            String
  description     String?
  category        String   // MSA, SOW, NDA, Amendment, etc.
  content         Json     // Template structure with placeholders
  variables       Json     // Variable definitions
  clauses         String[] // Default clause IDs
  isActive        Boolean  @default(true)
  version         Int      @default(1)
  createdAt       DateTime @default(now())
  
  drafts          ContractDraft[]
}

enum DraftStatus {
  DRAFT
  IN_REVIEW
  PENDING_APPROVAL
  APPROVED
  REJECTED
  EXECUTED
  ARCHIVED
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### 1.2 Basic Workflow Engine

**Goal**: Enable approval routing and task management

```
/workflows               → Workflow dashboard
/workflows/[id]          → Workflow detail & progress
/approvals               → My pending approvals
```

**Components**:
| Component | Purpose |
|-----------|---------|
| `WorkflowDesigner` | Visual workflow builder |
| `ApprovalQueue` | Pending approvals list |
| `TaskManager` | Task assignment & tracking |
| `WorkflowTimeline` | Visual progress indicator |

**Database Schema**:
```prisma
model Workflow {
  id              String   @id @default(cuid())
  tenantId        String
  name            String
  description     String?
  triggerType     TriggerType
  triggerConfig   Json     // Conditions for auto-trigger
  steps           WorkflowStep[]
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
}

model WorkflowStep {
  id              String   @id @default(cuid())
  workflowId      String
  workflow        Workflow @relation(fields: [workflowId], references: [id])
  order           Int
  type            StepType
  config          Json     // Step-specific configuration
  assigneeType    AssigneeType
  assigneeId      String?  // User or role ID
  dueInDays       Int?
  conditions      Json?    // Conditional logic
}

model WorkflowInstance {
  id              String   @id @default(cuid())
  workflowId      String
  entityType      String   // "contract", "draft", "renewal"
  entityId        String
  currentStep     Int      @default(0)
  status          InstanceStatus
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  
  stepResults     StepResult[]
}

model Approval {
  id              String   @id @default(cuid())
  instanceId      String
  stepId          String
  approverId      String
  status          ApprovalStatus @default(PENDING)
  comments        String?
  decidedAt       DateTime?
  dueDate         DateTime?
  createdAt       DateTime @default(now())
}

enum TriggerType {
  MANUAL
  CONTRACT_CREATED
  CONTRACT_VALUE_THRESHOLD
  RENEWAL_APPROACHING
  RISK_SCORE_HIGH
  CLAUSE_DEVIATION
}

enum StepType {
  APPROVAL
  REVIEW
  TASK
  NOTIFICATION
  CONDITIONAL
  PARALLEL
  INTEGRATION
}

enum AssigneeType {
  USER
  ROLE
  MANAGER
  DYNAMIC
}

enum InstanceStatus {
  ACTIVE
  COMPLETED
  CANCELLED
  PAUSED
  FAILED
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  DELEGATED
  EXPIRED
}
```

### 1.3 Renewal & Amendment Triggers

**Goal**: Auto-generate renewal contracts and amendments from existing contracts

**API Endpoints**:
```
POST /api/contracts/[id]/renew          → Create renewal draft
POST /api/contracts/[id]/amend          → Create amendment draft
POST /api/contracts/[id]/terminate      → Initiate termination workflow
GET  /api/renewals/upcoming             → Get contracts due for renewal
POST /api/renewals/bulk-initiate        → Batch renewal initiation
```

**Components**:
| Component | Purpose |
|-----------|---------|
| `RenewalManager` | Renewal tracking & initiation |
| `AmendmentWizard` | Guided amendment creation |
| `ContractCloner` | Smart contract duplication |
| `ChangeTracker` | Track changes between versions |

---

## Phase 2: Intelligence (Weeks 5-8)
### "Add AI-Powered Insights & Search"

### 2.1 Contract Knowledge Graph (CKG)

**Goal**: Map relationships between contracts, clauses, suppliers, and risks

```
/intelligence/graph      → Visual knowledge graph explorer
/intelligence/impact     → Impact analysis tool
/intelligence/patterns   → Pattern discovery dashboard
```

**Database Schema**:
```prisma
model ContractNode {
  id              String   @id @default(cuid())
  tenantId        String
  entityType      NodeType
  entityId        String
  metadata        Json
  embedding       Float[]  @db.Vector(1536) // For semantic search
  createdAt       DateTime @default(now())
  
  outgoingEdges   GraphEdge[] @relation("source")
  incomingEdges   GraphEdge[] @relation("target")
}

model GraphEdge {
  id              String   @id @default(cuid())
  sourceId        String
  source          ContractNode @relation("source", fields: [sourceId], references: [id])
  targetId        String
  target          ContractNode @relation("target", fields: [targetId], references: [id])
  relationship    EdgeType
  weight          Float    @default(1.0)
  metadata        Json?
  createdAt       DateTime @default(now())
}

enum NodeType {
  CONTRACT
  CLAUSE
  SUPPLIER
  OBLIGATION
  RISK
  RATE_CARD
  PROJECT
  USER
}

enum EdgeType {
  CONTAINS           // Contract → Clause
  REFERENCES         // Clause → Clause
  SUPERSEDES         // Contract → Contract
  AMENDS             // Amendment → Contract
  RELATES_TO         // Contract ↔ Contract
  HAS_SUPPLIER       // Contract → Supplier
  HAS_OBLIGATION     // Contract → Obligation
  HAS_RISK           // Contract → Risk
  USES_RATE_CARD     // Contract → Rate Card
  SIMILAR_TO         // Semantic similarity
}
```

### 2.2 Contract Lifecycle Health Score

**Goal**: Actionable health scoring per contract

**Scoring Factors**:
```typescript
interface HealthScore {
  overall: number;           // 0-100
  factors: {
    riskFlags: number;       // 0-25 points
    metadataComplete: number; // 0-20 points
    renewalStatus: number;   // 0-20 points
    obligationsMet: number;  // 0-20 points
    documentQuality: number; // 0-15 points
  };
  recommendations: Recommendation[];
  trend: 'improving' | 'stable' | 'declining';
}
```

### 2.3 Universal Contract RAG Search

**Goal**: Natural language search with evidence links

```
/search                  → Enhanced AI search
/search/ask              → Conversational search
```

**Features**:
- Query: "Show me all liability caps over $1M in IT contracts"
- Returns: Contracts with highlighted clauses + source links
- Follow-up: "How does this compare to industry standard?"

### 2.4 Negotiation Co-Pilot

**Goal**: Real-time redline analysis and playbook guidance

```
/contracts/[id]/negotiate    → Negotiation workspace
/playbooks                   → Playbook library
/playbooks/[id]/builder      → Playbook rule builder
```

**Components**:
| Component | Purpose |
|-----------|---------|
| `RedlineAnalyzer` | Parse and analyze supplier redlines |
| `PlaybookMatcher` | Match clauses to playbook positions |
| `DeviationAlert` | Flag departures from standards |
| `FallbackSuggestor` | Suggest alternative positions |
| `NegotiationChat` | AI assistant for negotiation strategy |

---

## Phase 3: Collaboration (Weeks 9-12)
### "Enable Multi-Party Contract Authoring"

### 3.1 Smart Drafting Canvas

**Goal**: Real-time collaborative editing with AI assistance

```
/canvas/[draftId]        → Collaborative drafting workspace
```

**Features**:
- Real-time multi-cursor editing (like Google Docs)
- AI suggestions as you type
- Clause risk highlighting
- In-line comments & threads
- Version comparison
- Role-based permissions (buyer edit, supplier comment)

**Technology**:
- Y.js for CRDT-based collaboration
- WebSocket for real-time sync
- TipTap/ProseMirror for rich text editing

### 3.2 Supplier Collaboration Portal

**Goal**: Secure external access for suppliers

```
/portal/[token]          → Supplier portal entry
/portal/contracts        → Supplier's contract view
/portal/negotiate/[id]   → Supplier negotiation interface
```

**Features**:
- Magic link authentication (no supplier account needed)
- Limited view of relevant contracts only
- Redline submission interface
- Document exchange
- Status tracking
- Secure messaging

**Database Schema**:
```prisma
model SupplierPortalSession {
  id              String   @id @default(cuid())
  tenantId        String
  supplierId      String
  supplierEmail   String
  token           String   @unique
  permissions     Json     // Contract IDs and permission levels
  expiresAt       DateTime
  createdAt       DateTime @default(now())
  lastAccessedAt  DateTime?
  
  activities      PortalActivity[]
}

model PortalActivity {
  id              String   @id @default(cuid())
  sessionId       String
  session         SupplierPortalSession @relation(fields: [sessionId], references: [id])
  action          String
  entityType      String
  entityId        String
  metadata        Json?
  createdAt       DateTime @default(now())
}
```

---

## Phase 4: Orchestration (Weeks 13-16)
### "Autonomous Workflow Engine & S2P Hub"

### 4.1 Autonomous Workflow Engine

**Goal**: AI-driven workflow recommendations and execution

**Features**:
- Auto-suggest approval routes based on:
  - Contract type
  - Contract value
  - Risk score
  - Historical patterns
  - Supplier history
- Dynamic task generation
- Deadline management with escalation
- SLA tracking

**AI Workflow Suggester**:
```typescript
interface WorkflowSuggestion {
  recommended: {
    workflow: Workflow;
    confidence: number;
    reasoning: string;
  };
  alternatives: {
    workflow: Workflow;
    difference: string;
  }[];
  riskFactors: string[];
  estimatedDuration: number; // days
}
```

### 4.2 Contract Execution Hub (S2P-Coordinated)

**Goal**: Connect contract creation to operational execution

```
/execution               → Execution dashboard
/execution/[id]          → Contract execution tracking
```

**Integrations**:
| System | Integration |
|--------|-------------|
| E-Signature | DocuSign, Adobe Sign API |
| Procurement | SAP Ariba, Coupa webhooks |
| Finance | Invoice matching, budget checks |
| Vendor Mgmt | Supplier onboarding triggers |
| ERP | PO generation, contract activation |

**Execution Flow**:
```
Contract Approved → E-Signature → Supplier Onboarding → PO Created → Contract Active
        ↓                ↓               ↓                 ↓              ↓
   [Workflow]      [DocuSign API]   [VMS Trigger]     [ERP API]    [Notification]
```

### 4.3 AI Guardrails & Governance Layer

**Goal**: Enterprise-grade AI controls

**Features**:
- Confidence scoring on all AI outputs
- Automatic redaction of sensitive data
- Role-based AI feature access
- Audit trail of AI decisions
- Human-in-the-loop for high-risk actions
- Citation requirements for AI suggestions

```prisma
model AIDecision {
  id              String   @id @default(cuid())
  tenantId        String
  userId          String
  feature         String   // "clause_suggestion", "risk_analysis", etc.
  input           Json
  output          Json
  confidence      Float
  citations       Json?    // Source references
  wasAccepted     Boolean?
  userFeedback    String?
  createdAt       DateTime @default(now())
}
```

---

## Phase 5: Prediction (Weeks 17-20)
### "Forward-Looking Intelligence"

### 5.1 Predictive Renewal & Cost Forecasting

**Goal**: Model future scenarios

```
/forecasting             → Forecasting dashboard
/forecasting/renewals    → Renewal cost projections
/forecasting/scenarios   → What-if analysis
```

**Features**:
- Renewal cost modeling with inflation
- Rate evolution predictions
- Budget impact projections
- Supplier behavior analysis
- Category trend analysis

**Prediction Engine**:
```typescript
interface RenewalForecast {
  contractId: string;
  currentValue: number;
  predictedValue: {
    low: number;
    expected: number;
    high: number;
  };
  factors: {
    inflation: number;
    marketTrend: number;
    supplierHistory: number;
    volumeChange: number;
  };
  recommendations: {
    action: 'renew' | 'renegotiate' | 'rebid' | 'terminate';
    reasoning: string;
    potentialSavings: number;
  };
  confidence: number;
}
```

### 5.2 Opportunity Discovery Engine

**Goal**: Proactive value identification

**Scans For**:
- Consolidation opportunities (similar contracts)
- Rate discrepancies across suppliers
- Unused contractual rights
- Volume discount thresholds
- Auto-renewal risks
- Benchmark deviations

### 5.3 Contract Simulation & Scenario Modeling

**Goal**: What-if analysis for strategic planning

```
/simulation              → Simulation workspace
/simulation/new          → Create scenario
/simulation/compare      → Compare scenarios
```

**Scenarios**:
- "What if we increase volume by 20%?"
- "What if we reduce notice period to 30 days?"
- "What if we cap liability at $500K?"
- "What if inflation hits 8%?"

---

## Technical Architecture

### New Modules Structure

```
apps/web/
├── app/
│   ├── contracts/
│   │   ├── new/                    # Contract creation wizard
│   │   ├── [id]/
│   │   │   ├── edit/               # Contract editor
│   │   │   ├── negotiate/          # Negotiation workspace
│   │   │   ├── execute/            # Execution tracking
│   │   │   └── simulate/           # What-if scenarios
│   ├── templates/
│   │   ├── page.tsx                # Template library
│   │   └── [id]/
│   │       ├── page.tsx            # Template detail
│   │       └── builder/            # Template designer
│   ├── workflows/
│   │   ├── page.tsx                # Workflow dashboard
│   │   ├── designer/               # Workflow builder
│   │   └── [id]/                   # Workflow detail
│   ├── approvals/
│   │   └── page.tsx                # My approvals queue
│   ├── intelligence/
│   │   ├── graph/                  # Knowledge graph
│   │   ├── patterns/               # Pattern discovery
│   │   └── health/                 # Health scores
│   ├── collaboration/
│   │   ├── canvas/[id]/            # Smart drafting
│   │   └── portal/                 # Supplier portal
│   ├── execution/
│   │   └── page.tsx                # S2P execution hub
│   └── forecasting/
│       ├── page.tsx                # Forecasting dashboard
│       ├── renewals/               # Renewal predictions
│       └── scenarios/              # Scenario modeling
│
├── components/
│   ├── contract-generation/
│   │   ├── ContractWizard.tsx
│   │   ├── ClauseLibrary.tsx
│   │   ├── VariableEditor.tsx
│   │   └── ContractEditor.tsx
│   ├── templates/
│   │   ├── TemplateBuilder.tsx
│   │   ├── TemplatePreview.tsx
│   │   └── ClauseSelector.tsx
│   ├── workflows/
│   │   ├── WorkflowDesigner.tsx
│   │   ├── WorkflowTimeline.tsx
│   │   ├── ApprovalCard.tsx
│   │   └── TaskManager.tsx
│   ├── collaboration/
│   │   ├── DraftingCanvas.tsx
│   │   ├── CollaboratorPresence.tsx
│   │   ├── CommentThread.tsx
│   │   └── VersionCompare.tsx
│   ├── intelligence/
│   │   ├── KnowledgeGraph.tsx
│   │   ├── HealthScoreCard.tsx
│   │   ├── PatternExplorer.tsx
│   │   └── NegotiationCoPilot.tsx
│   └── forecasting/
│       ├── RenewalForecast.tsx
│       ├── ScenarioBuilder.tsx
│       └── OpportunityCard.tsx
│
├── lib/
│   ├── contract-generation/
│   │   ├── template-engine.ts
│   │   ├── clause-processor.ts
│   │   └── variable-resolver.ts
│   ├── workflows/
│   │   ├── workflow-engine.ts
│   │   ├── approval-service.ts
│   │   └── task-scheduler.ts
│   ├── intelligence/
│   │   ├── knowledge-graph.ts
│   │   ├── health-scorer.ts
│   │   └── pattern-detector.ts
│   ├── collaboration/
│   │   ├── crdt-sync.ts
│   │   └── presence-manager.ts
│   └── forecasting/
│       ├── renewal-predictor.ts
│       ├── scenario-engine.ts
│       └── opportunity-scanner.ts
│
└── api/
    ├── contracts/
    │   ├── generate/
    │   ├── [id]/renew/
    │   ├── [id]/amend/
    │   └── [id]/execute/
    ├── templates/
    ├── workflows/
    ├── approvals/
    ├── intelligence/
    ├── collaboration/
    └── forecasting/
```

### API Route Structure

```
# Contract Generation
POST   /api/contracts/generate           # Generate from template
POST   /api/contracts/[id]/renew         # Create renewal
POST   /api/contracts/[id]/amend         # Create amendment
PUT    /api/contracts/[id]/draft         # Update draft
POST   /api/contracts/[id]/submit        # Submit for approval

# Templates
GET    /api/templates                    # List templates
POST   /api/templates                    # Create template
GET    /api/templates/[id]               # Get template
PUT    /api/templates/[id]               # Update template
POST   /api/templates/[id]/clone         # Clone template

# Clauses
GET    /api/clauses                      # List clauses
POST   /api/clauses                      # Create clause
GET    /api/clauses/[id]/alternatives    # Get alternatives
POST   /api/clauses/suggest              # AI suggest clause

# Workflows
GET    /api/workflows                    # List workflows
POST   /api/workflows                    # Create workflow
POST   /api/workflows/suggest            # AI suggest workflow
POST   /api/workflows/[id]/trigger       # Trigger workflow
GET    /api/workflows/instances          # List instances

# Approvals
GET    /api/approvals                    # My pending approvals
POST   /api/approvals/[id]/approve       # Approve
POST   /api/approvals/[id]/reject        # Reject
POST   /api/approvals/[id]/delegate      # Delegate

# Intelligence
GET    /api/intelligence/graph           # Get knowledge graph
POST   /api/intelligence/analyze         # Analyze relationships
GET    /api/intelligence/health/[id]     # Get health score
GET    /api/intelligence/patterns        # Discover patterns

# Collaboration
POST   /api/collaboration/session        # Create session
GET    /api/collaboration/[id]/sync      # Real-time sync (WS)
POST   /api/collaboration/portal/invite  # Invite supplier

# Forecasting
GET    /api/forecasting/renewals         # Renewal predictions
POST   /api/forecasting/scenario         # Run scenario
GET    /api/forecasting/opportunities    # Get opportunities
```

---

## Implementation Priority Matrix

| Feature | Business Value | Technical Complexity | Priority |
|---------|---------------|---------------------|----------|
| Contract Generation | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | P0 |
| Template Engine | ⭐⭐⭐⭐⭐ | ⭐⭐ | P0 |
| Basic Workflows | ⭐⭐⭐⭐ | ⭐⭐⭐ | P0 |
| Renewal Triggers | ⭐⭐⭐⭐⭐ | ⭐⭐ | P0 |
| Health Scores | ⭐⭐⭐⭐ | ⭐⭐ | P1 |
| RAG Search | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | P1 |
| Knowledge Graph | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | P1 |
| Negotiation Co-Pilot | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | P1 |
| Smart Drafting Canvas | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | P2 |
| Supplier Portal | ⭐⭐⭐⭐ | ⭐⭐⭐ | P2 |
| Autonomous Workflows | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | P2 |
| S2P Hub | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | P2 |
| Renewal Forecasting | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | P3 |
| Scenario Modeling | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | P3 |
| Opportunity Discovery | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | P3 |

---

## Success Metrics

### Phase 1
- [ ] 100+ contracts generated from templates
- [ ] 50+ workflows configured
- [ ] <24hr average approval time
- [ ] 90% renewal initiation rate (30 days before expiry)

### Phase 2
- [ ] 95% search relevance score
- [ ] Health score coverage for all contracts
- [ ] 50% reduction in negotiation cycles
- [ ] 100% playbook compliance visibility

### Phase 3
- [ ] 30% faster contract turnaround
- [ ] 50+ supplier portal sessions/month
- [ ] 80% reduction in email negotiation
- [ ] Real-time collaboration adoption

### Phase 4
- [ ] 75% workflow automation rate
- [ ] 100% S2P integration coverage
- [ ] <1hr contract-to-execution time
- [ ] 99% audit compliance

### Phase 5
- [ ] $500K+ identified savings opportunities
- [ ] 95% renewal cost prediction accuracy
- [ ] 30% budget variance reduction
- [ ] Proactive (not reactive) renewals

---

## Next Steps

### Immediate (This Week)
1. ✅ Create this roadmap document
2. 🔲 Set up Phase 1 database schema
3. 🔲 Create Contract Generation module structure
4. 🔲 Build Template Engine foundation
5. 🔲 Implement basic workflow engine

### Short-term (Next 2 Weeks)
1. 🔲 Contract Wizard UI
2. 🔲 Clause Library management
3. 🔲 Approval routing system
4. 🔲 Renewal trigger automation

---

## Questions to Resolve

1. **Integration priorities**: Which S2P systems to integrate first?
2. **Supplier portal auth**: Magic links vs. lightweight accounts?
3. **Workflow complexity**: How complex should initial workflows be?
4. **AI guardrails**: What confidence thresholds for auto-actions?
5. **Collaboration tech**: Y.js vs. Liveblocks vs. custom?

---

*Document Version: 1.0*
*Created: November 27, 2025*
*Last Updated: November 27, 2025*
