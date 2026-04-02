import { test, expect } from './utils/auth-fixture';

/**
 * E2E Test: Contracts Page Array Safety
 * Verifies that the contracts page handles undefined/null data gracefully
 */

test.describe('Contracts Page - Array Safety', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contracts');
  });

  test('should load contracts page without errors', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Contracts');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Check no console errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await page.waitForTimeout(2000);
    
    // Should not have TypeError about filter/map/reduce
    const hasArrayError = errors.some(e => 
      e.includes('.filter is not a function') ||
      e.includes('.map is not a function') ||
      e.includes('.reduce is not a function')
    );
    
    expect(hasArrayError).toBe(false);
  });

  test('should display stats cards with safe default values', async ({ page }) => {
    // Total contracts stat
    const totalStat = page.locator('[data-testid="stat-total"]');
    await expect(totalStat).toBeVisible();
    await expect(totalStat).toContainText(/\d+/); // Should show a number
    
    // Active contracts stat
    const activeStat = page.locator('[data-testid="stat-active"]');
    await expect(activeStat).toBeVisible();
    await expect(activeStat).toContainText(/\d+/);
    
    // Processing contracts stat
    const processingStat = page.locator('[data-testid="stat-processing"]');
    await expect(processingStat).toBeVisible();
    await expect(processingStat).toContainText(/\d+/);
    
    // Total value stat
    const valueStat = page.locator('[data-testid="stat-value"]');
    await expect(valueStat).toBeVisible();
    await expect(valueStat).toContainText(/\$|0/); // Should show currency or 0
  });

  test('should handle empty contracts list gracefully', async ({ page }) => {
    await page.waitForSelector('[data-testid="contracts-stats"]');
    
    // Check if empty state message exists or contracts list
    const hasEmptyState = await page.locator('text=/no contracts|empty/i').count() > 0;
    const hasContractsList = await page.locator('[data-testid^="contract-"]').count() > 0;
    
    // Either should show empty state or have contracts
    expect(hasEmptyState || hasContractsList).toBe(true);
  });

  test('should allow search and filter without crashing', async ({ page }) => {
    // Find search input
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill('test contract');
    
    await page.waitForTimeout(500);
    
    // Should not crash - page should still be functional
    await expect(page.locator('h1')).toContainText('Contracts');
  });

  test('should handle filter dropdown interactions', async ({ page }) => {
    // Look for status filter
    const filterButton = page.locator('button').filter({ hasText: /all|filter|status/i }).first();
    
    if (await filterButton.count() > 0) {
      await filterButton.click();
      await page.waitForTimeout(300);
      
      // Should not crash when interacting with filters
      await expect(page.locator('h1')).toContainText('Contracts');
    }
  });

  test('should navigate to upload page', async ({ page }) => {
    const uploadButton = page.locator('a[href="/upload"], button').filter({ hasText: /upload/i }).first();
    
    if (await uploadButton.count() > 0) {
      await uploadButton.click();
      await page.waitForURL('**/upload');
      await expect(page).toHaveURL(/\/upload/);
    }
  });

  test('should refresh contracts list', async ({ page }) => {
    const refreshButton = page.locator('button').filter({ hasText: /refresh/i }).first();
    
    if (await refreshButton.count() > 0) {
      await refreshButton.click();
      await page.waitForTimeout(1000);
      
      // Should not crash after refresh
      await expect(page.locator('h1')).toContainText('Contracts');
    }
  });
});

test.describe('Contracts Page - Contract Interactions', () => {
  test('should display contract cards when contracts exist', async ({ page }) => {
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');
    
    const contractCards = page.locator('[data-testid^="contract-"]');
    const count = await contractCards.count();
    
    if (count > 0) {
      // First contract should have title and status
      const firstContract = contractCards.first();
      await expect(firstContract).toBeVisible();
      
      // Should have some text content
      const text = await firstContract.textContent();
      expect(text).toBeTruthy();
      expect(text!.length).toBeGreaterThan(0);
    }
  });

  test('should navigate to contract details', async ({ page }) => {
    await page.goto('/contracts');
    await page.waitForLoadState('networkidle');
    
    const contractLinks = page.locator('a[href^="/contracts/"]').filter({ hasText: /view|details|^(?!.*upload)/i });
    const count = await contractLinks.count();
    
    if (count > 0) {
      const firstLink = contractLinks.first();
      await firstLink.click();
      
      // Should navigate to detail page
      await page.waitForURL('**/contracts/**');
      expect(page.url()).toMatch(/\/contracts\/[^\/]+/);
    }
  });
});

test.describe('Benchmark Compare Page - Array Safety', () => {
  test('should load benchmark compare page without array errors', async ({ page }) => {
    await page.goto('/benchmarks/compare');
    
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await page.waitForTimeout(2000);
    
    const hasArrayError = errors.some(e => 
      e.includes('.filter is not a function') ||
      e.includes('.map is not a function')
    );
    
    expect(hasArrayError).toBe(false);
  });

  test('should handle contract selection without crashing', async ({ page }) => {
    await page.goto('/benchmarks/compare');
    await page.waitForLoadState('networkidle');
    
    // Look for contract selection UI
    const selectButtons = page.locator('button').filter({ hasText: /select|add/i });
    
    if (await selectButtons.count() > 0) {
      await selectButtons.first().click();
      await page.waitForTimeout(500);
      
      // Page should still be functional
      await expect(page).toHaveURL(/\/benchmarks\/compare/);
    }
  });
});

test.describe('Rate Cards - Array Safety', () => {
  test('should load best rates view without errors', async ({ page }) => {
    // Navigate to rate cards or best rates page
    await page.goto('/rate-cards');
    await page.waitForLoadState('networkidle');
    
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await page.waitForTimeout(2000);
    
    const hasArrayError = errors.some(e => 
      e.includes('.filter is not a function') ||
      e.includes('.map is not a function')
    );
    
    expect(hasArrayError).toBe(false);
  });

  test('should handle alerts list without array errors', async ({ page }) => {
    await page.goto('/rate-cards/suppliers');
    
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await page.waitForTimeout(2000);
    
    const hasArrayError = errors.some(e => 
      e.includes('.filter is not a function')
    );
    
    expect(hasArrayError).toBe(false);
  });
});
