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
  Table,
  TableRow,
  TableCell,
  WidthType,
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
  type: 'h1' | 'h2' | 'h3' | 'paragraph' | 'list-item' | 'blockquote' | 'table';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  rows?: Array<{ cells: string[]; isHeader?: boolean }>;
}

function parseHtmlToBlocks(html: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // Extract tables first, replacing them with placeholders
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableIndex = 0;
  const tables: ContentBlock[] = [];
  const htmlWithoutTables = html.replace(tableRegex, (_match, tableContent: string) => {
    const rows: Array<{ cells: string[]; isHeader: boolean }> = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const cellRegex = /<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
      const cells: string[] = [];
      const isHeader = rowMatch[1].includes('<th');
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(
          cellMatch[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&nbsp;/g, ' ')
            .trim()
        );
      }
      if (cells.length > 0) {
        rows.push({ cells, isHeader });
      }
    }
    if (rows.length > 0) {
      tables.push({ type: 'table', text: '', rows });
    }
    return `__TABLE_PLACEHOLDER_${tableIndex++}__`;
  });

  // Split on block-level tags
  const parts = htmlWithoutTables.split(/(<\/?(?:h[1-3]|p|li|blockquote|ul|ol)[^>]*>)/gi);

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
            // Check for table placeholders in text
            const placeholderMatch = text.match(/__TABLE_PLACEHOLDER_(\d+)__/);
            if (placeholderMatch) {
              const tIdx = parseInt(placeholderMatch[1], 10);
              if (tables[tIdx]) blocks.push(tables[tIdx]);
            } else {
              blocks.push({ type: currentType, text });
            }
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
    const placeholderMatch = remaining.match(/__TABLE_PLACEHOLDER_(\d+)__/);
    if (placeholderMatch) {
      const tIdx = parseInt(placeholderMatch[1], 10);
      if (tables[tIdx]) blocks.push(tables[tIdx]);
    } else {
      blocks.push({ type: 'paragraph', text: remaining });
    }
  }

  // Append any remaining tables not captured by placeholders
  for (let i = 0; i < tables.length; i++) {
    if (!blocks.includes(tables[i])) {
      blocks.push(tables[i]);
    }
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
  const blocks = parseHtmlToBlocks(content);

  doc.setTextColor(dark[0], dark[1], dark[2]);

  for (const block of blocks) {
    if (block.type === 'table' && block.rows) {
      // Render table as grid
      const rows = block.rows;
      if (rows.length === 0) continue;

      const colCount = Math.max(...rows.map(r => r.cells.length));
      const colWidth = contentWidth / colCount;
      const cellPadding = 2;
      const rowHeight = 7;

      for (const row of rows) {
        if (y + rowHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }

        for (let c = 0; c < colCount; c++) {
          const cellX = margin + c * colWidth;
          const cellText = row.cells[c] || '';

          // Draw cell border
          doc.setDrawColor(200, 200, 200);
          doc.rect(cellX, y - 4, colWidth, rowHeight);

          // Cell background for header
          if (row.isHeader) {
            doc.setFillColor(245, 243, 255);
            doc.rect(cellX, y - 4, colWidth, rowHeight, 'F');
            doc.rect(cellX, y - 4, colWidth, rowHeight, 'S');
          }

          doc.setFontSize(9);
          doc.setFont('helvetica', row.isHeader ? 'bold' : 'normal');
          doc.setTextColor(dark[0], dark[1], dark[2]);

          const truncated = cellText.length > 30 ? cellText.slice(0, 28) + '…' : cellText;
          doc.text(truncated, cellX + cellPadding, y);
        }
        y += rowHeight;
      }
      y += 4;
      continue;
    }

    // Regular text blocks
    const line = block.text;
    if (!line.trim()) {
      y += 4;
      continue;
    }

    let fontSize = 11;
    let fontStyle: 'normal' | 'bold' | 'italic' = 'normal';

    if (block.type === 'h1') { fontSize = 16; fontStyle = 'bold'; }
    else if (block.type === 'h2') { fontSize = 14; fontStyle = 'bold'; }
    else if (block.type === 'h3') { fontSize = 12; fontStyle = 'bold'; }
    else if (block.type === 'blockquote') { fontStyle = 'italic'; }

    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);

    const indentX = block.type === 'list-item' || block.type === 'blockquote' ? margin + 8 : margin;
    const prefix = block.type === 'list-item' ? '• ' : '';
    const wrappedLines = doc.splitTextToSize(prefix + line, contentWidth - (indentX - margin));

    for (const wl of wrappedLines) {
      if (y + 6 > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(wl, indentX, y);
      y += 6;
    }
    y += (block.type.startsWith('h') ? 4 : 2);
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

  const children: (Paragraph | Table)[] = [];

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
        if (block.type === 'table' && block.rows) {
          // Render as DOCX table
          const tableRows = block.rows.map((row) => {
            return new TableRow({
              children: row.cells.map((cell) => {
                return new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cell,
                          bold: row.isHeader,
                          size: 20,
                          font: 'Calibri',
                          color: '334155',
                        }),
                      ],
                    }),
                  ],
                  shading: row.isHeader ? { fill: 'F5F3FF' } : undefined,
                  width: { size: 100 / Math.max(row.cells.length, 1), type: WidthType.PERCENTAGE },
                });
              }),
            });
          });

          if (tableRows.length > 0) {
            children.push(
              new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );
          }
        } else {
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
  const blob = new Blob([data as unknown as BlobPart], { type: mimeType });
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
  const filename = `${(input.title || 'draft').replace(/[^a-zA-Z0-9\-_ ]/g, '').trim()}.pdf`;
  downloadFile(data, filename, 'application/pdf');
}

export async function exportDraftAsDOCX(input: DraftExportInput): Promise<void> {
  const data = await generateDraftDOCX(input);
  const filename = `${(input.title || 'draft').replace(/[^a-zA-Z0-9\-_ ]/g, '').trim()}.docx`;
  downloadFile(data, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
