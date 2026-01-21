/**
 * GDPR Data Subject Rights API
 * 
 * Implements:
 * - Right to Access (Data Export)
 * - Right to Erasure (Account Deletion)
 * - Right to Rectification (handled via standard APIs)
 * - Right to Data Portability
 * 
 * Uses Prisma models: DataExportRequest, DeletionRequest
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { GdprRequestStatus, DeletionRequestStatus } from '@prisma/client';

// Queue integration using BullMQ (when available) or notification service
async function addJob(jobName: string, data: Record<string, unknown>): Promise<void> {
  // Try to use BullMQ if available, otherwise log for manual processing
  try {
    // Dynamic import to avoid build errors if BullMQ not installed
    const bullMQ = await import('bullmq').catch(() => null);
    if (bullMQ && process.env.REDIS_URL) {
      const { Queue } = bullMQ;
      const queue = new Queue('gdpr-jobs', {
        connection: { url: process.env.REDIS_URL }
      });
      await queue.add(jobName, data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
        removeOnComplete: { age: 86400 * 7 }, // Keep 7 days
        removeOnFail: { age: 86400 * 30 }, // Keep 30 days
      });
      await queue.close();
      return;
    }
  } catch {
    // BullMQ not available, fall through to logging
  }
  
  // Fallback: Log for manual processing or webhook trigger
  console.warn(`[GDPR Job] ${jobName}:`, JSON.stringify(data, null, 2));
  
  // In production, you might want to trigger a webhook or serverless function
  if (process.env.GDPR_WEBHOOK_URL) {
    await fetch(process.env.GDPR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GDPR_WEBHOOK_SECRET || ''}`
      },
      body: JSON.stringify({ job: jobName, data }),
    }).catch(err => console.error('[GDPR Webhook Error]', err));
  }
}

// =============================================================================
// Types (for external use - matches Prisma models)
// =============================================================================

export interface DataExportRequestData {
  id: string;
  userId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  format: 'json' | 'csv';
  downloadUrl?: string | null;
  expiresAt?: Date | null;
  createdAt: Date;
  completedAt?: Date | null;
}

export interface DeletionRequestData {
  id: string;
  userId: string;
  status: 'PENDING' | 'SCHEDULED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  scheduledFor: Date;
  reason?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
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
  const session = await getServerSession();
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    const body = await request.json();
    const validated = ExportRequestSchema.parse(body);
    
    // Get user's tenantId
    const user = await prisma.user.findUnique({ 
      where: { id: session.user.id }, 
      select: { tenantId: true } 
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check for existing pending export using Prisma
    const existingExport = await prisma.dataExportRequest.findFirst({
      where: {
        userId: session.user.id,
        status: { in: [GdprRequestStatus.PENDING, GdprRequestStatus.PROCESSING] }
      }
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
    
    // Create export request using Prisma
    const exportRequest = await prisma.dataExportRequest.create({
      data: {
        tenantId: user.tenantId,
        userId: session.user.id,
        status: GdprRequestStatus.PENDING,
        format: validated.format,
        includeContracts: validated.includeContracts,
        includeActivity: validated.includeActivity,
        includeChats: validated.includeChats,
      }
    });
    
    // Queue background job
    await addJob('gdpr-data-export', {
      exportRequestId: exportRequest.id,
      userId: session.user.id,
      tenantId: user.tenantId,
      format: validated.format,
      options: validated,
    });
    
    // Log for audit
    await prisma.auditLog.create({
      data: {
        action: 'GDPR_EXPORT_REQUESTED',
        userId: session.user.id,
        tenantId: user.tenantId,
        resourceType: 'DataExportRequest',
        entityId: exportRequest.id,
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
  const session = await getServerSession();
  
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
    
    // Get user's tenantId
    const user = await prisma.user.findUnique({ 
      where: { id: session.user.id }, 
      select: { tenantId: true, firstName: true } 
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check for existing deletion request using Prisma
    const existingDeletion = await prisma.deletionRequest.findFirst({
      where: {
        userId: session.user.id,
        status: { in: [DeletionRequestStatus.PENDING, DeletionRequestStatus.SCHEDULED, DeletionRequestStatus.PROCESSING] }
      }
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
    const gracePeriodEnds = new Date(scheduledFor);
    
    const confirmationToken = randomBytes(32).toString('hex');
    
    // Create deletion request using Prisma
    const deletionRequest = await prisma.deletionRequest.create({
      data: {
        tenantId: user.tenantId,
        userId: session.user.id,
        status: DeletionRequestStatus.SCHEDULED,
        scheduledFor,
        gracePeriodEnds,
        reason: validated.reason,
        confirmationToken,
      }
    });
    
    // Log for audit
    await prisma.auditLog.create({
      data: {
        action: 'GDPR_DELETION_REQUESTED',
        userId: session.user.id,
        tenantId: user.tenantId,
        resourceType: 'DeletionRequest',
        entityId: deletionRequest.id,
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
        userName: user?.firstName || 'User',
        scheduledFor: scheduledFor.toLocaleDateString(),
        cancellationUrl: `${process.env.NEXTAUTH_URL}/settings/cancel-deletion?token=${confirmationToken}`,
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
  const session = await getServerSession();
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    // Find deletion request in memory storage
    const deletionRequest = Array.from(pendingDeletionRequests.values()).find(
      (req) => req.userId === session.user.id && 
               req.status === 'scheduled' && 
               (!token || req.confirmationToken === token)
    );
    
    if (!deletionRequest) {
      return NextResponse.json(
        { error: 'No pending deletion request found' },
        { status: 404 }
      );
    }
    
    // Update in-memory storage
    deletionRequest.status = 'cancelled';
    deletionRequest.completedAt = new Date();
    pendingDeletionRequests.set(deletionRequest.id, deletionRequest);
    
    // Log for audit - get user's tenantId first
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { tenantId: true } });
    if (user) {
      await prisma.auditLog.create({
        data: {
          action: 'GDPR_DELETION_CANCELLED',
          userId: session.user.id,
          tenantId: user.tenantId,
          resourceType: 'DeletionRequest',
          entityId: deletionRequest.id,
        },
      });
    }
    
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
  const session = await getServerSession();
  
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get('requestId');
  
  // Find export request in memory storage
  let exportRequest: DataExportRequest | undefined;
  if (requestId) {
    exportRequest = pendingExportRequests.get(requestId);
    if (exportRequest && exportRequest.userId !== session.user.id) {
      exportRequest = undefined;
    }
  } else {
    // Get most recent request for user
    const userRequests = Array.from(pendingExportRequests.values())
      .filter((req) => req.userId === session.user.id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    exportRequest = userRequests[0];
  }
  
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
    // Update status to processing (in-memory)
    const exportReq = pendingExportRequests.get(exportRequestId);
    if (exportReq) {
      exportReq.status = 'processing';
      pendingExportRequests.set(exportRequestId, exportReq);
    }
    
    // Collect user data
    const userData: Record<string, any> = {};
    
    // User profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
      },
    });
    userData.profile = user;
    
    // Contracts
    if (options.includeContracts) {
      const contracts = await prisma.contract.findMany({
        where: { 
          OR: [
            { uploadedBy: userId },
            { tenantId: user?.tenantId },
          ],
        },
        include: {
          clauses: true,
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
    
    // Chat history (using ChatConversation model)
    if (options.includeChats) {
      const chats = await prisma.chatConversation.findMany({
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
    
    // Update request with download URL (in-memory)
    const completedReq = pendingExportRequests.get(exportRequestId);
    if (completedReq) {
      completedReq.status = 'completed';
      completedReq.downloadUrl = downloadUrl;
      completedReq.expiresAt = expiresAt;
      completedReq.completedAt = new Date();
      pendingExportRequests.set(exportRequestId, completedReq);
    }
    
    // Send notification email
    if (user?.email) {
      await addJob('send-email', {
        to: user.email,
        template: 'data-export-ready',
        data: {
          userName: user.firstName || 'User',
          downloadUrl,
          expiresAt: expiresAt.toLocaleDateString(),
        },
      });
    }
    
  } catch (error) {
    // Update status to failed (in-memory)
    const failedReq = pendingExportRequests.get(exportRequestId);
    if (failedReq) {
      failedReq.status = 'failed';
      failedReq.completedAt = new Date();
      pendingExportRequests.set(exportRequestId, failedReq);
    }
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
    // Verify deletion is still scheduled (in-memory)
    const deletionRequest = pendingDeletionRequests.get(deletionRequestId);
    
    if (!deletionRequest || deletionRequest.status !== 'scheduled') {
      return; // Deletion was cancelled
    }
    
    // Update status to processing (in-memory)
    deletionRequest.status = 'processing';
    pendingDeletionRequests.set(deletionRequestId, deletionRequest);
    
    // Get user's tenantId for audit log
    const userForTenant = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
    const tenantId = userForTenant?.tenantId || 'SYSTEM';
    
    // Begin deletion in transaction
    await prisma.$transaction(async (tx) => {
      // Delete user's chats and messages (using ChatConversation and ChatMessage)
      await tx.chatMessage.deleteMany({
        where: { conversation: { userId } },
      });
      await tx.chatConversation.deleteMany({
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
      
      // Delete sessions (using UserSession)
      await tx.userSession.deleteMany({
        where: { userId },
      });
      
      // NOTE: Account and ApiKey models don't exist in schema
      // If they are added later, uncomment the following:
      // await tx.account.deleteMany({ where: { userId } });
      // await tx.apiKey.deleteMany({ where: { userId } });
      
      // Transfer contract ownership or delete
      // (Business logic: transfer to admin or delete based on policy)
      await tx.contract.updateMany({
        where: { uploadedBy: userId },
        data: { uploadedBy: 'SYSTEM' },
      });
      
      // Delete user
      await tx.user.delete({
        where: { id: userId },
      });
    });
    
    // Update deletion request (in-memory)
    deletionRequest.status = 'completed';
    deletionRequest.completedAt = new Date();
    pendingDeletionRequests.set(deletionRequestId, deletionRequest);
    
    // Log completion (without user reference since deleted)
    await prisma.auditLog.create({
      data: {
        action: 'GDPR_DELETION_COMPLETED',
        userId: 'SYSTEM',
        tenantId,
        resourceType: 'DeletionRequest',
        entityId: deletionRequestId,
        metadata: { 
          originalUserId: userId,
          completedAt: new Date().toISOString(),
        },
      },
    });
    
  } catch (error) {
    // Update status to failed (in-memory)
    const failedReq = pendingDeletionRequests.get(deletionRequestId);
    if (failedReq) {
      failedReq.status = 'failed';
      pendingDeletionRequests.set(deletionRequestId, failedReq);
    }
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
  _content: string, 
  _contentType: string
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
