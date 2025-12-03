# Contracts Page Architecture

This document describes the modular architecture for the contracts page and related components.

## Overview

The contracts page has been refactored into a modular component-based architecture that separates concerns, improves testability, and enables code reuse.

## Directory Structure

```
apps/web/
├── app/contracts/
│   ├── page.tsx                    # Original contracts page
│   └── ContractsPageRefactored.tsx # Refactored modular version
├── components/contracts/
│   ├── index.ts                    # Barrel exports
│   ├── ContractsList.tsx           # Contract list with multiple view modes
│   ├── FilterToolbar.tsx           # Comprehensive filter UI
│   ├── StatsCards.tsx              # Stat card components
│   ├── BulkActionsBar.tsx          # Bulk actions toolbar
│   ├── ViewModeToggle.tsx          # View mode selector
│   ├── ContractsHeader.tsx         # Hero header section
│   ├── PaginationControls.tsx      # Pagination UI
│   ├── EmptyStates.tsx             # Various empty state components
│   ├── SearchFiltersBar.tsx        # Search and filter controls bar
│   ├── ContractQuickActions.tsx    # Quick action buttons for contracts
│   ├── CategoryComponents.tsx      # Category badge, selector, etc.
│   └── ... (other components)
├── hooks/
│   ├── index.ts                    # Barrel exports
│   ├── use-contracts-page.ts       # 🆕 Unified integration hook
│   ├── use-contract-filters.ts     # Filter state management
│   ├── use-contract-sorting.ts     # Sorting logic
│   ├── use-pagination.ts           # Generic pagination logic
│   ├── use-contract-selection.ts   # Multi-select with shift support
│   ├── use-bulk-operations.ts      # Bulk operations with progress
│   └── use-contracts-keyboard-shortcuts.ts # Keyboard shortcuts
└── lib/contracts/
    ├── types.ts                    # TypeScript types
    ├── constants.ts                # Constants and configurations
    ├── filters.ts                  # Filter utility functions
    ├── utils.ts                    # General utilities
    ├── animations.ts               # Framer Motion animations
    ├── search.ts                   # Search utilities
    ├── filter-utils.ts             # Additional filter helpers
    ├── view-preferences.ts         # View preference management
    └── saved-filters.ts            # Saved filter presets
```

## Quick Start

The fastest way to use the new architecture is with the unified `useContractsPage` hook:

```typescript
import { useContractsPage } from '@/hooks';
import { 
  ContractsList, 
  FilterToolbar, 
  PaginationControls 
} from '@/components/contracts';

export function ContractsPage() {
  const { state, actions, queryParams } = useContractsPage({
    initialPageSize: 20,
    persistState: true,
    enableKeyboardShortcuts: true,
  });

  // Use queryParams for API calls
  const { data } = useContracts(queryParams);

  return (
    <div>
      <FilterToolbar 
        filters={state.filters}
        onFilterChange={actions.setFilter}
        onClearFilters={actions.resetFilters}
        activeFilterCount={state.activeFiltersCount}
      />
      
      <ContractsList
        contracts={data?.contracts}
        selectedIds={state.selection.selectedIds}
        onSelectionChange={actions.toggleItem}
      />
      
      <PaginationControls
        currentPage={state.currentPage}
        totalPages={state.totalPages}
        onPageChange={actions.goToPage}
      />
    </div>
  );
}
```

## Custom Hooks

### `useContractsPage` (Unified Hook)

The recommended way to use the contracts page functionality. Combines all individual hooks into a single API.

```typescript
import { useContractsPage } from '@/hooks';

const {
  // Combined state
  state: {
    // Filters
    filters,                 // Current filter values
    activeFiltersCount,      // Number of active filters
    isFiltered,              // Whether any filters are active
    
    // Sorting
    sortField,               // Current sort field
    sortDirection,           // 'asc' | 'desc'
    sortKey,                 // Combined key for React
    
    // Pagination
    currentPage,             // Current page number
    pageSize,                // Items per page
    totalPages,              // Total number of pages
    totalItems,              // Total number of items
    hasNextPage,             // Whether there's a next page
    hasPreviousPage,         // Whether there's a previous page
    startIndex,              // Start index of current page
    endIndex,                // End index of current page
    
    // Selection
    selection,               // Selection state object
    selectedCount,           // Number of selected items
    hasSelection,            // Whether any items are selected
    
    // Bulk operations
    bulkOperation,           // Current bulk operation state
    isBulkOperationActive,   // Whether a bulk op is in progress
  },
  
  // Combined actions
  actions: {
    // Filter actions
    setFilter,               // Set a single filter
    setFilters,              // Set multiple filters
    resetFilters,            // Reset all filters
    applyQuickPreset,        // Apply a quick preset
    toggleFilterValue,       // Toggle a value in an array filter
    
    // Sort actions
    setSort,                 // Set sort field and direction
    toggleSort,              // Toggle sort for a field
    resetSort,               // Reset to default sort
    
    // Pagination actions
    goToPage,                // Go to a specific page
    nextPage,                // Go to next page
    previousPage,            // Go to previous page
    setPageSize,             // Set items per page
    goToFirst,               // Go to first page
    goToLast,                // Go to last page
    resetPagination,         // Reset pagination state
    
    // Selection actions
    selectItem,              // Select an item
    deselectItem,            // Deselect an item
    toggleItem,              // Toggle item selection
    selectAll,               // Select all items
    deselectAll,             // Deselect all items
    toggleAll,               // Toggle all selection
    selectRange,             // Select a range of items
    isSelected,              // Check if item is selected
    
    // Bulk operations
    startBulkOperation,      // Start a bulk operation
    cancelBulkOperation,     // Cancel current operation
    undoLastOperation,       // Undo last operation
    
    // Combined
    resetAll,                // Reset all state
    applyFilterAndResetPage, // Apply filter and go to page 1
  },
  
  // API query params (ready for API call)
  queryParams: {
    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
    status,
    type,
    // ... all filter params
  },
  
  // Helper functions
  filterContracts,           // Filter contracts locally
  sortContracts,             // Sort contracts locally
  paginateContracts,         // Paginate contracts locally
  registerShortcuts,         // Register keyboard shortcuts
} = useContractsPage({
  initialFilters: { status: ['active'] },
  initialSortField: 'lastUpdated',
  initialSortDirection: 'desc',
  initialPageSize: 20,
  persistState: true,
  enableKeyboardShortcuts: true,
  totalItems: 100,           // From API
  allContractIds: ['1', '2'], // For selection
});
```

### `useContractFilters`

Manages all filter state for the contracts page.

```typescript
import { useContractFilters } from '@/hooks';

const {
  // State
  filters,                   // Current filter values
  activeFiltersCount,        // Number of active filters
  
  // Actions
  setFilter,                 // Set a single filter
  setFilters,                // Set multiple filters
  resetFilters,              // Clear all filters
  toggleFilterValue,         // Toggle a value in array filter
  applyQuickPreset,          // Apply a preset
  
  // Derived data helpers
  sortContracts,             // Sort function
  filterContracts,           // Filter function
} = useContractFilters({
  initialFilters: {},
  persistToUrl: true,
  persistToLocalStorage: true,
  debounceMs: 300,
});
```

### `useContractSorting`

Manages sorting state and logic.

```typescript
import { useContractSorting } from '@/hooks';

const {
  sortField,                 // Current sort field
  sortDirection,             // 'asc' | 'desc'
  sortKey,                   // Combined key
  
  toggleSort,                // Toggle sort for a field
  setSort,                   // Set sort field and direction
  resetSort,                 // Reset to default
  sortContracts,             // Sort function
} = useContractSorting({
  initialField: 'lastUpdated',
  initialDirection: 'desc',
  persistToUrl: true,
});
```

### `usePagination`

Generic pagination hook.

```typescript
import { usePagination } from '@/hooks';

const {
  pagination: {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    startIndex,
    endIndex,
  },
  
  goToPage,
  nextPage,
  previousPage,
  goToFirst,
  goToLast,
  setPageSize,
  setTotalItems,
  resetPagination,
  paginateItems,             // Paginate an array
} = usePagination({
  totalItems: 100,
  initialPageSize: 20,
  initialPage: 1,
  persistToUrl: true,
});
```

### `useContractSelection`

Multi-select with shift-click support.

```typescript
import { useContractSelection } from '@/hooks';

const {
  selection: {
    selectedIds,             // Set of selected IDs
    lastSelectedId,          // Last selected ID (for shift-click)
    isAllSelected,           // All items selected
    isIndeterminate,         // Some items selected
  },
  
  selectItem,                // Select an item
  deselectItem,              // Deselect an item
  toggleItem,                // Toggle with shift support
  selectAll,                 // Select all
  deselectAll,               // Clear selection
  toggleAll,                 // Toggle all
  selectRange,               // Select a range
  isSelected,                // Check if selected
} = useContractSelection({
  allItemIds: contractIds,
  preserveOnFilter: false,
  maxSelection: undefined,
  onSelectionChange: (ids) => console.log(ids),
});
```

### `useBulkOperations`

Bulk operations with progress tracking.

```typescript
import { useBulkOperations } from '@/hooks';

const {
  state: {
    isProcessing,
    operation,
    progress,
    processedIds,
    failedIds,
    canUndo,
    lastOperation,
  },
  
  startBulkOperation,        // Start operation
  cancelOperation,           // Cancel in-progress op
  undoLastOperation,         // Undo last operation
} = useBulkOperations();

// Start a bulk export
await startBulkOperation('export', ['id1', 'id2', 'id3']);

// Available operations:
// 'export' | 'delete' | 'archive' | 'analyze' | 'share' | 'categorize'
```

### `useContractsKeyboardShortcuts`

Keyboard shortcuts for the contracts page.

```typescript
import { useContractsKeyboardShortcuts } from '@/hooks';

useContractsKeyboardShortcuts({
  onSearch: () => searchInputRef.current?.focus(),
  onRefresh: () => refetch(),
  onToggleView: () => setViewMode(v => v === 'grid' ? 'list' : 'grid'),
  onNewContract: () => setShowNewDialog(true),
  onEscape: () => {
    deselectAll();
    setShowFilters(false);
  },
  onSelectAll: () => selectAll(),
  onExport: () => exportSelected(),
  onDelete: () => confirmDelete(),
  enabled: true,
});

// Shortcuts:
// / - Focus search
// r - Refresh
// v - Toggle view
// n - New contract
// Escape - Clear selection
// a - Toggle select all
// Cmd/Ctrl + A - Select all
// Cmd/Ctrl + E - Export selected
// Cmd/Ctrl + D - Delete selected
```

## Components

### `ContractsList`

Renders contracts in multiple view modes with selection support.

```tsx
<ContractsList
  contracts={paginatedContracts}
  viewMode="compact"         // 'compact' | 'cards' | 'timeline' | 'kanban'
  selectedIds={selectedIds}
  onSelectionChange={setSelectedIds}
  onContractClick={handleContractClick}
  onContractEdit={handleEdit}
  onContractDelete={handleDelete}
  isLoading={isLoading}
  sortField={sortField}
  sortDirection={sortDirection}
  onSort={handleSort}
/>
```

### `FilterToolbar`

Comprehensive filter UI with search, dropdowns, and quick presets.

```tsx
<FilterToolbar
  filters={filters}
  onFilterChange={setFilter}
  onClearFilters={resetFilters}
  onApplyPreset={applyQuickPreset}
  categories={categories}
  statuses={statuses}
  vendors={vendors}
  departments={departments}
  activeFilterCount={activeFiltersCount}
  totalContracts={totalContracts}
  filteredCount={filteredCount}
/>
```

### `SearchFiltersBar`

Compact search and filter controls.

```tsx
<SearchFiltersBar
  searchValue={filters.search}
  onSearchChange={(value) => setFilter('search', value)}
  onFilterToggle={() => setShowFilters(v => !v)}
  showFiltersPanel={showFilters}
  activeFilterCount={activeFiltersCount}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
/>
```

### `BulkActionsBar`

Toolbar for bulk operations on selected contracts.

```tsx
<BulkActionsBar
  selectedCount={selectedIds.size}
  onClearSelection={deselectAll}
  onSelectAll={selectAll}
  onExport={() => startBulkOperation('export', Array.from(selectedIds))}
  onDelete={() => startBulkOperation('delete', Array.from(selectedIds))}
  onAnalyze={() => startBulkOperation('analyze', Array.from(selectedIds))}
  isProcessing={isBulkOperationActive}
  progress={bulkOperation.progress}
/>
```

### `PaginationControls`

Pagination UI with page size selector.

```tsx
<PaginationControls
  currentPage={currentPage}
  totalPages={totalPages}
  totalItems={totalItems}
  pageSize={pageSize}
  onPageChange={goToPage}
  onPageSizeChange={setPageSize}
  startIndex={startIndex}
  endIndex={endIndex}
/>
```

### `ContractQuickActions`

Quick action buttons for individual contracts.

```tsx
<ContractQuickActions
  contractId={contract.id}
  status={contract.status}
  onView={() => router.push(`/contracts/${contract.id}`)}
  onEdit={() => openEditDialog(contract)}
  onDelete={() => confirmDelete(contract)}
  onShare={() => openShareDialog(contract)}
  onAnalyze={() => analyzeContract(contract)}
/>
```

### Empty States

Various empty state components.

```tsx
import { 
  NoContracts, 
  NoResults, 
  ErrorState, 
  LoadingState,
  UncategorizedBanner,
} from '@/components/contracts';

// No contracts at all
<NoContracts onUpload={handleUpload} />

// No search results
<NoResults 
  searchTerm={search}
  hasFilters={activeFiltersCount > 0}
  onClearSearch={() => setFilter('search', '')}
  onClearFilters={resetFilters}
/>

// Error loading
<ErrorState error="Failed to load" onRetry={refetch} />

// Loading
<LoadingState message="Loading contracts..." />

// Uncategorized contracts banner
<UncategorizedBanner
  count={uncategorizedCount}
  onCategorize={handleCategorize}
/>
```

## Quick Presets

The filter system supports quick presets for common filter combinations:

```typescript
import { QUICK_PRESETS } from '@/hooks';

// Available presets:
// - 'expiring-soon': Contracts expiring within 30 days
// - 'expiring-this-quarter': Contracts expiring this quarter
// - 'high-value': Contracts over $100k
// - 'high-risk': High risk contracts
// - 'needs-review': Contracts needing review
// - 'recently-updated': Updated in last 7 days
// - 'pending-approval': Pending approval status
// - 'active-only': Active contracts only
// - 'expired': Expired contracts
```

## Migration Guide

To migrate from the original `page.tsx` to the new modular architecture:

### Option 1: Use the refactored page directly

```tsx
// app/contracts/page.tsx
export { default } from './ContractsPageRefactored';
```

### Option 2: Gradually migrate

1. Import individual hooks as needed
2. Replace inline state with hook calls
3. Replace inline components with modular versions
4. Update props to match new interfaces

### Option 3: Use the unified hook

```tsx
// Simplest migration - replace most state with useContractsPage
const { state, actions, queryParams } = useContractsPage(config);
```

## Benefits of This Architecture

1. **Separation of Concerns**: Each hook and component has a single responsibility
2. **Reusability**: Hooks and components can be used across different pages
3. **Testability**: Isolated logic is easier to unit test
4. **Maintainability**: Smaller files are easier to understand and modify
5. **Type Safety**: Full TypeScript support with exported types
6. **Performance**: Memoized components and computed values
7. **Flexibility**: Easy to add new filters, view modes, or actions
8. **Keyboard Accessibility**: Built-in keyboard shortcuts
9. **Bulk Operations**: Progress tracking and undo support
10. **State Persistence**: Optional URL and localStorage persistence

## File Size Comparison

| File | Original | Refactored |
|------|----------|------------|
| page.tsx | ~3091 lines | ~700 lines |
| Total hooks | 0 | ~1000 lines (6 hooks) |
| Total components | embedded | ~1500 lines (8 components) |

The refactored architecture splits the monolithic page into:
- 6 reusable hooks (~1000 lines)
- 8 focused components (~1500 lines)
- 1 streamlined page (~700 lines)

While the total line count is similar, the modular approach provides better maintainability, reusability, and testability.

