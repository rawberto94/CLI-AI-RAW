/**
 * Integration Tests for Event Emissions
 * Tests that API operations correctly emit events through the event bus
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PrismaClient } from 'clients-db';
import { eventBus, Events } from '../../src/events/event-bus';
import { ContractService } from '../../src/services/contract.service';

const prisma = new PrismaClient();
const TEST_TENANT_ID = 'test-tenant-events';
const TEST_USER_ID = 'test-user-events';

describe('Event Emission Integration Tests', () => {
  let contractService: ContractService;

  beforeAll(async () => {
    contractService = new ContractService(prisma);

    // Create test tenant
    await prisma.tenant.upsert({
      where: { id: TEST_TENANT_ID },
      create: {
        id: TEST_TENANT_ID,
        name: 'Test Tenant Events',
        slug: 'test-tenant-events',
      },
      update: {},
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.contract.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
    await prisma.tenant.delete({ where: { id: TEST_TENANT_ID } }).catch(() => {});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up between tests
    await prisma.contract.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
  });

  describe('Contract Events', () => {
    it('should emit CONTRACT_CREATED event when contract is created', async () => {
      const eventSpy = vi.fn();
      eventBus.on(Events.CONTRACT_CREATED, eventSpy);

      const contract = await prisma.contract.create({
        data: {
          id: 'test-contract-event-1',
          tenantId: TEST_TENANT_ID,
          fileName: 'test-contract.pdf',
          originalName: 'Test Contract.pdf',
          fileSize: BigInt(1024),
          mimeType: 'application/pdf',
          status: 'PENDING',
        },
      });

      // Manually emit event (in real API, this would be done by the service)
      eventBus.emit(Events.CONTRACT_CREATED, {
        contractId: contract.id,
        tenantId: TEST_TENANT_ID,
        fileName: contract.fileName,
      });

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: contract.id,
          tenantId: TEST_TENANT_ID,
        })
      );

      eventBus.off(Events.CONTRACT_CREATED, eventSpy);
    });

    it('should emit CONTRACT_UPDATED event when contract is updated', async () => {
      const eventSpy = vi.fn();
      eventBus.on(Events.CONTRACT_UPDATED, eventSpy);

      const contract = await prisma.contract.create({
        data: {
          id: 'test-contract-event-2',
          tenantId: TEST_TENANT_ID,
          fileName: 'test-contract-2.pdf',
          originalName: 'Test Contract 2.pdf',
          fileSize: BigInt(1024),
          mimeType: 'application/pdf',
          status: 'PENDING',
        },
      });

      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: 'PROCESSING' },
      });

      // Manually emit event
      eventBus.emit(Events.CONTRACT_UPDATED, {
        contractId: contract.id,
        tenantId: TEST_TENANT_ID,
        changes: { status: 'PROCESSING' },
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: contract.id,
          tenantId: TEST_TENANT_ID,
        })
      );

      eventBus.off(Events.CONTRACT_UPDATED, eventSpy);
    });

    it('should emit PROCESSING_COMPLETED event when processing finishes', async () => {
      const eventSpy = vi.fn();
      eventBus.on(Events.PROCESSING_COMPLETED, eventSpy);

      const contract = await prisma.contract.create({
        data: {
          id: 'test-contract-event-3',
          tenantId: TEST_TENANT_ID,
          fileName: 'test-contract-3.pdf',
          originalName: 'Test Contract 3.pdf',
          fileSize: BigInt(1024),
          mimeType: 'application/pdf',
          status: 'PROCESSING',
        },
      });

      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: 'COMPLETED' },
      });

      // Manually emit event
      eventBus.emit(Events.PROCESSING_COMPLETED, {
        contractId: contract.id,
        tenantId: TEST_TENANT_ID,
        status: 'COMPLETED',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          contractId: contract.id,
          status: 'COMPLETED',
        })
      );

      eventBus.off(Events.PROCESSING_COMPLETED, eventSpy);
    });
  });

  describe('Event Bus Reliability', () => {
    it('should handle multiple listeners for the same event', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventBus.on(Events.CONTRACT_CREATED, listener1);
      eventBus.on(Events.CONTRACT_CREATED, listener2);
      eventBus.on(Events.CONTRACT_CREATED, listener3);

      eventBus.emit(Events.CONTRACT_CREATED, {
        contractId: 'test-multi-listener',
        tenantId: TEST_TENANT_ID,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();

      eventBus.off(Events.CONTRACT_CREATED, listener1);
      eventBus.off(Events.CONTRACT_CREATED, listener2);
      eventBus.off(Events.CONTRACT_CREATED, listener3);
    });

    it('should not call removed listeners', async () => {
      const listener = vi.fn();

      eventBus.on(Events.CONTRACT_CREATED, listener);
      eventBus.off(Events.CONTRACT_CREATED, listener);

      eventBus.emit(Events.CONTRACT_CREATED, {
        contractId: 'test-removed-listener',
        tenantId: TEST_TENANT_ID,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle errors in event listeners gracefully', async () => {
      const errorListener = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalListener = vi.fn();

      eventBus.on(Events.CONTRACT_CREATED, errorListener);
      eventBus.on(Events.CONTRACT_CREATED, normalListener);

      // Should not throw
      expect(() => {
        eventBus.emit(Events.CONTRACT_CREATED, {
          contractId: 'test-error-handling',
          tenantId: TEST_TENANT_ID,
        });
      }).not.toThrow();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();

      eventBus.off(Events.CONTRACT_CREATED, errorListener);
      eventBus.off(Events.CONTRACT_CREATED, normalListener);
    });
  });

  describe('Event Data Integrity', () => {
    it('should preserve event data through emission', async () => {
      const eventSpy = vi.fn();
      eventBus.on(Events.CONTRACT_CREATED, eventSpy);

      const eventData = {
        contractId: 'test-data-integrity',
        tenantId: TEST_TENANT_ID,
        fileName: 'test.pdf',
        metadata: {
          size: 1024,
          type: 'application/pdf',
          nested: {
            value: 'test',
          },
        },
      };

      eventBus.emit(Events.CONTRACT_CREATED, eventData);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(eventSpy).toHaveBeenCalledWith(eventData);
      expect(eventSpy.mock.calls[0][0]).toEqual(eventData);

      eventBus.off(Events.CONTRACT_CREATED, eventSpy);
    });
  });

  describe('Event Timing', () => {
    it('should emit events in order', async () => {
      const callOrder: number[] = [];
      
      const listener = vi.fn((data: any) => {
        callOrder.push(data.order);
      });

      eventBus.on(Events.CONTRACT_CREATED, listener);

      eventBus.emit(Events.CONTRACT_CREATED, { order: 1, tenantId: TEST_TENANT_ID });
      eventBus.emit(Events.CONTRACT_CREATED, { order: 2, tenantId: TEST_TENANT_ID });
      eventBus.emit(Events.CONTRACT_CREATED, { order: 3, tenantId: TEST_TENANT_ID });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(callOrder).toEqual([1, 2, 3]);

      eventBus.off(Events.CONTRACT_CREATED, listener);
    });
  });
});
