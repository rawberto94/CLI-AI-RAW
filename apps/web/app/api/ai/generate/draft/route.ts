/**
 * AI Contract Draft Generation API
 *
 * POST /api/ai/generate/draft — Generate a full contract draft using AI
 *
 * Designed to work with the Word Add-in: the add-in calls this endpoint,
 * receives structured HTML/text, and inserts it into Word via Office.js.
 *
 * @version 1.0.0
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import {
  withAuthApiHandler,
  createSuccessResponse,
  createErrorResponse,
  type AuthenticatedApiContext,
} from '@/lib/api-middleware';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface DraftRequest {
  templateId?: string;
  contractType: string;
  variables: Record<string, string>;
  clauses?: string[];                 // Optional clause library IDs to include
  tone?: 'formal' | 'standard' | 'plain-english';
  jurisdiction?: string;
  additionalInstructions?: string;
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { tenantId } = ctx;
  const body = (await request.json()) as DraftRequest;

  if (!body.contractType) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'contractType is required', 400);
  }

  // Resolve template content if provided
  let templateContent = '';
  if (body.templateId) {
    const template = await prisma.contractTemplate.findFirst({
      where: { id: body.templateId, tenantId },
      select: { name: true, clauses: true, category: true },
    });
    if (template) {
      templateContent = `\n\nBase Template (${template.name}):\n${typeof template.clauses === 'string' ? template.clauses.slice(0, 4000) : JSON.stringify(template.clauses).slice(0, 4000)}`;
    }
  }

  // Resolve clause library entries
  let clauseContent = '';
  if (body.clauses && body.clauses.length > 0) {
    const clauses = await prisma.clauseLibrary.findMany({
      where: { id: { in: body.clauses }, tenantId },
      select: { name: true, content: true, category: true },
    });
    if (clauses.length > 0) {
      clauseContent = `\n\nApproved Clauses to incorporate:\n${clauses.map(c => `[${c.category}/${c.name}]\n${c.content}`).join('\n\n')}`;
    }
  }

  // Build variable substitution context
  const variableContext = Object.entries(body.variables || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const tone = body.tone || 'formal';
  const jurisdiction = body.jurisdiction || 'United States';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are an expert contract attorney. Generate a complete, professional contract draft.

Output Requirements:
- Return the contract as clean HTML suitable for insertion into Microsoft Word
- Use proper heading tags (h1, h2, h3) for sections
- Use <p> tags for paragraphs
- Use <ol> and <ul> for numbered and bulleted lists
- Use <strong> for defined terms on first use
- Include proper contract structure: recitals, definitions, operative clauses, general provisions, signatures
- Tone: ${tone}
- Jurisdiction: ${jurisdiction}
- Include placeholder brackets [___] only for fields not provided in variables

Do NOT include any markdown. Return ONLY HTML content.`,
        },
        {
          role: 'user',
          content: `Generate a ${body.contractType} contract with these details:

Variables:
${variableContext || 'None specified — use standard placeholders'}${templateContent}${clauseContent}${body.additionalInstructions ? `\n\nAdditional Instructions:\n${body.additionalInstructions}` : ''}`,
        },
      ],
    });

    const htmlContent = response.choices[0]?.message?.content || '';

    // Also generate a plain text version
    const plainText = htmlContent
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return createSuccessResponse(ctx, {
      html: htmlContent,
      plainText,
      contractType: body.contractType,
      variables: body.variables,
      metadata: {
        model: 'gpt-4o',
        tone,
        jurisdiction,
        generatedAt: new Date().toISOString(),
        templateUsed: body.templateId || null,
        clausesIncorporated: body.clauses?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('AI draft generation error:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Draft generation failed', 500);
  }
});
