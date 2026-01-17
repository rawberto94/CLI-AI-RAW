/**
 * Contract Export API
 * Export contracts in various formats
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ExportConfig {
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  includeFields: string[];
  contractIds?: string[];
  filters?: {
    status?: string[];
    dateRange?: { from?: string; to?: string };
    contractTypes?: string[];
  };
}

// Field mapping for export
const fieldMappings: Record<string, string | ((contract: Record<string, unknown>) => unknown)> = {
  name: 'fileName',
  status: 'status',
  type: 'category',
  supplier: 'supplier',
  value: (c) => c.metadata && typeof c.metadata === 'object' ? (c.metadata as Record<string, unknown>)['contractValue'] : null,
  startDate: (c) => c.metadata && typeof c.metadata === 'object' ? (c.metadata as Record<string, unknown>)['effectiveDate'] : null,
  endDate: (c) => c.metadata && typeof c.metadata === 'object' ? (c.metadata as Record<string, unknown>)['expirationDate'] : null,
  createdAt: 'createdAt',
  riskLevel: (c) => c.metadata && typeof c.metadata === 'object' ? (c.metadata as Record<string, unknown>)['riskLevel'] : null,
  complianceStatus: (c) => c.metadata && typeof c.metadata === 'object' ? (c.metadata as Record<string, unknown>)['complianceStatus'] : null,
  keyTerms: (c) => c.metadata && typeof c.metadata === 'object' ? (c.metadata as Record<string, unknown>)['keyTerms'] : null,
  parties: (c) => c.metadata && typeof c.metadata === 'object' ? (c.metadata as Record<string, unknown>)['parties'] : null,
  summary: (c) => {
    const artifacts = c.artifacts as { type: string; content: string }[] | undefined;
    const summary = artifacts?.find(a => a.type === 'summary');
    return summary?.content || null;
  },
  // Contract hierarchy fields
  parentContract: (c) => {
    const parent = c.parentContract as { id: string; fileName: string } | undefined;
    return parent?.fileName || null;
  },
  parentContractId: 'parentContractId',
  relationshipType: 'relationshipType',
  relationshipNote: 'relationshipNote',
  childContractCount: (c) => {
    const children = c.childContracts as unknown[] | undefined;
    return children?.length ?? 0;
  },
};

export async function POST(request: NextRequest) {
  try {
    const config: ExportConfig = await request.json();
    
    // Build query
    const where: Record<string, unknown> = {};
    
    if (config.contractIds && config.contractIds.length > 0) {
      where.id = { in: config.contractIds };
    }
    
    if (config.filters?.status && config.filters.status.length > 0) {
      where.status = { in: config.filters.status };
    }
    
    if (config.filters?.contractTypes && config.filters.contractTypes.length > 0) {
      where.category = { in: config.filters.contractTypes };
    }
    
    // Fetch contracts
    const includeHierarchy = 
      config.includeFields.includes('parentContract') || 
      config.includeFields.includes('parentContractId') ||
      config.includeFields.includes('relationshipType') ||
      config.includeFields.includes('relationshipNote') ||
      config.includeFields.includes('childContractCount');
      
    const contracts = await prisma.contract.findMany({
      where,
      include: {
        artifacts: config.includeFields.includes('summary') || config.includeFields.includes('artifacts'),
        supplier: config.includeFields.includes('supplier'),
        parentContract: includeHierarchy ? {
          select: { id: true, fileName: true, contractType: true }
        } : false,
        childContracts: includeHierarchy ? {
          select: { id: true, fileName: true, contractType: true }
        } : false,
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Transform data based on selected fields
    const data = contracts.map((contract: Record<string, unknown>) => {
      const row: Record<string, unknown> = {};
      
      for (const field of config.includeFields) {
        const mapping = fieldMappings[field];
        if (typeof mapping === 'function') {
          row[field] = mapping(contract);
        } else if (mapping) {
          row[field] = contract[mapping];
        }
      }
      
      return row;
    });
    
    // Generate export based on format
    let content: string;
    let contentType: string;
    let filename: string;
    
    switch (config.format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        contentType = 'application/json';
        filename = `contracts-export-${Date.now()}.json`;
        break;
        
      case 'csv':
        content = generateCSV(data, config.includeFields);
        contentType = 'text/csv';
        filename = `contracts-export-${Date.now()}.csv`;
        break;
        
      case 'xlsx':
        // For XLSX, we'd need a library like xlsx
        // For now, return CSV-compatible data
        content = generateCSV(data, config.includeFields);
        contentType = 'text/csv';
        filename = `contracts-export-${Date.now()}.csv`;
        break;
        
      case 'pdf':
        // For PDF, we'd need a library like pdfkit
        // For now, return JSON
        content = JSON.stringify(data, null, 2);
        contentType = 'application/json';
        filename = `contracts-export-${Date.now()}.json`;
        break;
        
      default:
        content = JSON.stringify(data, null, 2);
        contentType = 'application/json';
        filename = `contracts-export-${Date.now()}.json`;
    }
    
    // In production, upload to S3 and return download URL
    // For now, return the data directly
    return NextResponse.json({
      success: true,
      count: contracts.length,
      downloadUrl: `/api/contracts/export/download?file=${filename}`,
      data: config.format === 'json' ? data : undefined,
    });
    
  } catch {
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}

function generateCSV(data: Record<string, unknown>[], fields: string[]): string {
  if (data.length === 0) return '';
  
  const headers = fields.map(f => `"${f}"`).join(',');
  const rows = data.map(row => 
    fields.map(f => {
      const value = row[f];
      if (value === null || value === undefined) return '""';
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')
  );
  
  return [headers, ...rows].join('\n');
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to export contracts',
    supportedFormats: ['csv', 'xlsx', 'json', 'pdf'],
  });
}
