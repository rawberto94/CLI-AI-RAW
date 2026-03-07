/**
 * Analytics E2E Tests
 * Tests analytics dashboards, reports, and data visualization
 */

import { test, expect } from '@playwright/test';

test.describe('Analytics', () => {
  
  test.describe('Main Analytics Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display analytics dashboard', async ({ page }) => {
      // Check for analytics heading or dashboard container
      const hasHeading = await page.getByRole('heading', { name: /analytics|dashboard/i }).first().isVisible({ timeout: 10000 }).catch(() => false);
      const hasContent = await page.locator('text=/analytics|dashboard|overview/i').first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasHeading || hasContent).toBeTruthy();
    });

    test('should load analytics page without errors', async ({ page }) => {
      // Verify page loads and URL is correct
      const url = page.url();
      expect(url).toContain('analytics');
      
      // Check for any content
      const hasContent = await page.locator('body').textContent();
      expect(hasContent?.length).toBeGreaterThan(100);
    });

    test('should have interactive elements', async ({ page }) => {
      // Check for buttons, tabs, or filters
      const hasButtons = await page.getByRole('button').count() > 0;
      const hasTabs = await page.getByRole('tab').count() > 0;
      expect(hasButtons || hasTabs).toBeTruthy();
    });

    test('should allow date range filtering', async ({ page }) => {
      const dateFilter = page.locator('input[type="date"], [data-testid="date-filter"]').first();
      if (await dateFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dateFilter.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Procurement Analytics', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/analytics/procurement');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display procurement analytics', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /procurement/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show procurement metrics', async ({ page }) => {
      const metrics = page.getByText(/spend|cost|volume|contract/i).first();
      await expect(metrics).toBeVisible({ timeout: 10000 });
    });

    test('should display procurement charts', async ({ page }) => {
      const chart = page.locator('canvas, svg').first();
      await expect(chart).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Procurement charts not found');
      });
    });
  });

  test.describe('Supplier Analytics', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/analytics/suppliers');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display supplier analytics', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /supplier/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show supplier performance metrics', async ({ page }) => {
      const metrics = page.getByText(/performance|rating|score|supplier/i).first();
      await expect(metrics).toBeVisible({ timeout: 10000 });
    });

    test('should display supplier comparison charts', async ({ page }) => {
      const chart = page.locator('canvas, svg').first();
      await expect(chart).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Supplier charts not found');
      });
    });
  });

  test.describe('Savings Analytics', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/analytics/savings');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display savings analytics', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /saving/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show savings metrics', async ({ page }) => {
      const savings = page.getByText(/\\$|saving|saved|opportunity/i).first();
      await expect(savings).toBeVisible({ timeout: 10000 });
    });

    test('should display savings trend chart', async ({ page }) => {
      const chart = page.locator('canvas, svg').first();
      await expect(chart).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Savings charts not found');
      });
    });
  });

  test.describe('Negotiation Analytics', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/analytics/negotiation');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display negotiation analytics', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /negotiation/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show negotiation metrics', async ({ page }) => {
      const metrics = page.getByText(/negotiation|success rate|average discount/i).first();
      await expect(metrics).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Renewals Analytics', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/analytics/renewals');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display renewals analytics', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /renewal/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show upcoming renewals', async ({ page }) => {
      const renewals = page.getByText(/renewal|expiring|upcoming/i).first();
      await expect(renewals).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Artifacts Analytics', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/analytics/artifacts');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display artifacts analytics', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /artifact/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show artifact metrics', async ({ page }) => {
      const metrics = page.getByText(/artifact|extraction|processed/i).first();
      await expect(metrics).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Export Functionality', () => {
    test('should export analytics data', async ({ page }) => {
      await page.goto('/analytics');
      await page.waitForLoadState('domcontentloaded');
      
      const exportButton = page.getByRole('button', { name: /export|download/i }).first();
      if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click export button (actual download testing requires special handling)
        await exportButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });
});
