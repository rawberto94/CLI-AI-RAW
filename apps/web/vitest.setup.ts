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

// Mock Prisma for tests (avoid requiring real DB connection)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    $transaction: vi.fn(async (fn) => await fn({})),
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    contract: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    tenant: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    dataExportRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    deletionRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    obligation: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    notification: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    webhook: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    integrationEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    apiTokenUsageBucket: {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    webhookDelivery: {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    chatConversation: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    chatMessage: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    userSession: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    draft: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    rfx: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    rfxBid: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    rfxRequirement: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    rfxEvent: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
    share: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
  },
  getDb: vi.fn().mockResolvedValue({}),
  checkDatabaseConnection: vi.fn().mockResolvedValue(true),
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
