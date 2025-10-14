/**
 * Analytical Intelligence Service
 * Frontend service that interfaces with the data orchestration layer
 */

class AnalyticalIntelligenceService {
  private baseUrl = '/api/data-orchestration/analytical-intelligence';

  // Overview and Health
  async getOverview(tenantId: string, engines: string[] = ['all']) {
    const response = await fetch(`${this.baseUrl}/overview?tenantId=${tenantId}&engines=${engines.join(',')}`);
    if (!response.ok) throw new Error('Failed to get analytical intelligence overview');
    return response.json();
  }

  async getDashboardData(tenantId: string = 'default', refresh: boolean = false) {
    const response = await fetch(`/api/analytics/dashboard?tenantId=${tenantId}&refresh=${refresh}`);
    if (!response.ok) throw new Error('Failed to get dashboard data');
    const result = await response.json();
    return result.success ? result.data : null;
  }

  async healthCheck(detailed: boolean = false) {
    try {
      // Mock health check - in production would call actual services
      const engines = {
        'rate-benchmarking': { status: 'healthy', responseTime: 45 },
        'renewal-radar': { status: 'healthy', responseTime: 32 },
        'compliance': { status: 'healthy', responseTime: 67 },
        'supplier-snapshot': { status: 'healthy', responseTime: 89 },
        'spend-overlay': { status: 'healthy', responseTime: 56 },
        'natural-language-query': { status: 'healthy', responseTime: 123 }
      };

      const overall = Object.values(engines).every(e => e.status === 'healthy');

      return {
        overall,
        engines: detailed ? engines : undefined,
        database: { status: 'healthy', responseTime: 23 },
        cache: { status: 'healthy', responseTime: 12 },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        overall: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // Rate Benchmarking
  async getRateBenchmarks(filters: any) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${this.baseUrl}/rate-benchmarking?${params}`);
    if (!response.ok) throw new Error('Failed to get rate benchmarks');
    return response.json();
  }

  async parseRateCard(contractId: string) {
    const response = await fetch(`${this.baseUrl}/rate-benchmarking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parse_contract', contractId })
    });
    if (!response.ok) throw new Error('Failed to parse rate card');
    return response.json();
  }

  async calculateBenchmarks(cohort: any, rates: any[]) {
    const response = await fetch(`${this.baseUrl}/rate-benchmarking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'calculate_benchmarks', cohort, rates })
    });
    if (!response.ok) throw new Error('Failed to calculate benchmarks');
    return response.json();
  }

  async estimateSavings(currentRates: any[], benchmarks: any) {
    const response = await fetch(`${this.baseUrl}/rate-benchmarking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'estimate_savings', currentRates, benchmarks })
    });
    if (!response.ok) throw new Error('Failed to estimate savings');
    return response.json();
  }

  // Renewal Radar
  async getRenewalCalendar(filters: any) {
    const params = new URLSearchParams({ ...filters, view: 'calendar' });
    const response = await fetch(`${this.baseUrl}/renewal-radar?${params}`);
    if (!response.ok) throw new Error('Failed to get renewal calendar');
    return response.json();
  }

  async getRenewalAlerts(filters: any) {
    const params = new URLSearchParams({ ...filters, view: 'alerts' });
    const response = await fetch(`${this.baseUrl}/renewal-radar?${params}`);
    if (!response.ok) throw new Error('Failed to get renewal alerts');
    return response.json();
  }

  async getRenewalTimeline(filters: any) {
    const params = new URLSearchParams({ ...filters, view: 'timeline' });
    const response = await fetch(`${this.baseUrl}/renewal-radar?${params}`);
    if (!response.ok) throw new Error('Failed to get renewal timeline');
    return response.json();
  }

  async extractRenewalData(contractId: string) {
    const response = await fetch(`${this.baseUrl}/renewal-radar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'extract_renewal_data', contractId })
    });
    if (!response.ok) throw new Error('Failed to extract renewal data');
    return response.json();
  }

  async scheduleRenewalAlerts(renewalData: any) {
    const response = await fetch(`${this.baseUrl}/renewal-radar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'schedule_alerts', renewalData })
    });
    if (!response.ok) throw new Error('Failed to schedule renewal alerts');
    return response.json();
  }

  async acknowledgeAlert(alertId: string, userId: string) {
    const response = await fetch(`${this.baseUrl}/renewal-radar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'acknowledge_alert', alertId, userId })
    });
    if (!response.ok) throw new Error('Failed to acknowledge alert');
    return response.json();
  }

  async triggerRfxGeneration(contractId: string) {
    const response = await fetch(`${this.baseUrl}/renewal-radar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trigger_rfx', contractId })
    });
    if (!response.ok) throw new Error('Failed to trigger RFx generation');
    return response.json();
  }

  // Compliance
  async getContractCompliance(contractId: string) {
    const response = await fetch(`${this.baseUrl}/compliance?contractId=${contractId}`);
    if (!response.ok) throw new Error('Failed to get contract compliance');
    return response.json();
  }

  async getComplianceSummary(filters: any) {
    const params = new URLSearchParams({ ...filters, reportType: 'summary' });
    const response = await fetch(`${this.baseUrl}/compliance?${params}`);
    if (!response.ok) throw new Error('Failed to get compliance summary');
    return response.json();
  }

  async getComplianceReport(filters: any) {
    const params = new URLSearchParams({ ...filters, reportType: 'detailed' });
    const response = await fetch(`${this.baseUrl}/compliance?${params}`);
    if (!response.ok) throw new Error('Failed to get compliance report');
    return response.json();
  }

  async getComplianceTrends(filters: any) {
    const params = new URLSearchParams({ ...filters, reportType: 'trends' });
    const response = await fetch(`${this.baseUrl}/compliance?${params}`);
    if (!response.ok) throw new Error('Failed to get compliance trends');
    return response.json();
  }

  async scanContractCompliance(contractId: string) {
    const response = await fetch(`${this.baseUrl}/compliance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'scan_contract', contractId })
    });
    if (!response.ok) throw new Error('Failed to scan contract compliance');
    return response.json();
  }

  async updateCompliancePolicies(policies: any[]) {
    const response = await fetch(`${this.baseUrl}/compliance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_policies', policies })
    });
    if (!response.ok) throw new Error('Failed to update compliance policies');
    return response.json();
  }

  async generateRemediationPlan(complianceResult: any) {
    const response = await fetch(`${this.baseUrl}/compliance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_remediation', complianceResult })
    });
    if (!response.ok) throw new Error('Failed to generate remediation plan');
    return response.json();
  }

  async bulkComplianceScan(contractIds: string[]) {
    const response = await fetch(`${this.baseUrl}/compliance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_scan', contractIds })
    });
    if (!response.ok) throw new Error('Failed to perform bulk compliance scan');
    return response.json();
  }

  // Supplier Snapshot
  async getSupplierProfile(supplierId: string, includeExternal: boolean = false) {
    const params = new URLSearchParams({ 
      supplierId, 
      includeExternal: includeExternal.toString(),
      view: 'profile' 
    });
    const response = await fetch(`${this.baseUrl}/supplier-snapshot?${params}`);
    if (!response.ok) throw new Error('Failed to get supplier profile');
    return response.json();
  }

  async getSupplierExecutiveSummary(supplierId: string) {
    const params = new URLSearchParams({ supplierId, view: 'summary' });
    const response = await fetch(`${this.baseUrl}/supplier-snapshot?${params}`);
    if (!response.ok) throw new Error('Failed to get supplier executive summary');
    return response.json();
  }

  async compareSuppliers(supplierIds: string[]) {
    const params = new URLSearchParams({ 
      supplierIds: supplierIds.join(','),
      view: 'comparison' 
    });
    const response = await fetch(`${this.baseUrl}/supplier-snapshot?${params}`);
    if (!response.ok) throw new Error('Failed to compare suppliers');
    return response.json();
  }

  async getSupplierMetrics(supplierId: string) {
    const params = new URLSearchParams({ supplierId, view: 'metrics' });
    const response = await fetch(`${this.baseUrl}/supplier-snapshot?${params}`);
    if (!response.ok) throw new Error('Failed to get supplier metrics');
    return response.json();
  }

  async aggregateSupplierData(supplierId: string) {
    const response = await fetch(`${this.baseUrl}/supplier-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'aggregate_data', supplierId })
    });
    if (!response.ok) throw new Error('Failed to aggregate supplier data');
    return response.json();
  }

  async integrateExternalSupplierData(supplierId: string) {
    const response = await fetch(`${this.baseUrl}/supplier-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'integrate_external', supplierId })
    });
    if (!response.ok) throw new Error('Failed to integrate external supplier data');
    return response.json();
  }

  async calculateSupplierMetrics(profile: any) {
    const response = await fetch(`${this.baseUrl}/supplier-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'calculate_metrics', profile })
    });
    if (!response.ok) throw new Error('Failed to calculate supplier metrics');
    return response.json();
  }

  async generateSupplierExecutiveSummary(profile: any) {
    const response = await fetch(`${this.baseUrl}/supplier-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate_summary', profile })
    });
    if (!response.ok) throw new Error('Failed to generate supplier executive summary');
    return response.json();
  }

  async refreshSupplierIntelligence(supplierIds: string[]) {
    const response = await fetch(`${this.baseUrl}/supplier-snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh_all', supplierIds })
    });
    if (!response.ok) throw new Error('Failed to refresh supplier intelligence');
    return response.json();
  }

  // Spend Overlay
  async getSpendSummary(filters: any) {
    const params = new URLSearchParams({ ...filters, view: 'summary' });
    const response = await fetch(`${this.baseUrl}/spend-overlay?${params}`);
    if (!response.ok) throw new Error('Failed to get spend summary');
    return response.json();
  }

  async getSpendVarianceAnalysis(filters: any) {
    const params = new URLSearchParams({ ...filters, view: 'variance' });
    const response = await fetch(`${this.baseUrl}/spend-overlay?${params}`);
    if (!response.ok) throw new Error('Failed to get spend variance analysis');
    return response.json();
  }

  async getSupplierEfficiency(supplierId: string) {
    const params = new URLSearchParams({ supplierId, view: 'efficiency' });
    const response = await fetch(`${this.baseUrl}/spend-overlay?${params}`);
    if (!response.ok) throw new Error('Failed to get supplier efficiency');
    return response.json();
  }

  async getSpendMappingStatus(filters: any) {
    const params = new URLSearchParams({ ...filters, view: 'mapping' });
    const response = await fetch(`${this.baseUrl}/spend-overlay?${params}`);
    if (!response.ok) throw new Error('Failed to get spend mapping status');
    return response.json();
  }

  async generateSpendReport(filters: any) {
    const params = new URLSearchParams({ ...filters, view: 'report' });
    const response = await fetch(`${this.baseUrl}/spend-overlay?${params}`);
    if (!response.ok) throw new Error('Failed to generate spend report');
    return response.json();
  }

  async integrateSpendData(source: any) {
    const response = await fetch(`${this.baseUrl}/spend-overlay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'integrate_spend', source })
    });
    if (!response.ok) throw new Error('Failed to integrate spend data');
    return response.json();
  }

  async mapSpendToContracts(spendData: any[]) {
    const response = await fetch(`${this.baseUrl}/spend-overlay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'map_spend', spendData })
    });
    if (!response.ok) throw new Error('Failed to map spend to contracts');
    return response.json();
  }

  async analyzeSpendVariances(mappings: any[]) {
    const response = await fetch(`${this.baseUrl}/spend-overlay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'analyze_variance', mappings })
    });
    if (!response.ok) throw new Error('Failed to analyze spend variances');
    return response.json();
  }

  async calculateSupplierEfficiency(supplierId: string) {
    const response = await fetch(`${this.baseUrl}/spend-overlay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'calculate_efficiency', supplierId })
    });
    if (!response.ok) throw new Error('Failed to calculate supplier efficiency');
    return response.json();
  }

  async syncExternalSpendData(sources: string[]) {
    const response = await fetch(`${this.baseUrl}/spend-overlay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_external', sources })
    });
    if (!response.ok) throw new Error('Failed to sync external spend data');
    return response.json();
  }

  async refreshSpendMappings(tenantId: string) {
    const response = await fetch(`${this.baseUrl}/spend-overlay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh_mappings', tenantId })
    });
    if (!response.ok) throw new Error('Failed to refresh spend mappings');
    return response.json();
  }

  // Natural Language Query
  async processNaturalLanguageQuery(query: string, context: any) {
    const response = await fetch('/api/analytics/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context })
    });
    if (!response.ok) throw new Error('Failed to process natural language query');
    const result = await response.json();
    return result.success ? result.data : null;
  }

  async getQueryHistory(filters: any) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${this.baseUrl}/query/history?${params}`);
    if (!response.ok) throw new Error('Failed to get query history');
    return response.json();
  }

  // Batch Operations
  async refreshAllEngines(tenantId: string) {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh_all', parameters: { tenantId } })
    });
    if (!response.ok) throw new Error('Failed to refresh all engines');
    return response.json();
  }

  async processContract(contractId: string) {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'process_contract', parameters: { contractId } })
    });
    if (!response.ok) throw new Error('Failed to process contract');
    return response.json();
  }

  async updateBenchmarks(tenantId: string) {
    const response = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_benchmarks', parameters: { tenantId } })
    });
    if (!response.ok) throw new Error('Failed to update benchmarks');
    return response.json();
  }

  // Real-time Streaming
  createEventStream(tenantId: string, engines: string[] = ['all']) {
    const params = new URLSearchParams({ 
      tenantId, 
      engines: engines.join(',') 
    });
    
    return new EventSource(`/api/analytics/intelligence/stream?${params}`);
  }
}

export const analyticalIntelligenceService = new AnalyticalIntelligenceService();