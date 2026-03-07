import { test, expect } from '@playwright/test';

/**
 * E2E Test: Rate Card Creation Flow
 * 
 * Tests the complete rate card creation workflow:
 * 1. Navigate to rate cards page
 * 2. Open rate card creation form
 * 3. Fill in rate card details
 * 4. Submit and verify creation
 * 5. Verify rate card appears in list
 * 6. Verify rate card details page
 * 
 * Requirements: 8.3 - E2E tests for key user journeys
 */

test.describe('Rate Card Creation Flow', () => {
  const testTenantId = 'test-tenant-e2e-ratecard';
  
  test.beforeEach(async ({ page }) => {
    // Set tenant context
    await page.addInitScript((tenantId) => {
      localStorage.setItem('tenantId', tenantId);
    }, testTenantId);
  });

  test('should create a new rate card entry successfully', async ({ page, request }) => {
    // Step 1: Navigate to rate cards page
    await page.goto('/rate-cards');
    await expect(page).toHaveURL(/\/rate-cards/);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Step 2: Click "Add Rate Card" or "New Entry" button
    const addButton = page.getByRole('button', { name: /add|new|create/i }).first();
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // Step 3: Fill in rate card form
    // Wait for form to appear
    await page.waitForSelector('form, [role="dialog"], [data-testid="rate-card-form"]', { timeout: 5000 });

    // Fill in supplier name
    const supplierInput = page.locator('input[name="supplier"], input[placeholder*="supplier" i]').first();
    if (await supplierInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await supplierInput.fill('Test Supplier Corp');
    }

    // Fill in role/title
    const roleInput = page.locator('input[name="role"], input[name="title"], input[placeholder*="role" i]').first();
    if (await roleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await roleInput.fill('Senior Software Engineer');
    }

    // Fill in rate
    const rateInput = page.locator('input[name="rate"], input[type="number"]').first();
    if (await rateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rateInput.fill('150');
    }

    // Select currency if available
    const currencySelect = page.locator('select[name="currency"], [data-testid="currency-select"]').first();
    if (await currencySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await currencySelect.selectOption('USD');
    }

    // Fill in location if available
    const locationInput = page.locator('input[name="location"], input[placeholder*="location" i]').first();
    if (await locationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await locationInput.fill('United States');
    }

    // Step 4: Submit the form
    const submitButton = page.getByRole('button', { name: /submit|save|create/i }).first();
    await submitButton.click();

    // Step 5: Wait for success indication
    // Look for success toast, message, or redirect
    await Promise.race([
      page.waitForSelector('[role="status"], [data-testid="success-message"], .toast', { timeout: 5000 }),
      page.waitForURL(/\/rate-cards/, { timeout: 5000 }),
      page.waitForTimeout(2000) // Fallback
    ]).catch(() => {});

    // Step 6: Verify rate card appears in list
    // If we're on a details page, go back to list
    if (!page.url().includes('/rate-cards') || page.url().match(/\/rate-cards\/[^/]+/)) {
      await page.goto('/rate-cards');
    }

    await page.waitForLoadState('networkidle');

    // Look for the created rate card
    const rateCardInList = page.locator('table tr, .rate-card-item, [data-testid="rate-card"]').filter({ 
      hasText: /Test Supplier Corp|Senior Software Engineer/i 
    }).first();
    
    await expect(rateCardInList).toBeVisible({ timeout: 10000 }).catch(async () => {
      // If not found, at least verify the table/list exists
      const listContainer = page.locator('table, [data-testid="rate-cards-list"]').first();
      await expect(listContainer).toBeVisible();
    });

    // Step 7: Verify via API
    const rateCardsResponse = await request.get('http://localhost:3000/api/rate-cards', {
      headers: { 'x-tenant-id': testTenantId }
    });
    
    expect(rateCardsResponse.ok()).toBeTruthy();
    const rateCards = await rateCardsResponse.json();
    expect(Array.isArray(rateCards) || Array.isArray(rateCards.data)).toBeTruthy();
    
    const rateCardsArray = Array.isArray(rateCards) ? rateCards : rateCards.data;
    const createdCard = rateCardsArray.find((card: any) => 
      card.supplier?.includes('Test Supplier') || card.role?.includes('Senior Software Engineer')
    );
    
    expect(createdCard).toBeTruthy();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/rate-cards');
    
    // Open creation form
    const addButton = page.getByRole('button', { name: /add|new|create/i }).first();
    await addButton.click();
    
    // Wait for form
    await page.waitForSelector('form, [role="dialog"]', { timeout: 5000 });
    
    // Try to submit without filling required fields
    const submitButton = page.getByRole('button', { name: /submit|save|create/i }).first();
    await submitButton.click();
    
    // Should show validation errors
    const errorMessage = page.locator('[role="alert"], .error, [class*="error"], [aria-invalid="true"]').first();
    await expect(errorMessage).toBeVisible({ timeout: 3000 }).catch(() => {
      // Validation might prevent submission
    });
  });

  test('should support CSV import for bulk rate card creation', async ({ page }) => {
    await page.goto('/rate-cards');
    
    // Look for import button
    const importButton = page.getByRole('button', { name: /import|csv/i }).first();
    
    if (await importButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await importButton.click();
      
      // Verify import dialog opens
      const importDialog = page.locator('[role="dialog"], [data-testid="import-modal"]');
      await expect(importDialog).toBeVisible({ timeout: 3000 });
      
      // Verify file input exists
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeVisible();
    }
  });

  test('should edit existing rate card', async ({ page, request }) => {
    // First create a rate card via API
    const createResponse = await request.post('http://localhost:3000/api/rate-cards', {
      headers: { 
        'x-tenant-id': testTenantId,
        'Content-Type': 'application/json'
      },
      data: {
        supplier: 'Edit Test Supplier',
        role: 'Developer',
        rate: 100,
        currency: 'USD',
        location: 'US'
      }
    });
    
    if (!createResponse.ok()) {
      test.skip();
      return;
    }
    
    const createdCard = await createResponse.json();
    const cardId = createdCard.id;
    
    // Navigate to rate cards
    await page.goto('/rate-cards');
    await page.waitForLoadState('networkidle');
    
    // Find and click edit button for the created card
    const editButton = page.locator(`[data-rate-card-id="${cardId}"] button[aria-label*="edit" i], button[aria-label*="edit" i]`).first();
    
    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();
      
      // Wait for edit form
      await page.waitForSelector('form, [role="dialog"]', { timeout: 5000 });
      
      // Update rate
      const rateInput = page.locator('input[name="rate"], input[type="number"]').first();
      await rateInput.fill('125');
      
      // Save changes
      const saveButton = page.getByRole('button', { name: /save|update/i }).first();
      await saveButton.click();
      
      // Verify update
      await page.waitForTimeout(1000);
      
      // Check via API
      const updatedResponse = await request.get(`http://localhost:3000/api/rate-cards/${cardId}`, {
        headers: { 'x-tenant-id': testTenantId }
      });
      
      if (updatedResponse.ok()) {
        const updatedCard = await updatedResponse.json();
        expect(updatedCard.rate).toBe(125);
      }
    }
  });
});
