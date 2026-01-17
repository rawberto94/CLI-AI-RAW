import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";

// Using singleton prisma instance from @/lib/prisma

interface CSVRow {
  roleOriginal?: string;
  roleStandardized: string;
  roleCategory?: string;
  seniority: string;
  supplierName?: string;
  supplierId?: string;
  supplierTier?: string;
  dailyRateUSD: number;
  dailyRateCHF?: number;
  currency?: string;
  country: string;
  region?: string;
  lineOfService?: string;
  effectiveDate?: string;
  expiryDate?: string;
  volumeCommitted?: number;
  isNegotiated?: string | boolean;
  notes?: string;
}

/**
 * POST /api/rate-cards/import/csv
 * Bulk import rate cards from CSV
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId, data: csvData, validateOnly = false } = await request.json();

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV data is required and must be an array' },
        { status: 400 }
      );
    }

    const results = {
      total: csvData.length,
      valid: 0,
      invalid: 0,
      imported: 0,
      errors: [] as any[],
      warnings: [] as any[],
      imported_records: [] as any[]
    };

    // Validate each row
    for (let i = 0; i < csvData.length; i++) {
      const row: CSVRow = csvData[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

      try {
        // Required field validation
        const errors = [];
        
        if (!row.roleStandardized) errors.push('roleStandardized is required');
        if (!row.seniority) errors.push('seniority is required');
        if (!row.dailyRateUSD || isNaN(Number(row.dailyRateUSD))) {
          errors.push('dailyRateUSD is required and must be a number');
        }
        if (!row.country) errors.push('country is required');

        // Seniority validation
        const validSeniorities = ['JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'PARTNER'];
        if (row.seniority && !validSeniorities.includes(row.seniority.toUpperCase())) {
          results.warnings.push({
            row: rowNumber,
            field: 'seniority',
            message: `Invalid seniority "${row.seniority}". Must be one of: ${validSeniorities.join(', ')}`
          });
        }

        // Supplier tier validation
        const validTiers = ['BIG_4', 'TIER_2', 'BOUTIQUE', 'OFFSHORE'];
        if (row.supplierTier && !validTiers.includes(row.supplierTier.toUpperCase())) {
          results.warnings.push({
            row: rowNumber,
            field: 'supplierTier',
            message: `Invalid supplier tier "${row.supplierTier}". Will default to TIER_2`
          });
        }

        // Date validation
        if (row.effectiveDate) {
          const date = new Date(row.effectiveDate);
          if (isNaN(date.getTime())) {
            errors.push(`Invalid effectiveDate format: ${row.effectiveDate}`);
          }
        }

        if (errors.length > 0) {
          results.invalid++;
          results.errors.push({
            row: rowNumber,
            data: row,
            errors
          });
          continue;
        }

        results.valid++;

        // If validation only, skip import
        if (validateOnly) {
          continue;
        }

        // Import the rate card
        const rateCardEntry = await prisma.rateCardEntry.create({
          data: {
            tenantId,
            roleOriginal: row.roleOriginal || row.roleStandardized,
            roleStandardized: row.roleStandardized,
            roleCategory: row.roleCategory || 'Professional Services',
            seniority: row.seniority.toUpperCase() as any,
            dailyRate: Number(row.dailyRateUSD),
            dailyRateUSD: Number(row.dailyRateUSD),
            dailyRateCHF: Number(row.dailyRateCHF || row.dailyRateUSD),
            currency: row.currency || 'USD',
            country: row.country,
            region: row.region || 'Not Specified',
            lineOfService: row.lineOfService || 'Professional Services',
            supplierId: row.supplierId || 'csv-import',
            supplierName: row.supplierName || 'Bulk Import',
            supplierTier: (row.supplierTier?.toUpperCase() || 'TIER_2') as any,
            supplierCountry: row.country,
            supplierRegion: row.region || 'Not Specified',
            effectiveDate: row.effectiveDate ? new Date(row.effectiveDate) : new Date(),
            expiryDate: row.expiryDate ? new Date(row.expiryDate) : null,
            source: 'CSV_UPLOAD',
            confidence: 0.90,
            dataQuality: 'MEDIUM',
            volumeCommitted: row.volumeCommitted ? Number(row.volumeCommitted) : 1,
            isNegotiated: row.isNegotiated === true || row.isNegotiated === 'true' || row.isNegotiated === 'yes',
            negotiationNotes: row.notes || null,
          }
        });

        results.imported++;
        results.imported_records.push(rateCardEntry);

      } catch (error: unknown) {
        results.invalid++;
        results.errors.push({
          row: rowNumber,
          data: row,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        });
      }
    }

    return NextResponse.json({
      success: results.invalid === 0 || results.imported > 0,
      validateOnly,
      summary: {
        total: results.total,
        valid: results.valid,
        invalid: results.invalid,
        imported: results.imported,
        errorCount: results.errors.length,
        warningCount: results.warnings.length
      },
      errors: results.errors,
      warnings: results.warnings,
      imported_records: validateOnly ? [] : results.imported_records
    });

  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rate-cards/import/csv/template
 * Download CSV template
 */
export async function GET() {
  const template = `roleOriginal,roleStandardized,seniority,supplierName,supplierTier,dailyRateUSD,currency,country,region,lineOfService,effectiveDate,expiryDate,volumeCommitted,isNegotiated,notes
Senior Software Engineer,Software Developer,SENIOR,TechConsult Inc,TIER_1,920,USD,United States,North America,Software Development,2025-01-01,2025-12-31,5,true,Sample entry
Mid-Level Data Scientist,Data Scientist,MID,Analytics Corp,TIER_2,750,USD,United States,North America,Data & Analytics,2025-01-01,,3,false,
Junior Business Analyst,Business Analyst,JUNIOR,Consulting Partners,TIER_3,450,USD,United Kingdom,Europe,Consulting,2025-02-01,,2,true,`;

  return new NextResponse(template, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="rate-cards-template.csv"'
    }
  });
}
