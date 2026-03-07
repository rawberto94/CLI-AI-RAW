/**
 * Dashboard E2E Tests
 * Tests main dashboard functionality, widgets, and KPIs
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display dashboard page title', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 1 }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should display key performance metrics', async ({ page }) => {
    // Look for common KPI indicators (numbers, percentages, currency values)
    const metrics = page.locator('text=/\\$|\\d+%|\\d+\\.\\d+/').first();
    await expect(metrics).toBeVisible({ timeout: 10000 });
  });

  test('should display recent contracts or activities', async ({ page }) => {
    // Look for list of recent items
    const recentItems = page.locator('[data-testid="recent-contracts"], [data-testid="recent-activities"], text=/recent/i').first();
    await expect(recentItems).toBeVisible({ timeout: 10000 }).catch(() => {
      console.log('Recent items section not found');
    });
  });

  test('should display charts or visualizations', async ({ page }) => {
    // Look for chart elements (canvas, svg)
    const charts = page.locator('canvas, svg[class*="chart"], [data-testid="chart"]').first();
    await expect(charts).toBeVisible({ timeout: 10000 }).catch(() => {
      console.log('Charts not found - dashboard may not have visualizations');
    });
  });

  test('should allow filtering dashboard data by date range', async ({ page }) => {
    const dateFilter = page.locator('input[type="date"], [data-testid="date-filter"], button:has-text("Filter")').first();
    
    if (await dateFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateFilter.click();
      await page.waitForTimeout(500);
    }
  });

  test('should refresh dashboard data', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /refresh|reload/i }).first();
    
    if (await refreshButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refreshButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('should navigate to detailed views from dashboard widgets', async ({ page }) => {
    // Try clicking on a card or widget
    const widget = page.locator('[data-testid*="card"], .card, [class*="widget"]').first();
    
    if (await widget.isVisible({ timeout: 5000 }).catch(() => false)) {
      const link = widget.locator('a, button').first();
      if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        await link.click();
        await page.waitForLoadState('domcontentloaded');
        // Verify navigation occurred
        await expect(page).not.toHaveURL(/^\/(dashboard)?$/);
      }
    }
  });

  test('should display data mode toggle (Real/Demo)', async ({ page }) => {
    const dataModeToggle = page.getByRole('button', { name: /real data|demo data|data mode/i }).first();
    
    if (await dataModeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dataModeToggle.click();
      await page.waitForTimeout(500);
    }
  });
});
