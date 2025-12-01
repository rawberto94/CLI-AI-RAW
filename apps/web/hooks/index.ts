/**
 * Hooks Index
 * 
 * Central export point for all custom hooks
 */

// Data fetching & mutations
export * from './use-queries';
export * from './use-cross-module-actions';

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
