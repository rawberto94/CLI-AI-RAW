import { test as base, expect } from '@playwright/test';
import { authenticatePageContext } from './auth';

const E2E_COMPLETED_ONBOARDING = ['upload', 'explore', 'chat', 'customize'];

export const test = base.extend({
  page: async ({ page, request }, use) => {
    await page.addInitScript((completedSteps: string[]) => {
      const now = Date.now();

      window.localStorage.setItem('contigo-tutorial-completed', 'true');
      window.localStorage.setItem(
        'contigo_onboarding_progress',
        JSON.stringify({
          completedSteps,
          dismissed: true,
          startedAt: now,
          completedAt: now,
        }),
      );

      window.localStorage.setItem('onboarding_uploaded', 'true');
      window.localStorage.setItem('onboarding_explored', 'true');
      window.localStorage.setItem('onboarding_chatted', 'true');
      window.localStorage.setItem('onboarding_customized', 'true');

      window.sessionStorage.removeItem('viewAsTenantId');
    }, E2E_COMPLETED_ONBOARDING);

    await authenticatePageContext(page, request);
    await use(page);
  },
});

export { expect };
export type { APIRequestContext, BrowserContext, Page } from '@playwright/test';