/**
 * Enhanced Financial Analysis Worker
 * Extracts and analyzes financial terms, tables, and rate cards from SOW contracts
 */

export interface ContractData {
  id: string;
  content: string;
  metadata?: {
    filename?: string;
    fileSize?: number;
    mimeType?: string;
  };
}

export interface FinancialTable {
  id: string;
  title: string;
  type: TableType;
  headers: string[];
  rows: Record<string, any>[];
  metadata: TableMetadata;
  confidence: number;
}

export interface RateCard {
  id: string;
  title: string;
  currency: string;
  effectiveDate: string;
  rates: RateEntry[];
  metadata: RateCardMetadata;
  insights?: RateCardInsights;
}

export interface RateEntry {
  role: string;
  level: string;
  hourlyRate?: number;
  dailyRate?: number;
  monthlyRate?: number;
  category: string;
  description?: string;
  marketBenchmark?: number;
  variance?: number;
  variancePercentage?: string;
  annualSavingsOpportunity?: string;
}

export interface BenchmarkingResult {
  rateCardId: string;
  benchmarkedRates: RateEntry[];
  totalSavingsOpportunity: number;
  averageVariance: number;
  ratesAboveMarket: number;
  ratesBelowMarket: number;
  recommendations: string[];
}

export interface FinancialAnalysisResult {
  totalValue: number;
  currency: string;
  paymentTerms: string;
  paymentSchedule?: {
    frequency: string;
    amount: number;
  };
  penalties: string[];
  extractedTables: FinancialTable[];
  rateCards: RateCard[];
  benchmarkingResults: BenchmarkingResult[];
  insights: FinancialInsights;
  confidence: number;
  metrics: {
    monthlyValue: number;
    annualValue: number;
  };
  error?: string;
}

export interface TableMetadata {
  extractionMethod: 'pattern' | 'ml' | 'hybrid';
  confidence: number;
  pageNumber?: number;
  position: { start: number; end: number };
  warnings?: string[];
}

export interface RateCardMetadata {
  extractionConfidence: number;
  totalRoles: number;
  averageRate: number;
  rateRange: { min: number; max: number };
  lastUpdated: string;
}

export interface RateCardInsights {
  totalAnnualSavings: string;
  averageVariance: string;
  ratesAboveMarket: number;
  ratesBelowMarket: number;
  recommendation: string;
}

export interface FinancialInsights {
  totalPotentialSavings: number;
  highestSavingsOpportunity: {
    role: string;
    amount: number;
  };
  rateAnalysisSummary: {
    totalRoles: number;
    aboveMarketCount: number;
    belowMarketCount: number;
    averageVariance: number;
  };
  recommendations: string[];
  riskFactors: string[];
}

export enum TableType {
  PAYMENT_SCHEDULE = 'payment_schedule',
  EXPENSE_BREAKDOWN = 'expense_breakdown',
  RATE_CARD = 'rate_card',
  MILESTONE_PAYMENTS = 'milestone_payments',
  BUDGET_ALLOCATION = 'budget_allocation'
}

export class EnhancedFinancialWorker {
  private tableExtractionEngine: TableExtractionEngine;
  private rateCardParser: RateCardParser;
  private marketBenchmarkingService: MarketBenchmarkingService;

  constructor() {
    this.tableExtractionEngine = new TableExtractionEngine();
    this.rateCardParser = new RateCardParser();
    this.marketBenchmarkingService = new MarketBenchmarkingService();
  }

  async process(contract: ContractData): Promise<FinancialAnalysisResult> {
    try {
      const text = contract.content ?? '';
      
      // Extract basic financial information
      const totalValue = this.extractTotalValue(text);
      const currency = this.extractCurrency(text);
      const paymentTerms = this.extractPaymentTerms(text);
      const paymentSchedule = this.extractPaymentSchedule(text);
      const penalties = this.extractPenalties(text);

      // Extract financial tables
      const extractedTables = await this.extractTables(text);
      
      // Parse rate cards from extracted tables
      const rateCards = await this.parseRateCards(extractedTables);
      
      // Perform market benchmarking
      const benchmarkingResults = await this.benchmarkRates(rateCards);
      
      // Generate insights
      const insights = this.generateInsights(rateCards, benchmarkingResults);
      
      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(extractedTables, rateCards);

      return {
        totalValue,
        currency,
        paymentTerms,
        paymentSchedule,
        penalties,
        extractedTables,
        rateCards,
        benchmarkingResults,
        insights,
        confidence,
        metrics: {
          monthlyValue: paymentSchedule?.amount ?? totalValue / 12,
          annualValue: totalValue
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        totalValue: 0,
        currency: 'USD',
        paymentTerms: 'Unknown',
        penalties: [],
        extractedTables: [],
        rateCards: [],
        benchmarkingResults: [],
        insights: this.getDefaultInsights(),
        confidence: 0,
        metrics: {
          monthlyValue: 0,
          annualValue: 0
        },
        error: errorMessage
      };
    }
  }

  async extractTables(text: string): Promise<FinancialTable[]> {
    return await this.tableExtractionEngine.extractTables(text);
  }

  async parseRateCards(tables: FinancialTable[]): Promise<RateCard[]> {
    const rateCardTables = tables.filter(table => 
      table.type === TableType.RATE_CARD || 
      this.isLikelyRateCard(table)
    );

    const rateCards: RateCard[] = [];
    for (const table of rateCardTables) {
      try {
        const rateCard = await this.rateCardParser.parseRateCard(table);
        rateCards.push(rateCard);
      } catch (error) {
        console.warn(`Failed to parse rate card from table ${table.id}:`, error);
      }
    }

    return rateCards;
  }

  async benchmarkRates(rateCards: RateCard[]): Promise<BenchmarkingResult[]> {
    const results: BenchmarkingResult[] = [];
    
    for (const rateCard of rateCards) {
      try {
        const benchmarkResult = await this.marketBenchmarkingService.benchmarkRateCard(rateCard);
        results.push(benchmarkResult);
      } catch (error) {
        console.warn(`Failed to benchmark rate card ${rateCard.id}:`, error);
      }
    }

    return results;
  }

  private isLikelyRateCard(table: FinancialTable): boolean {
    const headers = table.headers.map(h => h.toLowerCase());
    const rateIndicators = ['rate', 'hourly', 'daily', 'role', 'position', 'cost', 'price'];
    return rateIndicators.some(indicator => 
      headers.some(header => header.includes(indicator))
    );
  }

  private generateInsights(rateCards: RateCard[], benchmarkingResults: BenchmarkingResult[]): FinancialInsights {
    const totalRoles = rateCards.reduce((sum, rc) => sum + rc.rates.length, 0);
    const totalSavings = benchmarkingResults.reduce((sum, br) => sum + br.totalSavingsOpportunity, 0);
    
    let highestSavingsOpportunity = { role: 'N/A', amount: 0 };
    let aboveMarketCount = 0;
    let belowMarketCount = 0;
    let totalVariance = 0;

    benchmarkingResults.forEach(result => {
      aboveMarketCount += result.ratesAboveMarket;
      belowMarketCount += result.ratesBelowMarket;
      totalVariance += result.averageVariance;

      result.benchmarkedRates.forEach(rate => {
        const savingsAmount = typeof rate.annualSavingsOpportunity === 'string' && 
                             rate.annualSavingsOpportunity.startsWith('$') 
          ? parseFloat(rate.annualSavingsOpportunity.replace(/[$,]/g, '')) 
          : 0;
        
        if (savingsAmount > highestSavingsOpportunity.amount) {
          highestSavingsOpportunity = {
            role: rate.role,
            amount: savingsAmount
          };
        }
      });
    });

    const averageVariance = benchmarkingResults.length > 0 ? totalVariance / benchmarkingResults.length : 0;

    return {
      totalPotentialSavings: totalSavings,
      highestSavingsOpportunity,
      rateAnalysisSummary: {
        totalRoles,
        aboveMarketCount,
        belowMarketCount,
        averageVariance
      },
      recommendations: this.generateRecommendations(benchmarkingResults),
      riskFactors: this.identifyRiskFactors(rateCards, benchmarkingResults)
    };
  }

  private generateRecommendations(benchmarkingResults: BenchmarkingResult[]): string[] {
    const recommendations: string[] = [];
    
    benchmarkingResults.forEach(result => {
      recommendations.push(...result.recommendations);
    });

    // Add general recommendations
    if (benchmarkingResults.some(r => r.ratesAboveMarket > 0)) {
      recommendations.push('Consider negotiating rates for roles above market average');
    }
    
    if (benchmarkingResults.some(r => r.totalSavingsOpportunity > 50000)) {
      recommendations.push('Significant cost savings opportunity identified - prioritize rate renegotiation');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private identifyRiskFactors(rateCards: RateCard[], benchmarkingResults: BenchmarkingResult[]): string[] {
    const riskFactors: string[] = [];
    
    const totalSavings = benchmarkingResults.reduce((sum, br) => sum + br.totalSavingsOpportunity, 0);
    if (totalSavings > 100000) {
      riskFactors.push('High potential savings may indicate overpriced services');
    }

    const highVarianceRates = benchmarkingResults.filter(r => Math.abs(r.averageVariance) > 20);
    if (highVarianceRates.length > 0) {
      riskFactors.push('Some rates show significant variance from market standards');
    }

    return riskFactors;
  }

  private calculateOverallConfidence(tables: FinancialTable[], rateCards: RateCard[]): number {
    if (tables.length === 0) return 0;
    
    const tableConfidences = tables.map(t => t.confidence);
    const rateCardConfidences = rateCards.map(rc => rc.metadata.extractionConfidence);
    
    const allConfidences = [...tableConfidences, ...rateCardConfidences];
    const averageConfidence = allConfidences.reduce((sum, conf) => sum + conf, 0) / allConfidences.length;
    
    return Math.round(averageConfidence);
  }

  private getDefaultInsights(): FinancialInsights {
    return {
      totalPotentialSavings: 0,
      highestSavingsOpportunity: { role: 'N/A', amount: 0 },
      rateAnalysisSummary: {
        totalRoles: 0,
        aboveMarketCount: 0,
        belowMarketCount: 0,
        averageVariance: 0
      },
      recommendations: [],
      riskFactors: []
    };
  }

  private extractTotalValue(text: string): number {
    const patterns = [
      /total\s+(?:contract\s+)?value:\s*\$?([\d,]+)/i,
      /\$\s*([\d,]+)/g,
      /\$?([\d,]+)\s*usd/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseInt(match[1].replace(/,/g, ''));
        if (value > 1000) { // Reasonable contract value
          return value;
        }
      }
    }

    // Default for demo
    return 500000;
  }

  private extractCurrency(text: string): string {
    if (text.includes('$') || /usd|dollar/i.test(text)) return 'USD';
    if (/eur|euro/i.test(text)) return 'EUR';
    if (/gbp|pound/i.test(text)) return 'GBP';
    return 'USD';
  }

  private extractPaymentTerms(text: string): string {
    const match = text.match(/payment\s+terms?:\s*([^\n]+)/i) ||
                  text.match(/net\s+(\d+)\s+days/i);
    return match ? match[1].trim() : 'Net 30 days';
  }

  private extractPaymentSchedule(text: string): { frequency: string; amount: number } | undefined {
    const monthlyMatch = text.match(/monthly\s+payments?\s+of\s+\$?([\d,]+)/i);
    if (monthlyMatch) {
      return {
        frequency: 'Monthly',
        amount: parseInt(monthlyMatch[1].replace(/,/g, ''))
      };
    }

    // Default for demo
    const totalValue = this.extractTotalValue(text);
    if (totalValue > 0) {
      return {
        frequency: 'Monthly',
        amount: Math.round(totalValue / 12)
      };
    }

    return undefined;
  }

  private extractPenalties(text: string): string[] {
    const penalties: string[] = [];
    const patterns = [
      /late\s+payment\s+fee:\s*([^\n]+)/i,
      /penalty:\s*([^\n]+)/i,
      /liquidated\s+damages:\s*([^\n]+)/i,
      /1\.5%\s+per\s+month/i
    ];

    patterns.forEach(pattern => {
      const match = text.match(pattern);
      if (match) {
        penalties.push(match[1] || match[0]);
      }
    });

    // Default for demo
    if (penalties.length === 0) {
      penalties.push('1.5% per month on overdue amounts');
    }

    return penalties;
  }
}
/*
*
 * Table Extraction Engine
 * Identifies and extracts structured financial tables from contract text
 */
class TableExtractionEngine {
  async extractTables(text: string): Promise<FinancialTable[]> {
    const tables: FinancialTable[] = [];
    
    // Extract tables using multiple detection methods
    const patternTables = this.extractTablesByPattern(text);
    const structureTables = this.extractTablesByStructure(text);
    
    // Combine and deduplicate tables
    const allTables = [...patternTables, ...structureTables];
    const uniqueTables = this.deduplicateTables(allTables);
    
    // Classify and validate each table
    for (const table of uniqueTables) {
      const classifiedTable = this.classifyTable(table);
      const validatedTable = this.validateTableData(classifiedTable);
      
      if (validatedTable.confidence > 30) { // Only include tables with reasonable confidence
        tables.push(validatedTable);
      }
    }
    
    return tables;
  }

  private extractTablesByPattern(text: string): FinancialTable[] {
    const tables: FinancialTable[] = [];
    
    // Pattern 1: Rate card tables
    const rateCardPattern = /(?:rate\s+card|pricing\s+schedule|hourly\s+rates?)[^\n]*\n((?:[^\n]+\n){2,})/gi;
    let match;
    let tableId = 1;
    
    while ((match = rateCardPattern.exec(text)) !== null) {
      const tableText = match[1];
      const table = this.parseTableStructure(tableText, match.index);
      
      if (table && table.rows.length > 0) {
        tables.push({
          id: `rate_card_${tableId++}`,
          title: this.extractTableTitle(match[0]) || 'Rate Card',
          type: TableType.RATE_CARD,
          headers: table.headers,
          rows: table.rows,
          metadata: {
            extractionMethod: 'pattern',
            confidence: 75,
            position: { start: match.index, end: match.index + match[0].length }
          },
          confidence: 75
        });
      }
    }

    // Pattern 2: Payment schedule tables
    const paymentPattern = /(?:payment\s+schedule|milestone\s+payments?)[^\n]*\n((?:[^\n]+\n){2,})/gi;
    tableId = 1;
    
    while ((match = paymentPattern.exec(text)) !== null) {
      const tableText = match[1];
      const table = this.parseTableStructure(tableText, match.index);
      
      if (table && table.rows.length > 0) {
        tables.push({
          id: `payment_schedule_${tableId++}`,
          title: this.extractTableTitle(match[0]) || 'Payment Schedule',
          type: TableType.PAYMENT_SCHEDULE,
          headers: table.headers,
          rows: table.rows,
          metadata: {
            extractionMethod: 'pattern',
            confidence: 70,
            position: { start: match.index, end: match.index + match[0].length }
          },
          confidence: 70
        });
      }
    }

    return tables;
  }

  private extractTablesByStructure(text: string): FinancialTable[] {
    const tables: FinancialTable[] = [];
    const lines = text.split('\n');
    
    let currentTable: { headers: string[]; rows: string[][]; startIndex: number } | null = null;
    let tableId = 1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        if (currentTable && currentTable.rows.length > 1) {
          // End current table
          const table = this.convertStructureToTable(currentTable, i);
          if (table) {
            tables.push({
              id: `structure_table_${tableId++}`,
              title: this.inferTableTitle(currentTable.headers),
              type: this.inferTableType(currentTable.headers),
              headers: table.headers,
              rows: table.rows,
              metadata: {
                extractionMethod: 'pattern',
                confidence: 60,
                position: { start: currentTable.startIndex, end: i }
              },
              confidence: 60
            });
          }
        }
        currentTable = null;
        continue;
      }
      
      // Detect potential table headers (lines with multiple columns separated by spaces/tabs)
      const columns = this.splitIntoColumns(line);
      
      if (columns.length >= 2) {
        if (!currentTable) {
          // Start new table
          currentTable = {
            headers: columns,
            rows: [],
            startIndex: i
          };
        } else if (columns.length === currentTable.headers.length) {
          // Add row to current table
          currentTable.rows.push(columns);
        } else {
          // Column count mismatch - end current table and start new one
          if (currentTable.rows.length > 1) {
            const table = this.convertStructureToTable(currentTable, i);
            if (table) {
              tables.push({
                id: `structure_table_${tableId++}`,
                title: this.inferTableTitle(currentTable.headers),
                type: this.inferTableType(currentTable.headers),
                headers: table.headers,
                rows: table.rows,
                metadata: {
                  extractionMethod: 'pattern',
                  confidence: 60,
                  position: { start: currentTable.startIndex, end: i }
                },
                confidence: 60
              });
            }
          }
          
          currentTable = {
            headers: columns,
            rows: [],
            startIndex: i
          };
        }
      }
    }
    
    // Handle table at end of text
    if (currentTable && currentTable.rows.length > 1) {
      const table = this.convertStructureToTable(currentTable, lines.length);
      if (table) {
        tables.push({
          id: `structure_table_${tableId++}`,
          title: this.inferTableTitle(currentTable.headers),
          type: this.inferTableType(currentTable.headers),
          headers: table.headers,
          rows: table.rows,
          metadata: {
            extractionMethod: 'pattern',
            confidence: 60,
            position: { start: currentTable.startIndex, end: lines.length }
          },
          confidence: 60
        });
      }
    }
    
    return tables;
  }

  private parseTableStructure(tableText: string, startIndex: number): { headers: string[]; rows: Record<string, any>[] } | null {
    const lines = tableText.trim().split('\n').filter(line => line.trim());
    
    if (lines.length < 2) return null;
    
    // First line is headers
    const headers = this.splitIntoColumns(lines[0]);
    const rows: Record<string, any>[] = [];
    
    // Remaining lines are data rows
    for (let i = 1; i < lines.length; i++) {
      const columns = this.splitIntoColumns(lines[i]);
      
      if (columns.length === headers.length) {
        const row: Record<string, any> = {};
        headers.forEach((header, index) => {
          row[this.normalizeHeaderName(header)] = this.parseColumnValue(columns[index]);
        });
        rows.push(row);
      }
    }
    
    return { headers: headers.map(h => this.normalizeHeaderName(h)), rows };
  }

  private splitIntoColumns(line: string): string[] {
    // Split by multiple spaces, tabs, or pipe characters
    return line.split(/\s{2,}|\t+|\|/)
      .map(col => col.trim())
      .filter(col => col.length > 0);
  }

  private normalizeHeaderName(header: string): string {
    return header.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  private parseColumnValue(value: string): any {
    const trimmed = value.trim();
    
    // Try to parse as number (including currency)
    const numberMatch = trimmed.match(/^\$?([0-9,]+(?:\.[0-9]{2})?)$/);
    if (numberMatch) {
      return parseFloat(numberMatch[1].replace(/,/g, ''));
    }
    
    // Try to parse as percentage
    const percentMatch = trimmed.match(/^([0-9.]+)%$/);
    if (percentMatch) {
      return parseFloat(percentMatch[1]);
    }
    
    return trimmed;
  }

  private extractTableTitle(headerText: string): string | null {
    const titleMatch = headerText.match(/^([^:\n]+):/);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  private inferTableTitle(headers: string[]): string {
    const headerText = headers.join(' ').toLowerCase();
    
    if (headerText.includes('rate') || headerText.includes('hourly') || headerText.includes('daily')) {
      return 'Rate Card';
    }
    if (headerText.includes('payment') || headerText.includes('milestone')) {
      return 'Payment Schedule';
    }
    if (headerText.includes('expense') || headerText.includes('budget')) {
      return 'Expense Breakdown';
    }
    
    return 'Financial Table';
  }

  private inferTableType(headers: string[]): TableType {
    const headerText = headers.join(' ').toLowerCase();
    
    if (headerText.includes('rate') || headerText.includes('hourly') || headerText.includes('daily')) {
      return TableType.RATE_CARD;
    }
    if (headerText.includes('payment') || headerText.includes('milestone')) {
      return TableType.PAYMENT_SCHEDULE;
    }
    if (headerText.includes('expense') || headerText.includes('budget')) {
      return TableType.EXPENSE_BREAKDOWN;
    }
    
    return TableType.BUDGET_ALLOCATION;
  }

  private convertStructureToTable(structure: { headers: string[]; rows: string[][]; startIndex: number }, endIndex: number): { headers: string[]; rows: Record<string, any>[] } | null {
    if (structure.rows.length === 0) return null;
    
    const headers = structure.headers.map(h => this.normalizeHeaderName(h));
    const rows: Record<string, any>[] = [];
    
    for (const rowData of structure.rows) {
      if (rowData.length === headers.length) {
        const row: Record<string, any> = {};
        headers.forEach((header, index) => {
          row[header] = this.parseColumnValue(rowData[index]);
        });
        rows.push(row);
      }
    }
    
    return { headers, rows };
  }

  private classifyTable(table: FinancialTable): FinancialTable {
    // Re-classify table based on content analysis
    const headers = table.headers.join(' ').toLowerCase();
    const sampleRow = table.rows[0];
    
    if (sampleRow) {
      const values = Object.values(sampleRow).join(' ').toLowerCase();
      
      // Look for rate card indicators
      if ((headers.includes('rate') || headers.includes('hourly') || headers.includes('daily')) &&
          (values.includes('senior') || values.includes('junior') || values.includes('developer'))) {
        table.type = TableType.RATE_CARD;
        table.confidence = Math.min(table.confidence + 15, 95);
      }
      
      // Look for payment schedule indicators
      if ((headers.includes('payment') || headers.includes('milestone')) &&
          (values.includes('$') || values.includes('percent'))) {
        table.type = TableType.PAYMENT_SCHEDULE;
        table.confidence = Math.min(table.confidence + 10, 90);
      }
    }
    
    return table;
  }

  private validateTableData(table: FinancialTable): FinancialTable {
    let confidence = table.confidence;
    const warnings: string[] = [];
    
    // Check for minimum number of rows
    if (table.rows.length < 2) {
      confidence -= 20;
      warnings.push('Table has very few rows');
    }
    
    // Check for consistent data types in columns
    const columnTypes = this.analyzeColumnTypes(table);
    if (columnTypes.inconsistentColumns > 0) {
      confidence -= 10;
      warnings.push('Some columns have inconsistent data types');
    }
    
    // Check for empty cells
    const emptyCells = this.countEmptyCells(table);
    if (emptyCells > table.rows.length * table.headers.length * 0.3) {
      confidence -= 15;
      warnings.push('Table has many empty cells');
    }
    
    table.confidence = Math.max(confidence, 0);
    table.metadata.warnings = warnings.length > 0 ? warnings : undefined;
    
    return table;
  }

  private analyzeColumnTypes(table: FinancialTable): { inconsistentColumns: number } {
    let inconsistentColumns = 0;
    
    for (const header of table.headers) {
      const columnValues = table.rows.map(row => row[header]).filter(val => val !== null && val !== undefined);
      
      if (columnValues.length > 1) {
        const types = columnValues.map(val => typeof val);
        const uniqueTypes = new Set(types);
        
        if (uniqueTypes.size > 1) {
          inconsistentColumns++;
        }
      }
    }
    
    return { inconsistentColumns };
  }

  private countEmptyCells(table: FinancialTable): number {
    let emptyCells = 0;
    
    for (const row of table.rows) {
      for (const header of table.headers) {
        const value = row[header];
        if (value === null || value === undefined || value === '') {
          emptyCells++;
        }
      }
    }
    
    return emptyCells;
  }

  private deduplicateTables(tables: FinancialTable[]): FinancialTable[] {
    const uniqueTables: FinancialTable[] = [];
    
    for (const table of tables) {
      const isDuplicate = uniqueTables.some(existing => 
        this.tablesAreSimilar(table, existing)
      );
      
      if (!isDuplicate) {
        uniqueTables.push(table);
      }
    }
    
    return uniqueTables;
  }

  private tablesAreSimilar(table1: FinancialTable, table2: FinancialTable): boolean {
    // Check if tables have similar headers and position
    const headers1 = table1.headers.sort().join(',');
    const headers2 = table2.headers.sort().join(',');
    
    if (headers1 === headers2) {
      const pos1 = table1.metadata.position;
      const pos2 = table2.metadata.position;
      
      // Check if positions overlap significantly
      const overlap = Math.max(0, Math.min(pos1.end, pos2.end) - Math.max(pos1.start, pos2.start));
      const minLength = Math.min(pos1.end - pos1.start, pos2.end - pos2.start);
      
      return overlap > minLength * 0.5;
    }
    
    return false;
  }
}/**
 * Rat
e Card Parser
 * Specialized parser for extracting and structuring rate card information
 */
class RateCardParser {
  async parseRateCard(table: FinancialTable): Promise<RateCard> {
    const rates = this.extractRates(table);
    const metadata = this.generateRateCardMetadata(rates);
    
    return {
      id: `rate_card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: table.title || 'Professional Services Rate Card',
      currency: this.detectCurrency(table),
      effectiveDate: this.extractEffectiveDate(table) || new Date().toISOString().split('T')[0],
      rates,
      metadata
    };
  }

  private extractRates(table: FinancialTable): RateEntry[] {
    const rates: RateEntry[] = [];
    
    // Map headers to standard fields
    const headerMapping = this.createHeaderMapping(table.headers);
    
    for (const row of table.rows) {
      const rate = this.parseRateEntry(row, headerMapping);
      if (rate) {
        rates.push(rate);
      }
    }
    
    return rates;
  }

  private createHeaderMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    
    for (const header of headers) {
      const normalized = header.toLowerCase();
      
      if (normalized.includes('role') || normalized.includes('position') || normalized.includes('title')) {
        mapping.role = header;
      } else if (normalized.includes('level') || normalized.includes('seniority') || normalized.includes('grade')) {
        mapping.level = header;
      } else if (normalized.includes('hourly') || (normalized.includes('rate') && normalized.includes('hour'))) {
        mapping.hourlyRate = header;
      } else if (normalized.includes('daily') || (normalized.includes('rate') && normalized.includes('day'))) {
        mapping.dailyRate = header;
      } else if (normalized.includes('monthly') || (normalized.includes('rate') && normalized.includes('month'))) {
        mapping.monthlyRate = header;
      } else if (normalized.includes('category') || normalized.includes('type')) {
        mapping.category = header;
      } else if (normalized.includes('description') || normalized.includes('desc')) {
        mapping.description = header;
      }
    }
    
    return mapping;
  }

  private parseRateEntry(row: Record<string, any>, headerMapping: Record<string, string>): RateEntry | null {
    const role = this.getFieldValue(row, headerMapping.role);
    if (!role || typeof role !== 'string') return null;
    
    const level = this.getFieldValue(row, headerMapping.level) || this.inferLevel(role);
    const category = this.getFieldValue(row, headerMapping.category) || this.inferCategory(role);
    
    const hourlyRate = this.parseRate(this.getFieldValue(row, headerMapping.hourlyRate));
    const dailyRate = this.parseRate(this.getFieldValue(row, headerMapping.dailyRate));
    const monthlyRate = this.parseRate(this.getFieldValue(row, headerMapping.monthlyRate));
    
    // If we don't have any rates, try to find them in other columns
    if (!hourlyRate && !dailyRate && !monthlyRate) {
      const rateValue = this.findRateInRow(row);
      if (rateValue) {
        // Assume it's hourly rate if not specified
        return {
          role: this.normalizeRoleName(role),
          level: String(level),
          hourlyRate: rateValue,
          category: String(category),
          description: this.getFieldValue(row, headerMapping.description) as string
        };
      }
      return null;
    }
    
    const rateEntry: RateEntry = {
      role: this.normalizeRoleName(role),
      level: String(level),
      category: String(category)
    };
    
    if (hourlyRate) rateEntry.hourlyRate = hourlyRate;
    if (dailyRate) rateEntry.dailyRate = dailyRate;
    if (monthlyRate) rateEntry.monthlyRate = monthlyRate;
    
    // Convert between rate types if only one is provided
    if (hourlyRate && !dailyRate) {
      rateEntry.dailyRate = hourlyRate * 8; // Assume 8-hour day
    }
    if (dailyRate && !hourlyRate) {
      rateEntry.hourlyRate = dailyRate / 8;
    }
    
    const description = this.getFieldValue(row, headerMapping.description);
    if (description) {
      rateEntry.description = String(description);
    }
    
    return rateEntry;
  }

  private getFieldValue(row: Record<string, any>, fieldName: string | undefined): any {
    if (!fieldName) return undefined;
    return row[fieldName];
  }

  private parseRate(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return undefined;
    
    // Remove currency symbols and commas
    const cleaned = value.replace(/[$,£€]/g, '').trim();
    const parsed = parseFloat(cleaned);
    
    return isNaN(parsed) ? undefined : parsed;
  }

  private findRateInRow(row: Record<string, unknown>): number | undefined {
    for (const value of Object.values(row)) {
      const rate = this.parseRate(value);
      if (rate && rate > 10 && rate < 10000) { // Reasonable rate range
        return rate;
      }
    }
    return undefined;
  }

  private normalizeRoleName(roleName: string): string {
    // Standardize common role names
    const roleMap: Record<string, string> = {
      'sr developer': 'Senior Developer',
      'senior dev': 'Senior Developer',
      'jr developer': 'Junior Developer',
      'junior dev': 'Junior Developer',
      'project mgr': 'Project Manager',
      'pm': 'Project Manager',
      'business analyst': 'Business Analyst',
      'ba': 'Business Analyst',
      'qa engineer': 'QA Engineer',
      'quality assurance': 'QA Engineer',
      'consultant': 'Consultant',
      'architect': 'Solution Architect'
    };
    
    const normalized = roleName.toLowerCase().trim();
    return roleMap[normalized] || this.toTitleCase(roleName);
  }

  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  private inferLevel(roleName: string): string {
    const role = roleName.toLowerCase();
    
    if (role.includes('senior') || role.includes('sr') || role.includes('lead')) {
      return 'Senior';
    }
    if (role.includes('junior') || role.includes('jr') || role.includes('entry')) {
      return 'Junior';
    }
    if (role.includes('principal') || role.includes('architect')) {
      return 'Principal';
    }
    
    return 'Mid';
  }

  private inferCategory(roleName: string): string {
    const role = roleName.toLowerCase();
    
    if (role.includes('developer') || role.includes('programmer') || role.includes('engineer')) {
      return 'Development';
    }
    if (role.includes('manager') || role.includes('lead')) {
      return 'Management';
    }
    if (role.includes('analyst') || role.includes('consultant')) {
      return 'Analysis';
    }
    if (role.includes('designer') || role.includes('ux') || role.includes('ui')) {
      return 'Design';
    }
    if (role.includes('qa') || role.includes('test')) {
      return 'Quality Assurance';
    }
    
    return 'Professional Services';
  }

  private detectCurrency(table: FinancialTable): string {
    // Look for currency symbols in the data
    const allValues = table.rows.flatMap(row => Object.values(row));
    const textValues = allValues.filter(val => typeof val === 'string').join(' ');
    
    if (textValues.includes('£')) return 'GBP';
    if (textValues.includes('€')) return 'EUR';
    if (textValues.includes('$')) return 'USD';
    
    return 'USD'; // Default
  }

  private extractEffectiveDate(table: FinancialTable): string | null {
    // Look for date patterns in table title or metadata
    const searchText = `${table.title} ${JSON.stringify(table.metadata)}`;
    const datePattern = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/;
    const match = searchText.match(datePattern);
    
    if (match) {
      try {
        const date = new Date(match[1]);
        return date.toISOString().split('T')[0];
      } catch {
        return null;
      }
    }
    
    return null;
  }

  private generateRateCardMetadata(rates: RateEntry[]): RateCardMetadata {
    const hourlyRates = rates.map(r => r.hourlyRate).filter(r => r !== undefined) as number[];
    const averageRate = hourlyRates.length > 0 
      ? hourlyRates.reduce((sum, rate) => sum + rate, 0) / hourlyRates.length 
      : 0;
    
    const rateRange = hourlyRates.length > 0 
      ? { min: Math.min(...hourlyRates), max: Math.max(...hourlyRates) }
      : { min: 0, max: 0 };
    
    return {
      extractionConfidence: 85, // Base confidence for successful parsing
      totalRoles: rates.length,
      averageRate,
      rateRange,
      lastUpdated: new Date().toISOString()
    };
  }
}/**

 * Market Benchmarking Service
 * Compares extracted rates against market benchmarks and calculates savings opportunities
 */
class MarketBenchmarkingService {
  private marketRates: Map<string, MarketRate>;

  constructor() {
    this.marketRates = new Map();
    this.initializeMarketRates();
  }

  async benchmarkRateCard(rateCard: RateCard): Promise<BenchmarkingResult> {
    const benchmarkedRates: RateEntry[] = [];
    let totalSavingsOpportunity = 0;
    let ratesAboveMarket = 0;
    let ratesBelowMarket = 0;
    let totalVariance = 0;

    for (const rate of rateCard.rates) {
      const marketRate = await this.getMarketRate(rate.role, rate.level);
      
      if (marketRate && rate.hourlyRate) {
        const variance = rate.hourlyRate - marketRate.averageRate;
        const variancePercentage = ((variance / marketRate.averageRate) * 100).toFixed(1);
        const annualSavingsOpportunity = this.calculateAnnualSavings(variance);

        const benchmarkedRate: RateEntry = {
          ...rate,
          marketBenchmark: marketRate.averageRate,
          variance,
          variancePercentage: `${variance >= 0 ? '+' : ''}${variancePercentage}%`,
          annualSavingsOpportunity: variance > 0 ? `$${annualSavingsOpportunity.toLocaleString()}` : 'Market Rate'
        };

        benchmarkedRates.push(benchmarkedRate);

        if (variance > 0) {
          ratesAboveMarket++;
          totalSavingsOpportunity += annualSavingsOpportunity;
        } else {
          ratesBelowMarket++;
        }

        totalVariance += Math.abs(variance);
      } else {
        // No market data available
        benchmarkedRates.push({
          ...rate,
          variancePercentage: 'N/A',
          annualSavingsOpportunity: 'No Market Data'
        });
      }
    }

    const averageVariance = benchmarkedRates.length > 0 ? totalVariance / benchmarkedRates.length : 0;
    const recommendations = this.generateRecommendations(benchmarkedRates, totalSavingsOpportunity);

    return {
      rateCardId: rateCard.id,
      benchmarkedRates,
      totalSavingsOpportunity,
      averageVariance,
      ratesAboveMarket,
      ratesBelowMarket,
      recommendations
    };
  }

  async getMarketRate(role: string, level: string, location = 'US'): Promise<MarketRate | null> {
    const key = `${role.toLowerCase()}_${level.toLowerCase()}_${location.toLowerCase()}`;
    return this.marketRates.get(key) || null;
  }

  private calculateAnnualSavings(hourlyVariance: number): number {
    // Assume 2080 working hours per year (40 hours/week * 52 weeks)
    return Math.max(0, hourlyVariance * 2080);
  }

  private generateRecommendations(rates: RateEntry[], totalSavings: number): string[] {
    const recommendations: string[] = [];

    // High savings opportunity
    if (totalSavings > 100000) {
      recommendations.push('Significant cost savings opportunity identified - prioritize immediate rate renegotiation');
    } else if (totalSavings > 50000) {
      recommendations.push('Moderate savings opportunity - consider rate negotiation in next contract renewal');
    }

    // Specific role recommendations
    const highVarianceRoles = rates.filter(r => 
      r.variance && r.variance > 20 && r.annualSavingsOpportunity !== 'Market Rate'
    );

    if (highVarianceRoles.length > 0) {
      const topRole = highVarianceRoles.sort((a, b) => (b.variance || 0) - (a.variance || 0))[0];
      recommendations.push(`Focus on negotiating rates for ${topRole.role} roles - highest savings potential`);
    }

    // Market positioning
    const aboveMarketCount = rates.filter(r => r.variance && r.variance > 0).length;
    const totalRates = rates.filter(r => r.variance !== undefined).length;

    if (totalRates > 0) {
      const aboveMarketPercentage = (aboveMarketCount / totalRates) * 100;
      
      if (aboveMarketPercentage > 70) {
        recommendations.push('Most rates are above market average - comprehensive rate review recommended');
      } else if (aboveMarketPercentage > 40) {
        recommendations.push('Several rates above market - selective rate negotiation opportunities exist');
      } else {
        recommendations.push('Rate structure is generally competitive with market standards');
      }
    }

    return recommendations;
  }

  private initializeMarketRates(): void {
    // Initialize with sample market rate data
    // In production, this would be loaded from a database or external service
    const sampleRates: Array<{role: string; level: string; rate: number; location: string}> = [
      { role: 'Senior Developer', level: 'Senior', rate: 165, location: 'US' },
      { role: 'Junior Developer', level: 'Junior', rate: 95, location: 'US' },
      { role: 'Project Manager', level: 'Senior', rate: 145, location: 'US' },
      { role: 'Business Analyst', level: 'Mid', rate: 120, location: 'US' },
      { role: 'QA Engineer', level: 'Mid', rate: 115, location: 'US' },
      { role: 'Solution Architect', level: 'Principal', rate: 185, location: 'US' },
      { role: 'Consultant', level: 'Senior', rate: 155, location: 'US' },
      { role: 'Developer', level: 'Senior', rate: 155, location: 'US' },
      { role: 'Developer', level: 'Mid', rate: 125, location: 'US' },
      { role: 'Developer', level: 'Junior', rate: 85, location: 'US' },
      { role: 'Senior Consultant', level: 'Senior', rate: 165, location: 'US' },
      { role: 'Technical Lead', level: 'Senior', rate: 175, location: 'US' },
      { role: 'Data Analyst', level: 'Mid', rate: 110, location: 'US' },
      { role: 'UX Designer', level: 'Mid', rate: 130, location: 'US' },
      { role: 'DevOps Engineer', level: 'Senior', rate: 170, location: 'US' }
    ];

    for (const rate of sampleRates) {
      const key = `${rate.role.toLowerCase()}_${rate.level.toLowerCase()}_${rate.location.toLowerCase()}`;
      this.marketRates.set(key, {
        role: rate.role,
        level: rate.level,
        averageRate: rate.rate,
        percentile25: rate.rate * 0.85,
        percentile75: rate.rate * 1.15,
        sampleSize: 100, // Mock sample size
        location: rate.location,
        lastUpdated: new Date().toISOString(),
        source: 'Market Research Database'
      });
    }
  }
}

interface MarketRate {
  role: string;
  level: string;
  averageRate: number;
  percentile25: number;
  percentile75: number;
  sampleSize: number;
  location: string;
  lastUpdated: string;
  source: string;
}

// Export the enhanced financial worker as the default export
export { EnhancedFinancialWorker as FinancialWorker };