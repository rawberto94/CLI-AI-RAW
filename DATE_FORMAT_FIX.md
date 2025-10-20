# Date Format Error Fix

## ✅ Issue Resolved

### Error:

```
RangeError: Invalid time value
at lib/contracts/contracts-data-service.ts (194:6) @ format
```

### Root Cause:

The `formatDate()` and `formatDateTime()` functions were trying to format invalid date strings without validation, causing `Intl.DateTimeFormat` to throw a RangeError.

### Solution Applied:

Added validation checks to both functions:

1. **Check for null/undefined/empty strings**

   - Return 'N/A' if the date string is falsy

2. **Check for invalid dates**
   - Use `isNaN(date.getTime())` to detect invalid dates
   - Return 'Invalid Date' and log warning if invalid

### Code Changes:

**Before:**

```typescript
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
```

**After:**

```typescript
export function formatDate(dateString: string): string {
  if (!dateString) return "N/A";

  const date = new Date(dateString);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn("Invalid date string:", dateString);
    return "Invalid Date";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
```

Same fix applied to `formatDateTime()` function.

### Result:

✅ No more RangeError crashes
✅ Graceful handling of invalid dates
✅ Better debugging with console warnings
✅ Page renders successfully even with bad date data

### Files Modified:

- `/apps/web/lib/contracts/contracts-data-service.ts`

### Next Steps:

The page should now load without errors. If you see "Invalid Date" displayed anywhere, check the contract data to see which date field has invalid data.
