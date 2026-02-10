/**
 * Template Import API
 * 
 * POST /api/templates/import
 * 
 * Imports a template from a Word document (.docx).
 * Accepts multipart/form-data with a 'file' field.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseWordDocument } from '@/lib/templates/document-service';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant not found', 400);
  }

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const autoCreate = formData.get('autoCreate') === 'true';

  if (!file) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'No file provided', 400);
  }

  // Validate file type
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];

  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(docx?|doc)$/i)) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid file type. Please upload a Word document (.docx or .doc)', 400);
  }

  // Validate file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'File too large. Maximum size is 10MB.', 400);
  }

  // Read file buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Parse the document
  const result = await parseWordDocument(buffer, file.name);

  if (!result.success || !result.template) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Failed to parse document', 400);
  }

  // If autoCreate is true, create the template in the database
  if (autoCreate) {
    // Prepare clauses for JSON storage
    const clausesJson = result.template.clauses && Array.isArray(result.template.clauses)
      ? result.template.clauses.map((clause, i) => ({
          id: crypto.randomUUID(),
          title: clause.title || `Clause ${i + 1}`,
          content: clause.content || '',
        }))
      : [];

    // Store additional fields in metadata
    const metadataJson = {
      language: result.template.language || 'en-US',
      variables: result.template.variables || [],
      tags: result.template.tags || [],
      content: result.template.content || '',
      importedAt: new Date().toISOString(),
    };

    const template = await prisma.contractTemplate.create({
      data: {
        name: result.template.name || 'Imported Template',
        description: result.template.description || '',
        category: result.template.category || 'General',
        clauses: clausesJson,
        structure: {},
        metadata: metadataJson,
        tenantId,
        createdBy: session.user.email || 'Unknown',
        version: 1,
        isActive: true,
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Template imported and created successfully',
      template: {
        id: template.id,
        name: template.name,
        category: template.category,
      },
      warnings: result.warnings,
    });
  }

  // Return parsed data for preview
  return createSuccessResponse(ctx, {
    success: true,
    message: 'Document parsed successfully',
    template: result.template,
    warnings: result.warnings,
  });
});
