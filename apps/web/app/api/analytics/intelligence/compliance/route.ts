import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service';

/**
 * Compliance & Risk Scoring API Endpoints
 */

// GET /api/analytics/intelligence/compliance - Get compliance data and reports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'default';
    const contractId = searchParams.get('contractId');
    const supplierId = searchParams.get('supplierId');
    const riskLevel = searchParams.get('riskLevel');
    const clauseType = searchParams.get('clauseType');
    const reportType = searchParams.get('reportType') || 'summary'; // summary, detailed, trends

    if (contractId) {
      // Get compliance data for specific contract
      const complianceData = await analyticalIntelligenceService.getContractCompliance(contractId);
      return NextResponse.json({
        success: true,
        data: complianceData,
        timestamp: new Date().toISOString()
      });
    }

    const filters = {
      tenantId,
      ...(supplierId && { supplierId }),
      ...(riskLevel && { riskLevel }),
      ...(clauseType && { clauseType })
    };

    let result;

    switch (reportType) {
      case 'summary':
        result = await analyticalIntelligenceService.getComplianceSummary(filters);
        break;
      case 'detailed':
        result = await analyticalIntelligenceService.getComplianceReport(filters);
        break;
      case 'trends':
        result = await analyticalIntelligenceService.getComplianceTrends(filters);
        break;
      default:
        result = await analyticalIntelligenceService.getComplianceSummary(filters);
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get compliance data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get compliance data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/intelligence/compliance - Process compliance actions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, contractId, policies } = body;

    let result;

    switch (action) {
      case 'scan_contract':
        if (!contractId) {
          return NextResponse.json(
            { success: false, error: 'Contract ID is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.scanContractCompliance(contractId);
        break;
      
      case 'update_policies':
        if (!policies || !Array.isArray(policies)) {
          return NextResponse.json(
            { success: false, error: 'Policies array is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.updateCompliancePolicies(policies);
        break;
      
      case 'generate_remediation':
        if (!body.complianceResult) {
          return NextResponse.json(
            { success: false, error: 'Compliance result is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.generateRemediationPlan(body.complianceResult);
        break;
      
      case 'bulk_scan':
        const contractIds = body.contractIds;
        if (!contractIds || !Array.isArray(contractIds)) {
          return NextResponse.json(
            { success: false, error: 'Contract IDs array is required' },
            { status: 400 }
          );
        }
        result = await analyticalIntelligenceService.bulkComplianceScan(contractIds);
        break;
      
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action specified' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to process compliance action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process compliance action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}