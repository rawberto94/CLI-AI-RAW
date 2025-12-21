/**
 * Enhanced UI Components - Barrel Export
 * Import all enhanced UI components from a single location
 *
 * Usage:
 *   import { GradientButton, EnhancedBadge, Modal } from '@/components/ui/enhanced';
 */

// ============================================
// Enhanced Buttons
// ============================================
export {
  GradientButton,
  IconButton,
  AsyncActionButton,
  FAB,
  SplitButton,
  useRipple,
} from './enhanced-buttons';

// ============================================
// Enhanced Badges
// ============================================
export {
  EnhancedBadge,
  StatusBadge,
  CountBadge,
  TrendBadge,
  PriorityBadge,
  FeatureBadge,
  BadgeGroup,
  AnimatedBadgeList,
} from './enhanced-badges';

// ============================================
// Interactive Cards
// ============================================
export {
  HoverCard,
  SelectableCard,
  ActionCard,
  ExpandableCard,
  StatsCard,
  FeatureCard,
  PricingCard,
  CardWithActions,
} from './interactive-cards';

// ============================================
// Micro Interactions
// ============================================
export {
  AnimatedToggle,
  LikeButton,
  CopyFeedbackButton,
  IconToggle,
  BookmarkToggle,
  NotificationToggle,
  VisibilityToggle,
  LockToggle,
  MuteToggle,
  PlayPauseToggle,
  ProgressRing,
  Confetti,
  DeleteButton,
  ArchiveButton,
  UndoButton,
} from './micro-interactions';

// ============================================
// Enhanced Form Inputs
// ============================================
export {
  EnhancedInput,
  SearchInput,
  FloatingLabelInput,
  EnhancedTextarea,
  EnhancedCheckbox,
  EnhancedRadio,
  PinInput,
} from './enhanced-inputs';

// ============================================
// Enhanced Loading States
// ============================================
export {
  EnhancedSkeleton,
  TextSkeleton,
  AvatarSkeleton,
  CardSkeleton,
  TableSkeleton,
  DashboardSkeleton,
  AnimatedSpinner,
  BouncingDots,
  AnimatedProgressBar,
  OverlayLoader,
  TypingIndicator,
} from './enhanced-loading';

// ============================================
// Feedback States
// ============================================
export {
  EnhancedEmptyState,
  SearchNoResults,
  DataNotYetCreated,
  NotificationsEmpty,
  MessagesEmpty,
  FavoritesEmpty,
  BookmarksEmpty,
  CartEmpty,
  TeamEmpty,
  EventsEmpty,
  FileUploadPrompt,
  EnhancedErrorState,
  EnhancedSuccessState,
  ProFeatureTeaser,
  AlertBanner,
} from './feedback-states';

// ============================================
// Tooltips & Popovers
// ============================================
export {
  EnhancedTooltip,
  RichTooltip,
  Popover,
  DropdownMenu,
  ContextMenu,
  CommandMenu,
  SelectMenu,
} from './tooltips-popovers';

// ============================================
// Navigation Components
// ============================================
export {
  AnimatedTabs,
  TabPanel,
  Breadcrumbs,
  Pagination,
  Stepper,
  ProgressSteps,
  SegmentedControl,
  PageHeader,
} from './navigation-components';

// ============================================
// Modals & Dialogs
// ============================================
export {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  AlertDialog,
  DeleteDialog,
  BottomSheet,
  Drawer,
  ImagePreview,
  FullPageModal,
  useModal,
  useConfirmation,
} from './enhanced-modals';

// ============================================
// Data Display
// ============================================
export {
  Avatar,
  AvatarGroup,
  ListItem,
  List,
  Timeline,
  DataTable,
  StatDisplay,
  KeyValueList,
  ProgressTracker,
} from './data-display';

// ============================================
// File Upload
// ============================================
export {
  FileItem,
  Dropzone,
  FileUploadManager,
  ImageUpload,
} from './file-upload';

// ============================================
// Notification System
// ============================================
export {
  NotificationProvider,
  useNotifications,
  NotificationCenter,
  InlineAlert,
} from './notification-system';

// ============================================
// Type Exports
// ============================================
export type { } from './enhanced-buttons';
export type { } from './enhanced-badges';
export type { } from './interactive-cards';
export type { } from './micro-interactions';
export type { } from './enhanced-inputs';
export type { } from './enhanced-loading';
export type { } from './feedback-states';
export type { } from './tooltips-popovers';
export type { } from './navigation-components';
export type { } from './enhanced-modals';
export type { } from './data-display';
export type { } from './file-upload';
export type { } from './notification-system';
