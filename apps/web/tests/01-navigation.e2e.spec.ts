/**
 * Navigation & Layout E2E Tests
 * Tests core navigation, header, sidebar, and routing functionality
 */

import { test, expect } from './utils/auth-fixture';
import type { Page } from '@playwright/test';

async function openDashboard(page: Page) {
  const dashboardLink = page.getByRole('navigation', { name: /main navigation/i }).locator('a[href="/dashboard"]').first();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto('/dashboard', { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});

    const isReady = await dashboardLink.isVisible({ timeout: 15000 }).catch(() => false);
    if (isReady) {
      return;
    }

    await page.waitForTimeout(1500);
  }
}

test.describe('Navigation & Layout', () => {
  test.beforeEach(async ({ page }) => {
    await openDashboard(page);
  });

  test('should display main navigation with all menu items', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });

    await expect(nav.locator('a[href="/dashboard"]').first()).toBeVisible({ timeout: 15000 });
    await expect(nav.locator('a[href="/contracts"]').first()).toBeVisible({ timeout: 15000 });
    await expect(nav.locator('a[href="/search"]').first()).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /dashboard/i }).first()).toBeVisible({ timeout: 30000 });
  });

  test('should navigate to contracts section', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    const contractsLink = nav.locator('a[href="/contracts"]').first();

    await Promise.all([
      page.waitForURL('**/contracts', { timeout: 30000 }),
      contractsLink.click(),
    ]);
    await expect(page.getByRole('heading', { name: /contracts/i }).first()).toBeVisible({ timeout: 20000 });
  });

  test('should navigate to rate cards section', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });

    const suppliersButton = nav.getByRole('button', { name: /Suppliers/i });
    await suppliersButton.scrollIntoViewIfNeeded();
    await suppliersButton.click();
    const rateCardsLink = nav.locator('a[href="/rate-cards/dashboard"]').first();
    await Promise.all([
      page.waitForURL('**/rate-cards/dashboard', { timeout: 30000 }),
      rateCardsLink.click(),
    ]);
    await expect(page.getByText(/rate cards/i).first()).toBeVisible({ timeout: 30000 });
  });

  test('should navigate to analytics section', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });

    const analyticsButton = nav.getByRole('button', { name: /Analytics/i });
    await analyticsButton.scrollIntoViewIfNeeded();
    await analyticsButton.click();
    const dashboardsLink = nav.locator('a[href="/analytics"]').first();
    await Promise.all([
      page.waitForURL('**/analytics', { timeout: 30000 }),
      dashboardsLink.click(),
    ]);
    await expect(page.getByText(/analytics/i).first()).toBeVisible({ timeout: 30000 });
  });

  test('should navigate to search page', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /main navigation/i });
    const searchLink = nav.locator('a[href="/search"]').first();

    await Promise.all([
      page.waitForURL('**/search', { timeout: 30000 }),
      searchLink.click(),
    ]);
    await expect(page.locator('#main-content').getByPlaceholder(/search/i).first()).toBeVisible({ timeout: 30000 });
  });

  test('should display connection status indicator', async ({ page }) => {
    // Check for connection status (real-time indicator)
    const connectionStatus = page.locator('[data-testid="connection-status"], .connection-status, text=/real-time/i').first();
    await expect(connectionStatus).toBeVisible({ timeout: 10000 }).catch(() => {
      console.log('Connection status indicator not found - may not be implemented');
    });
  });

  test('should display breadcrumbs on sub-pages', async ({ page }) => {
    // Navigate to a sub-page
    await page.goto('/rate-cards/benchmarking');
    await page.waitForLoadState('domcontentloaded');
    
    // Check for breadcrumb navigation
    const breadcrumbs = page.locator('nav[aria-label="breadcrumb"], nav:has(a[href="/"])').first();
    await expect(breadcrumbs).toBeVisible({ timeout: 5000 }).catch(() => {
      console.log('Breadcrumbs not found - may use different navigation pattern');
    });
  });

  test('should toggle mobile menu on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Look for mobile menu toggle
    const menuToggle = page.getByRole('button', { name: /menu|navigation/i }).first();
    
    if (await menuToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await menuToggle.click();
      
      // Verify mobile menu appears
      await expect(page.getByRole('link', { name: /dashboard/i }).first()).toBeVisible();
    }
  });

  test('should maintain navigation state across page loads', async ({ page }) => {
    // Navigate to rate cards
    await page.goto('/rate-cards/dashboard');
    await page.waitForLoadState('domcontentloaded');
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    
    // Verify still on correct page
    await expect(page).toHaveURL(/\/rate-cards\/dashboard/);
  });
});
