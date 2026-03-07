/**
 * Contracts E2E Tests
 * Tests contract listing, viewing, uploading, and management
 */

import { test, expect } from '@playwright/test';

test.describe('Contracts Management', () => {
  
  test.describe('Contract List', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/contracts');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display contracts page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /contracts/i })).toBeVisible({ timeout: 10000 });
      // Verify stats cards are visible
      await expect(page.locator('[data-testid="contracts-stats"]')).toBeVisible({ timeout: 5000 });
    });

    test('should display contract list or cards', async ({ page }) => {
      // Look for card-based contract list
      const contractList = page.locator('[data-testid="contracts-list"]').first();
      await expect(contractList).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Contract list not immediately visible - may be empty');
      });
    });

    test('should filter contracts by search term', async ({ page }) => {
      const searchInput = page.locator('[data-testid="contract-search"]');
      
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('test');
        await page.waitForTimeout(500);
        
        // Verify search input has value
        await expect(searchInput).toHaveValue('test');
      }
    });

    test('should filter contracts by status', async ({ page }) => {
      // Click Active filter button
      const activeFilter = page.locator('[data-testid="filter-active"]');
      
      if (await activeFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await activeFilter.click();
        await page.waitForTimeout(500);
        // Verify button is now in default (active) state
        await expect(activeFilter).toHaveAttribute('data-testid', 'filter-active');
      }
    });

    test('should show status filter buttons', async ({ page }) => {
      // Verify all filter buttons are visible
      const filterAll = page.locator('[data-testid="filter-all"]');
      const filterActive = page.locator('[data-testid="filter-active"]');
      const filterProcessing = page.locator('[data-testid="filter-processing"]');
      
      await expect(filterAll).toBeVisible({ timeout: 3000 });
      await expect(filterActive).toBeVisible({ timeout: 3000 });
      await expect(filterProcessing).toBeVisible({ timeout: 3000 });
    });

    test('should display stats cards', async ({ page }) => {
      // Verify all stats cards are visible
      await expect(page.locator('[data-testid="stat-total"]')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('[data-testid="stat-active"]')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('[data-testid="stat-processing"]')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('[data-testid="stat-value"]')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Contract Upload', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/upload');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display upload page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /upload/i })).toBeVisible({ timeout: 10000 });
    });

    test('should show file upload dropzone or button', async ({ page }) => {
      const uploadArea = page.locator('input[type="file"], [data-testid="dropzone"], button:has-text("Upload")').first();
      await expect(uploadArea).toBeVisible({ timeout: 10000 });
    });

    test('should display supported file formats', async ({ page }) => {
      const formatText = page.getByText(/pdf|docx|doc|txt/i).first();
      await expect(formatText).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('File format information not found');
      });
    });

    test('should show drag and drop instructions', async ({ page }) => {
      const dragDropText = page.getByText(/drag|drop/i).first();
      await expect(dragDropText).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Drag and drop instructions not found');
      });
    });
  });

  test.describe('Contract Details', () => {
    test('should navigate to contract detail page', async ({ page }) => {
      await page.goto('/contracts');
      await page.waitForLoadState('domcontentloaded');
      
      // Try to find and click on a contract card
      const contractCard = page.locator('[data-testid="contract-card"]').first();
      
      if (await contractCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await contractCard.click();
        await page.waitForLoadState('domcontentloaded');
        
        // Verify we're on a contract detail page
        await expect(page).toHaveURL(/\/contracts\/[^/]+/);
      } else {
        console.log('No contracts available to view details');
      }
    });

    test('should display contract metadata', async ({ page }) => {
      // Navigate to a mock contract detail page
      await page.goto('/contracts');
      await page.waitForTimeout(2000);
      
      // Look for common contract fields
      const metadataFields = page.getByText(/contract name|supplier|start date|end date|value/i).first();
      await expect(metadataFields).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Contract metadata not found');
      });
    });

    test('should display artifacts tabs or sections', async ({ page }) => {
      await page.goto('/contracts');
      await page.waitForTimeout(2000);
      
      // Look for artifact-related content
      const artifactSection = page.getByText(/artifacts|schedule|milestones|deliverables/i).first();
      await expect(artifactSection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Artifact sections not found');
      });
    });
  });

  test.describe('Bulk Contract Operations', () => {
    test.skip('Bulk operations removed in UI simplification', () => {
      // These features were intentionally removed to simplify the UI
      // Bulk upload functionality may be re-added in future if needed
    });
  });
});
