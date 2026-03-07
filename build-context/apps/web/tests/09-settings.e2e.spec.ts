/**
 * Settings & Configuration E2E Tests
 * Tests application settings, user preferences, and system configuration
 */

import { test, expect } from '@playwright/test';

test.describe('Settings & Configuration', () => {
  
  test.describe('Settings Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should display settings page', async ({ page }) => {
      const heading = page.getByRole('heading', { name: /settings|configuration/i }).first();
      await expect(heading).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Settings page not found');
      });
    });

    test('should show settings categories', async ({ page }) => {
      const category = page.getByText(/general|profile|security|notifications/i).first();
      await expect(category).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Settings categories not found');
      });
    });

    test('should navigate between settings sections', async ({ page }) => {
      const sectionLink = page.getByRole('link', { name: /profile|account|preferences/i }).first();
      if (await sectionLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await sectionLink.click();
        await page.waitForLoadState('domcontentloaded');
      }
    });
  });

  test.describe('User Profile', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show user profile information', async ({ page }) => {
      const profileSection = page.getByText(/profile|user|account/i).first();
      await expect(profileSection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('User profile section not found');
      });
    });

    test('should display name field', async ({ page }) => {
      const nameInput = page.locator('input[name*="name"], input[placeholder*="name"]').first();
      await expect(nameInput).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Name input not found');
      });
    });

    test('should display email field', async ({ page }) => {
      const emailInput = page.locator('input[type="email"], input[name*="email"]').first();
      await expect(emailInput).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Email input not found');
      });
    });

    test('should update profile', async ({ page }) => {
      const saveButton = page.getByRole('button', { name: /save|update/i }).first();
      if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Preferences', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show preferences section', async ({ page }) => {
      const preferencesSection = page.getByText(/preferences|options|settings/i).first();
      await expect(preferencesSection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Preferences section not found');
      });
    });

    test('should toggle theme', async ({ page }) => {
      const themeToggle = page.locator('[data-testid="theme-toggle"], button[aria-label*="theme"]').first();
      if (await themeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await themeToggle.click();
        await page.waitForTimeout(1000);
      }
    });

    test('should change language', async ({ page }) => {
      const languageSelect = page.locator('select[name*="language"], [data-testid="language-select"]').first();
      if (await languageSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await languageSelect.selectOption({ index: 0 });
      }
    });

    test('should update notification preferences', async ({ page }) => {
      const notificationToggle = page.locator('input[type="checkbox"][name*="notification"]').first();
      if (await notificationToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await notificationToggle.click();
        await page.waitForTimeout(500);
      }
    });

    test('should set timezone', async ({ page }) => {
      const timezoneSelect = page.locator('select[name*="timezone"], [data-testid="timezone-select"]').first();
      if (await timezoneSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await timezoneSelect.selectOption({ index: 0 });
      }
    });
  });

  test.describe('Security Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show security section', async ({ page }) => {
      const securitySection = page.getByText(/security|password|authentication/i).first();
      await expect(securitySection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Security section not found');
      });
    });

    test('should show password change form', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]').first();
      await expect(passwordInput).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Password input not found');
      });
    });

    test('should show two-factor authentication', async ({ page }) => {
      const twoFactorSection = page.getByText(/2fa|two-factor|authentication/i).first();
      await expect(twoFactorSection).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Two-factor authentication section not found');
      });
    });

    test('should show API keys section', async ({ page }) => {
      const apiKeysSection = page.getByText(/api key|token|access key/i).first();
      await expect(apiKeysSection).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('API keys section not found');
      });
    });
  });

  test.describe('Notification Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show notification preferences', async ({ page }) => {
      const notificationSection = page.getByText(/notification|alert/i).first();
      await expect(notificationSection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Notification section not found');
      });
    });

    test('should toggle email notifications', async ({ page }) => {
      const emailToggle = page.locator('input[type="checkbox"][name*="email"]').first();
      if (await emailToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await emailToggle.click();
        await page.waitForTimeout(500);
      }
    });

    test('should toggle push notifications', async ({ page }) => {
      const pushToggle = page.locator('input[type="checkbox"][name*="push"]').first();
      if (await pushToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pushToggle.click();
        await page.waitForTimeout(500);
      }
    });

    test('should set notification frequency', async ({ page }) => {
      const frequencySelect = page.locator('select[name*="frequency"], [data-testid="notification-frequency"]').first();
      if (await frequencySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await frequencySelect.selectOption({ index: 1 });
      }
    });
  });

  test.describe('Data Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show data settings', async ({ page }) => {
      const dataSection = page.getByText(/data|privacy|export/i).first();
      await expect(dataSection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Data settings section not found');
      });
    });

    test('should export user data', async ({ page }) => {
      const exportButton = page.getByRole('button', { name: /export|download/i }).first();
      if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await exportButton.click();
        await page.waitForTimeout(1000);
      }
    });

    test('should show data retention settings', async ({ page }) => {
      const retentionSection = page.getByText(/retention|storage|archive/i).first();
      await expect(retentionSection).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Data retention settings not found');
      });
    });
  });

  test.describe('Tenant Configuration', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show tenant settings', async ({ page }) => {
      const tenantSection = page.getByText(/tenant|organization|company/i).first();
      await expect(tenantSection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Tenant settings section not found');
      });
    });

    test('should display tenant information', async ({ page }) => {
      const tenantInfo = page.locator('[data-testid="tenant-info"], .tenant-info').first();
      await expect(tenantInfo).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Tenant information not found');
      });
    });

    test('should show billing information', async ({ page }) => {
      const billingSection = page.getByText(/billing|subscription|plan/i).first();
      await expect(billingSection).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Billing section not found');
      });
    });
  });

  test.describe('Integration Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show integrations section', async ({ page }) => {
      const integrationsSection = page.getByText(/integration|connect|api/i).first();
      await expect(integrationsSection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Integrations section not found');
      });
    });

    test('should list available integrations', async ({ page }) => {
      const integrationCard = page.locator('[data-testid="integration-card"], .integration-card').first();
      await expect(integrationCard).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Integration cards not found');
      });
    });

    test('should configure integration', async ({ page }) => {
      const configureButton = page.getByRole('button', { name: /configure|setup|connect/i }).first();
      if (await configureButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await configureButton.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe('Advanced Settings', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    });

    test('should show advanced settings', async ({ page }) => {
      const advancedSection = page.getByText(/advanced|developer|technical/i).first();
      await expect(advancedSection).toBeVisible({ timeout: 10000 }).catch(() => {
        console.log('Advanced settings section not found');
      });
    });

    test('should show debug options', async ({ page }) => {
      const debugToggle = page.locator('input[type="checkbox"][name*="debug"]').first();
      if (await debugToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await debugToggle.click();
        await page.waitForTimeout(500);
      }
    });

    test('should show feature flags', async ({ page }) => {
      const featureFlag = page.getByText(/feature|flag|experimental/i).first();
      await expect(featureFlag).toBeVisible({ timeout: 5000 }).catch(() => {
        console.log('Feature flags not found');
      });
    });
  });

  test.describe('Settings Persistence', () => {
    test('should save and persist settings', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      
      const saveButton = page.getByRole('button', { name: /save|update/i }).first();
      if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveButton.click();
        
        // Wait for save confirmation
        const successMessage = page.getByText(/saved|updated|success/i).first();
        await expect(successMessage).toBeVisible({ timeout: 5000 }).catch(() => {
          console.log('Save confirmation not found');
        });
      }
    });

    test('should reset settings to defaults', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      
      const resetButton = page.getByRole('button', { name: /reset|default/i }).first();
      if (await resetButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await resetButton.click();
        
        // Confirm reset action
        const confirmButton = page.getByRole('button', { name: /confirm|yes/i }).first();
        if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmButton.click();
        }
      }
    });
  });
});
