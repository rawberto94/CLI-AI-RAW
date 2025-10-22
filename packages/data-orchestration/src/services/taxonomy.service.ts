/**
 * Taxonomy Service
 */

export interface TaxonomyTerm {
  id: string;
  name: string;
  category: string;
  parentId?: string;
}

class TaxonomyService {
  private static instance: TaxonomyService;

  private constructor() {}

  public static getInstance(): TaxonomyService {
    if (!TaxonomyService.instance) {
      TaxonomyService.instance = new TaxonomyService();
    }
    return TaxonomyService.instance;
  }

  async getTerms(category?: string): Promise<TaxonomyTerm[]> {
    return [];
  }

  async createTerm(term: Omit<TaxonomyTerm, 'id'>): Promise<TaxonomyTerm> {
    return { id: 'new', ...term };
  }

  async validateTerm(termId: string): Promise<boolean> {
    return true;
  }

  async getTags(category?: string): Promise<string[]> {
    return [];
  }

  async getMetadataFields(): Promise<any[]> {
    return [];
  }
}

export const taxonomyService = TaxonomyService.getInstance();
