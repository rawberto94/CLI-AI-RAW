/**
 * Artifact Configuration Service
 * 
 * Provides flexible, tenant-configurable artifact generation settings.
 * Allows enabling/disabling artifact types, customizing priorities,
 * and setting quality thresholds per tenant.
 */

import { dbAdaptor } from '../dal/database.adaptor';
import { cacheAdaptor } from '../dal/cache.adaptor';

// =============================================================================
// Types
// =============================================================================

export type ArtifactType = 
  | 'OVERVIEW'
  | 'FINANCIAL'
  | 'CLAUSES'
  | 'RATES'
  | 'COMPLIANCE'
  | 'RISK'
  | 'OBLIGATIONS'
  | 'RENEWAL'
  | 'NEGOTIATION_POINTS'
  | 'AMENDMENTS'
  | 'CONTACTS'
  | 'CUSTOM';

export interface ArtifactTypeConfig {
  type: ArtifactType;
  enabled: boolean;
  priority: number; // 1 = highest priority (generated first)
  weight: number; // Progress weight for UI (1-20)
  qualityThreshold: number; // 0-1, minimum acceptable quality score
  maxRetries: number;
  timeoutMs: number;
  label: string;
  description: string;
  icon?: string;
  category: 'core' | 'analysis' | 'advanced' | 'custom';
}

export interface ArtifactGenerationConfig {
  // Parallel processing
  enableParallelGeneration: boolean;
  maxParallelArtifacts: number;
  
  // Quality settings
  enableQualityValidation: boolean;
  enableSelfCritique: boolean;
  globalQualityThreshold: number;
  
  // Retry settings
  maxRegenerationAttempts: number;
  continueOnPartialFailure: boolean;
  enableFallbackOnError: boolean;
  
  // AI settings
  preferredModel: string;
  fallbackModel: string;
  temperature: number;
  maxTokensPerArtifact: number;
  
  // Rate limiting
  maxArtifactsPerMinute: number;
  
  // Custom artifact types (tenant-specific)
  customArtifactTypes: CustomArtifactType[];
}

export interface CustomArtifactType {
  id: string;
  name: string;
  label: string;
  description: string;
  prompt: string;
  outputSchema: Record<string, any>;
  enabled: boolean;
  priority: number;
}

export interface TenantArtifactConfig {
  tenantId: string;
  artifactTypes: Record<ArtifactType, Partial<ArtifactTypeConfig>>;
  generationConfig: Partial<ArtifactGenerationConfig>;
  updatedAt: Date;
}

// =============================================================================
// Default Configurations
// =============================================================================

export const DEFAULT_ARTIFACT_TYPES: ArtifactTypeConfig[] = [
  {
    type: 'OVERVIEW',
    enabled: true,
    priority: 1,
    weight: 10,
    qualityThreshold: 0.7,
    maxRetries: 3,
    timeoutMs: 60000,
    label: 'Overview',
    description: 'Executive summary, parties, dates, and key terms',
    icon: 'FileText',
    category: 'core',
  },
  {
    type: 'CLAUSES',
    enabled: true,
    priority: 2,
    weight: 12,
    qualityThreshold: 0.7,
    maxRetries: 3,
    timeoutMs: 90000,
    label: 'Clauses',
    description: 'Key contractual clauses and provisions',
    icon: 'List',
    category: 'core',
  },
  {
    type: 'FINANCIAL',
    enabled: true,
    priority: 3,
    weight: 12,
    qualityThreshold: 0.75,
    maxRetries: 3,
    timeoutMs: 60000,
    label: 'Financial',
    description: 'Pricing, payment terms, and cost analysis',
    icon: 'DollarSign',
    category: 'core',
  },
  {
    type: 'RISK',
    enabled: true,
    priority: 4,
    weight: 12,
    qualityThreshold: 0.7,
    maxRetries: 3,
    timeoutMs: 90000,
    label: 'Risk Assessment',
    description: 'Risk factors, red flags, and mitigation strategies',
    icon: 'AlertTriangle',
    category: 'analysis',
  },
  {
    type: 'COMPLIANCE',
    enabled: true,
    priority: 5,
    weight: 12,
    qualityThreshold: 0.7,
    maxRetries: 3,
    timeoutMs: 90000,
    label: 'Compliance',
    description: 'Regulatory compliance and requirements',
    icon: 'CheckCircle',
    category: 'analysis',
  },
  {
    type: 'OBLIGATIONS',
    enabled: true,
    priority: 6,
    weight: 10,
    qualityThreshold: 0.7,
    maxRetries: 3,
    timeoutMs: 90000,
    label: 'Obligations',
    description: 'Deliverables, SLAs, and milestones',
    icon: 'Target',
    category: 'analysis',
  },
  {
    type: 'RENEWAL',
    enabled: true,
    priority: 7,
    weight: 10,
    qualityThreshold: 0.7,
    maxRetries: 3,
    timeoutMs: 60000,
    label: 'Renewal Terms',
    description: 'Auto-renewal, termination, and expiration',
    icon: 'RefreshCw',
    category: 'analysis',
  },
  {
    type: 'NEGOTIATION_POINTS',
    enabled: true,
    priority: 8,
    weight: 8,
    qualityThreshold: 0.65,
    maxRetries: 2,
    timeoutMs: 90000,
    label: 'Negotiation Points',
    description: 'Leverage points and weak clauses',
    icon: 'MessageSquare',
    category: 'advanced',
  },
  {
    type: 'AMENDMENTS',
    enabled: true,
    priority: 9,
    weight: 7,
    qualityThreshold: 0.65,
    maxRetries: 2,
    timeoutMs: 60000,
    label: 'Amendments',
    description: 'Change history and modifications',
    icon: 'FileEdit',
    category: 'advanced',
  },
  {
    type: 'CONTACTS',
    enabled: true,
    priority: 10,
    weight: 7,
    qualityThreshold: 0.65,
    maxRetries: 2,
    timeoutMs: 45000,
    label: 'Contacts',
    description: 'Key contacts and escalation paths',
    icon: 'Users',
    category: 'advanced',
  },
  {
    type: 'RATES',
    enabled: false, // Disabled by default, enable if needed
    priority: 11,
    weight: 8,
    qualityThreshold: 0.7,
    maxRetries: 2,
    timeoutMs: 60000,
    label: 'Rate Cards',
    description: 'Detailed pricing and rate schedules',
    icon: 'Table',
    category: 'advanced',
  },
];

export const DEFAULT_GENERATION_CONFIG: ArtifactGenerationConfig = {
  enableParallelGeneration: false, // Sequential by default for stability
  maxParallelArtifacts: 3,
  enableQualityValidation: true,
  enableSelfCritique: true,
  globalQualityThreshold: 0.7,
  maxRegenerationAttempts: 2,
  continueOnPartialFailure: true,
  enableFallbackOnError: true,
  preferredModel: 'gpt-4o-mini',
  fallbackModel: 'gpt-3.5-turbo',
  temperature: 0.1,
  maxTokensPerArtifact: 4000,
  maxArtifactsPerMinute: 30,
  customArtifactTypes: [],
};

// =============================================================================
// Service Class
// =============================================================================

export class ArtifactConfigService {
  private static instance: ArtifactConfigService;

  private constructor() {}

  static getInstance(): ArtifactConfigService {
    if (!ArtifactConfigService.instance) {
      ArtifactConfigService.instance = new ArtifactConfigService();
    }
    return ArtifactConfigService.instance;
  }

  /**
   * Get artifact configuration for a tenant
   * Falls back to defaults if no tenant-specific config exists
   */
  async getTenantConfig(tenantId: string): Promise<TenantArtifactConfig> {
    // Check cache first
    const cacheKey = `artifact-config:${tenantId}`;
    const cached = await cacheAdaptor.get<TenantArtifactConfig>(cacheKey);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const tenantConfig = await dbAdaptor.prisma.tenantConfig.findUnique({
      where: { tenantId },
    });

    let config: TenantArtifactConfig;

    if (tenantConfig?.workflowSettings && typeof tenantConfig.workflowSettings === 'object') {
      const settings = tenantConfig.workflowSettings as Record<string, any>;
      config = {
        tenantId,
        artifactTypes: settings.artifactTypes || this.getDefaultArtifactTypesMap(),
        generationConfig: settings.artifactGeneration || DEFAULT_GENERATION_CONFIG,
        updatedAt: tenantConfig.updatedAt,
      };
    } else {
      // Return defaults
      config = {
        tenantId,
        artifactTypes: this.getDefaultArtifactTypesMap(),
        generationConfig: DEFAULT_GENERATION_CONFIG,
        updatedAt: new Date(),
      };
    }

    // Cache for 5 minutes
    await cacheAdaptor.set(cacheKey, config, 300);

    return config;
  }

  /**
   * Update tenant artifact configuration
   */
  async updateTenantConfig(
    tenantId: string,
    updates: Partial<Pick<TenantArtifactConfig, 'artifactTypes' | 'generationConfig'>>
  ): Promise<TenantArtifactConfig> {
    const current = await this.getTenantConfig(tenantId);

    const merged = {
      artifactTypes: { ...current.artifactTypes, ...updates.artifactTypes },
      generationConfig: { ...current.generationConfig, ...updates.generationConfig },
    };

    // Serialize to plain JSON for Prisma's Json field
    const workflowSettingsJson = JSON.parse(JSON.stringify({
      artifactTypes: merged.artifactTypes,
      artifactGeneration: merged.generationConfig,
    }));

    // Upsert to database
    await dbAdaptor.prisma.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        workflowSettings: workflowSettingsJson,
      },
      update: {
        workflowSettings: workflowSettingsJson,
        updatedAt: new Date(),
      },
    });

    // Invalidate cache
    await cacheAdaptor.delete(`artifact-config:${tenantId}`);

    return this.getTenantConfig(tenantId);
  }

  /**
   * Get enabled artifact types for a tenant, sorted by priority
   */
  async getEnabledArtifactTypes(tenantId: string): Promise<ArtifactTypeConfig[]> {
    const config = await this.getTenantConfig(tenantId);

    const enabledTypes = DEFAULT_ARTIFACT_TYPES
      .map(defaultType => {
        const override = config.artifactTypes[defaultType.type];
        return {
          ...defaultType,
          ...override,
        };
      })
      .filter(type => type.enabled)
      .sort((a, b) => a.priority - b.priority);

    // Add custom artifact types
    const customTypes = (config.generationConfig.customArtifactTypes || [])
      .filter(ct => ct.enabled)
      .map(ct => ({
        type: 'CUSTOM' as ArtifactType,
        enabled: true,
        priority: ct.priority,
        weight: 5,
        qualityThreshold: 0.6,
        maxRetries: 2,
        timeoutMs: 60000,
        label: ct.label,
        description: ct.description,
        category: 'custom' as const,
        customId: ct.id,
        customPrompt: ct.prompt,
        customOutputSchema: ct.outputSchema,
      }));

    return [...enabledTypes, ...customTypes].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Enable or disable a specific artifact type for a tenant
   */
  async toggleArtifactType(
    tenantId: string,
    artifactType: ArtifactType,
    enabled: boolean
  ): Promise<void> {
    const config = await this.getTenantConfig(tenantId);
    
    await this.updateTenantConfig(tenantId, {
      artifactTypes: {
        ...config.artifactTypes,
        [artifactType]: {
          ...(config.artifactTypes[artifactType] || {}),
          enabled,
        },
      },
    });
  }

  /**
   * Add a custom artifact type for a tenant
   */
  async addCustomArtifactType(
    tenantId: string,
    customType: Omit<CustomArtifactType, 'id'>
  ): Promise<CustomArtifactType> {
    const config = await this.getTenantConfig(tenantId);
    const newType: CustomArtifactType = {
      ...customType,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    await this.updateTenantConfig(tenantId, {
      generationConfig: {
        ...config.generationConfig,
        customArtifactTypes: [
          ...(config.generationConfig.customArtifactTypes || []),
          newType,
        ],
      },
    });

    return newType;
  }

  /**
   * Remove a custom artifact type
   */
  async removeCustomArtifactType(tenantId: string, customTypeId: string): Promise<void> {
    const config = await this.getTenantConfig(tenantId);
    
    await this.updateTenantConfig(tenantId, {
      generationConfig: {
        ...config.generationConfig,
        customArtifactTypes: (config.generationConfig.customArtifactTypes || [])
          .filter(ct => ct.id !== customTypeId),
      },
    });
  }

  /**
   * Get generation config with tenant overrides applied
   */
  async getGenerationConfig(tenantId: string): Promise<ArtifactGenerationConfig> {
    const config = await this.getTenantConfig(tenantId);
    return {
      ...DEFAULT_GENERATION_CONFIG,
      ...config.generationConfig,
    };
  }

  /**
   * Update generation settings
   */
  async updateGenerationSettings(
    tenantId: string,
    settings: Partial<ArtifactGenerationConfig>
  ): Promise<ArtifactGenerationConfig> {
    const config = await this.getTenantConfig(tenantId);
    
    await this.updateTenantConfig(tenantId, {
      generationConfig: {
        ...config.generationConfig,
        ...settings,
      },
    });

    return this.getGenerationConfig(tenantId);
  }

  /**
   * Get default artifact types as a map
   */
  private getDefaultArtifactTypesMap(): Record<ArtifactType, Partial<ArtifactTypeConfig>> {
    return DEFAULT_ARTIFACT_TYPES.reduce((acc, type) => {
      acc[type.type] = { enabled: type.enabled };
      return acc;
    }, {} as Record<ArtifactType, Partial<ArtifactTypeConfig>>);
  }

  /**
   * Reset tenant config to defaults
   */
  async resetToDefaults(tenantId: string): Promise<void> {
    await this.updateTenantConfig(tenantId, {
      artifactTypes: this.getDefaultArtifactTypesMap(),
      generationConfig: DEFAULT_GENERATION_CONFIG,
    });
  }

  /**
   * Validate artifact type exists
   */
  isValidArtifactType(type: string): type is ArtifactType {
    return DEFAULT_ARTIFACT_TYPES.some(t => t.type === type) || type === 'CUSTOM';
  }

  /**
   * Get artifact type metadata
   */
  getArtifactTypeMeta(type: ArtifactType): ArtifactTypeConfig | undefined {
    return DEFAULT_ARTIFACT_TYPES.find(t => t.type === type);
  }
}

// Export singleton instance
export const artifactConfigService = ArtifactConfigService.getInstance();

// Export convenience functions
export const getTenantArtifactConfig = (tenantId: string) =>
  artifactConfigService.getTenantConfig(tenantId);

export const getEnabledArtifactTypes = (tenantId: string) =>
  artifactConfigService.getEnabledArtifactTypes(tenantId);

export const getArtifactGenerationConfig = (tenantId: string) =>
  artifactConfigService.getGenerationConfig(tenantId);
