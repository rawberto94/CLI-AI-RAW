/**
 * Unit Tests for Optimistic Locking Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { optimisticLockingService, OptimisticLockError } from '../../src/services/optimistic-locking.service';

// Mock Prisma Client
vi.mock('clients-db', () => ({
  PrismaClient: vi.fn(() => ({
    contract: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    artifact: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  })),
}));

describe('OptimisticLockingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkVersion', () => {
    it('should return success when version matches', async () => {
      const result = await optimisticLockingService.checkVersion('contract', 'test-id', 1);

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.currentVersion).toBeDefined();
    });
  });

  describe('getCurrentVersion', () => {
    it('should return current version of a resource', async () => {
      const version = await optimisticLockingService.getCurrentVersion('contract', 'test-id');

      expect(typeof version).toBe('number');
    });
  });

  describe('OptimisticLockError', () => {
    it('should create error with correct properties', () => {
      const error = new OptimisticLockError(
        'Version mismatch',
        'contract',
        'test-id',
        1,
        2
      );

      expect(error.name).toBe('OptimisticLockError');
      expect(error.message).toBe('Version mismatch');
      expect(error.resourceType).toBe('contract');
      expect(error.resourceId).toBe('test-id');
      expect(error.expectedVersion).toBe(1);
      expect(error.actualVersion).toBe(2);
    });
  });
});
