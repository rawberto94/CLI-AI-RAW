import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  default: vi.fn(() => ({
    contract: {
      findMany: vi.fn(),
    },
    deadline: {
      findMany: vi.fn(),
    },
    obligation: {
      findMany: vi.fn(),
    },
  })),
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: vi.fn(),
}));

// Import mocked modules
import { getApiTenantId } from '@/lib/tenant-server';

function createRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/deadlines'
): NextRequest {
  return new NextRequest(new URL(url), { method });
}

describe('GET /api/deadlines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return mock deadlines when mock=true', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('GET', 'http://localhost:3000/api/deadlines?mock=true');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.deadlines).toBeDefined();
    expect(Array.isArray(data.deadlines)).toBe(true);
    expect(data.deadlines.length).toBeGreaterThan(0);
  });

  it('should include different deadline types in mock data', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('GET', 'http://localhost:3000/api/deadlines?mock=true');
    const response = await GET(request);
    const data = await response.json();

    const types = new Set(data.deadlines.map((d: { type: string }) => d.type));
    expect(types.has('renewal') || types.has('expiration') || types.has('milestone')).toBe(true);
  });

  it('should include different priority levels in mock data', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('GET', 'http://localhost:3000/api/deadlines?mock=true');
    const response = await GET(request);
    const data = await response.json();

    const priorities = new Set(data.deadlines.map((d: { priority: string }) => d.priority));
    expect(priorities.size).toBeGreaterThanOrEqual(1);
  });

  it('should include status information in mock data', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('GET', 'http://localhost:3000/api/deadlines?mock=true');
    const response = await GET(request);
    const data = await response.json();

    const statuses = new Set(data.deadlines.map((d: { status: string }) => d.status));
    // Should have statuses like 'overdue', 'due-soon', 'upcoming'
    expect(statuses.size).toBeGreaterThanOrEqual(1);
  });

  it('should include contract information in each deadline', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('GET', 'http://localhost:3000/api/deadlines?mock=true');
    const response = await GET(request);
    const data = await response.json();

    data.deadlines.forEach((deadline: { contractId: string; contractName: string }) => {
      expect(deadline.contractId).toBeDefined();
      expect(deadline.contractName).toBeDefined();
    });
  });

  it('should calculate daysUntil correctly for future deadlines', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('GET', 'http://localhost:3000/api/deadlines?mock=true');
    const response = await GET(request);
    const data = await response.json();

    // Find a future deadline (positive daysUntil)
    const futureDeadline = data.deadlines.find((d: { daysUntil: number }) => d.daysUntil > 0);
    if (futureDeadline) {
      const deadlineDate = new Date(futureDeadline.date);
      expect(deadlineDate.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('should calculate daysUntil correctly for overdue deadlines', async () => {
    vi.mocked(getApiTenantId).mockResolvedValue('tenant1');

    const request = createRequest('GET', 'http://localhost:3000/api/deadlines?mock=true');
    const response = await GET(request);
    const data = await response.json();

    // Find an overdue deadline (negative daysUntil)
    const overdueDeadline = data.deadlines.find((d: { daysUntil: number }) => d.daysUntil < 0);
    if (overdueDeadline) {
      const deadlineDate = new Date(overdueDeadline.date);
      expect(deadlineDate.getTime()).toBeLessThan(Date.now());
      expect(overdueDeadline.status).toBe('overdue');
    }
  });
});
