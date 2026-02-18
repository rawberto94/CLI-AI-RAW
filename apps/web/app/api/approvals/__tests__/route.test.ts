/**
 * Unit Tests for Approvals API
 * Tests /api/approvals endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockExecutionFindMany, mockStepExecUpdateMany, mockStepExecFindMany,
  mockStepExecFindFirst, mockExecutionUpdate, mockNotificationCreate,
} = vi.hoisted(() => ({
  mockExecutionFindMany: vi.fn(),
  mockStepExecUpdateMany: vi.fn(),
  mockStepExecFindMany: vi.fn(),
  mockStepExecFindFirst: vi.fn(),
  mockExecutionUpdate: vi.fn(),
  mockNotificationCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workflowExecution: {
      findMany: mockExecutionFindMany,
      update: mockExecutionUpdate,
    },
    workflowStepExecution: {
      updateMany: mockStepExecUpdateMany,
      findMany: mockStepExecFindMany,
      findFirst: mockStepExecFindFirst,
    },
    notification: {
      create: mockNotificationCreate,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  workflowService: {},
}));

import { GET, POST, PATCH } from '../route';

function createAuthenticatedRequest(
  method: string,
  url: string,
  options?: { body?: object }
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

function createUnauthenticatedRequest(method: string, url: string): NextRequest {
  return new NextRequest(url, { method });
}

describe('Approvals API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/approvals', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/approvals');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns empty approvals list when no executions exist', async () => {
      mockExecutionFindMany.mockResolvedValue([]);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/approvals');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.data.items).toEqual([]);
      expect(data.data.data.stats.total).toBe(0);
    });

    it('returns approvals from database with stats', async () => {
      const mockExecs = [
        {
          id: 'exec-1',
          tenantId: 'tenant-1',
          contractId: 'c1',
          status: 'PENDING',
          createdAt: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          initiatedBy: 'user-2',
          startedBy: 'user-2',
          metadata: { priority: 'high', type: 'contract' },
          workflow: { name: 'Standard Approval', type: 'APPROVAL', description: 'desc' },
          contract: {
            id: 'c1',
            contractTitle: 'Test Contract',
            fileName: 'test.pdf',
            supplierName: 'Supplier Inc',
            totalValue: 500000,
            status: 'ACTIVE',
          },
          stepExecutions: [
            {
              id: 'step-1',
              stepName: 'Legal Review',
              stepOrder: 1,
              status: 'COMPLETED',
              assignedTo: 'reviewer-1',
              completedAt: new Date(),
            },
            {
              id: 'step-2',
              stepName: 'Finance Review',
              stepOrder: 2,
              status: 'PENDING',
              assignedTo: 'reviewer-2',
              completedAt: null,
            },
          ],
        },
      ];
      mockExecutionFindMany.mockResolvedValue(mockExecs);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/approvals');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.data.items).toHaveLength(1);
      expect(data.data.data.stats.total).toBe(1);
      expect(data.data.data.stats.pending).toBe(1);
      expect(data.data.source).toBe('database');
    });

    it('returns filter options', async () => {
      mockExecutionFindMany.mockResolvedValue([]);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/approvals');
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.data.filters).toBeDefined();
      expect(data.data.data.filters.statuses).toContain('pending');
      expect(data.data.data.filters.priorities).toContain('high');
    });

    it('handles database errors', async () => {
      mockExecutionFindMany.mockRejectedValue(new Error('Database error'));

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/approvals');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /api/approvals', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/approvals');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('approves an approval successfully', async () => {
      mockStepExecUpdateMany.mockResolvedValue({ count: 1 });
      mockStepExecFindMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
      ]);
      mockExecutionUpdate.mockResolvedValue({});
      mockStepExecFindFirst.mockResolvedValue(null);

      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/approvals', {
        body: { action: 'approve', approvalId: 'exec-1', comment: 'Looks good' },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.data.newStatus).toBe('approved');
    });

    it('rejects an approval with reason', async () => {
      mockStepExecUpdateMany.mockResolvedValue({ count: 1 });
      mockExecutionUpdate.mockResolvedValue({});

      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/approvals', {
        body: { action: 'reject', approvalId: 'exec-1', reason: 'Terms not acceptable' },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.data.newStatus).toBe('rejected');
    });

    it('returns 400 when rejecting without reason', async () => {
      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/approvals', {
        body: { action: 'reject', approvalId: 'exec-1' },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('reason is required');
    });

    it('returns 400 for invalid action', async () => {
      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/approvals', {
        body: { action: 'invalid', approvalId: 'exec-1' },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Invalid action');
    });
  });

  describe('PATCH /api/approvals', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('PATCH', 'http://localhost:3000/api/approvals');
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('returns 400 when approvalId is missing', async () => {
      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/approvals', {
        body: { updates: { priority: 'high' } },
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Approval ID is required');
    });

    it('updates approval successfully', async () => {
      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/approvals', {
        body: { approvalId: 'exec-1', updates: { priority: 'critical' } },
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Approval updated');
    });
  });
});
