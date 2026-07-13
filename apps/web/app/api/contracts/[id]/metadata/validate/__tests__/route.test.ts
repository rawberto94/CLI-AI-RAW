import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockContractFindFirst,
  mockContractMetadataFindUnique,
  mockContractMetadataUpdate,
  mockContractMetadataCreate,
  mockCheckContractWritePermission,
  mockAuditLog,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractMetadataFindUnique: vi.fn(),
  mockContractMetadataUpdate: vi.fn(),
  mockContractMetadataCreate: vi.fn(),
  mockCheckContractWritePermission: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    contractMetadata: {
      findUnique: mockContractMetadataFindUnique,
      update: mockContractMetadataUpdate,
      create: mockContractMetadataCreate,
    },
  },
}));

vi.mock('@/lib/security/contract-acl', () => ({
  checkContractWritePermission: mockCheckContractWritePermission,
}));

vi.mock('@/lib/security/audit', () => ({
  auditLog: mockAuditLog,
  AuditAction: {
    CONTRACT_UPDATED: 'CONTRACT_UPDATED',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { PUT } from '../route';

const routeContext = {
  params: Promise.resolve({ id: 'contract-1' }),
};

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/contracts/contract-1/metadata/validate', {
    method: 'PUT',
    headers: {
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'member',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('/api/contracts/[id]/metadata/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({ id: 'contract-1' });
    mockCheckContractWritePermission.mockResolvedValue({ allowed: true });
    mockContractMetadataFindUnique.mockResolvedValue({
      contractId: 'contract-1',
      customFields: { _fieldValidations: { start_date: { status: 'validate', validatedAt: '2026-01-01T00:00:00.000Z' } } },
    });
    mockContractMetadataUpdate.mockResolvedValue({});
    mockContractMetadataCreate.mockResolvedValue({});
    mockAuditLog.mockResolvedValue({});
  });

  it('bulk verify persists one _fieldValidations entry per key', async () => {
    const response = await PUT(createRequest({
      fieldKeys: ['document_title', 'jurisdiction'],
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.fieldCount).toBe(2);

    expect(mockContractMetadataUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = mockContractMetadataUpdate.mock.calls[0][0];
    const validations = updateArgs.data.customFields._fieldValidations;
    expect(validations.document_title.status).toBe('validate');
    expect(validations.document_title.validatedAt).toBeTruthy();
    expect(validations.jurisdiction.status).toBe('validate');
    // Existing validations are preserved
    expect(validations.start_date.status).toBe('validate');
  });

  it('bulk verify does not write field values into customFields', async () => {
    const response = await PUT(createRequest({
      fieldKeys: ['document_title', 'jurisdiction'],
    }), routeContext);

    expect(response.status).toBe(200);
    const updateArgs = mockContractMetadataUpdate.mock.calls[0][0];
    const customFields = updateArgs.data.customFields;

    // Only the validations map (plus pre-existing custom fields) may be present
    expect(Object.keys(customFields)).toEqual(['_fieldValidations']);
    expect(customFields.document_title).toBeUndefined();
    expect(customFields.jurisdiction).toBeUndefined();
    expect(customFields._validationStatus).toBeUndefined();
  });

  it('accepts the legacy allFields payload but ignores its values', async () => {
    const response = await PUT(createRequest({
      allFields: { document_title: 'Some Title', tcv_amount: 42000 },
    }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.fieldCount).toBe(2);

    const updateArgs = mockContractMetadataUpdate.mock.calls[0][0];
    const customFields = updateArgs.data.customFields;
    expect(customFields._fieldValidations.document_title.status).toBe('validate');
    expect(customFields._fieldValidations.tcv_amount.status).toBe('validate');
    // Values must NOT be merged into customFields
    expect(customFields.document_title).toBeUndefined();
    expect(customFields.tcv_amount).toBeUndefined();
  });

  it('creates a ContractMetadata row when none exists', async () => {
    mockContractMetadataFindUnique.mockResolvedValue(null);

    const response = await PUT(createRequest({ fieldKeys: ['document_title'] }), routeContext);

    expect(response.status).toBe(200);
    expect(mockContractMetadataCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockContractMetadataCreate.mock.calls[0][0];
    expect(createArgs.data.customFields._fieldValidations.document_title.status).toBe('validate');
    expect(createArgs.data.customFields.document_title).toBeUndefined();
  });

  it('markReviewed persists a _reviewStatus record and writes an audit entry', async () => {
    const response = await PUT(createRequest({ markReviewed: true }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.data.reviewStatus.reviewedBy).toBe('user-1');
    expect(data.data.data.reviewStatus.reviewedAt).toBeTruthy();

    const updateArgs = mockContractMetadataUpdate.mock.calls[0][0];
    expect(updateArgs.data.customFields._reviewStatus.reviewedBy).toBe('user-1');
    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CONTRACT_UPDATED',
      resourceId: 'contract-1',
    }));
  });

  it('returns 403 when the caller lacks edit permission', async () => {
    mockCheckContractWritePermission.mockResolvedValue({ allowed: false });

    const response = await PUT(createRequest({ fieldKeys: ['document_title'] }), routeContext);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(mockContractMetadataUpdate).not.toHaveBeenCalled();
  });
});
