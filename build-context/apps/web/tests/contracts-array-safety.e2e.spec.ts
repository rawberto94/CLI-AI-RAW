/**
 * Contracts Array Safety E2E Tests
 * Tests that the contracts page handles undefined/null data gracefully
 */

import { test, expect } from '@playwright/test';

test.describe('Contracts Page Array Safety', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/contracts');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should not crash when contracts data is undefined', async ({ page }) => {
    // Intercept the API call and return undefined
    await page.route('**/api/contracts/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: undefined }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Page should still render without crashing
    await expect(page.getByRole('heading', { name: 'Contracts', exact: true })).toBeVisible({ timeout: 10000 });
    
    // Stats should show 0 for all counts
    const totalStat = page.locator('[data-testid="stat-total"]');
    await expect(totalStat).toContainText('0');
  });

  test('should not crash when contracts data is null', async ({ page }) => {
    await page.route('**/api/contracts/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /contracts/i })).toBeVisible({ timeout: 10000 });
    
    // Stats should show 0
    const activeStat = page.locator('[data-testid="stat-active"]');
    await expect(activeStat).toContainText('0');
  });

  test('should not crash when contracts data is an empty array', async ({ page }) => {
    await page.route('**/api/contracts/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: 'Contracts', exact: true })).toBeVisible({ timeout: 10000 });
    
    // Should show empty state or 0 counts
    const totalCount = page.locator('[data-testid="stat-total"]');
    await expect(totalCount).toContainText('0');
  });

  test('should handle malformed API response gracefully', async ({ page }) => {
    await page.route('**/api/contracts/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: 'invalid' }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Page should not crash - verify it renders
    await expect(page.getByRole('heading', { name: 'Contracts', exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('should display correct stats with valid contract data', async ({ page }) => {
    const mockContracts = [
      {
        id: '1',
        title: 'Test Contract 1',
        status: 'completed',
        value: 10000,
        parties: { client: 'Client A', supplier: 'Supplier A' },
      },
      {
        id: '2',
        title: 'Test Contract 2',
        status: 'processing',
        value: 20000,
        parties: { client: 'Client B', supplier: 'Supplier B' },
      },
      {
        id: '3',
        title: 'Test Contract 3',
        status: 'completed',
        value: 15000,
        parties: { client: 'Client C', supplier: 'Supplier C' },
      },
    ];

    await page.route('**/api/contracts/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockContracts }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Total should be 3
    const totalStat = page.locator('[data-testid="stat-total"]');
    await expect(totalStat).toContainText('3');

    // Active (completed) should be 2
    const activeStat = page.locator('[data-testid="stat-active"]');
    await expect(activeStat).toContainText('2');

    // Processing should be 1
    const processingStat = page.locator('[data-testid="stat-processing"]');
    await expect(processingStat).toContainText('1');

    // Total value should be $45,000
    const valueStat = page.locator('[data-testid="stat-value"]');
    await expect(valueStat).toContainText('45');
  });

  test('should filter contracts without errors', async ({ page }) => {
    const mockContracts = [
      {
        id: '1',
        title: 'Alpha Contract',
        status: 'completed',
        parties: { client: 'Client A' },
      },
      {
        id: '2',
        title: 'Beta Contract',
        status: 'processing',
        parties: { client: 'Client B' },
      },
    ];

    await page.route('**/api/contracts/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockContracts }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Search for "Alpha"
    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    if (await searchInput.isVisible({ timeout: 3000 })) {
      await searchInput.fill('Alpha');
      await page.waitForTimeout(500);

      // Should show filtered result
      await expect(page.getByText('Alpha Contract')).toBeVisible({ timeout: 3000 });
    }
  });

  test('should handle contracts with missing fields', async ({ page }) => {
    const mockContracts = [
      {
        id: '1',
        title: 'Contract Without Parties',
        status: 'completed',
        // parties field is missing
      },
      {
        id: '2',
        // title field is missing
        status: 'processing',
        parties: {},
      },
    ];

    await page.route('**/api/contracts/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: mockContracts }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Page should render without crashing
    await expect(page.getByRole('heading', { name: /contracts/i })).toBeVisible({ timeout: 10000 });

    // Total count should still be 2
    const totalStat = page.locator('[data-testid="stat-total"]');
    await expect(totalStat).toContainText('2');
  });

  test('should not throw JavaScript errors in console', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.route('**/api/contracts/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: null }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Verify page still renders
    await expect(page.getByRole('heading', { name: 'Contracts', exact: true })).toBeVisible();

    // Filter out known acceptable errors
    await expect(page.getByRole('heading', { name: 'Contracts', exact: true })).toBeVisible();

    // Filter out known acceptable errors
    const criticalErrors = errors.filter(
      (msg) => 
        !msg.includes('ResizeObserver') && 
        !msg.includes('hydration') &&
        !msg.includes('Fast Refresh')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('should refresh contracts list without errors', async ({ page }) => {
    await page.route('**/api/contracts/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Click refresh button
    const refreshButton = page.getByRole('button', { name: /refresh/i });
    if (await refreshButton.isVisible({ timeout: 3000 })) {
      await refreshButton.click();
      await page.waitForTimeout(1000);

      // Page should still be functional
      await expect(page.getByRole('heading', { name: 'Contracts', exact: true })).toBeVisible();
    }
  });
});
