import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock PrismaClient before importing
const mockPrismaClient = {
  $connect: vi.fn(),
  $disconnect: vi.fn(),
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $transaction: vi.fn(),
  $use: vi.fn(),
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => mockPrismaClient),
}));

// Import after mocking
import { DatabaseManager, DatabaseConfig, HealthStatus } from '../index';

describe('DatabaseManager', () => {
  let databaseManager: DatabaseManager;
  let config: DatabaseConfig;

  beforeEach(() => {
    config = {
      connectionPool: {
        min: 1,
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 2000,
      },
      retryPolicy: {
        maxRetries: 2,
        backoffMultiplier: 1.5,
        maxBackoffMs: 3000,
      },
      monitoring: {
        slowQueryThreshold: 500,
        enableQueryLogging: false,
      },
    };

    // Create a fresh instance for each test
    databaseManager = new DatabaseManager(config);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await databaseManager.disconnect();
  });

  describe('initialization', () => {
    it('should initialize database connection successfully', async () => {
      mockPrismaClient.$connect.mockResolvedValue(undefined);

      await expect(databaseManager.initialize()).resolves.not.toThrow();
      expect(mockPrismaClient.$connect).toHaveBeenCalledOnce();
    });

    it('should throw error when connection fails', async () => {
      const error = new Error('Connection failed');
      mockPrismaClient.$connect.mockRejectedValue(error);

      await expect(databaseManager.initialize()).rejects.toThrow('Connection failed');
    });
  });

  describe('query execution', () => {
    it('should execute query successfully', async () => {
      const mockResult = [{ id: 1, name: 'test' }];
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

      const result = await databaseManager.executeQuery('SELECT * FROM test');

      expect(result).toEqual(mockResult);
      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith('SELECT * FROM test');
    });

    it('should execute query with parameters', async () => {
      const mockResult = [{ id: 1, name: 'test' }];
      mockPrismaClient.$queryRawUnsafe.mockResolvedValue(mockResult);

      const result = await databaseManager.executeQuery('SELECT * FROM test WHERE id = $1', [1]);

      expect(result).toEqual(mockResult);
      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledWith('SELECT * FROM test WHERE id = $1', 1);
    });

    it('should retry on retryable errors', async () => {
      const retryableError = new Error('ECONNRESET');
      const mockResult = [{ id: 1, name: 'test' }];

      mockPrismaClient.$queryRawUnsafe
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue(mockResult);

      const result = await databaseManager.executeQuery('SELECT * FROM test');

      expect(result).toEqual(mockResult);
      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('Syntax error');
      mockPrismaClient.$queryRawUnsafe.mockRejectedValue(nonRetryableError);

      await expect(databaseManager.executeQuery('SELECT * FROM test')).rejects.toThrow('Syntax error');
      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledOnce();
    });

    it('should fail after max retries', async () => {
      const retryableError = new Error('ECONNRESET');
      mockPrismaClient.$queryRawUnsafe.mockRejectedValue(retryableError);

      await expect(databaseManager.executeQuery('SELECT * FROM test')).rejects.toThrow('ECONNRESET');
      expect(mockPrismaClient.$queryRawUnsafe).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  describe('transaction execution', () => {
    it('should execute transaction successfully', async () => {
      const mockTx = {
        user: {
          create: vi.fn().mockResolvedValue({ id: 1, name: 'test' }),
        },
      };
      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      const operations = [
        {
          operation: 'create',
          model: 'user',
          data: { name: 'test' },
        },
      ];

      const result = await databaseManager.executeTransaction(operations);

      expect(result).toEqual([{ id: 1, name: 'test' }]);
      expect(mockPrismaClient.$transaction).toHaveBeenCalledOnce();
    });

    it('should handle invalid operations in transaction', async () => {
      const mockTx = {};
      mockPrismaClient.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx);
      });

      const operations = [
        {
          operation: 'create',
          model: 'invalidModel',
          data: { name: 'test' },
        },
      ];

      await expect(databaseManager.executeTransaction(operations)).rejects.toThrow('Invalid operation');
    });
  });

  describe('health check', () => {
    it('should return healthy status when database is accessible', async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const health = await databaseManager.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.message).toBe('Database connection is healthy');
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should return unhealthy status when database is not accessible', async () => {
      const error = new Error('Connection timeout');
      mockPrismaClient.$queryRaw.mockRejectedValue(error);

      const health = await databaseManager.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.message).toContain('Database connection failed');
      expect(health.responseTime).toBeGreaterThan(0);
    });
  });

  describe('metrics', () => {
    it('should return database metrics', async () => {
      // Add a small delay to ensure uptime is greater than 0
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const metrics = await databaseManager.getMetrics();

      expect(metrics).toHaveProperty('activeConnections');
      expect(metrics).toHaveProperty('totalQueries');
      expect(metrics).toHaveProperty('slowQueries');
      expect(metrics).toHaveProperty('averageQueryTime');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('client access', () => {
    it('should provide access to Prisma client', () => {
      const client = databaseManager.getClient();
      expect(client).toBe(mockPrismaClient);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from database', async () => {
      mockPrismaClient.$disconnect.mockResolvedValue(undefined);

      await expect(databaseManager.disconnect()).resolves.not.toThrow();
      expect(mockPrismaClient.$disconnect).toHaveBeenCalledOnce();
    });
  });
});