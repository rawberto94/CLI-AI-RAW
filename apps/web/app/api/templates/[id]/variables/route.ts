import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';

// GET /api/templates/[id]/variables - Get template variables
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  try {

    const { id: templateId } = await params;

    // Try to get variables from database
    try {
      const template = await prisma.contractTemplate.findUnique({
        where: { id: templateId },
        select: { 
          id: true, 
          metadata: true,
        },
      });

      if (template) {
        const metadata = template.metadata as Record<string, unknown> | null;
        const variables = metadata?.variables as unknown[];
        
        if (variables && Array.isArray(variables) && variables.length > 0) {
          return createSuccessResponse(ctx, { 
            variables,
            source: 'database'
          });
        }
      }
    } catch {
      // Database lookup failed
    }

    // No variables found for this template
    return createSuccessResponse(ctx, { 
      variables: [],
      source: 'database'
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// PUT /api/templates/[id]/variables - Update template variables
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  try {

    const { id: templateId } = await params;
    const body = await request.json();
    const { variables } = body;

    // Try to update in database
    try {
      const template = await prisma.contractTemplate.findUnique({
        where: { id: templateId },
        select: { metadata: true },
      });

      if (template) {
        const currentMetadata = (template.metadata as Record<string, unknown>) || {};
        
        await prisma.contractTemplate.update({
          where: { id: templateId },
          data: {
            metadata: {
              ...currentMetadata,
              variables,
            },
          },
        });

        return createSuccessResponse(ctx, { 
          variables,
          source: 'database'
        });
      }
    } catch {
      // Database update failed, fallback to mock
    }

    return createSuccessResponse(ctx, { 
      variables,
      source: 'mock'
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// POST /api/templates/[id]/variables - Add a new variable
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(request);
  try {

    const { id: templateId } = await params;
    const body = await request.json();
    const { name, displayName, type, required = false, options, defaultValue, helpText } = body;

    const newVariable = {
      id: `v-${Date.now()}`,
      name,
      displayName,
      type,
      required,
      options,
      defaultValue,
      helpText,
    };

    // Try to add to database
    try {
      const template = await prisma.contractTemplate.findUnique({
        where: { id: templateId },
        select: { metadata: true },
      });

      if (template) {
        const currentMetadata = (template.metadata as Record<string, unknown>) || {};
        const existingVariables = (currentMetadata.variables as Record<string, unknown>[]) || [];
        
        await prisma.contractTemplate.update({
          where: { id: templateId },
          data: {
            metadata: JSON.parse(JSON.stringify({
              ...currentMetadata,
              variables: [...existingVariables, newVariable],
            })),
          },
        });

        return createSuccessResponse(ctx, { 
          variable: newVariable,
          source: 'database'
        });
      }
    } catch {
      // Database update failed, fallback to mock
    }

    return createSuccessResponse(ctx, { 
      variable: newVariable,
      source: 'mock'
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
