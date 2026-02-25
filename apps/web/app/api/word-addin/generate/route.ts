/**
 * Word Add-in Contract Generation API
 * Generates contracts from templates with variable substitution
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const generateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  variables: z.record(z.string()).optional().default({}),
  selectedClauses: z.array(z.string()).max(50).optional(),
  format: z.enum(['ooxml', 'html', 'plain']).optional().default('html'),
});

export async function POST(req: NextRequest) {
  const apiCtx = getApiContext(req);
  try {
    const ctx = getAuthenticatedApiContext(req);
    if (!ctx) {
      return createErrorResponse(apiCtx, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const body = await req.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', parsed.error.errors[0].message, 400);
    }
    const { templateId, variables, selectedClauses, format } = parsed.data;

    // Fetch template
    const template = await prisma.contractTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: ctx.tenantId,
      },
    });

    if (!template) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Template not found', 404);
    }

    // Fetch selected clauses from reusable ClauseLibrary
    let clauses: Array<{ id: string; name: string; content: string }> = [];
    if (selectedClauses && selectedClauses.length > 0) {
      const rawClauses = await prisma.clauseLibrary.findMany({
        where: {
          id: { in: selectedClauses },
          tenantId: ctx.tenantId,
        },
        select: {
          id: true,
          title: true,
          content: true,
        },
      });
      clauses = rawClauses.map(c => ({ id: c.id, name: c.title, content: c.content }));
    }

    // Generate contract content
    const content = generateContractContent({ content: template.structure, name: template.name }, variables, clauses, format);

    // Create draft record
    const draft = await prisma.contractDraft.create({
      data: {
        tenantId: ctx.tenantId,
        templateId,
        title: variables.contractTitle || `${template.name} - Draft`,
        content: content.raw,
        variables,
        status: 'draft',
        createdBy: ctx.userId || 'word-addin',
      },
    });

    // Track template usage
    await prisma.contractTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return createSuccessResponse(ctx, {
      content: content.formatted,
      format,
      contractId: draft.id,
      draftId: draft.id,
    });
  } catch (error) {
    logger.error('Word Add-in generate error:', error);
    return createErrorResponse(apiCtx, 'SERVER_ERROR', 'Contract generation failed', 500);
  }
}

function generateContractContent(
  template: { content: unknown; name: string },
  variables: Record<string, string>,
  clauses: Array<{ id: string; name: string; content: string }>,
  format: 'ooxml' | 'html' | 'plain'
): { raw: string; formatted: string } {
  // Parse template content
  const templateContent = template.content as {
    sections?: Array<{
      id: string;
      heading: string;
      level: number;
      content: string;
      clauseId?: string;
      isOptional?: boolean;
    }>;
    styles?: {
      headingFont?: string;
      bodyFont?: string;
      fontSize?: number;
    };
  };

  const sections = templateContent?.sections || [];
  const clauseMap = new Map(clauses.map((c) => [c.id, c]));

  // Build content with variable substitution
  let fullContent = '';

  for (const section of sections) {
    // Get section content (from clause if specified)
    let sectionContent = section.content;
    if (section.clauseId && clauseMap.has(section.clauseId)) {
      sectionContent = clauseMap.get(section.clauseId)!.content;
    }

    // Substitute variables
    let processedContent = sectionContent;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedContent = processedContent.replace(placeholder, value || `[${key}]`);
    }

    fullContent += formatSection(section.heading, section.level, processedContent, format);
  }

  // Format based on requested format
  if (format === 'html') {
    const styles = templateContent?.styles || {};
    return {
      raw: fullContent,
      formatted: wrapInHtml(fullContent, styles),
    };
  } else if (format === 'ooxml') {
    return {
      raw: fullContent,
      formatted: convertToOoxml(fullContent),
    };
  }

  return { raw: fullContent, formatted: fullContent };
}

function formatSection(
  heading: string,
  level: number,
  content: string,
  format: 'ooxml' | 'html' | 'plain'
): string {
  if (format === 'html') {
    const tag = `h${Math.min(level + 1, 6)}`;
    return `<${tag}>${heading}</${tag}>\n<p>${content}</p>\n\n`;
  } else if (format === 'plain') {
    const prefix = '#'.repeat(level + 1);
    return `${prefix} ${heading}\n\n${content}\n\n`;
  }
  return `${heading}\n\n${content}\n\n`;
}

function wrapInHtml(
  content: string,
  styles: { headingFont?: string; bodyFont?: string; fontSize?: number }
): string {
  const fontFamily = styles.bodyFont || 'Arial, sans-serif';
  const fontSize = styles.fontSize || 11;

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: ${fontFamily}; font-size: ${fontSize}pt; line-height: 1.6; }
    h1, h2, h3, h4 { font-family: ${styles.headingFont || fontFamily}; margin-top: 1.5em; }
    h1 { font-size: 1.5em; }
    h2 { font-size: 1.3em; }
    h3 { font-size: 1.1em; }
    p { margin: 1em 0; }
  </style>
</head>
<body>
${content}
</body>
</html>`;
}

function convertToOoxml(content: string): string {
  // Split content into paragraphs and generate proper OOXML structure
  const paragraphs = content.split(/\n{2,}/).filter(Boolean);

  const ooxmlParagraphs = paragraphs
    .map((para) => {
      const trimmed = para.trim();

      // Detect heading lines (plain-format sections use "## Heading" syntax)
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2];
        return `    <w:p>
      <w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr>
      <w:r><w:t>${escapeXml(text)}</w:t></w:r>
    </w:p>`;
      }

      // Detect HTML headings from HTML-format sections
      const htmlHeadingMatch = trimmed.match(/^<h([1-6])[^>]*>(.+?)<\/h\1>/i);
      if (htmlHeadingMatch) {
        const level = htmlHeadingMatch[1];
        const text = htmlHeadingMatch[2].replace(/<[^>]+>/g, '');
        return `    <w:p>
      <w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr>
      <w:r><w:t>${escapeXml(text)}</w:t></w:r>
    </w:p>`;
      }

      // Strip HTML <p> tags if present and split into lines
      const cleaned = trimmed
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();

      // Each line becomes a Word paragraph
      return cleaned
        .split('\n')
        .filter(Boolean)
        .map(
          (line) => `    <w:p>
      <w:r><w:t xml:space="preserve">${escapeXml(line.trim())}</w:t></w:r>
    </w:p>`,
        )
        .join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
            mc:Ignorable="w14">
  <w:body>
${ooxmlParagraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
               w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
