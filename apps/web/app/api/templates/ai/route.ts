/**
 * Template AI API
 *
 * POST /api/templates/ai
 *
 * Actions:
 *  - generate-clauses: Generate a full set of clauses for a template
 *  - improve-clause: Improve/rewrite a single clause
 *  - generate-template: Generate entire template content from a description
 *  - extract-variables: Identify variables that should be parameterized
 */

import { NextRequest } from 'next/server';
import { getAIModel } from '@/lib/ai/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/api-middleware';
import { checkRateLimit, rateLimitResponse, AI_RATE_LIMITS } from '@/lib/ai/rate-limit';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { logger } from '@/lib/logger';

// ── Request schema ─────────────────────────────────────────────────────

const RequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate-clauses'),
    templateName: z.string(),
    category: z.string().optional(),
    description: z.string().optional(),
  }),
  z.object({
    action: z.literal('improve-clause'),
    clauseTitle: z.string(),
    clauseContent: z.string(),
    templateCategory: z.string().optional(),
    instruction: z.enum(['improve', 'simplify', 'strengthen', 'make-compliant']).default('improve'),
  }),
  z.object({
    action: z.literal('generate-template'),
    description: z.string().min(10, 'Description must be at least 10 characters'),
    category: z.string().optional(),
    language: z.string().default('en-US'),
  }),
  z.object({
    action: z.literal('extract-variables'),
    content: z.string().min(10),
  }),
]);

// ── Response schemas ───────────────────────────────────────────────────

const ClauseSchema = z.object({
  title: z.string(),
  category: z.string(),
  content: z.string().describe('Full clause text with {{variableName}} placeholders'),
  variables: z.array(z.string()).describe('Variable names used in this clause'),
});

const GenerateClausesResponseSchema = z.object({
  clauses: z.array(ClauseSchema).describe('8-12 standard clauses for this template type'),
});

const ImproveClauseResponseSchema = z.object({
  title: z.string(),
  content: z.string(),
  changesSummary: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
});

const GenerateTemplateResponseSchema = z.object({
  name: z.string(),
  description: z.string(),
  content: z.string().describe('Full template content with {{variable}} placeholders'),
  variables: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'date', 'currency']),
    required: z.boolean(),
  })),
  suggestedCategory: z.string(),
});

const ExtractVariablesResponseSchema = z.object({
  variables: z.array(z.object({
    name: z.string().describe('camelCase variable name'),
    label: z.string().describe('Human-readable label'),
    type: z.enum(['text', 'number', 'date', 'currency']),
    required: z.boolean(),
    defaultValue: z.string().optional(),
  })),
});

// ── POST handler ───────────────────────────────────────────────────────

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const rl = checkRateLimit(ctx.tenantId, ctx.userId, '/api/templates/ai', AI_RATE_LIMITS.standard);
  if (!rl.allowed) return rateLimitResponse(rl, ctx.requestId);

  try {
    const body = await request.json();
    const input = RequestSchema.parse(body);

    switch (input.action) {
      case 'generate-clauses': {
        const { object } = await generateObject({
          model: getAIModel(),
          schema: GenerateClausesResponseSchema,
          prompt: `You are an expert contract attorney. Generate a comprehensive set of standard clauses for a contract template.

Template: "${input.templateName}"
Category: ${input.category || 'General'}
${input.description ? `Description: ${input.description}` : ''}

Generate 8-12 professional, enterprise-grade clauses covering all essential areas for this type of contract.
Use {{variableName}} syntax for any values that should be parameterized (dates, amounts, party names, etc.).
Use camelCase for variable names. Return complete, production-ready clause text — no brackets like [X days].`,
          temperature: 0.3,
        });

        logger.info('AI template clauses generated', { templateName: input.templateName, count: object.clauses.length });
        await auditLog({
          action: AuditAction.CONTRACT_CREATED,
          resourceType: 'template',
          resourceId: ctx.requestId || 'ai-clauses',
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          metadata: { operation: 'ai_generated', aiAction: 'generate-clauses', templateName: input.templateName },
        }).catch(err => logger.error('[Template] Audit log failed:', err));
        return createSuccessResponse(ctx, object);
      }

      case 'improve-clause': {
        const instructionPrompts: Record<string, string> = {
          improve: 'Improve clarity, reduce ambiguity, and strengthen legal precision while maintaining the original intent.',
          simplify: 'Simplify to plain language that non-lawyers can understand while preserving all legal protections.',
          strengthen: 'Add specific remedies, tighter timelines, clearer obligations, and better enforceability.',
          'make-compliant': 'Ensure compliance with GDPR, CCPA, SOX, and other major regulations. Add necessary data protection and compliance language.',
        };

        const { object } = await generateObject({
          model: getAIModel(),
          schema: ImproveClauseResponseSchema,
          prompt: `You are an expert contract attorney.

${instructionPrompts[input.instruction]}

Category: ${input.templateCategory || 'General'}
Clause Title: "${input.clauseTitle}"
Current Content:
${input.clauseContent}

Return the improved clause with {{variableName}} placeholders preserved. Do not remove existing variables.`,
          temperature: 0.2,
        });

        logger.info('AI clause improved', { clause: input.clauseTitle, instruction: input.instruction });
        await auditLog({
          action: AuditAction.CONTRACT_CREATED,
          resourceType: 'template',
          resourceId: ctx.requestId || 'ai-improve',
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          metadata: { operation: 'ai_generated', aiAction: 'improve-clause', clauseTitle: input.clauseTitle },
        }).catch(err => logger.error('[Template] Audit log failed:', err));
        return createSuccessResponse(ctx, object);
      }

      case 'generate-template': {
        const { object } = await generateObject({
          model: getAIModel(),
          schema: GenerateTemplateResponseSchema,
          prompt: `You are an expert contract attorney. Generate a complete, professional contract template.

Description: "${input.description}"
Category: ${input.category || 'General'}
Language: ${input.language}

Generate a full contract template with:
1. A professional template name and description
2. Complete contract content with proper sections and clauses
3. {{variableName}} placeholders for all parameterizable values (party names, dates, amounts, etc.)
4. A list of all variables with their types

The template should be enterprise-grade, legally sound, and ready for production use.
Use proper formatting with section headers. Use camelCase for variable names.`,
          temperature: 0.3,
        });

        logger.info('AI template generated', { description: input.description.slice(0, 50) });
        await auditLog({
          action: AuditAction.CONTRACT_CREATED,
          resourceType: 'template',
          resourceId: ctx.requestId || 'ai-template',
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          metadata: { operation: 'ai_generated', aiAction: 'generate-template' },
        }).catch(err => logger.error('[Template] Audit log failed:', err));
        return createSuccessResponse(ctx, object);
      }

      case 'extract-variables': {
        const { object } = await generateObject({
          model: getAIModel(),
          schema: ExtractVariablesResponseSchema,
          prompt: `You are a contract template expert. Analyze this template content and identify all values that should be converted to {{variableName}} template variables.

Content:
${input.content}

Identify party names, dates, amounts, percentages, time periods, jurisdictions, email addresses, and any other values that would change between different uses of this template.
Return variable names in camelCase format. Mark date, currency, and numeric variables with appropriate types.`,
          temperature: 0.2,
        });

        logger.info('AI variables extracted', { count: object.variables.length });
        await auditLog({
          action: AuditAction.CONTRACT_CREATED,
          resourceType: 'template',
          resourceId: ctx.requestId || 'ai-variables',
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          metadata: { operation: 'ai_generated', aiAction: 'extract-variables' },
        }).catch(err => logger.error('[Template] Audit log failed:', err));
        return createSuccessResponse(ctx, object);
      }
    }
  } catch (err) {
    logger.error('Template AI error', { error: err instanceof Error ? err.message : String(err) });

    if (err instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', err.errors[0]?.message || 'Invalid request', 400);
    }

    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('API key') || msg.includes('quota')) {
      return createErrorResponse(ctx, 'SERVICE_UNAVAILABLE', 'AI service temporarily unavailable', 503, { retryable: true });
    }

    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'AI generation failed', 500, { retryable: true });
  }
})
