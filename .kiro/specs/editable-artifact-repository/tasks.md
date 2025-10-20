# Implementation Plan: Editable Artifact Repository

## Overview

This implementation plan transforms the contract artifacts system into a fully editable repository with automatic propagation to all analytical engines. Tasks are organized in phases for incremental delivery.

**Key Decisions:**
- ✅ Manual save with "Save" button
- ✅ All authenticated users can edit
- ✅ Optimistic locking with conflict detection

---

## Phase 1: Database Schema & Core Services

### - [ ] 1. Database Schema Migration
- [ ] 1.1 Create migration file `packages/clients/db/migrations/XXX_editable_artifacts.sql`
  - Add new columns to Artifact table (isEdited, editCount, lastEditedBy, lastEditedAt, validationStatus, validationIssues, consumedBy, lastPropagatedAt, propagationStatus)
  - Create artifact_edits table with indexes
  - Add new columns to contract_metadata table
  - Create triggers for automatic edit tracking
  - Add comments for documentation
  - _Requirements: 1.1, 1.2, 4.1, 4.2_

- [ ] 1.2 Update Prisma schema
  - Modify Artifact model in `packages/clients/db/schema.prisma`
  - Add ArtifactEdit model
  - Update ContractMetadata model
  - Add relations and indexes
  - _Requirements: 1.1, 4.1_

- [ ] 1.3 Generate Prisma client and test migration
  - Run `npx prisma generate`
  - Run `npx prisma migrate dev --name editable_artifacts`
  - Verify all indexes created
  - Test rollback script
  - _Requirements: 1.1_

### - [ ] 2. Editable Artifact Service
- [ ] 2.1 Create EditableArtifactService class
  - File: `packages/data-orchestration/src/services/editable-artifact.service.ts`
  - Implement updateArtifact() method with optimistic locking
  - Implement updateArtifactField() for single field updates
  - Implement bulkUpdateArtifacts() method
  - Add version creation on every edit
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1_

- [ ] 2.2 Implement validation framework
  - Create validateArtifactUpdate() method
  - Add validation rules for each artifact type
  - Implement field-level validation
  - Add business rule validation
  - Return structured validation errors
  - _Requirements: 1.3, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 2.3 Add version history methods
  - Implement getArtifactVersionHistory()
  - Implement compareVersions()
  - Implement revertToVersion()
  - Add version diff calculation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 2.4 Implement conflict detection
  - Add lastModified timestamp check
  - Detect concurrent edit conflicts
  - Return conflict information
  - _Requirements: 1.1, 1.2_

---

## Phase 2: Rate Card Editing

### - [ ] 3. Rate Card Service Extensions
- [ ] 3.1 Add rate card specific methods to EditableArtifactService
  - Implement updateRateCardEntry()
  - Implement addRateCardEntry()
  - Implement deleteRateCardEntry()
  - Implement bulkUpdateRateCards()
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 6.4_

- [ ] 3.2 Implement rate card validation
  - Create validateRateCardStructure() method
  - Validate against EnhancedRate interface
  - Check required fields (role, seniorityLevel, rates, currency)
  - Validate rate calculations (hourly/daily/monthly consistency)
  - Validate location data
  - Validate skills and certifications
  - _Requirements: 2.4, 2.5, 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 3.3 Add rate card import/export
  - Implement exportRateCard() method
  - Support CSV, Excel, JSON formats
  - Implement importRateCard() with validation
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

---

## Phase 3: Event Propagation System

### - [ ] 4. Artifact Change Propagation Service
- [ ] 4.1 Create ArtifactChangePropagationService
  - File: `packages/data-orchestration/src/services/artifact-change-propagation.service.ts`
  - Implement propagateArtifactChange() method
  - Add identifyAffectedEngines() logic
  - Implement notifyEngine() for each analytical engine
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 13.1, 13.2, 13.3_

- [ ] 4.2 Integrate with analytical engines
  - Connect to Rate Card Benchmarking Engine
  - Connect to Renewal Radar Engine
  - Connect to Compliance Engine
  - Connect to Supplier Snapshot Engine
  - Connect to Spend Overlay Engine
  - Connect to Cost Savings Analysis
  - _Requirements: 11.2, 11.3, 11.4_

- [ ] 4.3 Implement search index updates
  - Update ContractSearchIndex on artifact changes
  - Trigger full-text reindexing
  - Update faceted search metadata
  - _Requirements: 11.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 4.4 Implement RAG knowledge base sync
  - Trigger RAG reindexing on artifact changes
  - Update contract embeddings
  - Sync to knowledge graph
  - _Requirements: 11.5_

- [ ] 4.5 Add event bus integration
  - Add new event types to event-bus.ts
  - Publish ARTIFACT_UPDATED events
  - Publish ARTIFACT_PROPAGATION_COMPLETED events
  - Subscribe to artifact change events
  - _Requirements: 11.1, 11.5_

- [ ] 4.6 Implement retry logic for failed propagations
  - Add exponential backoff retry strategy
  - Track propagation status
  - Log permanent failures
  - Send admin notifications on failures
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

---

## Phase 4: Metadata Editing

### - [ ] 5. Metadata Editor Service
- [ ] 5.1 Extend TaxonomyService for editing
  - Add updateContractMetadataWithPropagation() method
  - Implement bulk metadata updates
  - Add tag management methods
  - Add custom field management
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 5.2 Implement metadata validation
  - Validate custom field types
  - Validate tag formats
  - Validate system field constraints
  - _Requirements: 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 5.3 Add custom metadata field management
  - Implement createMetadataField()
  - Implement updateMetadataField()
  - Implement deleteMetadataField()
  - Add field validation rules
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

---

## Phase 5: API Endpoints

### - [ ] 6. Artifact Edit API Routes
- [ ] 6.1 Create artifact update endpoint
  - File: `apps/web/app/api/contracts/[id]/artifacts/[artifactId]/route.ts`
  - Implement PUT handler for full artifact updates
  - Add authentication middleware
  - Add tenant validation
  - Return updated artifact with version
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 6.2 Create field update endpoint
  - File: `apps/web/app/api/contracts/[id]/artifacts/[artifactId]/fields/route.ts`
  - Implement PATCH handler for single field updates
  - Support nested field paths (e.g., "data.rateCards[0].hourlyRate")
  - _Requirements: 1.1, 1.2_

- [ ] 6.3 Create bulk update endpoint
  - File: `apps/web/app/api/contracts/[id]/artifacts/bulk-update/route.ts`
  - Implement POST handler for bulk updates
  - Process updates in transaction
  - Return success/failure for each update
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 6.4 Create rate card management endpoints
  - POST `/api/contracts/[id]/artifacts/[artifactId]/rates` - Add rate entry
  - PUT `/api/contracts/[id]/artifacts/[artifactId]/rates/[rateId]` - Update rate entry
  - DELETE `/api/contracts/[id]/artifacts/[artifactId]/rates/[rateId]` - Delete rate entry
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 6.5 Create validation endpoint
  - File: `apps/web/app/api/contracts/[id]/artifacts/[artifactId]/validate/route.ts`
  - Implement POST handler for validation
  - Return validation results without saving
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 6.6 Create version history endpoints
  - GET `/api/contracts/[id]/artifacts/[artifactId]/versions` - List versions
  - GET `/api/contracts/[id]/artifacts/[artifactId]/versions/[version]` - Get specific version
  - POST `/api/contracts/[id]/artifacts/[artifactId]/revert/[version]` - Revert to version
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

### - [ ] 7. Metadata Edit API Routes
- [ ] 7.1 Create metadata update endpoint
  - File: `apps/web/app/api/contracts/[id]/metadata/route.ts` (extend existing)
  - Add PUT handler for metadata updates
  - Trigger search index update
  - Trigger RAG sync
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 7.2 Create tag management endpoints
  - POST `/api/contracts/[id]/metadata/tags` - Add tags
  - DELETE `/api/contracts/[id]/metadata/tags/[tagName]` - Remove tag
  - _Requirements: 3.1, 3.2_

- [ ] 7.3 Create bulk metadata update endpoint
  - File: `apps/web/app/api/contracts/metadata/bulk-update/route.ts`
  - Support updating multiple contracts at once
  - _Requirements: 3.1, 3.2, 6.1, 6.2, 6.3, 6.4, 6.5_

---

## Phase 6: UI Components

### - [ ] 8. Artifact Editor Components
- [ ] 8.1 Create ArtifactEditor component
  - File: `apps/web/components/contracts/ArtifactEditor.tsx`
  - Implement inline editing mode
  - Add "Edit" / "Save" / "Cancel" buttons
  - Show validation errors inline
  - Display loading states during save
  - Show success/error notifications
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 8.2 Add conflict detection UI
  - Show warning dialog when conflict detected
  - Display conflicting changes
  - Offer "Overwrite" or "Cancel" options
  - _Requirements: 1.1, 1.2_

- [ ] 8.3 Create field-level editors
  - Text input for strings
  - Number input for numeric fields
  - Date picker for dates
  - Dropdown for enums
  - Currency input for financial fields
  - _Requirements: 1.1, 1.2_

### - [ ] 9. Rate Card Editor Component
- [ ] 9.1 Create RateCardEditor component
  - File: `apps/web/components/contracts/RateCardEditor.tsx`
  - Implement editable table with inline editing
  - Add row selection for bulk operations
  - Add "Add Rate" button
  - Add "Delete" button for selected rows
  - Add "Bulk Edit" button
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 9.2 Implement rate card table cells
  - Editable cells with validation
  - Dropdown for role selection
  - Dropdown for seniority level
  - Currency input for rates
  - Location autocomplete
  - Skills multi-select
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 9.3 Add bulk edit dialog
  - Modal for bulk editing selected rows
  - Show fields that can be bulk updated
  - Apply changes to all selected rows
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 9.4 Add import/export UI
  - File upload for CSV/Excel import
  - Export button with format selection
  - Show import validation results
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

### - [ ] 10. Metadata Editor Component
- [ ] 10.1 Enhance ContractMetadataEditor component
  - File: `apps/web/components/contracts/ContractMetadataEditor.tsx` (extend existing)
  - Add inline editing for all fields
  - Add tag autocomplete
  - Add custom field editors
  - Show data quality score
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 10.2 Create tag management UI
  - Tag input with autocomplete
  - Show existing tags as chips
  - Remove tag on click
  - Suggest related tags
  - _Requirements: 3.1, 3.2_

- [ ] 10.3 Add custom field management
  - Dynamic form based on field definitions
  - Validation based on field type
  - Show field descriptions
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

### - [ ] 11. Version History Component
- [ ] 11.1 Create VersionHistoryPanel component
  - File: `apps/web/components/contracts/VersionHistoryPanel.tsx`
  - List all versions with timestamps
  - Show who made each change
  - Display change summary
  - Add "View" and "Revert" buttons
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 11.2 Create VersionCompareDialog component
  - Side-by-side diff view
  - Highlight changed fields
  - Show old vs new values
  - _Requirements: 4.2, 4.3_

---

## Phase 7: Integration & Testing

### - [ ] 12. Integration Testing
- [ ] 12.1 Test artifact editing flow
  - Test single field updates
  - Test full artifact updates
  - Test validation errors
  - Test conflict detection
  - Test version creation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 12.2 Test rate card editing
  - Test adding rate entries
  - Test updating rate entries
  - Test deleting rate entries
  - Test bulk updates
  - Test import/export
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 12.3 Test propagation system
  - Test event publishing
  - Test analytical engine notifications
  - Test search index updates
  - Test RAG sync
  - Test retry logic
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 12.4 Test metadata editing
  - Test tag management
  - Test custom fields
  - Test bulk updates
  - Test search integration
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 12.5 Test version history
  - Test version listing
  - Test version comparison
  - Test version revert
  - Test audit trail
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 13.1, 13.2, 13.3, 13.4, 13.5_

### - [ ] 13. End-to-End Testing
- [ ] 13.1 Test complete edit workflow
  - Upload contract → Extract artifacts → Edit artifacts → Save → Verify propagation
  - Test with all artifact types
  - Test with multiple concurrent users
  - _Requirements: All_

- [ ] 13.2 Test data consistency
  - Verify analytical engines receive updates
  - Verify search index is updated
  - Verify RAG knowledge base is synced
  - Verify benchmarks are recalculated
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 13.3 Performance testing
  - Test with large artifacts (>1MB)
  - Test bulk updates (100+ artifacts)
  - Test concurrent edits (10+ users)
  - Measure propagation latency
  - _Requirements: All_

---

## Phase 8: Documentation & Deployment

### - [ ] 14. Documentation
- [ ] 14.1 Update API documentation
  - Document all new endpoints
  - Add request/response examples
  - Document error codes
  - _Requirements: All_

- [ ] 14.2 Create user guide
  - How to edit artifacts
  - How to manage rate cards
  - How to use version history
  - How to bulk edit
  - _Requirements: All_

- [ ] 14.3 Create developer guide
  - Architecture overview
  - Service integration guide
  - Event propagation flow
  - Adding new validation rules
  - _Requirements: All_

### - [ ] 15. Deployment
- [ ] 15.1 Run database migration in staging
  - Backup database
  - Run migration
  - Verify schema changes
  - Test rollback
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 15.2 Deploy services to staging
  - Deploy EditableArtifactService
  - Deploy ArtifactChangePropagationService
  - Deploy API endpoints
  - _Requirements: All_

- [ ] 15.3 Deploy UI components to staging
  - Deploy all editor components
  - Test in staging environment
  - Verify all integrations
  - _Requirements: All_

- [ ] 15.4 Production deployment
  - Schedule maintenance window
  - Run database migration
  - Deploy services
  - Deploy UI
  - Monitor for errors
  - _Requirements: All_

---

## Success Criteria

- ✅ All artifacts are editable with inline UI
- ✅ Rate cards include all fields required by benchmarking engine
- ✅ Metadata is fully editable with tag management
- ✅ Version history tracks all changes
- ✅ Changes propagate to all 6 analytical engines within 5 seconds
- ✅ Search index updates in real-time
- ✅ RAG knowledge base stays in sync
- ✅ No data loss or corruption
- ✅ Conflict detection prevents concurrent edit issues
- ✅ Validation prevents invalid data entry

## Notes

- **Phase 1-2** can be developed in parallel with Phase 3
- **Phase 4** depends on Phase 3 completion
- **Phase 5-6** can be developed in parallel once Phase 1-4 are complete
- **Phase 7** requires all previous phases
- **Phase 8** is final deployment phase

**Estimated Timeline**: 3-4 weeks for full implementation
**Team Size**: 2-3 developers recommended
