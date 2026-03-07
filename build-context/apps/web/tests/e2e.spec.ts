import { test, expect } from '@playwright/test';

test('homepage shows dashboard and links to upload', async ({ page, baseURL }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Procurement CLM/i })).toBeVisible();
  // Prefer the primary navbar Upload link
  const uploadLink = page.getByRole('link', { name: 'Upload', exact: true }).first();
  await expect(uploadLink).toBeVisible();
  await uploadLink.click();
  await expect(page).toHaveURL(new RegExp(`${baseURL}.*upload`));
});
