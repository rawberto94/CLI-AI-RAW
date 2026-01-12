/**
 * Contracts Dashboard - Upcoming Renewals Component
 * 
 * This file re-exports from UpcomingRenewalsWidget for backwards compatibility.
 * For new implementations, import directly from UpcomingRenewalsWidget.
 */

"use client";

// Re-export the enhanced widget for backwards compatibility
export { 
  UpcomingRenewalsWidget as UpcomingRenewals,
  UpcomingRenewalsWidget,
  generateDemoRenewals,
  type RenewalContract,
  type RenewalUrgency,
  type RenewalStatus,
} from './UpcomingRenewalsWidget';

export { UpcomingRenewalsWidget as default } from './UpcomingRenewalsWidget';
