/**
 * Unit Tests for Workflows API
 * Tests /api/workflows endpoint
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockWorkflowFindMany, mockWorkflowCreate, mockWorkflowUpdate,
  mockWorkflowFindFirst, mockWorkflowDelete, mockStepDeleteMany, mockStepCreateMany,
} = vi.hoisted(() => ({
  mockWorkflowFindMany: vi.fn(),
  mockWorkflowCreate: vi.fn(),
  mockWorkflowUpdate: vi.fn(),
  mockWorkflowFindFirst: vi.fn(),
  mockWorkflowDelete: vi.fn(),
  mockStepDeleteMany: vi.fn(),
  mockStepCreateMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workflow: {
      findMany: mockWorkflowFindMany,
      create: mockWorkflowCreate,
      update: mockWorkflowUpdate,
      findFirst: mockWorkflowFindFirst,
      delete: mockWorkflowDelete,
    },
    workflowStep: {
      deleteMany: mockStepDeleteMany,
      createMany: mockStepCreateMany,
    },
  },
}));

vi.mock('data-orchestration/services', () => ({
  workflowService: {},
}));

import { GET, POST, PATCH, DELETE } from '../route';

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

describe('Workflows API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/workflows', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('GET', 'http://localhost:3000/api/workflows');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns workflows list successfully', async () => {
      const mockWorkflows = [
        {
          id: 'wf1',
          name: 'Approval Workflow',
          description: 'Standard approval process',
          type: 'APPROVAL',
          isActive: true,
          tenantId: 'tenant-1',
          createdAt: new Date(),
          steps: [{ id: 's1', name: 'Step 1', order: 0 }],
          _count: { executions: 5 },
        },
      ];
      mockWorkflowFindMany.mockResolvedValue(mockWorkflows);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/workflows');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.workflows).toHaveLength(1);
      expect(data.data.workflows[0].name).toBe('Approval Workflow');
      expect(data.data.workflows[0].executions).toBe(5);
      expect(data.data.total).toBe(1);
    });

    it('filters workflows by type', async () => {
      mockWorkflowFindMany.mockResolvedValue([]);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/workflows?type=RENEWAL');
      await GET(request);

      expect(mockWorkflowFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'RENEWAL' }),
        })
      );
    });

    it('filters workflows by isActive', async () => {
      mockWorkflowFindMany.mockResolvedValue([]);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/workflows?isActive=true');
      await GET(request);

      expect(mockWorkflowFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      );
    });

    it('handles database errors gracefully', async () => {
      mockWorkflowFindMany.mockRejectedValue(new Error('Database error'));

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/workflows');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('returns empty list when no workflows', async () => {
      mockWorkflowFindMany.mockResolvedValue([]);

      const request = createAuthenticatedRequest('GET', 'http://localhost:3000/api/workflows');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.workflows).toEqual([]);
      expect(data.data.total).toBe(0);
    });
  });

  describe('POST /api/workflows', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('POST', 'http://localhost:3000/api/workflows');
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('returns 400 when workflow name is missing', async () => {
      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/workflows', {
        body: {},
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('name is required');
    });

    it('creates workflow successfully', async () => {
      const mockWorkflow = {
        id: 'wf1',
        name: 'New Workflow',
        description: 'Test workflow',
        type: 'APPROVAL',
        isActive: true,
        tenantId: 'tenant-1',
        createdAt: new Date(),
        steps: [],
      };
      mockWorkflowCreate.mockResolvedValue(mockWorkflow);

      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/workflows', {
        body: { name: 'New Workflow', description: 'Test workflow', type: 'APPROVAL' },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.workflow.name).toBe('New Workflow');
      expect(data.data.message).toBe('Workflow created successfully');
    });

    it('creates workflow with steps', async () => {
      const mockWorkflow = {
        id: 'wf1',
        name: 'With Steps',
        type: 'APPROVAL',
        isActive: true,
        tenantId: 'tenant-1',
        steps: [{ id: 's1', name: 'Review', order: 0, type: 'APPROVAL' }],
      };
      mockWorkflowCreate.mockResolvedValue(mockWorkflow);

      const request = createAuthenticatedRequest('POST', 'http://localhost:3000/api/workflows', {
        body: {
          name: 'With Steps',
          steps: [{ name: 'Review', type: 'APPROVAL' }],
        },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.workflow.steps).toHaveLength(1);
    });
  });

  describe('PATCH /api/workflows', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('PATCH', 'http://localhost:3000/api/workflows');
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('returns 400 when workflow ID is missing', async () => {
      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/workflows', {
        body: { name: 'Updated' },
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Workflow ID is required');
    });

    it('returns 404 when workflow not found', async () => {
      mockWorkflowFindFirst.mockResolvedValue(null);

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/workflows', {
        body: { id: 'nonexistent', name: 'Updated' },
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toContain('not found');
    });

    it('updates workflow successfully', async () => {
      mockWorkflowFindFirst.mockResolvedValue({ id: 'wf1' });
      mockWorkflowUpdate.mockResolvedValue({
        id: 'wf1',
        name: 'Updated Workflow',
        steps: [],
      });

      const request = createAuthenticatedRequest('PATCH', 'http://localhost:3000/api/workflows', {
        body: { id: 'wf1', name: 'Updated Workflow' },
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.message).toBe('Workflow updated successfully');
    });
  });

  describe('DELETE /api/workflows', () => {
    it('returns 401 without auth headers', async () => {
      const request = createUnauthenticatedRequest('DELETE', 'http://localhost:3000/api/workflows?id=wf1');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('returns 400 when workflow ID is missing', async () => {
      const request = createAuthenticatedRequest('DELETE', 'http://localhost:3000/api/workflows');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.message).toContain('Workflow ID is required');
    });

    it('returns 404 when workflow not found', async () => {
      mockWorkflowFindFirst.mockResolvedValue(null);

      const request = createAuthenticatedRequest('DELETE', 'http://localhost:3000/api/workflows?id=nonexistent');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.message).toContain('not found');
    });

    it('deletes workflow successfully', async () => {
      mockWorkflowFindFirst.mockResolvedValue({ id: 'wf1' });
      mockWorkflowDelete.mockResolvedValue({});

      const request = createAuthenticatedRequest('DELETE', 'http://localhost:3000/api/workflows?id=wf1');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.message).toBe('Workflow deleted successfully');
    });
  });
});
