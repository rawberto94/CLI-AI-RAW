import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/ai/validate
 * Validate extracted fields with AI-powered semantic validation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      fields, 
      fieldDefinitions,
      crossFieldRules,
      config = {}
    } = body;

    if (!fields || typeof fields !== 'object') {
      return NextResponse.json(
        { error: 'fields object is required' },
        { status: 400 }
      );
    }

    // Dynamic import to avoid build issues
    const services = await import('@repo/data-orchestration/services');
    const validationService = (services as any).smartFieldValidationService;

    if (!validationService) {
      return NextResponse.json(
        { error: 'Smart field validation service not available' },
        { status: 503 }
      );
    }

    // Register custom field definitions if provided
    if (fieldDefinitions && Array.isArray(fieldDefinitions)) {
      for (const def of fieldDefinitions) {
        validationService.registerFieldDefinition(def);
      }
    }

    // Register cross-field rules if provided
    if (crossFieldRules && Array.isArray(crossFieldRules)) {
      for (const rule of crossFieldRules) {
        validationService.registerCrossFieldRule(rule);
      }
    }

    // Validate all fields
    const result = await validationService.validateFields(fields, config);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: 'Failed to validate fields', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/validate
 * Get available field types and validation rules
 */
export async function GET() {
  try {
    const services = await import('@repo/data-orchestration/services');
    const validationService = (services as any).smartFieldValidationService;

    if (!validationService) {
      return NextResponse.json(
        { error: 'Smart field validation service not available' },
        { status: 503 }
      );
    }

    const definitions = validationService.getFieldDefinitions();
    const rules = validationService.getCrossFieldRules();

    const fieldTypes = [
      'string', 'number', 'date', 'boolean', 'email',
      'phone', 'url', 'currency', 'percentage', 'duration', 'address'
    ];

    return NextResponse.json({
      fieldTypes,
      registeredFields: definitions.map((d: any) => ({
        name: d.name,
        type: d.type,
        required: d.required,
      })),
      crossFieldRules: rules.map((r: any) => ({
        name: r.name,
        description: r.description,
        fields: r.fields,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get validation options' },
      { status: 500 }
    );
  }
}
