/**
 * Hooks Index
 * 
 * Central export point for all custom hooks
 */

// Data fetching & mutations - use-queries is the main source for query hooks
export * from './use-queries';

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

export * from './use-background-sync';

// Workflow Templates
export * from './use-workflow-templates';

// UI State
export { useCopyToClipboard, copyToClipboard } from './useCopyToClipboard';
export { useUndoableAction, useUndoableDelete, showUndoToast } from './useUndoableAction';
export { useDebounce, useDebounceCallback } from './useDebounce';
export { useThrottle, useThrottleCallback, useRafThrottle, useThrottledState } from './useThrottle';
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
  useMediaQuery,
  useBreakpoint,
  usePreferredColorScheme,
  usePreferredMotion,
  useOrientation,
  usePrefersContrast,
  useResponsiveValue,
} from './useMediaQuery';
export type { Breakpoint, ColorScheme, MotionPreference, Orientation } from './useMediaQuery';

// Real-time
export { 
  useCollaboration,
  useApprovalFlow,
  useContractApprovalStatus,
  useSharing,
  useComments,
} from './use-collaboration';

// Accessibility & UX
export * from './useAccessibility';
export * from './useKeyboardShortcuts';
export * from './useResponsive';

// Performance
export * from './usePerformanceMonitor';

// Domain-specific
export { useDataMode } from './useDataMode';
export type { DataMode } from './useDataMode';
export { 
  useNegotiationPrep,
  useRenewalRadar,
  useSavingsPipeline,
  useSupplierAnalytics,
} from './useProcurementIntelligence';

// API & Streaming
export * from './useApiCall';
export * from './useArtifactStream';
export * from './useErrorHandler';

// Toast (re-export)
export * from './use-toast';

// Contracts page hooks
export * from './use-contract-filters';
export * from './use-pagination';
export * from './use-saved-filters';
export * from './use-contract-analytics';

// Metadata extraction
export * from './useMetadataExtraction';
