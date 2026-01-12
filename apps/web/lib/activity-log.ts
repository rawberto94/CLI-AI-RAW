/**
 * Activity Log Utility
 * Simple utility for logging activity entries across the application
 */

import { prisma } from '@/lib/prisma';

export interface ActivityLogEntry {
  action: string;
  // New style (preferred)
  entityType?: string;
  entityId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  // Legacy style support
  contractId?: string;
  performedBy?: string;
  details?: Record<string, unknown>;
  tenantId?: string;
}

/**
 * Add an activity log entry
 * Uses ContractActivity model for contract-related activities
 */
export async function addActivityLogEntry(entry: ActivityLogEntry): Promise<void> {
  try {
    const tenantId = entry.tenantId || 'demo';
    const userId = entry.userId || entry.performedBy || 'system';
    const entityId = entry.entityId || entry.contractId;
    const entityType = entry.entityType || (entry.contractId ? 'contract' : 'unknown');
    const metadata = entry.metadata || entry.details || {};
    
    if (entityType === 'contract' && entityId) {
      // Use ContractActivity model for contract activities
      await prisma.contractActivity.create({
        data: {
          contractId: entityId,
          tenantId,
          userId,
          type: entry.action.toLowerCase(),
          action: entry.action,
          metadata,
        },
      });
    } else {
      // For other entity types, we could extend this to use different models
      // For now, log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('[ActivityLog]', {
          ...entry,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('Failed to log activity:', error);
  }
}

/**
 * Batch add multiple activity log entries
 */
export async function addActivityLogEntries(entries: ActivityLogEntry[]): Promise<void> {
  await Promise.allSettled(entries.map(addActivityLogEntry));
}
