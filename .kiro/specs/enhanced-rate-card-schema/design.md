# Enhanced Rate Card Schema Design

## Overview

This design enhances the existing rate card system by adding comprehensive fields for line of service, seniority levels, geographic data, skill requirements, contract terms, and metadata. The enhancement maintains backward compatibility while providing rich data for advanced analytics and benchmarking.

## Architecture

### Database Schema Enhancements

The design extends the existing `rate_cards` and `rates` tables with additional fields and introduces new supporting tables for standardized taxonomies and metadata management.

#### Enhanced Rate Cards Table

```sql
-- Enhanced rate_cards table with additional fields
ALTER TABLE rate_cards ADD COLUMN line_of_service VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN country VARCHAR(3); -- ISO 3166-1 alpha-3
ALTER TABLE rate_cards ADD COLUMN state_province VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN city VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN cost_of_living_index DECIMAL(5,2);
ALTER TABLE rate_cards ADD COLUMN business_unit VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN cost_center VARCHAR(50);
ALTER TABLE rate_cards ADD COLUMN project_type VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN engagement_model VARCHAR(50); -- 'Staff Aug', 'Project', 'Outcome'
ALTER TABLE rate_cards ADD COLUMN payment_terms VARCHAR(100);
ALTER TABLE rate_cards ADD COLUMN minimum_commitment_hours INTEGER;
ALTER TABLE rate_cards ADD COLUMN volume_discount_tiers JSON;
ALTER TABLE rate_cards ADD COLUMN escalation_percentage DECIMAL(5,2);
ALTER TABLE rate_cards ADD COLUMN escalation_frequency VARCHAR(20); -- 'Annual', 'Quarterly'
ALTER TABLE rate_cards ADD COLUMN review_cycle_months INTEGER;
ALTER TABLE rate_cards ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE rate_cards ADD COLUMN approved_by TEXT;
ALTER TABLE rate_cards ADD COLUMN approved_at DATETIME;
ALTER TABLE rate_cards ADD COLUMN approval_notes TEXT;
```

#### Enhanced Rates Table

```sql
-- Enhanced rates table with comprehensive rate structures
ALTER TABLE rates ADD COLUMN seniority_level VARCHAR(50); -- 'Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director'
ALTER TABLE rates ADD COLUMN weekly_rate DECIMAL(10,2);
ALTER TABLE rates ADD COLUMN annual_rate DECIMAL(12,2);
ALTER TABLE rates ADD COLUMN overtime_multiplier DECIMAL(3,2) DEFAULT 1.5;
ALTER TABLE rates ADD COLUMN required_skills JSON; -- Array of skill requirements
ALTER TABLE rates ADD COLUMN required_certifications JSON; -- Array of certifications
ALTER TABLE rates ADD COLUMN minimum_experience_years INTEGER;
ALTER TABLE rates ADD COLUMN security_clearance_required BOOLEAN DEFAULT FALSE;
ALTER TABLE rates ADD COLUMN remote_work_allowed BOOLEAN DEFAULT TRUE;
ALTER TABLE rates ADD COLUMN travel_percentage INTEGER DEFAULT 0;
ALTER TABLE rates ADD COLUMN rate_type VARCHAR(20) DEFAULT 'standard'; -- 'standard', 'premium', 'discount'
ALTER TABLE rates ADD COLUMN effective_start_date DATE;
ALTER TABLE rates ADD COLUMN effective_end_date DATE;
ALTER TABLE rates ADD COLUMN markup_percentage DECIMAL(5,2);
ALTER TABLE rates ADD COLUMN cost_rate DECIMAL(10,2); -- Internal cost for margin calculation
```

### New Supporting Tables

#### Line of Service Taxonomy

```sql
CREATE TABLE line_of_service_taxonomy (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_category VARCHAR(50) NOT NULL, -- 'Technology', 'Consulting', 'Creative', 'Operations'
    subcategory VARCHAR(100),
    description TEXT,
    typical_roles JSON, -- Array of common roles
    skill_domains JSON, -- Array of skill areas
    market_segment VARCHAR(50), -- 'Enterprise', 'SMB', 'Government'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, service_name)
);
```

#### Seniority Level Definitions

```sql
CREATE TABLE seniority_definitions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    level_name VARCHAR(50) NOT NULL,
    level_order INTEGER NOT NULL, -- 1=Junior, 2=Mid, 3=Senior, etc.
    min_experience_years INTEGER,
    max_experience_years INTEGER,
    typical_responsibilities JSON,
    skill_expectations JSON,
    leadership_scope VARCHAR(100),
    decision_authority VARCHAR(100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, level_name)
);
```

#### Geographic Cost Adjustments

```sql
CREATE TABLE geographic_adjustments (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    country VARCHAR(3) NOT NULL,
    state_province VARCHAR(100),
    city VARCHAR(100),
    cost_of_living_index DECIMAL(5,2) NOT NULL, -- Base 100
    currency_code VARCHAR(3) NOT NULL,
    tax_implications JSON,
    labor_market_conditions JSON,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_source VARCHAR(100),
    UNIQUE(country, state_province, city)
);
```

#### Skills and Certifications Registry

```sql
CREATE TABLE skills_registry (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    skill_name VARCHAR(100) NOT NULL,
    skill_category VARCHAR(50) NOT NULL, -- 'Technical', 'Soft', 'Domain'
    skill_level VARCHAR(20), -- 'Basic', 'Intermediate', 'Advanced', 'Expert'
    market_demand VARCHAR(20), -- 'Low', 'Medium', 'High', 'Critical'
    premium_factor DECIMAL(3,2) DEFAULT 1.0, -- Rate multiplier for this skill
    certifying_bodies JSON,
    related_skills JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skill_name, skill_level)
);

CREATE TABLE certifications_registry (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    certification_name VARCHAR(200) NOT NULL,
    issuing_organization VARCHAR(100) NOT NULL,
    certification_level VARCHAR(50),
    validity_period_months INTEGER,
    renewal_requirements TEXT,
    market_value VARCHAR(20), -- 'Low', 'Medium', 'High', 'Premium'
    premium_factor DECIMAL(3,2) DEFAULT 1.0,
    related_skills JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(certification_name, issuing_organization)
);
```

#### Rate Approval Workflow

```sql
CREATE TABLE rate_approval_workflow (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rate_card_id TEXT NOT NULL,
    workflow_step INTEGER NOT NULL,
    approver_role VARCHAR(100) NOT NULL,
    required_approver TEXT, -- Specific person if needed
    approval_threshold DECIMAL(10,2), -- Rate threshold requiring this approval
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    approved_by TEXT,
    approved_at DATETIME,
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rate_card_id) REFERENCES rate_cards(id) ON DELETE CASCADE
);
```

#### Rate Change History

```sql
CREATE TABLE rate_change_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    rate_id TEXT NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_reason VARCHAR(200),
    changed_by TEXT NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approval_required BOOLEAN DEFAULT FALSE,
    approved_by TEXT,
    approved_at DATETIME,
    FOREIGN KEY (rate_id) REFERENCES rates(id) ON DELETE CASCADE
);
```

## Components and Interfaces

### Enhanced Rate Card Service

```typescript
interface EnhancedRateCard {
  id: string;
  contractId: string;
  supplierId: string;
  tenantId: string;
  effectiveDate: Date;
  currency: string;
  region: string;
  deliveryModel: string;
  
  // New fields
  lineOfService: string;
  country: string;
  stateProvince?: string;
  city?: string;
  costOfLivingIndex?: number;
  businessUnit?: string;
  costCenter?: string;
  projectType?: string;
  engagementModel: 'Staff Augmentation' | 'Project' | 'Outcome';
  paymentTerms?: string;
  minimumCommitmentHours?: number;
  volumeDiscountTiers?: VolumeDiscount[];
  escalationPercentage?: number;
  escalationFrequency?: 'Annual' | 'Quarterly';
  reviewCycleMonths?: number;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
}

interface EnhancedRate {
  id: string;
  rateCardId: string;
  role: string;
  level?: string;
  seniorityLevel: 'Junior' | 'Mid-Level' | 'Senior' | 'Lead' | 'Principal' | 'Director';
  
  // Rate structures
  hourlyRate?: number;
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  annualRate?: number;
  overtimeMultiplier: number;
  
  // Requirements and qualifications
  requiredSkills: Skill[];
  requiredCertifications: Certification[];
  minimumExperienceYears?: number;
  securityClearanceRequired: boolean;
  remoteWorkAllowed: boolean;
  travelPercentage: number;
  
  // Rate metadata
  rateType: 'standard' | 'premium' | 'discount';
  effectiveStartDate?: Date;
  effectiveEndDate?: Date;
  markupPercentage?: number;
  costRate?: number;
}
```

### Rate Calculation Engine

```typescript
class RateCalculationEngine {
  calculateEquivalentRates(baseRate: number, baseUnit: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'annual'): RateStructure;
  applyGeographicAdjustment(rate: number, location: Location): number;
  applySkillPremiums(rate: number, skills: Skill[]): number;
  applyCertificationPremiums(rate: number, certifications: Certification[]): number;
  calculateEffectiveRate(rate: EnhancedRate, terms: ContractTerms): number;
  calculateEscalatedRate(rate: number, escalationPercentage: number, periods: number): number;
}
```

### Enhanced Analytics Service

```typescript
class EnhancedRateAnalyticsService {
  analyzeByLineOfService(tenantId: string, filters?: AnalyticsFilters): LineOfServiceAnalytics;
  analyzeBySeniority(tenantId: string, filters?: AnalyticsFilters): SeniorityAnalytics;
  analyzeByGeography(tenantId: string, filters?: AnalyticsFilters): GeographicAnalytics;
  analyzeSkillPremiums(tenantId: string, filters?: AnalyticsFilters): SkillPremiumAnalytics;
  generateMarketBenchmarks(role: string, seniority: string, location: Location): MarketBenchmark;
  calculateTotalCostOfEngagement(rates: EnhancedRate[], terms: ContractTerms, duration: number): CostAnalysis;
}
```

## Data Models

### Core Data Structures

```typescript
interface VolumeDiscount {
  minimumHours: number;
  discountPercentage: number;
  description?: string;
}

interface Skill {
  name: string;
  category: 'Technical' | 'Soft' | 'Domain';
  level: 'Basic' | 'Intermediate' | 'Advanced' | 'Expert';
  required: boolean;
  premiumFactor?: number;
}

interface Certification {
  name: string;
  issuingOrganization: string;
  level?: string;
  required: boolean;
  validityPeriodMonths?: number;
  premiumFactor?: number;
}

interface Location {
  country: string;
  stateProvince?: string;
  city?: string;
  costOfLivingIndex?: number;
}

interface ContractTerms {
  paymentTerms: string;
  minimumCommitment?: number;
  volumeDiscounts?: VolumeDiscount[];
  penaltyClauses?: string[];
  performanceBonuses?: string[];
}
```

### Analytics Data Models

```typescript
interface LineOfServiceAnalytics {
  serviceBreakdown: Array<{
    service: string;
    averageRate: number;
    rateCount: number;
    marketPosition: number;
    trendDirection: 'up' | 'down' | 'stable';
  }>;
  crossServiceComparison: ServiceComparison[];
  recommendations: string[];
}

interface SeniorityAnalytics {
  seniorityProgression: Array<{
    level: string;
    averageRate: number;
    rateRange: { min: number; max: number };
    marketBenchmark: number;
    progressionGap?: number;
  }>;
  careerPathAnalysis: CareerPath[];
  gapAnalysis: SeniorityGap[];
}

interface GeographicAnalytics {
  locationBreakdown: Array<{
    location: Location;
    averageRate: number;
    adjustedRate: number;
    marketCompetitiveness: number;
    costAdvantage: number;
  }>;
  heatMapData: GeoHeatMapPoint[];
  arbitrageOpportunities: ArbitrageOpportunity[];
}
```

## Error Handling

### Validation Rules

1. **Rate Consistency**: Ensure all rate formats (hourly, daily, etc.) are mathematically consistent
2. **Geographic Validation**: Validate country/state/city combinations against standard geographic databases
3. **Skill Validation**: Ensure skills and certifications exist in the registry
4. **Seniority Validation**: Validate seniority levels against role expectations
5. **Date Validation**: Ensure effective dates don't overlap for the same role/supplier combination

### Error Recovery

```typescript
class RateValidationService {
  validateRateConsistency(rate: EnhancedRate): ValidationResult;
  validateGeographicData(location: Location): ValidationResult;
  validateSkillRequirements(skills: Skill[], role: string): ValidationResult;
  validateSeniorityAlignment(seniority: string, role: string, experience: number): ValidationResult;
  suggestCorrections(validationErrors: ValidationError[]): CorrectionSuggestion[];
}
```

## Testing Strategy

### Unit Testing
- Rate calculation accuracy across all formats
- Geographic adjustment calculations
- Skill and certification premium calculations
- Validation rule enforcement

### Integration Testing
- Database schema migration testing
- API endpoint testing with enhanced data
- Analytics calculation verification
- Approval workflow testing

### Performance Testing
- Query performance with additional fields and indexes
- Analytics calculation performance with large datasets
- Concurrent rate update handling
- Geographic lookup performance

### Data Migration Testing
- Backward compatibility verification
- Default value assignment for new fields
- Data integrity during migration
- Rollback procedure validation

## Migration Strategy

### Phase 1: Schema Enhancement
1. Add new columns to existing tables
2. Create new supporting tables
3. Establish foreign key relationships
4. Create necessary indexes

### Phase 2: Data Population
1. Populate taxonomy tables with standard values
2. Set default values for existing rate cards
3. Import geographic adjustment data
4. Establish skill and certification registries

### Phase 3: Service Enhancement
1. Update rate card service with new fields
2. Enhance analytics calculations
3. Implement validation rules
4. Add approval workflows

### Phase 4: UI Enhancement
1. Update rate card forms with new fields
2. Enhance analytics dashboards
3. Add geographic visualization
4. Implement approval interfaces

## Security Considerations

- **Field-level Security**: Sensitive fields like cost rates require appropriate access controls
- **Approval Audit**: Complete audit trail for all rate approvals and changes
- **Data Encryption**: Encrypt sensitive rate and cost information
- **Access Logging**: Log all access to rate data for compliance
- **Geographic Compliance**: Ensure compliance with local data protection regulations