/**
 * Seed Enhanced Rate Card Data
 * 
 * Populates the enhanced rate card system with:
 * - Line of service taxonomy
 * - Seniority definitions
 * - Geographic adjustments
 * - Skills and certifications registry
 */

import { dbAdaptor } from "../dal/database.adaptor";
import pino from "pino";

const logger = pino({ name: "seed-enhanced-rate-data" });

export class EnhancedRateDataSeeder {
  
  /**
   * Seed all enhanced rate card data
   */
  async seedAll(tenantId: string = 'default'): Promise<void> {
    try {
      logger.info({ tenantId }, "Starting enhanced rate card data seeding");

      await this.seedLineOfServiceTaxonomy(tenantId);
      await this.seedSeniorityDefinitions(tenantId);
      await this.seedGeographicAdjustments();
      await this.seedSkillsRegistry();
      await this.seedCertificationsRegistry();

      logger.info({ tenantId }, "Completed enhanced rate card data seeding");

    } catch (error) {
      logger.error({ error, tenantId }, "Failed to seed enhanced rate card data");
      throw error;
    }
  }

  /**
   * Seed line of service taxonomy
   */
  async seedLineOfServiceTaxonomy(tenantId: string): Promise<void> {
    try {
      logger.info({ tenantId }, "Seeding line of service taxonomy");

      const lineOfServices = [
        // Technology Services
        {
          service_name: 'Software Development',
          service_category: 'Technology',
          subcategory: 'Application Development',
          description: 'Custom software application development and maintenance',
          typical_roles: ['Software Developer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer'],
          skill_domains: ['Programming', 'Software Architecture', 'Database Design', 'API Development'],
          market_segment: 'Enterprise'
        },
        {
          service_name: 'Cloud Infrastructure',
          service_category: 'Technology',
          subcategory: 'Infrastructure',
          description: 'Cloud platform design, implementation, and management',
          typical_roles: ['Cloud Architect', 'DevOps Engineer', 'Infrastructure Engineer', 'Site Reliability Engineer'],
          skill_domains: ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Terraform', 'Docker'],
          market_segment: 'Enterprise'
        },
        {
          service_name: 'Data Analytics',
          service_category: 'Technology',
          subcategory: 'Data & Analytics',
          description: 'Data analysis, business intelligence, and data science services',
          typical_roles: ['Data Analyst', 'Data Scientist', 'Business Intelligence Developer', 'Data Engineer'],
          skill_domains: ['SQL', 'Python', 'R', 'Tableau', 'Power BI', 'Machine Learning'],
          market_segment: 'Enterprise'
        },
        {
          service_name: 'Cybersecurity',
          service_category: 'Technology',
          subcategory: 'Security',
          description: 'Information security consulting and implementation',
          typical_roles: ['Security Analyst', 'Security Architect', 'Penetration Tester', 'Security Consultant'],
          skill_domains: ['Network Security', 'Application Security', 'Compliance', 'Risk Assessment'],
          market_segment: 'Enterprise'
        },

        // Consulting Services
        {
          service_name: 'Management Consulting',
          service_category: 'Consulting',
          subcategory: 'Strategy',
          description: 'Strategic planning and organizational transformation consulting',
          typical_roles: ['Management Consultant', 'Strategy Consultant', 'Business Analyst', 'Change Manager'],
          skill_domains: ['Strategic Planning', 'Process Improvement', 'Change Management', 'Business Analysis'],
          market_segment: 'Enterprise'
        },
        {
          service_name: 'Digital Transformation',
          service_category: 'Consulting',
          subcategory: 'Technology Consulting',
          description: 'Digital strategy and technology transformation services',
          typical_roles: ['Digital Consultant', 'Technology Consultant', 'Solution Architect', 'Program Manager'],
          skill_domains: ['Digital Strategy', 'Technology Assessment', 'Process Automation', 'System Integration'],
          market_segment: 'Enterprise'
        },
        {
          service_name: 'Financial Advisory',
          service_category: 'Consulting',
          subcategory: 'Finance',
          description: 'Financial planning, analysis, and advisory services',
          typical_roles: ['Financial Analyst', 'Financial Consultant', 'Investment Advisor', 'Risk Analyst'],
          skill_domains: ['Financial Modeling', 'Risk Management', 'Investment Analysis', 'Regulatory Compliance'],
          market_segment: 'Enterprise'
        },

        // Creative Services
        {
          service_name: 'User Experience Design',
          service_category: 'Creative',
          subcategory: 'Design',
          description: 'User experience and interface design services',
          typical_roles: ['UX Designer', 'UI Designer', 'Product Designer', 'Design Researcher'],
          skill_domains: ['User Research', 'Prototyping', 'Visual Design', 'Interaction Design'],
          market_segment: 'Enterprise'
        },
        {
          service_name: 'Brand & Marketing',
          service_category: 'Creative',
          subcategory: 'Marketing',
          description: 'Brand strategy, marketing campaigns, and content creation',
          typical_roles: ['Brand Strategist', 'Marketing Manager', 'Content Creator', 'Graphic Designer'],
          skill_domains: ['Brand Strategy', 'Content Marketing', 'Social Media', 'Graphic Design'],
          market_segment: 'SMB'
        },

        // Operations Services
        {
          service_name: 'Project Management',
          service_category: 'Operations',
          subcategory: 'Program Management',
          description: 'Project and program management services',
          typical_roles: ['Project Manager', 'Program Manager', 'Scrum Master', 'Agile Coach'],
          skill_domains: ['Project Management', 'Agile Methodologies', 'Risk Management', 'Stakeholder Management'],
          market_segment: 'Enterprise'
        },
        {
          service_name: 'Business Process Optimization',
          service_category: 'Operations',
          subcategory: 'Process Improvement',
          description: 'Business process analysis and optimization',
          typical_roles: ['Process Analyst', 'Business Process Consultant', 'Lean Six Sigma Specialist'],
          skill_domains: ['Process Mapping', 'Lean Six Sigma', 'Workflow Automation', 'Performance Metrics'],
          market_segment: 'Enterprise'
        },

        // Finance Services
        {
          service_name: 'Financial Planning & Analysis',
          service_category: 'Finance',
          subcategory: 'FP&A',
          description: 'Financial planning, budgeting, and analysis services',
          typical_roles: ['Financial Analyst', 'FP&A Manager', 'Budget Analyst', 'Financial Planner'],
          skill_domains: ['Financial Modeling', 'Budgeting', 'Forecasting', 'Variance Analysis'],
          market_segment: 'Enterprise'
        },
        {
          service_name: 'Accounting & Bookkeeping',
          service_category: 'Finance',
          subcategory: 'Accounting',
          description: 'Accounting, bookkeeping, and financial reporting services',
          typical_roles: ['Accountant', 'Bookkeeper', 'Financial Reporting Specialist', 'Tax Specialist'],
          skill_domains: ['GAAP', 'Financial Reporting', 'Tax Preparation', 'Audit Support'],
          market_segment: 'SMB'
        },

        // Legal Services
        {
          service_name: 'Contract Management',
          service_category: 'Legal',
          subcategory: 'Commercial Law',
          description: 'Contract drafting, review, and management services',
          typical_roles: ['Contract Manager', 'Legal Counsel', 'Paralegal', 'Compliance Specialist'],
          skill_domains: ['Contract Law', 'Risk Assessment', 'Negotiation', 'Compliance'],
          market_segment: 'Enterprise'
        },
        {
          service_name: 'Regulatory Compliance',
          service_category: 'Legal',
          subcategory: 'Compliance',
          description: 'Regulatory compliance and risk management services',
          typical_roles: ['Compliance Officer', 'Regulatory Analyst', 'Risk Manager', 'Legal Advisor'],
          skill_domains: ['Regulatory Knowledge', 'Risk Assessment', 'Policy Development', 'Audit Management'],
          market_segment: 'Enterprise'
        }
      ];

      for (const service of lineOfServices) {
        const query = `
          INSERT OR REPLACE INTO line_of_service_taxonomy 
          (tenant_id, service_name, service_category, subcategory, description, typical_roles, skill_domains, market_segment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await dbAdaptor.prisma.$executeRawUnsafe(
          query,
          tenantId,
          service.service_name,
          service.service_category,
          service.subcategory,
          service.description,
          JSON.stringify(service.typical_roles),
          JSON.stringify(service.skill_domains),
          service.market_segment
        );
      }

      logger.info({ tenantId, count: lineOfServices.length }, "Seeded line of service taxonomy");

    } catch (error) {
      logger.error({ error, tenantId }, "Failed to seed line of service taxonomy");
      throw error;
    }
  }

  /**
   * Seed seniority definitions
   */
  async seedSeniorityDefinitions(tenantId: string): Promise<void> {
    try {
      logger.info({ tenantId }, "Seeding seniority definitions");

      const seniorityLevels = [
        {
          level_name: 'Junior',
          level_order: 1,
          min_experience_years: 0,
          max_experience_years: 3,
          typical_responsibilities: [
            'Execute assigned tasks under supervision',
            'Learn and apply basic skills and processes',
            'Participate in team meetings and training',
            'Follow established procedures and guidelines'
          ],
          skill_expectations: [
            'Basic technical skills in relevant domain',
            'Willingness to learn and adapt',
            'Good communication skills',
            'Attention to detail'
          ],
          leadership_scope: 'Individual contributor',
          decision_authority: 'Limited - requires approval for most decisions'
        },
        {
          level_name: 'Mid-Level',
          level_order: 2,
          min_experience_years: 2,
          max_experience_years: 6,
          typical_responsibilities: [
            'Complete projects independently with minimal supervision',
            'Mentor junior team members',
            'Contribute to process improvements',
            'Collaborate effectively with cross-functional teams'
          ],
          skill_expectations: [
            'Solid technical skills and domain knowledge',
            'Problem-solving abilities',
            'Project management basics',
            'Effective communication and collaboration'
          ],
          leadership_scope: 'May lead small projects or mentor juniors',
          decision_authority: 'Moderate - can make decisions within defined scope'
        },
        {
          level_name: 'Senior',
          level_order: 3,
          min_experience_years: 5,
          max_experience_years: 10,
          typical_responsibilities: [
            'Lead complex projects and initiatives',
            'Design solutions and make architectural decisions',
            'Mentor and develop team members',
            'Drive process improvements and best practices'
          ],
          skill_expectations: [
            'Advanced technical expertise',
            'Strong analytical and problem-solving skills',
            'Leadership and mentoring abilities',
            'Strategic thinking and planning'
          ],
          leadership_scope: 'Leads projects and small teams',
          decision_authority: 'High - can make significant technical and project decisions'
        },
        {
          level_name: 'Lead',
          level_order: 4,
          min_experience_years: 8,
          max_experience_years: 15,
          typical_responsibilities: [
            'Lead large, complex initiatives across multiple teams',
            'Set technical direction and standards',
            'Develop and coach senior team members',
            'Interface with stakeholders and clients'
          ],
          skill_expectations: [
            'Expert-level technical skills',
            'Strong leadership and people management',
            'Business acumen and strategic thinking',
            'Excellent communication and presentation skills'
          ],
          leadership_scope: 'Leads multiple teams or large projects',
          decision_authority: 'Very high - makes strategic decisions for area of responsibility'
        },
        {
          level_name: 'Principal',
          level_order: 5,
          min_experience_years: 12,
          max_experience_years: 20,
          typical_responsibilities: [
            'Define organizational strategy and vision',
            'Lead enterprise-wide initiatives',
            'Develop organizational capabilities and talent',
            'Represent organization externally'
          ],
          skill_expectations: [
            'Thought leadership in domain',
            'Executive presence and communication',
            'Organizational development skills',
            'Industry knowledge and network'
          ],
          leadership_scope: 'Organizational leadership across multiple functions',
          decision_authority: 'Executive level - makes strategic organizational decisions'
        },
        {
          level_name: 'Director',
          level_order: 6,
          min_experience_years: 15,
          max_experience_years: 25,
          typical_responsibilities: [
            'Set organizational direction and strategy',
            'Manage large teams and budgets',
            'Drive business growth and transformation',
            'Build strategic partnerships and relationships'
          ],
          skill_expectations: [
            'Executive leadership and management',
            'Strategic planning and execution',
            'Financial management and P&L responsibility',
            'Stakeholder management and influence'
          ],
          leadership_scope: 'Senior executive leadership',
          decision_authority: 'Full authority within area of responsibility'
        }
      ];

      for (const level of seniorityLevels) {
        const query = `
          INSERT OR REPLACE INTO seniority_definitions 
          (tenant_id, level_name, level_order, min_experience_years, max_experience_years, 
           typical_responsibilities, skill_expectations, leadership_scope, decision_authority)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await dbAdaptor.prisma.$executeRawUnsafe(
          query,
          tenantId,
          level.level_name,
          level.level_order,
          level.min_experience_years,
          level.max_experience_years,
          JSON.stringify(level.typical_responsibilities),
          JSON.stringify(level.skill_expectations),
          level.leadership_scope,
          level.decision_authority
        );
      }

      logger.info({ tenantId, count: seniorityLevels.length }, "Seeded seniority definitions");

    } catch (error) {
      logger.error({ error, tenantId }, "Failed to seed seniority definitions");
      throw error;
    }
  }

  /**
   * Seed geographic adjustments
   */
  async seedGeographicAdjustments(): Promise<void> {
    try {
      logger.info("Seeding geographic adjustments");

      const geographicData = [
        // United States
        { country: 'USA', state_province: 'CA', city: 'San Francisco', cost_of_living_index: 180, currency_code: 'USD' },
        { country: 'USA', state_province: 'CA', city: 'Los Angeles', cost_of_living_index: 150, currency_code: 'USD' },
        { country: 'USA', state_province: 'NY', city: 'New York', cost_of_living_index: 170, currency_code: 'USD' },
        { country: 'USA', state_province: 'WA', city: 'Seattle', cost_of_living_index: 160, currency_code: 'USD' },
        { country: 'USA', state_province: 'TX', city: 'Austin', cost_of_living_index: 120, currency_code: 'USD' },
        { country: 'USA', state_province: 'TX', city: 'Dallas', cost_of_living_index: 110, currency_code: 'USD' },
        { country: 'USA', state_province: 'IL', city: 'Chicago', cost_of_living_index: 125, currency_code: 'USD' },
        { country: 'USA', state_province: 'FL', city: 'Miami', cost_of_living_index: 115, currency_code: 'USD' },

        // Canada
        { country: 'CAN', state_province: 'ON', city: 'Toronto', cost_of_living_index: 130, currency_code: 'CAD' },
        { country: 'CAN', state_province: 'BC', city: 'Vancouver', cost_of_living_index: 140, currency_code: 'CAD' },
        { country: 'CAN', state_province: 'QC', city: 'Montreal', cost_of_living_index: 110, currency_code: 'CAD' },
        { country: 'CAN', state_province: 'AB', city: 'Calgary', cost_of_living_index: 115, currency_code: 'CAD' },

        // United Kingdom
        { country: 'GBR', state_province: 'England', city: 'London', cost_of_living_index: 160, currency_code: 'GBP' },
        { country: 'GBR', state_province: 'England', city: 'Manchester', cost_of_living_index: 120, currency_code: 'GBP' },
        { country: 'GBR', state_province: 'Scotland', city: 'Edinburgh', cost_of_living_index: 125, currency_code: 'GBP' },

        // Australia
        { country: 'AUS', state_province: 'NSW', city: 'Sydney', cost_of_living_index: 145, currency_code: 'AUD' },
        { country: 'AUS', state_province: 'VIC', city: 'Melbourne', cost_of_living_index: 135, currency_code: 'AUD' },
        { country: 'AUS', state_province: 'QLD', city: 'Brisbane', cost_of_living_index: 120, currency_code: 'AUD' },

        // India
        { country: 'IND', state_province: 'Karnataka', city: 'Bangalore', cost_of_living_index: 45, currency_code: 'INR' },
        { country: 'IND', state_province: 'Maharashtra', city: 'Mumbai', cost_of_living_index: 50, currency_code: 'INR' },
        { country: 'IND', state_province: 'Delhi', city: 'New Delhi', cost_of_living_index: 48, currency_code: 'INR' },
        { country: 'IND', state_province: 'Tamil Nadu', city: 'Chennai', cost_of_living_index: 42, currency_code: 'INR' },

        // Germany
        { country: 'DEU', state_province: 'Bavaria', city: 'Munich', cost_of_living_index: 130, currency_code: 'EUR' },
        { country: 'DEU', state_province: 'Berlin', city: 'Berlin', cost_of_living_index: 115, currency_code: 'EUR' },
        { country: 'DEU', state_province: 'North Rhine-Westphalia', city: 'Cologne', cost_of_living_index: 120, currency_code: 'EUR' },

        // France
        { country: 'FRA', state_province: 'Île-de-France', city: 'Paris', cost_of_living_index: 140, currency_code: 'EUR' },
        { country: 'FRA', state_province: 'Provence-Alpes-Côte d\'Azur', city: 'Nice', cost_of_living_index: 125, currency_code: 'EUR' },

        // Japan
        { country: 'JPN', state_province: 'Tokyo', city: 'Tokyo', cost_of_living_index: 155, currency_code: 'JPY' },
        { country: 'JPN', state_province: 'Osaka', city: 'Osaka', cost_of_living_index: 130, currency_code: 'JPY' }
      ];

      for (const geo of geographicData) {
        const query = `
          INSERT OR REPLACE INTO geographic_adjustments 
          (country, state_province, city, cost_of_living_index, currency_code, data_source)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

        await dbAdaptor.prisma.$executeRawUnsafe(
          query,
          geo.country,
          geo.state_province,
          geo.city,
          geo.cost_of_living_index,
          geo.currency_code,
          'Internal Seed Data'
        );
      }

      logger.info({ count: geographicData.length }, "Seeded geographic adjustments");

    } catch (error) {
      logger.error({ error }, "Failed to seed geographic adjustments");
      throw error;
    }
  }

  /**
   * Seed skills registry
   */
  async seedSkillsRegistry(): Promise<void> {
    try {
      logger.info("Seeding skills registry");

      const skills = [
        // Technical Skills - Programming
        { skill_name: 'JavaScript', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.1 },
        { skill_name: 'Python', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.15 },
        { skill_name: 'Java', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.1 },
        { skill_name: 'C#', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'Medium', premium_factor: 1.05 },
        { skill_name: 'TypeScript', skill_category: 'Technical', skill_level: 'Intermediate', market_demand: 'High', premium_factor: 1.2 },
        { skill_name: 'Go', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.25 },
        { skill_name: 'Rust', skill_category: 'Technical', skill_level: 'Expert', market_demand: 'Critical', premium_factor: 1.4 },

        // Technical Skills - Cloud & Infrastructure
        { skill_name: 'AWS', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'Critical', premium_factor: 1.3 },
        { skill_name: 'Azure', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.25 },
        { skill_name: 'Google Cloud Platform', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.2 },
        { skill_name: 'Kubernetes', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'Critical', premium_factor: 1.35 },
        { skill_name: 'Docker', skill_category: 'Technical', skill_level: 'Intermediate', market_demand: 'High', premium_factor: 1.15 },
        { skill_name: 'Terraform', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.25 },

        // Technical Skills - Data & Analytics
        { skill_name: 'SQL', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.1 },
        { skill_name: 'Machine Learning', skill_category: 'Technical', skill_level: 'Expert', market_demand: 'Critical', premium_factor: 1.5 },
        { skill_name: 'Data Science', skill_category: 'Technical', skill_level: 'Expert', market_demand: 'Critical', premium_factor: 1.45 },
        { skill_name: 'Tableau', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'Medium', premium_factor: 1.1 },
        { skill_name: 'Power BI', skill_category: 'Technical', skill_level: 'Advanced', market_demand: 'Medium', premium_factor: 1.05 },

        // Technical Skills - Security
        { skill_name: 'Cybersecurity', skill_category: 'Technical', skill_level: 'Expert', market_demand: 'Critical', premium_factor: 1.4 },
        { skill_name: 'Penetration Testing', skill_category: 'Technical', skill_level: 'Expert', market_demand: 'High', premium_factor: 1.3 },
        { skill_name: 'Security Architecture', skill_category: 'Technical', skill_level: 'Expert', market_demand: 'Critical', premium_factor: 1.35 },

        // Domain Skills
        { skill_name: 'Financial Modeling', skill_category: 'Domain', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.2 },
        { skill_name: 'Business Analysis', skill_category: 'Domain', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.15 },
        { skill_name: 'Project Management', skill_category: 'Domain', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.1 },
        { skill_name: 'Digital Marketing', skill_category: 'Domain', skill_level: 'Advanced', market_demand: 'Medium', premium_factor: 1.05 },
        { skill_name: 'UX Design', skill_category: 'Domain', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.2 },

        // Soft Skills
        { skill_name: 'Leadership', skill_category: 'Soft', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.15 },
        { skill_name: 'Communication', skill_category: 'Soft', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.05 },
        { skill_name: 'Problem Solving', skill_category: 'Soft', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.1 },
        { skill_name: 'Strategic Thinking', skill_category: 'Soft', skill_level: 'Expert', market_demand: 'High', premium_factor: 1.2 },
        { skill_name: 'Team Management', skill_category: 'Soft', skill_level: 'Advanced', market_demand: 'High', premium_factor: 1.15 }
      ];

      for (const skill of skills) {
        const query = `
          INSERT OR REPLACE INTO skills_registry 
          (skill_name, skill_category, skill_level, market_demand, premium_factor)
          VALUES (?, ?, ?, ?, ?)
        `;

        await dbAdaptor.prisma.$executeRawUnsafe(
          query,
          skill.skill_name,
          skill.skill_category,
          skill.skill_level,
          skill.market_demand,
          skill.premium_factor
        );
      }

      logger.info({ count: skills.length }, "Seeded skills registry");

    } catch (error) {
      logger.error({ error }, "Failed to seed skills registry");
      throw error;
    }
  }

  /**
   * Seed certifications registry
   */
  async seedCertificationsRegistry(): Promise<void> {
    try {
      logger.info("Seeding certifications registry");

      const certifications = [
        // AWS Certifications
        { certification_name: 'AWS Certified Solutions Architect - Professional', issuing_organization: 'Amazon Web Services', validity_period_months: 36, market_value: 'Premium', premium_factor: 1.4 },
        { certification_name: 'AWS Certified Solutions Architect - Associate', issuing_organization: 'Amazon Web Services', validity_period_months: 36, market_value: 'High', premium_factor: 1.25 },
        { certification_name: 'AWS Certified DevOps Engineer - Professional', issuing_organization: 'Amazon Web Services', validity_period_months: 36, market_value: 'Premium', premium_factor: 1.35 },

        // Microsoft Certifications
        { certification_name: 'Microsoft Certified: Azure Solutions Architect Expert', issuing_organization: 'Microsoft', validity_period_months: 24, market_value: 'Premium', premium_factor: 1.3 },
        { certification_name: 'Microsoft Certified: Azure Developer Associate', issuing_organization: 'Microsoft', validity_period_months: 24, market_value: 'High', premium_factor: 1.2 },

        // Google Cloud Certifications
        { certification_name: 'Google Cloud Professional Cloud Architect', issuing_organization: 'Google Cloud', validity_period_months: 24, market_value: 'High', premium_factor: 1.25 },
        { certification_name: 'Google Cloud Professional Data Engineer', issuing_organization: 'Google Cloud', validity_period_months: 24, market_value: 'High', premium_factor: 1.3 },

        // Security Certifications
        { certification_name: 'Certified Information Systems Security Professional (CISSP)', issuing_organization: 'ISC2', validity_period_months: 36, market_value: 'Premium', premium_factor: 1.5 },
        { certification_name: 'Certified Ethical Hacker (CEH)', issuing_organization: 'EC-Council', validity_period_months: 36, market_value: 'High', premium_factor: 1.3 },
        { certification_name: 'CompTIA Security+', issuing_organization: 'CompTIA', validity_period_months: 36, market_value: 'Medium', premium_factor: 1.15 },

        // Project Management Certifications
        { certification_name: 'Project Management Professional (PMP)', issuing_organization: 'PMI', validity_period_months: 36, market_value: 'High', premium_factor: 1.2 },
        { certification_name: 'Certified ScrumMaster (CSM)', issuing_organization: 'Scrum Alliance', validity_period_months: 24, market_value: 'Medium', premium_factor: 1.1 },
        { certification_name: 'SAFe Agilist', issuing_organization: 'Scaled Agile', validity_period_months: 12, market_value: 'Medium', premium_factor: 1.15 },

        // Data & Analytics Certifications
        { certification_name: 'Certified Analytics Professional (CAP)', issuing_organization: 'INFORMS', validity_period_months: 36, market_value: 'High', premium_factor: 1.25 },
        { certification_name: 'Tableau Desktop Certified Professional', issuing_organization: 'Tableau', validity_period_months: 24, market_value: 'Medium', premium_factor: 1.1 },

        // Financial Certifications
        { certification_name: 'Chartered Financial Analyst (CFA)', issuing_organization: 'CFA Institute', validity_period_months: null, market_value: 'Premium', premium_factor: 1.4 },
        { certification_name: 'Financial Risk Manager (FRM)', issuing_organization: 'GARP', validity_period_months: null, market_value: 'High', premium_factor: 1.3 },
        { certification_name: 'Certified Public Accountant (CPA)', issuing_organization: 'AICPA', validity_period_months: null, market_value: 'High', premium_factor: 1.25 },

        // Technology Certifications
        { certification_name: 'Certified Kubernetes Administrator (CKA)', issuing_organization: 'CNCF', validity_period_months: 36, market_value: 'High', premium_factor: 1.3 },
        { certification_name: 'HashiCorp Certified: Terraform Associate', issuing_organization: 'HashiCorp', validity_period_months: 24, market_value: 'Medium', premium_factor: 1.2 },

        // Design Certifications
        { certification_name: 'Adobe Certified Expert (ACE)', issuing_organization: 'Adobe', validity_period_months: 24, market_value: 'Medium', premium_factor: 1.1 },
        { certification_name: 'Google UX Design Certificate', issuing_organization: 'Google', validity_period_months: null, market_value: 'Medium', premium_factor: 1.15 }
      ];

      for (const cert of certifications) {
        const query = `
          INSERT OR REPLACE INTO certifications_registry 
          (certification_name, issuing_organization, validity_period_months, market_value, premium_factor)
          VALUES (?, ?, ?, ?, ?)
        `;

        await dbAdaptor.prisma.$executeRawUnsafe(
          query,
          cert.certification_name,
          cert.issuing_organization,
          cert.validity_period_months,
          cert.market_value,
          cert.premium_factor
        );
      }

      logger.info({ count: certifications.length }, "Seeded certifications registry");

    } catch (error) {
      logger.error({ error }, "Failed to seed certifications registry");
      throw error;
    }
  }

  /**
   * Health check for the seeder
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test database connectivity
      const testQuery = "SELECT 1 as test";
      await dbAdaptor.prisma.$queryRawUnsafe(testQuery);
      return true;
    } catch (error) {
      logger.error({ error }, "Enhanced rate data seeder health check failed");
      return false;
    }
  }
}

export const enhancedRateDataSeeder = new EnhancedRateDataSeeder();

// CLI execution
if (require.main === module) {
  const tenantId = process.argv[2] || 'default';
  
  enhancedRateDataSeeder.seedAll(tenantId)
    .then(() => {
      console.log('✅ Enhanced rate card data seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Enhanced rate card data seeding failed:', error);
      process.exit(1);
    });
}