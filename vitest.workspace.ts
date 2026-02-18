import { defineWorkspace } from 'vitest/config';

/**
 * Vitest Workspace Configuration
 *
 * Delegates to each package's own vitest.config.ts so that running
 * `npx vitest run` from the monorepo root discovers every package
 * with its correct aliases, environment (jsdom / node), globals, and
 * setup files.
 *
 * Playwright E2E tests (apps/web/tests/*.spec.ts) are intentionally
 * excluded — run them via `pnpm test:e2e` / `npx playwright test`.
 */
export default defineWorkspace([
  'apps/web/vitest.config.ts',
  'packages/utils/vitest.config.ts',
  'packages/schemas/vitest.config.ts',
  'packages/agents/vitest.config.ts',
  'packages/clients/db/vitest.config.ts',
  'packages/clients/openai/vitest.config.ts',
  'packages/data-orchestration/vitest.config.ts',
]);
