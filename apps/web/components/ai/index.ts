// AI Components - Central Export
// Enterprise AI dashboards and visualization components

// Chat & Interaction
// TODO: Module './ChatAssistant' does not exist
// export { default as ChatAssistant } from './ChatAssistant';
export { FloatingAIBubble } from './FloatingAIBubble';
// TODO: Module './ProfessionalChatbot' does not exist
// export { default as ProfessionalChatbot } from './ProfessionalChatbot';

// Extraction & Insights
export { default as ExtractionConfidenceHeatmap } from './ExtractionConfidenceHeatmap';
export { default as ExtractionInsightsDashboard } from './ExtractionInsightsDashboard';

// Enterprise AI Dashboards
export { AIDecisionAuditDashboard } from './AIDecisionAuditDashboard';
export { KnowledgeGraphVisualization } from './KnowledgeGraphVisualization';
export { ObligationTrackerDashboard } from './ObligationTrackerDashboard';
export { PredictiveAnalyticsDashboard } from './PredictiveAnalyticsDashboard';
export { ModelRegistryDashboard } from './ModelRegistryDashboard';

// Chat submodule
export * from './chat';

// New AI components
export { AIActivityFeed } from './AIActivityFeed';
export { AISuggestionFeedback, useSuggestionFeedback } from './AISuggestionFeedback';
