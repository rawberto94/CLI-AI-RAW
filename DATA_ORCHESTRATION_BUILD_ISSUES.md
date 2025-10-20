# Data-Orchestration Package - TypeScript Build Issues

**Date:** October 20, 2025  
**Status:** ❌ Build Failing  
**Package:** `/packages/data-orchestration`  
**Impact:** HIGH - The package cannot be built, causing runtime errors in the web application

---

## Summary

The data-orchestration package fails to build due to TypeScript compilation errors. The main issue is that **Prisma returns `Decimal` types** for database decimal fields, but the TypeScript interfaces expect `number` types. Additionally, some source files are explicitly excluded from the build in `tsconfig.json`.

---

## Error Categories

### 1. Type Incompatibility: Decimal vs Number (7 errors)

**Root Cause:**

- Prisma generates `Decimal` types for database fields marked as `@db.Decimal()` in the schema
- TypeScript interfaces in `src/types/contract.types.ts` define these fields as `number`
- Type assertions fail because `Decimal` and `number` are not compatible types

**Affected Fields:**

#### Contract Model

- `totalValue: Decimal?` (Prisma) → `totalValue: number` (TypeScript)
  - Database: `Decimal(15, 2)`
  - Schema location: Line 192 in `schema.prisma`

#### Artifact Model

- `confidence: Decimal?` (Prisma) → `confidence: number` (TypeScript)
  - Database: `Decimal(3, 2)`
  - Schema location: Line 416 in `schema.prisma`

**Error Locations:**

1. **`src/dal/database.adaptor.ts:54`**

   ```typescript
   return contract as Contract; // ❌ Fails
   ```

   - Converting Prisma Contract to TypeScript Contract type
   - `totalValue` is `Decimal` but expected `number`

2. **`src/dal/database.adaptor.ts:167`**

   ```typescript
   contracts: contracts as Contract[],  // ❌ Fails
   ```

   - Same issue for array of contracts

3. **`src/dal/database.adaptor.ts:193`**

   ```typescript
   return artifact as Artifact; // ❌ Fails
   ```

   - Converting Prisma Artifact to TypeScript Artifact type
   - `confidence` is `Decimal` but expected `number`

4. **`src/dal/database.adaptor.ts:211`**

   ```typescript
   return artifact as Artifact | null; // ❌ Fails
   ```

   - Same issue with nullable artifact

5. **`src/dal/database.adaptor.ts:224`**

   ```typescript
   return artifacts as Artifact[]; // ❌ Fails
   ```

   - Same issue for array of artifacts

6. **`src/services/contract-indexing.service.ts:589`**

   ```typescript
   contract: contract as Contract,  // ❌ Fails
   ```

   - Same Contract type conversion issue

7. **`src/services/contract.service.ts:272`**
   ```typescript
   contract: result.contract as Contract,  // ❌ Fails
   ```
   - Same Contract type conversion issue

---

### 2. Files Excluded from TypeScript Compilation (3 errors)

**Root Cause:**
Files are excluded in `tsconfig.json` but still imported by other files in the codebase, causing TypeScript to complain that they're not part of the project.

**Excluded Files (from tsconfig.json):**

```json
"exclude": [
  // ... other exclusions ...
  "src/dal/database.adaptor.ts",           // ⚠️ But imported by 24+ files!
  "src/services/contract-indexing.service.ts",  // ⚠️ But imported by index.ts!
  "src/services/contract.service.ts"            // ⚠️ But imported by 7+ files!
]
```

**Error Locations:**

1. **`src/dal/index.ts:1`**

   ```
   error TS6307: File 'database.adaptor.ts' is not listed within the file list
   ```

   - `database.adaptor.ts` is excluded but imported by 24 files
   - Imported by: contract.service.ts, file-integrity.service.ts, artifact.service.ts, intelligence.service.ts, etc.

2. **`src/services/index.ts:1`**

   ```
   error TS6307: File 'contract.service.ts' is not listed within the file list
   ```

   - `contract.service.ts` is excluded but imported by 7 files
   - Imported by: artifact.service.ts, intelligence.service.ts, analytics.service.ts, workflow.service.ts, etc.

3. **`src/services/index.ts:6`**
   ```
   error TS6307: File 'contract-indexing.service.ts' is not listed within the file list
   ```
   - `contract-indexing.service.ts` is excluded but exported from index.ts

---

## Current Workaround in Production

The web application (`apps/web`) currently uses a **temporary workaround**:

**File:** `/workspaces/CLI-AI-RAW/apps/web/app/api/contracts/route.ts`

- ✅ **Bypasses data-orchestration package** entirely
- ✅ Uses direct Prisma queries from `@/lib/prisma`
- ✅ Converts `Decimal` to `number` using `Number()` at query time
- ⚠️ **This is not a long-term solution** - other parts of the app may still depend on the data-orchestration package

---

## Solutions

### Solution 1: Fix Type Definitions (Recommended)

Update TypeScript types to match Prisma's generated types.

**File:** `src/types/contract.types.ts`

**Change:**

```typescript
// BEFORE
totalValue: z.number().optional().nullable(),
```

**To:**

```typescript
// AFTER - Accept both Decimal and number
totalValue: z.union([z.number(), z.custom<Decimal>()]).optional().nullable(),

// OR simpler - just use 'any' for Prisma types
totalValue: z.any().optional().nullable(),
```

**For Artifact types:**

```typescript
// BEFORE
confidence: z.number().optional(),

// AFTER
confidence: z.union([z.number(), z.custom<Decimal>()]).optional(),
```

**File:** `src/dal/database.adaptor.ts`

**Add conversion helpers at the top:**

```typescript
import { Decimal } from "@prisma/client/runtime/library";

// Helper to convert Prisma types to TypeScript types
function convertContract(prismaContract: any): Contract {
  return {
    ...prismaContract,
    totalValue: prismaContract.totalValue
      ? Number(prismaContract.totalValue)
      : null,
    fileSize: prismaContract.fileSize,
  };
}

function convertArtifact(prismaArtifact: any): Artifact {
  return {
    ...prismaArtifact,
    confidence: prismaArtifact.confidence
      ? Number(prismaArtifact.confidence)
      : undefined,
  };
}
```

**Then use these helpers instead of type assertions:**

```typescript
// Line 54 - BEFORE
return contract as Contract;

// Line 54 - AFTER
return convertContract(contract);

// Line 167 - BEFORE
contracts: contracts as Contract[],

// Line 167 - AFTER
contracts: contracts.map(convertContract),

// Line 193 - BEFORE
return artifact as Artifact;

// Line 193 - AFTER
return convertArtifact(artifact);

// Similar changes for lines 211 and 224
```

---

### Solution 2: Fix tsconfig.json (Required)

Remove exclusions for actively used files.

**File:** `packages/data-orchestration/tsconfig.json`

**Change:**

```json
// BEFORE
"exclude": [
  "node_modules",
  "dist",
  "**/*.test.ts",
  "**/*.spec.ts",
  "src/providers/negotiation-prep-providers.ts",
  "src/providers/rate-benchmarking-providers.ts",
  "src/providers/renewal-radar-providers.ts",
  "src/providers/savings-pipeline-providers.ts",
  "src/providers/supplier-analytics-providers.ts",
  "src/providers/unified-factory.ts",
  "src/scripts/**",
  "src/services/rag/**",
  "src/services/rag-integration.service.ts",
  "src/services/enhanced-artifact.service.ts",
  "src/services/hybrid-artifact-storage.service.ts",
  "src/services/processing-job.service.ts",
  "src/dal/database.adaptor.ts",                      // ❌ REMOVE THIS
  "src/services/contract-indexing.service.ts",        // ❌ REMOVE THIS
  "src/services/contract.service.ts"                  // ❌ REMOVE THIS
]
```

**To:**

```json
// AFTER
"exclude": [
  "node_modules",
  "dist",
  "**/*.test.ts",
  "**/*.spec.ts",
  "src/providers/negotiation-prep-providers.ts",
  "src/providers/rate-benchmarking-providers.ts",
  "src/providers/renewal-radar-providers.ts",
  "src/providers/savings-pipeline-providers.ts",
  "src/providers/supplier-analytics-providers.ts",
  "src/providers/unified-factory.ts",
  "src/scripts/**",
  "src/services/rag/**",
  "src/services/rag-integration.service.ts",
  "src/services/enhanced-artifact.service.ts",
  "src/services/hybrid-artifact-storage.service.ts",
  "src/services/processing-job.service.ts"
  // Removed the 3 actively used files from exclusion list
]
```

---

### Solution 3: Alternative - Use Type Coercion

If you want to keep the current type definitions, force TypeScript to accept the conversions.

**File:** `src/dal/database.adaptor.ts`

**Change all type assertions from:**

```typescript
return contract as Contract;
```

**To:**

```typescript
return contract as unknown as Contract;
```

**⚠️ Warning:** This suppresses type checking and may hide real type errors. Not recommended for production code.

---

## Step-by-Step Fix Instructions

### Step 1: Update tsconfig.json

```bash
cd /workspaces/CLI-AI-RAW/packages/data-orchestration
```

Edit `tsconfig.json` and remove these lines from the `exclude` array:

- `"src/dal/database.adaptor.ts"`
- `"src/services/contract-indexing.service.ts"`
- `"src/services/contract.service.ts"`

### Step 2: Fix Type Conversions

Edit `src/dal/database.adaptor.ts`:

1. Add import at the top:

   ```typescript
   import { Decimal } from "@prisma/client/runtime/library";
   ```

2. Add helper functions before the class:

   ```typescript
   function toNumber(value: Decimal | null | undefined): number | null {
     if (value === null || value === undefined) return null;
     return Number(value);
   }

   function convertContract(prismaContract: any): Contract {
     return {
       ...prismaContract,
       totalValue: toNumber(prismaContract.totalValue),
     };
   }

   function convertArtifact(prismaArtifact: any): Artifact {
     return {
       ...prismaArtifact,
       confidence: toNumber(prismaArtifact.confidence) ?? undefined,
     };
   }
   ```

3. Replace type assertions:

   - Line 54: `return convertContract(contract);`
   - Line 167: `contracts: contracts.map(convertContract),`
   - Line 193: `return convertArtifact(artifact);`
   - Line 211: `return artifact ? convertArtifact(artifact) : null;`
   - Line 224: `return artifacts.map(convertArtifact);`

4. Apply similar changes to:
   - `src/services/contract-indexing.service.ts` line 589
   - `src/services/contract.service.ts` line 272

### Step 3: Rebuild

```bash
cd /workspaces/CLI-AI-RAW/packages/data-orchestration
npm run build
```

If successful, you should see:

```
✓ Compiled successfully
```

### Step 4: Restart the Web Application

```bash
cd /workspaces/CLI-AI-RAW/apps/web
npm run dev
```

The contracts page should now load without errors.

---

## Testing After Fix

1. **Build Test:**

   ```bash
   cd /workspaces/CLI-AI-RAW/packages/data-orchestration
   npm run build
   ```

   Expected: No TypeScript errors

2. **Runtime Test:**

   ```bash
   curl http://localhost:3005/api/contracts/list
   ```

   Expected: JSON response with contract list

3. **Browser Test:**
   Navigate to: `http://localhost:3005/contracts`
   Expected: Contracts page loads without errors

---

## Why This Happened

1. **Prisma uses `Decimal` for precision:** Financial fields like `totalValue` use `Decimal` type to avoid floating-point precision issues
2. **TypeScript uses `number`:** The application layer uses simpler `number` types for easier manipulation

3. **Missing conversion layer:** The data-orchestration package didn't properly convert between Prisma's `Decimal` and TypeScript's `number`

4. **Files were excluded to "fix" errors:** Rather than addressing the type mismatches, someone excluded the problematic files from compilation, which broke imports

---

## Related Files

- `/packages/data-orchestration/tsconfig.json` - TypeScript configuration
- `/packages/data-orchestration/src/types/contract.types.ts` - Type definitions
- `/packages/data-orchestration/src/dal/database.adaptor.ts` - Database adapter with errors
- `/packages/data-orchestration/src/services/contract.service.ts` - Contract service
- `/packages/data-orchestration/src/services/contract-indexing.service.ts` - Indexing service
- `/packages/clients/db/schema.prisma` - Prisma schema defining Decimal fields
- `/apps/web/app/api/contracts/route.ts` - Temporary workaround implementation

---

## Impact of Not Fixing

- ✅ **Current workaround works** for basic contract listing
- ❌ Advanced features may fail (contract indexing, intelligence processing, etc.)
- ❌ Cannot use proper service layer architecture
- ❌ Type safety is compromised
- ❌ Other parts of the app depending on data-orchestration will fail
- ❌ Technical debt increases

---

## Questions?

If you encounter issues while fixing this, check:

1. Did you restart the dev server after rebuilding?
2. Did you clear Next.js cache? (`rm -rf .next`)
3. Are there any other files with similar Decimal/number mismatches?

For more help, search the codebase for other `as Contract` or `as Artifact` type assertions that may need similar fixes.
