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

import { NextRequest, NextResponse } from 'next/server';
import { 
  metadataSchemaService, 
  type CreateFieldInput,
  type MetadataCategory,
} from '@/lib/services/metadata-schema.service';
import { getApiTenantId } from '@/lib/tenant-server';

// ============================================================================
// GET - Get Schema
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);

    const schema = await metadataSchemaService.getSchema(tenantId);

    return NextResponse.json({
      success: true,
      data: schema,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to get metadata schema' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update Entire Schema
// ============================================================================

export async function PUT(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    const body = await request.json();

    const { action } = body;

    // Handle different actions
    switch (action) {
      case 'reset':
        const resetSchema = await metadataSchemaService.resetToDefault(tenantId);
        return NextResponse.json({
          success: true,
          data: resetSchema,
          message: 'Schema reset to default',
        });

      case 'import':
        if (!body.schemaJson) {
          return NextResponse.json(
            { success: false, error: 'schemaJson is required for import' },
            { status: 400 }
          );
        }
        const importedSchema = await metadataSchemaService.importSchema(tenantId, body.schemaJson);
        return NextResponse.json({
          success: true,
          data: importedSchema,
          message: 'Schema imported successfully',
        });

      case 'update':
      default:
        if (!body.schema) {
          return NextResponse.json(
            { success: false, error: 'schema is required' },
            { status: 400 }
          );
        }
        const updatedSchema = await metadataSchemaService.saveSchema({
          ...body.schema,
          tenantId,
        });
        return NextResponse.json({
          success: true,
          data: updatedSchema,
          message: 'Schema updated successfully',
        });
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to update metadata schema' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Add Field or Category
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    const userId = request.headers.get('x-user-id') || 'system';
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

      return NextResponse.json({
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

      return NextResponse.json({
        success: true,
        data: newField,
        message: 'Field added successfully',
      });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to add to schema' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update Field or Category
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    const body = await request.json();

    const { type, id, ...updates } = body;

    if (type === 'category') {
      const updatedCategory = await metadataSchemaService.updateCategory(tenantId, id, updates);
      return NextResponse.json({
        success: true,
        data: updatedCategory,
        message: 'Category updated successfully',
      });
    } else if (type === 'reorder') {
      await metadataSchemaService.reorderFields(tenantId, body.category, body.fieldIds);
      return NextResponse.json({
        success: true,
        message: 'Fields reordered successfully',
      });
    } else {
      const updatedField = await metadataSchemaService.updateField(tenantId, { id, ...updates });
      return NextResponse.json({
        success: true,
        data: updatedField,
        message: 'Field updated successfully',
      });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete Field or Category
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = await getApiTenantId(request);
    const searchParams = request.nextUrl.searchParams;
    
    const type = searchParams.get('type') || 'field';
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      );
    }

    if (type === 'category') {
      await metadataSchemaService.deleteCategory(tenantId, id);
      return NextResponse.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } else {
      await metadataSchemaService.deleteField(tenantId, id);
      return NextResponse.json({
        success: true,
        message: 'Field deleted successfully',
      });
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete' },
      { status: 500 }
    );
  }
}
