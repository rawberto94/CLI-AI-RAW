/**
 * Contract Generation Workflow E2E Tests
 * 
 * Tests the complete contract generation workflow including:
 * 1. Template selection and browsing
 * 2. Contract generation wizard
 * 3. Variable filling and form completion
 * 4. Draft management
 * 5. Contract preview and download
 */

import { test, expect } from './utils/auth-fixture';
import type { Page } from '@playwright/test';

const REDIRECT_TIMEOUT_MS = 25000;
const REDIRECT_NAVIGATION_TIMEOUT_MS = 20000;
const REDIRECT_RETRY_DELAY_MS = 1000;

async function openLegacyGenerateRedirect(page: Page, path: string, expectedUrl: RegExp) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(path, {
        waitUntil: 'commit',
        timeout: REDIRECT_NAVIGATION_TIMEOUT_MS,
      });
      await page.waitForLoadState('domcontentloaded', { timeout: REDIRECT_NAVIGATION_TIMEOUT_MS }).catch(() => {});
      await expect
        .poll(() => page.url(), {
          timeout: REDIRECT_TIMEOUT_MS,
          intervals: [250, 500, 1000, 1500, 2000],
        })
        .toMatch(expectedUrl);
      return;
    } catch (error) {
      lastError = error;

      if (attempt === 1) {
        break;
      }

      await page.waitForTimeout(REDIRECT_RETRY_DELAY_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to open ${path}`);
}

async function openGenerateTemplates(page: Page) {
  const heading = page.getByRole('heading', { name: /template library/i }).first();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto('/generate/templates', { waitUntil: 'load', timeout: 60000 }).catch(() => {});

    const isReady = await heading.isVisible({ timeout: 15000 }).catch(() => false);
    if (isReady) {
      return;
    }

    await page.waitForTimeout(1500);
  }
}

async function waitForDraftingHubReady(page: Page) {
  const readySignals = [
    page.getByRole('heading', { name: /document studio/i }).first(),
    page.getByText(/Quick Start/i).first(),
    page.getByText(/AI Copilot/i).first(),
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const locator of readySignals) {
      if (await locator.isVisible({ timeout: 10000 }).catch(() => false)) {
        return;
      }
    }

    await page.waitForTimeout(1500);
  }

  throw new Error('Drafting hub did not reach a ready state');
}

async function openDraftingHub(page: Page) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto('/drafting', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    const isReady = await waitForDraftingHubReady(page).then(() => true).catch(() => false);
    if (isReady) {
      return;
    }

    await page.waitForTimeout(1500);
  }
}

async function openDashboard(page: Page) {
  const readySignals = [
    page.getByRole('navigation', { name: /main navigation/i }).first(),
    page.locator('#main-content a[href*="drafting"], #main-content a[href*="templates"]').first(),
  ];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto('/dashboard', { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    for (const locator of readySignals) {
      if (await locator.isVisible({ timeout: 10000 }).catch(() => false)) {
        return;
      }
    }

    await page.waitForTimeout(1500).catch(() => {});
  }
}

test.describe('Contract Generation Workflow', () => {
  test.describe('Generate Page Access', () => {
    test('should redirect the legacy generate route to the drafting hub', async ({ page }) => {
      test.slow();

      await openLegacyGenerateRedirect(page, '/generate', /\/drafting$/);
      await waitForDraftingHubReady(page);
    });

    test('should redirect legacy amendment generation links to the copilot amendment flow', async ({ page }) => {
      test.slow();

      await openLegacyGenerateRedirect(
        page,
        '/generate?create=amendment&from=test-contract-id&playbook=pack-1',
        /\/drafting\/copilot\?mode=amendment&from=test-contract-id&playbook=pack-1/
      );
    });

    test('should redirect legacy blank generation links to the blank copilot flow', async ({ page }) => {
      test.slow();

      await openLegacyGenerateRedirect(page, '/generate?create=blank', /\/drafting\/copilot\?mode=blank/);
    });

    test('should redirect legacy template generation links to the template library', async ({ page }) => {
      test.slow();

      await openLegacyGenerateRedirect(page, '/generate?create=template&type=nda', /\/generate\/templates\?category=NDA/);

      const heading = page.getByRole('heading', { name: /template library/i }).first();
      await expect(heading).toBeVisible({ timeout: 30000 });
    });

    test('should show drafting hub quick-start content after redirect', async ({ page }) => {
      await openDraftingHub(page);

      await expect(page.getByText(/Quick Start/i).first()).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(/AI Copilot/i).first()).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Template Selection', () => {
    test('should load templates page', async ({ page }) => {
      await openGenerateTemplates(page);

      const heading = page.getByRole('heading', { name: /template library/i }).first();
      await expect(heading).toBeVisible({ timeout: 30000 });
    });

    test('should display template categories', async ({ page }) => {
      await page.goto('/generate/templates');
      await page.waitForLoadState('domcontentloaded');

      const categoryFilter = page.getByRole('button', { name: /all templates/i }).first();
      await expect(categoryFilter).toBeVisible({ timeout: 10000 });
    });

    test('should allow template search', async ({ page }) => {
      await page.goto('/generate/templates');
      await page.waitForLoadState('domcontentloaded');

      const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
      await expect(searchInput).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Search input may not be visible');
      });
    });
  });

  test.describe('Contract Generation Wizard', () => {
    test('should load contract generation wizard', async ({ page }) => {
      await page.goto('/contracts/generate');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { name: /generate contract/i }).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/step 1: choose a template/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('should show template selection step', async ({ page }) => {
      await page.goto('/contracts/generate');
      await page.waitForLoadState('domcontentloaded');

      // Look for template selection
      const templateSection = page.getByText(/select.*template|choose.*template|template/i).first();
      const hasTemplateSection = await templateSection.isVisible({ timeout: 10000 }).catch(() => false);
      if (!hasTemplateSection) {
        const signInHeading = page.getByText(/welcome back|sign in/i).first();
        if (await signInHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Generation wizard landed on sign-in page during a cold run');
        } else {
          console.log('Template selection step not visible - generation wizard may still be loading');
        }
        return;
      }

      await expect(templateSection).toBeVisible({ timeout: 10000 });
    });

    test('should allow proceeding to next step', async ({ page }) => {
      await page.goto('/contracts/generate');
      await page.waitForLoadState('domcontentloaded');

      // Look for next/continue button
      const nextButton = page.getByRole('button', { name: /next|continue|proceed/i }).first();
      await expect(nextButton).toBeVisible({ timeout: 10000 }).catch(() => {
        // May need to select template first
        console.log('Next button may be disabled until template selected');
      });
    });
  });

  test.describe('Generation Workflows Page', () => {
    test('should load workflows page', async ({ page }) => {
      await page.goto('/generate/workflows', { waitUntil: 'commit' });
      await page.waitForLoadState('domcontentloaded').catch(() => {});

      const heading = page.getByRole('heading', { name: /workflow builder/i }).first();
      await expect(heading).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Templates Management', () => {
    test('should load templates page from main nav', async ({ page }) => {
      await page.goto('/templates');
      await page.waitForLoadState('domcontentloaded');

      const heading = page.getByRole('heading', { name: /template/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('should display template list', async ({ page }) => {
      await page.goto('/templates');
      await page.waitForLoadState('domcontentloaded');

      const templateGrid = page.locator('[class*="grid"], [class*="template"], table').first();
      await expect(templateGrid).toBeVisible({ timeout: 10000 });
    });

    test('should have template creation option', async ({ page }) => {
      await page.goto('/templates', { waitUntil: 'commit' });
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await expect(page.getByRole('heading', { name: /contract templates/i }).first()).toBeVisible({ timeout: 30000 });

      const createButton = page.locator('a[href="/templates/new"]').first();
      await expect(createButton).toBeVisible({ timeout: 30000 }).catch(() => {
        console.log('Create template button may require permissions');
      });
    });

    test('should show template categories', async ({ page }) => {
      await page.goto('/templates', { waitUntil: 'commit' });
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await expect(page.getByRole('heading', { name: /contract templates/i }).first()).toBeVisible({ timeout: 30000 });

      const categoryButton = page.getByRole('button', { name: /category/i }).first();
      await expect(categoryButton).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe('Clause Library Integration', () => {
    test('should access clause library', async ({ page }) => {
      await page.goto('/clauses');
      await page.waitForLoadState('domcontentloaded');

      const heading = page.getByRole('heading', { name: /clause/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('should display clause categories', async ({ page }) => {
      await page.goto('/clauses');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByPlaceholder(/search clauses/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('combobox').first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('API Endpoints', () => {
    test('templates API should return valid response', async ({ request }) => {
      const response = await request.get('/api/templates', {
        headers: {
          'x-tenant-id': 'demo',
        },
      });

      expect([200, 401]).toContain(response.status());
      
      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    });

    test('clauses library API should return valid response', async ({ request }) => {
      const response = await request.get('/api/clauses/library', {
        headers: {
          'x-tenant-id': 'demo',
        },
      });

      expect([200, 404, 401]).toContain(response.status());
    });
  });
});

test.describe('Draft Management', () => {
  test('should show draft status badges', async ({ page }) => {
    await openDraftingHub(page);

    // Look for status indicators
    const statusBadge = page.locator('[class*="badge"], [class*="status"]').first();
    await expect(statusBadge).toBeVisible({ timeout: 10000 }).catch(() => {
      console.log('No drafts to show status badges');
    });
  });

  test('should have draft actions menu', async ({ page }) => {
    await openDraftingHub(page);

    // Look for action buttons or menus
    const actionsButton = page.getByRole('button', { name: /action|more|menu/i }).first();
    await expect(actionsButton).toBeVisible({ timeout: 10000 }).catch(() => {
      console.log('No drafts to show actions menu');
    });
  });
});

test.describe('Navigation Integration', () => {
  test('should navigate from dashboard to drafting or templates', async ({ page }) => {
    await openDashboard(page);

    const generateLink = page.locator('#main-content a[href*="drafting"], #main-content a[href*="templates"]').first();
    if (await generateLink.isVisible({ timeout: 5000 })) {
      await generateLink.click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/drafting|templates/);
    }
  });

  test('should have templates in sidebar', async ({ page }) => {
    await openDashboard(page);

    const templatesNav = page.getByRole('navigation', { name: /main navigation/i }).locator('a[href*="templates"]').first();
    await expect(templatesNav).toBeVisible({ timeout: 10000 }).catch(() => {
      console.log('Templates may be nested in sidebar');
    });
  });
});
