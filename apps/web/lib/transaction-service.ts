/**
 * Transaction Service
 * Provides transactional wrappers for multi-step operations
 */

import { prisma } from "@/lib/prisma";
import { type Prisma, ContractStatus } from "@prisma/client";
import pino from "pino";

const logger = pino({ name: "transaction-service" });

export interface TransactionOptions {
  maxRetries?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

export interface IdempotencyCheck {
  key: string;
  operation: string;
  tenantId: string;
}

/**
 * Execute operation within a transaction with retry logic
 */
export async function withTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    timeout = 30000, // 30 seconds
    isolationLevel,
  } = options;

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const result = await prisma.$transaction(operation, {
        maxWait: 5000,
        timeout,
        isolationLevel,
      });

      if (attempt > 0) {
        logger.info({ attempt }, "Transaction succeeded after retry");
      }

      return result;
    } catch (error) {
      lastError = error as Error;
      attempt++;

      // Don't retry on certain errors
      if (
        error instanceof Error &&
        (error.message.includes("Unique constraint") ||
          error.message.includes("Foreign key constraint"))
      ) {
        logger.error({ error }, "Non-retriable transaction error");
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        logger.warn(
          { attempt, maxRetries, delay, error: lastError?.message },
          "Transaction failed, retrying..."
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error(
    { attempts: maxRetries, error: lastError?.message },
    "Transaction failed after max retries"
  );
  throw lastError;
}

/**
 * Check idempotency key and execute operation if not already done
 */
export async function withIdempotency<T>(
  check: IdempotencyCheck,
  operation: () => Promise<T>
): Promise<{ result: T; wasExecuted: boolean }> {
  const { key, operation: operationName, tenantId } = check;

  // Check if operation already completed
  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      key_tenantId: {
        key,
        tenantId,
      },
    },
  });

  if (existing) {
    logger.info({ key, operationName }, "Operation already completed (idempotent)");
    return {
      result: existing.response as T,
      wasExecuted: false,
    };
  }

  // Execute operation
  const result = await operation();

  // Store idempotency key
  try {
    await prisma.idempotencyKey.create({
      data: {
        key,
        tenantId,
        operation: operationName,
        response: result as Prisma.InputJsonValue,
        requestHash: key, // Use key as hash for now
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        createdAt: new Date(),
      },
    });
    logger.info({ key, operationName }, "Idempotency key stored");
  } catch (error) {
    // If key already exists (race condition), that's okay
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      logger.warn({ key }, "Idempotency key already exists (race condition)");
    } else {
      logger.error({ error, key }, "Failed to store idempotency key");
    }
  }

  return {
    result,
    wasExecuted: true,
  };
}

/**
 * Create contract with all side effects in a transaction
 */
export async function createContractWithSideEffects(data: {
  contractData: Prisma.ContractUncheckedCreateInput;
  processingJobData?: Partial<Prisma.ProcessingJobUncheckedCreateInput>;
  idempotencyKey?: string;
}) {
  const { contractData, processingJobData, idempotencyKey } = data;

  const operation = async () => {
    return await withTransaction(async (tx) => {
      // 1. Create contract
      const contract = await tx.contract.create({
        data: contractData,
      });

      logger.info({ contractId: contract.id }, "Contract created in transaction");

      // 2. Create processing job
      const processingJob = await tx.processingJob.create({
        data: {
          contractId: contract.id,
          tenantId: contract.tenantId,
          status: "PENDING",
          progress: 0,
          currentStep: "uploaded",
          totalStages: 5,
          priority: 5,
          maxRetries: 3,
          retryCount: 0,
          ...processingJobData,
        },
      });

      logger.info(
        { contractId: contract.id, jobId: processingJob.id },
        "Processing job created in transaction"
      );

      // 3. Create outbox event for asynchronous processing
      const outboxEvent = await tx.outboxEvent.create({
        data: {
          tenantId: contract.tenantId,
          aggregateType: "Contract",
          aggregateId: contract.id,
          eventType: "CONTRACT_CREATED",
          payload: {
            contractId: contract.id,
            tenantId: contract.tenantId,
            fileName: contract.fileName,
            status: contract.status,
          },
          status: "PENDING",
        },
      });

      logger.info(
        { contractId: contract.id, eventId: outboxEvent.id },
        "Outbox event created in transaction"
      );

      return {
        contract,
        processingJob,
        outboxEvent,
      };
    });
  };

  // Use idempotency if key provided
  if (idempotencyKey) {
    return await withIdempotency(
      {
        key: idempotencyKey,
        operation: "create-contract",
        tenantId: contractData.tenantId,
      },
      operation
    );
  }

  return { result: await operation(), wasExecuted: true };
}

/**
 * Update contract status with audit trail
 */
export async function updateContractStatusWithAudit(
  contractId: string,
  tenantId: string,
  newStatus: string,
  userId: string,
  notes?: string
) {
  return await withTransaction(async (tx) => {
    // Get current contract
    const contract = await tx.contract.findUnique({
      where: { id: contractId, tenantId },
    });

    if (!contract) {
      throw new Error("Contract not found");
    }

    // Update contract
    const updatedContract = await tx.contract.update({
      where: { id: contractId },
      data: {
        status: newStatus as ContractStatus,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    const auditLog = await tx.auditLog.create({
      data: {
        tenantId,
        userId,
        action: "UPDATE_STATUS",
        entityType: "Contract",
        entityId: contractId,
        changes: {
          oldStatus: contract.status,
          newStatus,
        },
        metadata: {
          notes,
        },
      },
    });

    logger.info(
      { contractId, oldStatus: contract.status, newStatus, auditLogId: auditLog.id },
      "Contract status updated with audit"
    );

    return { contract: updatedContract, auditLog };
  });
}
