import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseManager } from '../index';
import { 
  RepositoryManager, 
  TenantRepository, 
  ContractRepository, 
  UserRepository, 
  ArtifactRepository 
} from '../src/repositories';

// Mock PrismaClient
const mockPrismaClient = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $transaction: vi.fn(),
  $use: vi.fn(),
  tenant: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  contract: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  artifact: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
  userRole: {
    create: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
  tenantUsage: {
    findUnique: vi.fn(),
  },
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrismaClient),
  UserStatus: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    SUSPENDED: 'SUSPENDED',
    DELETED: 'DELETED',
  },
  ContractStatus: {
    UPLOADED: 'UPLOADED',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    ARCHIVED: 'ARCHIVED',
    DELETED: 'DELETED',
  },
  TenantStatus: {
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    INACTIVE: 'INACTIVE',
    DELETED: 'DELETED',
  },
}));

describe('Repository Layer', () => {
  let databaseManager: DatabaseManager;
  let repositoryManager: RepositoryManager;

  beforeEach(() => {
    databaseManager = new DatabaseManager();
    repositoryManager = new RepositoryManager(databaseManager);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await databaseManager.disconnect();
  });

  describe('TenantRepository', () => {
    let tenantRepository: TenantRepository;

    beforeEach(() => {
      tenantRepository = repositoryManager.tenants;
    });

    it('should create a tenant', async () => {
      const mockTenant = {
        id: 'tenant-1',
        name: 'Test Tenant',
        slug: 'test-tenant',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaClient.tenant.create.mockResolvedValue(mockTenant);

      const result = await tenantRepository.create({
        name: 'Test Tenant',
        slug: 'test-tenant',
      });

      expect(result).toEqual(mockTenant);
      expect(mockPrismaClient.tenant.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Tenant',
          slug: 'test-tenant',
        },
      });
    });

    it('should find tenant by slug', async () => {
      const mockTenant = {
        id: 'tenant-1',
        name: 'Test Tenant',
        slug: 'test-tenant',
        status: 'ACTIVE',
      };

      mockPrismaClient.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await tenantRepository.findBySlug('test-tenant');

      expect(result).toEqual(mockTenant);
      expect(mockPrismaClient.tenant.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-tenant' },
      });
    });

    it('should get tenant stats', async () => {
      mockPrismaClient.contract.count.mockResolvedValue(10);
      mockPrismaClient.user.count.mockResolvedValue(5);
      mockPrismaClient.tenantUsage.findUnique.mockResolvedValue({
        storageUsed: BigInt(1000),
        contractsProcessed: 8,
      });

      const stats = await tenantRepository.getTenantStats('tenant-1');

      expect(stats).toEqual({
        totalContracts: 10,
        activeUsers: 5,
        storageUsed: BigInt(1000),
        monthlyProcessed: 8,
      });
    });
  });

  describe('ContractRepository', () => {
    let contractRepository: ContractRepository;

    beforeEach(() => {
      contractRepository = repositoryManager.contracts;
    });

    it('should find contracts by tenant', async () => {
      const mockContracts = [
        {
          id: 'contract-1',
          tenantId: 'tenant-1',
          filename: 'contract1.pdf',
          status: 'COMPLETED',
        },
        {
          id: 'contract-2',
          tenantId: 'tenant-1',
          filename: 'contract2.pdf',
          status: 'PROCESSING',
        },
      ];

      mockPrismaClient.contract.findMany.mockResolvedValue(mockContracts);

      const result = await contractRepository.findByTenant('tenant-1', {
        status: ['COMPLETED', 'PROCESSING'],
        limit: 10,
      });

      expect(result).toEqual(mockContracts);
      expect(mockPrismaClient.contract.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          status: { in: ['COMPLETED', 'PROCESSING'] },
        },
        take: 10,
        skip: undefined,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should update contract status', async () => {
      const mockContract = {
        id: 'contract-1',
        status: 'COMPLETED',
        updatedAt: new Date(),
      };

      mockPrismaClient.contract.update.mockResolvedValue(mockContract);

      const result = await contractRepository.updateStatus('contract-1', 'COMPLETED');

      expect(result).toEqual(mockContract);
      expect(mockPrismaClient.contract.update).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
        data: {
          status: 'COMPLETED',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should get contracts by status', async () => {
      const mockStatusCounts = [
        { status: 'COMPLETED', _count: { status: 5 } },
        { status: 'PROCESSING', _count: { status: 3 } },
        { status: 'FAILED', _count: { status: 1 } },
      ];

      mockPrismaClient.contract.groupBy.mockResolvedValue(mockStatusCounts);

      const result = await contractRepository.getContractsByStatus('tenant-1');

      expect(result).toEqual({
        COMPLETED: 5,
        PROCESSING: 3,
        FAILED: 1,
      });
    });
  });

  describe('UserRepository', () => {
    let userRepository: UserRepository;

    beforeEach(() => {
      userRepository = repositoryManager.users;
    });

    it('should find user by email', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
      };

      mockPrismaClient.user.findUnique.mockResolvedValue(mockUser);

      const result = await userRepository.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should assign role to user', async () => {
      mockPrismaClient.userRole.create.mockResolvedValue({
        userId: 'user-1',
        roleId: 'role-1',
      });

      await userRepository.assignRole('user-1', 'role-1');

      expect(mockPrismaClient.userRole.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          roleId: 'role-1',
        },
      });
    });

    it('should get user stats', async () => {
      mockPrismaClient.user.count
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(15) // active
        .mockResolvedValueOnce(3)  // inactive
        .mockResolvedValueOnce(2)  // suspended
        .mockResolvedValueOnce(8); // recent logins

      const stats = await userRepository.getUserStats('tenant-1');

      expect(stats).toEqual({
        total: 20,
        active: 15,
        inactive: 3,
        suspended: 2,
        recentLogins: 8,
      });
    });
  });

  describe('ArtifactRepository', () => {
    let artifactRepository: ArtifactRepository;

    beforeEach(() => {
      artifactRepository = repositoryManager.artifacts;
    });

    it('should create or update artifact', async () => {
      const mockArtifact = {
        id: 'artifact-1',
        contractId: 'contract-1',
        tenantId: 'tenant-1',
        type: 'OVERVIEW',
        data: { summary: 'Test summary' },
      };

      mockPrismaClient.artifact.upsert.mockResolvedValue(mockArtifact);

      const result = await artifactRepository.createOrUpdate(
        'contract-1',
        'tenant-1',
        'OVERVIEW',
        { summary: 'Test summary' },
        { confidence: 0.95 }
      );

      expect(result).toEqual(mockArtifact);
      expect(mockPrismaClient.artifact.upsert).toHaveBeenCalledWith({
        where: {
          contractId_type: {
            contractId: 'contract-1',
            type: 'OVERVIEW',
          },
        },
        create: expect.objectContaining({
          contractId: 'contract-1',
          tenantId: 'tenant-1',
          type: 'OVERVIEW',
          data: { summary: 'Test summary' },
          confidence: 0.95,
        }),
        update: expect.objectContaining({
          data: { summary: 'Test summary' },
          confidence: 0.95,
        }),
      });
    });

    it('should get artifact stats', async () => {
      const mockStats = [
        { type: 'OVERVIEW', _count: { type: 10 } },
        { type: 'CLAUSES', _count: { type: 8 } },
        { type: 'FINANCIAL', _count: { type: 5 } },
      ];

      mockPrismaClient.artifact.groupBy.mockResolvedValue(mockStats);

      const result = await artifactRepository.getArtifactStats('tenant-1');

      expect(result).toEqual({
        OVERVIEW: 10,
        CLAUSES: 8,
        FINANCIAL: 5,
      });
    });
  });

  describe('RepositoryManager', () => {
    it('should perform health check', async () => {
      // Mock successful counts for all repositories
      mockPrismaClient.tenant.count.mockResolvedValue(1);
      mockPrismaClient.contract.count.mockResolvedValue(1);
      mockPrismaClient.user.count.mockResolvedValue(1);
      mockPrismaClient.artifact.count.mockResolvedValue(1);

      const health = await repositoryManager.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.repositories).toEqual({
        tenants: true,
        contracts: true,
        users: true,
        artifacts: true,
      });
    });

    it('should get database stats', async () => {
      // Reset all mocks first
      vi.clearAllMocks();
      
      mockPrismaClient.tenant.count
        .mockResolvedValueOnce(5)  // total tenants
        .mockResolvedValueOnce(4); // active tenants
      mockPrismaClient.contract.count
        .mockResolvedValueOnce(50) // total contracts
        .mockResolvedValueOnce(3); // processing contracts
      mockPrismaClient.user.count.mockResolvedValueOnce(25); // total users
      mockPrismaClient.artifact.count.mockResolvedValueOnce(100); // total artifacts

      const stats = await repositoryManager.getStats();

      expect(stats).toEqual({
        totalTenants: 5,
        totalContracts: 50,
        totalUsers: 25,
        totalArtifacts: 100,
        activeTenantsCount: 4,
        processingContractsCount: 3,
      });
    });

    it('should handle transaction', async () => {
      const mockTransactionResult = { success: true };
      
      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaClient);
      });

      const result = await repositoryManager.withTransaction(async (repos) => {
        // Mock transaction operations
        return mockTransactionResult;
      });

      expect(result).toEqual(mockTransactionResult);
      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });
  });
});