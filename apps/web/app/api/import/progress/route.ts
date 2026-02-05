import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiTenantId } from '@/lib/tenant-server';

interface ProgressResponse {
  jobId: string;
  fileName: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  bytesUploaded?: number;
  totalBytes?: number;
  error?: string;
  startedAt: number;
  updatedAt: number;
}

// Map database status to API status
function mapStatus(dbStatus: string): ProgressResponse['status'] {
  switch (dbStatus) {
    case 'PENDING':
    case 'QUEUED':
      return 'uploading';
    case 'PROCESSING':
    case 'VALIDATING':
    case 'NORMALIZING':
      return 'processing';
    case 'COMPLETED':
    case 'REVIEW_REQUIRED':
    case 'APPROVED':
      return 'completed';
    case 'FAILED':
    case 'CANCELLED':
    case 'REJECTED':
      return 'failed';
    default:
      return 'processing';
  }
}

// Calculate progress percentage from job data
function calculateProgress(job: any): number {
  const status = job.status;
  if (status === 'PENDING' || status === 'QUEUED') return 10;
  if (status === 'VALIDATING') return 30;
  if (status === 'NORMALIZING') return 50;
  if (status === 'PROCESSING') return 70;
  if (status === 'COMPLETED' || status === 'APPROVED') return 100;
  if (status === 'FAILED' || status === 'CANCELLED' || status === 'REJECTED') return 100;
  
  // Calculate based on rows processed
  if (job.rowsProcessed > 0) {
    return Math.min(90, Math.floor((job.rowsProcessed / (job.rowsProcessed + 10)) * 100));
  }
  
  return 50;
}

// Transform database job to API response
function transformJob(job: any): ProgressResponse {
  const errors = Array.isArray(job.errors) ? job.errors : [];
  
  return {
    jobId: job.id,
    fileName: job.fileName || 'Unknown',
    status: mapStatus(job.status),
    progress: calculateProgress(job),
    currentStep: job.status,
    totalSteps: 4, // upload, validate, normalize, complete
    completedSteps: ['COMPLETED', 'APPROVED'].includes(job.status) ? 4 :
                   ['PROCESSING'].includes(job.status) ? 3 :
                   ['NORMALIZING'].includes(job.status) ? 2 :
                   ['VALIDATING'].includes(job.status) ? 1 : 0,
    bytesUploaded: job.fileSize ? Number(job.fileSize) : undefined,
    totalBytes: job.fileSize ? Number(job.fileSize) : undefined,
    error: errors.length > 0 ? errors[0]?.message || JSON.stringify(errors[0]) : undefined,
    startedAt: job.startedAt?.getTime() || job.createdAt.getTime(),
    updatedAt: job.completedAt?.getTime() || job.startedAt?.getTime() || job.createdAt.getTime(),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const tenantId = await getApiTenantId(request);

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Fetch from database
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Verify tenant access
    if (tenantId && job.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(transformJob(job));
  } catch (error: unknown) {
    console.error('Failed to check progress:', error);
    return NextResponse.json(
      {
        error: 'Failed to check progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { jobId, status, progress: _progress, currentStep: _currentStep, error, ..._rest } = body;
    const _tenantId = await getApiTenantId(request) || body.tenantId;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: any = {};
    
    if (status) {
      // Map API status to DB status
      switch (status) {
        case 'processing': updateData.status = 'PROCESSING'; break;
        case 'completed': updateData.status = 'COMPLETED'; break;
        case 'failed': updateData.status = 'FAILED'; break;
      }
      
      if (status === 'processing' && !updateData.startedAt) {
        updateData.startedAt = new Date();
      }
      if (status === 'completed' || status === 'failed') {
        updateData.completedAt = new Date();
      }
    }
    
    if (error) {
      // Append error to errors array
      updateData.errors = {
        push: { message: error, timestamp: new Date().toISOString() },
      };
    }

    // Update job in database
    const job = await prisma.importJob.update({
      where: { id: jobId },
      data: updateData,
    });

    return NextResponse.json({ success: true, progress: transformJob(job) });
  } catch (error: unknown) {
    console.error('Failed to update progress:', error);
    return NextResponse.json(
      {
        error: 'Failed to update progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Cleanup old completed/failed jobs
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const olderThan = searchParams.get('olderThan'); // timestamp in ms
    const tenantId = await getApiTenantId(request);

    if (jobId) {
      // Delete specific job
      const job = await prisma.importJob.findUnique({
        where: { id: jobId },
      });
      
      if (!job) {
        return NextResponse.json({ success: true, deleted: 0 });
      }
      
      // Verify tenant access
      if (tenantId && job.tenantId !== tenantId) {
        return NextResponse.json({ success: true, deleted: 0 });
      }
      
      await prisma.importJob.delete({
        where: { id: jobId },
      });
      
      return NextResponse.json({ success: true, deleted: 1 });
    }

    if (olderThan) {
      // Delete old completed/failed entries
      const cutoff = new Date(parseInt(olderThan, 10));
      
      const where: any = {
        status: { in: ['COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED'] },
        completedAt: { lt: cutoff },
      };
      
      if (tenantId) {
        where.tenantId = tenantId;
      }
      
      const result = await prisma.importJob.deleteMany({ where });

      return NextResponse.json({ success: true, deleted: result.count });
    }

    return NextResponse.json(
      { error: 'Either jobId or olderThan parameter is required' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Failed to cleanup progress:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup progress',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
