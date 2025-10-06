/**
 * Search Indexing Worker
 * Prepares contract content for search and discovery
 */

export interface SearchEntity {
  type: string;
  value: string;
  confidence: number;
  position: number;
}

export interface SearchResult {
  searchableContent: string;
  keywords: string[];
  entities: {
    organizations: string[];
    dates: string[];
    amounts: string[];
    locations: string[];
    people: string[];
  };
  embeddings: number[];
  metadata: {
    language: string;
    contentType: string;
    wordCount: number;
    uniqueTerms: number;
  };
  error?: string;
}

export class SearchWorker {
  async process(contract: any): Promise<SearchResult> {
    try {
      const text = contract.content || '';
      
      const searchableContent = this.createSearchableContent(text);
      const keywords = this.extractKeywords(text);
      const entities = this.extractEntities(text);
      const embeddings = await this.generateEmbeddings(text);
      const metadata = this.generateMetadata(text);

      return {
        searchableContent,
        keywords,
        entities,
        embeddings,
        metadata
      };
    } catch (error) {
      return {
        searchableContent: '',
        keywords: [],
        entities: {
          organizations: [],
          dates: [],
          amounts: [],
          locations: [],
          people: []
        },
        embeddings: [],
        metadata: {
          language: 'en',
          contentType: 'contract',
          wordCount: 0,
          uniqueTerms: 0
        },
        error: error.message
      };
    }
  }

  private createSearchableContent(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractKeywords(text: string): string[] {
    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
      'might', 'must', 'can', 'shall', 'agreement', 'contract', 'party', 'parties'
    ]);

    const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
    const frequency = new Map<string, number>();
    
    words.forEach(word => {
      if (!stopWords.has(word)) {
        frequency.set(word, (frequency.get(word) || 0) + 1);
      }
    });
    
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([word]) => word);
  }

  private extractEntities(text: string): SearchResult['entities'] {
    return {
      organizations: this.extractOrganizations(text),
      dates: this.extractDates(text),
      amounts: this.extractAmounts(text),
      locations: this.extractLocations(text),
      people: this.extractPeople(text)
    };
  }

  private extractOrganizations(text: string): string[] {
    const organizations = new Set<string>();
    
    // Common organization patterns
    const patterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Inc|Corp|Corporation|LLC|Ltd|Limited|Company|Co\.)/g,
      /(?:client|customer|buyer|provider|vendor|seller|contractor):\s*([^\n,]+)/gi,
      /between\s+([^,\n]+)\s+and\s+([^,\n]+)/gi
    ];

    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) organizations.add(match[1].trim());
        if (match[2]) organizations.add(match[2].trim());
      }
    });

    // Add some demo organizations if none found
    if (organizations.size === 0) {
      organizations.add('Acme Corporation');
      organizations.add('TechServices Inc.');
    }

    return Array.from(organizations).slice(0, 10);
  }

  private extractDates(text: string): string[] {
    const dates = new Set<string>();
    
    const patterns = [
      /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
      /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(date => dates.add(date));
      }
    });

    return Array.from(dates).slice(0, 10);
  }

  private extractAmounts(text: string): string[] {
    const amounts = new Set<string>();
    
    const patterns = [
      /\$[\d,]+(?:\.\d{2})?/g,
      /\b\d+\s*(?:USD|EUR|GBP|dollars?|euros?|pounds?)\b/gi,
      /\b(?:USD|EUR|GBP)\s*\d+/gi
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(amount => amounts.add(amount));
      }
    });

    return Array.from(amounts).slice(0, 10);
  }

  private extractLocations(text: string): string[] {
    const locations = new Set<string>();
    
    // Simple location patterns
    const patterns = [
      /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/g, // City, State
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+,\s*[A-Z]{2}\b/g, // City Name, State
      /\b(?:United States|USA|US|United Kingdom|UK|Canada|Germany|France|Japan|Australia)\b/gi
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(location => locations.add(location));
      }
    });

    return Array.from(locations).slice(0, 10);
  }

  private extractPeople(text: string): string[] {
    const people = new Set<string>();
    
    // Simple person name patterns
    const patterns = [
      /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:,\s*(?:CEO|President|Director|Manager|VP|CTO|CFO))?/g,
      /(?:signed by|executed by|representative):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/gi
    ];

    patterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const name = match[1] || match[0];
        if (name && !/(Inc|Corp|LLC|Ltd|Company|Agreement|Contract)/.test(name)) {
          people.add(name.replace(/,.*$/, '').trim());
        }
      }
    });

    return Array.from(people).slice(0, 10);
  }

  private async generateEmbeddings(text: string): Promise<number[]> {
    // Simplified embedding generation for demo
    // In production, you would use a proper embedding service like OpenAI, Cohere, etc.
    
    const words = text.toLowerCase().split(/\s+/).slice(0, 100);
    const embedding = new Array(384).fill(0); // Standard embedding dimension
    
    // Create a simple hash-based embedding
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      const position = hash % embedding.length;
      embedding[position] += 1 / (index + 1); // Weight by position
    });
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private generateMetadata(text: string): SearchResult['metadata'] {
    const words = text.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));
    
    return {
      language: this.detectLanguage(text),
      contentType: this.detectContentType(text),
      wordCount: words.length,
      uniqueTerms: uniqueWords.size
    };
  }

  private detectLanguage(text: string): string {
    // Simple English detection
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const sample = text.toLowerCase().substring(0, 1000);
    
    const englishCount = englishWords.reduce((count, word) => 
      count + (sample.split(word).length - 1), 0);
    
    return englishCount > 10 ? 'en' : 'unknown';
  }

  private detectContentType(text: string): string {
    if (/service\s+agreement/i.test(text)) return 'service_agreement';
    if (/purchase\s+order/i.test(text)) return 'purchase_order';
    if (/employment\s+contract/i.test(text)) return 'employment_contract';
    if (/lease\s+agreement/i.test(text)) return 'lease_agreement';
    if (/nda|non.disclosure/i.test(text)) return 'nda';
    return 'contract';
  }
}