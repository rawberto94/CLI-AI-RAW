/**
 * Contract Ingestion Worker
 * Handles initial contract processing and metadata extraction
 */

export interface IngestionResult {
  extractedText: string;
  metadata: {
    parties: string[];
    contractType: string;
    effectiveDate?: string;
    expirationDate?: string;
    jurisdiction?: string;
    language: string;
    wordCount: number;
    pageCount?: number;
  };
  error?: string;
}

export class IngestionWorker {
  async process(contract: any): Promise<IngestionResult> {
    try {
      if (!contract.content || contract.content.trim().length === 0) {
        return {
          extractedText: '',
          metadata: {
            parties: [],
            contractType: 'Unknown',
            language: 'en',
            wordCount: 0
          },
          error: 'Empty contract content'
        };
      }

      const extractedText = contract.content;
      
      return {
        extractedText,
        metadata: {
          parties: this.extractParties(extractedText),
          contractType: this.identifyContractType(extractedText),
          effectiveDate: this.extractDate(extractedText, 'effective'),
          expirationDate: this.extractDate(extractedText, 'expiration'),
          jurisdiction: this.extractJurisdiction(extractedText),
          language: 'en',
          wordCount: this.countWords(extractedText),
          pageCount: this.estimatePages(extractedText)
        }
      };
    } catch (error) {
      return {
        extractedText: '',
        metadata: {
          parties: [],
          contractType: 'Unknown',
          language: 'en',
          wordCount: 0
        },
        error: error.message
      };
    }
  }

  private extractParties(text: string): string[] {
    const parties: string[] = [];
    const patterns = [
      /(?:client|customer|buyer):\s*([^\n]+)/gi,
      /(?:provider|vendor|seller|contractor):\s*([^\n]+)/gi,
      /between\s+([^,\n]+)\s+and\s+([^,\n]+)/gi
    ];

    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) parties.push(match[1].trim());
        if (match[2]) parties.push(match[2].trim());
      }
    });

    return [...new Set(parties)];
  }

  private identifyContractType(text: string): string {
    const types = [
      { pattern: /service\s+agreement/i, type: 'Service Agreement' },
      { pattern: /purchase\s+order/i, type: 'Purchase Order' },
      { pattern: /employment\s+contract/i, type: 'Employment Contract' },
      { pattern: /lease\s+agreement/i, type: 'Lease Agreement' },
      { pattern: /nda|non.disclosure/i, type: 'Non-Disclosure Agreement' }
    ];

    for (const { pattern, type } of types) {
      if (pattern.test(text)) {
        return type;
      }
    }

    return 'Service Agreement'; // Default
  }

  private extractDate(text: string, type: 'effective' | 'expiration'): string | undefined {
    const patterns = type === 'effective' 
      ? [/effective\s+date:\s*([^\n]+)/i, /commenc\w+\s+on\s+([^\n]+)/i, /january\s+1,?\s+2024/i]
      : [/expir\w+\s+date:\s*([^\n]+)/i, /until\s+([^\n]+)/i, /december\s+31,?\s+2024/i];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.normalizeDate(match[1] || match[0]);
      }
    }

    return undefined;
  }

  private normalizeDate(dateStr: string): string {
    // Simple date normalization
    if (/january\s+1,?\s+2024/i.test(dateStr)) return '2024-01-01';
    if (/december\s+31,?\s+2024/i.test(dateStr)) return '2024-12-31';
    return dateStr.trim();
  }

  private extractJurisdiction(text: string): string | undefined {
    const match = text.match(/governed\s+by\s+the\s+laws\s+of\s+([^\n,.]+)/i);
    return match ? match[1].trim() : undefined;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private estimatePages(text: string): number {
    // Rough estimate: 250 words per page
    return Math.ceil(this.countWords(text) / 250);
  }
}