// Supplier Trend Analyzer Service - Stub implementation
export class SupplierTrendAnalyzerService {
  constructor(private prisma: any) {}
  
  async analyzeTrends(supplierId: string) {
    return { supplierId, trends: [] };
  }
}

// Singleton instance
let instance: SupplierTrendAnalyzerService | null = null;

export function getSupplierTrendAnalyzerService(prisma: any): SupplierTrendAnalyzerService {
  if (!instance) {
    instance = new SupplierTrendAnalyzerService(prisma);
  }
  return instance;
}

export const supplierTrendAnalyzerService = null; // Will be initialized at runtime
