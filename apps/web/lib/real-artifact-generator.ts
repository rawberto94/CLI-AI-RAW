/**
 * Real Artifact Generator
 * 
 * This module provides a standalone artifact generation function that can be used
 * by the legacy worker script when the queue system (Redis) is not available.
 * 
 * It extracts text from the contract file and generates AI-powered artifacts.
 */

import { PrismaClient, ArtifactType } from 'clients-db';
import fs from 'fs/promises';
import path from 'path';
import pino from 'pino';

const logger = pino({ name: 'real-artifact-generator' });

// Artifact types to generate - matching the workers package configuration
// These are organized by priority: core > analysis > advanced
const ARTIFACT_TYPES: ArtifactType[] = [
  // Core artifacts (highest priority)
  'OVERVIEW',
  'CLAUSES', 
  'FINANCIAL',
  // Analysis artifacts
  'RISK',
  'COMPLIANCE',
  'OBLIGATIONS',
  'RENEWAL',
  // Advanced artifacts
  'NEGOTIATION_POINTS',
  'AMENDMENTS',
  'CONTACTS',
  // Additional artifacts for comprehensive analysis
  'PARTIES',
  'TIMELINE',
  'DELIVERABLES',
  'EXECUTIVE_SUMMARY',
];

interface ArtifactData {
  type: ArtifactType;
  content: Record<string, any>;
}

/**
 * Extract text content from a buffer based on file type
 */
async function extractTextFromBuffer(
  fileContent: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();

  // PDF extraction using pdf-parse
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(fileContent);
      logger.info({ pages: data.numpages, chars: data.text.length }, 'PDF parsed successfully');
      return data.text;
    } catch (error) {
      logger.warn({ error }, 'pdf-parse failed, trying alternative method');
      // Fallback: Try extracting text patterns from raw PDF
      const rawText = fileContent.toString('utf8');
      const textMatches = rawText.match(/\(([^)]+)\)/g) || [];
      if (textMatches.length > 50) {
        return textMatches.map(m => m.slice(1, -1)).join(' ');
      }
      throw new Error('Failed to extract text from PDF');
    }
  }

  // Word documents using mammoth
  if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: fileContent });
      logger.info({ chars: result.value.length }, 'DOCX parsed successfully');
      return result.value;
    } catch (error) {
      logger.error({ error }, 'mammoth failed to parse DOCX');
      throw new Error('Failed to extract text from DOCX');
    }
  }

  // Plain text files
  if (['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm'].includes(ext)) {
    return fileContent.toString('utf8');
  }

  // RTF files - basic extraction
  if (ext === '.rtf') {
    const text = fileContent.toString('utf8');
    return text
      .replace(/\\[a-z]+\d*\s?/gi, '')
      .replace(/[{}]/g, '')
      .replace(/\\\\/g, '\\')
      .trim();
  }

  // Image files - return placeholder (would need OCR)
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
    return '[Image file - text extraction requires OCR processing]';
  }

  // Unknown format - try as text
  logger.warn({ ext, mimeType }, 'Unknown file format, attempting text extraction');
  const textContent = fileContent.toString('utf8');
  const printableRatio = textContent.replace(/[^\x20-\x7E\n\r\t]/g, '').length / textContent.length;
  if (printableRatio > 0.8) {
    return textContent;
  }

  throw new Error(`Unsupported file format: ${ext}`);
}

/**
 * Extract text content from a file based on its type
 */
async function extractTextFromFile(
  filePath: string,
  mimeType: string
): Promise<string> {
  const fileContent = await fs.readFile(filePath);
  return extractTextFromBuffer(fileContent, filePath, mimeType);
}

/**
 * Try to parse a date string into ISO format (YYYY-MM-DD)
 */
function tryParseDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // ignore
  }
  return dateStr;
}

/**
 * Extract key metadata from contract text
 */
async function extractContractMetadata(
  contractText: string,
  contractId: string
): Promise<{
  title?: string;
  contractType?: string;
  startDate?: string;
  endDate?: string;
  totalValue?: number;
  currency?: string;
  parties?: string[];
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // Basic regex-based extraction as fallback
  const basicMetadata: {
    title?: string;
    contractType?: string;
    startDate?: string;
    endDate?: string;
    totalValue?: number;
    currency?: string;
    parties?: string[];
  } = {};

  // Try to extract title
  const titlePatterns = [
    /^[\s\n]*(.+?(?:AGREEMENT|CONTRACT|STATEMENT OF WORK|SOW|NDA|AMENDMENT|ADDENDUM|MOU|MEMORANDUM))/im,
    /(?:title|re|subject|regarding)[:\s]+(.+?)(?:\n|$)/i,
  ];
  for (const pattern of titlePatterns) {
    const match = contractText.match(pattern);
    if (match) {
      basicMetadata.title = match[1].trim().replace(/\s+/g, ' ');
      break;
    }
  }

  // Try to extract contract type
  const typePatterns: Array<[RegExp, string]> = [
    [/statement\s+of\s+work|SOW/i, 'SOW'],
    [/master\s+service\s+agreement|MSA/i, 'MSA'],
    [/non[- ]?disclosure\s+agreement|NDA|confidentiality/i, 'NDA'],
    [/employment\s+(?:agreement|contract)/i, 'EMPLOYMENT'],
    [/service\s+(?:agreement|contract)/i, 'SERVICE'],
    [/lease\s+(?:agreement|contract)/i, 'LEASE'],
    [/purchase\s+(?:order|agreement)/i, 'PURCHASE_ORDER'],
    [/software\s+license/i, 'SOFTWARE_LICENSE'],
    [/subscription\s+agreement/i, 'SUBSCRIPTION'],
    [/amendment/i, 'AMENDMENT'],
  ];
  for (const [pattern, cType] of typePatterns) {
    if (pattern.test(contractText)) {
      basicMetadata.contractType = cType;
      break;
    }
  }

  // Try to extract dates - multiple formats
  const monthNames = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';

  // Effective/Start date patterns  
  const startDatePatterns = [
    new RegExp(`effective\\s*date[:\\s]*(?:is\\s+)?(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
    new RegExp(`effective\\s*(?:date)?[:\\s]*(\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})`, 'i'),
    new RegExp(`(?:commencing|starting|begins?)\\s*(?:on)?[:\\s]*(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
    new RegExp(`(?:commencing|starting|begins?)\\s*(?:on)?[:\\s]*(\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})`, 'i'),
    new RegExp(`start\\s*date[:\\s]*(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
    new RegExp(`start\\s*date[:\\s]*(\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})`, 'i'),
  ];
  for (const pattern of startDatePatterns) {
    const match = contractText.match(pattern);
    if (match) {
      basicMetadata.startDate = tryParseDate(match[1]);
      break;
    }
  }

  // Expiration/End date patterns
  const endDatePatterns = [
    new RegExp(`expir(?:ation|y|es?)\\s*date[:\\s]*(?:is\\s+)?(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
    new RegExp(`expir(?:ation|y|es?)\\s*date[:\\s]*(\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})`, 'i'),
    new RegExp(`(?:terminat(?:ion|es?)|end)\\s*date[:\\s]*(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
    new RegExp(`(?:terminat(?:ion|es?)|end)\\s*date[:\\s]*(\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})`, 'i'),
    new RegExp(`through\\s+(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
  ];
  for (const pattern of endDatePatterns) {
    const match = contractText.match(pattern);
    if (match) {
      basicMetadata.endDate = tryParseDate(match[1]);
      break;
    }
  }

  // Try to extract monetary values
  const moneyPatterns = [
    /(?:total\s+(?:contract\s+)?value|contract\s+(?:value|amount|price))[:\s]*\$\s*([\d,]+(?:\.\d{2})?)\s*(?:USD)?/i,
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:USD|dollars?)?/i,
  ];
  for (const pattern of moneyPatterns) {
    const moneyMatch = contractText.match(pattern);
    if (moneyMatch) {
      basicMetadata.totalValue = parseFloat(moneyMatch[1].replace(/,/g, ''));
      basicMetadata.currency = 'USD';
      break;
    }
  }
  // Also check for other currencies
  if (!basicMetadata.totalValue) {
    const eurMatch = contractText.match(/€\s*([\d,.]+)/);
    if (eurMatch) {
      basicMetadata.totalValue = parseFloat(eurMatch[1].replace(/,/g, ''));
      basicMetadata.currency = 'EUR';
    }
    const gbpMatch = contractText.match(/£\s*([\d,.]+)/);
    if (gbpMatch) {
      basicMetadata.totalValue = parseFloat(gbpMatch[1].replace(/,/g, ''));
      basicMetadata.currency = 'GBP';
    }
  }

  // Try to extract party names
  const partyPatterns = [
    /(?:client|customer|buyer|purchaser)[:\s]+([A-Z][A-Za-z\s&.,]+(?:Inc\.?|LLC|Ltd\.?|Corp(?:oration)?\.?|Co\.?|LP|LLP|PLC|GmbH|AG|SA|SAS|BV|NV)?)/gm,
    /(?:service\s+provider|vendor|supplier|contractor|seller)[:\s]+([A-Z][A-Za-z\s&.,]+(?:Inc\.?|LLC|Ltd\.?|Corp(?:oration)?\.?|Co\.?|LP|LLP|PLC|GmbH|AG|SA|SAS|BV|NV)?)/gm,
    /(?:between|by\s+and\s+between)\s+([A-Z][A-Za-z\s&.,]+(?:Inc\.?|LLC|Ltd\.?|Corp(?:oration)?\.?|Co\.?))\s+(?:and|,)\s+([A-Z][A-Za-z\s&.,]+(?:Inc\.?|LLC|Ltd\.?|Corp(?:oration)?\.?|Co\.?))/i,
  ];
  const extractedParties: string[] = [];
  for (const pattern of partyPatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(contractText)) !== null) {
      const partyName = match[1]?.trim().replace(/\s+/g, ' ');
      if (partyName && partyName.length > 2 && partyName.length < 100 && !extractedParties.includes(partyName)) {
        extractedParties.push(partyName);
      }
      if (match[2]) {
        const party2 = match[2].trim().replace(/\s+/g, ' ');
        if (party2 && party2.length > 2 && party2.length < 100 && !extractedParties.includes(party2)) {
          extractedParties.push(party2);
        }
      }
    }
  }
  if (extractedParties.length > 0) {
    basicMetadata.parties = extractedParties.slice(0, 10);
  }

  // Try AI extraction if available
  if (apiKey) {
    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey });

      const truncatedText = contractText.substring(0, 50000); // First 50k chars for metadata

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a contract metadata extractor. Extract key metadata and return valid JSON only.',
          },
          {
            role: 'user',
            content: `Extract the following metadata from this contract:
- title: Contract title or name
- contractType: Type (e.g., SERVICE, NDA, EMPLOYMENT, LEASE, MSA, SOW, etc.)
- startDate: Effective/start date (ISO format YYYY-MM-DD or null)
- endDate: Expiration/end date (ISO format YYYY-MM-DD or null)  
- totalValue: Total contract value as number (or null)
- currency: Currency code (e.g., USD, EUR, GBP)
- parties: Array of party names (companies/individuals)

Return ONLY valid JSON.

Contract text:
${truncatedText}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          title: parsed.title || basicMetadata.title,
          contractType: parsed.contractType || basicMetadata.contractType,
          startDate: parsed.startDate || basicMetadata.startDate,
          endDate: parsed.endDate || basicMetadata.endDate,
          totalValue: parsed.totalValue ?? basicMetadata.totalValue,
          currency: parsed.currency || basicMetadata.currency,
          parties: parsed.parties || basicMetadata.parties,
        };
      }
    } catch (aiError) {
      logger.warn({ aiError, contractId }, 'AI metadata extraction failed, using basic extraction');
    }
  }

  return basicMetadata;
}

/**
 * Extract basic structured fields from contract text using regex patterns
 * Used by generateBasicArtifact to populate artifacts with real data from the document
 */
function extractBasicFieldsFromText(contractText: string): {
  title: string | null;
  contractType: string | null;
  summary: string | null;
  totalValue: number | null;
  currency: string | null;
  startDate: string | null;
  endDate: string | null;
  clientName: string | null;
  supplierName: string | null;
  parties: Array<{ name: string; role: string }>;
  keyPoints: string[];
  paymentTerms: string | null;
} {
  const result = {
    title: null as string | null,
    contractType: null as string | null,
    summary: null as string | null,
    totalValue: null as number | null,
    currency: null as string | null,
    startDate: null as string | null,
    endDate: null as string | null,
    clientName: null as string | null,
    supplierName: null as string | null,
    parties: [] as Array<{ name: string; role: string }>,
    keyPoints: [] as string[],
    paymentTerms: null as string | null,
  };

  if (!contractText || contractText.length < 10) return result;

  const monthNames = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';

  // --- Title ---
  const titlePatterns = [
    /^[\s\n]*((?:STATEMENT\s+OF\s+WORK|MASTER\s+SERVICE\s+AGREEMENT|NON[- ]?DISCLOSURE\s+AGREEMENT|SERVICE\s+AGREEMENT|EMPLOYMENT\s+(?:AGREEMENT|CONTRACT)|LEASE\s+AGREEMENT|SOFTWARE\s+LICENSE\s+AGREEMENT|SUBSCRIPTION\s+AGREEMENT|PURCHASE\s+(?:ORDER|AGREEMENT)|AMENDMENT)[^\n]*)/im,
    /(?:^|\n)\s*(?:title|re|subject)[:\s]+([^\n]+)/im,
  ];
  for (const pattern of titlePatterns) {
    const match = contractText.match(pattern);
    if (match) {
      result.title = match[1].trim().replace(/\s+/g, ' ');
      break;
    }
  }

  // --- Contract Type ---
  const typePatterns: Array<[RegExp, string]> = [
    [/statement\s+of\s+work|SOW/i, 'SOW'],
    [/master\s+service\s+agreement|MSA/i, 'MSA'],
    [/non[- ]?disclosure\s+agreement|NDA|confidentiality\s+agreement/i, 'NDA'],
    [/employment\s+(?:agreement|contract)/i, 'EMPLOYMENT'],
    [/professional\s+services?\s+agreement/i, 'SERVICE'],
    [/service\s+(?:agreement|contract)/i, 'SERVICE'],
    [/lease\s+(?:agreement|contract)/i, 'LEASE'],
    [/purchase\s+(?:order|agreement)/i, 'PURCHASE_ORDER'],
    [/software\s+license/i, 'SOFTWARE_LICENSE'],
    [/subscription\s+agreement/i, 'SUBSCRIPTION'],
    [/amendment/i, 'AMENDMENT'],
  ];
  for (const [pattern, cType] of typePatterns) {
    if (pattern.test(contractText)) {
      result.contractType = cType;
      break;
    }
  }

  // --- Dates ---
  const startDatePatterns = [
    new RegExp(`effective\\s*date[:\\s]*(?:is\\s+)?(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
    new RegExp(`effective\\s*(?:date)?[:\\s]*(\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})`, 'i'),
    new RegExp(`start\\s*date[:\\s]*(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
    new RegExp(`(?:commencing|starting|begins?)\\s*(?:on)?[:\\s]*(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
  ];
  for (const pattern of startDatePatterns) {
    const match = contractText.match(pattern);
    if (match) {
      result.startDate = tryParseDate(match[1]);
      break;
    }
  }

  const endDatePatterns = [
    new RegExp(`expir(?:ation|y|es?)\\s*date[:\\s]*(?:is\\s+)?(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
    new RegExp(`expir(?:ation|y|es?)\\s*date[:\\s]*(\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4})`, 'i'),
    new RegExp(`(?:terminat(?:ion|es?)|end)\\s*date[:\\s]*(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
    new RegExp(`through\\s+(${monthNames}\\s+\\d{1,2},?\\s+\\d{4})`, 'i'),
  ];
  for (const pattern of endDatePatterns) {
    const match = contractText.match(pattern);
    if (match) {
      result.endDate = tryParseDate(match[1]);
      break;
    }
  }

  // --- Total Value ---
  const moneyPatterns = [
    /(?:total\s+(?:contract\s+)?value|contract\s+(?:value|amount|price))[:\s]*\$\s*([\d,]+(?:\.\d{2})?)/i,
    /\$\s*([\d,]+(?:\.\d{2})?)\s*(?:USD)?/i,
  ];
  for (const pattern of moneyPatterns) {
    const match = contractText.match(pattern);
    if (match) {
      result.totalValue = parseFloat(match[1].replace(/,/g, ''));
      result.currency = 'USD';
      break;
    }
  }

  // --- Parties ---
  // Client/Buyer
  const clientPatterns = [
    /(?:client|customer|buyer|purchaser)[:\s]+([A-Z][A-Za-z\s&.,]+?\b(?:Inc\.?|LLC|Ltd\.?|Corp(?:oration)?\.?|Co\.?|LP|LLP|PLC|GmbH|AG|SA|SAS|BV|NV))/m,
  ];
  for (const pattern of clientPatterns) {
    const match = contractText.match(pattern);
    if (match) {
      result.clientName = match[1].trim();
      result.parties.push({ name: result.clientName, role: 'Client' });
      break;
    }
  }

  // Supplier/Vendor/Service Provider
  const supplierPatterns = [
    /(?:service\s+provider|vendor|supplier|contractor|seller)[:\s]+([A-Z][A-Za-z\s&.,]+?\b(?:Inc\.?|LLC|Ltd\.?|Corp(?:oration)?\.?|Co\.?|LP|LLP|PLC|GmbH|AG|SA|SAS|BV|NV))/m,
  ];
  for (const pattern of supplierPatterns) {
    const match = contractText.match(pattern);
    if (match) {
      result.supplierName = match[1].trim();
      result.parties.push({ name: result.supplierName, role: 'Service Provider' });
      break;
    }
  }

  // --- Payment Terms ---
  const paymentMatch = contractText.match(/(?:payment\s+(?:terms?|schedule|conditions?))[:\s]+([^\n]{10,200})/i);
  if (paymentMatch) {
    result.paymentTerms = paymentMatch[1].trim();
  }

  // --- Build summary as prose ---
  if (result.clientName && result.supplierName && result.totalValue && result.title) {
    const typeLabel = result.contractType ? ` (${result.contractType})` : '';
    const periodStr = result.startDate && result.endDate ? `, effective from ${result.startDate} through ${result.endDate}` : '';
    result.summary = `This ${result.title}${typeLabel} establishes an agreement between ${result.clientName} (Client) and ${result.supplierName} (Service Provider) with a total contract value of ${result.currency === 'USD' ? '$' : result.currency || ''}${result.totalValue.toLocaleString()} ${result.currency || 'USD'}${periodStr}.`;
  } else {
    const summaryParts: string[] = [];
    if (result.title) summaryParts.push(result.title);
    if (result.contractType) summaryParts.push(`Type: ${result.contractType}`);
    if (result.clientName && result.supplierName) {
      summaryParts.push(`Between ${result.clientName} and ${result.supplierName}`);
    }
    if (result.totalValue) {
      summaryParts.push(`Value: ${result.currency === 'USD' ? '$' : result.currency || ''}${result.totalValue.toLocaleString()}`);
    }
    if (result.startDate && result.endDate) {
      summaryParts.push(`Period: ${result.startDate} to ${result.endDate}`);
    }
    if (summaryParts.length > 0) {
      result.summary = summaryParts.join('. ') + '.';
    }
  }

  // --- Key Points ---
  if (result.clientName) result.keyPoints.push(`Client: ${result.clientName}`);
  if (result.supplierName) result.keyPoints.push(`Service Provider: ${result.supplierName}`);
  if (result.totalValue) result.keyPoints.push(`Total Value: ${result.currency === 'USD' ? '$' : ''}${result.totalValue.toLocaleString()} ${result.currency || ''}`);
  if (result.startDate) result.keyPoints.push(`Effective: ${result.startDate}`);
  if (result.endDate) result.keyPoints.push(`Expires: ${result.endDate}`);

  return result;
}

/**
 * Generate basic artifact data without AI (fallback mode)
 * Now performs regex-based extraction from the document text
 */
function generateBasicArtifact(type: ArtifactType, contractText: string, contractId: string): Record<string, any> {
  const now = new Date().toISOString();
  const textPreview = contractText.substring(0, 500);
  const wordCount = contractText.split(/\s+/).length;
  
  const baseData = {
    _generated: now,
    _mode: 'basic',
    _contractId: contractId,
    _wordCount: wordCount,
  };

  // Extract basic metadata from text for enriching artifacts
  const basicExtracted = extractBasicFieldsFromText(contractText);

  switch (type) {
    case 'OVERVIEW':
      return {
        ...baseData,
        summary: basicExtracted.summary || `Contract document with ${wordCount} words. Detailed AI analysis pending.`,
        contractType: basicExtracted.contractType || null,
        title: basicExtracted.title || null,
        totalValue: basicExtracted.totalValue || null,
        currency: basicExtracted.currency || null,
        effectiveDate: basicExtracted.startDate || null,
        startDate: basicExtracted.startDate || null,
        expirationDate: basicExtracted.endDate || null,
        endDate: basicExtracted.endDate || null,
        parties: basicExtracted.parties.length > 0 ? basicExtracted.parties : [],
        clientName: basicExtracted.clientName || null,
        supplierName: basicExtracted.supplierName || null,
        keyPoints: basicExtracted.keyPoints.length > 0 ? basicExtracted.keyPoints : ['Document uploaded and processed', 'Full analysis requires AI processing'],
        documentInfo: {
          estimatedPages: Math.ceil(wordCount / 250),
          hasText: contractText.length > 0,
          preview: textPreview,
        },
      };

    case 'CLAUSES':
      return {
        ...baseData,
        clauses: [],
        totalClauses: 0,
        note: 'Clause extraction requires AI analysis',
      };

    case 'FINANCIAL':
      return {
        ...baseData,
        amounts: basicExtracted.totalValue ? [{ amount: basicExtracted.totalValue, currency: basicExtracted.currency || 'USD', description: 'Total Contract Value' }] : [],
        currency: basicExtracted.currency || null,
        totalValue: basicExtracted.totalValue || null,
        paymentTerms: basicExtracted.paymentTerms || null,
        note: basicExtracted.totalValue ? undefined : 'Financial extraction requires AI analysis',
      };

    case 'RISK':
      return {
        ...baseData,
        riskLevel: 'UNKNOWN',
        risks: [],
        note: 'Risk analysis requires AI processing',
      };

    case 'COMPLIANCE':
      return {
        ...baseData,
        complianceStatus: 'PENDING_REVIEW',
        requirements: [],
        note: 'Compliance analysis requires AI processing',
      };

    case 'OBLIGATIONS':
      return {
        ...baseData,
        obligations: [],
        partyObligations: {},
        note: 'Obligation extraction requires AI analysis',
      };

    case 'RENEWAL':
      return {
        ...baseData,
        renewalTerms: null,
        autoRenewal: null,
        noticePeriod: null,
        note: 'Renewal analysis requires AI processing',
      };

    case 'NEGOTIATION_POINTS':
      return {
        ...baseData,
        negotiationPoints: [],
        priorityAreas: [],
        note: 'Negotiation points analysis requires AI processing',
      };

    case 'AMENDMENTS':
      return {
        ...baseData,
        amendments: [],
        hasAmendments: false,
        note: 'Amendments analysis requires AI processing',
      };

    case 'CONTACTS':
      return {
        ...baseData,
        contacts: [],
        primaryContact: null,
        note: 'Contact extraction requires AI processing',
      };

    case 'PARTIES':
      return {
        ...baseData,
        parties: basicExtracted.parties.length > 0 ? basicExtracted.parties : [],
        partyRoles: basicExtracted.clientName || basicExtracted.supplierName ? {
          ...(basicExtracted.clientName ? { client: basicExtracted.clientName } : {}),
          ...(basicExtracted.supplierName ? { supplier: basicExtracted.supplierName } : {}),
        } : {},
        note: basicExtracted.parties.length > 0 ? undefined : 'Party extraction requires AI processing',
      };

    case 'TIMELINE':
      return {
        ...baseData,
        milestones: [],
        keyDates: [],
        duration: null,
        note: 'Timeline extraction requires AI processing',
      };

    case 'DELIVERABLES':
      return {
        ...baseData,
        deliverables: [],
        deliverySchedule: null,
        note: 'Deliverables extraction requires AI processing',
      };

    case 'EXECUTIVE_SUMMARY':
      return {
        ...baseData,
        executiveSummary: basicExtracted.summary || `Contract document with ${wordCount} words uploaded for review.`,
        keyTakeaways: basicExtracted.keyPoints.length > 0 ? basicExtracted.keyPoints : [],
        recommendations: [],
        note: basicExtracted.summary ? undefined : 'Executive summary requires AI processing',
      };

    default:
      return {
        ...baseData,
        note: `${type} artifact - analysis pending`,
      };
  }
}

/**
 * Try to generate an artifact using OpenAI
 */
async function generateAIArtifact(
  type: ArtifactType,
  contractText: string,
  contractId: string,
  contractType?: string
): Promise<Record<string, any> | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    logger.warn('No OPENAI_API_KEY found, using basic artifact generation');
    return null;
  }

  try {
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });

    // Truncate text if too long (approximately 100k tokens ~ 400k chars)
    const maxChars = 100000;
    const truncatedText = contractText.length > maxChars 
      ? contractText.substring(0, maxChars) + '\n\n[... text truncated for analysis ...]'
      : contractText;

    const prompts: Record<string, string> = {
      OVERVIEW: `Analyze this contract and provide a JSON response with:
        - summary: A brief summary (2-3 sentences)
        - keyPoints: Array of key points (max 5)
        - parties: Array of party names mentioned
        - effectiveDate: Date if found (ISO format or null)
        - contractType: Type of contract if identifiable`,
      
      CLAUSES: `Extract the main clauses from this contract. Return JSON with:
        - clauses: Array of objects with {title, content, type, importance}
        - totalClauses: Number of clauses found`,
      
      FINANCIAL: `Extract financial information from this contract. Return JSON with:
        - amounts: Array of {value, currency, description}
        - totalValue: Total contract value if stated
        - currency: Primary currency
        - paymentTerms: Payment terms if specified`,
      
      RISK: `Analyze risks in this contract. Return JSON with:
        - riskLevel: 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'
        - risks: Array of {category, description, severity, mitigation}`,
      
      COMPLIANCE: `Analyze compliance aspects of this contract. Return JSON with:
        - complianceStatus: 'COMPLIANT', 'NEEDS_REVIEW', or 'NON_COMPLIANT'
        - requirements: Array of compliance requirements found
        - standards: Any standards or regulations referenced`,
      
      OBLIGATIONS: `Extract obligations from this contract. Return JSON with:
        - obligations: Array of {party, obligation, deadline, type}
        - partyObligations: Object mapping party names to their obligations`,
      
      RENEWAL: `Extract renewal information from this contract. Return JSON with:
        - renewalTerms: Description of renewal terms
        - autoRenewal: Boolean if auto-renewal exists
        - noticePeriod: Notice period for renewal/termination
        - expirationDate: Contract expiration date if found`,

      NEGOTIATION_POINTS: `Identify potential negotiation points in this contract. Return JSON with:
        - negotiationPoints: Array of {area, currentTerm, suggestedChange, priority, rationale}
        - priorityAreas: Array of top 3 areas to focus on
        - overallLeverage: 'STRONG', 'MODERATE', or 'WEAK'`,

      AMENDMENTS: `Identify any amendments or modifications in this contract. Return JSON with:
        - amendments: Array of {date, description, section, impact}
        - hasAmendments: Boolean
        - originalVersion: Reference to original if found`,

      CONTACTS: `Extract contact information from this contract. Return JSON with:
        - contacts: Array of {name, role, organization, email, phone, address}
        - primaryContact: The main contact for each party
        - notificationAddresses: Where formal notices should be sent`,

      PARTIES: `Extract all parties mentioned in this contract. Return JSON with:
        - parties: Array of {name, role, type, jurisdiction, signatoryName}
        - relationships: Description of party relationships
        - partyRoles: Object mapping party names to their contractual roles`,

      TIMELINE: `Extract timeline information from this contract. Return JSON with:
        - effectiveDate: When contract begins
        - endDate: When contract ends
        - milestones: Array of {date, event, description}
        - keyDates: Array of important dates
        - duration: Total contract duration`,

      DELIVERABLES: `Extract deliverables from this contract. Return JSON with:
        - deliverables: Array of {name, description, party, deadline, acceptanceCriteria}
        - deliverySchedule: Timeline of deliverables
        - acceptanceProcess: How deliverables are accepted`,

      EXECUTIVE_SUMMARY: `Provide an executive summary of this contract. Return JSON with:
        - executiveSummary: 3-5 paragraph summary for executives
        - keyTakeaways: Array of critical points (max 5)
        - recommendations: Array of suggested actions
        - riskHighlights: Top risks to be aware of
        - valueProposition: Main value of this contract`,

      // Additional artifact types
      METADATA: `Extract metadata about this contract document. Return JSON with:
        - documentType: Type of contract
        - language: Primary language
        - jurisdiction: Governing law jurisdiction
        - confidentialityLevel: Public, Confidential, etc.
        - version: Document version if found`,
      
      SUMMARY: `Provide a comprehensive summary of this contract. Return JSON with:
        - summary: Detailed summary (5-10 sentences)
        - purpose: Main purpose of the contract
        - scope: What the contract covers`,
    };

    const prompt = prompts[type] || `Analyze the ${type} aspects of this contract and return relevant information as JSON.`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a contract analysis expert. Always respond with valid JSON only, no markdown or explanation.${contractType && contractType !== 'OTHER' ? `\nThis document is a ${contractType.replace(/_/g, ' ')}. Focus your analysis on elements typical of this contract type.` : ''}`,
        },
        {
          role: 'user',
          content: `${prompt}\n\nContract text:\n${truncatedText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content);
    return {
      ...parsed,
      _generated: new Date().toISOString(),
      _mode: 'ai',
      _model: 'gpt-4o-mini',
      _contractId: contractId,
    };
  } catch (error) {
    logger.error({ error, type, contractId }, 'AI artifact generation failed');
    return null;
  }
}

/**
 * Create or update an artifact in the database
 */
async function saveArtifact(
  prisma: PrismaClient,
  contractId: string,
  tenantId: string,
  type: ArtifactType,
  data: Record<string, any>
): Promise<string> {
  const now = new Date();
  
  // Try to upsert the artifact
  const artifact = await prisma.artifact.upsert({
    where: {
      contractId_type: {
        contractId,
        type,
      },
    },
    create: {
      contractId,
      tenantId,
      type,
      data,
      validationStatus: data._mode === 'ai' ? 'valid' : 'needs_review',
      createdAt: now,
      updatedAt: now,
    },
    update: {
      data,
      validationStatus: data._mode === 'ai' ? 'valid' : 'needs_review',
      updatedAt: now,
    },
  });

  return artifact.id;
}

/**
 * Main artifact generation function
 * Called by the legacy worker script
 */
export async function generateRealArtifacts(
  contractId: string,
  tenantId: string,
  filePath: string,
  mimeType: string,
  prisma: PrismaClient
): Promise<{ success: boolean; artifactsCreated: number; errors?: string[] }> {
  const errors: string[] = [];
  const artifactIds: string[] = [];

  logger.info({ contractId, tenantId, filePath }, 'Starting artifact generation');

  try {
    // Update contract status to PROCESSING
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: 'PROCESSING' },
    });

    // Update processing job if exists
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        status: 'RUNNING',
        currentStep: 'extracting_text',
        progress: 10,
        startedAt: new Date(),
      },
    });

    // Determine actual file path
    let actualPath = filePath;
    let fileContent: Buffer | null = null;
    
    // Check if it's a relative path from storage (S3/MinIO path)
    if (!filePath.startsWith('/')) {
      // Try local uploads directory first
      const localPath = path.join(process.cwd(), 'uploads', filePath);
      const webLocalPath = path.join(process.cwd(), 'apps', 'web', 'uploads', filePath);
      const rootLocalPath = path.join(process.cwd(), '..', '..', 'uploads', filePath);
      
      if (await fs.access(localPath).then(() => true).catch(() => false)) {
        actualPath = localPath;
        logger.info({ actualPath }, 'Found file in local uploads');
      } else if (await fs.access(webLocalPath).then(() => true).catch(() => false)) {
        actualPath = webLocalPath;
        logger.info({ actualPath }, 'Found file in web uploads');
      } else if (await fs.access(rootLocalPath).then(() => true).catch(() => false)) {
        actualPath = rootLocalPath;
        logger.info({ actualPath }, 'Found file in root uploads');
      } else {
        // File is in S3/MinIO - try to download it
        logger.info({ filePath }, 'File appears to be in S3/MinIO, attempting download');
        
        try {
          // Try to use the S3 client to download
          const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
          
          // Build the endpoint URL from components
          let endpoint = process.env.S3_ENDPOINT;
          if (!endpoint) {
            const minioHost = process.env.MINIO_ENDPOINT || 'localhost';
            const minioPort = process.env.MINIO_PORT || '9000';
            const useSSL = process.env.MINIO_USE_SSL === 'true';
            const protocol = useSSL ? 'https' : 'http';
            endpoint = `${protocol}://${minioHost}:${minioPort}`;
          }
          
          logger.info({ endpoint }, 'Using S3 endpoint');
          
          const isProduction = process.env.NODE_ENV === 'production';
          const accessKeyId = process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
          const secretAccessKey = process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
          
          // In production, require explicit credentials
          if (isProduction && (!accessKeyId || !secretAccessKey)) {
            throw new Error('S3/MinIO credentials required in production');
          }
          
          const s3Client = new S3Client({
            endpoint,
            region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1',
            credentials: {
              accessKeyId: accessKeyId || (isProduction ? '' : 'minioadmin'),
              secretAccessKey: secretAccessKey || (isProduction ? '' : 'minioadmin'),
            },
            forcePathStyle: true, // Required for MinIO
          });
          
          const bucket = process.env.S3_BUCKET || process.env.MINIO_BUCKET || 'contracts';
          
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: filePath,
          });
          
          const response = await s3Client.send(command);
          
          if (response.Body) {
            const chunks: Buffer[] = [];
            // @ts-expect-error - Body is a Readable stream
            for await (const chunk of response.Body) {
              chunks.push(Buffer.from(chunk));
            }
            fileContent = Buffer.concat(chunks);
            logger.info({ filePath, size: fileContent.length }, 'Downloaded file from S3/MinIO');
          } else {
            throw new Error('No body in S3 response');
          }
        } catch (s3Error) {
          logger.error({ s3Error, filePath }, 'Failed to download from S3/MinIO');
          
          // Last resort - check contract record for storage path
          const contract = await prisma.contract.findUnique({
            where: { id: contractId },
            select: { storagePath: true, storageProvider: true },
          });
          
          if (contract?.storageProvider === 'local' && contract.storagePath) {
            actualPath = contract.storagePath;
            logger.info({ actualPath }, 'Using storage path from contract record');
          } else {
            throw new Error(`Cannot access file: ${filePath}. S3 download failed and no local fallback available.`);
          }
        }
      }
    }

    // Extract text from the file
    logger.info({ actualPath, mimeType, hasBuffer: !!fileContent }, 'Extracting text from file');
    const contractText = fileContent 
      ? await extractTextFromBuffer(fileContent, filePath, mimeType)
      : await extractTextFromFile(actualPath, mimeType);
    
    if (!contractText || contractText.length < 10) {
      throw new Error('Failed to extract meaningful text from file');
    }

    logger.info({ textLength: contractText.length }, 'Text extracted successfully');

    // Update progress
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        currentStep: 'generating_artifacts',
        progress: 30,
      },
    });

    // Generate each artifact type
    const totalTypes = ARTIFACT_TYPES.length;
    let completed = 0;

    // Query contract type for type-aware prompt enhancement
    const contractRecord = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { contractType: true },
    });
    const contractType = contractRecord?.contractType || 'OTHER';

    for (const type of ARTIFACT_TYPES) {
      try {
        logger.info({ contractId, type }, `Generating ${type} artifact`);
        
        // Try AI generation first, fall back to basic
        let artifactData = await generateAIArtifact(type, contractText, contractId, contractType);
        
        if (!artifactData) {
          logger.info({ type }, 'Using basic artifact generation (no AI)');
          artifactData = generateBasicArtifact(type, contractText, contractId);
        }

        // Save the artifact
        const artifactId = await saveArtifact(prisma, contractId, tenantId, type, artifactData);
        artifactIds.push(artifactId);
        
        logger.info({ contractId, type, artifactId }, `${type} artifact saved`);
        
        completed++;
        const progress = 30 + Math.floor((completed / totalTypes) * 60);
        
        await prisma.processingJob.updateMany({
          where: { contractId, tenantId },
          data: { 
            currentStep: `artifact_${type.toLowerCase()}`,
            progress,
          },
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMsg, type, contractId }, `Failed to generate ${type} artifact`);
        errors.push(`${type}: ${errorMsg}`);
      }
    }

    // Extract and store basic metadata from the contract text
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        currentStep: 'extracting_metadata',
        progress: 92,
      },
    });

    try {
      logger.info({ contractId }, 'Extracting contract metadata');
      const metadata = await extractContractMetadata(contractText, contractId);
      
      // Update contract with extracted metadata
      const updateData: Record<string, any> = {};
      
      if (metadata.title) updateData.contractTitle = metadata.title;
      if (metadata.contractType) updateData.contractType = metadata.contractType;
      if (metadata.startDate) updateData.startDate = new Date(metadata.startDate);
      if (metadata.endDate) updateData.endDate = new Date(metadata.endDate);
      if (metadata.totalValue) updateData.totalValue = metadata.totalValue;
      if (metadata.currency) updateData.currency = metadata.currency;
      if (metadata.parties?.length > 0) {
        // Extract first party as client, second as supplier
        if (metadata.parties[0]) updateData.clientName = metadata.parties[0];
        if (metadata.parties[1]) updateData.supplierName = metadata.parties[1];
      }
      
      if (Object.keys(updateData).length > 0) {
        await prisma.contract.update({
          where: { id: contractId },
          data: updateData,
        });
        logger.info({ contractId, fieldsUpdated: Object.keys(updateData) }, 'Contract metadata updated');
      }
    } catch (metadataError) {
      const metadataErrorMsg = metadataError instanceof Error ? metadataError.message : String(metadataError);
      logger.warn({ error: metadataErrorMsg, contractId }, 'Failed to extract metadata (non-fatal)');
      // Don't fail the whole process for metadata extraction errors
    }

    // Determine final status
    const finalStatus = artifactIds.length > 0 ? 'COMPLETED' : 'FAILED';

    // Update contract status
    await prisma.contract.update({
      where: { id: contractId },
      data: { 
        status: finalStatus,
        updatedAt: new Date(),
      },
    });

    // Update processing job
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        status: finalStatus === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
        currentStep: 'complete',
        progress: 100,
        completedAt: new Date(),
        error: errors.length > 0 ? errors.join('; ') : null,
      },
    });

    logger.info({ 
      contractId, 
      artifactsCreated: artifactIds.length,
      errors: errors.length,
      status: finalStatus,
    }, 'Artifact generation completed');

    return {
      success: artifactIds.length > 0,
      artifactsCreated: artifactIds.length,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMsg, contractId }, 'Artifact generation failed');

    // Update contract status to FAILED
    await prisma.contract.update({
      where: { id: contractId },
      data: { 
        status: 'FAILED',
        updatedAt: new Date(),
      },
    }).catch(() => {});

    // Update processing job
    await prisma.processingJob.updateMany({
      where: { contractId, tenantId },
      data: { 
        status: 'FAILED',
        currentStep: 'failed',
        progress: 100,
        completedAt: new Date(),
        error: errorMsg,
      },
    }).catch(() => {});

    return {
      success: false,
      artifactsCreated: 0,
      errors: [errorMsg],
    };
  }
}
