/**
 * Table Extraction Service
 * 
 * Extracts structured data from tables in contracts:
 * - Rate cards
 * - Payment schedules
 * - Cost breakdowns
 * - Milestone tables
 */

import pino from 'pino';

const logger = pino({ name: 'table-extraction' });

export interface Table {
  id: string;
  type: 'rate_card' | 'payment_schedule' | 'cost_breakdown' | 'milestone' | 'unknown';
  headers: string[];
  rows: string[][];
  confidence: number;
  location: {
    startLine: number;
    endLine: number;
  };
}

export interface RateCard {
  role: string;
  level?: string;
  rate: number;
  unit: string;
  currency: string;
  location?: string;
  notes?: string;
}

export interface PaymentSchedule {
  milestone: string;
  amount: number;
  currency: string;
  dueDate?: string;
  percentage?: number;
}

export interface CostBreakdown {
  category: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
  currency: string;
  description?: string;
}

export class TableExtractionService {
  private static instance: TableExtractionService;

  private constructor() {}

  static getInstance(): TableExtractionService {
    if (!TableExtractionService.instance) {
      TableExtractionService.instance = new TableExtractionService();
    }
    return TableExtractionService.instance;
  }

  /**
   * Detect tables in contract text
   */
  detectTables(text: string): Table[] {
    const tables: Table[] = [];
    const lines = text.split('\n');

    let currentTable: { start: number; lines: string[] } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect table start (lines with multiple | or tabs)
      if (this.isTableLine(line)) {
        if (!currentTable) {
          currentTable = { start: i, lines: [line] };
        } else {
          currentTable.lines.push(line);
        }
      } else if (currentTable && currentTable.lines.length >= 2) {
        // Table ended
        const table = this.parseTable(currentTable.lines, currentTable.start);
        if (table) {
          tables.push(table);
        }
        currentTable = null;
      } else {
        currentTable = null;
      }
    }

    // Handle table at end of document
    if (currentTable && currentTable.lines.length >= 2) {
      const table = this.parseTable(currentTable.lines, currentTable.start);
      if (table) {
        tables.push(table);
      }
    }

    logger.info({ tablesFound: tables.length }, 'Tables detected');
    return tables;
  }

  /**
   * Extract rate cards from tables
   */
  extractRateCards(tables: Table[]): RateCard[] {
    const rateCards: RateCard[] = [];

    for (const table of tables) {
      if (table.type === 'rate_card' || this.looksLikeRateCard(table)) {
        const cards = this.parseRateCardTable(table);
        rateCards.push(...cards);
      }
    }

    logger.info({ rateCardsExtracted: rateCards.length }, 'Rate cards extracted');
    return rateCards;
  }

  /**
   * Extract payment schedules from tables
   */
  extractPaymentSchedule(tables: Table[]): PaymentSchedule[] {
    const schedules: PaymentSchedule[] = [];

    for (const table of tables) {
      if (table.type === 'payment_schedule' || this.looksLikePaymentSchedule(table)) {
        const items = this.parsePaymentScheduleTable(table);
        schedules.push(...items);
      }
    }

    logger.info({ scheduleItemsExtracted: schedules.length }, 'Payment schedule extracted');
    return schedules;
  }

  /**
   * Extract cost breakdowns from tables
   */
  extractCostBreakdown(tables: Table[]): CostBreakdown[] {
    const breakdowns: CostBreakdown[] = [];

    for (const table of tables) {
      if (table.type === 'cost_breakdown' || this.looksLikeCostBreakdown(table)) {
        const items = this.parseCostBreakdownTable(table);
        breakdowns.push(...items);
      }
    }

    logger.info({ breakdownItemsExtracted: breakdowns.length }, 'Cost breakdown extracted');
    return breakdowns;
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  /**
   * Check if line is part of a table
   */
  private isTableLine(line: string): boolean {
    // Check for pipe-separated values
    if (line.includes('|') && line.split('|').length >= 3) {
      return true;
    }

    // Check for tab-separated values
    if (line.includes('\t') && line.split('\t').length >= 3) {
      return true;
    }

    // Check for space-aligned columns (at least 3 columns with 2+ spaces between)
    const spacePattern = /\s{2,}/g;
    const columns = line.split(spacePattern).filter(col => col.trim().length > 0);
    if (columns.length >= 3) {
      return true;
    }

    return false;
  }

  /**
   * Parse table from lines
   */
  private parseTable(lines: string[], startLine: number): Table | null {
    if (lines.length < 2) return null;

    // Determine separator
    const firstLine = lines[0];
    let separator: string | RegExp = '|';
    if (firstLine.includes('\t')) {
      separator = '\t';
    } else if (!firstLine.includes('|')) {
      separator = /\s{2,}/; // Multiple spaces
    }

    // Parse headers (first non-separator line)
    let headerLine = lines[0];
    let dataStartIndex = 1;

    // Skip separator lines (like |---|---|)
    if (headerLine.includes('---') || headerLine.includes('===')) {
      if (lines.length < 3) return null;
      headerLine = lines[1];
      dataStartIndex = 2;
    }

    const headers = this.splitLine(headerLine, separator)
      .map(h => h.trim())
      .filter(h => h.length > 0);

    if (headers.length < 2) return null;

    // Parse rows
    const rows: string[][] = [];
    for (let i = dataStartIndex; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('---') || line.includes('===')) continue;

      const cells = this.splitLine(line, separator)
        .map(c => c.trim())
        .filter(c => c.length > 0);

      if (cells.length >= 2) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) return null;

    // Determine table type
    const type = this.determineTableType(headers, rows);

    return {
      id: `table-${startLine}`,
      type,
      headers,
      rows,
      confidence: 0.8,
      location: {
        startLine,
        endLine: startLine + lines.length
      }
    };
  }

  /**
   * Split line by separator
   */
  private splitLine(line: string, separator: string | RegExp): string[] {
    return line.split(separator);
  }

  /**
   * Determine table type from headers and content
   */
  private determineTableType(headers: string[], rows: string[][]): Table['type'] {
    const headerText = headers.join(' ').toLowerCase();

    // Rate card indicators
    if (headerText.includes('rate') || headerText.includes('role') || headerText.includes('level')) {
      return 'rate_card';
    }

    // Payment schedule indicators
    if (headerText.includes('milestone') || headerText.includes('payment') || headerText.includes('due')) {
      return 'payment_schedule';
    }

    // Cost breakdown indicators
    if (headerText.includes('cost') || headerText.includes('category') || headerText.includes('total')) {
      return 'cost_breakdown';
    }

    return 'unknown';
  }

  /**
   * Check if table looks like a rate card
   */
  private looksLikeRateCard(table: Table): boolean {
    const headerText = table.headers.join(' ').toLowerCase();
    return headerText.includes('rate') || headerText.includes('role') || headerText.includes('hour');
  }

  /**
   * Check if table looks like a payment schedule
   */
  private looksLikePaymentSchedule(table: Table): boolean {
    const headerText = table.headers.join(' ').toLowerCase();
    return headerText.includes('milestone') || headerText.includes('payment') || headerText.includes('due');
  }

  /**
   * Check if table looks like a cost breakdown
   */
  private looksLikeCostBreakdown(table: Table): boolean {
    const headerText = table.headers.join(' ').toLowerCase();
    return headerText.includes('cost') || headerText.includes('category') || headerText.includes('total');
  }

  /**
   * Parse rate card table
   */
  private parseRateCardTable(table: Table): RateCard[] {
    const rateCards: RateCard[] = [];

    // Find column indices
    const roleIndex = this.findColumnIndex(table.headers, ['role', 'position', 'title']);
    const levelIndex = this.findColumnIndex(table.headers, ['level', 'grade', 'seniority']);
    const rateIndex = this.findColumnIndex(table.headers, ['rate', 'price', 'cost']);
    const unitIndex = this.findColumnIndex(table.headers, ['unit', 'per', 'basis']);
    const locationIndex = this.findColumnIndex(table.headers, ['location', 'region', 'site']);

    if (roleIndex === -1 || rateIndex === -1) {
      logger.warn('Could not find required columns for rate card');
      return rateCards;
    }

    for (const row of table.rows) {
      try {
        const role = row[roleIndex] || '';
        const rateStr = row[rateIndex] || '';
        
        // Extract numeric rate
        const rateMatch = rateStr.match(/[\d,]+/);
        if (!rateMatch) continue;
        
        const rate = parseFloat(rateMatch[0].replace(/,/g, ''));

        const rateCard: RateCard = {
          role,
          rate,
          unit: unitIndex !== -1 ? row[unitIndex] : 'hour',
          currency: 'USD' // Default, could be extracted from rate string
        };

        if (levelIndex !== -1 && row[levelIndex]) {
          rateCard.level = row[levelIndex];
        }

        if (locationIndex !== -1 && row[locationIndex]) {
          rateCard.location = row[locationIndex];
        }

        rateCards.push(rateCard);
      } catch (error) {
        logger.warn({ error, row }, 'Failed to parse rate card row');
      }
    }

    return rateCards;
  }

  /**
   * Parse payment schedule table
   */
  private parsePaymentScheduleTable(table: Table): PaymentSchedule[] {
    const schedules: PaymentSchedule[] = [];

    const milestoneIndex = this.findColumnIndex(table.headers, ['milestone', 'phase', 'deliverable']);
    const amountIndex = this.findColumnIndex(table.headers, ['amount', 'payment', 'value']);
    const dateIndex = this.findColumnIndex(table.headers, ['date', 'due', 'deadline']);

    if (milestoneIndex === -1 || amountIndex === -1) {
      logger.warn('Could not find required columns for payment schedule');
      return schedules;
    }

    for (const row of table.rows) {
      try {
        const milestone = row[milestoneIndex] || '';
        const amountStr = row[amountIndex] || '';
        
        const amountMatch = amountStr.match(/[\d,]+/);
        if (!amountMatch) continue;
        
        const amount = parseFloat(amountMatch[0].replace(/,/g, ''));

        const schedule: PaymentSchedule = {
          milestone,
          amount,
          currency: 'USD'
        };

        if (dateIndex !== -1 && row[dateIndex]) {
          schedule.dueDate = row[dateIndex];
        }

        schedules.push(schedule);
      } catch (error) {
        logger.warn({ error, row }, 'Failed to parse payment schedule row');
      }
    }

    return schedules;
  }

  /**
   * Parse cost breakdown table
   */
  private parseCostBreakdownTable(table: Table): CostBreakdown[] {
    const breakdowns: CostBreakdown[] = [];

    const categoryIndex = this.findColumnIndex(table.headers, ['category', 'item', 'description']);
    const totalIndex = this.findColumnIndex(table.headers, ['total', 'amount', 'cost']);
    const quantityIndex = this.findColumnIndex(table.headers, ['quantity', 'qty', 'units']);

    if (categoryIndex === -1 || totalIndex === -1) {
      logger.warn('Could not find required columns for cost breakdown');
      return breakdowns;
    }

    for (const row of table.rows) {
      try {
        const category = row[categoryIndex] || '';
        const totalStr = row[totalIndex] || '';
        
        const totalMatch = totalStr.match(/[\d,]+/);
        if (!totalMatch) continue;
        
        const total = parseFloat(totalMatch[0].replace(/,/g, ''));

        const breakdown: CostBreakdown = {
          category,
          total,
          currency: 'USD'
        };

        if (quantityIndex !== -1 && row[quantityIndex]) {
          const qtyMatch = row[quantityIndex].match(/[\d,]+/);
          if (qtyMatch) {
            breakdown.quantity = parseFloat(qtyMatch[0].replace(/,/g, ''));
          }
        }

        breakdowns.push(breakdown);
      } catch (error) {
        logger.warn({ error, row }, 'Failed to parse cost breakdown row');
      }
    }

    return breakdowns;
  }

  /**
   * Find column index by possible names
   */
  private findColumnIndex(headers: string[], possibleNames: string[]): number {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].toLowerCase();
      for (const name of possibleNames) {
        if (header.includes(name.toLowerCase())) {
          return i;
        }
      }
    }
    return -1;
  }
}

export const tableExtractionService = TableExtractionService.getInstance();
