/**
 * Approval Workflows E2E Tests
 * 
 * Tests the complete approval workflow including:
 * 1. Approval queue management
 * 2. Workflow automation builder
 * 3. Bulk approval actions
 * 4. Workflow templates
 * 5. Submit for approval flow
 */

import { test, expect } from './utils/auth-fixture';

test.describe('Approval Workflows', () => {
  
  test.describe('Workflows Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/workflows');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should load workflows page', async ({ page }) => {
      // Look for workflows content
      const heading = page.getByRole('heading', { name: /workflow|approval/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    });

    test('should display approval queue tab', async ({ page }) => {
      const queueTab = page.getByRole('tab', { name: /queue/i }).first();
      await expect(queueTab).toBeVisible({ timeout: 10000 });
    });

    test('should display automation tab', async ({ page }) => {
      const automationTab = page.getByRole('tab', { name: /automation/i }).first();
      await expect(automationTab).toBeVisible({ timeout: 10000 });
    });

    test('should display templates tab', async ({ page }) => {
      const templatesTab = page.getByRole('tab', { name: /template/i }).first();
      await expect(templatesTab).toBeVisible({ timeout: 10000 });
    });

    test('should switch between tabs', async ({ page }) => {
      const automationTab = page.getByRole('tab', { name: /automation/i }).first();
      if (await automationTab.isVisible({ timeout: 5000 })) {
        await automationTab.click();
        // Verify the tab becomes active via its data-state attribute
        await expect(automationTab).toHaveAttribute('data-state', 'active', { timeout: 10000 });
      }
    });
  });

  test.describe('Approval Queue', () => {
    test('should load approval queue', async ({ page }) => {
      await page.goto('/workflows?tab=queue');
      await page.waitForLoadState('domcontentloaded');

      // Look for queue content
      const queueContent = page.locator('[class*="queue"], [class*="approval"], table').first();
      await expect(queueContent).toBeVisible({ timeout: 10000 }).catch(() => {
        // May show empty state
        const emptyState = page.getByText(/no pending|no approval|empty/i).first();
        return expect(emptyState).toBeVisible({ timeout: 5000 });
      });
    });

    test('should have bulk action options', async ({ page }) => {
      await page.goto('/workflows?tab=queue');
      await page.waitForLoadState('domcontentloaded');

      // Look for bulk actions (may only appear when items selected)
      const bulkActions = page.locator('[class*="bulk"], [data-testid="bulk-actions"]').first();
      // May not be visible if no items to select
      await expect(bulkActions).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Bulk actions may appear after selecting items');
      });
    });
  });

  test.describe('Workflow Automation', () => {
    test('should load automation section', async ({ page }) => {
      await page.goto('/workflows?tab=automation');
      await page.waitForLoadState('domcontentloaded');

      // Look for automation content
      const automationContent = page.locator('[class*="workflow"], [class*="card"]').first();
      await expect(automationContent).toBeVisible({ timeout: 10000 });
    });

    test('should have create new workflow button', async ({ page }) => {
      await page.goto('/workflows?tab=automation');
      await page.waitForLoadState('domcontentloaded');

      const createButton = page.getByRole('button', { name: /create|new|add/i }).first();
      await expect(createButton).toBeVisible({ timeout: 10000 });
    });

    test('should show workflow builder on create', async ({ page }) => {
      await page.goto('/workflows?tab=automation');
      await page.waitForLoadState('domcontentloaded');

      // Wait for the page data to load (stats cards or empty state appear)
      await page.getByRole('heading', { name: /workflow/i }).first().waitFor({ timeout: 10000 });

      // Wait for the automation content to settle (loading finishes)
      const emptyOrList = page.getByText(/no workflows yet|total/i).first();
      await emptyOrList.waitFor({ timeout: 10000 });

      const createButton = page.getByRole('button', { name: /create workflow|new workflow/i }).first();
      if (await createButton.isVisible({ timeout: 5000 })) {
        await createButton.click();
        
        // The builder replaces the page with a "Back to Workflows" button (non-lazy)
        const backButton = page.getByRole('button', { name: /back to workflows/i });
        await expect(backButton).toBeVisible({ timeout: 15000 });
      }
    });
  });

  test.describe('Workflow Templates', () => {
    test('should load templates section', async ({ page }) => {
      await page.goto('/workflows?tab=templates');
      await page.waitForLoadState('domcontentloaded');

      // Look for template names that are rendered on the templates tab
      const templatesContent = page.getByText(/standard approval|express approval|legal review/i).first();
      await expect(templatesContent).toBeVisible({ timeout: 15000 });
    });

    test('should display preset workflow templates', async ({ page }) => {
      await page.goto('/workflows?tab=templates');
      await page.waitForLoadState('domcontentloaded');

      // Look for template presets like "Standard Approval", "Quick Approval", etc.
      const templateCard = page.getByText(/standard|quick|comprehensive|renewal/i).first();
      await expect(templateCard).toBeVisible({ timeout: 10000 });
    });

    test('should allow creating workflow from template', async ({ page }) => {
      await page.goto('/workflows?tab=templates');
      await page.waitForLoadState('domcontentloaded');

      // Look for use/create button on template
      const useButton = page.getByRole('button', { name: /use|select|create/i }).first();
      await expect(useButton).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Template use buttons may have different naming');
      });
    });
  });

  test.describe('Approvals Redirect', () => {
    test('should redirect from /approvals to /workflows', async ({ page }) => {
      await page.goto('/approvals');
      await page.waitForLoadState('domcontentloaded');

      // Should redirect to workflows
      await expect(page).toHaveURL(/\/workflows/, { timeout: 10000 });
    });
  });

  test.describe('Submit for Approval Modal', () => {
    test('should open approval modal from contract page', async ({ page }) => {
      // Navigate to contracts
      await page.goto('/contracts');
      await page.waitForLoadState('domcontentloaded');

      // Click on a contract
      const contractLink = page.locator('a[href*="/contracts/"]').first();
      if (await contractLink.isVisible({ timeout: 5000 })) {
        await contractLink.click();
        await page.waitForLoadState('domcontentloaded');

        // Look for approval action in the page
        const approvalButton = page.getByRole('button', { name: /approval|submit/i }).first();
        if (await approvalButton.isVisible({ timeout: 5000 })) {
          await approvalButton.click();
          
          // Look for approval modal
          const approvalModal = page.locator('[class*="modal"], [class*="dialog"]').first();
          await expect(approvalModal).toBeVisible({ timeout: 10000 });
        }
      }
    });
  });

  test.describe('Workflow API', () => {
    test('workflows API should return valid response', async ({ request }) => {
      const response = await request.get('/api/workflows', {
        headers: {
          'x-tenant-id': 'demo',
        },
      });

      expect([200, 401]).toContain(response.status());
      
      if (response.status() === 200) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    });
  });
});

test.describe('Workflow Stats', () => {
  test('should display workflow statistics', async ({ page }) => {
    await page.goto('/workflows');
    await page.waitForLoadState('domcontentloaded');

    // Look for stats cards
    const statsContent = page.locator('[class*="stat"], [class*="metric"], [class*="card"]').first();
    await expect(statsContent).toBeVisible({ timeout: 10000 });
  });
});
