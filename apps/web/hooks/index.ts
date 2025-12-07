/**
 * Hooks Index
 * 
 * Central export point for all custom hooks
 */

// Data fetching & mutations - use-queries is the main source for query hooks
export * from './use-queries';

// Cross-module actions - selective exports to avoid usePendingApprovals conflict
export { 
  type Approval,
  type Notification,
  type ShareRequest,
  type AIAnalysisRequest,
  crossModuleKeys,
  useContractApprovals,
  useRequestApproval,
  useRespondToApproval,
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationsRead,
  useShareContract,
  useContractShares,
  useRevokeShare,
  useRunAIAnalysis,
  useAISuggestions,
  useAIChat,
  useAIQueryHistory,
  useContractActions,
  useBulkContractActions,
  // usePendingApprovals is exported from use-queries with better implementation
} from './use-cross-module-actions';

export * from './use-propagation';

// Optimistic mutations - named exports to avoid conflicts with useContractHealth
export { 
  useOptimisticMutation,
  useApiKeys,
  useDeleteApiKey,
  useToggleApiKey,
  useCreateApiKey,
  useWebhooks,
  useDeleteWebhook,
  useToggleWebhook,
  useCreateWebhook,
  useUpdateWebhook,
  useTestWebhook,
  useRiskFlags,
  useResolveRiskFlag,
  useDismissRiskFlag,
  useBulkResolveFlags,
  useDeleteSavedFilter,
  useShareFilter,
  useCreateFilter,
  useDeleteComparison,
  useCreateComparison,
  useContractHealth as useContractHealthMutations,
  useRefreshHealth,
  useReassessContract,
} from './use-optimistic-mutations';

// Rate Card Queries - named exports to avoid conflicts
export { 
  type EmergingTrend,
  type TrackingData,
  type StrategicRecommendation,
  type MarketBenchmark,
  type RateCardEntry as RateCardQueryEntry,
  rateCardQueryKeys,
  useEmergingTrends,
  useBaselineTracking,
  useBaseline,
  useStrategicRecommendations,
  useMarketBenchmarks,
  useRateCardEntries as useRateCardEntriesQuery,
  useDismissTrend,
  useCreateBaseline,
  useUpdateBaseline,
  useActOnRecommendation,
  usePrefetchRateCards,
  useRateCardInvalidation,
} from './use-rate-card-queries';

// Settings Queries
export * from './use-settings-queries';

// Saved Items Queries (filters, comparisons) - named exports to avoid conflicts
export { 
  type SavedFilter as SavedFilterQuery,
  type SavedComparison as SavedComparisonQuery,
  savedItemsQueryKeys,
  useSavedFiltersQuery,
  useDeleteSavedFilterMutation,
  useShareFilterMutation,
  useSavedComparisonsQuery,
  useSavedComparisonQuery,
  useDeleteComparisonMutation,
  useShareComparisonMutation,
  useSavedItemsInvalidation,
} from './use-saved-items-queries';

// Monitoring Queries (audit logs, activity)
export * from './use-monitoring-queries';

export * from './use-prefetch';
export * from './use-background-sync';
export * from './use-focus-management';

// UI State
export { useLocalStorage, useRecentItems, useLocalStorageToggle } from './useLocalStorage';
export { useCopyToClipboard, copyToClipboard } from './useCopyToClipboard';
export { useUndoableAction, useUndoableDelete, showUndoToast } from './useUndoableAction';
export { useDebounce, useDebounceCallback } from './useDebounce';
export { useThrottle, useThrottleCallback, useRafThrottle, useThrottledState } from './useThrottle';
export { useInlineEdit, useSimpleInlineEdit } from './useInlineEdit';
export { 
  usePrevious, 
  usePreviousDistinct, 
  useHasChanged, 
  useChangeCount, 
  useDiff, 
  useValueHistory,
  useFirstRender,
  useUpdateEffect 
} from './usePrevious';
export {
  useToggle,
  useDisclosure,
  useCycle,
  useSetState,
  useCounter,
  useMap,
  useSet,
} from './useToggle';
export {
  useEventListener,
  useOnClickOutside,
  useOnClickOutsideMultiple,
  useWindowSize,
  useScrollPosition,
  useScrollDirection,
  useHover,
  useFocus,
  useIsVisible,
} from './useEventListener';
export {
  useAsync,
  useAsyncCallback,
  useAsyncRetry,
  useLatestAsync,
  useAsyncFn,
} from './useAsync';
export {
  useInterval,
  useTimeout,
  useTimeoutFn,
  useIntervalFn,
  useCountdown,
  useStopwatch,
  useNow,
  useIdleTimeout,
} from './useInterval';
export {
  useModal,
  useConfirmModal,
  useMultiStepModal,
  useSheetModal,
  useModalStack,
} from './useModal';
export {
  useForm,
  useFieldArray,
  validators,
} from './useForm';
export {
  useTabs,
  useTabsWithHistory,
  useAccordion,
  useSteps,
} from './useTabs';
export {
  useFetch,
  useMutation,
  useInfiniteScroll,
  clearFetchCache,
  invalidateFetchCache,
} from './useFetch';
export {
  useMediaQuery,
  useBreakpoint,
  usePreferredColorScheme,
  usePreferredMotion,
  useOrientation,
  usePrefersContrast,
  useResponsiveValue,
} from './useMediaQuery';
export type { Breakpoint, ColorScheme, MotionPreference, Orientation } from './useMediaQuery';
export {
  useSelection,
  useSelectionWithShift,
  useCheckboxGroup,
  useRadioGroup,
} from './useSelection';
export {
  useListState,
  useFilteredList,
  useSortedList,
  usePaginatedList,
} from './useListState';
export type { SortConfig, FilterConfig, PaginationConfig } from './useListState';
export {
  useDownload,
  useExportCsv,
  useExportJson,
  usePrint,
} from './useDownload';
export {
  useBodyScroll,
  useScrollLock,
  useFocusTrap,
  useEscapeKey,
  useOverlay,
  useClickAway,
} from './useOverlay';

// Real-time
export * from './useRealTimeUpdates';
export * from './useRealTimeApprovals';
export { 
  useCollaboration,
  useApprovalFlow,
  useContractApprovalStatus,
  useSharing,
  useComments,
  // Note: useNotifications exported from use-cross-module-actions takes priority
} from './use-collaboration';

// Accessibility & UX
export * from './useAccessibility';
export * from './useKeyboardShortcuts';
export * from './useAnimation';
export * from './useResponsive';
export * from './useResponsiveLayout';

// Performance
export * from './usePerformanceMonitor';
export * from './useLoadingState';

// Domain-specific
export { useDataMode } from './useDataMode';
export type { DataMode } from './useDataMode';
export * from './useNegotiationData';
export { 
  useNegotiationPrep,
  useRenewalRadar,
  useSavingsPipeline,
  useSupplierAnalytics,
} from './useProcurementIntelligence';

// API & Streaming
export * from './useApiCall';
export { 
  useApiData,
  useDashboardStats,
  useRenewals,
  useGovernance,
  useContractHealth,
  useForecast,
  // Note: useApprovals exported from use-queries takes priority
} from './useApiData';
export * from './useArtifactStream';
export { 
  useEventStream,
  type StreamEvent,
} from './useEventStream';
export { 
  useImprovementStream,
  // StreamEvent type conflicts - use from useEventStream
} from './useImprovementStream';
export * from './useErrorHandler';
export * from './usePaginatedData';

// Toast (re-export)
export * from './use-toast';

// Contracts page hooks
export * from './use-contract-filters';
export * from './use-contract-sorting';
export * from './use-pagination';
export * from './use-contract-selection';
export * from './use-bulk-operations';
export * from './use-contracts-keyboard-shortcuts';
// TODO: Fix use-contracts-page types - temporarily disabled
// export * from './use-contracts-page';
export * from './use-saved-filters';
export * from './use-contract-analytics';
export * from './use-contract-export';

// Metadata extraction
export * from './useMetadataExtraction';
