// Dashboard components index
export { DashboardOverview } from './DashboardOverview';
export { ProfessionalDashboard } from './ProfessionalDashboard';

// New Dashboard Widgets
export { 
  RecentActivityWidget,
  generateDemoActivities,
  type ActivityItem,
  type ActivityType,
} from './RecentActivityWidget';

export { 
  FavoriteContractsWidget,
  generateDemoFavorites,
  type FavoriteContract,
} from './FavoriteContractsWidget';

export { 
  UpcomingRenewalsWidget,
  generateDemoRenewals,
  type RenewalContract,
  type RenewalUrgency,
  type RenewalStatus,
} from './UpcomingRenewalsWidget';

export { 
  AIInsightsSummaryWidget,
  generateDemoInsights,
  generateDemoMetrics as generateDemoAIMetrics,
  type AIInsight,
  type AIMetrics,
  type InsightCategory,
  type InsightPriority,
} from './AIInsightsSummaryWidget';

export {
  ContractNotificationsWidget,
  generateDemoNotifications,
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
  generateDemoSavingsData,
  type SavingsCategory,
  type SavingsOpportunity,
  type SavingsData,
} from './SavingsTrackerWidget';

export {
  TeamActivityWidget,
  generateDemoTeamData,
  type TeamMember,
  type TeamActivity,
  type ActivityType as TeamActivityType,
} from './TeamActivityWidget';

export {
  IntegrationStatusWidget,
  generateDemoIntegrations,
  type Integration,
  type IntegrationStatus,
} from './IntegrationStatusWidget';

// Widget customization
export { DashboardWidgetCustomizer, useDashboardWidgets } from './DashboardWidgetCustomizer';
