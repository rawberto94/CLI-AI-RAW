/**
 * Benchmarks Compare Page Array Safety E2E Tests
 * Tests that the benchmarks compare page handles undefined/null data gracefully
 */

import { test, expect } from './utils/auth-fixture';

test.describe('Benchmarks Compare Array Safety', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/benchmarks/compare');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should not crash when contracts data is undefined', async ({ page }) => {
    await page.route('**/api/contracts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ contracts: undefined, rates: [] }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Page should render without crashing
    await expect(page.locator('h1, h2').filter({ hasText: /benchmark|compare/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should not crash when rates data is null', async ({ page }) => {
    await page.route('**/api/rate-cards*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1, h2').filter({ hasText: /benchmark|compare/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle empty contracts array', async ({ page }) => {
    await page.route('**/api/contracts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ contracts: [], rates: [] }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Should show empty state or no contracts message
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('should filter contracts without TypeError', async ({ page }) => {
    const mockData = {
      contracts: [
        { id: '1', name: 'Contract A', status: 'completed', __overview: { parties: ['Client A', 'Supplier A'] } },
        { id: '2', name: 'Contract B', status: 'processing', __overview: { parties: ['Client B', 'Supplier B'] } },
      ],
      rates: [
        { id: 'r1', role: 'Developer', dailyUsd: 500, country: 'USA', lineOfService: 'IT' },
      ],
    };

    await page.route('**/api/contracts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Try filtering if filter controls exist
    const filterButton = page.locator('button, select').filter({ hasText: /filter|client|supplier/i }).first();
    if (await filterButton.isVisible({ timeout: 3000 })) {
      await filterButton.click();
      await page.waitForTimeout(500);
    }

    // Page should still be functional
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('should handle contracts with missing __overview field', async ({ page }) => {
    const mockData = {
      contracts: [
        { id: '1', name: 'Contract Without Overview', status: 'completed' },
        { id: '2', name: 'Contract With Empty Overview', status: 'processing', __overview: {} },
      ],
      rates: [],
    };

    await page.route('**/api/contracts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('should search through filtered contracts without errors', async ({ page }) => {
    const mockData = {
      contracts: [
        { id: '1', name: 'Alpha MSA', status: 'completed', __overview: { parties: ['Client A'] } },
        { id: '2', name: 'Beta SOW', status: 'completed', __overview: { parties: ['Client B'] } },
      ],
      rates: [],
    };

    await page.route('**/api/contracts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Try to find and use search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.isVisible({ timeout: 3000 })) {
      await searchInput.fill('Alpha');
      await page.waitForTimeout(500);

      // Page should still render
      await expect(page.locator('h1, h2').first()).toBeVisible();
    }
  });

  test('should handle malformed rates data', async ({ page }) => {
    await page.route('**/api/rate-cards*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: 'not-an-array' }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
  });

  test('should not throw console errors with null data', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.route('**/api/contracts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ contracts: null, rates: null }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(
      (msg) => 
        msg.includes('filter is not a function') ||
        msg.includes('map is not a function') ||
        msg.includes('reduce is not a function')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('should filter rates by role without errors', async ({ page }) => {
    const mockData = {
      contracts: [],
      rates: [
        { id: 'r1', role: 'Developer', dailyUsd: 500, country: 'USA', lineOfService: 'IT' },
        { id: 'r2', role: 'Designer', dailyUsd: 400, country: 'UK', lineOfService: 'Creative' },
      ],
    };

    await page.route('**/api/rate-cards*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockData.rates }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Try to find role filter input
    const roleInput = page.locator('input[placeholder*="role" i]').first();
    if (await roleInput.isVisible({ timeout: 3000 })) {
      await roleInput.fill('Developer');
      await page.waitForTimeout(500);
    }

    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
