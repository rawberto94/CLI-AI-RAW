/**
 * Contract Extension API
 * POST /api/contracts/[id]/extend - Extend the current contract's expiration date
 *
 * Unlike renewal (which creates a new child contract), extension modifies
 * the existing contract in-place:
 * - Updates expirationDate / endDate
 * - Optionally adjusts totalValue for the extended period
 * - Creates an audit log entry for compliance
 * - Sends notification
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { EmailService } from '@/lib/services/email.service';
import {
  withContractApiHandler,
  createSuccessResponse,
  createErrorResponse,
  handleApiError,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

const extensionRequestSchema = z.object({
  newExpirationDate: z.string().datetime(),
  newTotalValue: z.number().optional(),
  extensionNote: z.string().max(2000).optional(),
  submitForApproval: z.boolean().default(false),
});

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  try {
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Tenant ID required', 401);
    }

    const body = await request.json();
    const validatedData = extensionRequestSchema.parse(body);

    // Fetch the contract
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId, isDeleted: false },
      include: {
        client: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    const newExpiration = new Date(validatedData.newExpirationDate);
    const currentExpiration = contract.expirationDate || contract.endDate;

    // Validate: new expiration must be after current expiration (or today if none set)
    const comparisonDate = currentExpiration || new Date();
    if (newExpiration <= comparisonDate) {
      return createErrorResponse(
        ctx,
        'VALIDATION_ERROR',
        'New expiration date must be after the current expiration date',
        400
      );
    }

    // Calculate extension duration
    const extensionDays = currentExpiration
      ? Math.ceil(
          (newExpiration.getTime() - currentExpiration.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    // Snapshot previous values for audit
    const previousExpiration = currentExpiration?.toISOString() || null;
    const previousValue = contract.totalValue ? Number(contract.totalValue) : null;

    // Update the contract in-place
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        expirationDate: newExpiration,
        endDate: newExpiration,
        ...(validatedData.newTotalValue !== undefined && {
          totalValue: validatedData.newTotalValue,
          annualValue:
            contract.effectiveDate
              ? validatedData.newTotalValue /
                Math.max(
                  1,
                  Math.ceil(
                    (newExpiration.getTime() -
                      new Date(contract.effectiveDate).getTime()) /
                      (1000 * 60 * 60 * 24 * 365)
                  )
                )
              : validatedData.newTotalValue,
        }),
        // Reset expiration flags
        isExpired: false,
        expirationAlertSent: false,
        daysUntilExpiry: Math.ceil(
          (newExpiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ),
        expirationRisk: extensionDays > 365 ? 'LOW' : extensionDays > 90 ? 'MEDIUM' : 'LOW',
        renewalStatus: 'PENDING',
        renewalNotes: validatedData.extensionNote || `Extended by ${extensionDays} days`,
      },
      include: {
        client: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: ctx.userId,
        action: 'CONTRACT_EXTENDED',
        resourceType: 'Contract',
        entityType: 'Contract',
        entityId: contractId,
        resource: contractId,
        details: {
          description: `Extended contract "${contract.contractTitle || contractId}" by ${extensionDays} days`,
        },
        metadata: {
          contractId,
          contractTitle: contract.contractTitle,
          previousExpiration,
          newExpiration: newExpiration.toISOString(),
          extensionDays,
          previousValue,
          newValue: validatedData.newTotalValue ?? previousValue,
          extensionNote: validatedData.extensionNote || null,
        },
        ipAddress: request.headers.get('x-forwarded-for') || null,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    // Non-blocking email notification
    const notifyEmail = process.env.NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
    if (notifyEmail) {
      EmailService.sendRenewalNotification({
        to: notifyEmail,
        recipientName: 'Contract Administrator',
        originalContractName: contract.contractTitle || contractId,
        renewedContractName: `${contract.contractTitle || contractId} (Extended)`,
        renewedContractId: contractId,
        renewalDate: new Date(),
        expiryDate: newExpiration,
        value: validatedData.newTotalValue ?? (contract.totalValue ? Number(contract.totalValue) : undefined),
        submittedForApproval: validatedData.submitForApproval,
      }).catch((err) => {
        logger.error('[ContractExtend] Email notification error:', err);
      });
    }

    return createSuccessResponse(ctx, {
      success: true,
      message: `Contract extended by ${extensionDays} days`,
      contract: {
        id: updatedContract.id,
        title: updatedContract.contractTitle,
        effectiveDate: updatedContract.effectiveDate,
        expirationDate: updatedContract.expirationDate,
        totalValue: updatedContract.totalValue,
        status: updatedContract.status,
      },
      extension: {
        previousExpiration,
        newExpiration: newExpiration.toISOString(),
        extensionDays,
      },
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})
