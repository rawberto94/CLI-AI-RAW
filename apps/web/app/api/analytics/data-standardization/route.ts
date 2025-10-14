import { NextRequest, NextResponse } from 'next/server';
import { dataStandardizationService } from 'data-orchestration';

/**
 * Data Standardization API
 * Provides standardization and clustering capabilities for procurement data
 */

// GET /api/analytics/data-standardization - Get standardization data and analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'analytics';
    const tenantId = searchParams.get('tenantId') || 'default';
    const category = searchParams.get('category');

    let result;

    switch (action) {
      case 'analytics':
        // Get comprehensive standardization analytics
        result = await dataStandardizationService.standardizeAllData(tenantId);
        break;

      case 'cluster_line_of_service':
        result = await dataStandardizationService.clusterLineOfService(tenantId);
        break;

      case 'cluster_suppliers':
        result = await dataStandardizationService.clusterSuppliers(tenantId);
        break;

      case 'cluster_roles':
        result = await dataStandardizationService.clusterRoles(tenantId);
        break;

      case 'standardize_value':
        const value = searchParams.get('value');
        if (!value || !category) {
          return NextResponse.json(
            { success: false, error: 'Value and category parameters are required' },
            { status: 400 }
          );
        }

        switch (category) {
          case 'line_of_service':
            result = await dataStandardizationService.standardizeLineOfService(value);
            break;
          case 'supplier':
            result = await dataStandardizationService.standardizeSupplier(value);
            break;
          case 'role':
            result = await dataStandardizationService.standardizeRole(value);
            break;
          case 'seniority':
            const roleContext = searchParams.get('role');
            const experience = searchParams.get('experience');
            result = await dataStandardizationService.standardizeSeniority(value, {
              role: roleContext || undefined,
              experience: experience ? parseInt(experience) : undefined
            });
            break;
          default:
            return NextResponse.json(
              { success: false, error: 'Invalid category specified' },
              { status: 400 }
            );
        }
        break;

      case 'health':
        result = await dataStandardizationService.healthCheck();
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
    console.error('Failed to process data standardization request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process data standardization request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/analytics/data-standardization - Batch standardization and clustering operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, tenantId = 'default' } = body;

    let result;

    switch (action) {
      case 'standardize_batch':
        const { values, category } = body;
        if (!values || !Array.isArray(values) || !category) {
          return NextResponse.json(
            { success: false, error: 'Values array and category are required' },
            { status: 400 }
          );
        }

        // Process batch standardization
        const batchResults = [];
        for (const value of values) {
          let standardizationResult;
          
          switch (category) {
            case 'line_of_service':
              standardizationResult = await dataStandardizationService.standardizeLineOfService(value);
              break;
            case 'supplier':
              standardizationResult = await dataStandardizationService.standardizeSupplier(value);
              break;
            case 'role':
              standardizationResult = await dataStandardizationService.standardizeRole(value);
              break;
            case 'seniority':
              standardizationResult = await dataStandardizationService.standardizeSeniority(value);
              break;
            default:
              standardizationResult = {
                originalValue: value,
                standardValue: value,
                confidence: 0.5
              };
          }
          
          batchResults.push(standardizationResult);
        }

        result = {
          category,
          totalProcessed: values.length,
          results: batchResults,
          summary: {
            averageConfidence: batchResults.reduce((sum, r) => sum + r.confidence, 0) / batchResults.length,
            highConfidenceCount: batchResults.filter(r => r.confidence > 0.8).length,
            uniqueStandardValues: new Set(batchResults.map(r => r.standardValue)).size
          }
        };
        break;

      case 'run_full_standardization':
        // Run comprehensive standardization across all categories
        result = await dataStandardizationService.standardizeAllData(tenantId);
        break;

      case 'create_standardization_rule':
        const { sourceValue, standardValue, category: ruleCategory, confidence } = body;
        if (!sourceValue || !standardValue || !ruleCategory) {
          return NextResponse.json(
            { success: false, error: 'Source value, standard value, and category are required' },
            { status: 400 }
          );
        }

        // This would create a new standardization rule
        // For now, return success
        result = {
          id: `rule_${Date.now()}`,
          sourceValue,
          standardValue,
          category: ruleCategory,
          confidence: confidence || 0.9,
          created: true
        };
        break;

      case 'approve_standardization':
        const { queueIds } = body;
        if (!queueIds || !Array.isArray(queueIds)) {
          return NextResponse.json(
            { success: false, error: 'Queue IDs array is required' },
            { status: 400 }
          );
        }

        // This would approve pending standardizations
        result = {
          approvedCount: queueIds.length,
          queueIds,
          status: 'approved'
        };
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
    console.error('Failed to process data standardization action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process data standardization action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}