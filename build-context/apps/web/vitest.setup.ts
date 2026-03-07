/**
 * Vitest setup file for web app
 */
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock Next.js server-side modules
vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual,
    NextRequest: class MockNextRequest {
      url: string;
      method: string;
      headers: Map<string, string>;
      private bodyContent: string | null;
      
      constructor(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
        this.url = url;
        this.method = init?.method || 'GET';
        this.headers = new Map(Object.entries(init?.headers || {}));
        this.bodyContent = init?.body || null;
      }
      
      get(key: string) {
        return this.headers.get(key);
      }
      
      async json() {
        return this.bodyContent ? JSON.parse(this.bodyContent) : {};
      }
      
      get nextUrl() {
        return new URL(this.url);
      }
    },
    NextResponse: {
      json: (data: unknown, init?: { status?: number }) => {
        return {
          json: async () => data,
          status: init?.status || 200,
          headers: new Map([['Content-Type', 'application/json']]),
        };
      },
    },
  };
});
