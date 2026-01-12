'use client';

/**
 * Cost Savings Dashboard Widget
 * 
 * This file re-exports from SavingsTrackerWidget for backwards compatibility.
 * For new implementations, import directly from SavingsTrackerWidget.
 */

// Re-export the enhanced widget for backwards compatibility
export { 
  SavingsTrackerWidget as CostSavingsDashboardWidget,
  SavingsTrackerWidget,
  generateDemoSavingsData,
  type SavingsCategory,
  type SavingsOpportunity,
  type SavingsData,
} from './SavingsTrackerWidget';

export { SavingsTrackerWidget as default } from './SavingsTrackerWidget';
