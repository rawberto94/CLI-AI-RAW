/**
 * External Collaborator Portal Access
 * 
 * Handles token-based access for external collaborators
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';

/**
 * GET /api/collaborate/[token] - Validate access token and get collaborator portal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const { token } = await params;
    
    if (!token) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Access token required', 400);
    }
    
    // Find collaborator by token
    const collaborator = await prisma.externalCollaborator.findFirst({
      where: {
        accessToken: token,
        status: { in: ['INVITED', 'ACTIVE'] },
        expiresAt: { gt: new Date() },
      },
      include: {
        contractAccess: {
          include: {
            contract: {
              select: {
                id: true,
                fileName: true,
                contractTitle: true,
                status: true,
                effectiveDate: true,
                expirationDate: true,
                clientName: true,
                supplierName: true,
                totalValue: true,
                currency: true,
              },
            },
          },
        },
      },
    });
    
    if (!collaborator) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Invalid or expired access link', 401);
    }
    
    // Get tenant info separately
    const tenant = await prisma.tenant.findUnique({
      where: { id: collaborator.tenantId },
      select: { id: true, name: true },
    });
    
    // Update last access
    await prisma.externalCollaborator.update({
      where: { id: collaborator.id },
      data: { 
        lastAccessAt: new Date(),
        status: 'ACTIVE',
      },
    });
    
    // Log access
    await auditLog({
      action: AuditAction.COLLABORATOR_ACCESSED,
      userId: collaborator.id, // Use collaborator ID as pseudo-user
      tenantId: collaborator.tenantId,
      resourceType: 'external_collaborator',
      resourceId: collaborator.id,
      metadata: { 
        email: collaborator.email,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      },
      requestId: request.headers.get('x-request-id') || undefined,
    });
    
    return createSuccessResponse(ctx, {
      collaborator: {
        id: collaborator.id,
        name: collaborator.name,
        email: collaborator.email,
        company: collaborator.company,
        type: collaborator.type,
        permissions: collaborator.permissions,
      },
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
      } : null,
      contracts: collaborator.contractAccess.map(ca => ({
        id: ca.contract.id,
        name: ca.contract.contractTitle || ca.contract.fileName,
        status: ca.contract.status,
        effectiveDate: ca.contract.effectiveDate,
        expirationDate: ca.contract.expirationDate,
        parties: {
          client: ca.contract.clientName,
          supplier: ca.contract.supplierName,
        },
        value: ca.contract.totalValue ? {
          amount: ca.contract.totalValue,
          currency: ca.contract.currency,
        } : null,
        accessLevel: ca.accessLevel,
      })),
      expiresAt: collaborator.expiresAt,
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

/**
 * POST /api/collaborate/[token] - Perform action as collaborator
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ctx = getApiContext(request);
  try {
    const { token } = await params;
    
    if (!token) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Access token required', 400);
    }
    
    // Validate collaborator
    const collaborator = await prisma.externalCollaborator.findFirst({
      where: {
        accessToken: token,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        permissions: true,
        contractAccess: {
          select: { contractId: true, accessLevel: true },
        },
      },
    });
    
    if (!collaborator) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Invalid or expired access', 401);
    }
    
    const body = await request.json();
    const { action, contractId, data } = body;
    
    // Check contract access
    const contractAccess = collaborator.contractAccess.find(ca => ca.contractId === contractId);
    if (!contractAccess) {
      return createErrorResponse(ctx, 'FORBIDDEN', 'No access to this contract', 403);
    }
    
    // Check permission for action
    const permissions = collaborator.permissions as string[];
    
    switch (action) {
      case 'view_contract':
        if (!permissions.includes('view_contract')) {
          return createErrorResponse(ctx, 'FORBIDDEN', 'Permission denied', 403);
        }
        // Return contract details
        const contract = await prisma.contract.findUnique({
          where: { id: contractId },
          select: {
            id: true,
            fileName: true,
            contractTitle: true,
            description: true,
            status: true,
            effectiveDate: true,
            expirationDate: true,
            clientName: true,
            supplierName: true,
            totalValue: true,
            currency: true,
            metadata: true,
          },
        });
        return createSuccessResponse(ctx, { contract });
        
      case 'download_contract':
        if (!permissions.includes('download_contract')) {
          return createErrorResponse(ctx, 'FORBIDDEN', 'Permission denied', 403);
        }
        // Return download URL (would integrate with storage)
        return createSuccessResponse(ctx, { 
          downloadUrl: `/api/contracts/${contractId}/download?token=${token}` 
        });
        
      case 'view_summary':
        if (!permissions.includes('view_summary')) {
          return createErrorResponse(ctx, 'FORBIDDEN', 'Permission denied', 403);
        }
        // Return AI summary
        const metadata = await prisma.contractMetadata.findUnique({
          where: { contractId },
          select: { aiSummary: true, aiKeyInsights: true },
        });
        return createSuccessResponse(ctx, { 
          summary: metadata?.aiSummary,
          insights: metadata?.aiKeyInsights,
        });
        
      case 'add_comment':
        if (!permissions.includes('comment')) {
          return createErrorResponse(ctx, 'FORBIDDEN', 'Permission denied', 403);
        }
        // Add comment
        const comment = await prisma.contractComment.create({
          data: {
            contractId,
            tenantId: collaborator.tenantId,
            userId: collaborator.id, // Use collaborator ID as the user
            content: data.content,
          },
        });
        
        await auditLog({
          action: AuditAction.COLLABORATOR_COMMENTED,
          userId: collaborator.id,
          tenantId: collaborator.tenantId,
          resourceType: 'contract',
          resourceId: contractId,
          metadata: { commentId: comment.id },
          requestId: request.headers.get('x-request-id') || undefined,
        });
        
        return createSuccessResponse(ctx, { success: true, comment });
        
      default:
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Unknown action', 400);
    }
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
