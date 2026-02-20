/**
 * Draft Document Export Service
 *
 * Generates PDF and DOCX documents from draft HTML content.
 * Uses jspdf (PDF) and docx (DOCX) libraries already in dependencies.
 *
 * @version 1.0.0
 */

import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';

// =============================================================================
// TYPES
// =============================================================================

export interface DraftExportInput {
  title: string;
  content: string; // HTML content from TipTap editor
  contractType?: string;
  author?: string;
  createdAt?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Strip HTML tags and decode entities for plain text usage.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse HTML into simple block structure for DOCX generation.
 */
interface ContentBlock {
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'list-item' | 'blockquote';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

function parseHtmlToBlocks(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  // Split on block-level tags
  const parts = html.split(/(<\/?(?:h[1-3]|p|li|blockquote|ul|ol)[^>]*>)/gi);

  let currentType: ContentBlock['type'] = 'paragraph';
  let buffer = '';

  for (const part of parts) {
    const tagMatch = part.match(/^<(\/?)(\w+)/i);
    if (tagMatch) {
      const [, isClosing, tagName] = tagMatch;
      const tag = tagName.toLowerCase();

      if (!isClosing) {
        // Opening tag
        if (tag === 'h1') currentType = 'h1';
        else if (tag === 'h2') currentType = 'h2';
        else if (tag === 'h3') currentType = 'h3';
        else if (tag === 'li') currentType = 'list-item';
        else if (tag === 'blockquote') currentType = 'blockquote';
        else if (tag === 'p') currentType = 'paragraph';
      } else {
        // Closing tag — flush buffer
        if (['h1', 'h2', 'h3', 'p', 'li', 'blockquote'].includes(tag)) {
          const text = buffer
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .trim();
          if (text) {
            blocks.push({ type: currentType, text });
          }
          buffer = '';
          currentType = 'paragraph';
        }
      }
    } else {
      buffer += part;
    }
  }

  // Flush remaining
  const remaining = buffer
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim();
  if (remaining) {
    blocks.push({ type: 'paragraph', text: remaining });
  }

  return blocks;
}

// =============================================================================
// PDF EXPORT
// =============================================================================

export function generateDraftPDF(input: DraftExportInput): Uint8Array {
  const { title, content, contractType, author } = input;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors
  const primary = [109, 40, 217]; // violet-700
  const dark = [30, 41, 59];     // slate-800
  const muted = [100, 116, 139]; // slate-500

  // --- Header ---
  doc.setFillColor(primary[0], primary[1], primary[2]);
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title || 'Contract Draft', margin, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const subtitle = [contractType, dateStr].filter(Boolean).join(' • ');
  doc.text(subtitle, margin, 22);

  if (author) {
    doc.text(`Prepared by: ${author}`, pageWidth - margin, 14, { align: 'right' });
  }

  y = 42;

  // --- Content ---
  const plainText = htmlToPlainText(content);
  const lines = plainText.split('\n');

  doc.setTextColor(dark[0], dark[1], dark[2]);

  for (const line of lines) {
    if (!line.trim()) {
      y += 4;
      continue;
    }

    // Check headings (from plain text, headings will just be text)
    const fontSize = 11;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');

    const wrappedLines = doc.splitTextToSize(line, contentWidth);

    for (const wl of wrappedLines) {
      if (y + 6 > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(wl, margin, y);
      y += 6;
    }
    y += 2;
  }

  // --- Footer on each page ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(muted[0], muted[1], muted[2]);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text('Contigo Platform — Confidential', margin, pageHeight - 10);
  }

  return new Uint8Array(doc.output('arraybuffer'));
}

// =============================================================================
// DOCX EXPORT
// =============================================================================

export async function generateDraftDOCX(input: DraftExportInput): Promise<Uint8Array> {
  const { title, content, contractType, author } = input;
  const blocks = parseHtmlToBlocks(content);
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: title || 'Contract Draft',
          bold: true,
          size: 36,
          color: '6D28D9',
          font: 'Calibri',
        }),
      ],
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    })
  );

  // Metadata line
  const metaParts = [contractType, dateStr, author ? `By ${author}` : ''].filter(Boolean);
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: metaParts.join(' • '),
          size: 20,
          color: '64748B',
          italics: true,
          font: 'Calibri',
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Content blocks
  for (const block of blocks) {
    switch (block.type) {
      case 'h1':
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: block.text, bold: true, size: 32, font: 'Calibri', color: '1E293B' }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
          })
        );
        break;
      case 'h2':
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: block.text, bold: true, size: 28, font: 'Calibri', color: '1E293B' }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          })
        );
        break;
      case 'h3':
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: block.text, bold: true, size: 24, font: 'Calibri', color: '334155' }),
            ],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );
        break;
      case 'list-item':
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `• ${block.text}`, size: 22, font: 'Calibri', color: '334155' }),
            ],
            indent: { left: 700 },
            spacing: { after: 60 },
          })
        );
        break;
      case 'blockquote':
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: block.text, italics: true, size: 22, font: 'Calibri', color: '64748B' }),
            ],
            indent: { left: 700 },
            spacing: { before: 120, after: 120 },
          })
        );
        break;
      default:
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: block.text, size: 22, font: 'Calibri', color: '334155' }),
            ],
            spacing: { after: 120 },
          })
        );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Contigo Platform — Confidential | Page ', size: 16, color: '94A3B8' }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '94A3B8',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

// =============================================================================
// DOWNLOAD HELPERS
// =============================================================================

export function downloadFile(data: Uint8Array, filename: string, mimeType: string): void {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportDraftAsPDF(input: DraftExportInput): Promise<void> {
  const data = generateDraftPDF(input);
  const filename = `${(input.title || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
  downloadFile(data, filename, 'application/pdf');
}

export async function exportDraftAsDOCX(input: DraftExportInput): Promise<void> {
  const data = await generateDraftDOCX(input);
  const filename = `${(input.title || 'draft').replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
  downloadFile(data, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
