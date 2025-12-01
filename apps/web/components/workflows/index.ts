// Full-featured components (legacy)
export { ApprovalsQueue } from './ApprovalsQueue';
export { RenewalManager } from './RenewalManager';
export { ApprovalNotificationBell } from './ApprovalNotificationBell';
export { ApprovalAnalytics } from './ApprovalAnalytics';
export { WorkflowBuilder } from './WorkflowBuilder';

// LEAN components - prefer these for new code
export { SimpleWorkflowBuilder } from './SimpleWorkflowBuilder';
export { QuickApprovalCard, QuickApprovalList } from './QuickApprovalCard';

// Enhanced workflow components
export { 
  WorkflowProgressStepper, 
  WorkflowProgressBar, 
  SLAIndicator 
} from './WorkflowProgressStepper';
export { 
  AIRiskAssessment, 
  AIRiskBadge, 
  RiskScoreGauge,
  generateMockRiskFactors 
} from './AIRiskAssessment';
export { 
  BulkActionBar, 
  BulkActionConfirmDialog 
} from './BulkActionBar';
export { 
  DeadlineAlertBanner, 
  DeadlineAlertCard, 
  DeadlineIndicator,
  useDeadlineAlerts 
} from './DeadlineAlerts';
export { CommentsThread } from './CommentsThread';
export { 
  ApprovalHistory,
  CompactApprovalHistory
} from './ApprovalHistory';
export { 
  SmartSuggestionWidget,
  SmartSuggestionPanel,
  SuggestionBadge,
  ConfidenceMeter,
  useSmartSuggestion,
  generateMockSuggestion
} from './SmartApprovalSuggestions';
export {
  SwipeableApprovalCard,
  MobileApprovalList,
  MobileQuickActions,
  MobileFilterChips,
  MobileStatsSummary,
  useMobileView
} from './MobileApprovalExperience';
export {
  TemplateCard,
  TemplateSelector,
  TemplateEditor,
  useApprovalTemplates,
  DEFAULT_TEMPLATES
} from './ApprovalTemplates';
export type { ApprovalTemplate, ApprovalStep, TemplateCategory } from './ApprovalTemplates';
export {
  ApprovalAnalyticsDashboard,
  ApprovalMetricsWidget
} from './ApprovalAnalyticsDashboard';
