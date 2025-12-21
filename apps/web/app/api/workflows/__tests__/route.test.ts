import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workflow: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    workflowStep: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/tenant-server', () => ({
  getApiTenantId: vi.fn(),
}));

// Import mocked modules
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

function createRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/api/workflows',
  body?: Record<string, unknown>
): NextRequest {
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url), options);
}

describe('GET /api/workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when tenant ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue(null);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Tenant ID is required');
  });

  it('should return workflows list successfully', async () => {
    const mockWorkflows = [
      {
        id: 'wf1',
        name: 'Approval Workflow',
        description: 'Standard approval process',
        type: 'APPROVAL',
        isActive: true,
        tenantId: 'tenant1',
        createdAt: new Date(),
        steps: [{ id: 's1', name: 'Step 1', order: 0 }],
        _count: { executions: 5 },
      },
    ];

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.workflow.findMany).mockResolvedValue(mockWorkflows);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.workflows).toHaveLength(1);
    expect(data.workflows[0].name).toBe('Approval Workflow');
    expect(data.workflows[0].executions).toBe(5);
    expect(data.total).toBe(1);
  });

  it('should filter workflows by type', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.workflow.findMany).mockResolvedValue([]);

    const request = createRequest('GET', 'http://localhost:3000/api/workflows?type=RENEWAL');
    await GET(request);

    expect(prisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant1', type: 'RENEWAL' }),
      })
    );
  });

  it('should filter workflows by isActive', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.workflow.findMany).mockResolvedValue([]);

    const request = createRequest('GET', 'http://localhost:3000/api/workflows?isActive=true');
    await GET(request);

    expect(prisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant1', isActive: true }),
      })
    );
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.workflow.findMany).mockRejectedValue(new Error('Database error'));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch workflows');
    expect(data.details).toBe('Database error');
  });
});

describe('POST /api/workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when tenant ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue(null);

    const request = createRequest('POST', 'http://localhost:3000/api/workflows', { name: 'Test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Tenant ID is required');
  });

  it('should return 400 when workflow name is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');

    const request = createRequest('POST', 'http://localhost:3000/api/workflows', {});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Workflow name is required');
  });

  it('should create workflow successfully', async () => {
    const mockWorkflow = {
      id: 'wf1',
      name: 'New Workflow',
      description: 'Test workflow',
      type: 'APPROVAL',
      isActive: true,
      tenantId: 'tenant1',
      createdAt: new Date(),
      steps: [],
    };

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.workflow.create).mockResolvedValue(mockWorkflow);

    const request = createRequest('POST', 'http://localhost:3000/api/workflows', {
      name: 'New Workflow',
      description: 'Test workflow',
      type: 'APPROVAL',
      steps: [],
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.workflow.name).toBe('New Workflow');
    expect(data.message).toBe('Workflow created successfully');
  });

  it('should create workflow with steps', async () => {
    const mockWorkflow = {
      id: 'wf1',
      name: 'Workflow with Steps',
      description: 'Has steps',
      type: 'APPROVAL',
      isActive: true,
      tenantId: 'tenant1',
      createdAt: new Date(),
      steps: [
        { id: 's1', name: 'Review', order: 0 },
        { id: 's2', name: 'Approve', order: 1 },
      ],
    };

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.workflow.create).mockResolvedValue(mockWorkflow);

    const request = createRequest('POST', 'http://localhost:3000/api/workflows', {
      name: 'Workflow with Steps',
      steps: [
        { name: 'Review', type: 'REVIEW' },
        { name: 'Approve', type: 'APPROVAL' },
      ],
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.workflow.create).toHaveBeenCalled();
  });

  it('should handle creation errors gracefully', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.workflow.create).mockRejectedValue(new Error('Unique constraint violation'));

    const request = createRequest('POST', 'http://localhost:3000/api/workflows', {
      name: 'Duplicate Workflow',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to create workflow');
  });
});

describe('PATCH /api/workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when tenant ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue(null);

    const request = createRequest('PATCH', 'http://localhost:3000/api/workflows', { id: 'wf1' });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Tenant ID is required');
  });

  it('should return 400 when workflow ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');

    const request = createRequest('PATCH', 'http://localhost:3000/api/workflows', { name: 'Updated' });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Workflow ID is required');
  });

  it('should return 404 when workflow not found', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.workflow.findFirst).mockResolvedValue(null);

    const request = createRequest('PATCH', 'http://localhost:3000/api/workflows', {
      id: 'nonexistent',
      name: 'Updated',
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Workflow not found');
  });
});
