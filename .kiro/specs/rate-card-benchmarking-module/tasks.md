# Implementation Plan

- [x] 1. Set up core services and API infrastructure




  - Create rate card entry service with validation and CRUD operations
  - Implement API routes for rate card management (create, read, update, delete, list)








  - Add filtering and pagination support to list endpoint



  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2. Implement AI-powered rate extraction from contracts



  - [ ] 2.1 Enhance rate extraction service with improved prompts
    - Update extraction prompts for better accuracy


    - Add support for multiple rate card formats


    - Implement confidence scoring for extracted data
    - _Requirements: 1.1, 1.2_


  

  - [ ] 2.2 Implement role standardization with AI
    - Create role standardization service using GPT-4
    - Build role taxonomy and mapping database
    - Add learning from user corrections
    - _Requirements: 1.3, 2.2_
  

  - [ ] 2.3 Create extraction API endpoint and UI trigger
    - Add POST /api/rate-cards/extract/[contractId] endpoint
    - Create "Extract Rates" button on contract detail page
    - Build extraction results preview modal


    - Allow editing extracted rates before saving
    - _Requirements: 1.4, 1.5_

- [x] 3. Build manual rate card entry system



  - [ ] 3.1 Create rate card entry form component
    - Build multi-section form with validation
    - Add supplier autocomplete with create option
    - Implement role input with AI standardization suggestions


    - Add currency selector with real-time conversion preview
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [ ] 3.2 Implement currency conversion service
    - Integrate with FX API for real-time rates
    - Cache exchange rates with daily refresh
    - Support historical rate lookups
    - Auto-convert to USD and CHF on save
    - _Requirements: 2.4_
  
  - [ ] 3.3 Add duplicate detection and warnings
    - Check for similar existing entries on save
    - Show warning modal with similar entries
    - Allow user to proceed or edit
    - _Requirements: 2.5_

- [x] 4. Implement bulk CSV upload functionality


  - [x] 4.1 Create CSV template generator

    - Generate template with all required and optional fields
    - Add field descriptions and examples
    - Include validation rules in template
    - _Requirements: 3.1_
  
  - [x] 4.2 Build CSV parser and validator

    - Parse CSV with error handling
    - Validate each row against schema
    - Detect data type mismatches
    - Check for required fields
    - _Requirements: 3.2_
  
  - [x] 4.3 Create import preview interface

    - Display parsed data in table format
    - Show validation errors and warnings with row numbers
    - Allow row-by-row corrections
    - Highlight duplicates and conflicts
    - _Requirements: 3.2, 3.3_
  
  - [x] 4.4 Implement batch import processing


    - Process valid entries in batches
    - Handle transaction rollback on critical errors
    - Generate detailed import report
    - Track import job status
    - _Requirements: 3.4_

- [x] 5. Enhance benchmarking engine with best rate tracking




  - [x] 5.1 Implement best rate calculation

    - Add method to find lowest rate for role-geography-seniority combination
    - Calculate savings vs best rate
    - Track best rate changes over time
    - _Requirements: 5.1, 5.2, 12.1, 12.2_
  

  - [x] 5.2 Create best rates view

    - Build UI showing best rate for each unique combination
    - Add filtering by role, geography, seniority
    - Highlight which supplier offers best rate
    - Show historical best rate trends
    - _Requirements: 12.3, 12.4_
  

  - [x] 5.3 Add best rate notifications

    - Detect when best rate changes
    - Notify relevant users of new competitive benchmarks
    - Track notification preferences
    - _Requirements: 12.5_

- [x] 6. Build advanced filtering system




  - [x] 6.1 Implement multi-criteria filter component

    - Add filters for all key fields (supplier, role, seniority, line of service, country, region, date range, rate range)
    - Support multiple filter combinations with AND logic
    - Show real-time count of matching entries
    - _Requirements: 4.1, 4.2, 4.4_
  

  - [x] 6.2 Add saved filter presets

    - Allow users to name and save filter combinations
    - Store filter presets in database
    - Add quick access to saved filters
    - Support sharing filters with team
    - _Requirements: 4.3_
  

  - [x] 6.3 Implement export functionality

    - Export filtered results to CSV
    - Export to Excel with formatting
    - Export to PDF report
    - Include all rate card details in export
    - _Requirements: 4.5_

- [ ] 7. Create comprehensive benchmarking views


  - [x] 7.1 Build benchmark card component



    - Display percentile rank with visual indicator
    - Show market position badge
    - Render percentile distribution chart
    - Display statistical summary (mean, median, percentiles)
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 7.2 Add savings analysis section



    - Show savings to median and P25
    - Calculate and display annual savings projection
    - Compare to best rate in database
    - Provide actionable recommendations
    - _Requirements: 5.3, 5.4_
  
  - [x] 7.3 Implement trend visualization



    - Create historical trend chart
    - Display MoM, QoQ, YoY changes
    - Show market trend indicators
    - Add forecast based on historical data
    - _Requirements: 5.4_
  
  - [x] 7.4 Add cohort information display


    - Show sample size and competitor count
    - Display date range for cohort
    - Show confidence score
    - Warn when cohort size is insufficient
    - _Requirements: 5.5_

- [x] 8. Implement rate comparison tool




  - [x] 8.1 Create multi-select comparison interface

    - Allow selection of multiple rate cards
    - Support comparison types (supplier vs supplier, year over year, etc.)
    - Add quick filters for finding comparable rates
    - _Requirements: 6.1_
  

  - [x] 8.2 Build side-by-side comparison view

    - Display rates in columns for easy comparison
    - Add visual indicators for differences
    - Highlight best rate
    - Show percentage variance from lowest
    - _Requirements: 6.2, 6.3_
  

  - [x] 8.3 Add comparison analytics

    - Calculate potential savings for each alternative
    - Show market position for each rate
    - Provide switching recommendations
    - _Requirements: 6.4_
  
  - [x] 8.4 Implement save and share functionality


    - Allow naming and saving comparisons
    - Store comparison in database
    - Add sharing with team members
    - Support exporting comparison to PDF
    - _Requirements: 6.5_

- [x] 9. Build AI negotiation assistant


  - [x] 9.1 Create negotiation brief generator



    - Generate comprehensive negotiation brief with AI
    - Include current situation summary
    - Add market position analysis
    - Provide target rate recommendations
    - _Requirements: 7.1, 7.2_
  
  - [x] 9.2 Implement talking points generation

    - Generate data-backed talking points
    - Prioritize points by impact
    - Include supporting market data
    - Format for easy presentation
    - _Requirements: 7.1, 7.4_
  
  - [x] 9.3 Add alternative supplier finder

    - Identify suppliers offering similar services at lower rates
    - Rank alternatives by competitiveness
    - Show detailed comparison with current supplier
    - _Requirements: 7.3_
  
  - [x] 9.4 Create downloadable negotiation brief


    - Generate PDF with all negotiation data
    - Include charts and visualizations
    - Format for professional presentation
    - Add company branding
    - _Requirements: 7.5_

- [x] 10. Implement market intelligence dashboard


  - [x] 10.1 Create market intelligence calculation service




    - Calculate aggregated statistics by role-geography
    - Compute trend analysis (MoM, YoY)
    - Analyze supplier distribution
    - Generate AI insights
    - _Requirements: 8.1, 8.2_
  
  - [x] 10.2 Build market intelligence UI


    - Display market statistics for selected segments
    - Show trend charts and indicators
    - Visualize supplier distribution
    - Present AI-generated insights
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 10.3 Add emerging trends detection


    - Identify rapidly increasing/decreasing rates
    - Detect new geographic markets
    - Flag hot roles and skills
    - Alert on significant market shifts
    - _Requirements: 8.4_
  
  - [x] 10.4 Implement filtering and time period selection


    - Add filters for role category, geography, line of service
    - Support custom date ranges
    - Allow comparison across time periods
    - _Requirements: 8.5_

- [x] 11. Build savings opportunity detection system




  - [x] 11.1 Implement automatic opportunity detection

    - Detect rates above 75th percentile
    - Identify volume discount opportunities
    - Find geographic arbitrage potential
    - Detect supplier consolidation opportunities
    - _Requirements: 9.1_
  

  - [x] 11.2 Create opportunity calculation engine

    - Calculate annual savings potential based on volume
    - Assign effort and risk levels
    - Compute confidence scores
    - Generate recommended actions
    - _Requirements: 9.2, 9.3, 9.4_
  
  - [x] 11.3 Build opportunities dashboard


    - List all opportunities sorted by savings
    - Add filters by category, status, risk
    - Show summary metrics (total opportunities, total savings)
    - Provide quick actions (approve, reject, assign)
    - _Requirements: 9.5_
  

  - [x] 11.4 Implement opportunity workflow

    - Add status tracking (identified, under review, approved, in progress, implemented)
    - Support assignment to team members
    - Track actual savings realized
    - Generate implementation reports
    - _Requirements: 9.5_



- [x] 12. Create supplier performance scorecards


  - [x] 12.1 Implement supplier benchmark calculation

    - Calculate competitiveness scores
    - Compute average rates by supplier
    - Analyze geographic and service line coverage
    - Track rate stability over time
    - _Requirements: 10.1, 10.3_
  


  - [x] 12.2 Build supplier scorecard UI

    - Display competitiveness rating (1-5 stars)
    - Show average rates and market comparison
    - Visualize geographic coverage map
    - List service line diversity
    - _Requirements: 10.2_

  
  - [x] 12.3 Add supplier comparison view

    - Compare multiple suppliers side-by-side
    - Show all performance metrics
    - Highlight best-in-class suppliers
    - Provide switching recommendations
    - _Requirements: 10.5_
  

  - [x] 12.4 Implement supplier ranking

    - Rank suppliers by competitiveness
    - Identify best value suppliers by category
    - Flag suppliers with frequent rate increases
    - _Requirements: 10.4_

- [x] 13. Build baseline target rate system


  - [x] 13.1 Create baseline entry interface



    - Build form for creating baseline rates
    - Support multiple baseline types (target, market benchmark, historical best, negotiated cap)
    - Add approval workflow
    - _Requirements: 11.1, 11.2_
  
  - [x] 13.2 Implement baseline comparison engine



    - Auto-compare actual rates against applicable baselines
    - Calculate variance (amount and percentage)
    - Determine if within tolerance
    - Flag rates exceeding baseline
    - _Requirements: 11.3, 11.4_
  
  - [x] 13.3 Add baseline tracking dashboard



    - Show baseline achievement rates
    - Display total savings vs baseline targets
    - List rates exceeding baselines
    - Track baseline performance over time
    - _Requirements: 11.5_
  
  - [x] 13.4 Implement baseline bulk import


    - Support CSV import of baseline rates
    - Validate baseline data
    - Handle updates to existing baselines
    - Generate import report
    - _Requirements: 11.1_

- [x] 14. Create executive dashboard


  - [x] 14.1 Build KPI cards


    - Total rate cards tracked
    - Total suppliers
    - Geographic coverage
    - Service line coverage
    - _Requirements: 13.1_
  

  - [x] 14.2 Add financial metrics

    - Total annual spend on rates
    - Total savings identified
    - Total savings realized
    - Average rate vs market
    - _Requirements: 13.2_
  
  - [x] 14.3 Implement performance indicators


    - Percentage of rates above market average
    - Percentage in top quartile
    - Percentage negotiated
    - Average savings per rate
    - _Requirements: 13.3_
  
  - [x] 14.4 Add top opportunities widget


    - Show top 10 savings opportunities
    - Sort by potential annual savings
    - Quick link to opportunity details
    - _Requirements: 13.4_
  
  - [x] 14.5 Create trend visualizations


    - Rate inflation by role category chart
    - Market movement indicators
    - Supplier competitiveness trends
    - Savings pipeline chart
    - _Requirements: 13.5_

- [x] 15. Implement navigation and routing



  - Create main rate cards navigation menu item
  - Set up route structure (/rate-cards/dashboard, /entries, /upload, /benchmarking, /suppliers, /opportunities, /market-intelligence)
  - Add breadcrumb navigation
  - Implement deep linking for all views
  - _Requirements: All_

- [ ] 16. Add permissions and access control
  - Define rate card permissions (view, create, edit, delete, export, manage_suppliers, view_opportunities, approve_opportunities)
  - Implement permission checks in API routes
  - Add UI permission guards
  - Create admin interface for permission management
  - _Requirements: All_

- [ ] 17. Implement audit logging
  - Log all rate card create/update/delete operations
  - Track benchmark calculations
  - Log opportunity status changes
  - Record negotiation brief generations
  - _Requirements: All_

- [ ] 18. Add background job processing
  - Set up job queue for benchmark calculations
  - Implement nightly batch benchmark updates
  - Schedule weekly market intelligence updates
  - Add job monitoring dashboard
  - _Requirements: 5.1, 8.1_

- [ ]* 19. Create user documentation
  - [ ]* 19.1 Write user guide for rate card entry
    - Document manual entry process
    - Include screenshots and examples
    - _Requirements: All_
  
  - [ ]* 19.2 Document CSV upload format and process
    - Explain CSV template structure
    - Provide upload workflow guide
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 19.3 Create negotiation assistant guide
    - Explain how to use negotiation features
    - Provide best practices
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 19.4 Add FAQ section
    - Common questions and answers
    - Troubleshooting guide
    - _Requirements: All_

- [x] 20. Perform integration testing and optimization





  - Test complete workflows end-to-end
  - Optimize database queries for performance
  - Add caching for frequently accessed data
  - Load test with large datasets
  - Fix any bugs discovered during testing
  - _Requirements: All_
