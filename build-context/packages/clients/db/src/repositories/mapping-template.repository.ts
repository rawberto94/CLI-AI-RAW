import { Prisma, MappingTemplate } from '@prisma/client';
import { AbstractRepository, QueryOptions } from './base.repository';
import { DatabaseManager } from '../../index';

export type MappingTemplateCreateInput = Prisma.MappingTemplateCreateInput;
export type MappingTemplateUpdateInput = Prisma.MappingTemplateUpdateInput;
export type MappingTemplateWhereInput = Prisma.MappingTemplateWhereInput;

export interface MappingTemplateFilters {
  supplierId?: string;
  name?: string;
  searchTerm?: string;
}

export class MappingTemplateRepository extends AbstractRepository<
  MappingTemplate,
  MappingTemplateCreateInput,
  MappingTemplateUpdateInput,
  MappingTemplateWhereInput
> {
  protected modelName = 'mappingTemplate';

  constructor(databaseManager: DatabaseManager) {
    super(databaseManager);
  }

  /**
   * Find templates by tenant with filters
   */
  async findByTenant(
    tenantId: string,
    filters?: MappingTemplateFilters,
    options?: QueryOptions
  ): Promise<MappingTemplate[]> {
    const where: MappingTemplateWhereInput = {
      tenantId,
      ...(filters?.supplierId && { supplierId: filters.supplierId }),
      ...(filters?.name && { name: { contains: filters.name, mode: 'insensitive' } }),
      ...(filters?.searchTerm && {
        OR: [
          { name: { contains: filters.searchTerm, mode: 'insensitive' } },
          { description: { contains: filters.searchTerm, mode: 'insensitive' } },
          { supplierName: { contains: filters.searchTerm, mode: 'insensitive' } },
        ],
      }),
    };

    return this.findMany(where, {
      ...options,
      orderBy: { usageCount: 'desc', ...options?.orderBy },
    });
  }

  /**
   * Find templates by supplier
   */
  async findBySupplier(
    tenantId: string,
    supplierId: string,
    options?: QueryOptions
  ): Promise<MappingTemplate[]> {
    return this.findMany(
      {
        tenantId,
        supplierId,
      },
      {
        ...options,
        orderBy: { version: 'desc' },
      }
    );
  }

  /**
   * Find template by name and version
   */
  async findByNameAndVersion(
    tenantId: string,
    name: string,
    version: number
  ): Promise<MappingTemplate | null> {
    return this.findFirst({
      tenantId,
      name,
      version,
    });
  }

  /**
   * Find latest version of template
   */
  async findLatestVersion(
    tenantId: string,
    name: string
  ): Promise<MappingTemplate | null> {
    return this.findFirst(
      {
        tenantId,
        name,
      },
      {
        orderBy: { version: 'desc' },
      }
    );
  }

  /**
   * Match template by file name pattern
   */
  async matchByFileName(
    tenantId: string,
    fileName: string
  ): Promise<MappingTemplate | null> {
    const templates = await this.findByTenant(tenantId);

    // Find template with matching file name pattern
    for (const template of templates) {
      if (template.fileNamePattern) {
        try {
          const regex = new RegExp(template.fileNamePattern, 'i');
          if (regex.test(fileName)) {
            return template;
          }
        } catch (error) {
          // Invalid regex pattern, skip
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Match template by header patterns
   */
  async matchByHeaders(
    tenantId: string,
    headers: string[]
  ): Promise<MappingTemplate | null> {
    const templates = await this.findByTenant(tenantId);
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

    let bestMatch: { template: MappingTemplate; score: number } | null = null;

    for (const template of templates) {
      const headerPatterns = template.headerPatterns as string[];
      if (!headerPatterns || headerPatterns.length === 0) continue;

      const normalizedPatterns = headerPatterns.map(p => p.toLowerCase().trim());
      
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
   * Increment usage count
   */
  async incrementUsage(id: string): Promise<MappingTemplate> {
    const template = await this.findById(id);
    if (!template) {
      throw new Error(`Template ${id} not found`);
    }

    return this.update(id, {
      usageCount: template.usageCount + 1,
      lastUsed: new Date(),
    });
  }

  /**
   * Update success rate
   */
  async updateSuccessRate(id: string, successRate: number): Promise<MappingTemplate> {
    return this.update(id, { successRate });
  }

  /**
   * Create new version of template
   */
  async createVersion(
    templateId: string,
    updates: Partial<MappingTemplateCreateInput>,
    createdBy: string
  ): Promise<MappingTemplate> {
    const currentTemplate = await this.findById(templateId);
    if (!currentTemplate) {
      throw new Error(`Template ${templateId} not found`);
    }

    const newVersion = currentTemplate.version + 1;

    return this.create({
      tenantId: currentTemplate.tenantId,
      name: currentTemplate.name,
      supplierId: currentTemplate.supplierId,
      supplierName: currentTemplate.supplierName,
      description: currentTemplate.description,
      mappings: currentTemplate.mappings,
      requiredFields: currentTemplate.requiredFields,
      optionalFields: currentTemplate.optionalFields,
      fileNamePattern: currentTemplate.fileNamePattern,
      headerPatterns: currentTemplate.headerPatterns,
      ...updates,
      version: newVersion,
      createdBy,
    } as MappingTemplateCreateInput);
  }

  /**
   * Get template statistics
   */
  async getStatistics(tenantId: string) {
    const templates = await this.findByTenant(tenantId);

    const totalUsage = templates.reduce((sum, t) => sum + t.usageCount, 0);
    const avgSuccessRate = templates.length > 0
      ? templates.reduce((sum, t) => sum + Number(t.successRate), 0) / templates.length
      : 0;

    const bySupplier = templates.reduce((acc, t) => {
      if (t.supplierId) {
        acc[t.supplierId] = (acc[t.supplierId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      total: templates.length,
      totalUsage,
      avgSuccessRate,
      bySupplier,
      mostUsed: templates
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5)
        .map(t => ({
          id: t.id,
          name: t.name,
          usageCount: t.usageCount,
          successRate: Number(t.successRate),
        })),
    };
  }

  /**
   * Find unused templates
   */
  async findUnused(tenantId: string, daysUnused: number = 90): Promise<MappingTemplate[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysUnused);

    return this.findMany({
      tenantId,
      OR: [
        { lastUsed: null },
        { lastUsed: { lt: cutoffDate } },
      ],
    });
  }

  /**
   * Export template
   */
  async exportTemplate(id: string): Promise<any> {
    const template = await this.findById(id);
    if (!template) {
      throw new Error(`Template ${id} not found`);
    }

    return {
      name: template.name,
      description: template.description,
      supplierId: template.supplierId,
      supplierName: template.supplierName,
      mappings: template.mappings,
      requiredFields: template.requiredFields,
      optionalFields: template.optionalFields,
      fileNamePattern: template.fileNamePattern,
      headerPatterns: template.headerPatterns,
      version: template.version,
    };
  }

  /**
   * Import template
   */
  async importTemplate(
    tenantId: string,
    templateData: any,
    createdBy: string
  ): Promise<MappingTemplate> {
    // Check if template with same name exists
    const existing = await this.findLatestVersion(tenantId, templateData.name);
    const version = existing ? existing.version + 1 : 1;

    return this.create({
      tenantId,
      name: templateData.name,
      description: templateData.description,
      supplierId: templateData.supplierId,
      supplierName: templateData.supplierName,
      mappings: templateData.mappings,
      requiredFields: templateData.requiredFields || [],
      optionalFields: templateData.optionalFields || [],
      fileNamePattern: templateData.fileNamePattern,
      headerPatterns: templateData.headerPatterns || [],
      version,
      createdBy,
    } as MappingTemplateCreateInput);
  }
}
