// @ts-nocheck - Mistral SDK types don't expose all properties
/**
 * Mistral OCR Client
 * 
 * Advanced document analysis using Mistral's OCR capabilities.
 * - Extracts text and layout information
 * - Returns structured markdown
 * - Supports image and PDF inputs
 * 
 * Model: mistral-ocr-latest
 */

import { Mistral } from '@mistralai/mistralai';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

export interface MistralOcrResult {
  markdown: string;
  pages: {
    index: number;
    markdown: string;
    images: any[];
  }[];
  usage: {
    pagesProcessed: number;
  };
}

export interface MistralOcrOptions {
  model?: string;
}

/**
 * Initialize Mistral client
 */
function getMistralClient(): Mistral {
  const apiKey = process.env.MISTRAL_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'Mistral API key not found. Set MISTRAL_API_KEY environment variable.'
    );
  }

  return new Mistral({ apiKey });
}

/**
 * Analyze document with Mistral OCR
 */
export async function analyzeDocumentWithMistral(
  filePath: string,
  options: MistralOcrOptions = {}
): Promise<MistralOcrResult> {
  const { model = 'mistral-ocr-latest' } = options;

  const client = getMistralClient();
  
  // 1. Upload file
  const fileContent = await readFile(filePath);
  const fileName = path.basename(filePath);
  
  console.log(`Uploading ${fileName} to Mistral...`);
  
  const uploadResponse = await client.files.upload({
    file: {
      fileName: fileName,
      content: fileContent,
    },
    purpose: 'ocr',
  });

  const fileId = uploadResponse.id;
  console.log(`File uploaded with ID: ${fileId}`);

  // 2. Process with OCR
  console.log(`Processing document with Mistral OCR (${model})...`);
  
  try {
    const ocrResponse = await client.ocr.process({
      model: model,
      document: {
        type: 'file',
        fileId: fileId,
      } as any,
      includeImageBase64: false
    });

    // 3. Format response
    const pages = ocrResponse.pages.map((page: any) => ({
      index: page.index,
      markdown: page.markdown,
      images: page.images || []
    }));

    const fullMarkdown = pages.map(p => p.markdown).join('\n\n');

    return {
      markdown: fullMarkdown,
      pages,
      usage: {
        pagesProcessed: ocrResponse.usage?.pagesProcessed || 0
      }
    };
  } catch (error) {
    console.error('Mistral OCR failed:', error);
    throw error;
  }
}
