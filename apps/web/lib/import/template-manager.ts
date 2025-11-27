/**
 * Template management service for saving and loading column mappings
 */

import type { MatchResult } from './fuzzy-matcher';

export interface MappingTemplate {
  id: string;
  name: string;
  description: string;
  supplierId?: string;
  supplierName?: string;
  mappings: MatchResult[];
  requiredFields: string[];
  optionalFields: string[];
  fileNamePattern?: string;
  headerPatterns: string[];
  usageCount: number;
  successRate: number;
  lastUsed?: Date;
  version: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TemplateManager {
  private static readonly STORAGE_KEY = 'rate-card-templates';

  /**
   * Save a new template
   */
  static async saveTemplate(
    name: string,
    description: string,
    mappings: MatchResult[],
    headers: string[],
    options: {
      supplierId?: string;
      supplierName?: string;
      fileNamePattern?: string;
      createdBy: string;
    }
  ): Promise<MappingTemplate> {
    const template: MappingTemplate = {
      id: `template-${Date.now()}`,
      name,
      description,
      supplierId: options.supplierId,
      supplierName: options.supplierName,
      mappings,
      requiredFields: mappings.filter(m => this.isRequiredField(m.targetField)).map(m => m.targetField),
      optionalFields: mappings.filter(m => !this.isRequiredField(m.targetField)).map(m => m.targetField),
      fileNamePattern: options.fileNamePattern,
      headerPatterns: headers,
      usageCount: 0,
      successRate: 0,
      version: 1,
      createdBy: options.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to localStorage (in production, save to database)
    const templates = this.getAllTemplates();
    templates.push(template);
    this.saveToStorage(templates);

    return template;
  }

  /**
   * Load a template by ID
   */
  static async loadTemplate(id: string): Promise<MappingTemplate | null> {
    const templates = this.getAllTemplates();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * Get all templates
   */
  static getAllTemplates(): MappingTemplate[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const templates = JSON.parse(stored);
      // Convert date strings back to Date objects
      return templates.map((t: any) => ({
        ...t,
        createdAt: new Date(t.createdAt),
        updatedAt: new Date(t.updatedAt),
        lastUsed: t.lastUsed ? new Date(t.lastUsed) : undefined,
      }));
    } catch (error) {
      console.error('Failed to load templates:', error);
      return [];
    }
  }

  /**
   * Find templates by supplier
   */
  static findBySupplier(supplierId: string): MappingTemplate[] {
    return this.getAllTemplates().filter(t => t.supplierId === supplierId);
  }

  /**
   * Find template by file name pattern
   */
  static findByFileName(fileName: string): MappingTemplate | null {
    const templates = this.getAllTemplates();

    for (const template of templates) {
      if (template.fileNamePattern) {
        try {
          const regex = new RegExp(template.fileNamePattern, 'i');
          if (regex.test(fileName)) {
            return template;
          }
        } catch (error) {
          // Invalid regex, skip
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Find template by header similarity
   */
  static findByHeaders(headers: string[]): MappingTemplate | null {
    const templates = this.getAllTemplates();
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    let bestMatch: { template: MappingTemplate; score: number } | null = null;

    for (const template of templates) {
      const normalizedPatterns = template.headerPatterns.map(p => p.toLowerCase().trim());
      
      // Calculate match score
      let matchCount = 0;
      for (const pattern of normalizedPatterns) {
        if (normalizedHeaders.includes(pattern)) {
          matchCount++;
        }
      }

      const score = matchCount / normalizedPatterns.length;

      if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { template, score };
      }
    }

    return bestMatch?.template || null;
  }

  /**
   * Update template
   */
  static async updateTemplate(
    id: string,
    updates: Partial<Omit<MappingTemplate, 'id' | 'createdAt' | 'createdBy'>>
  ): Promise<MappingTemplate | null> {
    const templates = this.getAllTemplates();
    const index = templates.findIndex(t => t.id === id);

    if (index === -1) return null;

    const existingTemplate = templates[index];
    if (!existingTemplate) return null;
    
    const updatedTemplate: MappingTemplate = {
      ...existingTemplate,
      ...updates,
      updatedAt: new Date(),
    } as MappingTemplate;
    
    templates[index] = updatedTemplate;

    this.saveToStorage(templates);
    return updatedTemplate;
  }

  /**
   * Delete template
   */
  static async deleteTemplate(id: string): Promise<boolean> {
    const templates = this.getAllTemplates();
    const filtered = templates.filter(t => t.id !== id);

    if (filtered.length === templates.length) return false;

    this.saveToStorage(filtered);
    return true;
  }

  /**
   * Increment usage count
   */
  static async incrementUsage(id: string): Promise<void> {
    const template = await this.loadTemplate(id);
    if (!template) return;

    await this.updateTemplate(id, {
      usageCount: template.usageCount + 1,
      lastUsed: new Date(),
    });
  }

  /**
   * Update success rate
   */
  static async updateSuccessRate(id: string, success: boolean): Promise<void> {
    const template = await this.loadTemplate(id);
    if (!template) return;

    const totalUses = template.usageCount;
    const currentSuccesses = Math.round(template.successRate * totalUses);
    const newSuccesses = success ? currentSuccesses + 1 : currentSuccesses;
    const newSuccessRate = newSuccesses / (totalUses + 1);

    await this.updateTemplate(id, {
      successRate: newSuccessRate,
    });
  }

  /**
   * Export template to JSON
   */
  static exportTemplate(template: MappingTemplate): string {
    return JSON.stringify(template, null, 2);
  }

  /**
   * Import template from JSON
   */
  static async importTemplate(json: string, createdBy: string): Promise<MappingTemplate> {
    const data = JSON.parse(json);
    
    const template: MappingTemplate = {
      ...data,
      id: `template-${Date.now()}`,
      usageCount: 0,
      successRate: 0,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const templates = this.getAllTemplates();
    templates.push(template);
    this.saveToStorage(templates);

    return template;
  }

  /**
   * Get template statistics
   */
  static getStatistics(): {
    total: number;
    bySupplier: Record<string, number>;
    mostUsed: MappingTemplate[];
    avgSuccessRate: number;
  } {
    const templates = this.getAllTemplates();

    const bySupplier: Record<string, number> = {};
    for (const template of templates) {
      if (template.supplierId) {
        bySupplier[template.supplierId] = (bySupplier[template.supplierId] || 0) + 1;
      }
    }

    const mostUsed = [...templates]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    const avgSuccessRate = templates.length > 0
      ? templates.reduce((sum, t) => sum + t.successRate, 0) / templates.length
      : 0;

    return {
      total: templates.length,
      bySupplier,
      mostUsed,
      avgSuccessRate,
    };
  }

  /**
   * Check if field is required
   */
  private static isRequiredField(field: string): boolean {
    return ['role', 'rate'].includes(field);
  }

  /**
   * Save templates to storage
   */
  private static saveToStorage(templates: MappingTemplate[]): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error('Failed to save templates:', error);
    }
  }

  /**
   * Clear all templates (for testing)
   */
  static clearAll(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
