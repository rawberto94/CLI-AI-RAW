# OCR Party Extraction - Data Flow Issue Analysis

## Problem Summary

Parties extracted by OCR/AI show correctly in **Summary** but display as **"Unnamed Party"** in **Metadata/Parties section**.

## Root Cause

### Data Storage Locations

| Location | Field | Populated By |
|----------|-------|--------------|
| **Contract Table** | `clientName`, `supplierName` | OCR Worker (parties.ts artifact) |
| **Contract Table** | `external_parties` (JSON) | OCR Worker (parties.ts artifact) |
| **ContractMetadata Table** | `customFields` (parties data) | Auto-Populate Service |
| **Artifacts Table** | `parties` artifact | AI Artifact Generator |

### The Disconnect

```
OCR Extraction
    ↓
Extracts parties → Saves to contract.clientName / contract.supplierName ✅
                 → Saves to contract.external_parties ✅
                 → Creates parties artifact ✅
    ↓
Metadata Editor reads from:
    - contract.external_parties (empty or not synced)
    - Falls back to contract.clientName/supplierName (FIXED ✅)
```

## Investigation Results

### 1. OCR Worker DOES populate party fields

From `packages/workers/src/ocr-artifact-worker.ts`:
```typescript
// Parties are extracted and saved to contract fields
await prisma.contract.updateMany({
  where: { id: contractId },
  data: {
    clientName: extractedParties.client?.name,
    supplierName: extractedParties.supplier?.name,
    external_parties: extractedParties.all,
  },
});
```

### 2. UI Components read from different sources

**Summary Component:**
- Reads `contract.clientName` + `contract.supplierName` ✅
- Shows party names correctly

**Metadata/Parties Section (Before Fix):**
- Only read `contract.external_parties` ❌
- When empty → showed "Unnamed Party"

**Metadata/Parties Section (After Fix):**
- Reads `contract.external_parties` first ✅
- Falls back to `contract.clientName`/`supplierName` ✅
- Shows party names correctly

## The Fix Applied

File: `apps/web/components/contracts/EnhancedContractMetadataSection.tsx` (line ~1501)

```typescript
// Fallback: Create parties from clientName/supplierName if external_parties is empty
if (!base.external_parties || base.external_parties.length === 0) {
  const fallbackParties: ExternalParty[] = [];
  
  if (contract.clientName) {
    fallbackParties.push({
      legalName: contract.clientName,
      role: 'Client',
    });
  }
  
  if (contract.supplierName) {
    fallbackParties.push({
      legalName: contract.supplierName,
      role: 'Supplier',
    });
  }
  
  if (fallbackParties.length > 0) {
    base.external_parties = fallbackParties;
  }
}
```

## Verification

To verify the fix works:

```sql
-- Check contract has party data
SELECT 
  id, 
  fileName, 
  clientName, 
  supplierName, 
  external_parties IS NOT NULL as has_external_parties
FROM contracts 
WHERE id = 'YOUR_CONTRACT_ID';
```

Expected result:
- `clientName` or `supplierName` should have values (populated by OCR)
- `external_parties` may be NULL (which is fine now with the fallback)

## Related Data Flow Issues to Check

### 1. Financial Values
Check if `contract.totalValue` is being populated from artifacts:
```typescript
// In EnhancedContractMetadataSection.tsx - ALREADY HAS FALLBACK
if (!base.tcv_amount && (contract.totalValue !== undefined || contract.tcv_amount !== undefined)) {
  const val = contract.totalValue !== undefined ? contract.totalValue : contract.tcv_amount;
  base.tcv_amount = typeof val === 'number' ? val : typeof val === 'string' ? parseFloat(val) || 0 : 0;
}
```

### 2. Dates
Check if `contract.startDate` / `contract.endDate` are populated:
```typescript
// In EnhancedContractMetadataSection.tsx - ALREADY HAS FALLBACK
if (!base.start_date) base.start_date = String(contract.effectiveDate || contract.startDate || '');
if (!base.end_date) base.end_date = contract.expirationDate || contract.endDate ? String(contract.expirationDate || contract.endDate) : null;
```

### 3. Contract Type
Check if `contract.contractType` is populated from AI categorization.

## Recommendation

The fix is **sufficient for the parties display issue**. However, for better data consistency:

1. **Option A:** Keep fallback logic (current fix) - Quick win ✅
2. **Option B:** Ensure OCR worker always populates `external_parties` - Requires worker changes
3. **Option C:** Create a sync job that ensures all party data is consistent across fields

The current fix (Option A) is the safest approach as it handles any case where data might be in different fields.
