/**
 * Taxonomy Service
 * 
 * Manages custom taxonomies, tags, and metadata schemas for contract classification
 * and organization. Provides hierarchical taxonomy support with custom fields.
 */

import { dbAdaptor } from "../dal/database.adaptor";
import { cacheAdaptor } from "../dal/cache.adaptor";
import { eventBus, Events } from "../events/event-bus";
import pino from "pino";
import type { ServiceResponse } from "../types";

const logger = pino({ name: "taxonomy-service" });

export interface TaxonomyCategory {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  parentId?: string;
  level: number;
  path: string; // e.g., "legal/contracts/service-agreements"
  color?: string;
  icon?: string;
  isActive: boolean;
  metadata: {
    contractCount: number;
    lastUsed?: Date;
    createdBy: string;
    updatedBy?: string;
  };
  children?: TaxonomyCategory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxonomyTag {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  categoryId?: string;
  color: string;
  type: 'system' | 'custom' | 'auto-generated';
  usage: {
    contractCount: number;
    lastUsed?: Date;
    trending: boolean;
  };
  metadata: {
    createdBy: string;
    updatedBy?: string;
    aliases?: string[];
    relatedTags?: string[];
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractMetadataField {
  id: string;
  tenantId: string;
  name: string;
  label: string;
  description?: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multi-select' | 'boolean' | 'currency' | 'duration';
  required: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ value: string; label: string; }>;
  };
  defaultValue?: any;
  category: 'basic' | 'financial' | 'legal' | 'operational' | 'custom';
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractMetadata {
  contractId: string;
  tenantId: string;
  categoryId?: string;
  tags: string[];
  customFields: Record<string, any>;
  systemFields: {
    // Core contract information
    contractTitle?: string;
    contractType?: string;
    status?: string;
    
    // Parties
    clientName?: string;
    clientContact?: string;
    supplierName?: string;
    supplierContact?: string;
    
    // Financial
    totalValue?: number;
    currency?: string;
    paymentTerms?: string;
    
    // Dates
    effectiveDate?: Date;
    expirationDate?: Date;
    renewalDate?: Date;
    
    // Legal
    jurisdiction?: string;
    governingLaw?: string;
    
    // Operational
    department?: string;
    owner?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  };
  lastUpdated: Date;
  updatedBy: string;
}

export class TaxonomyService {
  private static instance: TaxonomyService;
  private taxonomyCache = new Map<string, TaxonomyCategory[]>();
  private tagsCache = new Map<string, TaxonomyTag[]>();
  private fieldsCache = new Map<string, ContractMetadataField[]>();

  private constructor() {
    this.initializeTaxonomy();
    this.setupEventListeners();
  }

  static getInstance(): TaxonomyService {
    if (!TaxonomyService.instance) {
      TaxonomyService.instance = new TaxonomyService();
    }
    return TaxonomyService.instance;
  }

  /**
   * Initialize taxonomy system with default categories and fields
   */
  private async initializeTaxonomy(): Promise<void> {
    try {
      logger.info("Initializing taxonomy service");
      
      // Create default taxonomy structure
      await this.createDefaultTaxonomy();
      
      // Create default metadata fields
      await this.createDefaultMetadataFields();
      
      // Create default tags
      await this.createDefaultTags();
      
      logger.info("Taxonomy service initialized");
    } catch (error) {
      logger.error({ error }, "Failed to initialize taxonomy service");
    }
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    eventBus.on(Events.CONTRACT_CREATED, async (data) => {
      await this.updateTagUsage(data.contractId);
    });

    eventBus.on(Events.CONTRACT_UPDATED, async (data) => {
      await this.updateTagUsage(data.contractId);
    });
  }

  /**
   * Get taxonomy categories for a tenant
   */
  async getTaxonomyCategories(tenantId: string): Promise<ServiceResponse<TaxonomyCategory[]>> {
    try {
      // Check cache first
      const cacheKey = `taxonomy:${tenantId}`;
      let categories = this.taxonomyCache.get(cacheKey);
      
      if (!categories) {
        // Load from database (mock implementation)
        categories = await this.loadTaxonomyFromDatabase(tenantId);
        this.taxonomyCache.set(cacheKey, categories);
      }

      return {
        success: true,
        data: categories
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to get taxonomy categories");
      return {
        success: false,
        error: { code: 'TAXONOMY_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Create or update taxonomy category
   */
  async upsertTaxonomyCategory(
    tenantId: string, 
    category: Partial<TaxonomyCategory>
  ): Promise<ServiceResponse<TaxonomyCategory>> {
    try {
      const now = new Date();
      
      const taxonomyCategory: TaxonomyCategory = {
        id: category.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        name: category.name || '',
        description: category.description,
        parentId: category.parentId,
        level: category.level || 0,
        path: category.path || category.name?.toLowerCase().replace(/\s+/g, '-') || '',
        color: category.color || '#3B82F6',
        icon: category.icon || 'folder',
        isActive: category.isActive !== false,
        metadata: {
          contractCount: 0,
          createdBy: 'user',
          ...category.metadata
        },
        createdAt: category.createdAt || now,
        updatedAt: now
      };

      // Save to database (mock implementation)
      await this.saveTaxonomyToDatabase(tenantId, taxonomyCategory);
      
      // Update cache
      this.taxonomyCache.delete(`taxonomy:${tenantId}`);
      
      // Emit event
      eventBus.emit(Events.TAXONOMY_UPDATED, { tenantId, categoryId: taxonomyCategory.id });

      logger.info({ categoryId: taxonomyCategory.id, tenantId }, "Taxonomy category upserted");

      return {
        success: true,
        data: taxonomyCategory
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to upsert taxonomy category");
      return {
        success: false,
        error: { code: 'UPSERT_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Get tags for a tenant
   */
  async getTags(tenantId: string, categoryId?: string): Promise<ServiceResponse<TaxonomyTag[]>> {
    try {
      const cacheKey = `tags:${tenantId}:${categoryId || 'all'}`;
      let tags = this.tagsCache.get(cacheKey);
      
      if (!tags) {
        tags = await this.loadTagsFromDatabase(tenantId, categoryId);
        this.tagsCache.set(cacheKey, tags);
      }

      return {
        success: true,
        data: tags
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to get tags");
      return {
        success: false,
        error: { code: 'TAGS_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Create or update tag
   */
  async upsertTag(tenantId: string, tag: Partial<TaxonomyTag>): Promise<ServiceResponse<TaxonomyTag>> {
    try {
      const now = new Date();
      
      const taxonomyTag: TaxonomyTag = {
        id: tag.id || `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        name: tag.name || '',
        description: tag.description,
        categoryId: tag.categoryId,
        color: tag.color || this.generateTagColor(tag.name || ''),
        type: tag.type || 'custom',
        usage: {
          contractCount: 0,
          trending: false,
          ...tag.usage
        },
        metadata: {
          createdBy: 'user',
          aliases: [],
          relatedTags: [],
          ...tag.metadata
        },
        isActive: tag.isActive !== false,
        createdAt: tag.createdAt || now,
        updatedAt: now
      };

      // Save to database (mock implementation)
      await this.saveTagToDatabase(tenantId, taxonomyTag);
      
      // Update cache
      this.tagsCache.clear(); // Clear all tag caches for this tenant
      
      // Emit event
      eventBus.emit(Events.TAG_UPDATED, { tenantId, tagId: taxonomyTag.id });

      logger.info({ tagId: taxonomyTag.id, tenantId }, "Tag upserted");

      return {
        success: true,
        data: taxonomyTag
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to upsert tag");
      return {
        success: false,
        error: { code: 'TAG_UPSERT_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Get metadata fields for a tenant
   */
  async getMetadataFields(tenantId: string): Promise<ServiceResponse<ContractMetadataField[]>> {
    try {
      const cacheKey = `fields:${tenantId}`;
      let fields = this.fieldsCache.get(cacheKey);
      
      if (!fields) {
        fields = await this.loadMetadataFieldsFromDatabase(tenantId);
        this.fieldsCache.set(cacheKey, fields);
      }

      return {
        success: true,
        data: fields
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to get metadata fields");
      return {
        success: false,
        error: { code: 'FIELDS_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Create or update metadata field
   */
  async upsertMetadataField(
    tenantId: string, 
    field: Partial<ContractMetadataField>
  ): Promise<ServiceResponse<ContractMetadataField>> {
    try {
      const now = new Date();
      
      const metadataField: ContractMetadataField = {
        id: field.id || `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        name: field.name || '',
        label: field.label || field.name || '',
        description: field.description,
        type: field.type || 'text',
        required: field.required || false,
        validation: field.validation,
        defaultValue: field.defaultValue,
        category: field.category || 'custom',
        displayOrder: field.displayOrder || 999,
        isActive: field.isActive !== false,
        createdAt: field.createdAt || now,
        updatedAt: now
      };

      // Save to database (mock implementation)
      await this.saveMetadataFieldToDatabase(tenantId, metadataField);
      
      // Update cache
      this.fieldsCache.delete(cacheKey);
      
      // Emit event
      eventBus.emit(Events.METADATA_FIELD_UPDATED, { tenantId, fieldId: metadataField.id });

      logger.info({ fieldId: metadataField.id, tenantId }, "Metadata field upserted");

      return {
        success: true,
        data: metadataField
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to upsert metadata field");
      return {
        success: false,
        error: { code: 'FIELD_UPSERT_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Get contract metadata
   */
  async getContractMetadata(contractId: string, tenantId: string): Promise<ServiceResponse<ContractMetadata>> {
    try {
      // Get from database using dbAdaptor
      const metadata = await dbAdaptor.prisma.contractMetadata.findFirst({
        where: {
          contractId,
          tenantId
        },
        include: {
          category: true
        }
      });

      if (!metadata) {
        // Return default metadata structure
        const defaultMetadata: ContractMetadata = {
          contractId,
          tenantId,
          tags: [],
          customFields: {},
          systemFields: {},
          lastUpdated: new Date(),
          updatedBy: 'system'
        };
        
        return {
          success: true,
          data: defaultMetadata
        };
      }

      // Transform database result to interface
      const result: ContractMetadata = {
        contractId: metadata.contractId,
        tenantId: metadata.tenantId,
        categoryId: metadata.categoryId || undefined,
        tags: metadata.tags,
        customFields: metadata.customFields as Record<string, any>,
        systemFields: metadata.systemFields as ContractMetadata['systemFields'],
        lastUpdated: metadata.lastUpdated,
        updatedBy: metadata.updatedBy
      };
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error({ error, contractId, tenantId }, "Failed to get contract metadata");
      return {
        success: false,
        error: { code: 'METADATA_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Update contract metadata
   */
  async updateContractMetadata(
    contractId: string,
    tenantId: string,
    metadata: Partial<ContractMetadata>,
    updatedBy: string
  ): Promise<ServiceResponse<ContractMetadata>> {
    try {
      const now = new Date();

      // Upsert contract metadata in database
      const updatedRecord = await dbAdaptor.prisma.contractMetadata.upsert({
        where: {
          contractId
        },
        update: {
          categoryId: metadata.categoryId,
          tags: metadata.tags || [],
          customFields: metadata.customFields || {},
          systemFields: metadata.systemFields || {},
          lastUpdated: now,
          updatedBy
        },
        create: {
          contractId,
          tenantId,
          categoryId: metadata.categoryId,
          tags: metadata.tags || [],
          customFields: metadata.customFields || {},
          systemFields: metadata.systemFields || {},
          lastUpdated: now,
          updatedBy
        }
      });

      // Update tag usage statistics
      if (metadata.tags) {
        await this.updateTagUsageStats(tenantId, metadata.tags);
      }

      // Update category usage statistics
      if (metadata.categoryId) {
        await this.updateCategoryUsageStats(tenantId, metadata.categoryId);
      }
      
      // Emit event for indexing
      eventBus.emit(Events.CONTRACT_METADATA_UPDATED, { 
        contractId, 
        tenantId, 
        metadata: updatedRecord 
      });

      // Transform result
      const result: ContractMetadata = {
        contractId: updatedRecord.contractId,
        tenantId: updatedRecord.tenantId,
        categoryId: updatedRecord.categoryId || undefined,
        tags: updatedRecord.tags,
        customFields: updatedRecord.customFields as Record<string, any>,
        systemFields: updatedRecord.systemFields as ContractMetadata['systemFields'],
        lastUpdated: updatedRecord.lastUpdated,
        updatedBy: updatedRecord.updatedBy
      };

      logger.info({ contractId, tenantId }, "Contract metadata updated in database");

      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error({ error, contractId, tenantId }, "Failed to update contract metadata");
      return {
        success: false,
        error: { code: 'METADATA_UPDATE_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Search contracts by taxonomy
   */
  async searchByTaxonomy(
    tenantId: string,
    filters: {
      categoryId?: string;
      tags?: string[];
      customFields?: Record<string, any>;
    }
  ): Promise<ServiceResponse<string[]>> {
    try {
      // This would query the database for contracts matching the taxonomy filters
      // For now, return mock contract IDs
      const contractIds = await this.searchContractsByTaxonomy(tenantId, filters);
      
      return {
        success: true,
        data: contractIds
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to search by taxonomy");
      return {
        success: false,
        error: { code: 'TAXONOMY_SEARCH_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Get taxonomy analytics
   */
  async getTaxonomyAnalytics(tenantId: string): Promise<ServiceResponse<{
    categoryUsage: Array<{ categoryId: string; name: string; contractCount: number; }>;
    tagUsage: Array<{ tagId: string; name: string; contractCount: number; trending: boolean; }>;
    fieldUsage: Array<{ fieldId: string; name: string; usageCount: number; }>;
    recentActivity: Array<{ type: string; item: string; timestamp: Date; }>;
  }>> {
    try {
      const analytics = {
        categoryUsage: [
          { categoryId: 'cat1', name: 'Service Agreements', contractCount: 45 },
          { categoryId: 'cat2', name: 'Purchase Orders', contractCount: 32 },
          { categoryId: 'cat3', name: 'NDAs', contractCount: 28 }
        ],
        tagUsage: [
          { tagId: 'tag1', name: 'high-value', contractCount: 15, trending: true },
          { tagId: 'tag2', name: 'recurring', contractCount: 23, trending: false },
          { tagId: 'tag3', name: 'urgent', contractCount: 8, trending: true }
        ],
        fieldUsage: [
          { fieldId: 'field1', name: 'Department', usageCount: 89 },
          { fieldId: 'field2', name: 'Project Code', usageCount: 67 },
          { fieldId: 'field3', name: 'Budget Category', usageCount: 54 }
        ],
        recentActivity: [
          { type: 'tag_created', item: 'compliance-required', timestamp: new Date() },
          { type: 'category_updated', item: 'Legal Agreements', timestamp: new Date() },
          { type: 'field_added', item: 'Risk Level', timestamp: new Date() }
        ]
      };

      return {
        success: true,
        data: analytics
      };
    } catch (error) {
      logger.error({ error, tenantId }, "Failed to get taxonomy analytics");
      return {
        success: false,
        error: { code: 'ANALYTICS_ERROR', message: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Private helper methods (mock implementations)
   */

  private async createDefaultTaxonomy(): Promise<void> {
    // Create default taxonomy categories
    const defaultCategories = [
      { name: 'Service Agreements', path: 'service-agreements', color: '#3B82F6', icon: 'handshake' },
      { name: 'Purchase Orders', path: 'purchase-orders', color: '#10B981', icon: 'shopping-cart' },
      { name: 'NDAs', path: 'ndas', color: '#F59E0B', icon: 'shield' },
      { name: 'Employment Contracts', path: 'employment', color: '#8B5CF6', icon: 'users' },
      { name: 'Vendor Agreements', path: 'vendor-agreements', color: '#EF4444', icon: 'truck' }
    ];

    // In a real implementation, these would be saved to the database
    logger.info({ count: defaultCategories.length }, "Default taxonomy categories created");
  }

  private async createDefaultMetadataFields(): Promise<void> {
    const defaultFields = [
      // Basic fields
      { name: 'department', label: 'Department', type: 'select', category: 'basic', required: true },
      { name: 'owner', label: 'Contract Owner', type: 'text', category: 'basic', required: true },
      { name: 'priority', label: 'Priority', type: 'select', category: 'basic', required: false },
      
      // Financial fields
      { name: 'budgetCategory', label: 'Budget Category', type: 'select', category: 'financial', required: false },
      { name: 'costCenter', label: 'Cost Center', type: 'text', category: 'financial', required: false },
      { name: 'approvalLimit', label: 'Approval Limit', type: 'currency', category: 'financial', required: false },
      
      // Legal fields
      { name: 'riskLevel', label: 'Risk Level', type: 'select', category: 'legal', required: false },
      { name: 'complianceRequired', label: 'Compliance Required', type: 'boolean', category: 'legal', required: false },
      { name: 'reviewCycle', label: 'Review Cycle', type: 'duration', category: 'legal', required: false },
      
      // Operational fields
      { name: 'projectCode', label: 'Project Code', type: 'text', category: 'operational', required: false },
      { name: 'deliverables', label: 'Key Deliverables', type: 'text', category: 'operational', required: false },
      { name: 'sla', label: 'SLA Requirements', type: 'text', category: 'operational', required: false }
    ];

    logger.info({ count: defaultFields.length }, "Default metadata fields created");
  }

  private async createDefaultTags(): Promise<void> {
    const defaultTags = [
      { name: 'high-value', color: '#EF4444', type: 'system' },
      { name: 'recurring', color: '#10B981', type: 'system' },
      { name: 'urgent', color: '#F59E0B', type: 'system' },
      { name: 'compliance-required', color: '#8B5CF6', type: 'system' },
      { name: 'auto-renewal', color: '#3B82F6', type: 'system' },
      { name: 'confidential', color: '#6B7280', type: 'system' }
    ];

    logger.info({ count: defaultTags.length }, "Default tags created");
  }

  private generateTagColor(name: string): string {
    const colors = ['#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#3B82F6', '#EC4899', '#14B8A6', '#F97316'];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  private async loadTaxonomyFromDatabase(tenantId: string): Promise<TaxonomyCategory[]> {
    // Mock implementation - in production, this would query the database
    return [
      {
        id: 'cat1',
        tenantId,
        name: 'Service Agreements',
        path: 'service-agreements',
        level: 0,
        color: '#3B82F6',
        icon: 'handshake',
        isActive: true,
        metadata: { contractCount: 45, createdBy: 'system' },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'cat2',
        tenantId,
        name: 'Purchase Orders',
        path: 'purchase-orders',
        level: 0,
        color: '#10B981',
        icon: 'shopping-cart',
        isActive: true,
        metadata: { contractCount: 32, createdBy: 'system' },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  private async loadTagsFromDatabase(tenantId: string, categoryId?: string): Promise<TaxonomyTag[]> {
    // Mock implementation
    return [
      {
        id: 'tag1',
        tenantId,
        name: 'high-value',
        color: '#EF4444',
        type: 'system',
        usage: { contractCount: 15, trending: true },
        metadata: { createdBy: 'system' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'tag2',
        tenantId,
        name: 'recurring',
        color: '#10B981',
        type: 'system',
        usage: { contractCount: 23, trending: false },
        metadata: { createdBy: 'system' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  private async loadMetadataFieldsFromDatabase(tenantId: string): Promise<ContractMetadataField[]> {
    // Mock implementation
    return [
      {
        id: 'field1',
        tenantId,
        name: 'department',
        label: 'Department',
        type: 'select',
        required: true,
        category: 'basic',
        displayOrder: 1,
        validation: {
          options: [
            { value: 'legal', label: 'Legal' },
            { value: 'finance', label: 'Finance' },
            { value: 'operations', label: 'Operations' },
            { value: 'hr', label: 'Human Resources' }
          ]
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'field2',
        tenantId,
        name: 'priority',
        label: 'Priority Level',
        type: 'select',
        required: false,
        category: 'basic',
        displayOrder: 2,
        validation: {
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' }
          ]
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }

  private async loadContractMetadataFromDatabase(contractId: string, tenantId: string): Promise<ContractMetadata> {
    // Mock implementation
    return {
      contractId,
      tenantId,
      categoryId: 'cat1',
      tags: ['high-value', 'recurring'],
      customFields: {
        department: 'legal',
        priority: 'high',
        projectCode: 'PROJ-2024-001'
      },
      systemFields: {
        contractTitle: 'Professional Services Agreement',
        contractType: 'SERVICE',
        clientName: 'Acme Corporation',
        supplierName: 'TechServ Solutions',
        totalValue: 150000,
        currency: 'USD',
        effectiveDate: new Date('2024-01-01'),
        expirationDate: new Date('2024-12-31')
      },
      lastUpdated: new Date(),
      updatedBy: 'user'
    };
  }

  private async saveTaxonomyToDatabase(tenantId: string, category: TaxonomyCategory): Promise<void> {
    // Mock implementation - in production, save to database
    logger.info({ categoryId: category.id, tenantId }, "Taxonomy category saved to database");
  }

  private async saveTagToDatabase(tenantId: string, tag: TaxonomyTag): Promise<void> {
    // Mock implementation
    logger.info({ tagId: tag.id, tenantId }, "Tag saved to database");
  }

  private async saveMetadataFieldToDatabase(tenantId: string, field: ContractMetadataField): Promise<void> {
    // Mock implementation
    logger.info({ fieldId: field.id, tenantId }, "Metadata field saved to database");
  }

  private async saveContractMetadataToDatabase(contractId: string, tenantId: string, metadata: ContractMetadata): Promise<void> {
    // Mock implementation
    logger.info({ contractId, tenantId }, "Contract metadata saved to database");
  }

  private async updateTagUsage(contractId: string): Promise<void> {
    // Update tag usage statistics
    logger.info({ contractId }, "Tag usage updated");
  }

  private async updateTagUsageStats(tenantId: string, tags: string[]): Promise<void> {
    try {
      // Update usage count for each tag
      for (const tagName of tags) {
        await dbAdaptor.prisma.taxonomyTag.updateMany({
          where: {
            tenantId,
            name: tagName
          },
          data: {
            lastUsed: new Date(),
            contractCount: {
              increment: 1
            }
          }
        });
      }
    } catch (error) {
      logger.error({ error, tenantId, tags }, "Failed to update tag usage stats");
    }
  }

  private async updateCategoryUsageStats(tenantId: string, categoryId: string): Promise<void> {
    try {
      await dbAdaptor.prisma.taxonomyCategory.update({
        where: {
          id: categoryId
        },
        data: {
          lastUsed: new Date(),
          contractCount: {
            increment: 1
          }
        }
      });
    } catch (error) {
      logger.error({ error, tenantId, categoryId }, "Failed to update category usage stats");
    }
  }

  private async updateTagUsageForContract(contractId: string, tags: string[]): Promise<void> {
    // This method is called when contract metadata is updated
    logger.info({ contractId, tags }, "Tag usage updated for contract");
  }

  private async searchContractsByTaxonomy(tenantId: string, filters: any): Promise<string[]> {
    try {
      const where: any = { tenantId };
      
      if (filters.categoryId) {
        where.categoryId = filters.categoryId;
      }
      
      if (filters.tags && filters.tags.length > 0) {
        where.tags = {
          hasSome: filters.tags
        };
      }

      const results = await dbAdaptor.prisma.contractMetadata.findMany({
        where,
        select: {
          contractId: true
        }
      });

      return results.map(r => r.contractId);
    } catch (error) {
      logger.error({ error, tenantId, filters }, "Failed to search contracts by taxonomy");
      return [];
    }
  }
}

export const taxonomyService = TaxonomyService.getInstance();