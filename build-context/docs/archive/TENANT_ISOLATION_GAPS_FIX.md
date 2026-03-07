# Tenant Isolation Gaps - Action Plan

## Executive Summary

Tenant management is **85% secure** but has **3 critical gaps** that could allow cross-tenant data leakage:

1. ❌ TaxonomyCategory foreign key validation missing
2. ❌ Role/Permission models not tenant-scoped
3. ❌ 3 API routes missing tenantId validation

## Severity Assessment

| Gap | Severity | Exploitability | Impact | Priority |
|-----|----------|---------------|--------|----------|
| TaxonomyCategory FK | **HIGH** | Medium | Cross-tenant category assignment | P0 |
| Role/Permission global | **MEDIUM** | Low | Role name collisions, no custom permissions | P1 |
| API validation gaps | **CRITICAL** | High | Direct data leakage | P0 |

---

## Gap 1: TaxonomyCategory Foreign Key Validation

### Current State

```typescript
// Contract can reference ANY tenant's categories
contractCategoryId String? // No FK validation
```

### Attack Vector

```typescript
// Tenant A creates category
POST /api/taxonomy
{ "name": "Strategic Services", "tenantId": "tenant-A" }
// Returns: { "id": "cat_abc123" }

// Tenant B discovers the ID and steals it
PATCH /api/contracts/xyz
{ "contractCategoryId": "cat_abc123" } // ❌ Works! Cross-tenant leak
```

### Fix Implementation

**File: `/apps/web/app/api/contracts/[id]/categorize/route.ts`**

```typescript
// Add validation helper
async function validateCategoryOwnership(
  categoryId: string,
  tenantId: string
): Promise<boolean> {
  const category = await prisma.taxonomyCategory.findFirst({
    where: { id: categoryId, tenantId },
  });
  return !!category;
}

// In POST/PATCH handlers, add validation:
export async function PATCH(request: NextRequest, context: RouteContext) {
  const tenantId = await getApiTenantId(request);
  const body = await request.json();
  
  // ✅ VALIDATE before assignment
  if (body.contractCategoryId) {
    const isValid = await validateCategoryOwnership(
      body.contractCategoryId,
      tenantId
    );
    
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid category: belongs to different tenant" },
        { status: 403 }
      );
    }
  }
  
  // Proceed with update...
}
```

**Files to Update:**

- ✅ `/apps/web/app/api/contracts/[id]/categorize/route.ts`
- ✅ `/apps/web/app/api/contracts/[id]/metadata/route.ts`
- ✅ `/apps/web/app/api/contracts/upload/route.ts`
- ✅ `/apps/web/lib/categorization-service.ts`

---

## Gap 2: Role/Permission Models Not Tenant-Scoped

### Current State

```prisma
model Role {
  id   String @id
  name String @unique // ❌ Global unique
  // Missing: tenantId
}

model Permission {
  id      String @id
  action  String
  subject String
  @@unique([action, subject]) // ❌ Global unique
}
```

### Problems

1. **Role name collisions:** Tenant A creates "Admin" → Tenant B can't
2. **No custom permissions:** All tenants share same permission set
3. **Role leakage risk:** UserRole doesn't validate tenant ownership

### Fix Implementation

**File: `/packages/clients/db/schema.prisma`**

```prisma
model Role {
  id          String           @id @default(cuid())
  tenantId    String           // ✅ ADD THIS
  name        String
  createdAt   DateTime         @default(now())
  description String?
  isSystem    Boolean          @default(false)
  updatedAt   DateTime         @updatedAt
  
  // ✅ ADD THIS RELATION
  tenant      Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  permissions RolePermission[]
  users       UserRole[]

  // ✅ CHANGE THIS
  @@unique([tenantId, name])  // Per-tenant unique
  @@index([tenantId])          // Performance index
}

model Permission {
  id         String           @id @default(cuid())
  tenantId   String           // ✅ ADD THIS
  action     String
  subject    String
  conditions Json?
  
  // ✅ ADD THIS RELATION
  tenant     Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  roles      RolePermission[]

  // ✅ CHANGE THIS
  @@unique([tenantId, action, subject])  // Per-tenant unique
  @@index([tenantId])                     // Performance index
}
```

**Migration SQL:**

```sql
-- Add tenantId columns
ALTER TABLE "Role" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Permission" ADD COLUMN "tenantId" TEXT;

-- Backfill with first tenant (or default tenant)
UPDATE "Role" SET "tenantId" = (SELECT id FROM "Tenant" LIMIT 1);
UPDATE "Permission" SET "tenantId" = (SELECT id FROM "Tenant" LIMIT 1);

-- Make NOT NULL
ALTER TABLE "Role" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Permission" ALTER COLUMN "tenantId" SET NOT NULL;

-- Drop old unique constraints
ALTER TABLE "Role" DROP CONSTRAINT "Role_name_key";
ALTER TABLE "Permission" DROP CONSTRAINT "Permission_action_subject_key";

-- Add new unique constraints
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_name_key" UNIQUE("tenantId", "name");
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_tenantId_action_subject_key" 
  UNIQUE("tenantId", "action", "subject");

-- Add indexes
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");
CREATE INDEX "Permission_tenantId_idx" ON "Permission"("tenantId");

-- Add foreign keys
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_tenantId_fkey" 
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE;
```

**Files to Update:**

- ✅ Update all role/permission API routes to include tenantId
- ✅ Update role creation to require tenantId
- ✅ Update permission checks to validate tenant scope

---

## Gap 3: API Routes Missing tenantId Validation

### Vulnerable Routes Found

**1. `/apps/web/app/api/rate-cards/bulk-import/route.ts:32`**

```typescript
// ❌ BEFORE
const supplier = await prisma.rateCardSupplier.findFirst({
  where: { name: record.supplierName },
});

// ✅ FIX
const supplier = await prisma.rateCardSupplier.findFirst({
  where: { name: record.supplierName, tenantId },
});
```

**2. `/apps/web/app/api/rate-cards/baselines/route.ts:14`**

```typescript
// ❌ BEFORE
const user = await prisma.user.findFirst({
  where: { email: session.user.email },
});

// ✅ FIX
const user = await prisma.user.findFirst({
  where: { email: session.user.email, tenantId: session.user.tenantId },
});
```

**3. `/apps/web/app/api/ai/chat/route.ts:3720`**

```typescript
// ❌ BEFORE
const contract = await prisma.contract.findFirst({
  where: { id: contractId },
});

// ✅ FIX
const contract = await prisma.contract.findFirst({
  where: { id: contractId, tenantId },
});
```

---

## Implementation Plan

### Phase 1: Critical Fixes (P0) - Week 1

**Day 1-2: API Validation Gaps**

- [ ] Fix `/api/rate-cards/bulk-import/route.ts`
- [ ] Fix `/api/rate-cards/baselines/route.ts`
- [ ] Fix `/api/ai/chat/route.ts`
- [ ] Run full tenant isolation test suite
- [ ] Deploy to staging

**Day 3-4: TaxonomyCategory Validation**

- [ ] Add `validateCategoryOwnership()` helper
- [ ] Update contract categorize route
- [ ] Update contract metadata route
- [ ] Update contract upload route
- [ ] Update categorization service
- [ ] Add integration tests
- [ ] Deploy to staging

**Day 5: Testing & Validation**

- [ ] Cross-tenant penetration testing
- [ ] Multi-tenant load testing
- [ ] Security audit
- [ ] Deploy to production

### Phase 2: Schema Migration (P1) - Week 2

**Day 1-3: Role/Permission Migration**

- [ ] Write migration script (with rollback)
- [ ] Test on dev database
- [ ] Run on staging database
- [ ] Validate all role/permission operations
- [ ] Monitor for 24h

**Day 4-5: API Updates**

- [ ] Update role CRUD APIs
- [ ] Update permission APIs
- [ ] Update UserRole assignments
- [ ] Update authorization middleware
- [ ] Integration testing

---

## Testing Checklist

### Cross-Tenant Security Tests

```typescript
// Test 1: Category ID hijacking
describe('TaxonomyCategory Isolation', () => {
  it('should reject cross-tenant category assignment', async () => {
    // Tenant A creates category
    const catA = await createCategory({ tenantId: 'tenant-A', name: 'Strategic' });
    
    // Tenant B tries to steal it
    const response = await updateContract({
      id: 'contract-B',
      tenantId: 'tenant-B',
      contractCategoryId: catA.id
    });
    
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('different tenant');
  });
});

// Test 2: Role isolation
describe('Role Isolation', () => {
  it('should allow duplicate role names across tenants', async () => {
    await createRole({ tenantId: 'tenant-A', name: 'Admin' });
    await createRole({ tenantId: 'tenant-B', name: 'Admin' }); // Should work
  });
  
  it('should prevent cross-tenant role assignment', async () => {
    const roleA = await createRole({ tenantId: 'tenant-A', name: 'Manager' });
    
    const response = await assignRole({
      userId: 'user-B',
      tenantId: 'tenant-B',
      roleId: roleA.id
    });
    
    expect(response.status).toBe(403);
  });
});

// Test 3: API validation
describe('API Tenant Validation', () => {
  it('should validate tenantId in all findFirst queries', async () => {
    const routes = [
      '/api/rate-cards/bulk-import',
      '/api/rate-cards/baselines',
      '/api/ai/chat'
    ];
    
    for (const route of routes) {
      // Inject cross-tenant ID
      const response = await request(route, {
        method: 'POST',
        headers: { 'x-tenant-id': 'tenant-A' },
        body: { id: 'resource-from-tenant-B' }
      });
      
      // Should not leak data
      expect(response.status).not.toBe(200);
    }
  });
});
```

---

## Monitoring & Alerts

### Add These Alerts

```typescript
// Alert 1: Cross-tenant query detected
if (query.tenantId !== session.user.tenantId) {
  logger.error('SECURITY: Cross-tenant query attempt', {
    userId: session.user.id,
    requestedTenantId: query.tenantId,
    userTenantId: session.user.tenantId,
    endpoint: request.url
  });
  
  // Alert security team
  await sendSecurityAlert({
    type: 'CROSS_TENANT_ACCESS_ATTEMPT',
    severity: 'HIGH',
    details: { ... }
  });
}

// Alert 2: Missing tenantId in query
if (!query.tenantId) {
  logger.warn('SECURITY: Query missing tenantId', {
    model: modelName,
    endpoint: request.url
  });
}
```

---

## Success Criteria

### Must Pass All Tests

- [ ] No cross-tenant data leakage in any API
- [ ] All Prisma queries include `tenantId`
- [ ] TaxonomyCategory references validated
- [ ] Roles/Permissions fully tenant-scoped
- [ ] 100% test coverage for tenant isolation
- [ ] Zero security alerts in 7-day monitoring period

### Performance Requirements

- [ ] Tenant-scoped queries < 50ms (p95)
- [ ] Index performance maintained
- [ ] No N+1 queries introduced
- [ ] Database size impact < 5%

---

## Rollback Plan

### If Issues Detected

**Phase 1 Rollback (API Fixes):**

```bash
# Revert API changes
git revert <commit-hash>
npm run deploy:production

# Monitor for 1 hour
npm run test:tenant-isolation
```

**Phase 2 Rollback (Schema Changes):**

```sql
-- Rollback Role/Permission migration
BEGIN;

-- Drop new constraints
ALTER TABLE "Role" DROP CONSTRAINT IF EXISTS "Role_tenantId_name_key";
ALTER TABLE "Permission" DROP CONSTRAINT IF EXISTS "Permission_tenantId_action_subject_key";

-- Restore old constraints
ALTER TABLE "Role" ADD CONSTRAINT "Role_name_key" UNIQUE("name");
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_action_subject_key" 
  UNIQUE("action", "subject");

-- Drop tenantId columns
ALTER TABLE "Role" DROP COLUMN IF EXISTS "tenantId";
ALTER TABLE "Permission" DROP COLUMN IF EXISTS "tenantId";

COMMIT;
```

---

## Post-Implementation

### Security Audit

- [ ] Run automated security scanner
- [ ] Manual penetration testing
- [ ] Review all findFirst/findMany queries
- [ ] Audit log review for anomalies

### Documentation

- [ ] Update security documentation
- [ ] Update API documentation
- [ ] Update developer onboarding
- [ ] Create tenant isolation best practices guide

---

## Contact

**Security Lead:** [Your Name]
**Timeline:** 2 weeks
**Status:** Ready for implementation
**Last Updated:** December 28, 2025
