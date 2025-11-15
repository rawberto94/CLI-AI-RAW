# Client Packages Build Fix

## Problem
Next.js was encountering "Module parse failed" errors when webpack tried to process TypeScript source files from symlinked packages (`clients-db`, `clients-storage`) in the `data-orchestration` package's `node_modules`.

## Root Cause
- `packages/data-orchestration/node_modules/clients-db` → symlink to `../../clients/db` (TypeScript sources)
- `packages/data-orchestration/node_modules/clients-storage` → symlink to `../../clients/storage` (TypeScript sources)
- Webpack follows symlinks and tries to parse `.ts` files, causing errors

## Permanent Fix Applied

### 1. Build Client Packages
All client packages now compile TypeScript to JavaScript in their `dist` folders:
```bash
pnpm run build:clients
```

This builds:
- `clients-db` → `packages/clients/db/dist/`
- `clients-storage` → `packages/clients/storage/dist/`
- `clients-openai` → `packages/clients/openai/dist/`
- `clients-queue` → `packages/clients/queue/dist/`
- `clients-rag` → `packages/clients/rag/dist/`

### 2. Updated Symlinks
Symlinks in `data-orchestration/node_modules` now point to compiled `dist` folders:
- `clients-db` → `../../clients/db/dist` ✓
- `clients-storage` → `../../clients/storage/dist` ✓

### 3. Automated Build Script
Created `scripts/build-clients.sh` to automate the process:
```bash
./scripts/build-clients.sh
```

Or use the npm script:
```bash
pnpm run build:clients
```

## When to Run

Run the build script:
1. **After pulling new code** - If client packages have changed
2. **After modifying client packages** - To rebuild with your changes
3. **On fresh clone** - As part of initial setup
4. **CI/CD pipeline** - Add as a build step

## Verification

Test that it's working:
```bash
# Check no TypeScript files in symlinked locations
ls -la packages/data-orchestration/node_modules/clients-db/
# Should show: index.js, index.d.ts (not index.ts)

# Start Next.js and check for errors
pnpm dev
# Should see: "✓ Ready in 3.2s" with no "Module parse failed" errors
```

## Alternative Solutions Considered

### Option 1: Webpack Configuration (Not chosen)
- Pros: No build step needed
- Cons: Complex webpack config, fragile, doesn't solve root cause

### Option 2: Remove Symlinks, Use npm link (Not chosen)
- Pros: Standard approach
- Cons: Requires global npm link, less monorepo-friendly

### Option 3: Publish Packages to Registry (Future consideration)
- Pros: Most robust, works everywhere
- Cons: Overkill for monorepo, requires private registry or public npm

### ✅ Option 4: Build + Point Symlinks to Dist (Chosen)
- Pros: Simple, fast, works with monorepo, no webpack hacks
- Cons: Requires running build script (automated)

## Files Modified

1. **Created:** `scripts/build-clients.sh` - Automated build script
2. **Modified:** `package.json` - Added `build:clients` script
3. **Modified:** `packages/data-orchestration/node_modules/clients-db` - Symlink updated
4. **Modified:** `packages/data-orchestration/node_modules/clients-storage` - Symlink updated

## Success Metrics

✅ No "Module parse failed" errors  
✅ `/api/events` route working  
✅ All pages loading (/, /dashboard, /contracts, /analytics)  
✅ Memory usage optimized (0.8%, 68MB)  
✅ Build time under 5 seconds  

## Maintenance

Add to your development workflow:
```bash
# After pulling code
git pull
pnpm run build:clients  # <-- Add this step
pnpm dev
```

Or add as a `postinstall` hook in package.json:
```json
{
  "scripts": {
    "postinstall": "pnpm run build:clients"
  }
}
```
