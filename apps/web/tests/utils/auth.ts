import type { APIRequestContext, Page } from '@playwright/test';

const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'admin@acme.com';
const E2E_TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'password123';

async function requestWithRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === attempts) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  throw lastError;
}

export async function authenticatePageContext(page: Page, request: APIRequestContext) {
  const existingCookies = await page.context().cookies();
  if (existingCookies.some((cookie) => cookie.name.includes('authjs.session-token'))) {
    return;
  }

  const csrfResponse = await requestWithRetry(() => request.get('/api/auth/csrf'));
  if (!csrfResponse.ok()) {
    throw new Error(`Failed to fetch auth CSRF token: ${csrfResponse.status()}`);
  }

  const csrfPayload = await csrfResponse.json();
  const csrfToken = csrfPayload?.csrfToken;

  if (!csrfToken) {
    throw new Error('CSRF token missing from auth response');
  }

  const signInResponse = await requestWithRetry(() =>
    request.post('/api/auth/callback/credentials', {
      form: {
        csrfToken,
        email: E2E_TEST_EMAIL,
        password: E2E_TEST_PASSWORD,
        redirect: 'false',
        callbackUrl: '/dashboard',
      },
    })
  );

  if (!signInResponse.ok()) {
    throw new Error(`Credential sign-in failed: ${signInResponse.status()}`);
  }

  const storageState = await request.storageState();
  const authCookies = storageState.cookies.filter((cookie) => cookie.name.includes('authjs'));

  if (authCookies.length === 0) {
    throw new Error('No auth cookies were created by credential sign-in');
  }

  await page.context().addCookies(authCookies);
}

export async function gotoAuthenticatedPage(page: Page, request: APIRequestContext, path: string) {
  await authenticatePageContext(page, request);
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
}