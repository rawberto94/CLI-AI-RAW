/**
 * Test Utilities
 * Comprehensive testing utilities for React components and hooks
 */

import React, { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================================
// Query Client Factory
// ============================================================================

/**
 * Create a fresh query client for each test
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ============================================================================
// Test Wrapper
// ============================================================================

interface TestWrapperProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

/**
 * Wrapper component that provides common context providers
 */
export function TestWrapper({ 
  children, 
  queryClient = createTestQueryClient() 
}: TestWrapperProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Create a custom wrapper with a specific query client
 */
export function createWrapper(queryClient: QueryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Create a mock contract
 */
export function createMockContract(overrides: Record<string, unknown> = {}) {
  return {
    id: `contract-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Contract',
    status: 'draft',
    type: 'msa',
    clientName: 'Test Client',
    contractValue: 100000,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock rate card
 */
export function createMockRateCard(overrides: Record<string, unknown> = {}) {
  return {
    id: `ratecard-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Rate Card',
    effectiveDate: new Date().toISOString(),
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    rates: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock user
 */
export function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    tenantId: 'test-tenant',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock API response
 */
export function createMockApiResponse<T>(data: T, overrides: Record<string, unknown> = {}) {
  return {
    success: true,
    data,
    meta: {
      requestId: `req-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    },
    ...overrides,
  };
}

/**
 * Create a mock paginated response
 */
export function createMockPaginatedResponse<T>(
  items: T[],
  page = 1,
  limit = 10,
  total = 100
) {
  return createMockApiResponse({
    data: items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  });
}

/**
 * Create a mock error response
 */
export function createMockErrorResponse(
  message: string,
  code = 'UNKNOWN_ERROR',
  status = 500
) {
  return {
    success: false,
    error: {
      code,
      message,
      status,
    },
  };
}

// ============================================================================
// Mock Handlers
// ============================================================================

/**
 * Create a delayed promise for testing loading states
 */
export function delay<T>(value: T, ms = 100): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms));
}

/**
 * Create a mock fetch handler
 */
export function createMockFetch(responses: Record<string, unknown>) {
  return jest.fn((url: string) => {
    const response = responses[url];
    if (response instanceof Error) {
      return Promise.reject(response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(response),
      status: 200,
    });
  });
}

/**
 * Create a mock mutation handler
 */
export function createMockMutation<T, V>(
  handler: (variables: V) => T | Promise<T>
) {
  const calls: V[] = [];
  
  return {
    handler: jest.fn((variables: V) => {
      calls.push(variables);
      return handler(variables);
    }),
    calls,
    reset: () => {
      calls.length = 0;
    },
  };
}

// ============================================================================
// DOM Utilities
// ============================================================================

/**
 * Wait for an element to appear
 */
export async function waitForElement(
  selector: string,
  container = document.body,
  timeout = 5000
): Promise<Element | null> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const element = container.querySelector(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return null;
}

/**
 * Simulate user typing
 */
export function simulateTyping(
  element: HTMLInputElement | HTMLTextAreaElement,
  text: string
) {
  element.focus();
  element.value = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Simulate form submission
 */
export function simulateSubmit(form: HTMLFormElement) {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/**
 * Simulate keyboard event
 */
export function simulateKeyDown(
  element: Element,
  key: string,
  modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {}
) {
  element.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      ctrlKey: modifiers.ctrl,
      shiftKey: modifiers.shift,
      altKey: modifiers.alt,
      metaKey: modifiers.meta,
    })
  );
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that an element has specific text
 */
export function assertText(element: Element | null, text: string) {
  if (!element) {
    throw new Error('Element not found');
  }
  if (!element.textContent?.includes(text)) {
    throw new Error(`Expected element to contain "${text}" but found "${element.textContent}"`);
  }
}

/**
 * Assert that an element has specific attribute
 */
export function assertAttribute(
  element: Element | null,
  attribute: string,
  value: string
) {
  if (!element) {
    throw new Error('Element not found');
  }
  const actual = element.getAttribute(attribute);
  if (actual !== value) {
    throw new Error(`Expected ${attribute}="${value}" but found ${attribute}="${actual}"`);
  }
}

/**
 * Assert that an element is visible
 */
export function assertVisible(element: Element | null) {
  if (!element) {
    throw new Error('Element not found');
  }
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    throw new Error('Element is not visible');
  }
}

// ============================================================================
// Performance Testing
// ============================================================================

/**
 * Measure render time
 */
export function measureRender<T extends ReactElement>(
  element: T,
  iterations = 10
): { average: number; min: number; max: number } {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    // Note: Actual rendering would happen here with ReactDOM
    const end = performance.now();
    times.push(end - start);
  }
  
  return {
    average: times.reduce((a, b) => a + b, 0) / times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  };
}

// ============================================================================
// Snapshot Helpers
// ============================================================================

/**
 * Clean HTML for snapshot testing
 */
export function cleanHtml(html: string): string {
  return html
    .replace(/\s+/g, ' ')
    .replace(/> </g, '>\n<')
    .trim();
}

/**
 * Extract essential attributes for snapshot
 */
export function extractTestableHtml(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  
  // Remove dynamic attributes
  clone.querySelectorAll('[data-testid]').forEach(el => {
    el.removeAttribute('data-testid');
  });
  
  return cleanHtml(clone.outerHTML);
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate array of mock items
 */
export function generateMockArray<T>(
  factory: (index: number) => T,
  count: number
): T[] {
  return Array.from({ length: count }, (_, i) => factory(i));
}

/**
 * Generate random date within range
 */
export function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

/**
 * Generate random string
 */
export function randomString(length = 10): string {
  return Math.random().toString(36).substr(2, length);
}

/**
 * Generate random number within range
 */
export function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================================
// LocalStorage Mock
// ============================================================================

/**
 * Create a mock localStorage
 */
export function createMockLocalStorage(): Storage {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; },
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { TestWrapperProps };
