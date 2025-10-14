import { NextRequest, NextResponse } from 'next/server';
import { dbAdaptor } from '../../../../../packages/data-orchestration/src/dal/database.adaptor';

/**
 * Enhanced Rate Taxonomy API
 * Provides access to taxonomy data for enhanced rate card system
 */

// GET /api/taxonomy/enhanced-rate-taxonomy - Get taxonomy data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const tenantId = searchParams.get('tenantId') || 'default';

    let result: any;

    switch (type) {
      case 'line-of-service':
        const losQuery = `
          SELECT * FROM line_of_service_taxonomy 
          WHERE tenant_id = ? 
          ORDER BY service_category, service_name
        `;
        result = await dbAdaptor.prisma.$queryRawUnsafe(losQuery, tenantId);
        break;

      case 'seniority':
        const seniorityQuery = `
          SELECT * FROM seniority_definitions 
          WHERE tenant_id = ? 
          ORDER BY level_order
        `;
        result = await dbAdaptor.prisma.$queryRawUnsafe(seniorityQuery, tenantId);
        break;

      case 'geographic':
        const geoQuery = `
          SELECT * FROM geographic_adjustments 
          ORDER BY country, state_province, city
        `;
        result = await dbAdaptor.prisma.$queryRawUnsafe(geoQuery);
        break;

      case 'skills':
        const skillsQuery = `
          SELECT * FROM skills_registry 
          ORDER BY skill_category, market_demand DESC, skill_name
        `;
        result = await dbAdaptor.prisma.$queryRawUnsafe(skillsQuery);
        break;

      case 'certifications':
        const certsQuery = `
          SELECT * FROM certifications_registry 
          ORDER BY market_value DESC, certification_name
        `;
        result = await dbAdaptor.prisma.$queryRawUnsafe(certsQuery);
        break;

      case 'service-categories':
        const categoriesQuery = `
          SELECT DISTINCT service_category, COUNT(*) as service_count
          FROM line_of_service_taxonomy 
          WHERE tenant_id = ?
          GROUP BY service_category
          ORDER BY service_category
        `;
        result = await dbAdaptor.prisma.$queryRawUnsafe(categoriesQuery, tenantId);
        break;

      case 'countries':
        const countriesQuery = `
          SELECT DISTINCT country, currency_code, COUNT(*) as location_count
          FROM geographic_adjustments 
          GROUP BY country, currency_code
          ORDER BY country
        `;
        result = await dbAdaptor.prisma.$queryRawUnsafe(countriesQuery);
        break;

      case 'skill-categories':
        const skillCategoriesQuery = `
          SELECT DISTINCT skill_category, COUNT(*) as skill_count,
                 AVG(premium_factor) as avg_premium_factor
          FROM skills_registry 
          GROUP BY skill_category
          ORDER BY avg_premium_factor DESC
        `;
        result = await dbAdaptor.prisma.$queryRawUnsafe(skillCategoriesQuery);
        break;

      case 'all':
        // Get all taxonomy data in one call
        const [
          lineOfService,
          seniority,
          geographic,
          skills,
          certifications
        ] = await Promise.all([
          dbAdaptor.prisma.$queryRawUnsafe(`
            SELECT * FROM line_of_service_taxonomy 
            WHERE tenant_id = ? 
            ORDER BY service_category, service_name
          `, tenantId),
          dbAdaptor.prisma.$queryRawUnsafe(`
            SELECT * FROM seniority_definitions 
            WHERE tenant_id = ? 
            ORDER BY level_order
          `, tenantId),
          dbAdaptor.prisma.$queryRawUnsafe(`
            SELECT * FROM geographic_adjustments 
            ORDER BY country, state_province, city
          `),
          dbAdaptor.prisma.$queryRawUnsafe(`
            SELECT * FROM skills_registry 
            ORDER BY skill_category, market_demand DESC, skill_name
          `),
          dbAdaptor.prisma.$queryRawUnsafe(`
            SELECT * FROM certifications_registry 
            ORDER BY market_value DESC, certification_name
          `)
        ]);

        result = {
          lineOfService,
          seniority,
          geographic,
          skills,
          certifications
        };
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid taxonomy type specified' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to fetch taxonomy data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch taxonomy data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/taxonomy/enhanced-rate-taxonomy - Add or update taxonomy data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, type, data, tenantId = 'default' } = body;

    let result: any;

    switch (action) {
      case 'add_line_of_service':
        if (!data.serviceName || !data.serviceCategory) {
          return NextResponse.json(
            { success: false, error: 'Service name and category are required' },
            { status: 400 }
          );
        }

        const insertLosQuery = `
          INSERT INTO line_of_service_taxonomy 
          (tenant_id, service_name, service_category, subcategory, description, typical_roles, skill_domains, market_segment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await dbAdaptor.prisma.$executeRawUnsafe(
          insertLosQuery,
          tenantId,
          data.serviceName,
          data.serviceCategory,
          data.subcategory || null,
          data.description || null,
          JSON.stringify(data.typicalRoles || []),
          JSON.stringify(data.skillDomains || []),
          data.marketSegment || 'Enterprise'
        );

        result = { message: 'Line of service added successfully' };
        break;

      case 'add_skill':
        if (!data.skillName || !data.skillCategory) {
          return NextResponse.json(
            { success: false, error: 'Skill name and category are required' },
            { status: 400 }
          );
        }

        const insertSkillQuery = `
          INSERT INTO skills_registry 
          (skill_name, skill_category, skill_level, market_demand, premium_factor, certifying_bodies, related_skills)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await dbAdaptor.prisma.$executeRawUnsafe(
          insertSkillQuery,
          data.skillName,
          data.skillCategory,
          data.skillLevel || null,
          data.marketDemand || 'Medium',
          data.premiumFactor || 1.0,
          JSON.stringify(data.certifyingBodies || []),
          JSON.stringify(data.relatedSkills || [])
        );

        result = { message: 'Skill added successfully' };
        break;

      case 'add_certification':
        if (!data.certificationName || !data.issuingOrganization) {
          return NextResponse.json(
            { success: false, error: 'Certification name and issuing organization are required' },
            { status: 400 }
          );
        }

        const insertCertQuery = `
          INSERT INTO certifications_registry 
          (certification_name, issuing_organization, certification_level, validity_period_months, 
           renewal_requirements, market_value, premium_factor, related_skills)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await dbAdaptor.prisma.$executeRawUnsafe(
          insertCertQuery,
          data.certificationName,
          data.issuingOrganization,
          data.certificationLevel || null,
          data.validityPeriodMonths || null,
          data.renewalRequirements || null,
          data.marketValue || 'Medium',
          data.premiumFactor || 1.0,
          JSON.stringify(data.relatedSkills || [])
        );

        result = { message: 'Certification added successfully' };
        break;

      case 'search':
        const { searchTerm, searchType } = data;
        if (!searchTerm || !searchType) {
          return NextResponse.json(
            { success: false, error: 'Search term and type are required' },
            { status: 400 }
          );
        }

        let searchQuery = '';
        let searchParams: any[] = [];

        switch (searchType) {
          case 'skills':
            searchQuery = `
              SELECT * FROM skills_registry 
              WHERE skill_name LIKE ? OR skill_category LIKE ?
              ORDER BY premium_factor DESC
              LIMIT 20
            `;
            searchParams = [`%${searchTerm}%`, `%${searchTerm}%`];
            break;

          case 'certifications':
            searchQuery = `
              SELECT * FROM certifications_registry 
              WHERE certification_name LIKE ? OR issuing_organization LIKE ?
              ORDER BY premium_factor DESC
              LIMIT 20
            `;
            searchParams = [`%${searchTerm}%`, `%${searchTerm}%`];
            break;

          case 'services':
            searchQuery = `
              SELECT * FROM line_of_service_taxonomy 
              WHERE service_name LIKE ? OR service_category LIKE ? OR description LIKE ?
              AND tenant_id = ?
              ORDER BY service_name
              LIMIT 20
            `;
            searchParams = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, tenantId];
            break;

          default:
            return NextResponse.json(
              { success: false, error: 'Invalid search type' },
              { status: 400 }
            );
        }

        result = await dbAdaptor.prisma.$queryRawUnsafe(searchQuery, ...searchParams);
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
    console.error('Failed to process taxonomy request:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process taxonomy request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}