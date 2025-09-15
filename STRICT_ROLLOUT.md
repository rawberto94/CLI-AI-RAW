# Web Strict TypeScript Rollout

Incremental adoption strategy for bringing the `apps/web` Next.js app to full `strict` TypeScript with minimal disruption.

## Goals
- Eliminate type noise early (unused symbols, unsafe optionals).
- Protect core shared surfaces (components, lib, API/page boundaries) first.
- Provide fast feedback in CI (core) + opt‑in full strict gating.
- Allow phased expansion without blocking ongoing feature work.

## Phase Overview
| Phase | Config File | Scope (include) | CI Status | Trigger |
|-------|-------------|-----------------|----------|---------|
| Core  | `tsconfig.strict-core.json` | `components`, `lib`, `app/**/page|layout|route.ts[x]`, tests | REQUIRED (`strict-core.yml`) | Every PR touching web core paths |
| Phase 2 | `tsconfig.strict-phase2.json` | Core + `app/**/loading|error.tsx` + broadened app pages | Optional (run locally) | Manual / dev loop |
| Full  | `tsconfig.strict.json` | Entire web project | OPTIONAL (`strict-full.yml` label/workflow_dispatch) | Label `run-full-strict` or manual |

## Scripts
Root `package.json`:
- `pnpm type-check:web:strict:core`
- `pnpm type-check:web:strict:phase2`
- `pnpm type-check:web:strict:full`

Web package convenience: `pnpm --filter web run type-check:strict:core`

## CI Workflows
- `.github/workflows/strict-core.yml`: Mandatory gate for core scope.
- `.github/workflows/strict-full.yml`: Manual / label-based full strict assessment (non-blocking now; can be elevated later).

## Expansion Playbook
1. Keep core passing (0 errors) – treat regressions as build failures.
2. Periodically run `pnpm type-check:web:strict:phase2`; fix deltas; once stable, merge phase2 scope into core config (rename or copy patterns).
3. Repeat until full strict output = 0.
4. Flip `.github/workflows/strict-full.yml` to always-on (remove conditional) once clean.

## Guidelines for Contributors
- Prefer narrowing & explicit guards over `as` assertions.
- Avoid re-exporting large 3rd-party types—wrap with minimal local interfaces.
- Use functional update patterns when adjusting React state to preserve inference.
- Keep utility function return types explicit if exported across boundaries.

## Common Fix Patterns
| Issue | Fix Pattern |
|-------|-------------|
| Unused import/var | Remove or prefix param with `_` only if needed for signature stability. |
| Possibly undefined param (e.g. route param) | Validate early (`if(!id) throw ...`) then treat as `string`. |
| Third-party union too wide | Narrow at boundary (`const safe = arr.filter(isX)` with a type guard). |
| JSON parsing | Runtime validate shape or cast to internal DTO interface. |

## Dropzone Typing Improvement
Removed `as any`; now using explicit `DropzoneOptions` for `BatchUploadZone`. Keep similar discipline for future external hook wrappers.

## Future Enhancements
- Add ESLint rule set synced with strict assumptions (e.g. `@typescript-eslint/strict-boolean-expressions`).
- Add `tsc --generateTrace` profiling (occasional) to monitor compile perf as scope widens.
- Consider `ts-prune` or `knip` integration for dead code detection pre-strict expansion.

## Rollback Safety
If a blocking issue appears:
1. Revert path additions in `tsconfig.strict-core.json` (minimal diff).
2. Track issue in `STRICT_ROLLOUT.md` under an Incident Log section.
3. Reintroduce after fix.

## Incident Log
(Empty)

---
Maintained by: Platform / DX. Update when phase boundaries change.
