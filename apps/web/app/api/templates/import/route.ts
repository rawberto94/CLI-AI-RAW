/**
 * Template Import API
 * 
 * POST /api/templates/import
 * 
 * Imports a template from a Word document (.docx).
 * Accepts multipart/form-data with a 'file' field.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseWordDocument } from '@/lib/templates/document-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const autoCreate = formData.get('autoCreate') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(docx?|doc)$/i)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a Word document (.docx or .doc)' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the document
    const result = await parseWordDocument(buffer, file.name);

    if (!result.success || !result.template) {
      return NextResponse.json(
        {
          error: 'Failed to parse document',
          details: result.errors,
        },
        { status: 400 }
      );
    }

    // If autoCreate is true, create the template in the database
    if (autoCreate) {
      const template = await prisma.contractTemplate.create({
        data: {
          name: result.template.name || 'Imported Template',
          description: result.template.description || '',
          category: result.template.category || 'General',
          content: result.template.content || '',
          status: 'draft',
          language: result.template.language || 'en-US',
          variables: result.template.variables || [],
          tags: result.template.tags || [],
          tenantId,
          createdBy: session.user.name || session.user.email || 'Unknown',
          version: '1.0.0',
        },
      });

      // Create clauses if any
      if (result.template.clauses && Array.isArray(result.template.clauses)) {
        for (let i = 0; i < result.template.clauses.length; i++) {
          const clause = result.template.clauses[i];
          await prisma.templateClause.create({
            data: {
              templateId: template.id,
              title: clause.title || `Clause ${i + 1}`,
              content: clause.content,
              order: i,
            },
          });
        }
      }

      return NextResponse.json({
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
    return NextResponse.json({
      success: true,
      message: 'Document parsed successfully',
      template: result.template,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('Template import error:', error);
    return NextResponse.json(
      {
        error: 'Failed to import template',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
