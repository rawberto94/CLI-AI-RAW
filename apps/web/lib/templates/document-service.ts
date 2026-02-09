/**
 * Template Document Service
 * 
 * Provides functionality for:
 * - Exporting templates to Word (.docx)
 * - Exporting templates to PDF
 * - Importing templates from Word (.docx)
 * - Syncing templates to/from cloud storage (SharePoint, OneDrive, Google Drive)
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  convertInchesToTwip,
  ShadingType,
} from 'docx';

// Template interface (matches the one in templates page)
export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  language?: string;
  variables?: number | string[];
  clauses?: number | Array<{ id: string; title?: string; content: string }>;
  createdBy?: string;
  createdAt: string;
  lastModified?: string;
  updatedAt?: string;
  status: 'draft' | 'active' | 'archived' | 'pending_approval';
  usageCount?: number;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'none';
  content?: string;
  tags?: string[];
  version?: string;
}

// Export options
export interface ExportOptions {
  includeMetadata?: boolean;
  includeVariables?: boolean;
  includeClauses?: boolean;
  includeHeader?: boolean;
  includeFooter?: boolean;
  watermark?: string;
  companyName?: string;
  companyLogo?: string;
}

// Import result
export interface ImportResult {
  success: boolean;
  template?: Partial<ContractTemplate>;
  errors?: string[];
  warnings?: string[];
}

// Cloud sync options
export interface CloudSyncOptions {
  provider: 'sharepoint' | 'onedrive' | 'google-drive';
  folderId?: string;
  folderPath?: string;
  overwrite?: boolean;
}

/**
 * Generate a Word document from a template
 */
export async function generateWordDocument(
  template: ContractTemplate,
  options: ExportOptions = {}
): Promise<Buffer> {
  const {
    includeMetadata = true,
    includeVariables = true,
    includeClauses = true,
    includeHeader = true,
    includeFooter = true,
    watermark,
    companyName = 'Contigo Platform',
  } = options;

  // Create document sections
  const children: Paragraph[] = [];

  // Add watermark if provided
  if (watermark) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: watermark,
            color: 'CCCCCC',
            size: 72,
            bold: true,
          }),
        ],
        alignment: AlignmentType.CENTER,
      })
    );
  }

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: template.name,
          bold: true,
          size: 48,
          color: '2563EB',
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Category and Status badges
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Category: ${template.category}`,
          size: 24,
          color: '6B7280',
        }),
        new TextRun({ text: '  |  ', size: 24, color: '6B7280' }),
        new TextRun({
          text: `Status: ${template.status.toUpperCase()}`,
          size: 24,
          color: template.status === 'active' ? '10B981' : template.status === 'draft' ? 'F59E0B' : '6B7280',
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  // Description
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Description',
          bold: true,
          size: 28,
          color: '1F2937',
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: template.description,
          size: 24,
          color: '4B5563',
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Metadata section
  if (includeMetadata) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Template Information',
            bold: true,
            size: 28,
            color: '1F2937',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    // Create metadata table
    const metadataRows: TableRow[] = [
      createMetadataRow('Template ID', template.id),
      createMetadataRow('Version', template.version || '1.0.0'),
      createMetadataRow('Language', template.language || 'en-US'),
      createMetadataRow('Created By', template.createdBy || 'System'),
      createMetadataRow('Created At', new Date(template.createdAt).toLocaleDateString()),
      createMetadataRow('Last Modified', new Date(template.lastModified || template.updatedAt || template.createdAt).toLocaleDateString()),
      createMetadataRow('Usage Count', String(template.usageCount || 0)),
    ];

    if (template.tags && template.tags.length > 0) {
      metadataRows.push(createMetadataRow('Tags', template.tags.join(', ')));
    }

    children.push(
      new Paragraph({
        children: [],
        spacing: { after: 200 },
      })
    );

    // We'll add the table separately
  }

  // Variables section
  if (includeVariables && template.variables) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Template Variables',
            bold: true,
            size: 28,
            color: '1F2937',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const variableCount = typeof template.variables === 'number' 
      ? template.variables 
      : template.variables.length;

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `This template contains ${variableCount} variable(s) that need to be filled in when creating a contract.`,
            size: 24,
            color: '4B5563',
          }),
        ],
        spacing: { after: 200 },
      })
    );

    // List variables if they're an array
    if (Array.isArray(template.variables)) {
      template.variables.forEach((variable, index) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${index + 1}. `,
                bold: true,
                size: 24,
              }),
              new TextRun({
                text: `{{${variable}}}`,
                size: 24,
                color: '7C3AED',
                highlight: 'yellow',
              }),
            ],
            bullet: { level: 0 },
            spacing: { after: 100 },
          })
        );
      });
    }
  }

  // Clauses section
  if (includeClauses && template.clauses) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Template Clauses',
            bold: true,
            size: 28,
            color: '1F2937',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const clauses = Array.isArray(template.clauses) ? template.clauses : [];
    const clauseCount = Array.isArray(template.clauses) ? template.clauses.length : template.clauses;

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `This template contains ${clauseCount} clause(s).`,
            size: 24,
            color: '4B5563',
          }),
        ],
        spacing: { after: 300 },
      })
    );

    // Add each clause
    clauses.forEach((clause, index) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Clause ${index + 1}: ${clause.title || 'Untitled Clause'}`,
              bold: true,
              size: 26,
              color: '1F2937',
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: clause.content,
              size: 24,
              color: '374151',
            }),
          ],
          spacing: { after: 200 },
        })
      );
    });
  }

  // Main content section
  if (template.content) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Template Content',
            bold: true,
            size: 28,
            color: '1F2937',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    // Split content into paragraphs
    const contentParagraphs = template.content.split('\n\n');
    contentParagraphs.forEach((para) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: para.trim(),
              size: 24,
              color: '374151',
            }),
          ],
          spacing: { after: 200 },
        })
      );
    });
  }

  // Create document with header and footer
  const doc = new Document({
    creator: companyName,
    title: template.name,
    description: template.description,
    subject: `Contract Template - ${template.category}`,
    keywords: template.tags?.join(', ') || '',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        headers: includeHeader
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: companyName,
                        bold: true,
                        size: 20,
                        color: '6B7280',
                      }),
                      new TextRun({ text: '  |  ', size: 20, color: '6B7280' }),
                      new TextRun({
                        text: template.name,
                        size: 20,
                        color: '6B7280',
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
            }
          : undefined,
        footers: includeFooter
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Template ID: ${template.id}  |  Generated on ${new Date().toLocaleDateString()}  |  Page `,
                        size: 18,
                        color: '9CA3AF',
                      }),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                        size: 18,
                        color: '9CA3AF',
                      }),
                      new TextRun({
                        text: ' of ',
                        size: 18,
                        color: '9CA3AF',
                      }),
                      new TextRun({
                        children: [PageNumber.TOTAL_PAGES],
                        size: 18,
                        color: '9CA3AF',
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
            }
          : undefined,
        children,
      },
    ],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

/**
 * Helper function to create metadata table rows
 */
function createMetadataRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: label,
                bold: true,
                size: 22,
                color: '374151',
              }),
            ],
          }),
        ],
        width: { size: 30, type: WidthType.PERCENTAGE },
        shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
      }),
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: value,
                size: 22,
                color: '4B5563',
              }),
            ],
          }),
        ],
        width: { size: 70, type: WidthType.PERCENTAGE },
      }),
    ],
  });
}

/**
 * Generate a PDF document from a template
 */
export async function generatePDFDocument(
  template: ContractTemplate,
  options: ExportOptions = {}
): Promise<Buffer> {
  // Dynamic import to avoid issues with SSR
  const PDFDocument = (await import('pdfkit')).default;
  
  return new Promise((resolve, reject) => {
    try {
      const {
        includeMetadata = true,
        includeVariables = true,
        includeClauses = true,
        watermark,
        companyName = 'Contigo Platform',
      } = options;

      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 72, bottom: 72, left: 72, right: 72 },
        info: {
          Title: template.name,
          Author: companyName,
          Subject: `Contract Template - ${template.category}`,
          Keywords: template.tags?.join(', ') || '',
          Creator: 'Contigo Platform',
          Producer: 'Contigo Platform',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Add watermark if provided
      if (watermark) {
        doc.fontSize(72)
          .fillColor('#EEEEEE')
          .text(watermark, 100, 300, {
            align: 'center',
            oblique: true,
          });
        doc.fillColor('#000000');
      }

      // Header
      doc.fontSize(10)
        .fillColor('#6B7280')
        .text(`${companyName}  |  ${template.name}`, 72, 40, { align: 'center' });
      
      doc.moveTo(72, 60).lineTo(540, 60).stroke('#E5E7EB');

      // Title
      doc.moveDown(2)
        .fontSize(28)
        .fillColor('#7C3AED')
        .text(template.name, { align: 'center' });

      // Category and Status
      doc.moveDown(0.5)
        .fontSize(12)
        .fillColor('#6B7280')
        .text(`Category: ${template.category}  |  Status: ${template.status.toUpperCase()}`, { align: 'center' });

      // Description
      doc.moveDown(2)
        .fontSize(16)
        .fillColor('#1F2937')
        .text('Description', { underline: true });
      
      doc.moveDown(0.5)
        .fontSize(12)
        .fillColor('#4B5563')
        .text(template.description);

      // Metadata
      if (includeMetadata) {
        doc.moveDown(1.5)
          .fontSize(16)
          .fillColor('#1F2937')
          .text('Template Information', { underline: true });

        doc.moveDown(0.5)
          .fontSize(11)
          .fillColor('#4B5563');

        const metadata = [
          ['Template ID', template.id],
          ['Version', template.version || '1.0.0'],
          ['Language', template.language || 'en-US'],
          ['Created By', template.createdBy || 'System'],
          ['Created At', new Date(template.createdAt).toLocaleDateString()],
          ['Last Modified', new Date(template.lastModified || template.updatedAt || template.createdAt).toLocaleDateString()],
          ['Usage Count', String(template.usageCount || 0)],
        ];

        if (template.tags && template.tags.length > 0) {
          metadata.push(['Tags', template.tags.join(', ')]);
        }

        metadata.forEach(([label, value]) => {
          doc.fontSize(11)
            .fillColor('#374151')
            .text(`${label}: `, { continued: true })
            .fillColor('#4B5563')
            .text(value);
        });
      }

      // Variables
      if (includeVariables && template.variables) {
        doc.moveDown(1.5)
          .fontSize(16)
          .fillColor('#1F2937')
          .text('Template Variables', { underline: true });

        const variableCount = typeof template.variables === 'number'
          ? template.variables
          : template.variables.length;

        doc.moveDown(0.5)
          .fontSize(11)
          .fillColor('#4B5563')
          .text(`This template contains ${variableCount} variable(s).`);

        if (Array.isArray(template.variables)) {
          doc.moveDown(0.5);
          template.variables.forEach((variable, index) => {
            doc.fontSize(11)
              .fillColor('#7C3AED')
              .text(`  ${index + 1}. {{${variable}}}`);
          });
        }
      }

      // Clauses
      if (includeClauses && template.clauses) {
        doc.moveDown(1.5)
          .fontSize(16)
          .fillColor('#1F2937')
          .text('Template Clauses', { underline: true });

        const clauses = Array.isArray(template.clauses) ? template.clauses : [];
        const clauseCount = Array.isArray(template.clauses) ? template.clauses.length : template.clauses;

        doc.moveDown(0.5)
          .fontSize(11)
          .fillColor('#4B5563')
          .text(`This template contains ${clauseCount} clause(s).`);

        clauses.forEach((clause, index) => {
          doc.moveDown(1)
            .fontSize(13)
            .fillColor('#1F2937')
            .text(`Clause ${index + 1}: ${clause.title || 'Untitled Clause'}`);

          doc.moveDown(0.3)
            .fontSize(11)
            .fillColor('#374151')
            .text(clause.content);
        });
      }

      // Content
      if (template.content) {
        doc.addPage()
          .fontSize(16)
          .fillColor('#1F2937')
          .text('Template Content', { underline: true });

        doc.moveDown(0.5)
          .fontSize(11)
          .fillColor('#374151')
          .text(template.content);
      }

      // Footer on each page
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(9)
          .fillColor('#9CA3AF')
          .text(
            `Template ID: ${template.id}  |  Generated on ${new Date().toLocaleDateString()}  |  Page ${i + 1} of ${pageCount}`,
            72,
            doc.page.height - 50,
            { align: 'center' }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Parse a Word document and extract template data
 */
export async function parseWordDocument(
  buffer: Buffer,
  filename: string
): Promise<ImportResult> {
  try {
    // Dynamic import mammoth for parsing Word docs
    const mammoth = await import('mammoth');
    
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    const warnings: string[] = result.messages
      .filter(m => m.type === 'warning')
      .map(m => m.message);

    // Try to extract structured data from the text
    const lines = text.split('\n').filter(line => line.trim());
    
    // Extract template name (first non-empty line or filename)
    const name = lines[0]?.trim() || filename.replace(/\.(docx?|doc)$/i, '');
    
    // Extract description (second paragraph or first 200 chars)
    const description = lines.slice(1, 3).join(' ').trim().substring(0, 500) ||
      `Imported from ${filename}`;

    // Try to detect category from content
    const categoryKeywords: Record<string, string[]> = {
      'Technology': ['software', 'license', 'saas', 'technology', 'api', 'data'],
      'Legal': ['agreement', 'contract', 'legal', 'terms', 'conditions'],
      'Employment': ['employment', 'employee', 'salary', 'benefits', 'hr'],
      'Finance': ['payment', 'invoice', 'financial', 'banking', 'loan'],
      'Healthcare': ['medical', 'health', 'patient', 'hipaa', 'healthcare'],
      'Real Estate': ['lease', 'property', 'tenant', 'landlord', 'real estate'],
    };

    let detectedCategory = 'General';
    const lowerText = text.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        detectedCategory = category;
        break;
      }
    }

    // Extract variables (look for {{variable}} patterns)
    const variableMatches = text.match(/\{\{([^}]+)\}\}/g) || [];
    const variables = [...new Set(variableMatches.map(v => v.replace(/[{}]/g, '')))];

    // Try to extract clauses (sections starting with numbers or "Article/Section/Clause")
    const clausePattern = /(?:^|\n)(?:Article|Section|Clause|\d+\.)\s*([^\n]+)\n([\s\S]*?)(?=(?:^|\n)(?:Article|Section|Clause|\d+\.)|$)/gi;
    const clauses: Array<{ id: string; title: string; content: string }> = [];
    let match;
    let clauseIndex = 0;
    
    while ((match = clausePattern.exec(text)) !== null && clauseIndex < 50) {
      clauses.push({
        id: `imported-clause-${clauseIndex++}`,
        title: match[1].trim(),
        content: match[2].trim().substring(0, 2000),
      });
    }

    const template: Partial<ContractTemplate> = {
      name,
      description,
      category: detectedCategory,
      content: text.substring(0, 50000), // Limit content size
      variables: variables.length > 0 ? variables : undefined,
      clauses: clauses.length > 0 ? clauses : undefined,
      status: 'draft',
      language: 'en-US',
      tags: [detectedCategory.toLowerCase(), 'imported'],
    };

    return {
      success: true,
      template,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Prepare template for cloud sync (SharePoint/OneDrive/Google Drive)
 */
export interface CloudSyncResult {
  success: boolean;
  fileId?: string;
  webUrl?: string;
  error?: string;
}

export async function prepareTemplateForCloudSync(
  template: ContractTemplate,
  format: 'docx' | 'pdf' = 'docx'
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const sanitizedName = template.name.replace(/[^a-zA-Z0-9-_]/g, '_');
  
  if (format === 'pdf') {
    const buffer = await generatePDFDocument(template);
    return {
      buffer,
      filename: `${sanitizedName}.pdf`,
      mimeType: 'application/pdf',
    };
  } else {
    const buffer = await generateWordDocument(template);
    return {
      buffer,
      filename: `${sanitizedName}.docx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
}

/**
 * Get supported import formats
 */
export function getSupportedImportFormats(): string[] {
  return ['.docx', '.doc'];
}

/**
 * Get supported export formats
 */
export function getSupportedExportFormats(): Array<{
  format: string;
  extension: string;
  mimeType: string;
  label: string;
}> {
  return [
    {
      format: 'docx',
      extension: '.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      label: 'Word Document',
    },
    {
      format: 'pdf',
      extension: '.pdf',
      mimeType: 'application/pdf',
      label: 'PDF Document',
    },
    {
      format: 'json',
      extension: '.json',
      mimeType: 'application/json',
      label: 'JSON (Backup)',
    },
  ];
}
