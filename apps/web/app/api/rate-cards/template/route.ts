/**
 * CSV Template Generator API
 * GET /api/rate-cards/template
 * Generates a CSV template for bulk rate card upload
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Define CSV headers with descriptions
    const headers = [
      'supplierName',
      'supplierTier',
      'supplierCountry',
      'roleOriginal',
      'roleStandardized',
      'seniority',
      'lineOfService',
      'roleCategory',
      'dailyRate',
      'currency',
      'country',
      'region',
      'city',
      'effectiveDate',
      'expiryDate',
      'isNegotiated',
      'negotiationNotes',
      'skills',
      'certifications',
    ];

    // Example row with sample data
    const exampleRow = [
      'Acme Consulting LLC',
      'TIER_2',
      'United States',
      'Senior Software Engineer',
      'Software Engineer',
      'SENIOR',
      'Technology Consulting',
      'Engineering',
      '1200',
      'USD',
      'United States',
      'Americas',
      'New York',
      '2025-01-01',
      '2025-12-31',
      'true',
      'Negotiated 10% discount',
      'React, Node.js, AWS',
      'AWS Solutions Architect',
    ];

    // Field descriptions row
    const descriptions = [
      'Supplier/Vendor name (required)',
      'BIG_4, TIER_2, BOUTIQUE, or OFFSHORE',
      'Supplier country',
      'Role name as in contract (required)',
      'Standardized role name (leave empty for auto-standardization)',
      'JUNIOR, MID, SENIOR, PRINCIPAL, or PARTNER (required)',
      'e.g., Technology Consulting, Finance Advisory',
      'e.g., Engineering, Consulting, Finance',
      'Daily rate amount (required)',
      'USD, EUR, GBP, CHF, CAD, AUD, or INR (required)',
      'Work location country (required)',
      'e.g., Americas, EMEA, APAC',
      'City (optional)',
      'YYYY-MM-DD format (required)',
      'YYYY-MM-DD format (optional)',
      'true or false',
      'Notes about negotiation (optional)',
      'Comma-separated skills',
      'Comma-separated certifications',
    ];

    // Validation rules row
    const validationRules = [
      'Text, max 200 chars',
      'Must be one of: BIG_4, TIER_2, BOUTIQUE, OFFSHORE',
      'Text, max 100 chars',
      'Text, max 200 chars',
      'Text, max 200 chars (auto-filled if empty)',
      'Must be one of: JUNIOR, MID, SENIOR, PRINCIPAL, PARTNER',
      'Text, max 200 chars',
      'Text, max 100 chars',
      'Number, must be positive',
      'Must be one of: USD, EUR, GBP, CHF, CAD, AUD, INR',
      'Text, max 100 chars',
      'Text, max 100 chars',
      'Text, max 100 chars',
      'Date in YYYY-MM-DD format',
      'Date in YYYY-MM-DD format',
      'Boolean: true or false',
      'Text, max 500 chars',
      'Text, comma-separated',
      'Text, comma-separated',
    ];

    // Build CSV content
    const csvRows = [
      headers.join(','),
      descriptions.map((d) => `"${d}"`).join(','),
      validationRules.map((r) => `"${r}"`).join(','),
      '', // Empty row separator
      exampleRow.map((v) => `"${v}"`).join(','),
    ];

    const csvContent = csvRows.join('\n');

    // Return as downloadable file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="rate-cards-template.csv"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
