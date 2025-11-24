/**
 * Simple E2E test to verify testing infrastructure
 */

import { test, expect } from '@playwright/test';

test.describe('Simple Test', () => {
  test('should load simple test page', async ({ page }) => {
    await page.goto('/test-simple');
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Test Simple Page');
    
    // Verify test content is visible
    await expect(page.locator('[data-testid="test-content"]')).toBeVisible();
    
    // Click button
    const button = page.locator('[data-testid="test-button"]');
    await expect(button).toBeVisible();
    await button.click();
    
    console.log('Simple test passed!');
  });
});
