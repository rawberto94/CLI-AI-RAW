/**
 * Contract Renewal API
 * POST /api/contracts/[id]/renew - Create a renewal contract linked to the original
 * 
 * Creates a new contract with:
 * - Data pre-filled from the original contract
 * - parentContractId set to original contract
 * - relationshipType set to 'RENEWAL'
 * - Original contract marked with renewalStatus: 'COMPLETED'
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';
import { z } from 'zod';
import { EmailService } from '@/lib/services/email.service';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

// Validation schema for renewal request
const renewalRequestSchema = z.object({
  // New contract dates (required for renewal)
  effectiveDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  
  // Optional overrides for the renewal
  title: z.string().optional(),
  totalValue: z.number().optional(),
  renewalNote: z.string().optional(),
  
  // Copy options
  copyParties: z.boolean().default(true),
  copyTerms: z.boolean().default(true),
  copyMetadata: z.boolean().default(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { id: originalContractId } = await params;
    const tenantId = await getServerTenantId();

    if (!tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Tenant ID required', 401);
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = renewalRequestSchema.parse(body);

    // Validate date ordering if both provided
    if (validatedData.effectiveDate && validatedData.expirationDate) {
      if (new Date(validatedData.expirationDate) <= new Date(validatedData.effectiveDate)) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Expiration date must be after effective date', 400);
      }
    }

    // Fetch the original contract with all relevant data
    const originalContract = await prisma.contract.findFirst({
      where: {
        id: originalContractId,
        tenantId,
        isDeleted: false,
      },
      include: {
        contractMetadata: true,
        client: {
          select: { id: true, name: true, type: true },
        },
        supplier: {
          select: { id: true, name: true, type: true },
        },
        childContracts: {
          where: { relationshipType: 'RENEWAL' },
          select: { id: true, contractTitle: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!originalContract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Check if contract already has a renewal in progress
    if (originalContract.childContracts.length > 0) {
      return createErrorResponse(ctx, 'CONFLICT', 'Contract already has an existing renewal', 409);
    }

    // Calculate renewal dates if not provided
    const originalDuration = originalContract.expirationDate && originalContract.effectiveDate
      ? Math.ceil(
          (new Date(originalContract.expirationDate).getTime() - 
           new Date(originalContract.effectiveDate).getTime()) / 
          (1000 * 60 * 60 * 24)
        )
      : 365; // Default to 1 year if no dates

    const newEffectiveDate = validatedData.effectiveDate 
      ? new Date(validatedData.effectiveDate)
      : originalContract.expirationDate 
        ? new Date(originalContract.expirationDate)
        : new Date();

    const newExpirationDate = validatedData.expirationDate
      ? new Date(validatedData.expirationDate)
      : new Date(newEffectiveDate.getTime() + originalDuration * 24 * 60 * 60 * 1000);

    // Determine renewal version number
    const existingRenewals = await prisma.contract.count({
      where: {
        OR: [
          { parentContractId: originalContractId, relationshipType: 'RENEWAL' },
          { parentContractId: originalContract.parentContractId, relationshipType: 'RENEWAL' },
        ],
        tenantId,
      },
    });
    const renewalNumber = existingRenewals + 1;

    // Build the renewal contract title
    const baseTitle = originalContract.contractTitle || originalContract.fileName || 'Contract';
    const renewalTitle = validatedData.title || `${baseTitle} - Renewal ${renewalNumber}`;

    // Pre-compute values before transaction (no DB calls inside these)
    const previousValue = originalContract.totalValue ? Number(originalContract.totalValue) : null;
    const prospectiveNewValue = validatedData.totalValue != null
      ? validatedData.totalValue
      : originalContract.totalValue ? Number(originalContract.totalValue) : null;
    const valueChange = previousValue != null && prospectiveNewValue != null ? prospectiveNewValue - previousValue : null;
    const valueChangePercent = previousValue && valueChange != null
      ? (valueChange / previousValue) * 100
      : null;
    const termExtension = originalContract.expirationDate && originalContract.effectiveDate
      ? Math.ceil(
          (newExpirationDate.getTime() - newEffectiveDate.getTime()) / (1000 * 60 * 60 * 24) -
          (new Date(originalContract.expirationDate).getTime() - new Date(originalContract.effectiveDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    // Wrap all DB writes in a transaction — partial failure rolls back completely
    const renewalContract = await prisma.$transaction(async (tx) => {
      // 1. Create the renewal contract
      const created = await tx.contract.create({
        data: {
          // Link to tenant
          tenantId,
          
          // Required fields
          mimeType: originalContract.mimeType || 'application/pdf',
          fileSize: originalContract.fileSize || BigInt(0),
          
          // Basic identification
          contractTitle: renewalTitle,
          fileName: `${baseTitle.replace(/[^a-zA-Z0-9]/g, '_')}_renewal_${renewalNumber}`,
          
          // Copy parties if requested
          ...(validatedData.copyParties && {
            clientId: originalContract.clientId,
            clientName: originalContract.clientName,
            supplierId: originalContract.supplierId,
            supplierName: originalContract.supplierName,
          }),
          
          // Copy terms if requested
          ...(validatedData.copyTerms && {
            contractType: originalContract.contractType,
            contractCategoryId: originalContract.contractCategoryId,
            documentRole: originalContract.documentRole,
            categoryL1: originalContract.categoryL1,
            categoryL2: originalContract.categoryL2,
            currency: originalContract.currency,
            autoRenewalEnabled: originalContract.autoRenewalEnabled,
            renewalTerms: originalContract.renewalTerms as object,
          }),
          
          // New dates
          effectiveDate: newEffectiveDate,
          expirationDate: newExpirationDate,
          startDate: newEffectiveDate,
          endDate: newExpirationDate,
          
          // Value (use override or copy from original)
          totalValue: validatedData.totalValue ?? originalContract.totalValue,
          annualValue: validatedData.totalValue 
            ? validatedData.totalValue / Math.max(1, Math.ceil(originalDuration / 365))
            : originalContract.annualValue,
          
          // Status
          status: 'PENDING',
          renewalStatus: 'PENDING',
          
          // Linking to original contract
          parentContractId: originalContractId,
          relationshipType: 'RENEWAL',
          relationshipNote: validatedData.renewalNote || `Renewal of contract from ${originalContract.effectiveDate?.toISOString().split('T')[0] || 'N/A'} to ${originalContract.expirationDate?.toISOString().split('T')[0] || 'N/A'}`,
          linkedAt: new Date(),
          
          // Copy metadata if requested
          ...(validatedData.copyMetadata && {
            category: originalContract.category,
            tags: originalContract.tags,
            jurisdiction: originalContract.jurisdiction,
          }),
        } as any,
        include: {
          client: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
        },
      });

      // 2. Mark the original contract as renewed
      await tx.contract.update({
        where: { id: originalContractId },
        data: {
          renewalStatus: 'COMPLETED',
          renewalCompletedAt: new Date(),
          renewalNotes: `Renewed with contract ${created.id}`,
        },
      });

      // 3. Copy contract metadata if exists and requested
      if (validatedData.copyMetadata && originalContract.contractMetadata) {
        await tx.contractMetadata.create({
          data: {
            contractId: created.id,
            tenantId,
            updatedBy: ctx.userId,
            customFields: originalContract.contractMetadata.customFields as object,
            aiSummary: `Renewal of contract ${originalContractId}`,
          },
        });
      }

      // 4. Create RenewalHistory record
      await tx.renewalHistory.create({
        data: {
          contractId: originalContractId,
          tenantId,
          renewalNumber: renewalNumber,
          renewalType: 'STANDARD',
          previousStartDate: originalContract.effectiveDate,
          previousEndDate: originalContract.expirationDate,
          previousValue: previousValue,
          newStartDate: newEffectiveDate,
          newEndDate: newExpirationDate,
          newValue: prospectiveNewValue,
          valueChange: valueChange,
          valueChangePercent: valueChangePercent,
          termExtension: termExtension,
          initiatedBy: ctx.userId,
          initiatedAt: new Date(),
          completedBy: ctx.userId,
          completedAt: new Date(),
          status: 'COMPLETED',
          notes: validatedData.renewalNote || null,
          keyChanges: validatedData.totalValue && previousValue && validatedData.totalValue !== previousValue
            ? [{ field: 'totalValue', from: previousValue, to: validatedData.totalValue }]
            : [],
        },
      });

      // 5. Audit log entries (inside transaction for atomicity)
      await tx.auditLog.createMany({
        data: [
          {
            tenantId,
            userId: ctx.userId,
            action: 'CONTRACT_RENEWAL_CREATED',
            resourceType: 'Contract',
            entityType: 'Contract',
            entityId: created.id,
            resource: created.id,
            details: {
              description: `Created renewal contract "${renewalTitle}" from original contract "${originalContract.contractTitle || originalContractId}"`,
            },
            metadata: {
              originalContractId,
              renewalContractId: created.id,
              originalTitle: originalContract.contractTitle,
              renewalTitle,
              effectiveDate: newEffectiveDate.toISOString(),
              expirationDate: newExpirationDate.toISOString(),
              totalValue: created.totalValue ? Number(created.totalValue) : null,
              copyOptions: {
                parties: validatedData.copyParties,
                terms: validatedData.copyTerms,
                metadata: validatedData.copyMetadata,
              },
            },
            ipAddress: request.headers.get('x-forwarded-for') || null,
            userAgent: request.headers.get('user-agent') || null,
          },
          {
            tenantId,
            userId: ctx.userId,
            action: 'CONTRACT_RENEWAL_STATUS_UPDATED',
            resourceType: 'Contract',
            entityType: 'Contract',
            entityId: originalContractId,
            resource: originalContractId,
            details: {
              description: `Original contract marked as renewed. New contract: ${created.id}`,
            },
            metadata: {
              previousStatus: originalContract.renewalStatus,
              newStatus: 'COMPLETED',
              renewalContractId: created.id,
            },
            ipAddress: request.headers.get('x-forwarded-for') || null,
            userAgent: request.headers.get('user-agent') || null,
          },
        ],
      });

      return created;
    });

    // Send email notification for the renewal (non-blocking)
    // In production, get user email from session
    const notifyEmail = process.env.NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
    if (notifyEmail) {
      EmailService.sendRenewalNotification({
        to: notifyEmail,
        recipientName: 'Contract Administrator',
        originalContractName: originalContract.contractTitle || originalContractId,
        renewedContractName: renewalTitle,
        renewedContractId: renewalContract.id,
        renewalDate: new Date(),
        expiryDate: newExpirationDate,
        value: renewalContract.totalValue ? Number(renewalContract.totalValue) : undefined,
        submittedForApproval: validatedData.renewalNote ? Boolean(body?.submitForApproval) : false,
      }).catch((err) => {
        logger.error('[ContractRenew] Email notification error:', err);
      });
    }

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Renewal contract created successfully',
      renewal: {
        id: renewalContract.id,
        title: renewalContract.contractTitle,
        effectiveDate: renewalContract.effectiveDate,
        expirationDate: renewalContract.expirationDate,
        totalValue: renewalContract.totalValue,
        status: renewalContract.status,
        parentContractId: renewalContract.parentContractId,
        relationshipType: renewalContract.relationshipType,
      },
      originalContract: {
        id: originalContractId,
        renewalStatus: 'COMPLETED',
      },
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}

/**
 * GET /api/contracts/[id]/renew - Get renewal chain for a contract
 * Returns all contracts in the renewal chain (predecessors and successors)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const { id: contractId } = await params;
    const tenantId = await getServerTenantId();

    if (!tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Tenant ID required', 401);
    }

    // Fetch the contract
    const contract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        tenantId,
        isDeleted: false,
      },
      select: {
        id: true,
        contractTitle: true,
        parentContractId: true,
        relationshipType: true,
        effectiveDate: true,
        expirationDate: true,
        status: true,
        renewalStatus: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // Find the root contract (oldest in the chain)
    let rootContractId = contractId;
    let currentContract = contract;
    
    while (currentContract.parentContractId && currentContract.relationshipType === 'RENEWAL') {
      const parent = await prisma.contract.findFirst({
        where: {
          id: currentContract.parentContractId,
          tenantId,
          isDeleted: false,
        },
        select: {
          id: true,
          contractTitle: true,
          parentContractId: true,
          relationshipType: true,
          effectiveDate: true,
          expirationDate: true,
          status: true,
          renewalStatus: true,
        },
      });
      
      if (!parent) break;
      
      rootContractId = parent.id;
      currentContract = parent;
    }

    // Build the full renewal chain from root
    const renewalChain: Array<{
      id: string;
      title: string | null;
      effectiveDate: Date | null;
      expirationDate: Date | null;
      status: string | null;
      renewalStatus: string | null;
      isCurrent: boolean;
      order: number;
    }> = [];

    async function buildChain(parentId: string, order: number): Promise<void> {
      const contract = await prisma.contract.findFirst({
        where: { id: parentId, tenantId, isDeleted: false },
        select: {
          id: true,
          contractTitle: true,
          effectiveDate: true,
          expirationDate: true,
          status: true,
          renewalStatus: true,
          childContracts: {
            where: { relationshipType: 'RENEWAL' },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!contract) return;

      renewalChain.push({
        id: contract.id,
        title: contract.contractTitle,
        effectiveDate: contract.effectiveDate,
        expirationDate: contract.expirationDate,
        status: contract.status?.toLowerCase(),
        renewalStatus: contract.renewalStatus,
        isCurrent: contract.id === contractId,
        order,
      });

      // Recursively add renewals
      for (const child of contract.childContracts) {
        await buildChain(child.id, order + 1);
      }
    }

    await buildChain(rootContractId, 1);

    // Sort by order
    renewalChain.sort((a, b) => a.order - b.order);

    return createSuccessResponse(ctx, {
      contractId,
      rootContractId,
      renewalChain,
      totalRenewals: renewalChain.length - 1,
      currentPosition: renewalChain.findIndex(c => c.isCurrent) + 1,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
