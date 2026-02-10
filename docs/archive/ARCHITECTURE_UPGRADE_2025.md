# Architecture Upgrade Guide - January 2025

## Current Status

This document outlines the architecture analysis and optimizations performed for the CLI-AI-RAW platform.

## Current Technology Stack

### Core Framework Versions (Latest Stable)

| Package | Current | Latest Available | Status |
|---------|---------|------------------|--------|
| Next.js | 15.5.6 | 16.0.4 | ⚠️ Major update available |
| React | 19.0.0 | 19.0.0 | ✅ Latest |
| TypeScript | 5.7.2 | 5.8.x | ✅ Near-latest |
| Tailwind CSS | 3.4.17 | 4.1.x | ⚠️ Major update available |
| pnpm | 8.9.0 | 9.x | ⚠️ Major update available |

### Library Versions

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| Prisma | 5.22.0 | 7.0.1 | 🔒 Blocked - schema changes |
| Zod | 3.23.8 | 4.x | 🔒 Blocked - LangChain dependency |
| Framer Motion | 11.18.2 | 12.x | ⚠️ Safe to update |
| LangChain | 0.2.x | 0.3.x | 🔒 Requires Zod 4 |
| Express | 4.x | 5.x | ⚠️ Safe to update |

## Upgrade Blockers

### Critical: LangChain/Zod Compatibility

- **Issue**: `@langchain/core` 0.3+ requires Zod 4's new export paths (`zod/v3`, `zod/v4/core`)
- **Current Fix**: pnpm override forces `zod-to-json-schema@3.23.5`
- **Solution**: Wait for LangChain to stabilize Zod 4 support, then upgrade together

### Critical: Prisma 6+ Schema Changes

- **Issue**: Prisma 6+ has TypeScript API changes affecting `data-orchestration` package
- **Impact**: ~20+ services need refactoring
- **Solution**: Dedicated migration sprint required

## Applied Optimizations ✅

### 1. TypeScript Configuration

- Upgraded target from ES2020 → ES2022
- Added `noUncheckedIndexedAccess` for safer array access
- Added `noImplicitOverride` for class inheritance safety
- Added `DOM.Iterable` to lib for modern iteration

### 2. Next.js Performance

- Enabled `webpackBuildWorker` for parallel builds
- Enabled `parallelServerBuildTraces` and `parallelServerCompiles`
- Extended `optimizePackageImports` to include:
  - `@tanstack/react-table`
  - `react-hook-form`
  - `@hookform/resolvers`
  - `class-variance-authority`
  - `clsx`

### 3. Security Headers Enhanced

- Added `X-XSS-Protection: 1; mode=block`
- Added `Strict-Transport-Security` for HSTS
- Upgraded `Referrer-Policy` to `strict-origin-when-cross-origin`
- Added `interest-cohort=()` to block FLoC tracking
- Added static asset caching headers

### 4. Turbo Build System

- Daemon mode enabled for faster rebuilds
- Task caching configured properly
- Database generation task added
- Environment variable handling improved

## Safe Updates (Can Apply Now)

```bash
# Update Framer Motion (safe)
pnpm update framer-motion@latest -r

# Update Express (safe)
pnpm update express@5 -w

# Update minor versions
pnpm update -r
```

## Deferred Updates (Require Planning)

### Next.js 16 Migration

```bash
# When ready (test thoroughly)
pnpm update next@16 -r
```

### Tailwind CSS 4 Migration

- Significant config changes required
- CSS-first configuration approach
- Lightning CSS engine integration

### LangChain + Zod 4 Migration

1. Upgrade Zod to 4.x
2. Update all schema definitions if needed
3. Upgrade LangChain packages
4. Remove pnpm overrides

## Verification Commands

```bash
# Check current versions
pnpm list --depth=0

# Verify build
pnpm build

# Run type checking
pnpm type-check

# Check for outdated packages
pnpm outdated
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    CLI-AI-RAW Platform                   │
├─────────────────────────────────────────────────────────┤
│  Frontend (apps/web)                                     │
│  ├── Next.js 15.5.6 (App Router)                        │
│  ├── React 19.0.0                                        │
│  ├── Tailwind CSS 3.4.17                                 │
│  └── Framer Motion 11.18.2                               │
├─────────────────────────────────────────────────────────┤
│  Backend Services                                        │
│  ├── data-orchestration (Prisma 5.22.0)                 │
│  ├── LangChain 0.2.x (AI/RAG)                           │
│  └── Express 4.x (API)                                   │
├─────────────────────────────────────────────────────────┤
│  Infrastructure                                          │
│  ├── PostgreSQL (Database)                               │
│  ├── Redis (Caching/Queue)                               │
│  ├── MinIO (Storage)                                     │
│  └── Docker (Containerization)                           │
└─────────────────────────────────────────────────────────┘
```
