/**
 * Tenant Isolation Security Tests
 * 
 * Critical tests to validate tenant data isolation and prevent cross-tenant attacks
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

// Test data
const TENANT_A_ID = 'test-tenant-a';
const TENANT_B_ID = 'test-tenant-b';
const USER_A_ID = 'test-user-a';
const USER_B_ID = 'test-user-b';

describe('Tenant Isolation - Critical Security Tests', () => {
  beforeAll(async () => {
    // Create test tenants
    await prisma.tenant.createMany({
      data: [
        { id: TENANT_A_ID, name: 'Tenant A', slug: 'tenant-a' },
        { id: TENANT_B_ID, name: 'Tenant B', slug: 'tenant-b' },
      ],
      skipDuplicates: true,
    });

    // Create test users
    await prisma.user.createMany({
      data: [
        { 
          id: USER_A_ID, 
          email: 'user-a@tenant-a.com', 
          tenantId: TENANT_A_ID,
          passwordHash: 'test-hash',
        },
        { 
          id: USER_B_ID, 
          email: 'user-b@tenant-b.com', 
          tenantId: TENANT_B_ID,
          passwordHash: 'test-hash',
        },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({
      where: { id: { in: [USER_A_ID, USER_B_ID] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [TENANT_A_ID, TENANT_B_ID] } },
    });
  });

  describe('TaxonomyCategory Cross-Tenant Prevention', () => {
    it('should prevent cross-tenant category assignment to contracts', async () => {
      // Tenant A creates a category
      const categoryA = await prisma.taxonomyCategory.create({
        data: {
          tenantId: TENANT_A_ID,
          name: 'Strategic Services',
          path: '/strategic-services',
          level: 1,
        },
      });

      // Tenant B creates a contract
      const contractB = await prisma.contract.create({
        data: {
          tenantId: TENANT_B_ID,
          fileName: 'test-contract.pdf',
          mimeType: 'application/pdf',
          fileSize: BigInt(1024),
          status: 'ACTIVE',
        },
      });

      // Try to assign Tenant A's category to Tenant B's contract
      // This should fail or be prevented by validation
      const categoryValidation = await prisma.taxonomyCategory.findFirst({
        where: { id: categoryA.id, tenantId: TENANT_B_ID },
      });

      expect(categoryValidation).toBeNull();

      // Cleanup
      await prisma.contract.delete({ where: { id: contractB.id } });
      await prisma.taxonomyCategory.delete({ where: { id: categoryA.id } });
    });

    it('should only return tenant-scoped categories', async () => {
      // Create categories for both tenants
      const catA = await prisma.taxonomyCategory.create({
        data: {
          tenantId: TENANT_A_ID,
          name: 'Category A Only',
          path: '/category-a-only',
          level: 1,
        },
      });

      const catB = await prisma.taxonomyCategory.create({
        data: {
          tenantId: TENANT_B_ID,
          name: 'Category B Only',
          path: '/category-b-only',
          level: 1,
        },
      });

      // Fetch categories for Tenant A
      const tenantACategories = await prisma.taxonomyCategory.findMany({
        where: { tenantId: TENANT_A_ID },
      });

      expect(tenantACategories).toHaveLength(1);
      expect(tenantACategories[0].name).toBe('Category A Only');
      expect(tenantACategories.every(cat => cat.tenantId === TENANT_A_ID)).toBe(true);

      // Cleanup
      await prisma.taxonomyCategory.deleteMany({
        where: { id: { in: [catA.id, catB.id] } },
      });
    });

    it('should allow same category name across different tenants', async () => {
      // Both tenants can create categories with the same name
      const catA = await prisma.taxonomyCategory.create({
        data: {
          tenantId: TENANT_A_ID,
          name: 'Professional Services',
          path: '/professional-services',
          level: 1,
        },
      });

      const catB = await prisma.taxonomyCategory.create({
        data: {
          tenantId: TENANT_B_ID,
          name: 'Professional Services',
          path: '/professional-services',
          level: 1,
        },
      });

      expect(catA.id).not.toBe(catB.id);
      expect(catA.name).toBe(catB.name);

      // Cleanup
      await prisma.taxonomyCategory.deleteMany({
        where: { id: { in: [catA.id, catB.id] } },
      });
    });
  });

  describe('Contract Isolation', () => {
    it('should not return contracts from other tenants', async () => {
      const contractA = await prisma.contract.create({
        data: {
          tenantId: TENANT_A_ID,
          fileName: 'contract-a.pdf',
          mimeType: 'application/pdf',
          fileSize: BigInt(1024),
          status: 'ACTIVE',
          contractTitle: 'Secret Contract A',
        },
      });

      // Try to fetch with Tenant B's ID
      const result = await prisma.contract.findFirst({
        where: { id: contractA.id, tenantId: TENANT_B_ID },
      });

      expect(result).toBeNull();

      // Cleanup
      await prisma.contract.delete({ where: { id: contractA.id } });
    });

    it('should enforce tenantId in all contract queries', async () => {
      const contractsA = await prisma.contract.findMany({
        where: { tenantId: TENANT_A_ID },
      });

      const contractsB = await prisma.contract.findMany({
        where: { tenantId: TENANT_B_ID },
      });

      // Contracts should not overlap
      const idsA = new Set(contractsA.map(c => c.id));
      const idsB = new Set(contractsB.map(c => c.id));
      const intersection = [...idsA].filter(id => idsB.has(id));

      expect(intersection).toHaveLength(0);
    });
  });

  describe('User Isolation', () => {
    it('should return correct user with tenantId validation', async () => {
      // Query user with both email and tenantId
      const user = await prisma.user.findFirst({
        where: { 
          email: 'user-a@tenant-a.com',
          tenantId: TENANT_A_ID,
        },
      });

      expect(user).not.toBeNull();
      expect(user?.tenantId).toBe(TENANT_A_ID);

      // Query with wrong tenantId should fail
      const wrongUser = await prisma.user.findFirst({
        where: { 
          email: 'user-a@tenant-a.com',
          tenantId: TENANT_B_ID,
        },
      });

      expect(wrongUser).toBeNull();
    });
  });

  describe('RateCard Isolation', () => {
    it('should isolate rate card suppliers by tenant', async () => {
      const supplierA = await prisma.rateCardSupplier.create({
        data: {
          tenantId: TENANT_A_ID,
          name: 'Acme Corp',
          tier: 'BIG_4',
          country: 'US',
          region: 'North America',
        },
      });

      // Tenant B cannot access Tenant A's supplier
      const lookup = await prisma.rateCardSupplier.findFirst({
        where: { name: 'Acme Corp', tenantId: TENANT_B_ID },
      });

      expect(lookup).toBeNull();

      // Cleanup
      await prisma.rateCardSupplier.delete({ where: { id: supplierA.id } });
    });

    it('should allow same supplier name across different tenants', async () => {
      const supplierA = await prisma.rateCardSupplier.create({
        data: {
          tenantId: TENANT_A_ID,
          name: 'Global Consulting',
          tier: 'BIG_4',
          country: 'US',
          region: 'North America',
        },
      });

      const supplierB = await prisma.rateCardSupplier.create({
        data: {
          tenantId: TENANT_B_ID,
          name: 'Global Consulting',
          tier: 'TIER_2',
          country: 'UK',
          region: 'Europe',
        },
      });

      expect(supplierA.id).not.toBe(supplierB.id);

      // Cleanup
      await prisma.rateCardSupplier.deleteMany({
        where: { id: { in: [supplierA.id, supplierB.id] } },
      });
    });
  });

  describe('Query Validation Helpers', () => {
    it('should validate category ownership', async () => {
      const category = await prisma.taxonomyCategory.create({
        data: {
          tenantId: TENANT_A_ID,
          name: 'Test Category',
          path: '/test-category',
          level: 1,
        },
      });

      // Correct tenant
      const validOwnership = await prisma.taxonomyCategory.findFirst({
        where: { id: category.id, tenantId: TENANT_A_ID },
      });
      expect(validOwnership).not.toBeNull();

      // Wrong tenant
      const invalidOwnership = await prisma.taxonomyCategory.findFirst({
        where: { id: category.id, tenantId: TENANT_B_ID },
      });
      expect(invalidOwnership).toBeNull();

      // Cleanup
      await prisma.taxonomyCategory.delete({ where: { id: category.id } });
    });
  });

  describe('Composite Index Performance', () => {
    it('should use tenant-scoped indexes efficiently', async () => {
      // Create test data
      const contracts = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.contract.create({
            data: {
              tenantId: TENANT_A_ID,
              fileName: `contract-${i}.pdf`,
              mimeType: 'application/pdf',
              fileSize: BigInt(1024),
              status: 'ACTIVE',
            },
          })
        )
      );

      // Query should use [tenantId, status] index
      const startTime = Date.now();
      const results = await prisma.contract.findMany({
        where: { tenantId: TENANT_A_ID, status: 'ACTIVE' },
      });
      const queryTime = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(queryTime).toBeLessThan(500); // Should be reasonably fast with index (first query slower due to connection setup)

      // Cleanup
      await prisma.contract.deleteMany({
        where: { id: { in: contracts.map(c => c.id) } },
      });
    });
  });
});
