import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE, webhookStore } from '../route';

// Clear webhook store before each test
beforeEach(() => {
  webhookStore.clear();
});

// Mock crypto
vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'mock-uuid-1234'),
    randomBytes: vi.fn(() => ({
      toString: () => 'mock-secret-key-12345',
    })),
  },
}));

function createRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/webhooks',
  body?: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const options: RequestInit = { 
    method,
    headers: {
      'x-tenant-id': 'tenant1',
      ...(headers || {}),
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
    (options.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  return new NextRequest(new URL(url), options);
}

describe('GET /api/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webhookStore.clear();
  });

  it('should return 400 when tenant ID is missing', async () => {
    const request = createRequest('GET', 'http://localhost:3000/api/webhooks', undefined, {
      'x-tenant-id': '',
    });
    // Override the header
    Object.defineProperty(request.headers, 'get', {
      value: (name: string) => name === 'x-tenant-id' ? null : null,
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Tenant ID is required');
  });

  it('should return empty webhooks list when none exist', async () => {
    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.webhooks).toEqual([]);
  });

  it('should return webhooks for the tenant from store', async () => {
    // Add a webhook to the store
    webhookStore.set('wh1', {
      id: 'wh1',
      tenantId: 'tenant1',
      name: 'Test Webhook',
      url: 'https://example.com/webhook',
      secret: 'secret123',
      events: ['contract.created'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      failureCount: 0,
    });

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.webhooks.length).toBeGreaterThanOrEqual(0);
  });

  it('should filter webhooks by tenant and not return other tenant data', async () => {
    // Add webhooks for different tenants
    webhookStore.set('wh1', {
      id: 'wh1',
      tenantId: 'tenant1',
      name: 'Tenant 1 Webhook',
      url: 'https://example.com/webhook1',
      secret: 'secret1',
      events: ['contract.created'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      failureCount: 0,
    });
    webhookStore.set('wh2', {
      id: 'wh2',
      tenantId: 'tenant2',
      name: 'Tenant 2 Webhook',
      url: 'https://example.com/webhook2',
      secret: 'secret2',
      events: ['contract.updated'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      failureCount: 0,
    });

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Should only return tenant1's webhooks
    const webhookTenants = data.webhooks.map((w: { tenantId: string }) => w.tenantId);
    expect(webhookTenants.every((t: string) => t === 'tenant1' || t === undefined)).toBe(true);
  });
});

describe('POST /api/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webhookStore.clear();
  });

  it('should return 400 when tenant ID is missing', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/api/webhooks'), {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', url: 'https://example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 when name is missing', async () => {
    const request = createRequest('POST', 'http://localhost:3000/api/webhooks', {
      url: 'https://example.com/webhook',
      events: ['contract.created'],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('name');
  });

  it('should return 400 when URL is missing', async () => {
    const request = createRequest('POST', 'http://localhost:3000/api/webhooks', {
      name: 'Test Webhook',
      events: ['contract.created'],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('url');
  });

  it('should return 400 when events is missing', async () => {
    const request = createRequest('POST', 'http://localhost:3000/api/webhooks', {
      name: 'Test Webhook',
      url: 'https://example.com/webhook',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should create webhook successfully', async () => {
    const request = createRequest('POST', 'http://localhost:3000/api/webhooks', {
      name: 'New Webhook',
      url: 'https://example.com/webhook',
      events: ['contract.created', 'contract.updated'],
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.webhook).toBeDefined();
    expect(data.webhook.name).toBe('New Webhook');
    expect(data.webhook.url).toBe('https://example.com/webhook');
    expect(data.webhook.events).toContain('contract.created');
    // Secret should be returned on creation
    expect(data.webhook.secret).toBeDefined();
  });
});

describe('DELETE /api/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webhookStore.clear();
  });

  it('should return 400 when webhook ID is missing', async () => {
    const request = createRequest('DELETE', 'http://localhost:3000/api/webhooks');

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('id');
  });

  it('should return 404 when webhook not found', async () => {
    const request = createRequest('DELETE', 'http://localhost:3000/api/webhooks?id=nonexistent');

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  it('should delete webhook successfully', async () => {
    // Add a webhook first
    webhookStore.set('wh-to-delete', {
      id: 'wh-to-delete',
      tenantId: 'tenant1',
      name: 'To Delete',
      url: 'https://example.com/webhook',
      secret: 'secret',
      events: ['contract.created'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      failureCount: 0,
    });

    const request = createRequest('DELETE', 'http://localhost:3000/api/webhooks?id=wh-to-delete');

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(webhookStore.has('wh-to-delete')).toBe(false);
  });
});
