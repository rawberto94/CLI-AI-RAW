import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockWorkflowExecutionFindFirst,
  mockWorkflowCreate,
  mockWorkflowExecutionCreate,
  mockWorkflowStepExecutionCreateMany,
  mockWorkflowStepDeleteMany,
  mockWorkflowUpdate,
  mockWorkflowStepExecutionDeleteMany,
  mockWorkflowExecutionUpdate,
  mockWorkflowDelete,
  mockEvaluateContractPreApprovalGates,
  mockRequiresApprovalWorkflow,
  mockGetContractLifecycle,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockWorkflowExecutionFindFirst: vi.fn(),
  mockWorkflowCreate: vi.fn(),
  mockWorkflowExecutionCreate: vi.fn(),
  mockWorkflowStepExecutionCreateMany: vi.fn(),
  mockWorkflowStepDeleteMany: vi.fn(),
  mockWorkflowUpdate: vi.fn(),
  mockWorkflowStepExecutionDeleteMany: vi.fn(),
  mockWorkflowExecutionUpdate: vi.fn(),
  mockWorkflowDelete: vi.fn(),
  mockEvaluateContractPreApprovalGates: vi.fn(),
  mockRequiresApprovalWorkflow: vi.fn(),
  mockGetContractLifecycle: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    workflowExecution: {
      findFirst: mockWorkflowExecutionFindFirst,
      create: mockWorkflowExecutionCreate,
      update: mockWorkflowExecutionUpdate,
    },
    workflow: {
      create: mockWorkflowCreate,
      update: mockWorkflowUpdate,
      delete: mockWorkflowDelete,
    },
    workflowStepExecution: {
      createMany: mockWorkflowStepExecutionCreateMany,
      deleteMany: mockWorkflowStepExecutionDeleteMany,
    },
    workflowStep: {
      deleteMany: mockWorkflowStepDeleteMany,
    },
  },
}));

vi.mock('@/lib/contract-helpers', () => ({
  requiresApprovalWorkflow: mockRequiresApprovalWorkflow,
  getContractLifecycle: mockGetContractLifecycle,
}));

vi.mock('@/lib/governance/pre-approval-gates', () => ({
  evaluateContractPreApprovalGates: mockEvaluateContractPreApprovalGates,
  formatUnmetPreApprovalGates: (gates: Array<{ gateName?: string; gateId?: string }>) =>
    gates.map((gate) => gate.gateName || gate.gateId || 'Unknown gate').join(', '),
}));

import { DELETE, GET, POST, PUT } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/workflow', {
    method,
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'admin',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeWorkflowContract(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'contract-1',
    tenantId: 'tenant-1',
    status: 'DRAFT',
    documentRole: 'NEW_CONTRACT',
    metadata: null,
    contractTitle: 'MSA',
    fileName: 'msa.pdf',
    contractType: 'MSA',
    totalValue: 1000,
    currency: 'USD',
    ...overrides,
  };
}

function makeWorkflow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'workflow-1',
    name: 'Approval workflow',
    description: 'Default approval chain',
    type: 'APPROVAL',
    isActive: true,
    createdAt: new Date('2026-04-29T09:00:00.000Z'),
    updatedAt: new Date('2026-04-29T09:00:00.000Z'),
    steps: [
      {
        id: 'step-1',
        name: 'Legal review',
        description: null,
        type: 'APPROVAL',
        assignedRole: 'legal',
        assignedUser: null,
        isRequired: true,
        timeout: 24,
        order: 0,
        config: {
          approverType: 'role',
          approvers: ['legal'],
          approvalType: 'any',
          slaHours: 24,
          escalationEnabled: false,
          escalateTo: null,
        },
      },
    ],
    ...overrides,
  };
}

describe('/api/contracts/[id]/workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluateContractPreApprovalGates.mockResolvedValue({ unmetGates: [] });
    mockRequiresApprovalWorkflow.mockReturnValue(true);
    mockGetContractLifecycle.mockReturnValue('NEW');
    mockWorkflowStepExecutionCreateMany.mockResolvedValue({ count: 1 });
    mockWorkflowStepDeleteMany.mockResolvedValue({ count: 1 });
    mockWorkflowStepExecutionDeleteMany.mockResolvedValue({ count: 1 });
    mockWorkflowExecutionUpdate.mockResolvedValue({});
    mockWorkflowDelete.mockResolvedValue({});
  });

  it('returns 404 when the contract is outside the tenant scope', async () => {
    mockContractFindFirst.mockResolvedValue(null);

    const response = await GET(createRequest('GET'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('creates a workflow when none exists', async () => {
    const contract = makeWorkflowContract();
    const workflow = makeWorkflow();
    mockContractFindFirst.mockResolvedValue(contract);
    mockWorkflowExecutionFindFirst.mockResolvedValueOnce(null);
    mockWorkflowCreate.mockResolvedValue(workflow);
    mockWorkflowExecutionCreate.mockResolvedValue({ id: 'execution-1', status: 'PENDING' });

    const response = await POST(createRequest('POST', {
      name: 'Approval workflow',
      steps: [{ name: 'Legal review', assignedRole: 'legal' }],
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.workflow.id).toBe('workflow-1');
    expect(data.data.message).toBe('Workflow created successfully');
  });

  it('updates an existing workflow', async () => {
    const contract = makeWorkflowContract();
    const existingWorkflow = makeWorkflow();
    const updatedWorkflow = makeWorkflow({ name: 'Updated workflow' });

    mockContractFindFirst.mockResolvedValue(contract);
    mockWorkflowExecutionFindFirst.mockResolvedValue({
      id: 'execution-1',
      workflow: existingWorkflow,
    });
    mockWorkflowUpdate.mockResolvedValue(updatedWorkflow);

    const response = await PUT(createRequest('PUT', {
      name: 'Updated workflow',
      steps: [{ name: 'Finance review', assignedRole: 'finance' }],
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.workflow.name).toBe('Updated workflow');
    expect(data.data.message).toBe('Workflow updated successfully');
  });

  it('deletes an existing workflow', async () => {
    mockWorkflowExecutionFindFirst.mockResolvedValue({
      id: 'execution-1',
      workflow: { id: 'workflow-1' },
    });

    const response = await DELETE(createRequest('DELETE'), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.message).toBe('Workflow deleted successfully');
    expect(mockWorkflowDelete).toHaveBeenCalledWith({ where: { id: 'workflow-1' } });
  });
})