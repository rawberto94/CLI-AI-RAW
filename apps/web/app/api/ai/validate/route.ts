import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/ai/validate
 * Validate extracted fields with AI-powered semantic validation
 */
export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { 
      fields, 
      fieldDefinitions,
      crossFieldRules,
      config = {}
    } = body;

    if (!fields || typeof fields !== 'object') {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'fields object is required', 400);
    }

    // Dynamic import to avoid build issues
    const services = await import('data-orchestration/services');
    const validationService = (services as any).smartFieldValidationService;

    if (!validationService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Smart field validation service not available', 503);
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

    return createSuccessResponse(ctx, {
      ...result });
  });

/**
 * GET /api/ai/validate
 * Get available field types and validation rules
 */
export const GET = withAuthApiHandler(async (_request, ctx) => {
    const services = await import('data-orchestration/services');
    const validationService = (services as any).smartFieldValidationService;

    if (!validationService) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Smart field validation service not available', 503);
    }

    const definitions = validationService.getFieldDefinitions();
    const rules = validationService.getCrossFieldRules();

    const fieldTypes = [
      'string', 'number', 'date', 'boolean', 'email',
      'phone', 'url', 'currency', 'percentage', 'duration', 'address'
    ];

    return createSuccessResponse(ctx, {
      fieldTypes,
      registeredFields: definitions.map((d: any) => ({
        name: d.name,
        type: d.type,
        required: d.required })),
      crossFieldRules: rules.map((r: any) => ({
        name: r.name,
        description: r.description,
        fields: r.fields })) });
  });
