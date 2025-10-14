import { NextRequest, NextResponse } from 'next/server';
import { rateValidationService } from '../../../../../packages/data-orchestration/src/services/rate-validation.service';

/**
 * Rate Validation API
 * Provides validation services for enhanced rate card data
 */

// POST /api/analytics/rate-validation - Validate rate card data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case 'validate_rate_card':
        const { rateCard, rates } = body;
        if (!rateCard) {
          return NextResponse.json(
            { success: false, error: 'Rate card data is required' },
            { status: 400 }
          );
        }
        result = await rateValidationService.validateRateCard(rateCard, rates || []);
        break;

      case 'validate_rate_consistency':
        const { rate } = body;
        if (!rate) {
          return NextResponse.json(
            { success: false, error: 'Rate data is required' },
            { status: 400 }
          );
        }
        result = rateValidationService.validateRateConsistency(rate);
        break;

      case 'validate_geographic_data':
        const { location } = body;
        if (!location) {
          return NextResponse.json(
            { success: false, error: 'Location data is required' },
            { status: 400 }
          );
        }
        result = await rateValidationService.validateGeographicData(location);
        break;

      case 'validate_skill_requirements':
        const { skills, role } = body;
        if (!skills || !role) {
          return NextResponse.json(
            { success: false, error: 'Skills and role data are required' },
            { status: 400 }
          );
        }
        result = await rateValidationService.validateSkillRequirements(skills, role);
        break;

      case 'validate_seniority_alignment':
        const { seniority, roleParam, experience } = body;
        if (!seniority || !roleParam) {
          return NextResponse.json(
            { success: false, error: 'Seniority and role data are required' },
            { status: 400 }
          );
        }
        result = rateValidationService.validateSeniorityAlignment(seniority, roleParam, experience);
        break;

      case 'suggest_corrections':
        const { validationErrors } = body;
        if (!validationErrors || !Array.isArray(validationErrors)) {
          return NextResponse.json(
            { success: false, error: 'Validation errors array is required' },
            { status: 400 }
          );
        }
        result = rateValidationService.suggestCorrections(validationErrors);
        break;

      case 'health':
        result = await rateValidationService.healthCheck();
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
    console.error('Failed to process rate validation request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process rate validation request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}