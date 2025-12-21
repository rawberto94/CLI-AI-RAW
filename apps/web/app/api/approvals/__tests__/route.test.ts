import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, PATCH } from '../route';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalRequest: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workflowExecution: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workflowStepExecution: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    contract: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
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
  url: string = 'http://localhost:3000/api/approvals',
  body?: Record<string, unknown>
): NextRequest {
  const options: RequestInit = { method };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url), options);
}

describe('GET /api/approvals', () => {
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

  it('should return approvals list successfully', async () => {
    const mockApprovals = [
      {
        id: 'apr1',
        type: 'contract',
        title: 'Test Contract',
        status: 'pending',
        priority: 'high',
        tenantId: 'tenant1',
        createdAt: new Date(),
        requestedBy: { name: 'John Doe', email: 'john@example.com' },
        contract: { id: 'c1', title: 'Contract 1' },
      },
    ];

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue(mockApprovals);

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.approvals).toBeDefined();
  });

  it('should filter approvals by status', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue([]);

    const request = createRequest('GET', 'http://localhost:3000/api/approvals?status=pending');
    await GET(request);

    expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant1', status: 'pending' }),
      })
    );
  });

  it('should filter approvals by priority', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue([]);

    const request = createRequest('GET', 'http://localhost:3000/api/approvals?priority=high');
    await GET(request);

    expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant1', priority: 'high' }),
      })
    );
  });

  it('should filter approvals by type', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.approvalRequest.findMany).mockResolvedValue([]);

    const request = createRequest('GET', 'http://localhost:3000/api/approvals?type=contract');
    await GET(request);

    expect(prisma.approvalRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant1', type: 'contract' }),
      })
    );
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.approvalRequest.findMany).mockRejectedValue(new Error('Database error'));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });
});

describe('POST /api/approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when tenant ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue(null);

    const request = createRequest('POST', 'http://localhost:3000/api/approvals', { title: 'Test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Tenant ID is required');
  });

  it('should create approval request successfully', async () => {
    const mockApproval = {
      id: 'apr1',
      type: 'contract',
      title: 'New Approval',
      status: 'pending',
      tenantId: 'tenant1',
      createdAt: new Date(),
    };

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.approvalRequest.create).mockResolvedValue(mockApproval);

    const request = createRequest('POST', 'http://localhost:3000/api/approvals', {
      title: 'New Approval',
      type: 'contract',
      contractId: 'c1',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

describe('PATCH /api/approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when tenant ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue(null);

    const request = createRequest('PATCH', 'http://localhost:3000/api/approvals', { id: 'apr1' });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Tenant ID is required');
  });

  it('should return 400 when approval ID is missing', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');

    const request = createRequest('PATCH', 'http://localhost:3000/api/approvals', { status: 'approved' });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Approval ID is required');
  });

  it('should return 404 when approval not found', async () => {
    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue(null);

    const request = createRequest('PATCH', 'http://localhost:3000/api/approvals', {
      id: 'nonexistent',
      status: 'approved',
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Approval not found');
  });

  it('should update approval status successfully', async () => {
    const mockApproval = {
      id: 'apr1',
      status: 'pending',
      tenantId: 'tenant1',
    };
    const mockUpdatedApproval = {
      ...mockApproval,
      status: 'approved',
    };

    vi.mocked(getApiTenantId).mockReturnValue('tenant1');
    vi.mocked(prisma.approvalRequest.findFirst).mockResolvedValue(mockApproval);
    vi.mocked(prisma.approvalRequest.update).mockResolvedValue(mockUpdatedApproval);

    const request = createRequest('PATCH', 'http://localhost:3000/api/approvals', {
      id: 'apr1',
      status: 'approved',
      comment: 'Looks good!',
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
