# Implementation Plan

## IMPORTANT: Repository Audit Findings

After comprehensive repository audit, we discovered:
- ✅ **Backend Services**: 80% complete - All analytical engines exist
- ✅ **Database Schema**: 100% complete - Enhanced rate card schema implemented
- ✅ **API Routes**: 90% complete - Most analytics endpoints exist
- ❌ **Mock Data Layer**: 0% complete - No mock data providers
- ❌ **Frontend Consolidation**: 30% complete - Duplicate paths exist

**Revised Strategy**: Focus on mock data layer and frontend consolidation, NOT backend recreation.

---

- [x] 1. Set up core data provider infrastructure


  - Create base data provider interfaces and types
  - Implement data provider factory
  - Create data source metadata types
  - _Requirements: 2.1, 2.2, 2.3, 10.1, 10.2_

- [x] 1.1 Create base data provider interface


  - Define IDataProvider<T> interface with mode, isAvailable(), getData(), getMetadata()
  - Create DataSourceMetadata interface
  - Implement DataProviderFactory class
  - _Requirements: 2.1, 10.1_

- [x] 1.2 Implement mock data registry



  - Create MockDataRegistry interface
  - Set up mock data file structure in apps/web/lib/mock-data/
  - Create mock data loader utility
  - _Requirements: 2.4, 10.2_

- [x] 1.3 Create error handling framework

  - Implement ProcurementIntelligenceError base class
  - Create DataUnavailableError and InvalidModeError classes
  - Implement DataFallbackHandler
  - _Requirements: 9.4, 10.3_

- [ ] 2. Integrate Rate Card Benchmarking module (EXISTING BACKEND)
  - **NOTE**: Backend services already exist in `rate-card-benchmarking.engine.ts` and `rate-card-intelligence.service.ts`
  - Wrap existing services with data providers
  - Create mock data provider
  - Consolidate frontend components
  - _Requirements: 1.1, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.1 Create real data provider wrapper for existing rate card services


  - Wrap `RateCardBenchmarkingEngineImpl` methods
  - Wrap `RateCardIntelligenceService` methods
  - Use existing `getMarketRates()`, `getRateTrends()`, `compareToBenchmark()` methods
  - **NO NEW BACKEND CODE NEEDED** - Services already exist
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2.2 Create mock data provider for rate cards


  - Generate realistic mock rate card data
  - Create mock market trends data
  - Provide mock geographic distribution data
  - Match existing service response formats
  - _Requirements: 2.4, 3.2_

- [-] 2.3 Consolidate frontend components

  - Move components from `/components/use-cases/rate-benchmarking/` to `/components/analytics/`
  - Connect to existing API endpoints at `/api/analytics/intelligence/rate-benchmarking`
  - Add data mode toggle indicator
  - Remove duplicate components
  - _Requirements: 1.1, 2.4, 3.2, 3.4, 12.1_

- [x] 2.4 Update frontend page at /analytics/rate-intelligence


  - **NOTE**: Page already exists at `/app/analytics/rate-intelligence/page.tsx`
  - Add mock data support
  - Add data mode toggle indicator
  - Enhance with consolidated components
  - _Requirements: 1.1, 2.4, 3.2, 3.4_

- [-] 3. Implement Supplier Analytics module

  - Create service with real and mock data providers
  - Implement API endpoints
  - Create frontend components
  - _Requirements: 1.2, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 3.1 Create SupplierAnalyticsService
  - Implement getSupplierOverview() method
  - Implement getSupplierMetrics() method
  - Implement compareSuppliers() method
  - Implement getPerformanceTrends() method
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 3.2 Create real data provider for suppliers
  - Aggregate contracts by supplier
  - Calculate performance scores from contract metadata
  - Extract financial terms from artifacts
  - Analyze compliance clauses
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 11.2_

- [ ] 3.3 Create supplier_performance table
  - Run database migration for supplier tracking
  - Create indexes for performance queries
  - _Requirements: 4.2, 11.2_

- [ ] 3.4 Create mock data provider for suppliers
  - Load mock supplier data
  - Generate realistic performance metrics
  - Provide financial health scores
  - _Requirements: 2.4, 4.2_

- [x] 3.5 Create API endpoints for supplier analytics



  - GET /api/analytics/suppliers/overview
  - GET /api/analytics/suppliers/:id/metrics
  - POST /api/analytics/suppliers/compare
  - GET /api/analytics/suppliers/:id/trends
  - _Requirements: 1.2, 9.1, 9.2, 9.3_

- [x] 3.6 Create frontend page at /analytics/suppliers

  - Implement supplier overview dashboard
  - Add detailed supplier metrics view
  - Create supplier comparison tool
  - Add performance trend charts
  - _Requirements: 1.2, 2.4, 4.2, 4.5_

- [ ] 4. Implement Negotiation Preparation module
  - Create service with real and mock data providers
  - Implement API endpoints
  - Create frontend components
  - _Requirements: 1.3, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 4.1 Create NegotiationPreparationService
  - Implement generateNegotiationPack() method
  - Implement getScenarios() method
  - Implement generateTalkingPoints() method
  - Implement calculateLeverage() method
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 4.2 Create real data provider for negotiations
  - Pull current rates from active contracts
  - Use market benchmarks from rate card data
  - Reference actual contract clauses via RAG
  - Calculate leverage from contract history
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 4.3 Create mock data provider for negotiations
  - Load mock negotiation scenarios
  - Generate realistic talking points
  - Provide leverage calculations
  - _Requirements: 2.4, 5.2_

- [ ] 4.4 Create API endpoints for negotiation prep
  - POST /api/analytics/negotiation/generate-pack
  - POST /api/analytics/negotiation/scenarios
  - POST /api/analytics/negotiation/talking-points
  - POST /api/analytics/negotiation/leverage
  - _Requirements: 1.3, 9.1, 9.2, 9.3_


- [ ] 4.5 Create frontend page at /analytics/negotiation
  - Implement negotiation pack generator
  - Add scenario comparison tool
  - Create talking points display
  - Add leverage calculator
  - _Requirements: 1.3, 2.4, 5.2, 5.3_

- [ ] 5. Implement Savings Pipeline module
  - Create service with real and mock data providers
  - Implement API endpoints
  - Create frontend components
  - _Requirements: 1.4, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 5.1 Create SavingsPipelineService
  - Implement getPipelineOverview() method
  - Implement getOpportunitiesByStage() method
  - Implement createOpportunity() method
  - Implement updateOpportunity() method
  - Implement calculateROI() method
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 5.2 Create savings_opportunities table
  - Run database migration for savings tracking
  - Create indexes for pipeline queries
  - _Requirements: 6.1, 11.3_

- [ ] 5.3 Create real data provider for savings
  - Compare current rates against benchmarks
  - Track progress from contract amendments
  - Calculate realized savings from financial data
  - Project future savings from pending negotiations
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 5.4 Create mock data provider for savings
  - Load mock savings opportunities
  - Generate realistic pipeline data
  - Provide ROI calculations
  - _Requirements: 2.4, 6.2_

- [ ] 5.5 Create API endpoints for savings pipeline
  - GET /api/analytics/savings/overview
  - GET /api/analytics/savings/opportunities
  - POST /api/analytics/savings/opportunities
  - PATCH /api/analytics/savings/opportunities/:id
  - GET /api/analytics/savings/roi
  - _Requirements: 1.4, 9.1, 9.2, 9.3_


- [ ] 5.6 Create frontend page at /analytics/savings
  - Implement pipeline funnel visualization
  - Add opportunity management interface
  - Create ROI dashboard
  - Add category breakdown charts
  - _Requirements: 1.4, 2.4, 6.2, 6.5_

- [ ] 6. Implement Renewal Radar module
  - Create service with real and mock data providers
  - Implement API endpoints
  - Create frontend components
  - _Requirements: 1.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 6.1 Create RenewalRadarService
  - Implement getUpcomingRenewals() method
  - Implement getAlerts() method
  - Implement generateRenewalPack() method
  - Implement detectAutoRenewal() method
  - Implement calculateRenewalSavings() method
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 6.2 Create renewal_tracking table
  - Run database migration for renewal tracking
  - Create indexes for date-based queries
  - _Requirements: 7.1, 11.4_

- [ ] 6.3 Create real data provider for renewals
  - Query contracts with end dates within 90 days
  - Parse contract text for auto-renewal clauses using RAG
  - Compare current rates against market data
  - Include supplier performance metrics
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 6.4 Create renewal alert scheduler
  - Implement cron job for 90/60/30 day alerts
  - Send notifications via event bus
  - Track notification status in database
  - _Requirements: 7.5_

- [ ] 6.5 Create mock data provider for renewals
  - Load mock renewal contracts
  - Generate realistic alerts
  - Provide renewal packs
  - _Requirements: 2.4, 7.2_

- [ ] 6.6 Create API endpoints for renewal radar
  - GET /api/analytics/renewals/upcoming
  - GET /api/analytics/renewals/alerts
  - GET /api/analytics/renewals/:id/pack
  - GET /api/analytics/renewals/:id/auto-renewal
  - GET /api/analytics/renewals/:id/savings
  - _Requirements: 1.5, 9.1, 9.2, 9.3_


- [ ] 6.7 Create frontend page at /analytics/renewals
  - Implement renewal dashboard
  - Add alert management interface
  - Create renewal pack viewer
  - Add timeline visualization
  - _Requirements: 1.5, 2.4, 7.2, 7.4_

- [ ] 7. Implement cross-feature integration
  - Connect rate benchmarking to savings pipeline
  - Connect renewal radar to negotiation prep
  - Connect supplier analytics to renewal radar
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 7.1 Create integration event handlers
  - Handle rate variance events → create savings opportunities
  - Handle renewal detection events → trigger negotiation prep
  - Handle poor performance events → flag in renewal radar
  - Handle savings realization events → update all modules
  - Handle negotiation completion events → update all modules
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 7.2 Implement event bus for cross-feature communication
  - Create ProcurementEventBus class
  - Define event types and payloads
  - Implement event listeners for each module
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 8. Implement caching layer
  - Create ProcurementDataCache class
  - Configure TTL for each feature
  - Implement cache invalidation strategies
  - _Requirements: 10.4_

- [ ] 9. Add comprehensive testing
  - Write unit tests for all services
  - Write integration tests for cross-feature flows
  - Write API endpoint tests
  - _Requirements: 10.5_

- [ ]* 9.1 Write unit tests for data providers
  - Test real data provider with database
  - Test mock data provider with mock files
  - Test fallback behavior
  - _Requirements: 10.5_

- [ ]* 9.2 Write unit tests for services
  - Test RateCardBenchmarkingService
  - Test SupplierAnalyticsService
  - Test NegotiationPreparationService
  - Test SavingsPipelineService
  - Test RenewalRadarService
  - _Requirements: 10.5_

- [ ]* 9.3 Write integration tests
  - Test rate benchmarking → savings pipeline flow
  - Test renewal radar → negotiation prep flow
  - Test supplier analytics → renewal radar flow
  - _Requirements: 8.1, 8.2, 8.3_

- [ ]* 9.4 Write API tests
  - Test all rate benchmarking endpoints
  - Test all supplier analytics endpoints
  - Test all negotiation prep endpoints
  - Test all savings pipeline endpoints
  - Test all renewal radar endpoints
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 10. Create unified analytics navigation



  - Add analytics section to main navigation
  - Create analytics landing page
  - Add breadcrumbs for navigation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 11. Migrate and cleanup old code
  - Remove duplicate components from /components/use-cases/
  - Remove duplicate pages from /app/use-cases/
  - Add redirects from old routes to new routes
  - Update all internal links
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 11.1 Remove duplicate rate benchmarking code
  - Delete /components/use-cases/rate-benchmarking/
  - Delete /app/use-cases/rate-benchmarking/
  - Add redirect from old route to new route
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 11.2 Remove duplicate supplier analytics code
  - Delete /components/use-cases/supplier-snapshots/
  - Delete /app/use-cases/supplier-snapshots/
  - Add redirect from old route to new route
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 11.3 Remove duplicate negotiation prep code
  - Delete /app/use-cases/negotiation-prep/
  - Add redirect from old route to new route
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 11.4 Remove duplicate savings pipeline code
  - Delete /app/use-cases/savings-pipeline/
  - Add redirect from old route to new route
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 11.5 Remove duplicate renewal radar code
  - Delete /app/use-cases/renewal-radar/
  - Add redirect from old route to new route
  - _Requirements: 12.1, 12.2, 12.3_

- [ ] 11.6 Remove procurement hub page
  - Delete /app/use-cases/procurement-hub/
  - Update navigation to point to new analytics section
  - _Requirements: 12.1, 12.2, 12.4_

- [x] 12. Create documentation



  - Write user guide for each feature
  - Document API endpoints
  - Create migration guide
  - Document data mode toggle
  - _Requirements: 12.5_

- [x] 12.1 Document Rate Card Benchmarking

  - User guide for rate benchmarking feature
  - API documentation for rate benchmarking endpoints
  - Examples of real vs mock data usage
  - _Requirements: 12.5_


- [x] 12.2 Document Supplier Analytics

  - User guide for supplier analytics feature
  - API documentation for supplier endpoints
  - Examples of supplier comparison workflows
  - _Requirements: 12.5_



- [ ] 12.3 Document Negotiation Preparation
  - User guide for negotiation prep feature
  - API documentation for negotiation endpoints
  - Examples of negotiation pack generation
  - _Requirements: 12.5_



- [ ] 12.4 Document Savings Pipeline
  - User guide for savings pipeline feature
  - API documentation for savings endpoints
  - Examples of opportunity tracking workflows
  - _Requirements: 12.5_

- [x] 12.5 Document Renewal Radar

  - User guide for renewal radar feature
  - API documentation for renewal endpoints
  - Examples of renewal alert workflows
  - _Requirements: 12.5_



- [ ] 12.6 Create migration guide
  - Document route changes
  - Provide code migration examples
  - List breaking changes
  - _Requirements: 12.5_
