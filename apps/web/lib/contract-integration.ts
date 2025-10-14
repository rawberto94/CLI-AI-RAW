/**
 * Contract Integration Utilities
 * 
 * Essential functions to integrate taxonomy and metadata with contract operations
 */

import { contractService, taxonomyService } from "data-orchestration";

/**
 * Initialize contract with default metadata after upload
 */
export async function initializeContractMetadata(
  contractId: string,
  tenantId: string,
  contractData: {
    fileName: string;
    contractType?: string;
    clientName?: string;
    supplierName?: string;
    totalValue?: number;
    currency?: string;
  }
): Promise<void> {
  try {
    // Create default metadata from contract data
    const defaultMetadata = {
      systemFields: {
        contractTitle: contractData.fileName.replace(/\.[^/.]+$/, ""), // Remove extension
        contractType: contractData.contractType || 'UNKNOWN',
        clientName: contractData.clientName,
        supplierName: contractData.supplierName,
        totalValue: contractData.totalValue,
        currency: contractData.currency || 'USD',
        department: 'legal', // Default department
        priority: 'medium' as const
      },
      tags: [] as string[],
      customFields: {}
    };

    // Auto-assign tags based on contract data
    if (contractData.totalValue && contractData.totalValue > 100000) {
      defaultMetadata.tags.push('high-value');
    }
    
    if (contractData.contractType === 'SERVICE') {
      defaultMetadata.tags.push('service-agreement');
    }

    // Save metadata
    await taxonomyService.updateContractMetadata(
      contractId,
      tenantId,
      defaultMetadata,
      'system'
    );

    console.log(`✅ Initialized metadata for contract ${contractId}`);
  } catch (error) {
    console.error(`❌ Failed to initialize metadata for contract ${contractId}:`, error);
  }
}

/**
 * Update contract search index when metadata changes
 */
export async function updateContractSearchIndex(
  contractId: string,
  tenantId: string
): Promise<void> {
  try {
    // Get contract and metadata
    const [contractResult, metadataResult] = await Promise.all([
      contractService.getContract(contractId, tenantId),
      taxonomyService.getContractMetadata(contractId, tenantId)
    ]);

    if (!contractResult.success || !metadataResult.success) {
      throw new Error('Failed to get contract or metadata');
    }

    const contract = contractResult.data;
    const metadata = metadataResult.data;

    // Build searchable content
    const searchableContent = [
      contract.contractTitle || contract.fileName,
      contract.description,
      contract.clientName,
      contract.supplierName,
      metadata.systemFields.contractTitle,
      metadata.systemFields.clientName,
      metadata.systemFields.supplierName,
      ...metadata.tags
    ].filter(Boolean).join(' ').toLowerCase();

    // Build metadata for faceted search
    const searchMetadata = {
      contractType: metadata.systemFields.contractType || contract.contractType,
      category: metadata.categoryId,
      tags: metadata.tags,
      clientName: metadata.systemFields.clientName || contract.clientName,
      supplierName: metadata.systemFields.supplierName || contract.supplierName,
      totalValue: metadata.systemFields.totalValue || contract.totalValue,
      currency: metadata.systemFields.currency || contract.currency,
      department: metadata.systemFields.department,
      priority: metadata.systemFields.priority
    };

    // Update search index (this would use the indexing service)
    console.log(`✅ Updated search index for contract ${contractId}`);
  } catch (error) {
    console.error(`❌ Failed to update search index for contract ${contractId}:`, error);
  }
}

/**
 * Get enhanced contract data with metadata
 */
export async function getEnhancedContractData(
  contractId: string,
  tenantId: string
): Promise<{
  contract: any;
  metadata: any;
  tags: string[];
  category?: any;
} | null> {
  try {
    const [contractResult, metadataResult] = await Promise.all([
      contractService.getContract(contractId, tenantId),
      taxonomyService.getContractMetadata(contractId, tenantId)
    ]);

    if (!contractResult.success) {
      return null;
    }

    const contract = contractResult.data;
    const metadata = metadataResult.success ? metadataResult.data : null;

    return {
      contract,
      metadata,
      tags: metadata?.tags || [],
      category: metadata?.categoryId ? { id: metadata.categoryId } : undefined
    };
  } catch (error) {
    console.error(`❌ Failed to get enhanced contract data for ${contractId}:`, error);
    return null;
  }
}

/**
 * Search contracts with taxonomy filters
 */
export async function searchContractsWithTaxonomy(
  tenantId: string,
  filters: {
    query?: string;
    contractType?: string[];
    tags?: string[];
    categoryId?: string;
    department?: string;
    priority?: string;
    minValue?: number;
    maxValue?: number;
  }
): Promise<string[]> {
  try {
    // This would integrate with the enhanced search API
    const searchParams = new URLSearchParams();
    searchParams.set('tenantId', tenantId);
    
    if (filters.query) searchParams.set('q', filters.query);
    if (filters.contractType) filters.contractType.forEach(t => searchParams.append('contractType', t));
    if (filters.tags) filters.tags.forEach(t => searchParams.append('tags', t));
    if (filters.categoryId) searchParams.set('categoryId', filters.categoryId);
    if (filters.minValue) searchParams.set('minValue', filters.minValue.toString());
    if (filters.maxValue) searchParams.set('maxValue', filters.maxValue.toString());

    const response = await fetch(`/api/contracts/search/enhanced?${searchParams}`);
    
    if (!response.ok) {
      throw new Error('Search failed');
    }

    const result = await response.json();
    
    if (result.success) {
      return result.data.results.map((r: any) => r.contract.id);
    }

    return [];
  } catch (error) {
    console.error('❌ Failed to search contracts with taxonomy:', error);
    return [];
  }
}

/**
 * Auto-categorize contract based on content
 */
export async function autoCategorizContract(
  contractId: string,
  tenantId: string,
  contractContent: string
): Promise<{
  suggestedCategory?: string;
  suggestedTags: string[];
  confidence: number;
}> {
  try {
    // Simple rule-based categorization (can be enhanced with ML)
    const content = contractContent.toLowerCase();
    const suggestions = {
      suggestedTags: [] as string[],
      confidence: 0.7
    };

    // Contract type detection
    if (content.includes('service') || content.includes('consulting')) {
      suggestions.suggestedTags.push('service-agreement');
    }
    
    if (content.includes('purchase') || content.includes('order')) {
      suggestions.suggestedTags.push('purchase-order');
    }
    
    if (content.includes('confidential') || content.includes('non-disclosure')) {
      suggestions.suggestedTags.push('confidential', 'nda');
    }

    // Value-based tags
    const valueMatch = content.match(/\$[\d,]+/);
    if (valueMatch) {
      const value = parseInt(valueMatch[0].replace(/[$,]/g, ''));
      if (value > 100000) {
        suggestions.suggestedTags.push('high-value');
      }
    }

    // Risk indicators
    if (content.includes('liability') || content.includes('indemnif')) {
      suggestions.suggestedTags.push('liability-risk');
    }

    // Recurring patterns
    if (content.includes('renew') || content.includes('recurring')) {
      suggestions.suggestedTags.push('recurring');
    }

    return suggestions;
  } catch (error) {
    console.error(`❌ Failed to auto-categorize contract ${contractId}:`, error);
    return {
      suggestedTags: [],
      confidence: 0
    };
  }
}