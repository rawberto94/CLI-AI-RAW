/**
 * External Collaborator Portal Access
 * 
 * Handles token-based access for external collaborators
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auditLog, AuditAction } from '@/lib/security/audit';

/**
 * GET /api/collaborate/[token] - Validate access token and get collaborator portal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    if (!token) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }
    
    // Find collaborator by token
    const collaborator = await prisma.externalCollaborator.findFirst({
      where: {
        accessToken: token,
        status: { in: ['INVITED', 'ACTIVE'] },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        tenant: {
          select: { id: true, name: true },
        },
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
      return NextResponse.json({ 
        error: 'Invalid or expired access link' 
      }, { status: 401 });
    }
    
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
      request,
    });
    
    return NextResponse.json({
      collaborator: {
        id: collaborator.id,
        name: collaborator.name,
        email: collaborator.email,
        company: collaborator.company,
        type: collaborator.collaboratorType,
        permissions: collaborator.permissions,
      },
      tenant: {
        id: collaborator.tenant.id,
        name: collaborator.tenant.name,
      },
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
    console.error('[Collaborate GET Error]:', error);
    return NextResponse.json({ error: 'Failed to validate access' }, { status: 500 });
  }
}

/**
 * POST /api/collaborate/[token] - Perform action as collaborator
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    if (!token) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }
    
    // Validate collaborator
    const collaborator = await prisma.externalCollaborator.findFirst({
      where: {
        accessToken: token,
        status: 'ACTIVE',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
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
      return NextResponse.json({ error: 'Invalid or expired access' }, { status: 401 });
    }
    
    const body = await request.json();
    const { action, contractId, data } = body;
    
    // Check contract access
    const contractAccess = collaborator.contractAccess.find(ca => ca.contractId === contractId);
    if (!contractAccess) {
      return NextResponse.json({ error: 'No access to this contract' }, { status: 403 });
    }
    
    // Check permission for action
    const permissions = collaborator.permissions as string[];
    
    switch (action) {
      case 'view_contract':
        if (!permissions.includes('view_contract')) {
          return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
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
        return NextResponse.json({ contract });
        
      case 'download_contract':
        if (!permissions.includes('download_contract')) {
          return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }
        // Return download URL (would integrate with storage)
        return NextResponse.json({ 
          downloadUrl: `/api/contracts/${contractId}/download?token=${token}` 
        });
        
      case 'view_summary':
        if (!permissions.includes('view_summary')) {
          return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }
        // Return AI summary
        const metadata = await prisma.contractMetadata.findUnique({
          where: { contractId },
          select: { aiSummary: true, aiKeyInsights: true },
        });
        return NextResponse.json({ 
          summary: metadata?.aiSummary,
          insights: metadata?.aiKeyInsights,
        });
        
      case 'add_comment':
        if (!permissions.includes('comment')) {
          return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }
        // Add comment
        const comment = await prisma.contractComment.create({
          data: {
            contractId,
            content: data.content,
            authorType: 'EXTERNAL',
            authorId: collaborator.id,
            authorEmail: collaborator.email,
          },
        });
        
        await auditLog({
          action: AuditAction.COLLABORATOR_COMMENTED,
          userId: collaborator.id,
          tenantId: collaborator.tenantId,
          resourceType: 'contract',
          resourceId: contractId,
          metadata: { commentId: comment.id },
          request,
        });
        
        return NextResponse.json({ success: true, comment });
        
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Collaborate POST Error]:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
