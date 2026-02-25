import { test, expect } from '@playwright/test';
import { join } from 'path';

// E2E: Upload via UI, verify progress bar updates and redirect to contract page,
// then check ingestion artifact has text.

test.describe('Upload progress and artifacts', () => {
  test('shows progress and populates artifacts', async ({ page, request }) => {
    // Warm up API
  const health = await request.get('http://localhost:3001/healthz');
    expect(health.ok()).toBeTruthy();

    // Visit upload page
    await page.goto('http://localhost:3002/upload');

    // Select a small test file (use tmp/sample-contract.txt in repo)
    const filePath = join(process.cwd(), 'tmp', 'sample-contract.txt');
    await page.setInputFiles('[data-testid="contract-upload-input"]', filePath);

    // Click Upload & Analyze
    await page.getByRole('button', { name: /upload/i }).click();

    // Progress bar should appear and eventually reach 100%
    const progressValue = page.locator('div[style*="inline-size"]');
    await expect(progressValue).toBeVisible();
    await page.waitForFunction(() => {
      const el = document.querySelector('div[style*="inline-size"]') as HTMLDivElement | null;
      if (!el) return false;
      const style = (el.getAttribute('style') || '').toLowerCase();
      const m = /inline-size:\s*([0-9.]+)%/.exec(style);
      return m ? Number(m[1]) >= 100 : false;
    }, { timeout: 30000 });

    // Redirect: URL becomes /contracts/:docId
    await page.waitForURL('**/contracts/*', { timeout: 30000 });
    const url = page.url();
    const docId = url.split('/contracts/')[1]?.split('?')[0];
    expect(docId).toBeTruthy();

    // Verify ingestion artifact exists through API (no dependency on RAG)
  const ingest = await request.get(`http://localhost:3001/api/contracts/${docId}/artifacts/ingestion.json`, {
      headers: { 'x-tenant-id': 'demo' },
    });
    expect(ingest.ok()).toBeTruthy();
    const ingJson: any = await ingest.json();
    expect(typeof ingJson?.text === 'string' && ingJson.text.length > 0).toBeTruthy();
  });
});
