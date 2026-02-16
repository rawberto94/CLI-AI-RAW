// Dashboard components index
export { DashboardOverview } from './DashboardOverview';
export { ProfessionalDashboard } from './ProfessionalDashboard';

// New Dashboard Widgets
export { 
  RecentActivityWidget,
  type ActivityItem,
  type ActivityType,
} from './RecentActivityWidget';

export { 
  FavoriteContractsWidget,
  type FavoriteContract,
} from './FavoriteContractsWidget';

export { 
  UpcomingRenewalsWidget,
  type RenewalContract,
  type RenewalUrgency,
  type RenewalStatus,
} from './UpcomingRenewalsWidget';

export { 
  AIInsightsSummaryWidget,
  type AIInsight,
  type AIMetrics,
  type InsightCategory,
  type InsightPriority,
} from './AIInsightsSummaryWidget';

export {
  ContractNotificationsWidget,
  type ContractNotification,
  type NotificationType,
  type NotificationPriority,
  type NotificationSettings,
} from './ContractNotificationsWidget';

export {
  KeyboardShortcutsPanel,
  useKeyboardShortcuts,
  defaultShortcuts,
  type KeyboardShortcut,
  type ShortcutCategory,
} from './KeyboardShortcutsPanel';

export {
  SavingsTrackerWidget,
  type SavingsCategory,
  type SavingsOpportunity,
  type SavingsData,
} from './SavingsTrackerWidget';

export {
  TeamActivityWidget,
  type TeamMember,
  type TeamActivity,
  type ActivityType as TeamActivityType,
} from './TeamActivityWidget';

export {
  IntegrationStatusWidget,
  type Integration,
  type IntegrationStatus,
} from './IntegrationStatusWidget';

// Widget customization
export { DashboardWidgetCustomizer, useDashboardWidgets } from './DashboardWidgetCustomizer';
