import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockContractFindFirst,
  mockContractUserAccessFindFirst,
  mockContractGroupAccessFindFirst,
  mockContractGroupAccessFindMany,
  mockUserGroupMemberFindMany,
  mockDocumentShareFindMany,
  mockAuditLog,
} = vi.hoisted(() => ({
  mockContractFindFirst: vi.fn(),
  mockContractUserAccessFindFirst: vi.fn(),
  mockContractGroupAccessFindFirst: vi.fn(),
  mockContractGroupAccessFindMany: vi.fn(),
  mockUserGroupMemberFindMany: vi.fn(),
  mockDocumentShareFindMany: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contract: {
      findFirst: mockContractFindFirst,
    },
    contractUserAccess: {
      findFirst: mockContractUserAccessFindFirst,
    },
    contractGroupAccess: {
      findFirst: mockContractGroupAccessFindFirst,
      findMany: mockContractGroupAccessFindMany,
    },
    userGroupMember: {
      findMany: mockUserGroupMemberFindMany,
    },
    documentShare: {
      findMany: mockDocumentShareFindMany,
    },
  },
}));

vi.mock('@/lib/security/audit', () => ({
  auditLog: mockAuditLog,
  AuditAction: {
    PERMISSION_DENIED: 'PERMISSION_DENIED',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { checkContractReadPermission, checkContractWritePermission } from '../contract-acl';

const baseArgs = {
  contractId: 'contract-1',
  tenantId: 'tenant-1',
  userId: 'user-1',
  userRole: 'member',
};

describe('contract ACL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContractFindFirst.mockResolvedValue({ uploadedBy: 'owner-user' });
    mockContractUserAccessFindFirst.mockResolvedValue(null);
    mockContractGroupAccessFindFirst.mockResolvedValue(null);
    mockContractGroupAccessFindMany.mockResolvedValue([]);
    mockUserGroupMemberFindMany.mockResolvedValue([]);
    mockDocumentShareFindMany.mockResolvedValue([]);
    mockAuditLog.mockResolvedValue(undefined);
  });

  it('allows tenant members when no explicit access rows or shares exist', async () => {
    const decision = await checkContractReadPermission(baseArgs);

    expect(decision).toEqual({ allowed: true, reason: 'no-shares' });
    expect(mockDocumentShareFindMany).toHaveBeenCalledTimes(1);
  });

  it('allows a user with a direct explicit contract grant', async () => {
    mockContractUserAccessFindFirst
      .mockResolvedValueOnce({ id: 'access-1' })
      .mockResolvedValueOnce({ accessLevel: 'view' });

    const decision = await checkContractReadPermission(baseArgs);

    expect(decision).toEqual({ allowed: true, reason: 'contract-access' });
    expect(mockDocumentShareFindMany).not.toHaveBeenCalled();
  });

  it('allows a user through an explicit group contract grant', async () => {
    mockContractGroupAccessFindFirst.mockResolvedValue({ id: 'group-access-1' });
    mockUserGroupMemberFindMany.mockResolvedValue([{ groupId: 'group-1' }]);
    mockContractGroupAccessFindMany.mockResolvedValue([{ accessLevel: 'edit' }]);

    const decision = await checkContractWritePermission({
      ...baseArgs,
      required: 'EDIT',
    });

    expect(decision).toEqual({ allowed: true, reason: 'contract-access' });
    expect(mockDocumentShareFindMany).not.toHaveBeenCalled();
  });

  it('denies access when explicit contract access exists but does not include the user', async () => {
    mockContractUserAccessFindFirst.mockResolvedValueOnce({ id: 'access-1' }).mockResolvedValueOnce(null);

    const decision = await checkContractReadPermission(baseArgs);

    expect(decision).toEqual({ allowed: false, reason: 'forbidden' });
    expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'PERMISSION_DENIED',
      tenantId: 'tenant-1',
      userId: 'user-1',
      resourceId: 'contract-1',
    }));
    expect(mockDocumentShareFindMany).toHaveBeenCalledTimes(1);
  });

  it('falls back to legacy document shares when no explicit contract access exists', async () => {
    mockDocumentShareFindMany.mockResolvedValue([{ sharedWith: 'user-1', permission: 'EDIT', expiresAt: null }]);

    const decision = await checkContractWritePermission({
      ...baseArgs,
      required: 'EDIT',
    });

    expect(decision).toEqual({ allowed: true, reason: 'share' });
  });

  it('honors a legacy document share even when explicit contract access rows exist', async () => {
    mockContractUserAccessFindFirst.mockResolvedValueOnce({ id: 'access-1' }).mockResolvedValueOnce(null);
    mockDocumentShareFindMany.mockResolvedValue([{ sharedWith: 'user-1', permission: 'VIEW', expiresAt: null }]);

    const decision = await checkContractReadPermission(baseArgs);

    expect(decision).toEqual({ allowed: true, reason: 'share' });
    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});