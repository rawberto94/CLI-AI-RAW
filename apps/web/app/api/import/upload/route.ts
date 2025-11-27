import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

// File type validation
const ALLOWED_FILE_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv', // .csv
  'application/pdf', // .pdf
];

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf'];

// Map file extensions to import sources
const FILE_TYPE_MAP: Record<string, 'XLSX' | 'XLS' | 'CSV' | 'PDF'> = {
  '.xlsx': 'XLSX',
  '.xls': 'XLS',
  '.csv': 'CSV',
  '.pdf': 'PDF',
};

// File size limit: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface UploadResponse {
  success: boolean;
  jobId?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  error?: string;
  details?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    // Get tenant ID from headers or session
    const tenantId = request.headers.get('x-tenant-id') || 'tenant_demo_001';
    
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'No file provided',
          details: 'Please select a file to upload',
        },
        { status: 400 }
      );
    }

    // Validate file type
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file type',
          details: `Only ${ALLOWED_EXTENSIONS.join(', ')} files are allowed`,
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type) && file.type !== '') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid file MIME type',
          details: `File type ${file.type} is not supported`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: 'File too large',
          details: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Empty file',
          details: 'The uploaded file is empty',
        },
        { status: 400 }
      );
    }

    // Generate unique job ID and file path
    const jobId = randomUUID();
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storedFileName = `${timestamp}-${safeFileName}`;
    
    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads', 'rate-cards', tenantId);
    await mkdir(uploadDir, { recursive: true });
    
    // Save file to disk
    const filePath = join(uploadDir, storedFileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Get additional metadata from form
    const supplierId = formData.get('supplierId') as string | null;
    const supplierName = formData.get('supplierName') as string | null;
    const priority = (formData.get('priority') as string) || 'NORMAL';
    const mappingTemplateId = formData.get('mappingTemplateId') as string | null;

    // Create import job in database
    const importJob = await prisma.importJob.create({
      data: {
        id: jobId,
        tenantId,
        source: 'UPLOAD',
        status: 'PENDING',
        priority: (priority === 'HIGH' || priority === 'NORMAL' || priority === 'LOW') ? priority : 'NORMAL',
        fileName: file.name,
        fileSize: BigInt(file.size),
        fileType: FILE_TYPE_MAP[fileExtension] || 'XLSX',
        storagePath: filePath,
        mappingTemplateId: mappingTemplateId || undefined,
        extractedData: {
          originalFileName: file.name,
          uploadedAt: new Date().toISOString(),
          supplierId,
          supplierName,
        },
      },
    });

    console.log('Import job created:', {
      jobId: importJob.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: fileExtension,
      tenantId,
      status: importJob.status,
    });

    return NextResponse.json(
      {
        success: true,
        jobId: importJob.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: fileExtension,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Upload error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check upload status
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'tenant_demo_001';
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Query import job status from database
    const importJob = await prisma.importJob.findFirst({
      where: {
        id: jobId,
        tenantId,
      },
      include: {
        rateCards: {
          select: {
            id: true,
            supplierName: true,
            _count: {
              select: { roles: true },
            },
          },
        },
      },
    });

    if (!importJob) {
      return NextResponse.json(
        { error: 'Import job not found' },
        { status: 404 }
      );
    }

    // Calculate progress based on status
    let progress = 0;
    let message = '';
    
    switch (importJob.status) {
      case 'PENDING':
        progress = 0;
        message = 'Upload received, waiting for processing';
        break;
      case 'VALIDATING':
        progress = 20;
        message = 'Validating file format and contents';
        break;
      case 'MAPPING':
        progress = 40;
        message = 'Mapping columns to rate card fields';
        break;
      case 'PROCESSING':
        progress = 70;
        message = 'Processing rate card entries';
        break;
      case 'COMPLETED':
        progress = 100;
        message = 'Import completed successfully';
        break;
      case 'FAILED':
        progress = 0;
        message = 'Import failed';
        break;
      case 'REQUIRES_REVIEW':
        progress = 90;
        message = 'Import requires manual review';
        break;
    }

    return NextResponse.json({
      jobId: importJob.id,
      status: importJob.status,
      progress,
      message,
      fileName: importJob.fileName,
      createdAt: importJob.createdAt.toISOString(),
      startedAt: importJob.startedAt?.toISOString() || null,
      completedAt: importJob.completedAt?.toISOString() || null,
      rowsProcessed: importJob.rowsProcessed,
      rowsSucceeded: importJob.rowsSucceeded,
      rowsFailed: importJob.rowsFailed,
      errors: importJob.errors,
      warnings: importJob.warnings,
      requiresReview: importJob.requiresReview,
      rateCardsCreated: importJob.rateCards.length,
      mappingConfidence: Number(importJob.mappingConfidence),
    });
  } catch (error) {
    console.error('Status check error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to check status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// OPTIONS endpoint for CORS preflight
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id',
    },
  });
}
