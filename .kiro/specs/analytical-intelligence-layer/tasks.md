# Implementation Plan

- [x] 1. Set up analytical intelligence infrastructure and core interfaces


  - Create base analytical intelligence service extending existing intelligence service
  - Define core interfaces for all six analytical engines
  - Set up database schema extensions for analytical data models
  - Configure event handlers for analytical events
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 1.1 Create analytical intelligence service foundation


  - Extend existing IntelligenceService with AnalyticalIntelligenceService class
  - Define base interfaces for all analytical engines


  - Set up dependency injection for analytical components
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_




- [x] 1.2 Implement database schema extensions

  - Create rate_cards, rates, and benchmarks tables
  - Create renewal_alerts and compliance_policies tables
  - Create supplier_intelligence and spend_data tables


  - Add proper indexes for performance optimization
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_



- [x] 1.3 Set up analytical event system

  - Define analytical event types and handlers
  - Integrate with existing event bus infrastructure
  - Implement event-driven processing for analytical workflows
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_



- [x] 2. Implement Rate Card Benchmarking Engine

  - Create rate card parser for extracting rate data from contracts
  - Implement taxonomy mapping for role standardization
  - Build benchmark calculation engine with statistical analysis

  - Develop savings estimation algorithms
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2.1 Create rate card parsing and normalization


  - Implement rate card extraction from contract documents
  - Build currency conversion and normalization logic

  - Create role mapping to Chain IQ taxonomy
  - Standardize delivery model and region classification
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2.2 Build benchmark calculation engine

  - Implement statistical analysis for rate distributions (P25/P50/P75/P90)
  - Create cohort-based comparison logic
  - Build relaxation logic for insufficient sample sizes
  - Generate confidence scores for benchmark results
  - _Requirements: 1.4, 1.5_

- [x] 2.3 Develop savings estimation system


  - Calculate potential savings using delta_to_p75 × volume formula
  - Generate role-by-role benchmark comparisons
  - Create supplier blended rate analysis
  - Build savings opportunity reporting
  - _Requirements: 1.6, 1.7, 1.8_


- [ ]* 2.4 Write unit tests for rate card benchmarking
  - Test rate parsing accuracy and edge cases
  - Test benchmark calculation algorithms
  - Test savings estimation formulas
  - Test cohort relaxation logic
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_


- [x] 3. Implement Renewal Radar Engine

  - Create contract date and renewal clause extraction
  - Build renewal alert scheduling and notification system
  - Develop renewal calendar and timeline views
  - Integrate with RFx generation system

  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 3.1 Build renewal data extraction system


  - Extract start dates, end dates, and renewal clauses from contracts
  - Identify auto-renewal patterns and notice requirements
  - Categorize contracts by renewal type (Manual/Auto/Evergreen)

  - Parse renewal terms and conditions
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 3.2 Create renewal alert and notification system

  - Implement alert scheduling for configurable thresholds (90/180/365 days)
  - Build notification delivery system
  - Create risk level assignment logic
  - Develop alert acknowledgment and tracking
  - _Requirements: 2.4, 2.6_

- [x] 3.3 Develop renewal calendar and visualization

  - Create calendar and Gantt-style views
  - Build filtering by client, category, and supplier
  - Implement renewal timeline visualization
  - Generate renewal pipeline reports
  - _Requirements: 2.5_

- [x] 3.4 Integrate with RFx generation system

  - Connect renewal alerts to RFx event creation
  - Build calendar system integration
  - Create automated workflow triggers
  - _Requirements: 2.7_

- [ ]* 3.5 Write unit tests for renewal radar
  - Test date extraction accuracy
  - Test alert scheduling logic
  - Test notification delivery
  - Test calendar generation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_-
 [ ] 4. Implement Clause Compliance & Risk Scoring Engine
  - Create compliance policy management system
  - Build LLM-based clause scanning and analysis
  - Develop compliance scoring and risk assessment
  - Generate remediation recommendations
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 4.1 Build compliance policy management
  - Create policy definition system for required clauses
  - Implement must/should/can status and scoring weights
  - Build policy template management
  - Create validation rule engine
  - _Requirements: 3.1, 3.2_

- [ ] 4.2 Implement LLM-based clause scanning
  - Build clause identification and extraction system
  - Create template comparison and deviation detection
  - Implement redline and exception identification
  - Develop clause strength assessment
  - _Requirements: 3.3, 3.4, 3.5_

- [x] 4.3 Create compliance scoring system

  - Calculate clause-level status (Present/Weak/Missing)
  - Generate aggregate Contract Compliance Score (0-100)
  - Assign risk levels based on compliance gaps
  - Create compliance trend tracking
  - _Requirements: 3.6, 3.7_

- [x] 4.4 Build remediation recommendation engine

  - Generate specific redline suggestions
  - Create amendment recommendations
  - Build compliance improvement roadmaps
  - _Requirements: 3.8_

- [x]* 4.5 Write unit tests for compliance engine

  - Test policy management functionality
  - Test clause scanning accuracy
  - Test scoring calculations
  - Test recommendation generation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_


- [x] 5. Implement Supplier Snapshot Engine

  - Create supplier data aggregation system
  - Build external data integration (Sievo, D&B, ESG)
  - Develop supplier analytics and metrics calculation
  - Generate AI-powered executive summaries
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_


- [x] 5.1 Build supplier data aggregation


  - Aggregate contracts, SOWs, benchmarks, and compliance scores per supplier
  - Create supplier profile consolidation logic
  - Build relationship metrics calculation
  - Implement supplier performance tracking
  - _Requirements: 4.1, 4.4, 4.5_

- [x] 5.2 Implement external data integration

  - Create Sievo API integration for spend data
  - Build D&B integration for risk data
  - Implement ESG score integration

  - Create data synchronization and refresh mechanisms
  - _Requirements: 4.2_

- [x] 5.3 Develop supplier analytics engine

  - Calculate average blended daily rates vs market
  - Generate compliance health scores
  - Build supplier performance metrics

  - Create competitive positioning analysis
  - _Requirements: 4.3, 4.4, 4.5_

- [x] 5.4 Create AI-powered executive summaries

  - Generate natural language supplier summaries
  - Create recommended actions based on data analysis

  - Build trend analysis and insights
  - Implement summary personalization
  - _Requirements: 4.6, 4.7_

- [ ]* 5.5 Write unit tests for supplier snapshot
  - Test data aggregation accuracy

  - Test external integration reliability
  - Test analytics calculations
  - Test summary generation quality
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 6. Implement Spend Overlay Engine

  - Create spend data integration system
  - Build spend-to-contract mapping logic
  - Develop variance analysis and leakage detection
  - Generate efficiency and utilization metrics
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 6.1 Build spend data integration


  - Create Sievo API connector with periodic refresh
  - Implement spend data import and validation
  - Build data quality checks and cleansing
  - Create spend data storage and indexing
  - _Requirements: 5.1, 5.2_

- [x] 6.2 Implement spend-to-contract mapping

  - Create supplier name matching algorithms
  - Build PO reference and scope descriptor mapping
  - Implement taxonomy alignment between spend and contract categories
  - Create mapping confidence scoring
  - _Requirements: 5.3, 5.4_

- [x] 6.3 Develop variance analysis system

  - Compare actual paid rates vs contracted rates vs benchmark medians
  - Identify off-contract spend and rate creep
  - Detect underutilized volume commitments
  - Generate variance reports and alerts
  - _Requirements: 5.5, 5.6, 5.7_

- [x] 6.4 Create efficiency metrics calculation

  - Calculate efficiency indices per supplier and category
  - Generate utilization rate analysis
  - Build cost optimization recommendations
  - Create spend performance dashboards
  - _Requirements: 5.8_

- [ ]* 6.5 Write unit tests for spend overlay
  - Test spend data integration accuracy
  - Test mapping algorithm reliability
  - Test variance calculation precision
  - Test efficiency metric calculations
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_- [ ] 
7. Implement Natural Language Query Engine
  - Create hybrid RAG pipeline with semantic and keyword search
  - Build query intent classification and processing
  - Develop structured response generation with citations
  - Implement conversation context management
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 7.1 Build hybrid RAG pipeline
  - Implement BM25 keyword search integration
  - Create semantic search with vector embeddings
  - Build search result ranking and fusion
  - Optimize search performance and relevance
  - _Requirements: 6.1, 6.2_

- [ ] 7.2 Create query intent classification
  - Build LLM-based intent interpretation
  - Create query type classification (contracts, rates, compliance, etc.)
  - Implement parameter extraction from natural language
  - Build query validation and error handling
  - _Requirements: 6.2, 6.4_


- [ ] 7.3 Develop structured response generation
  - Create response formatting with citations
  - Build evidence linking to contracts and pages
  - Implement confidence scoring for responses
  - Generate follow-up question suggestions
  - _Requirements: 6.3, 6.5_


- [ ] 7.4 Implement conversation context management
  - Build session-based conversation tracking

  - Create context-aware query processing
  - Implement conversation memory and history
  - Build context persistence and retrieval
  - _Requirements: 6.6_


- [ ] 7.5 Create query interface and export features
  - Build chat-style query interface
  - Implement query result export to Excel/PDF
  - Create query suggestion and auto-completion
  - Build query history and bookmarking
  - _Requirements: 6.7_


- [ ]* 7.6 Write unit tests for natural language query
  - Test RAG pipeline accuracy
  - Test intent classification precision
  - Test response generation quality
  - Test context management reliability

  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 8. Create analytical intelligence APIs and integration

  - Build REST APIs for all analytical engines
  - Implement caching strategies for performance
  - Create real-time streaming endpoints
  - Integrate with existing frontend components
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 8.1 Build comprehensive REST API endpoints


  - Create rate benchmarking API endpoints
  - Build renewal radar API endpoints
  - Implement compliance scoring API endpoints


  - Create supplier snapshot API endpoints
  - Build spend overlay API endpoints
  - Implement natural language query API endpoints
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 8.2 Implement caching and performance optimization

  - Create cache strategies for benchmark data

  - Implement supplier intelligence caching
  - Build query result caching with TTL
  - Create cache invalidation strategies
  - Optimize database queries with proper indexing
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_


- [x] 8.3 Create real-time streaming capabilities

  - Build Server-Sent Events for real-time updates

  - Implement analytical event streaming
  - Create live dashboard data feeds
  - Build notification streaming for alerts
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_


- [x] 8.4 Integrate with existing frontend components

  - Update existing analytics components with new engines
  - Enhance rate benchmarking UI components
  - Improve supplier analytics dashboards
  - Create natural language query interface

  - Build renewal radar visualization components
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [ ]* 8.5 Write integration tests for APIs
  - Test API endpoint functionality
  - Test caching behavior and performance
  - Test real-time streaming reliability
  - Test frontend integration completeness
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 9. Implement comprehensive analytics dashboard


  - Create unified analytical intelligence dashboard
  - Build interactive data visualizations
  - Implement drill-down capabilities
  - Create export and reporting features
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 9.1 Build unified analytics dashboard


  - Create main analytical intelligence dashboard page
  - Implement tabbed interface for different analytical engines
  - Build overview metrics and KPI displays
  - Create navigation between analytical modules
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 9.2 Create interactive data visualizations

  - Build rate benchmarking charts and graphs
  - Create renewal timeline and calendar views
  - Implement compliance score visualizations
  - Build supplier performance dashboards
  - Create spend analysis charts and heatmaps
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 9.3 Implement drill-down and filtering

  - Create interactive filtering across all analytical views
  - Build drill-down capabilities from summary to detail
  - Implement cross-module navigation and linking
  - Create dynamic filtering and search
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 9.4 Build export and reporting capabilities

  - Create PDF report generation for all analytical modules
  - Implement Excel export for data tables and charts
  - Build scheduled reporting functionality
  - Create customizable report templates
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [ ]* 9.5 Write end-to-end tests for dashboard
  - Test dashboard functionality and navigation
  - Test visualization accuracy and interactivity
  - Test filtering and drill-down capabilities
  - Test export and reporting features
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_