/**
 * UI Enhancement Components Index
 * Centralized exports for all enhanced UI components
 */

// Enhanced Status Badge (module not yet created)
// export { 
//   EnhancedStatusBadge, 
//   type StatusType 
// } from './ui/enhanced-status-badge';

// Enhanced Skeletons
export {
  Skeleton,
  KPICardSkeleton,
  ContractListSkeleton,
  TableSkeleton,
  DashboardSkeleton,
  ContractDetailSkeleton,
} from './ui/skeletons';

// Empty States
export {
  EmptyState,
} from './shared/EmptyState';

// Progress Indicators
export {
  ProgressBar,
  UploadProgress,
  StepIndicator,
  CircularProgress,
  AIProcessingIndicator
} from './ui/enhanced-progress';

// Charts
export {
  TrendChart,
  DistributionChart,
  RiskDistributionChart,
  ComparisonChart,
  Sparkline
} from './charts/enhanced-charts';

// Theme
export {
  ThemeProvider,
  useTheme,
  ThemeToggle,
  ThemeSelector,
  ThemeSwitch
} from './theme/ThemeProvider';

// Command Palette
export {
  CommandPalette,
  useCommandPalette
} from './command/CommandPalette';

// Notifications
export {
  NotificationCenter,
  NotificationBell,
  type Notification
} from './notifications/NotificationCenter';

// Onboarding
export {
  OnboardingTour,
  useOnboardingTour
} from './onboarding/OnboardingTour';

// Dashboard
export { EnhancedKPICard } from './dashboard/EnhancedKPICard';

// Navigation
export { default as EnhancedNavigation } from './layout/EnhancedNavigation';
