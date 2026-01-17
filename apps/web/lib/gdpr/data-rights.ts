/**
 * GDPR Data Subject Rights API
 * 
 * Implements:
 * - Right to Access (Data Export)
 * - Right to Erasure (Account Deletion)
 * - Right to Rectification (handled via standard APIs)
 * - Right to Data Portability
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createHash, randomBytes } from 'crypto';
import { addJob } from '@/lib/queue';

// =============================================================================
// Types
// =============================================================================

export interface DataExportRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'csv';
  downloadUrl?: string;
  expiresAt?: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface DeletionRequest {
  id: string;
  userId: string;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'cancelled';
  scheduledFor: Date;
  reason?: string;
  createdAt: Date;
  completedAt?: Date;
}

// =============================================================================
// Validation Schemas
// =============================================================================

const ExportRequestSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  includeContracts: z.boolean().default(true),
  includeActivity: z.boolean().default(true),
  includeChats: z.boolean().default(true),
});

const DeletionRequestSchema = z.object({
  confirmEmail: z.string().email(),
  reason: z.string().max(500).optional(),
  acknowledgement: z.literal(true, {
    errorMap: () => ({ message: 'You must acknowledge the deletion terms' }),
  }),
});

// =============================================================================
// Data Export Handler
// =============================================================================

export async function requestDataExport(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    const body = await request.json();
    const validated = ExportRequestSchema.parse(body);
    
    // Check for existing pending export
    const existingExport = await prisma.dataExportRequest.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['pending', 'processing'] },
      },
    });
    
    if (existingExport) {
      return NextResponse.json(
        { 
          error: 'Export already in progress',
          existingRequestId: existingExport.id,
        },
        { status: 409 }
      );
    }
    
    // Create export request
    const exportRequest = await prisma.dataExportRequest.create({
      data: {
        id: `exp_${randomBytes(16).toString('hex')}`,
        userId: session.user.id,
        status: 'pending',
        format: validated.format,
        options: {
          includeContracts: validated.includeContracts,
          includeActivity: validated.includeActivity,
          includeChats: validated.includeChats,
        },
      },
    });
    
    // Queue background job
    await addJob('gdpr-data-export', {
      exportRequestId: exportRequest.id,
      userId: session.user.id,
      format: validated.format,
      options: validated,
    });
    
    // Log for audit
    await prisma.auditLog.create({
      data: {
        action: 'GDPR_EXPORT_REQUESTED',
        userId: session.user.id,
        resourceType: 'DataExportRequest',
        resourceId: exportRequest.id,
        metadata: { format: validated.format },
      },
    });
    
    return NextResponse.json({
      message: 'Data export request submitted',
      requestId: exportRequest.id,
      estimatedTime: '24 hours',
      status: 'pending',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    throw error;
  }
}

// =============================================================================
// Data Deletion Handler
// =============================================================================

export async function requestAccountDeletion(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    const body = await request.json();
    const validated = DeletionRequestSchema.parse(body);
    
    // Verify email matches
    if (validated.confirmEmail.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email confirmation does not match account email' },
        { status: 400 }
      );
    }
    
    // Check for existing deletion request
    const existingDeletion = await prisma.deletionRequest.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ['pending', 'scheduled', 'processing'] },
      },
    });
    
    if (existingDeletion) {
      return NextResponse.json(
        {
          error: 'Deletion already scheduled',
          existingRequestId: existingDeletion.id,
          scheduledFor: existingDeletion.scheduledFor,
        },
        { status: 409 }
      );
    }
    
    // Schedule deletion for 30 days (grace period for cancellation)
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + 30);
    
    const deletionRequest = await prisma.deletionRequest.create({
      data: {
        id: `del_${randomBytes(16).toString('hex')}`,
        userId: session.user.id,
        status: 'scheduled',
        scheduledFor,
        reason: validated.reason,
        confirmationToken: randomBytes(32).toString('hex'),
      },
    });
    
    // Log for audit
    await prisma.auditLog.create({
      data: {
        action: 'GDPR_DELETION_REQUESTED',
        userId: session.user.id,
        resourceType: 'DeletionRequest',
        resourceId: deletionRequest.id,
        metadata: { 
          scheduledFor: scheduledFor.toISOString(),
          reason: validated.reason,
        },
      },
    });
    
    // Send confirmation email
    await addJob('send-email', {
      to: session.user.email,
      template: 'account-deletion-scheduled',
      data: {
        userName: session.user.name,
        scheduledFor: scheduledFor.toLocaleDateString(),
        cancellationUrl: `${process.env.NEXTAUTH_URL}/settings/cancel-deletion?token=${deletionRequest.confirmationToken}`,
      },
    });
    
    return NextResponse.json({
      message: 'Account deletion scheduled',
      requestId: deletionRequest.id,
      scheduledFor: scheduledFor.toISOString(),
      gracePeriodDays: 30,
      cancellationInstructions: 'You can cancel this request within 30 days via the link sent to your email.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    throw error;
  }
}

// =============================================================================
// Cancel Deletion Handler
// =============================================================================

export async function cancelAccountDeletion(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    const deletionRequest = await prisma.deletionRequest.findFirst({
      where: {
        userId: session.user.id,
        status: 'scheduled',
        ...(token ? { confirmationToken: token } : {}),
      },
    });
    
    if (!deletionRequest) {
      return NextResponse.json(
        { error: 'No pending deletion request found' },
        { status: 404 }
      );
    }
    
    await prisma.deletionRequest.update({
      where: { id: deletionRequest.id },
      data: { 
        status: 'cancelled',
        completedAt: new Date(),
      },
    });
    
    // Log for audit
    await prisma.auditLog.create({
      data: {
        action: 'GDPR_DELETION_CANCELLED',
        userId: session.user.id,
        resourceType: 'DeletionRequest',
        resourceId: deletionRequest.id,
      },
    });
    
    return NextResponse.json({
      message: 'Account deletion cancelled',
      requestId: deletionRequest.id,
    });
  } catch (error) {
    throw error;
  }
}

// =============================================================================
// Get Data Export Status
// =============================================================================

export async function getExportStatus(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get('requestId');
  
  const exportRequest = await prisma.dataExportRequest.findFirst({
    where: {
      userId: session.user.id,
      ...(requestId ? { id: requestId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  
  if (!exportRequest) {
    return NextResponse.json(
      { error: 'No export request found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({
    id: exportRequest.id,
    status: exportRequest.status,
    format: exportRequest.format,
    createdAt: exportRequest.createdAt,
    completedAt: exportRequest.completedAt,
    downloadUrl: exportRequest.status === 'completed' ? exportRequest.downloadUrl : null,
    expiresAt: exportRequest.expiresAt,
  });
}

// =============================================================================
// Background Job: Process Data Export
// =============================================================================

export async function processDataExport(jobData: {
  exportRequestId: string;
  userId: string;
  format: 'json' | 'csv';
  options: z.infer<typeof ExportRequestSchema>;
}) {
  const { exportRequestId, userId, format, options } = jobData;
  
  try {
    // Update status to processing
    await prisma.dataExportRequest.update({
      where: { id: exportRequestId },
      data: { status: 'processing' },
    });
    
    // Collect user data
    const userData: Record<string, any> = {};
    
    // User profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        settings: true,
      },
    });
    userData.profile = user;
    
    // Contracts
    if (options.includeContracts) {
      const contracts = await prisma.contract.findMany({
        where: { 
          OR: [
            { createdById: userId },
            { tenantId: user?.tenantId },
          ],
        },
        include: {
          clauses: true,
          metadata: true,
        },
      });
      userData.contracts = contracts;
    }
    
    // Activity/Audit logs
    if (options.includeActivity) {
      const activity = await prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10000, // Limit to last 10k entries
      });
      userData.activity = activity;
    }
    
    // Chat history
    if (options.includeChats) {
      const chats = await prisma.chat.findMany({
        where: { userId },
        include: {
          messages: true,
        },
      });
      userData.chats = chats;
    }
    
    // Generate export file
    let fileContent: string;
    let contentType: string;
    let fileExtension: string;
    
    if (format === 'json') {
      fileContent = JSON.stringify(userData, null, 2);
      contentType = 'application/json';
      fileExtension = 'json';
    } else {
      fileContent = convertToCSV(userData);
      contentType = 'text/csv';
      fileExtension = 'csv';
    }
    
    // Upload to secure storage
    const fileName = `data-export-${userId}-${Date.now()}.${fileExtension}`;
    const downloadUrl = await uploadToSecureStorage(fileName, fileContent, contentType);
    
    // Set expiration (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Update request with download URL
    await prisma.dataExportRequest.update({
      where: { id: exportRequestId },
      data: {
        status: 'completed',
        downloadUrl,
        expiresAt,
        completedAt: new Date(),
      },
    });
    
    // Send notification email
    if (user?.email) {
      await addJob('send-email', {
        to: user.email,
        template: 'data-export-ready',
        data: {
          userName: user.name,
          downloadUrl,
          expiresAt: expiresAt.toLocaleDateString(),
        },
      });
    }
    
  } catch (error) {
    await prisma.dataExportRequest.update({
      where: { id: exportRequestId },
      data: { 
        status: 'failed',
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

// =============================================================================
// Background Job: Process Account Deletion
// =============================================================================

export async function processAccountDeletion(jobData: {
  deletionRequestId: string;
  userId: string;
}) {
  const { deletionRequestId, userId } = jobData;
  
  try {
    // Verify deletion is still scheduled
    const deletionRequest = await prisma.deletionRequest.findUnique({
      where: { id: deletionRequestId },
    });
    
    if (!deletionRequest || deletionRequest.status !== 'scheduled') {
      return; // Deletion was cancelled
    }
    
    // Update status to processing
    await prisma.deletionRequest.update({
      where: { id: deletionRequestId },
      data: { status: 'processing' },
    });
    
    // Begin deletion in transaction
    await prisma.$transaction(async (tx) => {
      // Delete user's chats and messages
      await tx.chatMessage.deleteMany({
        where: { chat: { userId } },
      });
      await tx.chat.deleteMany({
        where: { userId },
      });
      
      // Anonymize audit logs (keep for compliance, remove PII)
      await tx.auditLog.updateMany({
        where: { userId },
        data: {
          userId: 'DELETED_USER',
          metadata: {},
        },
      });
      
      // Delete notifications
      await tx.notification.deleteMany({
        where: { userId },
      });
      
      // Delete sessions
      await tx.session.deleteMany({
        where: { userId },
      });
      
      // Delete accounts (OAuth)
      await tx.account.deleteMany({
        where: { userId },
      });
      
      // Delete API keys
      await tx.apiKey.deleteMany({
        where: { userId },
      });
      
      // Transfer contract ownership or delete
      // (Business logic: transfer to admin or delete based on policy)
      await tx.contract.updateMany({
        where: { createdById: userId },
        data: { createdById: 'SYSTEM' },
      });
      
      // Delete user
      await tx.user.delete({
        where: { id: userId },
      });
    });
    
    // Update deletion request
    await prisma.deletionRequest.update({
      where: { id: deletionRequestId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
    
    // Log completion (without user reference since deleted)
    await prisma.auditLog.create({
      data: {
        action: 'GDPR_DELETION_COMPLETED',
        userId: 'SYSTEM',
        resourceType: 'DeletionRequest',
        resourceId: deletionRequestId,
        metadata: { 
          originalUserId: userId,
          completedAt: new Date().toISOString(),
        },
      },
    });
    
  } catch (error) {
    await prisma.deletionRequest.update({
      where: { id: deletionRequestId },
      data: { 
        status: 'failed',
        metadata: { error: (error as Error).message },
      },
    });
    throw error;
  }
}

// =============================================================================
// Helpers
// =============================================================================

function convertToCSV(data: Record<string, any>): string {
  const lines: string[] = [];
  
  for (const [section, items] of Object.entries(data)) {
    lines.push(`\n=== ${section.toUpperCase()} ===\n`);
    
    if (Array.isArray(items) && items.length > 0) {
      const headers = Object.keys(items[0]);
      lines.push(headers.join(','));
      
      for (const item of items) {
        const values = headers.map(h => {
          const val = item[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return JSON.stringify(val).replace(/,/g, ';');
          return String(val).replace(/,/g, ';');
        });
        lines.push(values.join(','));
      }
    } else if (items && typeof items === 'object') {
      for (const [key, value] of Object.entries(items)) {
        lines.push(`${key},${JSON.stringify(value)}`);
      }
    }
  }
  
  return lines.join('\n');
}

async function uploadToSecureStorage(
  fileName: string, 
  content: string, 
  contentType: string
): Promise<string> {
  // Implementation depends on storage provider (S3, etc.)
  // This is a placeholder - implement based on your infrastructure
  const bucket = process.env.GDPR_EXPORT_BUCKET || 'contigo-gdpr-exports';
  
  // In production, use AWS SDK or similar
  // const s3 = new S3Client({ region: process.env.AWS_REGION });
  // await s3.send(new PutObjectCommand({...}));
  
  // Return signed URL with expiration
  return `https://${bucket}.s3.amazonaws.com/${fileName}?signed=true`;
}
