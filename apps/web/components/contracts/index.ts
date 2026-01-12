/**
 * Contract Components Barrel Export
 * 
 * This file provides a centralized export for all contract-related components.
 * Import from '@/components/contracts' for cleaner imports.
 */

// AI & Intelligence Components
export { AISummarizer, QuickSummarizeButton } from './AISummarizer';

// Enhanced Metadata Section
export { EnhancedContractMetadataSection } from './EnhancedContractMetadataSection';

// Visualization Components
export { ContractTimeline } from './ContractTimeline';

export { ContractKanban } from './ContractKanban';

// Comparison Components
export { ContractComparison, CompareButton } from './ContractComparison';

// Tracking & Management Components
export { ObligationTracker, ObligationWidget } from './ObligationTracker';
export type { Obligation } from './ObligationTracker';

// Modal Components
export { AdvancedSearchModal } from './AdvancedSearchModal';
export type { AdvancedSearchFilters } from './AdvancedSearchModal';

// Report Components
export { AIReportModal } from './AIReportModal';

// Quick Actions & Insights Components
export { QuickActionsPanel, FloatingActionsBar, AIInsightsCard } from './QuickActionsPanel';

// Health Score Components
export { ContractHealthScore, HealthScoreWidget } from './ContractHealthScore';

// Category Components
export { 
  CategoryBadge, 
  CategorySelector, 
  CategorySuggestions, 
  CategoryOverview 
} from './CategoryComponents';

// Stats Cards
export {
  StatCard,
  TotalContractsCard,
  ActiveContractsCard,
  ProcessingContractsCard,
  TotalValueCard,
  CategorizedCard,
  HighRiskCard,
  ExpiringSoonCard,
  ContractStatsGrid,
  InlineStatsSummary,
} from './ContractStatsCards';
export type { StatCardProps, ContractStatsData } from './ContractStatsCards';

// Bulk Actions
export { BulkActionsBar, CompactBulkActions } from './BulkActionsBar';

// View Controls
export {
  ViewModeToggle,
  SortDropdown,
  Pagination,
  ExportMenu,
  ContractControlsBar,
} from './ContractViewControls';
export type { ViewMode } from './ContractViewControls';

// Page Header
export { ContractsPageHeader, CompactHeader, ContractsPageHeader as ContractsHeader } from './ContractsPageHeader';
export type { ContractsPageHeaderProps, ContractsPageHeaderProps as ContractsHeaderProps } from './ContractsPageHeader';

// Contract Hierarchy (Parent-Child Relationships)
export { ContractHierarchy } from './ContractHierarchy';

// Contract Family Health Assessment
export { ContractFamilyHealth } from './ContractFamilyHealth';

// Orphan Contracts Detection
export { OrphanContractsBanner } from './OrphanContractsBanner';

// Extraction Accuracy & Learning
export { ExtractionAccuracyCard, ExtractionFieldWithFeedback } from './ExtractionAccuracyCard';

// Notification Banners
export {
  UncategorizedBanner,
  ExpiringBanner,
  HighRiskBanner,
  SuccessBanner,
  NotificationStack,
} from './ContractBanners';

// Modular Page Components
export { StatCard as StatCardNew } from './ContractStatsCards';
export type { StatCardProps as StatsCardNewProps } from './ContractStatsCards';

export { BulkActionsBar as BulkActionsBarNew } from './BulkActionsBar';

export { ViewModeToggle as ViewModeToggleNew, VIEW_MODE_OPTIONS } from './ViewModeToggle';
export type { ViewModeOption, ViewModeToggleProps } from './ViewModeToggle';

export { FilterToolbar } from './FilterToolbar';
export type { 
  FilterToolbarProps, 
  FilterState, 
  Category as FilterCategory,
  QuickPreset,
} from './FilterToolbar';

export {
  NoContracts,
  NoResults,
  ErrorState,
  LoadingState,
  ContractsSkeleton,
  UncategorizedBanner as UncategorizedBannerNew,
  NoCategoriesState,
  ContractsEmptyState,
  ContractsNoResults,
  ContractsErrorState,
  ContractsLoadingState,
} from './EmptyStates';
export type {
  EmptyStateProps,
  NoContractsProps,
  NoResultsProps,
  ErrorStateProps,
  LoadingStateProps,
  UncategorizedBannerProps,
} from './EmptyStates';

// Contracts List
export { ContractsList, ContractsList as default } from './ContractsList';
export type { 
  ContractsListProps,
  Contract as ContractListItem,
  ViewMode as ContractViewMode,
} from './ContractsList';

// Pagination
export { 
  PaginationControls, 
  PaginationInfo, 
  MiniPagination,
} from './PaginationControls';
export type { PaginationProps } from './PaginationControls';

// Search and Filters Bar
export { SearchFiltersBar } from './SearchFiltersBar';
export type { SearchFiltersBarProps } from './SearchFiltersBar';

// Contract Quick Actions
export { 
  ContractQuickActions,
  ContractQuickActionsIcon,
  ContractQuickActionsMenu,
} from './ContractQuickActions';
export type { ContractQuickActionsProps } from './ContractQuickActions';

// Saved Filters Panel
export { SavedFiltersPanel } from './SavedFiltersPanel';

// Filter Presets Dropdown
export { FilterPresetsDropdown } from './FilterPresetsDropdown';

// Analytics Cards
export { ContractAnalyticsCards } from './ContractAnalyticsCards';

// Artifact Editors
export { ArtifactEditor } from './ArtifactEditor';
export { EnhancedArtifactEditor } from './EnhancedArtifactEditor';
export { RateCardEditor } from './RateCardEditor';
export { ArtifactHistory } from './ArtifactHistory';

// AI Analysis
export { AIAnalysisPanel } from './AIAnalysisPanel';

// Risk Assessment
export { RiskAssessmentPanel } from './RiskAssessmentPanel';
export type { RiskFactor, RiskAssessment } from './RiskAssessmentPanel';

// Batch Operations
export { BatchOperationsPanel } from './BatchOperationsPanel';
export { BulkActionsPanel } from './BulkActionsPanel';
export type { SelectedContract } from './BulkActionsPanel';

// Deadline Tracking
export { DeadlineTracker } from './DeadlineTracker';

// Version History
export { VersionHistory } from './VersionHistory';
export { VersionManager } from './VersionManager';

// PDF Viewer
export { PDFViewer, SplitViewContainer } from './PDFViewer';

// Contract Reminders
export { ContractReminders } from './ContractReminders';

// Contract Audit Log
export { ContractAuditLog } from './ContractAuditLog';

// SLA Monitoring
export { SLAMonitoring } from './SLAMonitoring';

// Compliance Checklist
export { ComplianceChecklist } from './ComplianceChecklist';

// Negotiation Tracker
export { NegotiationTracker } from './NegotiationTracker';

// Quick Upload Modal
export { QuickUploadModal } from './QuickUploadModal';

// AI Draft Assistant
export { AIDraftAssistant } from './AIDraftAssistant';
