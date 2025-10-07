import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

// ============================================================================
// FILE VALIDATION CONSTANTS
// ============================================================================

// Allowed file types per requirements (PDF, DOCX, TXT, HTML, images)
const ALLOWED_MIME_TYPES = [
  // PDF
  'application/pdf',
  // Word documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  // Text
  'text/plain',
  // HTML
  'text/html',
  'application/xhtml+xml',
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp',
];

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.doc',
  '.txt',
  '.html',
  '.htm',
  '.jpeg',
  '.jpg',
  '.png',
  '.gif',
  '.bmp',
  '.tiff',
  '.tif',
  '.webp',
];

// File size limit: 100MB per requirements
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UploadResponse {
  success: boolean;
  contractId?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  status?: string;
  message?: string;
  error?: string;
  details?: string;
}

interface FileValidationResult {
  valid: boolean;
  error?: string;
  details?: string;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate file type based on extension and MIME type
 */
function validateFileType(file: File): FileValidationResult {
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
  
  // Check extension
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    return {
      valid: false,
      error: 'Invalid file type',
      details: `File extension ${fileExtension} is not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  // Check MIME type (if provided)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid MIME type',
      details: `MIME type ${file.type} is not supported`,
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
function validateFileSize(file: File): FileValidationResult {
  if (file.size === 0) {
    return {
      valid: false,
      error: 'Empty file',
      details: 'The uploaded file is empty',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: 'File too large',
      details: `File size (${fileSizeMB}MB) exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent path traversal and other security issues
 */
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.+/g, '.')
    .replace(/_+/g, '_')
    .substring(0, 255); // Limit filename length
}

// ============================================================================
// MAIN UPLOAD HANDLER
// ============================================================================

/**
 * POST /api/contracts/upload
 * 
 * Upload a contract file with validation
 * Requirements: 1.1, 1.7
 */
export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  console.log('📤 Contract upload request received at /api/contracts/upload');

  try {
    // Get tenant ID from headers or default
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
    console.log('Tenant ID:', tenantId);
    
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    // Validate file presence
    if (!file) {
      console.log('❌ No file provided in request');
      return NextResponse.json(
        {
          success: false,
          error: 'No file provided',
          details: 'Please select a file to upload',
        },
        { status: 400 }
      );
    }

    console.log('📋 File received:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Validate file type
    const typeValidation = validateFileType(file);
    if (!typeValidation.valid) {
      console.log('❌ File type validation failed:', typeValidation.error);
      return NextResponse.json(
        {
          success: false,
          error: typeValidation.error,
          details: typeValidation.details,
        },
        { status: 400 }
      );
    }

    // Validate file size
    const sizeValidation = validateFileSize(file);
    if (!sizeValidation.valid) {
      console.log('❌ File size validation failed:', sizeValidation.error);
      return NextResponse.json(
        {
          success: false,
          error: sizeValidation.error,
          details: sizeValidation.details,
        },
        { status: 400 }
      );
    }

    // Generate unique contract ID
    const contractId = randomUUID();
    console.log('🆔 Generated contract ID:', contractId);

    // Prepare file storage
    const timestamp = Date.now();
    const sanitizedFileName = sanitizeFileName(file.name);
    const storedFileName = `${timestamp}-${contractId}-${sanitizedFileName}`;
    
    // Create upload directory structure
    const uploadDir = join(process.cwd(), 'uploads', 'contracts', tenantId);
    await mkdir(uploadDir, { recursive: true });
    
    // Save file to disk
    const filePath = join(uploadDir, storedFileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    console.log('💾 File saved to:', filePath);

    // Extract additional metadata from form
    const metadata = {
      contractType: formData.get('contractType') as string | null,
      clientName: formData.get('clientName') as string | null,
      supplierName: formData.get('supplierName') as string | null,
      uploadedBy: formData.get('uploadedBy') as string | null,
    };

    // Create contract record in database using ContractCreationService
    let result;
    try {
      const { getDatabaseManager } = await import('clients-db');
      const { getFileStorageService } = await import('@core/storage/file-storage.service');
      const { createContractCreationService } = await import('@core/contracts/contract-creation.service');

      const databaseManager = getDatabaseManager();
      const fileStorageService = getFileStorageService();
      const contractCreationService = createContractCreationService(
        databaseManager,
        fileStorageService
      );

      // Create contract with processing job
      result = await contractCreationService.createContract(
        {
          fileName: storedFileName,
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          filePath,
          tenantId,
          uploadedBy: metadata.uploadedBy || undefined,
          contractType: metadata.contractType || undefined,
          clientName: metadata.clientName || undefined,
          supplierName: metadata.supplierName || undefined,
        },
        {
          uploadToStorage: true,
          createProcessingJob: true,
          startProcessing: false, // Will be started by worker orchestrator in task 3
        }
      );
    } catch (dbError) {
      console.error('Database error, using fallback:', dbError);
      // Fallback: return success without database
      result = {
        contract: {
          id: contractId,
          status: 'UPLOADED',
        },
        processingJobId: 'pending',
        message: 'File uploaded successfully (database unavailable, using fallback)',
      };
    }

    console.log('✅ Contract created:', {
      contractId: result.contract.id,
      processingJobId: result.processingJobId,
      storageKey: result.storageKey,
    });

    return NextResponse.json(
      {
        success: true,
        contractId: result.contract.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        status: result.contract.status,
        processingJobId: result.processingJobId,
        message: result.message,
      },
      { 
        status: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id',
        }
      }
    );
  } catch (error) {
    console.error('❌ Upload error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      {
        success: false,
        error: 'Upload failed',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id',
        }
      }
    );
  }
}

// ============================================================================
// OPTIONS HANDLER FOR CORS
// ============================================================================

/**
 * OPTIONS /api/contracts/upload
 * 
 * Handle CORS preflight requests
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id',
      'Access-Control-Max-Age': '86400',
    },
  });
}
