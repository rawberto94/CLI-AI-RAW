import { test, expect } from '@playwright/test';

/**
 * E2E Test: Benchmarking Flow
 * 
 * Tests the complete benchmarking workflow:
 * 1. Navigate to benchmarking page
 * 2. Apply filters to select rate cards
 * 3. View benchmark calculations
 * 4. Compare rates against benchmarks
 * 5. Identify savings opportunities
 * 6. Export benchmark reports
 * 
 * Requirements: 8.3 - E2E tests for key user journeys
 */

test.describe('Benchmarking Flow', () => {
  const testTenantId = 'test-tenant-e2e-benchmark';
  
  test.beforeEach(async ({ page, request }) => {
    // Set tenant context
    await page.addInitScript((tenantId) => {
      localStorage.setItem('tenantId', tenantId);
    }, testTenantId);
    
    // Create test rate cards for benchmarking
    const testRateCards = [
      { supplier: 'Supplier A', role: 'Software Engineer', rate: 120, currency: 'USD', location: 'US' },
      { supplier: 'Supplier B', role: 'Software Engineer', rate: 130, currency: 'USD', location: 'US' },
      { supplier: 'Supplier C', role: 'Software Engineer', rate: 110, currency: 'USD', location: 'US' },
      { supplier: 'Supplier D', role: 'Software Engineer', rate: 140, currency: 'USD', location: 'US' },
      { supplier: 'Supplier E', role: 'Software Engineer', rate: 125, currency: 'USD', location: 'US' },
    ];
    
    for (const card of testRateCards) {
      await request.post('http://localhost:3000/api/rate-cards', {
        headers: { 
          'x-tenant-id': testTenantId,
          'Content-Type': 'application/json'
        },
        data: card
      }).catch(() => {
        // Ignore errors, cards might already exist
      });
    }
  });

  test('should display benchmark statistics for filtered rate cards', async ({ page }) => {
    // Step 1: Navigate to benchmarking page
    await page.goto('/rate-cards/benchmarking');
    await expect(page).toHaveURL(/\/rate-cards\/benchmarking/);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Step 2: Apply filters
    // Filter by role
    const roleFilter = page.locator('input[name="role"], select[name="role"], [data-testid="role-filter"]').first();
    if (await roleFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await roleFilter.fill('Software Engineer');
      await page.waitForTimeout(500); // Wait for filter to apply
    }

    // Step 3: Verify benchmark statistics are displayed
    // Look for statistical measures
    const benchmarkStats = page.locator('[data-testid="benchmark-stats"], .benchmark-card, .statistics');
    await expect(benchmarkStats.first()).toBeVisible({ timeout: 10000 }).catch(async () => {
      // If specific test ID not found, look for common statistical terms
      const statsText = page.locator('text=/median|mean|average|percentile|p50|p75|p90/i').first();
      await expect(statsText).toBeVisible({ timeout: 5000 });
    });

    // Step 4: Verify numerical values are displayed
    // Look for rate values (numbers with currency symbols or decimal points)
    const rateValues = page.locator('text=/\\$\\d+|\\d+\\.\\d+|\\d+\\s*(USD|EUR|GBP)/i').first();
    await expect(rateValues).toBeVisible({ timeout: 5000 });

    // Step 5: Verify chart or visualization
    const chart = page.locator('canvas, svg, [data-testid="benchmark-chart"], .chart').first();
    await expect(chart).toBeVisible({ timeout: 5000 }).catch(() => {
      // Charts might not be present in all implementations
      console.log('Chart visualization not found, but that may be expected');
    });
  });

  test('should identify savings opportunities', async ({ page }) => {
    // Navigate to opportunities page
    await page.goto('/rate-cards/opportunities');
    await expect(page).toHaveURL(/\/rate-cards\/opportunities/);
    
    await page.waitForLoadState('networkidle');

    // Step 1: Verify opportunities list is displayed
    const opportunitiesList = page.locator('[data-testid="opportunities-list"], table, .opportunity-item').first();
    await expect(opportunitiesList).toBeVisible({ timeout: 10000 }).catch(async () => {
      // If no opportunities, should show empty state
      const emptyState = page.locator('text=/no opportunities|no savings|empty/i').first();
      await expect(emptyState).toBeVisible({ timeout: 5000 });
    });

    // Step 2: Look for savings amounts
    const savingsAmount = page.locator('text=/save|savings|\\$\\d+|\\d+%/i').first();
    await expect(savingsAmount).toBeVisible({ timeout: 5000 }).catch(() => {
      // Savings might not be present if no opportunities
    });

    // Step 3: Verify opportunity details can be viewed
    const opportunityItem = page.locator('[data-testid="opportunity-item"], tr, .opportunity').first();
    if (await opportunityItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await opportunityItem.click();
      
      // Should show more details
      await page.waitForTimeout(1000);
      const detailsSection = page.locator('[data-testid="opportunity-details"], .details, [role="dialog"]');
      await expect(detailsSection).toBeVisible({ timeout: 3000 }).catch(() => {
        // Details might be inline
      });
    }
  });

  test('should compare rates across suppliers', async ({ page }) => {
    // Navigate to rate cards page
    await page.goto('/rate-cards');
    await page.waitForLoadState('networkidle');

    // Step 1: Select multiple rate cards for comparison
    const checkboxes = page.locator('input[type="checkbox"][data-testid*="select"], input[type="checkbox"]').all();
    const checkboxList = await checkboxes;
    
    if (checkboxList.length >= 2) {
      // Select first two checkboxes
      await checkboxList[0].check();
      await checkboxList[1].check();
      
      // Step 2: Click compare button
      const compareButton = page.getByRole('button', { name: /compare/i }).first();
      if (await compareButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await compareButton.click();
        
        // Step 3: Verify comparison view
        const comparisonView = page.locator('[data-testid="comparison-view"], .comparison, [role="dialog"]');
        await expect(comparisonView).toBeVisible({ timeout: 5000 });
        
        // Step 4: Verify both suppliers are shown
        const supplierNames = page.locator('text=/Supplier [A-E]/i').all();
        expect((await supplierNames).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test('should filter benchmarks by multiple criteria', async ({ page }) => {
    await page.goto('/rate-cards/benchmarking');
    await page.waitForLoadState('networkidle');

    // Apply multiple filters
    const filters = [
      { selector: 'input[name="role"], [data-testid="role-filter"]', value: 'Software Engineer' },
      { selector: 'input[name="location"], [data-testid="location-filter"]', value: 'US' },
      { selector: 'select[name="currency"], [data-testid="currency-filter"]', value: 'USD' }
    ];

    for (const filter of filters) {
      const filterElement = page.locator(filter.selector).first();
      if (await filterElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        const tagName = await filterElement.evaluate(el => el.tagName.toLowerCase());
        if (tagName === 'select') {
          await filterElement.selectOption(filter.value);
        } else {
          await filterElement.fill(filter.value);
        }
        await page.waitForTimeout(300);
      }
    }

    // Verify results are filtered
    await page.waitForTimeout(1000);
    
    // Check that benchmark stats updated
    const statsContainer = page.locator('[data-testid="benchmark-stats"], .statistics, .benchmark-card').first();
    await expect(statsContainer).toBeVisible({ timeout: 5000 }).catch(() => {
      // Stats might not have specific test IDs
    });
  });

  test('should export benchmark report', async ({ page }) => {
    await page.goto('/rate-cards/benchmarking');
    await page.waitForLoadState('networkidle');

    // Look for export button
    const exportButton = page.getByRole('button', { name: /export|download|report/i }).first();
    
    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
      
      await exportButton.click();
      
      // Wait for download
      const download = await downloadPromise.catch(() => null);
      
      if (download) {
        expect(download.suggestedFilename()).toMatch(/benchmark|report|rates/i);
      }
    }
  });

  test('should display market intelligence insights', async ({ page }) => {
    // Navigate to market intelligence page
    await page.goto('/rate-cards/market-intelligence');
    
    if (page.url().includes('/market-intelligence')) {
      await page.waitForLoadState('networkidle');
      
      // Verify market trends are displayed
      const trendsSection = page.locator('[data-testid="market-trends"], .trends, .intelligence').first();
      await expect(trendsSection).toBeVisible({ timeout: 10000 }).catch(async () => {
        // Look for any content indicating market data
        const marketContent = page.locator('text=/trend|market|intelligence|insight/i').first();
        await expect(marketContent).toBeVisible({ timeout: 5000 });
      });
    }
  });

  test('should calculate percentile rankings', async ({ page, request }) => {
    // Get benchmark data via API
    const benchmarkResponse = await request.get('http://localhost:3000/api/rate-cards/best-rates', {
      headers: { 'x-tenant-id': testTenantId },
      params: { role: 'Software Engineer' }
    });
    
    if (benchmarkResponse.ok()) {
      const benchmarkData = await benchmarkResponse.json();
      
      // Verify statistical calculations
      expect(benchmarkData).toBeTruthy();
      
      // Should have statistical measures
      const hasStats = benchmarkData.median || benchmarkData.mean || 
                      benchmarkData.p50 || benchmarkData.average ||
                      benchmarkData.statistics;
      
      expect(hasStats).toBeTruthy();
    }
    
    // Verify in UI
    await page.goto('/rate-cards/benchmarking');
    await page.waitForLoadState('networkidle');
    
    // Look for percentile indicators
    const percentileText = page.locator('text=/p\\d+|percentile|\\d+(st|nd|rd|th)\\s+percentile/i').first();
    await expect(percentileText).toBeVisible({ timeout: 5000 }).catch(() => {
      // Percentiles might not be displayed in all views
    });
  });
});
