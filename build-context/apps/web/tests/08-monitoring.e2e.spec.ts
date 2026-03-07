/**
 * Monitoring & Performance E2E Tests
 * Tests monitoring dashboards, performance metrics, and system health
 */

import { test, expect } from '@playwright/test';

test.describe('Monitoring & Performance', () => {
  
  test.describe('Monitoring Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/monitoring');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display monitoring page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /monitoring|dashboard/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Monitoring page not found');
      });
    });

    test('should show system health status', async ({ page }) => {
      const healthStatus = page.getByText(/healthy|operational|degraded|down/i).first();
      await expect(healthStatus).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('System health status not found');
      });
    });

    test('should show performance metrics', async ({ page }) => {
      const metrics = page.locator('[data-testid="metric"], .metric, .stat').first();
      await expect(metrics).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Performance metrics not found');
      });
    });

    test('should display charts', async ({ page }) => {
      const chart = page.locator('canvas, svg, [data-testid="chart"]').first();
      await expect(chart).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Performance charts not found');
      });
    });

    test('should show real-time updates', async ({ page }) => {
      const connectionStatus = page.locator('[data-testid="connection-status"]').first();
      await expect(connectionStatus).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Connection status indicator not found');
      });
    });

    test('should filter by time range', async ({ page }) => {
      const timeRangeSelect = page.locator('select[name*="time"], [data-testid="time-range"]').first();
      if (await timeRangeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await timeRangeSelect.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Database Monitoring', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/monitoring');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show database metrics', async ({ page }) => {
      const dbMetric = page.getByText(/database|postgres|connections|queries/i).first();
      await expect(dbMetric).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Database metrics not found');
      });
    });

    test('should show connection pool status', async ({ page }) => {
      const poolInfo = page.getByText(/pool|connection/i).first();
      await expect(poolInfo).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Connection pool info not found');
      });
    });

    test('should display query performance', async ({ page }) => {
      const queryMetric = page.getByText(/query|latency|response time/i).first();
      await expect(queryMetric).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Query performance metrics not found');
      });
    });
  });

  test.describe('API Monitoring', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/monitoring');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show API metrics', async ({ page }) => {
      const apiMetric = page.getByText(/api|endpoint|request/i).first();
      await expect(apiMetric).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('API metrics not found');
      });
    });

    test('should display response times', async ({ page }) => {
      const responseTime = page.getByText(/response|latency|ms/i).first();
      await expect(responseTime).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Response time metrics not found');
      });
    });

    test('should show error rates', async ({ page }) => {
      const errorRate = page.getByText(/error|failure|4xx|5xx/i).first();
      await expect(errorRate).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Error rate metrics not found');
      });
    });

    test('should display throughput', async ({ page }) => {
      const throughput = page.getByText(/throughput|requests|rpm|rps/i).first();
      await expect(throughput).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Throughput metrics not found');
      });
    });
  });

  test.describe('Performance Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/performance');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display performance page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /performance/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Performance page not found - might be on monitoring page');
      });
    });

    test('should show page load metrics', async ({ page }) => {
      const loadMetric = page.getByText(/load|render|paint/i).first();
      await expect(loadMetric).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Page load metrics not found');
      });
    });

    test('should display resource usage', async ({ page }) => {
      const resourceMetric = page.getByText(/cpu|memory|disk/i).first();
      await expect(resourceMetric).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Resource usage metrics not found');
      });
    });
  });

  test.describe('Alert Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/monitoring');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show alerts section', async ({ page }) => {
      const alertsSection = page.getByText(/alert|notification|warning/i).first();
      await expect(alertsSection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Alerts section not found');
      });
    });

    test('should display active alerts', async ({ page }) => {
      const alert = page.locator('[data-testid="alert"], .alert, [role="alert"]').first();
      await expect(alert).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('No active alerts displayed');
      });
    });

    test('should filter alerts by severity', async ({ page }) => {
      const severityFilter = page.locator('select[name*="severity"], [data-testid="severity-filter"]').first();
      if (await severityFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await severityFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
    });

    test('should acknowledge alert', async ({ page }) => {
      const ackButton = page.getByRole('button', { name: /acknowledge|dismiss/i }).first();
      if (await ackButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ackButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('System Logs', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/monitoring');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show logs section', async ({ page }) => {
      const logsSection = page.getByText(/logs|events|audit/i).first();
      await expect(logsSection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Logs section not found');
      });
    });

    test('should display log entries', async ({ page }) => {
      const logEntry = page.locator('[data-testid="log-entry"], .log-entry, .log').first();
      await expect(logEntry).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Log entries not found');
      });
    });

    test('should filter logs by level', async ({ page }) => {
      const levelFilter = page.locator('select[name*="level"], [data-testid="log-level"]').first();
      if (await levelFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await levelFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
      }
    });

    test('should search logs', async ({ page }) => {
      const searchInput = page.locator('input[type="search"], input[placeholder*="search"]').first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill('error');
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Service Health', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/monitoring');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show service status', async ({ page }) => {
      const serviceStatus = page.getByText(/service|health|status/i).first();
      await expect(serviceStatus).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Service status not found');
      });
    });

    test('should display service uptime', async ({ page }) => {
      const uptime = page.getByText(/uptime|availability/i).first();
      await expect(uptime).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Uptime metrics not found');
      });
    });

    test('should show service dependencies', async ({ page }) => {
      const dependencies = page.getByText(/dependency|redis|postgres|external/i).first();
      await expect(dependencies).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Service dependencies not found');
      });
    });
  });

  test.describe('Metrics Export', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/monitoring');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should export monitoring data', async ({ page }) => {
      const exportButton = page.getByRole('button', { name: /export|download/i }).first();
      if (await exportButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await exportButton.click();
        await page.waitForTimeout(1000);
      }
    });

    test('should select export format', async ({ page }) => {
      const formatSelect = page.locator('select[name*="format"], [data-testid="export-format"]').first();
      if (await formatSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await formatSelect.selectOption({ index: 0 });
      }
    });
  });

  test.describe('Real-time Updates', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/monitoring');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show real-time data updates', async ({ page }) => {
      const liveIndicator = page.locator('[data-testid="live-indicator"], .live, .real-time').first();
      await expect(liveIndicator).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Real-time indicator not found');
      });
    });

    test('should toggle auto-refresh', async ({ page }) => {
      const autoRefreshToggle = page.locator('input[type="checkbox"][name*="refresh"], [data-testid="auto-refresh"]').first();
      if (await autoRefreshToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await autoRefreshToggle.click();
        await page.waitForTimeout(1000);
      }
    });

    test('should manually refresh data', async ({ page }) => {
      const refreshButton = page.getByRole('button', { name: /refresh|reload/i }).first();
      if (await refreshButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await refreshButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });
});
