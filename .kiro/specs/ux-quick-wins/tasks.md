# Implementation Plan

## Overview

This implementation plan breaks down the UX Quick Wins feature into discrete, manageable coding tasks. Each task builds incrementally on previous work and includes specific requirements references. The plan prioritizes core functionality first, with optional testing tasks marked with "*".

---

## Phase 1: Foundation & Database Setup

- [x] 1. Set up database schema for user preferences and analytics



  - Create Prisma migration for UserPreferences model
  - Create Prisma migration for OnboardingAnalytics model
  - Create Prisma migration for ProgressEvent model
  - Create Prisma migration for BackgroundJob model
  - Create Prisma migration for HelpAnalytics model
  - Create Prisma migration for WidgetAnalytics model
  - Run migrations and verify schema
  - _Requirements: 1.7, 2.5, 3.8, 4.8_

- [ ]* 1.1 Write database migration tests
  - Test schema creation
  - Test foreign key constraints
  - Test indexes
  - _Requirements: 1.7, 2.5, 3.8, 4.8_

- [x] 2. Create base API routes for user preferences



  - Implement GET /api/user/preferences route
  - Implement POST /api/user/preferences route
  - Implement PATCH /api/user/preferences route
  - Add authentication middleware
  - Add input validation
  - _Requirements: 1.7, 2.5_

- [ ]* 2.1 Write API route tests
  - Test GET preferences endpoint
  - Test POST preferences endpoint
  - Test authentication
  - Test validation errors
  - _Requirements: 1.7, 2.5_

---

## Phase 2: Guided Onboarding Flow

- [x] 3. Enhance existing OnboardingWizard component



  - Add state persistence to localStorage
  - Implement progress tracking for each step
  - Add role selection step with all role options
  - Add goals selection step
  - Add completion step with next actions
  - Integrate with UserPreferences API
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 3.1 Create onboarding API endpoints


  - Implement GET /api/user/onboarding route
  - Implement POST /api/user/onboarding route
  - Implement POST /api/user/onboarding/skip route
  - Add onboarding analytics tracking
  - _Requirements: 1.7, 1.8_

- [x] 3.2 Implement onboarding resume functionality


  - Check onboarding status on app load
  - Show "Resume onboarding" prompt if incomplete
  - Restore onboarding state from saved progress
  - _Requirements: 1.7, 1.8_

- [x] 3.3 Add sample data option for onboarding


  - Create sample contract data generator
  - Integrate sample data into "Upload your first contract" step
  - Allow users to skip upload with sample data
  - _Requirements: 1.10_

- [ ]* 3.4 Write onboarding component tests
  - Test step progression
  - Test role selection
  - Test state persistence
  - Test skip functionality
  - Test resume functionality
  - _Requirements: 1.1-1.10_

---

## Phase 3: Smart Dashboard Personalization

- [x] 4. Create role-based default dashboard layouts


  - Define default layout for Procurement Manager role
  - Define default layout for Analyst role
  - Define default layout for Executive role
  - Define default layout for Legal role
  - Define default layout for Finance role
  - Create layout configuration file
  - _Requirements: 2.1, 2.2, 2.3, 2.10_

- [x] 4.1 Implement PersonalizedDashboard component

  - Create dashboard layout engine
  - Implement widget grid system with drag-and-drop
  - Add widget visibility toggles
  - Integrate with UserPreferences API
  - Load role-based default on first visit
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4.2 Create dashboard API endpoints

  - Implement GET /api/dashboard/layout route
  - Implement POST /api/dashboard/layout route
  - Implement GET /api/dashboard/suggestions route
  - Add layout validation
  - _Requirements: 2.5, 2.6_

- [x] 4.3 Implement AI-powered widget suggestions



  - Create WidgetSuggestionEngine class
  - Analyze user activity from audit logs
  - Generate widget suggestions based on usage patterns
  - Display suggestions in dashboard UI
  - _Requirements: 2.6_

- [x] 4.4 Add role-specific quick actions


  - Define quick actions for each role
  - Implement quick action buttons in dashboard
  - Make quick actions customizable
  - _Requirements: 2.7_

- [x] 4.5 Implement multiple dashboard views


  - Add "Save View" functionality
  - Add "Switch View" dropdown
  - Store multiple layouts per user
  - _Requirements: 2.8_

- [x] 4.6 Add "What's New" section


  - Create What's New widget
  - Add dismissible cards for new features
  - Track dismissed items per user
  - _Requirements: 2.9_

- [ ]* 4.7 Write dashboard personalization tests
  - Test role-based layouts
  - Test drag-and-drop functionality
  - Test layout persistence
  - Test widget suggestions
  - Test multiple views
  - _Requirements: 2.1-2.10_

---

## Phase 4: Enhanced Progress Feedback

- [x] 5. Set up WebSocket infrastructure



  - Install and configure Socket.io
  - Create WebSocket server integration with Next.js
  - Implement authentication for WebSocket connections
  - Set up room-based subscriptions
  - _Requirements: 3.6, 3.8_

- [x] 5.1 Create ProgressTrackingService



  - Implement progress event emission
  - Implement WebSocket broadcasting
  - Add progress event persistence to database
  - Implement job history retrieval
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5.2 Enhance MultiStageProgress component


  - Add real-time progress updates via WebSocket
  - Display detailed status messages
  - Show estimated time remaining
  - Add "Continue in background" functionality
  - Implement error display with recovery guidance
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.9_

- [x] 5.3 Integrate progress tracking with contract processing


  - Emit progress events during file validation
  - Emit progress events during upload
  - Emit progress events during text extraction
  - Emit progress events during AI analysis
  - Emit progress events during artifact generation
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5.4 Implement background job management


  - Create BackgroundJob tracking system
  - Add persistent notification indicator
  - Implement job completion notifications
  - Create background jobs list view
  - _Requirements: 3.6, 3.7, 3.8_

- [x] 5.5 Add batch file processing UI


  - Create queue view for multiple files
  - Add prioritization controls
  - Add cancel functionality
  - Show per-file progress
  - _Requirements: 3.10_

- [x] 5.6 Create progress API endpoints



  - Implement GET /api/progress/[jobId] route
  - Implement GET /api/background-jobs route
  - Implement DELETE /api/background-jobs/[id] route
  - _Requirements: 3.6, 3.7, 3.8_

- [ ]* 5.7 Write progress tracking tests
  - Test WebSocket connections
  - Test progress event emission
  - Test background job tracking
  - Test error handling
  - _Requirements: 3.1-3.10_

---

## Phase 5: Contextual Help System

- [ ] 6. Set up help content infrastructure
  - Create .kiro/help directory structure
  - Create .kiro/help/tours subdirectory
  - Install markdown parser (gray-matter)
  - Install tour library (driver.js)
  - _Requirements: 4.1, 4.2, 4.6_

- [ ] 6.1 Create HelpContentManager service
  - Implement markdown file loading
  - Implement tour definition loading
  - Implement content search functionality
  - Add content caching
  - _Requirements: 4.1, 4.2, 4.9_

- [ ] 6.2 Create help content files
  - Write help content for upload zone
  - Write help content for rate benchmarking
  - Write help content for compliance check
  - Write help content for dashboard customization
  - Write help content for contract search
  - _Requirements: 4.1, 4.2_

- [ ] 6.3 Create interactive tour definitions
  - Create "First Upload" tour JSON
  - Create "Rate Benchmarking" tour JSON
  - Create "Dashboard Setup" tour JSON
  - Create "Compliance Workflow" tour JSON
  - _Requirements: 4.6, 4.7_

- [ ] 6.4 Implement ContextualHelp component
  - Create rich tooltip component
  - Create help popover component
  - Integrate with help content manager
  - Add keyboard shortcuts display
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 6.5 Implement TourManager and InteractiveTour
  - Create TourManager class using driver.js
  - Implement tour step highlighting
  - Add tour progress tracking
  - Implement tour completion tracking
  - _Requirements: 4.6, 4.7, 4.8_

- [ ] 6.6 Add contextual help to key UI elements
  - Add help tooltips to upload zone
  - Add help tooltips to dashboard widgets
  - Add help tooltips to use case cards
  - Add help tooltips to navigation items
  - Add "?" icons for complex features
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 6.7 Create help center search interface
  - Implement searchable help center page
  - Add search results display
  - Add category filtering
  - Link to video tutorials
  - _Requirements: 4.9_

- [ ] 6.8 Implement proactive help suggestions
  - Detect user struggling patterns
  - Show contextual help suggestions
  - Offer relevant tours automatically
  - _Requirements: 4.10_

- [ ] 6.9 Create help API endpoints
  - Implement GET /api/help/content/[id] route
  - Implement GET /api/help/search route
  - Implement GET /api/help/tours/[id] route
  - Implement POST /api/help/tours/complete route
  - Implement POST /api/help/tours/track route
  - _Requirements: 4.8_

- [ ]* 6.10 Write help system tests
  - Test help content loading
  - Test search functionality
  - Test tour execution
  - Test completion tracking
  - _Requirements: 4.1-4.10_

---

## Phase 6: Integration & Polish

- [-] 7. Integrate onboarding with dashboard

  - Show onboarding wizard on first login
  - Apply role-based dashboard after onboarding
  - Show "Resume onboarding" prompt if skipped
  - _Requirements: 1.1, 1.9, 2.1, 2.2, 2.3_

- [x] 7.1 Add onboarding trigger to main layout


  - Check onboarding status on app load
  - Display onboarding wizard modal
  - Handle onboarding completion
  - Handle onboarding skip
  - _Requirements: 1.1, 1.8, 1.9_



- [ ] 7.2 Integrate progress tracking with upload flow
  - Replace existing progress indicators with MultiStageProgress
  - Add WebSocket connection to upload page
  - Show background job notifications
  - _Requirements: 3.1, 3.2, 3.6, 3.7_

- [ ] 7.3 Add help system to all major pages


  - Integrate contextual help on dashboard
  - Integrate contextual help on contracts page
  - Integrate contextual help on analytics page
  - Integrate contextual help on use cases page
  - Add global help button to navigation
  - _Requirements: 4.1, 4.2, 4.5_


- [x] 7.4 Implement global keyboard shortcuts

  - Add Cmd+K for command palette (already exists)
  - Add Cmd+? for help center
  - Add Cmd+/ for keyboard shortcuts list
  - Display shortcuts in UI
  - _Requirements: 4.2_


- [x] 7.5 Add success celebrations

  - Show confetti on onboarding completion
  - Show success animation on first contract upload
  - Show achievement badges for milestones
  - _Requirements: 1.9_

- [x] 7.6 Implement error boundaries


  - Add error boundary for onboarding wizard
  - Add error boundary for dashboard widgets
  - Add error boundary for progress tracker
  - Add error boundary for help system
  - _Requirements: 1.9, 2.5, 3.9, 4.1_

- [ ]* 7.7 Write integration tests
  - Test onboarding to dashboard flow
  - Test upload with progress tracking
  - Test help system across pages
  - Test keyboard shortcuts
  - _Requirements: 1.1-1.10, 2.1-2.10, 3.1-3.10, 4.1-4.10_

---

## Phase 7: Analytics & Monitoring

- [x] 8. Implement UX metrics collection



  - Create UXMetricsCollector service
  - Track onboarding completion events
  - Track dashboard customization events
  - Track help content usage events
  - Track tour completion events
  - _Requirements: 1.7, 2.5, 4.8_

- [x] 8.1 Create analytics dashboard for admins


  - Build UX metrics dashboard page
  - Display onboarding completion rate
  - Display dashboard customization rate
  - Display help usage statistics
  - Display most popular widgets
  - Display most viewed help content
  - _Requirements: 1.7, 2.5, 4.8_

- [x] 8.2 Add performance monitoring


  - Monitor dashboard load times
  - Monitor widget render times
  - Monitor WebSocket connection health
  - Monitor help content load times
  - Set up alerts for performance degradation
  - _Requirements: 2.5, 3.6, 4.9_

- [ ]* 8.3 Write analytics tests
  - Test metrics collection
  - Test analytics dashboard
  - Test performance monitoring
  - _Requirements: 1.7, 2.5, 4.8_

---

## Phase 8: Documentation & Deployment

- [ ] 9. Create user documentation
  - Write onboarding guide
  - Write dashboard customization guide
  - Write help system usage guide
  - Create video tutorials for key features
  - _Requirements: 4.1, 4.2_

- [ ] 9.1 Create developer documentation
  - Document database schema changes
  - Document API endpoints
  - Document WebSocket protocol
  - Document help content format
  - Document tour definition format
  - _Requirements: 1.7, 2.5, 3.6, 4.1, 4.6_

- [ ] 9.2 Set up deployment configuration
  - Configure WebSocket server for production
  - Set up environment variables
  - Configure help content CDN
  - Set up database migrations
  - _Requirements: 3.6, 4.9_

- [ ] 9.3 Create deployment checklist
  - Database migration steps
  - Environment variable setup
  - WebSocket server configuration
  - Help content deployment
  - Feature flag configuration
  - _Requirements: All_

- [ ] 9.4 Perform final QA testing
  - Test onboarding flow end-to-end
  - Test dashboard personalization end-to-end
  - Test progress tracking end-to-end
  - Test help system end-to-end
  - Test on multiple browsers
  - Test on mobile devices
  - _Requirements: All_

---

## Task Execution Notes

### Priority Order
1. **Phase 1**: Foundation (Tasks 1-2) - Required for all other phases
2. **Phase 2**: Onboarding (Tasks 3-3.4) - Highest user impact
3. **Phase 3**: Dashboard (Tasks 4-4.7) - High user impact
4. **Phase 4**: Progress (Tasks 5-5.7) - Medium user impact
5. **Phase 5**: Help (Tasks 6-6.10) - Medium user impact
6. **Phase 6**: Integration (Tasks 7-7.7) - Required for cohesive experience
7. **Phase 7**: Analytics (Tasks 8-8.3) - Important for measuring success
8. **Phase 8**: Documentation (Tasks 9-9.4) - Required for deployment

### Testing Strategy
- Tasks marked with "*" are optional testing tasks
- Core functionality should be tested manually during development
- Optional tests provide additional confidence but are not required for MVP
- Integration tests (7.7) are more valuable than individual unit tests

### Estimated Timeline
- **Phase 1**: 1 day
- **Phase 2**: 2 days
- **Phase 3**: 3 days
- **Phase 4**: 3 days
- **Phase 5**: 2 days
- **Phase 6**: 2 days
- **Phase 7**: 1 day
- **Phase 8**: 1 day
- **Total**: ~15 days (3 weeks)

### Dependencies
- Phase 2-5 depend on Phase 1 (database schema)
- Phase 6 depends on Phases 2-5 (integration)
- Phase 7 depends on Phase 6 (analytics on integrated system)
- Phase 8 depends on Phase 7 (documentation of complete system)

### Success Criteria
- ✅ Onboarding completion rate > 85%
- ✅ Time to first value < 5 minutes
- ✅ Dashboard customization rate > 60%
- ✅ Help content usage > 70%
- ✅ Feature discovery (3+ use cases) > 80%
- ✅ All core functionality working without errors
- ✅ Performance targets met (< 1s dashboard load)

---

**Implementation Plan Status**: ✅ Complete and Ready for Execution
**Total Tasks**: 60 (45 core + 15 optional testing)
**Estimated Effort**: 15 days
**Next Step**: Begin execution with Phase 1, Task 1
