# 🗑️ Unused, Deprecated & Redundant Files

> **Last Updated:** December 2024  
> **Purpose:** Track files that may be unused, deprecated, or redundant to avoid confusion during development.

---

## ⚠️ How to Use This Document

- Files marked **DELETE** can be safely removed
- Files marked **REVIEW** need verification before removal
- Files marked **MOVE** should be relocated to appropriate folders
- Files marked **CONSOLIDATE** have duplicates that should be merged

---

## 🔴 High Priority (Delete or Fix Immediately)

### Deprecated API Routes
These routes redirect to new endpoints and should be removed after confirming no clients use them:

| File | Reason | Action |
|------|--------|--------|
| `apps/web/app/api/upload/init/route.ts` | Has `@deprecated` annotation, redirects to `/api/contracts/upload/init` | DELETE |
| `apps/web/app/api/upload/complete/route.ts` | Has `@deprecated` annotation | DELETE |

### Orphaned Root-Level Components
These components in `/apps/web/components/` are not imported anywhere:

| File | Lines | Reason | Action |
|------|-------|--------|--------|
| `batch-upload-zone.tsx` | 789 | Superseded by `EnhancedUploadZone` | DELETE |
| `upload-zone.tsx` | 439 | Superseded by `EnhancedUploadZone` | DELETE |
| `progress.tsx` | 105 | Use `ui/progress.tsx` instead | DELETE |
| `error-boundary.tsx` | 369 | Not imported, use `errors/ErrorBoundary.tsx` | DELETE |
| `WelcomeLoader.tsx` | 223 | Orphaned component | DELETE |
| `LoadingStates.tsx` | 509 | Redundant with `ui/` versions | DELETE |

### Duplicate ErrorBoundary Files (4 versions!)
Keep only the canonical version:

| File | Status |
|------|--------|
| `components/errors/ErrorBoundary.tsx` | ✅ KEEP - canonical version |
| `components/error-boundary.tsx` | ❌ DELETE |
| `components/ErrorBoundary.tsx` | ❌ DELETE |
| `app/components/ErrorBoundary.tsx` | CONSOLIDATE into errors/ |

### Empty Folders
| Folder | Action |
|--------|--------|
| `components/_unused/` | DELETE (empty) |

---

## 🟡 Medium Priority (Demo/Test Files)

### Demo & Test Pages
These are not production code and could confuse developers:

| File | Purpose | Action |
|------|---------|--------|
| `apps/web/app/test-upload/page.tsx` | Test upload functionality | MOVE to `__dev__` or DELETE |
| `apps/web/app/ux-demo/page.tsx` | UX demonstration page | MOVE to `__dev__` or DELETE |
| `apps/web/app/pilot-demo/page.tsx` | Sales pilot demo | MOVE to demo branch |
| `apps/web/components/pilot-demo/PilotDemo.tsx` | Pilot demo component | MOVE with parent |
| `apps/web/app/api/example/route.ts` | Example API for docs | MOVE to docs or DELETE |
| `apps/web/app/api/example/usage/route.ts` | Example API for docs | MOVE to docs or DELETE |

### Duplicate DataModeToggle Files (4 versions!)
| File | Used By | Action |
|------|---------|--------|
| `components/analytics/DataModeToggle.tsx` | Analytics pages | ✅ KEEP |
| `components/navigation/DataModeToggle.tsx` | ConditionalLayout | ✅ KEEP but rename |
| `components/settings/DataModeToggle.tsx` | Not used | DELETE |
| `components/shared/DataModeToggle.tsx` | Not used | DELETE |

---

## 🟢 Low Priority (Code Cleanup)

### UX Demo Components
These are only used by the ux-demo page:

| File | Action |
|------|--------|
| `components/ux-demo/ExampleComponent.tsx` | MOVE to docs/storybook |
| `components/ux-demo/InteractiveDemo.tsx` | MOVE with demo page |
| `components/ux-demo/ComponentShowcase.tsx` | MOVE with demo page |
| `components/ux-demo/StateManagementDemo.tsx` | MOVE with demo page |
| `components/ux-demo/FormDemo.tsx` | MOVE with demo page |

### Test Files in Wrong Locations
| File | Action |
|------|--------|
| `packages/data-orchestration/test-ocr.ts` | MOVE to `__tests__/` folder |
| `test-contract.txt` | MOVE to `data/` or DELETE |
| `tmp/` folder | DELETE temporary files |

### Unused Onboarding Component
| File | Reason | Action |
|------|--------|--------|
| `components/onboarding/WelcomeTour.tsx` | Orphaned - `OnboardingTour.tsx` is used | DELETE |

### Unused UI Index
| File | Reason | Action |
|------|--------|--------|
| `components/enhanced-ui-index.ts` | Not imported anywhere | DELETE or integrate |

### Potentially Orphaned Shared Components
| File | Action |
|------|--------|
| `components/shared/EmptyState.tsx` | REVIEW - may be orphaned |
| `components/shared/StatusBadge.tsx` | REVIEW - may be orphaned |

### Package Utils Duplicates
| File | Duplicate Of | Action |
|------|--------------|--------|
| `packages/utils/src/tracing-browser.ts` | `tracing.ts` | CONSOLIDATE |
| `packages/utils/src/tracing-node.ts` | `tracing.ts` | CONSOLIDATE |
| `packages/utils/src/tracing-minimal.ts` | Different impl | REVIEW |

---

## 📊 Summary

| Priority | Count | Action Needed |
|----------|-------|---------------|
| 🔴 High | 12 files | Delete immediately |
| 🟡 Medium | 10 files | Move or consolidate |
| 🟢 Low | 15+ files | Review and cleanup |

---

## ✅ Cleanup Commands

```bash
# After verifying each file, run these commands:

# Delete deprecated API routes
rm apps/web/app/api/upload/init/route.ts
rm apps/web/app/api/upload/complete/route.ts

# Delete orphaned root components
rm apps/web/components/batch-upload-zone.tsx
rm apps/web/components/upload-zone.tsx
rm apps/web/components/progress.tsx
rm apps/web/components/error-boundary.tsx
rm apps/web/components/WelcomeLoader.tsx
rm apps/web/components/LoadingStates.tsx
rm apps/web/components/ErrorBoundary.tsx

# Delete empty folders
rmdir apps/web/components/_unused

# Delete duplicate DataModeToggle
rm apps/web/components/settings/DataModeToggle.tsx
rm apps/web/components/shared/DataModeToggle.tsx

# Delete orphaned onboarding
rm apps/web/components/onboarding/WelcomeTour.tsx
```

---

## 🔍 Files That Are ACTIVELY USED (Don't Delete!)

For reference, these similarly-named files ARE in use:

| File | Used By |
|------|---------|
| `components/errors/ErrorBoundary.tsx` | Layout, Error pages |
| `components/ui/progress.tsx` | Multiple components |
| `components/upload/EnhancedUploadZone.tsx` | Upload page |
| `components/WelcomeTutorial.tsx` | Sidebar, Layout |
| `components/onboarding/OnboardingTour.tsx` | Layout |
| `components/analytics/DataModeToggle.tsx` | Analytics pages |

---

*Generated by code analysis on December 2024*
