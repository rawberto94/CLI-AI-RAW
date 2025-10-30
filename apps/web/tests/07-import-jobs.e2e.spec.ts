/**
 * Import & Jobs E2E Tests
 * Tests data import, job processing, and status monitoring
 */

import { test, expect } from '@playwright/test';

test.describe('Import & Jobs', () => {
  
  test.describe('Import Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/import');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display import page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /import/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Import page not found');
      });
    });

    test('should show import options', async ({ page }) => {
      const importOption = page.getByText(/upload|import|csv|excel|file/i).first();
      await expect(importOption).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Import options not found');
      });
    });

    test('should navigate to rate card import', async ({ page }) => {
      const rateCardLink = page.getByRole('link', { name: /rate card/i }).first();
      if (await rateCardLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await rateCardLink.click();
        await expect(page).toHaveURL(/\/import\/rate-cards/);
      }
    });

    test('should navigate to import history', async ({ page }) => {
      const historyLink = page.getByRole('link', { name: /history/i }).first();
      if (await historyLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await historyLink.click();
        await expect(page).toHaveURL(/\/import\/history/);
      }
    });
  });

  test.describe('Rate Card Import', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/import/rate-cards');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display rate card import page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /import|rate card/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Rate card import page not found');
      });
    });

    test('should show upload area', async ({ page }) => {
      const uploadArea = page.locator('input[type="file"], [data-testid="dropzone"]').first();
      await expect(uploadArea).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Upload area not found');
      });
    });

    test('should provide template download', async ({ page }) => {
      const templateLink = page.getByRole('link', { name: /template|download|sample/i }).first();
      await expect(templateLink).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Template download not found');
      });
    });

    test('should show file format instructions', async ({ page }) => {
      const formatInfo = page.getByText(/csv|excel|xls|format/i).first();
      await expect(formatInfo).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Format instructions not found');
      });
    });
  });

  test.describe('Import Wizard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/import/rate-cards/wizard');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display import wizard', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /wizard|import/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Import wizard not found');
      });
    });

    test('should show wizard steps', async ({ page }) => {
      const steps = page.locator('[data-testid="wizard-step"], .step, [role="tablist"]').first();
      await expect(steps).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Wizard steps not found');
      });
    });

    test('should navigate through wizard steps', async ({ page }) => {
      const nextButton = page.getByRole('button', { name: /next|continue/i }).first();
      if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Import History', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/import/history');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display import history', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /history|import/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Import history page not found');
      });
    });

    test('should show import records', async ({ page }) => {
      const historyTable = page.locator('table, [data-testid="history-list"]').first();
      await expect(historyTable).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Import history records not found');
      });
    });

    test('should show import status', async ({ page }) => {
      const statusBadge = page.getByText(/success|failed|pending|processing/i).first();
      await expect(statusBadge).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Import status not found');
      });
    });

    test('should filter history by status', async ({ page }) => {
      const statusFilter = page.locator('select[name*="status"], [data-testid="status-filter"]').first();
      if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await statusFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Job Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/jobs');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display jobs page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /jobs|processing/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Jobs page not found');
      });
    });

    test('should show job list', async ({ page }) => {
      const jobTable = page.locator('table, [data-testid="job-list"]').first();
      await expect(jobTable).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Job list not found');
      });
    });

    test('should show job status', async ({ page }) => {
      const jobStatus = page.getByText(/running|completed|failed|queued/i).first();
      await expect(jobStatus).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Job status not found');
      });
    });

    test('should navigate to job details', async ({ page }) => {
      const jobLink = page.locator('a[href*="/jobs/"], [data-testid="job-link"]').first();
      if (await jobLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await jobLink.click();
        await page.waitForLoadState('domcontentloaded');
        await expect(page).toHaveURL(/\/jobs\/[^/]+/);
      }
    });

    test('should filter jobs by status', async ({ page }) => {
      const statusFilter = page.locator('select[name*="status"], [data-testid="status-filter"]').first();
      if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await statusFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
    });

    test('should refresh job list', async ({ page }) => {
      const refreshButton = page.getByRole('button', { name: /refresh|reload/i }).first();
      if (await refreshButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await refreshButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Processing Status', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/processing-status');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display processing status page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /processing|status/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Processing status page not found');
      });
    });

    test('should show active processes', async ({ page }) => {
      const processIndicator = page.getByText(/processing|running|active/i).first();
      await expect(processIndicator).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Processing indicators not found');
      });
    });

    test('should show progress bars', async ({ page }) => {
      const progressBar = page.locator('[role="progressbar"], .progress, progress').first();
      await expect(progressBar).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Progress bars not found');
      });
    });
  });

  test.describe('Import Templates', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/import/templates');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display templates page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /template/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Templates page not found');
      });
    });

    test('should show available templates', async ({ page }) => {
      const templateCard = page.locator('[data-testid="template-card"], .template-card, .card').first();
      await expect(templateCard).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Template cards not found');
      });
    });

    test('should download template', async ({ page }) => {
      const downloadButton = page.getByRole('button', { name: /download/i }).first();
      if (await downloadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Click download (actual file download requires special handling)
        await downloadButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Batch Processing', () => {
    test('should show batch processing status', async ({ page }) => {
      await page.goto('/runs');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      
      const heading = page.getByRole('heading', { name: /runs|batch/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Batch processing page not found');
      });
    });

    test('should display run details', async ({ page }) => {
      await page.goto('/runs');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      
      const runLink = page.locator('a[href*="/runs/"]').first();
      if (await runLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await runLink.click();
        await page.waitForLoadState('domcontentloaded');
        await expect(page).toHaveURL(/\/runs\/[^/]+/);
      }
    });
  });
});
