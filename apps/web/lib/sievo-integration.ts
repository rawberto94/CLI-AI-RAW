// Sievo Integration Connector for Spend Intelligence
// Integrates category spend data for cross-analysis with contracts

export interface SievoSpendData {
  category: string;
  subcategory: string;
  supplier: string;
  amount: number;
  currency: string;
  period: DateRange;
  transactionCount: number;
  averageTransactionSize: number;
  geography: string;
  businessUnit: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SpendAnalysis {
  totalSpend: number;
  categoryBreakdown: CategorySpend[];
  supplierConcentration: SupplierConcentration[];
  spendTrends: SpendTrend[];
  opportunities: SpendOpportunity[];
}

export interface CategorySpend {
  category: string;
  totalAmount: number;
  percentage: number;
  supplierCount: number;
  averageContractValue: number;
  topSuppliers: string[];
}

export interface SupplierConcentration {
  supplier: string;
  totalSpend: number;
  percentage: number;
  categories: string[];
  riskLevel: 'Low' | 'Medium' | 'High';
}

export interface SpendTrend {
  period: string;
  amount: number;
  growth: number;
  seasonality: number;
}

export interface SpendOpportunity {
  type: 'Consolidation' | 'Bundling' | 'Renegotiation' | 'Alternative Sourcing';
  description: string;
  category: string;
  currentSpend: number;
  potentialSavings: number;
  confidence: number;
  implementation: string;
}

export class SievoIntegrationService {
  private apiEndpoint: string;
  private apiKey: string;
  private categoryMapping: Map<string, string>;

  constructor(apiEndpoint?: string, apiKey?: string) {
    this.apiEndpoint = apiEndpoint || process.env.SIEVO_API_ENDPOINT || 'https://api.sievo.com/v1';
    this.apiKey = apiKey || process.env.SIEVO_API_KEY || '';
    this.initializeCategoryMapping();
  }

  /**
   * Fetch spend data from Sievo API
   */
  async fetchSpendData(
    dateRange: DateRange,
    categories?: string[],
    suppliers?: string[]
  ): Promise<SievoSpendData[]> {
    if (!this.apiKey) {
      console.warn('Sievo API key not configured, using mock data');
      return this.generateMockSpendData(dateRange, categories, suppliers);
    }

    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate.toISOString().split('T')[0],
        endDate: dateRange.endDate.toISOString().split('T')[0],
        ...(categories && { categories: categories.join(',') }),
        ...(suppliers && { suppliers: suppliers.join(',') })
      });

      const response = await fetch(`${this.apiEndpoint}/spend-data?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Sievo API error: ${response.status}`);
      }

      const data = await response.json();
      return this.transformSievoData(data);
    } catch (error) {
      console.error('Sievo API fetch failed:', error);
      return this.generateMockSpendData(dateRange, categories, suppliers);
    }
  }

  /**
   * Analyze spend data for insights and opportunities
   */
  analyzeSpendData(spendData: SievoSpendData[]): SpendAnalysis {
    const totalSpend = spendData.reduce((sum, item) => sum + item.amount, 0);
    
    // Category breakdown
    const categoryMap = new Map<string, CategorySpend>();
    spendData.forEach(item => {
      const existing = categoryMap.get(item.category) || {
        category: item.category,
        totalAmount: 0,
        percentage: 0,
        supplierCount: 0,
        averageContractValue: 0,
        topSuppliers: []
      };
      
      existing.totalAmount += item.amount;
      if (!existing.topSuppliers.includes(item.supplier)) {
        existing.topSuppliers.push(item.supplier);
      }
      
      categoryMap.set(item.category, existing);
    });

    const categoryBreakdown = Array.from(categoryMap.values()).map(cat => ({
      ...cat,
      percentage: (cat.totalAmount / totalSpend) * 100,
      supplierCount: cat.topSuppliers.length,
      averageContractValue: cat.totalAmount / cat.supplierCount,
      topSuppliers: cat.topSuppliers.slice(0, 5)
    }));

    // Supplier concentration
    const supplierMap = new Map<string, SupplierConcentration>();
    spendData.forEach(item => {
      const existing = supplierMap.get(item.supplier) || {
        supplier: item.supplier,
        totalSpend: 0,
        percentage: 0,
        categories: [],
        riskLevel: 'Low' as const
      };
      
      existing.totalSpend += item.amount;
      if (!existing.categories.includes(item.category)) {
        existing.categories.push(item.category);
      }
      
      supplierMap.set(item.supplier, existing);
    });

    const supplierConcentration = Array.from(supplierMap.values()).map(sup => ({
      ...sup,
      percentage: (sup.totalSpend / totalSpend) * 100,
      riskLevel: sup.percentage > 30 ? 'High' as const : 
                 sup.percentage > 15 ? 'Medium' as const : 'Low' as const
    }));

    // Generate spend trends (mock for demo)
    const spendTrends = this.generateSpendTrends(spendData);
    
    // Identify opportunities
    const opportunities = this.identifySpendOpportunities(categoryBreakdown, supplierConcentration);

    return {
      totalSpend,
      categoryBreakdown,
      supplierConcentration,
      spendTrends,
      opportunities
    };
  }

  /**
   * Map Sievo categories to contract categories
   */
  mapToContractCategory(sievoCategory: string): string {
    return this.categoryMapping.get(sievoCategory.toLowerCase()) || sievoCategory;
  }

  /**
   * Generate cross-analysis between spend and contracts
   */
  performCrossAnalysis(
    spendData: SievoSpendData[],
    contractData: any[]
  ): {
    alignedSpend: number;
    unalignedSpend: number;
    contractCoverage: number;
    opportunities: SpendOpportunity[];
  } {
    const spendAnalysis = this.analyzeSpendData(spendData);
    const totalSpend = spendAnalysis.totalSpend;
    
    // Calculate alignment between spend and contracts
    let alignedSpend = 0;
    let contractCoverage = 0;
    
    spendAnalysis.categoryBreakdown.forEach(category => {
      const hasContract = contractData.some(contract => 
        contract.category === this.mapToContractCategory(category.category)
      );
      
      if (hasContract) {
        alignedSpend += category.totalAmount;
        contractCoverage += 1;
      }
    });

    const unalignedSpend = totalSpend - alignedSpend;
    contractCoverage = (contractCoverage / spendAnalysis.categoryBreakdown.length) * 100;

    // Identify cross-analysis opportunities
    const opportunities: SpendOpportunity[] = [
      ...spendAnalysis.opportunities,
      ...this.identifyContractGaps(spendData, contractData)
    ];

    return {
      alignedSpend,
      unalignedSpend,
      contractCoverage,
      opportunities
    };
  }

  /**
   * Transform Sievo API response to internal format
   */
  private transformSievoData(apiData: any[]): SievoSpendData[] {
    return apiData.map(item => ({
      category: item.category || 'Unknown',
      subcategory: item.subcategory || '',
      supplier: item.supplier || 'Unknown',
      amount: parseFloat(item.amount) || 0,
      currency: item.currency || 'USD',
      period: {
        startDate: new Date(item.startDate),
        endDate: new Date(item.endDate)
      },
      transactionCount: parseInt(item.transactionCount) || 1,
      averageTransactionSize: parseFloat(item.averageTransactionSize) || 0,
      geography: item.geography || 'Global',
      businessUnit: item.businessUnit || 'Corporate'
    }));
  }

  /**
   * Generate mock spend data for demo purposes
   */
  private generateMockSpendData(
    dateRange: DateRange,
    categories?: string[],
    suppliers?: string[]
  ): SievoSpendData[] {
    const mockData: SievoSpendData[] = [
      {
        category: 'Professional Services',
        subcategory: 'IT Consulting',
        supplier: 'TechConsult Inc',
        amount: 750000,
        currency: 'USD',
        period: dateRange,
        transactionCount: 12,
        averageTransactionSize: 62500,
        geography: 'North America',
        businessUnit: 'Technology'
      },
      {
        category: 'Software Licenses',
        subcategory: 'Enterprise Software',
        supplier: 'SoftwareCorp',
        amount: 450000,
        currency: 'USD',
        period: dateRange,
        transactionCount: 4,
        averageTransactionSize: 112500,
        geography: 'Global',
        businessUnit: 'Technology'
      },
      {
        category: 'Infrastructure Services',
        subcategory: 'Cloud Services',
        supplier: 'CloudProvider Ltd',
        amount: 320000,
        currency: 'USD',
        period: dateRange,
        transactionCount: 24,
        averageTransactionSize: 13333,
        geography: 'Global',
        businessUnit: 'Technology'
      },
      {
        category: 'Professional Services',
        subcategory: 'Management Consulting',
        supplier: 'StrategyFirm LLC',
        amount: 280000,
        currency: 'USD',
        period: dateRange,
        transactionCount: 6,
        averageTransactionSize: 46667,
        geography: 'North America',
        businessUnit: 'Corporate'
      },
      {
        category: 'Facilities Management',
        subcategory: 'Office Services',
        supplier: 'FacilitiesCorp',
        amount: 180000,
        currency: 'USD',
        period: dateRange,
        transactionCount: 12,
        averageTransactionSize: 15000,
        geography: 'North America',
        businessUnit: 'Operations'
      }
    ];

    // Filter by categories if specified
    if (categories && categories.length > 0) {
      return mockData.filter(item => categories.includes(item.category));
    }

    // Filter by suppliers if specified
    if (suppliers && suppliers.length > 0) {
      return mockData.filter(item => suppliers.includes(item.supplier));
    }

    return mockData;
  }

  /**
   * Generate spend trends analysis
   */
  private generateSpendTrends(spendData: SievoSpendData[]): SpendTrend[] {
    // Mock trend data for demo
    return [
      { period: '2024-Q1', amount: 500000, growth: 5.2, seasonality: 0.95 },
      { period: '2024-Q2', amount: 525000, growth: 8.1, seasonality: 1.02 },
      { period: '2024-Q3', amount: 540000, growth: 6.8, seasonality: 1.05 },
      { period: '2024-Q4', amount: 515000, growth: 3.2, seasonality: 0.98 }
    ];
  }

  /**
   * Identify spend optimization opportunities
   */
  private identifySpendOpportunities(
    categories: CategorySpend[],
    suppliers: SupplierConcentration[]
  ): SpendOpportunity[] {
    const opportunities: SpendOpportunity[] = [];

    // Supplier consolidation opportunities
    const fragmentedCategories = categories.filter(cat => cat.supplierCount > 3);
    fragmentedCategories.forEach(category => {
      opportunities.push({
        type: 'Consolidation',
        description: `Consolidate ${category.supplierCount} suppliers in ${category.category}`,
        category: category.category,
        currentSpend: category.totalAmount,
        potentialSavings: category.totalAmount * 0.15, // 15% savings
        confidence: 0.8,
        implementation: 'Supplier consolidation project (6-9 months)'
      });
    });

    // Volume bundling opportunities
    const highSpendCategories = categories.filter(cat => cat.totalAmount > 300000);
    highSpendCategories.forEach(category => {
      opportunities.push({
        type: 'Bundling',
        description: `Volume bundling opportunity in ${category.category}`,
        category: category.category,
        currentSpend: category.totalAmount,
        potentialSavings: category.totalAmount * 0.08, // 8% savings
        confidence: 0.9,
        implementation: 'Volume commitment negotiation (2-3 months)'
      });
    });

    // High concentration risk mitigation
    const highRiskSuppliers = suppliers.filter(sup => sup.riskLevel === 'High');
    highRiskSuppliers.forEach(supplier => {
      opportunities.push({
        type: 'Alternative Sourcing',
        description: `Reduce dependency on ${supplier.supplier} (${supplier.percentage.toFixed(1)}% of spend)`,
        category: supplier.categories[0],
        currentSpend: supplier.totalSpend,
        potentialSavings: supplier.totalSpend * 0.12, // 12% savings
        confidence: 0.7,
        implementation: 'Alternative supplier development (9-12 months)'
      });
    });

    return opportunities.sort((a, b) => b.potentialSavings - a.potentialSavings);
  }

  /**
   * Identify gaps between spend and contracts
   */
  private identifyContractGaps(
    spendData: SievoSpendData[],
    contractData: any[]
  ): SpendOpportunity[] {
    const opportunities: SpendOpportunity[] = [];
    
    // Find spend without corresponding contracts
    const spendByCategory = new Map<string, number>();
    spendData.forEach(item => {
      const mapped = this.mapToContractCategory(item.category);
      spendByCategory.set(mapped, (spendByCategory.get(mapped) || 0) + item.amount);
    });

    const contractCategories = new Set(contractData.map(c => c.category));
    
    spendByCategory.forEach((amount, category) => {
      if (!contractCategories.has(category) && amount > 50000) {
        opportunities.push({
          type: 'Renegotiation',
          description: `No contract coverage for ${category} spend`,
          category,
          currentSpend: amount,
          potentialSavings: amount * 0.10, // 10% savings with proper contract
          confidence: 0.85,
          implementation: 'Contract negotiation and setup (3-4 months)'
        });
      }
    });

    return opportunities;
  }

  /**
   * Initialize category mapping between Sievo and contract categories
   */
  private initializeCategoryMapping(): void {
    this.categoryMapping = new Map([
      ['professional services', 'Professional Services'],
      ['it consulting', 'Professional Services'],
      ['management consulting', 'Professional Services'],
      ['software licenses', 'Software Licenses'],
      ['enterprise software', 'Software Licenses'],
      ['saas', 'Software Licenses'],
      ['infrastructure services', 'Infrastructure'],
      ['cloud services', 'Infrastructure'],
      ['hosting', 'Infrastructure'],
      ['facilities management', 'Facilities'],
      ['office services', 'Facilities'],
      ['maintenance', 'Maintenance'],
      ['support services', 'Support'],
      ['travel', 'Travel'],
      ['marketing', 'Marketing'],
      ['legal services', 'Legal'],
      ['hr services', 'Human Resources']
    ]);
  }

  /**
   * Update API configuration
   */
  updateConfiguration(apiEndpoint: string, apiKey: string): void {
    this.apiEndpoint = apiEndpoint;
    this.apiKey = apiKey;
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.apiKey) {
      return { success: false, message: 'API key not configured' };
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return { success: true, message: 'Connection successful' };
      } else {
        return { success: false, message: `API error: ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }
}

// Export singleton instance
export const sieveIntegration = new SievoIntegrationService();

// Utility functions
export function calculateSpendConcentration(spendData: SievoSpendData[]): {
  herfindahlIndex: number;
  top3Concentration: number;
  riskLevel: 'Low' | 'Medium' | 'High';
} {
  const totalSpend = spendData.reduce((sum, item) => sum + item.amount, 0);
  const supplierShares = new Map<string, number>();
  
  spendData.forEach(item => {
    const share = item.amount / totalSpend;
    supplierShares.set(item.supplier, (supplierShares.get(item.supplier) || 0) + share);
  });

  // Calculate Herfindahl-Hirschman Index
  const herfindahlIndex = Array.from(supplierShares.values())
    .reduce((sum, share) => sum + (share * share), 0) * 10000;

  // Calculate top 3 concentration
  const sortedShares = Array.from(supplierShares.values()).sort((a, b) => b - a);
  const top3Concentration = sortedShares.slice(0, 3).reduce((sum, share) => sum + share, 0) * 100;

  // Determine risk level
  const riskLevel = herfindahlIndex > 2500 ? 'High' : herfindahlIndex > 1500 ? 'Medium' : 'Low';

  return {
    herfindahlIndex: Math.round(herfindahlIndex),
    top3Concentration: Math.round(top3Concentration * 10) / 10,
    riskLevel
  };
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}