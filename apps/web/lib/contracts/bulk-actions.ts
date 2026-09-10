/**
 * Bulk Actions for Contracts
 */

import { Contract } from './contracts-data-service'

export type BulkAction =
  | 'delete'
  | 'export'
  | 'tag'
  | 'archive'
  | 'unarchive'
  | 'mark-reviewed'

export interface BulkActionResult {
  success: boolean
  processed: number
  failed: number
  errors?: string[]
}

/**
 * Execute bulk action on selected contracts
 */
export async function executeBulkAction(
  action: BulkAction,
  contractIds: string[],
  options?: any
): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  }

  try {
    switch (action) {
      case 'delete':
        return await bulkDelete(contractIds)
      
      case 'export':
        return await bulkExport(contractIds, options?.format || 'csv')
      
      case 'tag':
        return await bulkTag(contractIds, options?.tagIds || [])
      
      case 'archive':
        return await bulkArchive(contractIds, true)
      
      case 'unarchive':
        return await bulkArchive(contractIds, false)
      
      case 'mark-reviewed':
        return await bulkMarkReviewed(contractIds)
      
      default:
        throw new Error(`Unknown bulk action: ${action}`)
    }
  } catch (error) {
    result.success = false
    result.errors = [error instanceof Error ? error.message : 'Unknown error']
    return result
  }
}

/**
 * Bulk delete contracts
 */
async function bulkDelete(contractIds: string[]): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  }

  for (const id of contractIds) {
    try {
      // In a real app, this would call an API
      // For now, we'll just simulate success
      result.processed++
    } catch (error) {
      result.failed++
      result.errors?.push(`Failed to delete ${id}: ${error}`)
    }
  }

  result.success = result.failed === 0
  return result
}

/**
 * Bulk export contracts
 */
async function bulkExport(
  contractIds: string[],
  format: 'csv' | 'excel' | 'pdf'
): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    processed: contractIds.length,
    failed: 0,
  }

  try {
    // Simulate export
    const data = contractIds.map(id => ({
      id,
      exported: true,
      timestamp: new Date().toISOString(),
    }))
    
    // Create download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contracts-export-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    result.success = false
    result.failed = contractIds.length
    result.processed = 0
    result.errors = [error instanceof Error ? error.message : 'Export failed']
  }

  return result
}

async function postBulkJson(url: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Bulk tag contracts via the tenant tag registry (not localStorage).
 */
async function bulkTag(
  contractIds: string[],
  tagIds: string[]
): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  }

  try {
    const response = await postBulkJson('/api/contracts/bulk/tags', {
      contractIds,
      tags: tagIds,
      mode: 'add',
    })
    if (!response.ok) {
      throw new Error(`Failed to tag contracts (${response.status})`)
    }
    result.processed = contractIds.length
  } catch (error) {
    result.success = false
    result.failed = contractIds.length
    result.errors = [error instanceof Error ? error.message : 'Failed to tag contracts']
  }

  return result
}

/**
 * Bulk archive/unarchive contracts by status, not a client-only tag.
 */
async function bulkArchive(
  contractIds: string[],
  archive: boolean
): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  }

  try {
    const response = await postBulkJson('/api/contracts/bulk', archive
      ? { operation: 'archive', contractIds }
      : { operation: 'status', contractIds, status: 'ACTIVE', newStatus: 'ACTIVE' })
    if (!response.ok) {
      throw new Error(`Failed to ${archive ? 'archive' : 'unarchive'} contracts (${response.status})`)
    }
    result.processed = contractIds.length
  } catch (error) {
    result.success = false
    result.failed = contractIds.length
    result.errors = [error instanceof Error ? error.message : 'Failed to update archive status']
  }

  return result
}

/**
 * Bulk mark as reviewed via the tenant tag registry.
 */
async function bulkMarkReviewed(contractIds: string[]): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  }

  try {
    const response = await postBulkJson('/api/contracts/bulk/tags', {
      contractIds,
      tags: ['reviewed'],
      mode: 'add',
    })
    if (!response.ok) {
      throw new Error(`Failed to mark contracts reviewed (${response.status})`)
    }
    result.processed = contractIds.length
  } catch (error) {
    result.success = false
    result.failed = contractIds.length
    result.errors = [error instanceof Error ? error.message : 'Failed to mark contracts reviewed']
  }

  return result
}

/**
 * Get available bulk actions for selected contracts
 */
export function getAvailableBulkActions(
  selectedContracts: Contract[]
): BulkAction[] {
  const actions: BulkAction[] = ['export', 'tag']

  if (selectedContracts.length > 0) {
    actions.push('delete')
    actions.push('archive')
    actions.push('mark-reviewed')
  }

  return actions
}

/**
 * Get bulk action label
 */
export function getBulkActionLabel(action: BulkAction): string {
  const labels: Record<BulkAction, string> = {
    delete: 'Delete',
    export: 'Export',
    tag: 'Add Tags',
    archive: 'Archive',
    unarchive: 'Unarchive',
    'mark-reviewed': 'Mark as Reviewed',
  }
  return labels[action]
}

/**
 * Get bulk action icon
 */
export function getBulkActionIcon(action: BulkAction): string {
  const icons: Record<BulkAction, string> = {
    delete: 'Trash2',
    export: 'Download',
    tag: 'Tag',
    archive: 'Archive',
    unarchive: 'ArchiveRestore',
    'mark-reviewed': 'CheckCircle',
  }
  return icons[action]
}
