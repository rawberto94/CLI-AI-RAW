/**
 * UX Components Library
 * Comprehensive export of all user experience components
 * 
 * Usage:
 *   import { Modal, Toast, Pagination } from '@/components/ux';
 */

// Dialogs & Overlays
export * from './modal';
export * from './dialogs';
export * from './command';
export * from './dropdown';

// Feedback - Alert
export * from './alert';

// Feedback - Enhanced Toast (from toast folder with ToastProvider)
export { 
  ToastProvider, 
  useToast, 
  standaloneToast 
} from './toast';
export type { 
  Toast, 
  ToastOptions, 
  ToastVariant, 
  ToastPosition, 
  ToastAction, 
  ToastProviderProps 
} from './toast';

// Feedback - Legacy toast utilities from feedback folder
export { 
  EnhancedToastProvider, 
  useToastActions,
  toast as legacyToast,
  setToastFunction,
} from './feedback';

// Data Display
export * from './data';
export * from './cards';
export * from './badges';
export * from './avatar';
export * from './timeline';

// Navigation
export * from './breadcrumbs';
export * from './tabs';
export * from './pagination';

// Forms & Inputs - Core form components
export { TextInput, Textarea, Select, Checkbox } from './forms';
// Note: PasswordInput exported from inputs (enhanced version)

// Forms & Inputs - Enhanced inputs
export { 
  TagInput, 
  TagsDisplay, 
  TagColorPicker,
  EnhancedInput, 
  PasswordInput, 
  SearchInput, 
  EmailInput, 
  UsernameInput 
} from './inputs';
export type { 
  EnhancedInputProps, 
  PasswordInputProps, 
  SearchInputProps, 
  EmailInputProps 
} from './inputs';

// Toggle, Slider, Rating, DatePicker
export * from './toggle';
export * from './slider';
export * from './rating';
export * from './datepicker';
export * from './upload';
export * from './clipboard';

// Layout
export * from './accordion';
export * from './sortable';

// Interactive - Floating Action Button
export * from './fab';

// Accessibility
export * from './accessibility';

// Loading States - New Skeleton components (preferred)
export {
  Skeleton,
  ShimmerSkeleton,
  TextSkeleton,
  AvatarSkeleton,
  CardSkeleton,
  ListItemSkeleton,
  TableSkeleton,
  StatsSkeleton,
  PageSkeleton,
  FormSkeleton,
} from './skeleton';
export type {
  SkeletonProps,
  TextSkeletonProps,
  AvatarSkeletonProps,
  CardSkeletonProps,
  ListItemSkeletonProps,
  TableSkeletonProps,
} from './skeleton';

// Onboarding & Tours
export * from './spotlight';

// Utilities - Overlays
export * from './overlays';
export * from './search';
export * from './keyboard';

// Shared - Empty States & Legacy Skeletons
export { 
  EmptyState, 
  NoSearchResults, 
  ErrorState, 
  OfflineState, 
  InlineEmptyState 
} from './shared';
// Legacy skeletons with specific naming (for backwards compatibility)
export {
  ContractCardSkeleton,
  ContractListSkeleton,
  ContractRowSkeleton,
  DashboardStatsSkeleton,
  ChartSkeleton,
  ContractDetailSkeleton,
  ProfileSkeleton,
  NotificationSkeleton,
  UploadProgressSkeleton,
} from './shared';

// Multi-step Form Wizard
export * from './wizard';

// Contextual Help
export * from './help';

// Notification Center
export * from './notification-center';

// Inline Edit
export * from './inline-edit';

// Undo Toast
export * from './undo-toast';

// Sparklines & Mini Charts
export * from './sparklines';
