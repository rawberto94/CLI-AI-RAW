/**
 * External Collaborators API
 * 
 * Limited access for external parties (clients, vendors, partners)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { randomBytes } from 'crypto';
// bcrypt import reserved for future password hashing needs

type CollaboratorType = 'client' | 'vendor' | 'partner' | 'consultant' | 'auditor';

interface CollaboratorInvite {
  email: string;
  name: string;
  company?: string;
  type: CollaboratorType;
  contractIds: string[];
  permissions: string[];
  expiresAt?: string;
  message?: string;
}

/**
 * GET /api/collaborators - List external collaborators
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const searchParams = request.nextUrl.searchParams;
    const contractId = searchParams.get('contractId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    
    const where: any = {
      tenantId: session.user.tenantId,
    };
    
    if (contractId) {
      where.contractAccess = {
        some: { contractId },
      };
    }
    
    if (type) {
      where.type = type;
    }
    
    if (status) {
      where.status = status;
    }
    
    const collaborators = await prisma.externalCollaborator.findMany({
      where,
      include: {
        contractAccess: {
          include: {
            contract: {
              select: { id: true, fileName: true, contractTitle: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json({
      collaborators: collaborators.map(c => ({
        id: c.id,
        email: c.email,
        name: c.name,
        company: c.company,
        type: c.type,
        status: c.status,
        permissions: c.permissions,
        contracts: c.contractAccess.map(ca => ({
          id: ca.contract.id,
          name: ca.contract.contractTitle || ca.contract.fileName,
          accessLevel: ca.accessLevel,
        })),
        invitedBy: c.invitedBy,
        lastAccessAt: c.lastAccessAt,
        expiresAt: c.expiresAt,
        createdAt: c.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Collaborators GET Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch collaborators' }, { status: 500 });
  }
}

/**
 * POST /api/collaborators - Invite external collaborator
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'collaborators:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body: CollaboratorInvite = await request.json();
    const { email, name, company, type, contractIds, permissions, expiresAt, message: _message } = body;
    
    if (!email || !name || !type || !contractIds || contractIds.length === 0) {
      return NextResponse.json({ 
        error: 'email, name, type, and contractIds are required' 
      }, { status: 400 });
    }
    
    // Validate collaborator type
    const validTypes: CollaboratorType[] = ['client', 'vendor', 'partner', 'consultant', 'auditor'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid collaborator type' }, { status: 400 });
    }
    
    // Verify contracts belong to tenant
    const contracts = await prisma.contract.findMany({
      where: {
        id: { in: contractIds },
        tenantId: session.user.tenantId,
      },
      select: { id: true },
    });
    
    if (contracts.length !== contractIds.length) {
      return NextResponse.json({ error: 'One or more contracts not found' }, { status: 404 });
    }
    
    // Check if collaborator already exists
    let collaborator = await prisma.externalCollaborator.findFirst({
      where: {
        tenantId: session.user.tenantId,
        email: email.toLowerCase(),
      },
    });
    
    const accessToken = randomBytes(32).toString('hex');
    const defaultExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    if (collaborator) {
      // Update existing collaborator
      collaborator = await prisma.externalCollaborator.update({
        where: { id: collaborator.id },
        data: {
          name,
          company,
          type: type,
          permissions: permissions || getDefaultPermissions(type),
          accessToken,
          expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiry,
          status: 'INVITED',
        },
      });
    } else {
      // Create new collaborator
      collaborator = await prisma.externalCollaborator.create({
        data: {
          tenantId: session.user.tenantId,
          email: email.toLowerCase(),
          name,
          company,
          type: type,
          permissions: permissions || getDefaultPermissions(type),
          accessToken,
          invitedBy: session.user.id,
          expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiry,
          status: 'INVITED',
        },
      });
    }
    
    // Grant access to contracts
    for (const contractId of contractIds) {
      await prisma.collaboratorContractAccess.upsert({
        where: {
          collaboratorId_contractId: {
            collaboratorId: collaborator.id,
            contractId,
          },
        },
        create: {
          collaboratorId: collaborator.id,
          contractId,
          accessLevel: getAccessLevelForType(type),
        },
        update: {
          accessLevel: getAccessLevelForType(type),
        },
      });
    }
    
    await auditLog({
      action: AuditAction.COLLABORATOR_INVITED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'external_collaborator',
      resourceId: collaborator.id,
      metadata: { email, type, contractIds },
      requestId: request.headers.get('x-request-id') || undefined,
    });
    
    // Send invitation email to collaborator
    try {
      const { sendEmail } = await import('@/lib/email/email-service');
      const accessLink = `${process.env.NEXT_PUBLIC_APP_URL}/collaborate/${accessToken}`;
      await sendEmail({
        to: email,
        subject: 'You\'ve been invited to review contracts on ConTigo',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Contract Access Invitation</h2>
            <p>You've been invited as an external collaborator to review contracts.</p>
            ${_message ? `<p style="background: #f5f5f5; padding: 12px; border-radius: 6px;">${_message}</p>` : ''}
            <p><a href="${accessLink}" style="display: inline-block; background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Access Contracts</a></p>
            <p style="color: #666; font-size: 14px;">This link is valid for your assigned access period.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.warn('Failed to send collaborator invitation email:', emailErr);
    }
    
    return NextResponse.json({ 
      success: true, 
      collaborator: {
        id: collaborator.id,
        email: collaborator.email,
        accessLink: `${process.env.NEXT_PUBLIC_APP_URL}/collaborate/${accessToken}`,
      },
    });
  } catch (error) {
    console.error('[Collaborators POST Error]:', error);
    return NextResponse.json({ error: 'Failed to invite collaborator' }, { status: 500 });
  }
}

/**
 * PUT /api/collaborators - Update collaborator
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'collaborators:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { collaboratorId, status, permissions, expiresAt, contractIds } = await request.json();
    
    if (!collaboratorId) {
      return NextResponse.json({ error: 'Collaborator ID required' }, { status: 400 });
    }
    
    // Verify collaborator belongs to tenant
    const existing = await prisma.externalCollaborator.findFirst({
      where: { id: collaboratorId, tenantId: session.user.tenantId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 });
    }
    
    // Update collaborator
    const updateData: any = {};
    if (status) updateData.status = status;
    if (permissions) updateData.permissions = permissions;
    if (expiresAt) updateData.expiresAt = new Date(expiresAt);
    
    await prisma.externalCollaborator.update({
      where: { id: collaboratorId },
      data: updateData,
    });
    
    // Update contract access if provided
    if (contractIds !== undefined) {
      // Remove existing access
      await prisma.collaboratorContractAccess.deleteMany({
        where: { collaboratorId },
      });
      
      // Add new access
      if (contractIds.length > 0) {
        const contracts = await prisma.contract.findMany({
          where: {
            id: { in: contractIds },
            tenantId: session.user.tenantId,
          },
          select: { id: true },
        });
        
        await prisma.collaboratorContractAccess.createMany({
          data: contracts.map(c => ({
            collaboratorId,
            contractId: c.id,
            accessLevel: getAccessLevelForType(existing.type as CollaboratorType),
          })),
        });
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Collaborators PUT Error]:', error);
    return NextResponse.json({ error: 'Failed to update collaborator' }, { status: 500 });
  }
}

/**
 * DELETE /api/collaborators - Revoke collaborator access
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const canManage = await hasPermission(session.user.id, 'collaborators:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { collaboratorId } = await request.json();
    
    if (!collaboratorId) {
      return NextResponse.json({ error: 'Collaborator ID required' }, { status: 400 });
    }
    
    // Verify collaborator belongs to tenant
    const existing = await prisma.externalCollaborator.findFirst({
      where: { id: collaboratorId, tenantId: session.user.tenantId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 });
    }
    
    // Remove all contract access
    await prisma.collaboratorContractAccess.deleteMany({
      where: { collaboratorId },
    });
    
    // Delete or deactivate collaborator
    // Note: accessToken cannot be set to null due to unique constraint,
    // use a unique revoked token instead
    await prisma.externalCollaborator.update({
      where: { id: collaboratorId },
      data: { 
        status: 'REVOKED',
        accessToken: `revoked_${collaboratorId}_${Date.now()}`,
        revokedAt: new Date(),
      },
    });
    
    await auditLog({
      action: AuditAction.COLLABORATOR_REVOKED,
      userId: session.user.id,
      tenantId: session.user.tenantId,
      resourceType: 'external_collaborator',
      resourceId: collaboratorId,
      metadata: { email: existing.email },
      requestId: request.headers.get('x-request-id') || undefined,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Collaborators DELETE Error]:', error);
    return NextResponse.json({ error: 'Failed to revoke collaborator' }, { status: 500 });
  }
}

/**
 * Get default permissions based on collaborator type
 */
function getDefaultPermissions(type: CollaboratorType): string[] {
  switch (type) {
    case 'client':
      return ['view_contract', 'download_contract', 'view_summary'];
    case 'vendor':
      return ['view_contract', 'comment', 'view_summary'];
    case 'partner':
      return ['view_contract', 'comment', 'download_contract', 'view_summary'];
    case 'consultant':
      return ['view_contract', 'comment', 'download_contract', 'view_analysis', 'view_summary'];
    case 'auditor':
      return ['view_contract', 'download_contract', 'view_analysis', 'view_audit_log', 'view_summary', 'export_data'];
    default:
      return ['view_contract'];
  }
}

/**
 * Get access level based on collaborator type
 */
function getAccessLevelForType(type: CollaboratorType): string {
  switch (type) {
    case 'auditor':
      return 'view'; // Read-only but full access
    case 'consultant':
      return 'view';
    case 'partner':
      return 'comment'; // Can add comments
    case 'vendor':
      return 'comment';
    case 'client':
    default:
      return 'view';
  }
}
