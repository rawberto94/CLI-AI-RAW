/**
 * Test Utilities
 * 
 * Common testing utilities, mocks, and helpers for Jest/Vitest testing.
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// PROVIDERS
// ============================================================================

interface AllProvidersProps {
  children: ReactNode;
}

/**
 * Wrapper component that includes all providers for testing.
 * Add providers here as needed (QueryClient, Theme, etc.)
 */
function AllProviders({ children }: AllProvidersProps): React.ReactElement {
  return React.createElement(React.Fragment, null, children);
}

// ============================================================================
// CUSTOM RENDER
// ============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
}

interface CustomRenderResult extends RenderResult {
  user: ReturnType<typeof userEvent.setup>;
}

/**
 * Custom render function that wraps component in all providers.
 * 
 * @example
 * ```ts
 * const { getByRole, user } = renderWithProviders(<MyComponent />);
 * await user.click(getByRole('button'));
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
): CustomRenderResult {
  const user = userEvent.setup();

  return {
    user,
    ...render(ui, { wrapper: AllProviders, ...options }),
  };
}

// ============================================================================
// MOCKS
// ============================================================================

/**
 * Mock Next.js router
 */
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  pathname: '/',
  query: {},
  asPath: '/',
  route: '/',
  basePath: '',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
};

/**
 * Mock Next.js useRouter hook
 */
export function mockUseRouter() {
  const useRouter = jest.fn(() => mockRouter);
  jest.mock('next/navigation', () => ({
    useRouter,
    usePathname: jest.fn(() => '/'),
    useSearchParams: jest.fn(() => new URLSearchParams()),
  }));
  return { useRouter, mockRouter };
}

/**
 * Mock fetch API
 */
export function mockFetch(response: unknown, status = 200) {
  const mockFn = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
      headers: new Headers(),
    })
  );
  
  global.fetch = mockFn as jest.Mock;
  return mockFn;
}

/**
 * Mock API response with typed data
 */
export function mockApiResponse<T>(data: T, options?: {
  status?: number;
  delay?: number;
  headers?: Record<string, string>;
}) {
  const { status = 200, delay = 0, headers = {} } = options || {};
  
  return jest.fn(() =>
    new Promise((resolve) =>
      setTimeout(() => {
        resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(JSON.stringify(data)),
          headers: new Headers(headers),
        });
      }, delay)
    )
  );
}

/**
 * Mock local storage
 */
export function mockLocalStorage() {
  const store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] || null),
  };
}

/**
 * Mock session storage
 */
export function mockSessionStorage() {
  return mockLocalStorage();
}

/**
 * Mock IntersectionObserver
 */
export function mockIntersectionObserver() {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.IntersectionObserver = mockIntersectionObserver;
  return mockIntersectionObserver;
}

/**
 * Mock ResizeObserver
 */
export function mockResizeObserver() {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: () => null,
    unobserve: () => null,
    disconnect: () => null,
  });
  window.ResizeObserver = mockResizeObserver;
  return mockResizeObserver;
}

/**
 * Mock matchMedia
 */
export function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

let idCounter = 1;

/**
 * Generate unique test ID
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${idCounter++}`;
}

/**
 * Reset test ID counter (use in beforeEach)
 */
export function resetTestIds(): void {
  idCounter = 1;
}

/**
 * Create test contract data
 */
export function createTestContract(overrides: Partial<{
  id: string;
  name: string;
  status: string;
  client: string;
  supplier: string;
  value: number;
  startDate: string;
  endDate: string;
}> = {}) {
  return {
    id: generateTestId('contract'),
    name: 'Test Contract',
    status: 'draft',
    client: 'Test Client',
    supplier: 'Test Supplier',
    value: 100000,
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    ...overrides,
  };
}

/**
 * Create test user data
 */
export function createTestUser(overrides: Partial<{
  id: string;
  name: string;
  email: string;
  role: string;
}> = {}) {
  return {
    id: generateTestId('user'),
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    ...overrides,
  };
}

/**
 * Create test rate card data
 */
export function createTestRateCard(overrides: Partial<{
  id: string;
  name: string;
  supplierName: string;
  clientName: string;
  currency: string;
  roles: Array<{ role: string; level: string; dailyRate: number }>;
}> = {}) {
  return {
    id: generateTestId('ratecard'),
    name: 'Test Rate Card',
    supplierName: 'Test Supplier',
    clientName: 'Test Client',
    currency: 'USD',
    roles: [
      { role: 'Developer', level: 'Senior', dailyRate: 1200 },
      { role: 'Developer', level: 'Junior', dailyRate: 600 },
    ],
    ...overrides,
  };
}

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

/**
 * Wait for a specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }
  
  throw new Error(`waitFor timed out after ${timeout}ms`);
}

// ============================================================================
// ACCESSIBILITY UTILITIES
// ============================================================================

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');
  
  return Array.from(container.querySelectorAll(focusableSelectors));
}

/**
 * Check if element is visible (not hidden by CSS)
 */
export function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export * from '@testing-library/react';
export { userEvent };
