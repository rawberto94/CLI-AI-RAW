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

// Quick Actions
export * from './quick-actions';

// Drag & Drop
export * from './drag-drop';

// Empty States
export * from './empty-states';

// Responsive Sidebar
export * from './sidebar';

// Virtual Scroll & Performance
export * from './virtual-scroll';

// Keyboard Shortcuts Manager
export * from './keyboard-manager';

// Global Command Palette
export * from './global-command-palette';

// Page Transitions
export * from './page-transitions';

// Network Status
export * from './network-status';

// Session Timeout
export * from './session-timeout';

// Floating Action Button (Enhanced)
export * from './floating-action';

// Toast System (Enhanced)
export * from './toast-system';

// Drawers & Panels
export * from './drawers';

// Confirmations
export * from './confirmations';

// Data Table
export * from './data-table';

// Context Menu
export * from './context-menu';

// Search Autocomplete
export * from './search-autocomplete';

// Filter System
export * from './filter-system';

// Stepper Navigation
export * from './stepper';

// Loading States
export * from './loading-states';

// Share System
export * from './share-system';

// Feedback & Ratings
export * from './feedback-ratings';

// File Upload
export * from './file-upload';

// Tree & List Views
export * from './tree-list';

// Date & Time Picker
export * from './date-time-picker';

// Media Gallery
export * from './media-gallery';

// Rich Text Editor
export * from './rich-text';

// Settings Panel
export * from './settings-panel';

// Stats Dashboard
export * from './stats-dashboard';

// Alerts & Messages
export * from './alerts-messages';
// Page Transitions
export * from './page-transitions';

// Enhanced Data Table (v2)
export * from './data-table';

// Notification Center
export * from './notification-center';

// Command Bar (Quick Actions)
export * from './command-bar';

// Contextual Help
export * from './contextual-help';
// Onboarding
export * from "./onboarding";

// Kanban Board
export * from "./kanban-board";

// Keyboard Shortcuts
export * from "./keyboard-shortcuts";

// Mobile Drawer
export * from "./mobile-drawer";

// Activity Timeline
export * from "./activity-timeline";

// Skeleton Loaders (Enhanced)
export * from "./skeleton-loaders";

// Progress Indicators (Enhanced)
export * from "./progress-indicators";

// Micro Interactions
export * from "./micro-interactions";

// Form Validation Feedback
export * from "./form-validation";
