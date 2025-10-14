import { NextRequest, NextResponse } from 'next/server';
import { rateCalculationEngine } from '../../../../../packages/data-orchestration/src/services/rate-calculation.engine';

/**
 * Rate Calculation API
 * Provides rate calculation and conversion services
 */

// POST /api/analytics/rate-calculation - Perform rate calculations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    let result: any;

    switch (action) {
      case 'calculate_equivalent_rates':
        const { baseRate, baseUnit, billableHours = 8 } = body;
        if (!baseRate || !baseUnit) {
          return NextResponse.json(
            { success: false, error: 'Base rate and unit are required' },
            { status: 400 }
          );
        }
        result = rateCalculationEngine.calculateEquivalentRates(baseRate, baseUnit, billableHours);
        break;

      case 'apply_geographic_adjustment':
        const { rate, location } = body;
        if (!rate || !location) {
          return NextResponse.json(
            { success: false, error: 'Rate and location are required' },
            { status: 400 }
          );
        }
        result = await rateCalculationEngine.applyGeographicAdjustment(rate, location);
        break;

      case 'apply_skill_premiums':
        const { baseRateSkills, skills } = body;
        if (!baseRateSkills || !skills) {
          return NextResponse.json(
            { success: false, error: 'Base rate and skills are required' },
            { status: 400 }
          );
        }
        result = await rateCalculationEngine.applySkillPremiums(baseRateSkills, skills);
        break;

      case 'apply_certification_premiums':
        const { baseRateCerts, certifications } = body;
        if (!baseRateCerts || !certifications) {
          return NextResponse.json(
            { success: false, error: 'Base rate and certifications are required' },
            { status: 400 }
          );
        }
        result = await rateCalculationEngine.applyCertificationPremiums(baseRateCerts, certifications);
        break;

      case 'calculate_effective_rate':
        const { rateData, terms, hoursCommitted } = body;
        if (!rateData || !terms) {
          return NextResponse.json(
            { success: false, error: 'Rate data and terms are required' },
            { status: 400 }
          );
        }
        result = rateCalculationEngine.calculateEffectiveRate(rateData, terms, hoursCommitted);
        break;

      case 'calculate_escalated_rate':
        const { baseRateEsc, escalationPercentage, periods, compounding = true } = body;
        if (!baseRateEsc || escalationPercentage === undefined || !periods) {
          return NextResponse.json(
            { success: false, error: 'Base rate, escalation percentage, and periods are required' },
            { status: 400 }
          );
        }
        result = rateCalculationEngine.calculateEscalatedRate(baseRateEsc, escalationPercentage, periods, compounding);
        break;

      case 'calculate_escalation_schedule':
        const { baseRateSched, escalationPerc, startDate, endDate, frequency } = body;
        if (!baseRateSched || !escalationPerc || !startDate || !endDate || !frequency) {
          return NextResponse.json(
            { success: false, error: 'All schedule parameters are required' },
            { status: 400 }
          );
        }
        result = rateCalculationEngine.calculateEscalationSchedule(
          baseRateSched, 
          escalationPerc, 
          new Date(startDate), 
          new Date(endDate), 
          frequency
        );
        break;

      case 'calculate_total_cost':
        const { rateInfo, termsInfo, locationInfo, duration, skillsInfo, certificationsInfo } = body;
        if (!rateInfo || !termsInfo || !locationInfo || !duration) {
          return NextResponse.json(
            { success: false, error: 'Rate, terms, location, and duration are required' },
            { status: 400 }
          );
        }
        result = await rateCalculationEngine.calculateTotalCostOfEngagement(
          rateInfo, 
          termsInfo, 
          locationInfo, 
          duration, 
          skillsInfo, 
          certificationsInfo
        );
        break;

      case 'normalize_rate':
        const { rateToNormalize } = body;
        if (!rateToNormalize) {
          return NextResponse.json(
            { success: false, error: 'Rate data is required' },
            { status: 400 }
          );
        }
        result = rateCalculationEngine.normalizeRateToHourly(rateToNormalize);
        break;

      case 'calculate_blended_rate':
        const { rates } = body;
        if (!rates || !Array.isArray(rates)) {
          return NextResponse.json(
            { success: false, error: 'Rates array is required' },
            { status: 400 }
          );
        }
        result = rateCalculationEngine.calculateBlendedRate(rates);
        break;

      case 'health':
        result = await rateCalculationEngine.healthCheck();
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
    console.error('Failed to process rate calculation request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process rate calculation request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}