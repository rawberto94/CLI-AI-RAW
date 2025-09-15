/**
 * Financial Analysis Worker - Simplified Version
 * Extracts and analyzes financial information from contracts
 */

import { Job } from 'bullmq';
import { OpenAI } from 'openai';

interface FinancialData {
  totalValue?: {
    amount: number;
    currency: string;
    confidence: number;
  };
  paymentTerms?: {
    schedule: string;
    frequency: string;
    dueDate?: string;
  };
  currencies?: string[];
  costs?: any[];
  fees?: any[];
  financialTables?: any[];
  bestPractices?: any;
}

interface FinancialAnalysisRequest {
  documentId: string;
  content: string;
  title?: string;
  tenantId: string;
}

export class FinancialWorker {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY']
    });
  }

  async process(job: Job<FinancialAnalysisRequest>): Promise<FinancialData> {
    const { documentId, content, title, tenantId } = job.data;
    
    try {
      await job.updateProgress(10);
      
      // Extract financial data
      const financialData = await this.extractFinancialData(content, title);
      await job.updateProgress(60);

      // Validate and enhance data
      const validatedData = await this.validateFinancialData(financialData);
      await job.updateProgress(80);

      // Store results (placeholder)
      await this.storeFinancialAnalysis(documentId, tenantId, validatedData);
      await this.createFinancialArtifacts(documentId, tenantId, validatedData);

      await job.updateProgress(100);
      return validatedData;

    } catch (error) {
      console.error('Financial analysis failed:', error);
      throw error;
    }
  }

  private async extractFinancialData(content: string, title?: string): Promise<FinancialData> {
    const prompt = `Analyze this contract for financial information:

Title: ${title || 'Not specified'}
Content: ${content.substring(0, 4000)}...

Extract:
1. Total contract value with currency
2. Payment terms and schedule
3. All currencies mentioned
4. Costs and fees
5. Financial tables or pricing structures

Return JSON format:
{
  "totalValue": {"amount": 100000, "currency": "USD", "confidence": 0.9},
  "paymentTerms": {"schedule": "Monthly", "frequency": "Monthly"},
  "currencies": ["USD"],
  "costs": [],
  "fees": []
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst specializing in contract analysis. Extract financial information accurately.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      console.error('Financial extraction failed:', error);
      return {};
    }
  }

  private async validateFinancialData(data: FinancialData): Promise<FinancialData> {
    // Basic validation and normalization
    if (data.currencies) {
      data.currencies = data.currencies.map(currency => this.normalizeCurrency(currency));
    }
    
    return data;
  }

  private async storeFinancialAnalysis(
    _documentId: string, 
    _tenantId: string, 
    _financialData: FinancialData
  ): Promise<void> {
    // TODO: Implement database storage when clients-db is available
  }

  private async createFinancialArtifacts(
    _documentId: string,
    _tenantId: string,
    _financialData: FinancialData
  ): Promise<void> {
    // TODO: Implement artifact creation when needed
  }

  private normalizeCurrency(currency: string): string {
    const currencyMap: Record<string, string> = {
      'dollar': 'USD',
      'dollars': 'USD',
      '$': 'USD',
      'usd': 'USD',
      'euro': 'EUR',
      'euros': 'EUR',
      '€': 'EUR',
      'eur': 'EUR',
      'pound': 'GBP',
      'pounds': 'GBP',
      '£': 'GBP',
      'gbp': 'GBP'
    };

    const normalized = currency.toLowerCase().trim();
    return currencyMap[normalized] || currency.toUpperCase();
  }
}

export default FinancialWorker;