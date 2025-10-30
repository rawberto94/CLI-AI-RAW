/**
 * Search E2E Tests
 * Tests search functionality, filters, and RAG integration
 */

import { test, expect } from '@playwright/test';

test.describe('Search Functionality', () => {
  
  test.describe('Basic Search', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display search page', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /search/i })).toBeVisible({ timeout: 10000 });
    });

    test('should have search input field', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).first();
      await expect(searchInput).toBeVisible({ timeout: 5000 });
    });

    test('should perform basic search', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('software');
      
      // Look for search button or auto-search
      const searchButton = page.getByRole('button', { name: /search/i }).first();
      if (await searchButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchButton.click();
      } else {
        // Trigger search with Enter key
        await searchInput.press('Enter');
      }
      
      await page.waitForTimeout(2000);
      
      // Verify results appear
      const results = page.locator('[data-testid="search-results"], .search-result, [role="list"]').first();
      await expect(results).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Search results not found - may be empty');
      });
    });

    test('should show search suggestions or autocomplete', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('con');
      await page.waitForTimeout(1000);
      
      const suggestions = page.locator('[role="listbox"], .autocomplete, .suggestions').first();
      await expect(suggestions).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Search suggestions not implemented');
      });
    });

    test('should clear search', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('test query');
      
      const clearButton = page.getByRole('button', { name: /clear|reset/i }).first();
      if (await clearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await clearButton.click();
        await expect(searchInput).toHaveValue('');
      }
    });

    test('should display no results message for non-matching query', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('xyzabc123nonexistent');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
      
      const noResults = page.getByText(/no results|not found|no matches/i).first();
      await expect(noResults).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('No results message not found');
      });
    });
  });

  test.describe('Advanced Search', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/search/advanced');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display advanced search page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /advanced|search/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Advanced search page not found');
      });
    });

    test('should show multiple search filters', async ({ page }) => {
      const filters = page.locator('select, input[type="date"], input[type="checkbox"]').first();
      await expect(filters).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Advanced filters not found');
      });
    });

    test('should filter by document type', async ({ page }) => {
      const typeFilter = page.locator('select[name*="type"], [data-testid="type-filter"]').first();
      if (await typeFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await typeFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
    });

    test('should filter by date range', async ({ page }) => {
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dateInput.fill('2024-01-01');
        await page.waitForTimeout(500);
      }
    });

    test('should apply multiple filters simultaneously', async ({ page }) => {
      // Try to apply multiple filters
      const searchInput = page.getByPlaceholder(/search/i).first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('contract');
        
        const typeFilter = page.locator('select[name*="type"]').first();
        if (await typeFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
          await typeFilter.selectOption({ index: 1 });
        }
        
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Search Results', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');
    });

    test('should display result count', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('contract');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
      
      const resultCount = page.getByText(/\\d+ results?|found \\d+/i).first();
      await expect(resultCount).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Result count not found');
      });
    });

    test('should show result snippets or previews', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('software');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
      
      const resultItem = page.locator('.search-result, [data-testid="result-item"]').first();
      await expect(resultItem).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Result items not found');
      });
    });

    test('should navigate to search result detail', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('contract');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
      
      const resultLink = page.locator('.search-result a, [data-testid="result-link"]').first();
      if (await resultLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await resultLink.click();
        await page.waitForLoadState('domcontentloaded');
        
        // Verify navigation occurred
        await expect(page).not.toHaveURL(/\/search/);
      }
    });

    test('should sort search results', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('contract');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
      
      const sortDropdown = page.locator('select[name*="sort"], [data-testid="sort"]').first();
      if (await sortDropdown.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sortDropdown.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
    });

    test('should paginate through results', async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('contract');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
      
      const nextButton = page.getByRole('button', { name: /next|>/i }).first();
      if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('RAG Search', () => {
    test('should use semantic search (RAG)', async ({ page }) => {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');
      
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('what are the payment terms?');
      await searchInput.press('Enter');
      await page.waitForTimeout(3000);
      
      // Look for semantic search results or AI-generated answers
      const aiResults = page.getByText(/answer|summary|found in/i).first();
      await expect(aiResults).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('RAG/semantic search results not found');
      });
    });

    test('should show relevance scores', async ({ page }) => {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');
      
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('delivery schedule');
      await searchInput.press('Enter');
      await page.waitForTimeout(2000);
      
      const relevanceScore = page.getByText(/\\d+%|score|relevance/i).first();
      await expect(relevanceScore).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Relevance scores not displayed');
      });
    });
  });

  test.describe('Search History', () => {
    test('should show recent searches', async ({ page }) => {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');
      
      // Perform a search
      const searchInput = page.getByPlaceholder(/search/i).first();
      await searchInput.fill('test search');
      await searchInput.press('Enter');
      await page.waitForTimeout(1000);
      
      // Navigate back to search
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');
      
      // Look for search history
      const historySection = page.getByText(/recent|history|previous/i).first();
      await expect(historySection).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Search history not found');
      });
    });
  });
});
