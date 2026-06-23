# Tagging & Grouping System Architecture

## Current System Overview

### 1. **Tagging System (Simple Key-Value)**

Current implementation: Basic tagging with fixed color mapping.

```typescript
// apps/web/lib/contracts/tags.ts
interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

const DEFAULT_TAGS = [
  { id: 'urgent', name: 'Urgent', color: 'red' },
  { id: 'review', name: 'Review', color: 'yellow' },
  { id: 'approved', name: 'Approved', color: 'green' },
  { id: 'archived', name: 'Archived', color: 'gray' },
  { id: 'renewal', name: 'Renewal', color: 'blue' },
  { id: 'high-value', name: 'High Value', color: 'purple' },
  { id: 'expiring-soon', name: 'Expiring Soon', color: 'orange' },
  { id: 'favorite', name: 'Favorite', color: 'pink' },
];

// Storage: localStorage (client-side only, not synced to server!)
localStorage.setItem('contract-tags', JSON.stringify(tags));
```

**Problems:**
- ❌ Only stored locally (no persistence)
- ❌ Fixed set of tags (can't create custom tags)
- ❌ No tenant-scoped tags
- ❌ No tag hierarchies or relationships
- ❌ No tag analytics or usage stats

### 2. **Taxonomy System (Hierarchical Classification)**

Better organized: Multi-level categorization.

```typescript
// data-orchestration/types
interface ContractTaxonomy {
  contract_categories: Array<{
    id: ContractCategoryId;
    label: string;
    description: string;
    subtypes: string[];      // L2 subcategories
    aliases: string[];       // Alt names
    default_role: DocumentRoleId;
  }>;
  
  document_roles: Array<{
    id: DocumentRoleId;
    label: string;
    description: string;
  }>;
  
  pricing_models: PricingModel[];
  delivery_models: DeliveryModel[];
  data_profiles: DataProfile[];
  risk_flags: RiskFlag[];
}

// Example categories:
// - SUPPLIER (subtypes: Supply, Services, Staffing)
// - MSA
// - SOW
// - NDA
// - EMPLOYMENT
// - etc.
```

**Schema storage:**
```typescript
// Contract model
contractCategoryId: string;     // L1 category (from taxonomy)
categoryL1: string;            // Denormalized display name
categoryL2: string;            // L2 subtype
contractSubtype: string;       // Additional subtype
documentRole: string;          // Document role (Statement, Amendment, etc.)

pricingModels: Json?;          // Array of pricing model tags
deliveryModels: Json?;         // Array of delivery model tags
dataProfiles: Json?;           // Array of data profile tags
riskFlags: Json?;              // Array of risk flag tags
tags: Json?;                   // Freeform user tags (also in ContractMetadata)
```

**Benefits:**
- ✅ Structured hierarchy (L1 → L2 → metadata)
- ✅ Standardized dimensions (pricing, delivery, risk, data)
- ✅ Server-persisted via Prisma
- ✅ Tenant-scoped

**Problems:**
- ❌ Can't create custom taxonomy entries at runtime
- ❌ No intelligent auto-grouping
- ❌ No tags recommendations
- ❌ Tags split across Contract + ContractMetadata (dual-write drift)
- ❌ No tag search/filter performance optimization

### 3. **Metadata Tags (Separate From Contracts)**

```typescript
// ContractMetadata model
model ContractMetadata {
  id: String @id
  contractId: String @unique
  tenantId: String
  
  tags: Json?                  // Array of tag strings
  customFields: Json?          // Arbitrary metadata
  lastUpdated: DateTime
  updatedBy: String?
}
```

**Problem**: Tags stored in TWO places:
1. `Contract.tags` (scalar JSON array)
2. `ContractMetadata.tags` (separate table)

This causes **dual-write drift** — they can get out of sync!

### 4. **Grouping via Queries**

No explicit grouping system; grouping is query-based:

```typescript
// Group by contract type
contracts.groupBy(c => c.contractType)

// Group by category (L1)
contracts.groupBy(c => c.contractCategoryId)

// Group by tag
contracts.groupBy(c => c.tags)

// Group by date
contracts.groupBy(c => c.startDate)
```

**Problems:**
- ❌ No saved/named groups
- ❌ No group-level permissions
- ❌ No smart grouping based on semantics
- ❌ No group analytics

---

## 🚨 Identified Issues

| Issue | Severity | Impact | Example |
|-------|----------|--------|---------|
| Tags not persisted to server | CRITICAL | User creates tags locally, loses them on refresh | Tags lost on page reload |
| Tags split across two tables | HIGH | Dual-write drift, confusion | Update Contract.tags but ContractMetadata.tags stale |
| No custom taxonomy at runtime | MEDIUM | Can't add new categories without code | User can't create "Strategic Partnership" category |
| No tag hierarchy | MEDIUM | Flat structure, hard to organize | Can't have "Review" > "Legal Review", "Finance Review" |
| No bulk tagging rules | MEDIUM | Manual tagging tedious | Must manually tag 50 contracts as "Renewal" |
| No tag recommendations | MEDIUM | Users don't know which tags fit | Missing obvious tags |
| No tag analytics | LOW | Can't see tag usage patterns | Can't identify most common tag combinations |

---

## ✅ Recommended Improvements

### Priority 1: Fix Dual-Write Drift & Persist Tags

**Issue 1.1: Consolidate Tag Storage**

Eliminate split storage:

```typescript
// Remove: tags from Contract (scalar)
// Single source of truth: ContractMetadata.tags

// API endpoint to update tags
PUT /api/contracts/[id]/metadata
{
  "tags": ["urgent", "renewal", "strategic-partner"],
  "metadataVersion": 2
}

// Response includes updated ContractMetadata
{
  "tags": ["urgent", "renewal", "strategic-partner"],
  "updatedAt": "2026-06-22T...",
}

// Side effect: applyContractChangeSideEffects automatically syncs
// Contract.tags = ContractMetadata.tags (for backward compatibility)
```

**Implementation:**
1. Add migration to sync Contract.tags ← ContractMetadata.tags
2. Update metadata PUT endpoint to validate tag existence
3. Remove direct Contract.tags updates elsewhere
4. Update chatbot context to read from ContractMetadata.tags only
5. Index on ContractMetadata.tags for search performance

Benefits:
- ✅ Single source of truth
- ✅ No more drift
- ✅ Consistent with new optimistic locking
- ✅ Enables tag history tracking

### Priority 2: Tenant-Scoped Custom Tags

**Issue 2.1: Allow Runtime Tag Creation**

```typescript
// New model: TenantTag
model TenantTag {
  id: String @id
  tenantId: String
  name: String              // "Strategic Partner"
  slug: String              // "strategic-partner"
  description: String?
  color: String             // Hex color
  category: String?         // Optional: "relationship", "status", "priority"
  isSystem: Boolean         // false = user-created
  usageCount: Int
  createdAt: DateTime
  updatedAt: DateTime
  
  @@unique([tenantId, slug])
  @@index([tenantId])
}

// API: Create custom tag
POST /api/tags
{
  "name": "Strategic Partner",
  "color": "#8B5CF6",
  "description": "Key partner for long-term growth",
  "category": "relationship"
}

// Response
{
  "id": "tag_xyz",
  "slug": "strategic-partner",
  "name": "Strategic Partner",
  "color": "#8B5CF6",
  "createdAt": "2026-06-22T..."
}

// API: Apply tag to contract
PUT /api/contracts/[id]/metadata
{
  "tags": ["urgent", "strategic-partner"],  // Mix system + custom
}

// Validation: Check TenantTag exists before applying
```

**Implementation:**
1. Create `TenantTag` model
2. Seed system tags (urgent, review, etc.) as system=true
3. Add tag management endpoint (CRUD)
4. Add tag validation in metadata PUT
5. Add tag usage analytics job
6. Frontend: Tag selector with system + custom tabs

Benefits:
- ✅ Flexible, tenant-specific tagging
- ✅ User-driven tag creation
- ✅ Track tag usage & popularity
- ✅ Support tag lifecycle (deprecated, archived)

### Priority 3: Tag Hierarchies & Relationships

**Issue 3.1: Multi-Level Tag Organization**

```typescript
// Extend TenantTag
model TenantTag {
  id: String @id
  tenantId: String
  name: String
  slug: String
  color: String
  category: String?         // "status", "priority", "relationship", "risk"
  
  // NEW: Hierarchy support
  parentTagId: String?      // For subtags
  parentTag: TenantTag? @relation("TagHierarchy", fields: [parentTagId], references: [id])
  subtags: TenantTag[] @relation("TagHierarchy")
  
  // NEW: Relationships
  relatedTagIds: String[]   // Related tags (e.g., "urgent" → "high-priority")
  
  @@index([parentTagId])
}

// Example hierarchy:
// status (parent)
//  ├─ active
//  ├─ expiring-soon
//  ├─ expired
//  └─ draft
// 
// priority (parent)
//  ├─ critical
//  ├─ high
//  ├─ medium
//  └─ low

// UI: Collapsible tag groups
<TagSelector>
  <TagGroup label="Status">
    <Tag label="Active" />
    <Tag label="Expiring Soon" />
    <Tag label="Expired" />
  </TagGroup>
  <TagGroup label="Priority">
    <Tag label="Critical" />
    <Tag label="High" />
  </TagGroup>
</TagSelector>

// Query: Find all "active" + subtags
const activeAndSubs = await findTagWithDescendants('active', tenantId);
const contracts = await Contract.find({ tags: { $in: [activeAndSubs] } });
```

Benefits:
- ✅ Better organization (50+ tags don't become chaos)
- ✅ Logical grouping
- ✅ UI-friendly collapsible sections
- ✅ Query optimization (find parent = find all subtags)

### Priority 4: Intelligent Tag Recommendations

**Issue 4.1: AI-Suggested Tags**

```typescript
// New API endpoint
POST /api/contracts/[id]/suggest-tags
{
  "field": "document_text" | "metadata" | "category"
}

// Response with suggestions
{
  "suggestions": [
    {
      "tag": "strategic-partner",
      "confidence": 0.92,
      "reason": "Identified as key strategic partner in parties"
    },
    {
      "tag": "high-value",
      "confidence": 0.87,
      "reason": "Total contract value >$1M"
    },
    {
      "tag": "renewal",
      "confidence": 0.65,
      "reason": "Has auto-renewal clause (60% confidence)"
    }
  ]
}

// Implementation:
async function suggestTags(
  contractId: string,
  tenantId: string
): Promise<Array<{ tag: string; confidence: number; reason: string }>> {
  const contract = await getContract(contractId, tenantId);
  const aiMeta = contract.aiMetadata;
  const suggestions = [];

  // Rule 1: High-value contracts
  if (aiMeta.tcv_amount > 1_000_000) {
    suggestions.push({
      tag: 'high-value',
      confidence: 0.95,
      reason: `Total value ${aiMeta.tcv_amount}`,
    });
  }

  // Rule 2: Expiring soon
  if (contract.expirationDate && isExpiringSoon(contract.expirationDate)) {
    suggestions.push({
      tag: 'expiring-soon',
      confidence: 0.98,
      reason: `Expires on ${contract.expirationDate}`,
    });
  }

  // Rule 3: Strategic parties (from a predefined list)
  const isStrategic = STRATEGIC_PARTNERS.some(name =>
    aiMeta.external_parties?.some((p: any) =>
      p.legalName?.toLowerCase().includes(name.toLowerCase())
    )
  );
  if (isStrategic) {
    suggestions.push({
      tag: 'strategic-partner',
      confidence: 0.85,
      reason: 'Identified strategic partner in parties',
    });
  }

  // Rule 4: Auto-renewal
  if (aiMeta.renewal?.autoRenewal) {
    suggestions.push({
      tag: 'auto-renewal',
      confidence: 0.90,
      reason: 'Auto-renewal clause detected',
    });
  }

  // Rule 5: AI-based semantic matching
  const semanticMatches = await matchSemanticTags(
    contract.rawText,
    await getAllTags(tenantId)
  );
  suggestions.push(...semanticMatches);

  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);  // Top 5
}

// Semantic matching using embedding similarity
async function matchSemanticTags(
  contractText: string,
  tags: TenantTag[]
): Promise<Array<{ tag: string; confidence: number; reason: string }>> {
  // 1. Generate embedding for contract
  const contractEmbedding = await generateEmbedding(contractText);

  // 2. Generate embedding for each tag (cached)
  const tagEmbeddings = await Promise.all(
    tags.map(tag => generateEmbedding(tag.name + ' ' + tag.description))
  );

  // 3. Calculate similarity scores
  const similarities = tagEmbeddings.map((emb, i) => ({
    tag: tags[i].slug,
    similarity: cosineSimilarity(contractEmbedding, emb),
  }));

  // 4. Return top matches above threshold (0.75)
  return similarities
    .filter(s => s.similarity > 0.75)
    .sort((a, b) => b.similarity - a.similarity)
    .map(s => ({
      tag: s.tag,
      confidence: s.similarity,
      reason: 'Semantic match based on contract content',
    }));
}
```

Benefits:
- ✅ Faster tagging process
- ✅ Consistent tag application
- ✅ Discovers non-obvious tags
- ✅ Learns from user corrections

### Priority 5: Bulk Tagging Rules & Automation

**Issue 5.1: Tag Automation Rules**

```typescript
// New model: TagRule
model TagRule {
  id: String @id
  tenantId: String
  name: String              // "Auto-tag high-value renewals"
  description: String?
  
  trigger: String           // "contract_updated"
  condition: Json           // Rule conditions
  action: Json              // Action to take
  
  enabled: Boolean
  createdAt: DateTime
  updatedAt: DateTime
  
  @@index([tenantId])
}

// Example rule JSON
{
  "trigger": "contract_updated",
  "condition": {
    "totalValue": { "$gte": 1_000_000 },
    "renewalStatus": { "$in": ["UPCOMING", "INITIATED"] },
    "tags": { "$nin": ["high-value"] }  // Only if not already tagged
  },
  "action": {
    "addTags": ["high-value", "strategic-renewal"],
    "setCustomField": { "attention_level": "HIGH" }
  }
}

// Another example: Alert on contract aging
{
  "trigger": "daily",
  "condition": {
    "createdAt": { "$lt": "90 days ago" },
    "status": { "$eq": "DRAFT" }
  },
  "action": {
    "addTags": ["stale-draft"],
    "notifyOwner": true,
    "notificationMessage": "This draft has been pending for 90+ days"
  }
}

// API: Create rule
POST /api/tag-rules
{
  "name": "Auto-tag expiring contracts",
  "trigger": "daily",
  "condition": { ... },
  "action": { ... }
}

// Background job: Execute rules
async function executeTagRules(tenantId: string) {
  const rules = await prisma.tagRule.findMany({
    where: { tenantId, enabled: true }
  });

  for (const rule of rules) {
    const matchingContracts = await evaluateCondition(rule.condition, tenantId);
    for (const contract of matchingContracts) {
      await applyAction(contract, rule.action);
    }
  }
}
```

Benefits:
- ✅ Automated tag application
- ✅ Consistent workflow
- ✅ Saves manual effort
- ✅ Repeatable rules

### Priority 6: Named Groups & Collections

**Issue 6.1: Explicit Contract Groups**

```typescript
// New model: ContractGroup
model ContractGroup {
  id: String @id
  tenantId: String
  name: String              // "Q1 Renewals"
  description: String?
  color: String?
  
  // How to define the group
  groupType: "static" | "smart";  // Static = manual list, Smart = query-based
  
  // For static groups:
  contractIds: String[]     // Explicit list
  
  // For smart groups:
  query: Json              // Filter conditions
  
  // For tag-based groups:
  requireAllTags: String[];
  requireAnyTags: String[];
  
  // Metadata
  contractCount: Int       // Cached count
  createdAt: DateTime
  updatedAt: DateTime
  
  @@index([tenantId])
  @@index([groupType])
}

// Example static group
{
  "name": "Q1 2025 Renewals",
  "groupType": "static",
  "contractIds": [
    "ctr_001", "ctr_002", "ctr_003"
  ]
}

// Example smart group
{
  "name": "High-Value Strategic Contracts",
  "groupType": "smart",
  "query": {
    "totalValue": { "$gte": 1_000_000 },
    "tags": { "$in": ["strategic-partner"] },
    "status": { "$eq": "ACTIVE" }
  }
}

// API: Create group
POST /api/contract-groups
{
  "name": "Legal Review Needed",
  "groupType": "static",
  "contractIds": ["ctr_001", "ctr_002"]
}

// API: List contracts in group (with smart group auto-evaluation)
GET /api/contract-groups/[id]/contracts
// Response: Dynamically filters if smart group

// Frontend: Group dashboard
<GroupDashboard>
  <GroupCard
    name="Q1 Renewals"
    count={15}
    contracts={[...]}
    actions={[
      { label: "Mass assign to team", action: bulkAssign },
      { label: "Export", action: export },
      { label: "Archive old ones", action: archiveOld }
    ]}
  />
</GroupDashboard>
```

Benefits:
- ✅ Named, reusable groups
- ✅ Both manual & dynamic
- ✅ Group-level actions
- ✅ Dashboard-friendly

### Priority 7: Tag Analytics & Insights

**Issue 7.1: Tag Usage Analytics**

```typescript
// Background job: Aggregate tag stats
async function aggregateTagStats(tenantId: string) {
  const stats = await prisma.contract.groupBy({
    by: ['tags'],
    where: { tenantId },
    _count: { tags: true },
  });

  // Store in new model
  await prisma.tagStats.upsert({
    where: { tenantId },
    update: {
      monthlyStats: {
        ...previousStats,
        [currentMonth]: {
          tagCounts: stats,
          topTags: stats.slice(0, 10),
          tagCombinations: getPopularCombinations(stats),
        }
      }
    },
    create: {
      tenantId,
      monthlyStats: { ... }
    }
  });
}

// API: Tag insights dashboard
GET /api/tags/analytics?period=month
{
  "topTags": [
    { "tag": "urgent", "count": 47, "percentage": 35 },
    { "tag": "renewal", "count": 38, "percentage": 28 },
    { "tag": "high-value", "count": 31, "percentage": 23 }
  ],
  "tagCombinations": [
    { "tags": ["urgent", "renewal"], "count": 12, "percentage": 9 },
    { "tags": ["high-value", "strategic-partner"], "count": 8, "percentage": 6 }
  ],
  "trends": {
    "urgent": { "thisMonth": 47, "lastMonth": 42, "change": "+12%" },
    "expiring-soon": { "thisMonth": 23, "lastMonth": 31, "change": "-26%" }
  }
}

// Dashboard component
<TagAnalytics>
  <Chart type="bar" data={topTags} title="Most Used Tags" />
  <Chart type="sankey" data={tagCombinations} title="Tag Relationships" />
  <TrendTable data={trends} title="Tag Trends" />
</TagAnalytics>
```

Benefits:
- ✅ See which tags matter
- ✅ Identify tag overuse/underuse
- ✅ Optimize tag system
- ✅ Discover patterns

---

## Implementation Roadmap

| Priority | Feature | Effort | Benefit | Timeline |
|----------|---------|--------|---------|----------|
| **1** | Consolidate tag storage | 1w | HIGH - fix drift | Week 1 |
| **1** | Persist tags to server | 1w | HIGH - tags don't get lost | Week 1 |
| **2** | Custom tenant tags | 1.5w | HIGH - flexibility | Week 2-3 |
| **3** | Tag hierarchies | 1w | MEDIUM - organization | Week 3 |
| **4** | Tag recommendations | 1.5w | MEDIUM - faster tagging | Week 4 |
| **5** | Bulk tagging rules | 1.5w | MEDIUM - automation | Week 4-5 |
| **6** | Named contract groups | 1w | MEDIUM - navigation | Week 5 |
| **7** | Tag analytics | 1w | LOW - insights | Week 6 |

---

## Success Metrics

- ✅ **Tag Persistence**: 0 lost tags on refresh
- ✅ **Custom Tags**: 80%+ of tenants create 3+ custom tags within 30 days
- ✅ **Tag Application**: 95% of contracts have 2+ tags within 7 days
- ✅ **Rule Automation**: 70%+ of tags applied via automation rules
- ✅ **Tag Accuracy**: <5% of automatically applied tags require correction
- ✅ **Group Usage**: 50%+ of users create 1+ groups for their workflows
- ✅ **Data Quality**: No more Contract.tags ↔ ContractMetadata.tags drift

---

## Architecture Diagrams

### Current (Broken)
```
User creates tag
    ↓
localStorage.setItem('tags')
    ↓
[Lost on refresh]    ← ❌ Problem
```

### Improved (Proposed)
```
User creates tag
    ↓
POST /api/tags
    ↓
TenantTag table
    ↓
Apply to contract
    ↓
PUT /api/contracts/[id]/metadata
    ↓
ContractMetadata.tags (single source of truth)
    ↓
Contract.tags (denormalized, synced by side effects)
    ↓
✅ Persisted, consistent, versioned
```

### Smart Grouping
```
Contracts
    ↓
ContractGroup (static or smart)
    ↓
[Static] → Manual contractIds list
[Smart]  → Dynamic query evaluation
    ↓
UI: Filter, bulk actions, export
```
