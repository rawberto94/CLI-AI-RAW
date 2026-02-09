/**
 * Metadata Schema API
 * 
 * Manages custom metadata field definitions per tenant.
 * 
 * GET /api/settings/metadata-schema - Get schema for tenant
 * PUT /api/settings/metadata-schema - Update entire schema
 * POST /api/settings/metadata-schema/fields - Add a new field
 * PUT /api/settings/metadata-schema/fields/[id] - Update a field
 * DELETE /api/settings/metadata-schema/fields/[id] - Delete a field
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { 
  metadataSchemaService, 
  type CreateFieldInput,
  type MetadataCategory,
} from '@/lib/services/metadata-schema.service';
// ============================================================================
// GET - Get Schema
// ============================================================================

export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }
  const tenantId = session.user.tenantId;

  const schema = await metadataSchemaService.getSchema(tenantId);

  return createSuccessResponse(ctx, {
    success: true,
    data: schema,
  });
});

// ============================================================================
// PUT - Update Entire Schema
// ============================================================================

export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }
  const tenantId = session.user.tenantId;
  const body = await request.json();

  const { action } = body;

  // Handle different actions
  switch (action) {
    case 'reset':
      const resetSchema = await metadataSchemaService.resetToDefault(tenantId);
      return createSuccessResponse(ctx, {
        success: true,
        data: resetSchema,
        message: 'Schema reset to default',
      });

    case 'import':
      if (!body.schemaJson) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'schemaJson is required for import', 400);
      }
      const importedSchema = await metadataSchemaService.importSchema(tenantId, body.schemaJson);
      return createSuccessResponse(ctx, {
        success: true,
        data: importedSchema,
        message: 'Schema imported successfully',
      });

    case 'update':
    default:
      if (!body.schema) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'schema is required', 400);
      }
      const updatedSchema = await metadataSchemaService.saveSchema({
        ...body.schema,
        tenantId,
      });
      return createSuccessResponse(ctx, {
        success: true,
        data: updatedSchema,
        message: 'Schema updated successfully',
      });
  }
});

// ============================================================================
// POST - Add Field or Category
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }
  const tenantId = session.user.tenantId;
  const userId = session.user.id;
  const body = await request.json();

  const { type } = body;

  if (type === 'category') {
    // Add new category
    const category: Omit<MetadataCategory, 'id'> = {
      name: body.name,
      label: body.label,
      description: body.description,
      icon: body.icon,
      color: body.color,
      sortOrder: body.sortOrder ?? 999,
    };

    const newCategory = await metadataSchemaService.addCategory(tenantId, category);

    return createSuccessResponse(ctx, {
      success: true,
      data: newCategory,
      message: 'Category added successfully',
    });
  } else {
    // Add new field
    const fieldInput: CreateFieldInput = {
      name: body.name,
      label: body.label,
      type: body.fieldType || body.type,
      category: body.category || 'custom',
      description: body.description,
      required: body.required,
      options: body.options,
      defaultValue: body.defaultValue,
      placeholder: body.placeholder,
      helpText: body.helpText,
      validations: body.validations,
      aiExtractionEnabled: body.aiExtractionEnabled,
      aiExtractionHint: body.aiExtractionHint,
      showInList: body.showInList,
      showInCard: body.showInCard,
      searchable: body.searchable,
      filterable: body.filterable,
    };

    const newField = await metadataSchemaService.addField(tenantId, fieldInput, userId);

    return createSuccessResponse(ctx, {
      success: true,
      data: newField,
      message: 'Field added successfully',
    });
  }
});

// ============================================================================
// PATCH - Update Field or Category
// ============================================================================

export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }
  const tenantId = session.user.tenantId;
  const body = await request.json();

  const { type, id, ...updates } = body;

  if (type === 'category') {
    const updatedCategory = await metadataSchemaService.updateCategory(tenantId, id, updates);
    return createSuccessResponse(ctx, {
      success: true,
      data: updatedCategory,
      message: 'Category updated successfully',
    });
  } else if (type === 'reorder') {
    await metadataSchemaService.reorderFields(tenantId, body.category, body.fieldIds);
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Fields reordered successfully',
    });
  } else {
    const updatedField = await metadataSchemaService.updateField(tenantId, { id, ...updates });
    return createSuccessResponse(ctx, {
      success: true,
      data: updatedField,
      message: 'Field updated successfully',
    });
  }
});

// ============================================================================
// DELETE - Delete Field or Category
// ============================================================================

export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }
  const tenantId = session.user.tenantId;
  const searchParams = request.nextUrl.searchParams;

  const type = searchParams.get('type') || 'field';
  const id = searchParams.get('id');

  if (!id) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'ID is required', 400);
  }

  if (type === 'category') {
    await metadataSchemaService.deleteCategory(tenantId, id);
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Category deleted successfully',
    });
  } else {
    await metadataSchemaService.deleteField(tenantId, id);
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Field deleted successfully',
    });
  }
});
