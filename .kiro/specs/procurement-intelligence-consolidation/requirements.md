# Requirements Document

## Introduction

This specification consolidates the procurement intelligence features into a unified, production-ready system. After a comprehensive repository audit, we've discovered extensive existing infrastructure including:

- **Analytical Intelligence Layer**: Complete analytical engines for rate card benchmarking, supplier snapshots, compliance checking, renewal radar, and spend overlay
- **Enhanced Rate Card System**: Comprehensive rate card intelligence service with line-of-service analytics, seniority progression, geographic analysis, and skill premium analytics
- **Data Orchestration Services**: 40+ services including rate calculation engines, validation services, and analytical database services
- **Existing API Routes**: Multiple analytics endpoints under `/api/analytics/intelligence/`

The consolidation will leverage this existing infrastructure rather than recreating it, focusing on:
1. Unifying duplicate UI paths and components
2. Creating a consistent frontend experience that connects to existing backend services
3. Adding mock data providers where needed for demo purposes
4. Removing redundant code in `/app/use-cases/` and `/components/use-cases/`

## Requirements

### Requirement 1: Unified Architecture

**User Story:** As a system architect, I want a single, clear path to each procurement intelligence feature, so that there is no confusion or duplication in the codebase.

#### Acceptance Criteria

1. WHEN accessing rate card benchmarking THEN the system SHALL provide exactly one route at `/analytics/rate-benchmarking`
2. WHEN accessing supplier analytics THEN the system SHALL provide exactly one route at `/analytics/suppliers`
3. WHEN accessing negotiation prep THEN the system SHALL provide exactly one route at `/analytics/negotiation`
4. WHEN accessing savings pipeline THEN the system SHALL provide exactly one route at `/analytics/savings`
5. WHEN accessing renewal radar THEN the system SHALL provide exactly one route at `/analytics/renewals`
6. WHEN duplicate routes exist THEN the system SHALL remove or redirect them to the canonical path

### Requirement 2: Data Mode Toggle

**User Story:** As a developer or demo presenter, I want to toggle between real production data and mock demo data, so that I can showcase features without requiring actual contract data.

#### Acceptance Criteria

1. WHEN the system starts THEN it SHALL detect if real data is available in the database
2. WHEN real data is unavailable THEN the system SHALL automatically use mock data
3. WHEN an environment variable `USE_MOCK_DATA=true` is set THEN the system SHALL use mock data regardless of database state
4. WHEN using mock data THEN the UI SHALL display a badge indicating "Demo Mode"
5. WHEN switching between modes THEN the system SHALL maintain the same UI/UX experience

### Requirement 3: Rate Card Benchmarking Integration

**User Story:** As a procurement analyst, I want to benchmark rates against market data from real contracts, so that I can make data-driven negotiation decisions.

#### Acceptance Criteria

1. WHEN viewing rate benchmarking THEN the system SHALL pull rate data from the `RateCard` and `RateCardEntry` tables
2. WHEN insufficient real data exists THEN the system SHALL supplement with mock market intelligence data
3. WHEN comparing rates THEN the system SHALL calculate percentile rankings across all contracts
4. WHEN displaying trends THEN the system SHALL show 12-month historical rate evolution
5. WHEN filtering by role/location THEN the system SHALL aggregate data from matching contract artifacts

### Requirement 4: Supplier Analytics Integration

**User Story:** As a procurement manager, I want to analyze supplier performance using real contract and financial data, so that I can make informed supplier selection decisions.

#### Acceptance Criteria

1. WHEN viewing supplier analytics THEN the system SHALL aggregate data from contracts grouped by supplier
2. WHEN calculating performance scores THEN the system SHALL use actual contract metadata and artifacts
3. WHEN displaying financial health THEN the system SHALL integrate with extracted financial terms from contracts
4. WHEN showing risk assessment THEN the system SHALL analyze compliance clauses and contract terms
5. WHEN comparing suppliers THEN the system SHALL provide side-by-side metrics from real contract data

### Requirement 5: Negotiation Preparation Integration

**User Story:** As a negotiation lead, I want AI-generated negotiation materials based on real market data and contract history, so that I can maximize savings in upcoming negotiations.

#### Acceptance Criteria

1. WHEN preparing for negotiation THEN the system SHALL pull current rates from active contracts
2. WHEN generating target rates THEN the system SHALL use market benchmarks from rate card data
3. WHEN creating talking points THEN the system SHALL reference actual contract clauses and terms
4. WHEN calculating leverage THEN the system SHALL analyze relationship duration and contract volume from real data
5. WHEN modeling scenarios THEN the system SHALL use historical negotiation outcomes if available

### Requirement 6: Savings Pipeline Integration

**User Story:** As a CFO, I want to track savings opportunities from identification through realization using actual financial data, so that I can report accurate ROI to stakeholders.

#### Acceptance Criteria

1. WHEN identifying savings opportunities THEN the system SHALL compare current contract rates against market benchmarks
2. WHEN tracking progress THEN the system SHALL update based on actual contract amendments and renewals
3. WHEN calculating realized savings THEN the system SHALL use actual financial data from contract artifacts
4. WHEN projecting future savings THEN the system SHALL use pending negotiations and upcoming renewals
5. WHEN reporting to clients THEN the system SHALL provide audit trails linking to source contracts

### Requirement 7: Renewal Radar Integration

**User Story:** As a contract manager, I want automated alerts for upcoming renewals based on actual contract end dates, so that I never miss a negotiation opportunity.

#### Acceptance Criteria

1. WHEN scanning for renewals THEN the system SHALL query contracts with end dates within 90 days
2. WHEN detecting auto-renewal clauses THEN the system SHALL parse actual contract text using RAG
3. WHEN calculating savings opportunities THEN the system SHALL compare current rates against market data
4. WHEN generating negotiation packs THEN the system SHALL include actual supplier performance metrics
5. WHEN sending alerts THEN the system SHALL trigger at 90, 60, and 30 days before expiration

### Requirement 8: Cross-Feature Data Flow

**User Story:** As a system user, I want seamless data flow between features, so that insights from one module inform decisions in another.

#### Acceptance Criteria

1. WHEN rate benchmarking identifies high rates THEN the system SHALL create savings pipeline opportunities
2. WHEN renewal radar detects upcoming renewals THEN the system SHALL trigger negotiation preparation
3. WHEN supplier analytics shows poor performance THEN the system SHALL flag in renewal radar
4. WHEN savings are realized THEN the system SHALL update both savings pipeline and rate benchmarking
5. WHEN negotiation completes THEN the system SHALL update all affected modules with new contract terms

### Requirement 9: API Consolidation

**User Story:** As a frontend developer, I want consistent API patterns across all procurement features, so that integration is predictable and maintainable.

#### Acceptance Criteria

1. WHEN calling any procurement API THEN it SHALL follow the pattern `/api/analytics/{feature}/{action}`
2. WHEN requesting data THEN the API SHALL accept a `mode` parameter ('real' | 'mock' | 'auto')
3. WHEN returning data THEN the API SHALL include metadata indicating data source and freshness
4. WHEN errors occur THEN the API SHALL provide consistent error structures across all endpoints
5. WHEN data is unavailable THEN the API SHALL gracefully fallback to mock data with appropriate warnings

### Requirement 10: Service Layer Architecture

**User Story:** As a backend developer, I want a clean service layer that abstracts data sources, so that switching between real and mock data is seamless.

#### Acceptance Criteria

1. WHEN implementing services THEN each SHALL have a unified interface for real and mock data
2. WHEN querying data THEN services SHALL use a data provider pattern with swappable implementations
3. WHEN processing data THEN business logic SHALL be independent of data source
4. WHEN caching data THEN the system SHALL cache real and mock data separately
5. WHEN testing THEN services SHALL be easily testable with mock data providers

### Requirement 11: Database Schema Utilization

**User Story:** As a data engineer, I want to leverage existing database schemas for procurement intelligence, so that we don't duplicate data storage.

#### Acceptance Criteria

1. WHEN storing rate cards THEN the system SHALL use existing `RateCard` and `RateCardEntry` tables
2. WHEN tracking suppliers THEN the system SHALL use contract metadata and supplier fields
3. WHEN recording savings THEN the system SHALL use the analytical intelligence schema
4. WHEN storing renewals THEN the system SHALL use contract end dates and renewal flags
5. WHEN linking data THEN the system SHALL maintain referential integrity across all tables

### Requirement 12: Migration and Cleanup

**User Story:** As a project maintainer, I want to remove duplicate code and deprecated routes, so that the codebase is clean and maintainable.

#### Acceptance Criteria

1. WHEN consolidating THEN the system SHALL remove duplicate components from `/components/use-cases/`
2. WHEN consolidating THEN the system SHALL remove duplicate pages from `/app/use-cases/`
3. WHEN consolidating THEN the system SHALL redirect old routes to new canonical paths
4. WHEN consolidating THEN the system SHALL update all internal links to use new routes
5. WHEN consolidating THEN the system SHALL document the migration path for existing users
