/**
 * Contract Components Barrel Export
 * 
 * This file provides a centralized export for all contract-related components.
 * Import from '@/components/contracts' for cleaner imports.
 */

// AI & Intelligence Components
export { AISummarizer, QuickSummarizeButton } from './AISummarizer';

// Visualization Components
export { ContractTimeline, TimelineHeader } from './ContractTimeline';
export type { TimelineContract, TimelineMilestone } from './ContractTimeline';

export { ContractKanban, KanbanColumn, KanbanContractCard } from './ContractKanban';
export type { KanbanContract, KanbanColumn as KanbanColumnType } from './ContractKanban';

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

export { BulkActionsBar as BulkActionsBarNew, BulkActionButton } from './BulkActionsBar';
export type { BulkActionsBarProps, BulkAction } from './BulkActionsBar';

export { ViewModeToggle as ViewModeToggleNew, VIEW_MODES, VIEW_MODE_ICONS } from './ViewModeToggle';
export type { ViewMode as ViewModeType, ViewModeOption } from './ViewModeToggle';

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
