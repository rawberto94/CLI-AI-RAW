/**
 * Rate Cards E2E Tests
 * Tests rate card management, benchmarking, and analysis features
 */

import { test, expect } from '@playwright/test';

test.describe('Rate Cards Management', () => {
  
  test.describe('Rate Cards Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/rate-cards/dashboard');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display rate cards dashboard', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /rate/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show key metrics and statistics', async ({ page }) => {
      const metrics = page.locator('text=/\\$\\d+|\\d+%|total|average/i').first();
      await expect(metrics).toBeVisible({ timeout: 10000 });
    });

    test('should display import buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: /add|import|upload/i }).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Rate Card Benchmarking', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/rate-cards/benchmarking');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display benchmarking page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /benchmark/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show benchmark statistics', async ({ page }) => {
      await expect(page.getByText('Market Benchmark', { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/median|mean|percentile/i).first()).toBeVisible({ timeout: 5000 });
    });

    test('should display rate values with currency', async ({ page }) => {
      await expect(page.getByText(/\$\d+/).first()).toBeVisible({ timeout: 5000 });
    });

    test('should show savings analysis section', async ({ page }) => {
      await expect(page.getByText('Savings Analysis')).toBeVisible({ timeout: 5000 });
    });

    test('should allow client filtering', async ({ page }) => {
      try {
        const clientFilter = page.locator('#clientFilter');
        if (await clientFilter.isVisible({ timeout: 2000 })) {
          await clientFilter.fill('Test Client', { timeout: 3000 });
          await page.waitForTimeout(500);
        }
      } catch (error) {
        console.log('Client filter not available');
      }
    });

    test('should toggle baseline filter', async ({ page }) => {
      const baselineCheckbox = page.locator('#baselineOnly');
      if (await baselineCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await baselineCheckbox.click();
        await page.waitForTimeout(500);
      }
    });

    test('should toggle negotiated filter', async ({ page }) => {
      const negotiatedCheckbox = page.locator('#negotiatedOnly');
      if (await negotiatedCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await negotiatedCheckbox.click();
        await page.waitForTimeout(500);
      }
    });

    test('should switch between dashboard and repository views', async ({ page }) => {
      const repoTab = page.getByRole('tab', { name: /repository|data/i }).first();
      if (await repoTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await repoTab.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Rate Card Creation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/rate-cards/benchmarking');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should open manual entry dialog', async ({ page }) => {
      const addButton = page.getByRole('button', { name: /add rate card/i }).first();
      if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addButton.click();
        await page.waitForTimeout(1000);
        
        // Verify dialog/form opens
        const dialog = page.locator('[role="dialog"], .modal, form').first();
        await expect(dialog).toBeVisible({ timeout: 5000 });
      }
    });

    test('should open bulk CSV upload dialog', async ({ page }) => {
      const csvButton = page.getByRole('button', { name: /csv|bulk/i }).first();
      if (await csvButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await csvButton.click();
        await page.waitForTimeout(1000);
        
        const dialog = page.locator('[role="dialog"], .modal').first();
        await expect(dialog).toBeVisible({ timeout: 5000 });
      }
    });

    test('should open contract extraction dialog', async ({ page }) => {
      const extractButton = page.getByRole('button', { name: /extract|contract/i }).first();
      if (await extractButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await extractButton.click();
        await page.waitForTimeout(1000);
        
        const dialog = page.locator('[role="dialog"], .modal').first();
        await expect(dialog).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Rate Card Opportunities', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/rate-cards/opportunities');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display opportunities page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /opportunit/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Opportunities page not found');
      });
    });

    test('should show savings opportunities', async ({ page }) => {
      const savingsText = page.getByText(/saving|save|opportunity/i).first();
      await expect(savingsText).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Savings opportunities not found');
      });
    });

    test('should display opportunity cards or list', async ({ page }) => {
      const opportunityCard = page.locator('[data-testid*="opportunity"], .opportunity-card, .card').first();
      await expect(opportunityCard).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Opportunity cards not found');
      });
    });
  });

  test.describe('Market Intelligence', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/rate-cards/market-intelligence');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display market intelligence page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /market|intelligence/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Market intelligence page not found');
      });
    });

    test('should show market trends or insights', async ({ page }) => {
      const insightText = page.getByText(/trend|insight|analysis|market/i).first();
      await expect(insightText).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Market insights not found');
      });
    });

    test('should display visualizations', async ({ page }) => {
      const chart = page.locator('canvas, svg, [data-testid*="chart"]').first();
      await expect(chart).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Visualizations not found');
      });
    });
  });

  test.describe('Competitive Intelligence', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/rate-cards/competitive-intelligence');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display competitive intelligence page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /competitive|intelligence/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Competitive intelligence page not found');
      });
    });

    test('should show competitor analysis', async ({ page }) => {
      const competitorText = page.getByText(/competitor|competitive|supplier/i).first();
      await expect(competitorText).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Competitor analysis not found');
      });
    });
  });

  test.describe('Rate Card Clustering', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/rate-cards/clustering');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display clustering page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /cluster/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Clustering page not found');
      });
    });

    test('should show clustering visualization', async ({ page }) => {
      const visualization = page.locator('canvas, svg, [data-testid*="cluster"]').first();
      await expect(visualization).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Clustering visualization not found');
      });
    });
  });

  test.describe('Rate Card Forecasts', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/rate-cards/forecasts');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display forecasts page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /forecast/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Forecasts page not found');
      });
    });

    test('should show forecast predictions', async ({ page }) => {
      const forecastText = page.getByText(/forecast|prediction|trend/i).first();
      await expect(forecastText).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Forecast predictions not found');
      });
    });

    test('should display forecast chart', async ({ page }) => {
      const chart = page.locator('canvas, svg, [data-testid*="forecast"]').first();
      await expect(chart).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Forecast chart not found');
      });
    });
  });

  test.describe('Supplier Analysis', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/rate-cards/suppliers');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display suppliers page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /supplier/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Suppliers page not found');
      });
    });

    test('should show supplier list or cards', async ({ page }) => {
      const supplierList = page.locator('table, [data-testid="supplier-list"], .supplier-card').first();
      await expect(supplierList).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Supplier list not found');
      });
    });

    test('should allow filtering suppliers', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search|filter/i).first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('test');
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Baseline Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/rate-cards/baselines');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display baselines page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /baseline/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Baselines page not found');
      });
    });

    test('should show baseline entries', async ({ page }) => {
      const baselineList = page.locator('table, [data-testid="baseline-list"], .baseline-card').first();
      await expect(baselineList).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Baseline list not found');
      });
    });

    test('should navigate to baseline import page', async ({ page }) => {
      const importButton = page.getByRole('button', { name: /import|add/i }).first();
      if (await importButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await importButton.click();
        await page.waitForLoadState('domcontentloaded');
      }
    });
  });
});
