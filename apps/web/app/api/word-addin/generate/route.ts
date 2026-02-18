/**
 * Word Add-in Contract Generation API
 * Generates contracts from templates with variable substitution
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedApiContext } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

interface GenerateContractRequest {
  templateId: string;
  variables: Record<string, string>;
  selectedClauses?: string[];
  format: 'ooxml' | 'html' | 'plain';
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedApiContext(req);
    if (!ctx) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body: GenerateContractRequest = await req.json();
    const { templateId, variables, selectedClauses, format } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Template ID is required' } },
        { status: 400 }
      );
    }

    // Fetch template
    const template = await prisma.contractTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: ctx.tenantId,
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Template not found' } },
        { status: 404 }
      );
    }

    // Fetch selected clauses
    let clauses: Array<{ id: string; name: string; content: string }> = [];
    if (selectedClauses && selectedClauses.length > 0) {
      const rawClauses = await prisma.clause.findMany({
        where: {
          id: { in: selectedClauses },
        },
        select: {
          id: true,
          category: true,
          text: true,
        },
      });
      clauses = rawClauses.map(c => ({ id: c.id, name: c.category, content: c.text }));
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

    return NextResponse.json({
      success: true,
      data: {
        content: content.formatted,
        format,
        contractId: draft.id,
        draftId: draft.id,
      },
    });
  } catch (error) {
    console.error('Word Add-in generate error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Contract generation failed' } },
      { status: 500 }
    );
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
  // Basic OOXML structure - in production would use a proper OOXML library
  // For now, return HTML that Word can import
  return `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${escapeXml(content)}</w:t>
      </w:r>
    </w:p>
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
