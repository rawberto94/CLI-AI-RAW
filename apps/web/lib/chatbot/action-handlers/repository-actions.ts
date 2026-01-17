/**
 * Repository Actions Handler
 * 
 * Handles chatbot actions related to the contracts repository/list:
 * - Filtering and searching contracts
 * - Bulk operations guidance
 * - Statistics and analytics
 * - Navigation to specific views
 */

import { prisma } from '@/lib/prisma'
import { DetectedIntent, ActionResponse, ChatContext } from '../types'

// Type alias for cleaner code
type ChatActionResult = ActionResponse

// ============ ACTION PATTERNS ============

export const repositoryActionPatterns = {
  filter: /\b(filter|show|display|find|list)\b.*\b(contracts?|documents?)\b.*\b(by|with|that|where|having)\b/i,
  search: /\b(search|look|find)\b.*\b(for|contract|named|titled|called)\b/i,
  expired: /\b(expired?|past\s*due|overdue)\b.*\b(contracts?|documents?)\b/i,
  expiring: /\b(expiring|expiring\s*soon|due\s*soon|ending\s*soon)\b/i,
  highRisk: /\b(high\s*risk|risky|critical|urgent)\b.*\b(contracts?)\b/i,
  uncategorized: /\b(uncategorized|untagged|no\s*category|without\s*category)\b/i,
  byStatus: /\b(active|pending|draft|archived|terminated)\b.*\b(contracts?)\b/i,
  byCategory: /\b(contracts?|documents?)\b.*\b(in|of|from|under)\b.*\b(category|type)\b/i,
  byValue: /\b(contracts?)\b.*\b(over|above|under|below|worth|valued?)\b.*\$?\d+/i,
  byParty: /\b(contracts?)\b.*\b(with|from|for)\b.*\b(client|supplier|vendor|party)\b/i,
  stats: /\b(how\s*many|count|total|statistics|stats|numbers?|metrics?)\b.*\b(contracts?)\b/i,
  bulkSelect: /\b(select|choose|pick)\b.*\b(all|multiple|several|bulk)\b/i,
  bulkTag: /\b(tag|add\s*tags?|bulk\s*tag)\b.*\b(multiple|all|selected)\b/i,
  bulkExport: /\b(export|download)\b.*\b(all|multiple|selected|bulk)\b/i,
  bulkDelete: /\b(delete|remove)\b.*\b(all|multiple|selected|bulk)\b/i,
  sortBy: /\b(sort|order)\b.*\b(by|contracts?)\b/i,
  viewMode: /\b(switch|change|show)\b.*\b(grid|list|table|kanban|view)\b/i,
}

// ============ ACTION HANDLERS ============

export async function handleRepositoryAction(
  intent: DetectedIntent,
  context: ChatContext
): Promise<ChatActionResult> {
  const action = intent.action
  const entities = intent.entities
  const tenantId = context.tenantId
  
  switch (action) {
    case 'filter_contracts':
      return handleFilterContracts(entities)
    case 'search_contracts':
      return handleSearchContracts(entities)
    case 'show_expired':
      return showExpiredContracts(tenantId)
    case 'show_expiring':
      return showExpiringContracts(tenantId)
    case 'show_high_risk':
      return showHighRiskContracts(tenantId)
    case 'show_uncategorized':
      return showUncategorizedContracts(tenantId)
    case 'show_by_status':
      return showContractsByStatus(entities, tenantId)
    case 'contract_stats':
      return getContractStats(tenantId)
    case 'bulk_operations':
      return showBulkOperations()
    case 'change_view':
      return handleViewChange(entities)
    default:
      return {
        success: false,
        message: "I couldn't understand that repository action. Try asking me to filter, search, or show statistics.",
      }
  }
}

// ============ FILTER HANDLERS ============

async function handleFilterContracts(
  entities: DetectedIntent['entities']
): Promise<ChatActionResult> {
  const filters: string[] = []
  let filterUrl = '/contracts?'
  
  if (entities.status) {
    filters.push(`status: ${entities.status}`)
    filterUrl += `status=${entities.status}&`
  }
  
  if (entities.categoryName) {
    filters.push(`category: ${entities.categoryName}`)
    filterUrl += `category=${encodeURIComponent(entities.categoryName)}&`
  }
  
  if (entities.partyName) {
    filters.push(`party: ${entities.partyName}`)
    filterUrl += `search=${encodeURIComponent(entities.partyName)}&`
  }
  
  if (filters.length === 0) {
    return {
      success: true,
      message: `📋 **Filter Contracts**

You can filter contracts by various criteria. Here are some examples:

• **By status**: "Show me active contracts" or "Find pending contracts"
• **By category**: "List contracts in IT Services"
• **By expiration**: "Show contracts expiring this month"
• **By value**: "Find contracts over $100,000"
• **By party**: "Contracts with Acme Corp"

You can also use the advanced search in the contracts page for complex filters.`,
      action: {
        type: 'navigate',
        data: { url: '/contracts', section: 'filters' }
      }
    }
  }
  
  return {
    success: true,
    message: `🔍 **Filtering Contracts**

Applying filters:
${filters.map(f => `• ${f}`).join('\n')}

Click below to view filtered results:`,
    action: {
      type: 'navigate',
      data: { url: filterUrl.slice(0, -1) }
    }
  }
}

async function handleSearchContracts(
  entities: DetectedIntent['entities']
): Promise<ChatActionResult> {
  const query = entities.searchQuery || entities.contractTitle || ''
  
  if (!query) {
    return {
      success: true,
      message: `🔎 **Search Contracts**

To search for contracts, you can:

1. **By title**: "Search for NDA agreements"
2. **By party**: "Find contracts with Microsoft"
3. **By content**: "Search for indemnification clauses"

Or use the search bar in the contracts page for quick searches.`,
      action: {
        type: 'navigate',
        data: { url: '/contracts', section: 'search' }
      }
    }
  }
  
  return {
    success: true,
    message: `🔍 Searching for: **"${query}"**

Click to view search results:`,
    action: {
      type: 'navigate',
      data: { url: `/contracts?search=${encodeURIComponent(query)}` }
    }
  }
}

// ============ QUICK FILTERS ============

async function showExpiredContracts(tenantId: string): Promise<ChatActionResult> {
  try {
    const today = new Date()
    
    const expiredCount = await prisma.contract.count({
      where: {
        tenantId,
        expirationDate: { lt: today },
        status: { not: 'EXPIRED' }
      }
    })
    
    const count = expiredCount

    return {
      success: true,
      message: `⚠️ **Expired Contracts**

You have **${count}** expired contract${count !== 1 ? 's' : ''} that ${count !== 1 ? 'are' : 'is'} still active.

${count > 0 ? `These contracts have passed their expiration date but haven't been marked as terminated.

**Recommended Actions:**
• Review and terminate expired contracts
• Initiate renewal discussions
• Update contract statuses` : 'Great! All your contracts are up to date.'}`,
      data: count > 0 ? { url: '/contracts?filter=expired' } : undefined
    }
  } catch {
    return {
      success: true,
      message: `📋 To view expired contracts, click below:`,
      action: {
        type: 'navigate',
        data: { url: '/contracts?filter=expired' }
      }
    }
  }
}

async function showExpiringContracts(tenantId: string): Promise<ChatActionResult> {
  try {
    const today = new Date()
    const thirtyDays = new Date(today)
    thirtyDays.setDate(thirtyDays.getDate() + 30)
    
    const count = await prisma.contract.count({
      where: {
        tenantId,
        expirationDate: { gte: today, lte: thirtyDays },
        status: 'ACTIVE'
      }
    })
    
    return {
      success: true,
      message: `⏰ **Expiring Soon**

**${count}** contract${count !== 1 ? 's' : ''} ${count !== 1 ? 'are' : 'is'} expiring in the next 30 days.

${count > 0 ? `**Recommended Actions:**
• Review upcoming expirations
• Start renewal negotiations early
• Set up reminder notifications
• Prepare for contract transitions` : 'No contracts expiring soon!'}`,
      data: count > 0 ? { url: '/contracts?filter=expiring-soon' } : undefined
    }
  } catch (error) {
    return {
      success: true,
      message: `📋 To view contracts expiring soon, click below:`,
      data: { url: '/contracts?filter=expiring-soon' }
    }
  }
}

async function showHighRiskContracts(tenantId: string): Promise<ChatActionResult> {
  return {
    success: true,
    message: `🚨 **High Risk Contracts**

High risk contracts include:
• Contracts with unfavorable terms
• Missing required clauses
• Unclear liability provisions
• Approaching deadlines without action

View all high-risk contracts to prioritize your attention:`,
    data: { url: '/contracts?filter=high-risk' }
  }
}

async function showUncategorizedContracts(tenantId: string): Promise<ChatActionResult> {
  try {
    const count = await prisma.contract.count({
      where: {
        tenantId,
        contractCategoryId: null
      }
    })
    
    return {
      success: true,
      message: `📂 **Uncategorized Contracts**

**${count}** contract${count !== 1 ? 's' : ''} ${count !== 1 ? 'have' : 'has'} not been categorized yet.

${count > 0 ? `**Why categorize?**
• Better organization and filtering
• Improved reporting accuracy
• Easier contract discovery
• Enhanced compliance tracking

**Quick tip:** Use AI auto-categorization to categorize all at once!` : 'All your contracts are properly categorized!'}`,
      data: count > 0 ? { url: '/contracts?filter=uncategorized' } : undefined
    }
  } catch (error) {
    return {
      success: true,
      message: `📂 To view uncategorized contracts, click below:`,
      data: { url: '/contracts?filter=uncategorized' }
    }
  }
}

async function showContractsByStatus(
  entities: DetectedIntent['entities'],
  tenantId: string
): Promise<ChatActionResult> {
  const status = entities.status || 'active'
  
  const statusInfo: Record<string, { emoji: string; description: string }> = {
    active: { emoji: '✅', description: 'Currently in effect' },
    pending: { emoji: '⏳', description: 'Awaiting signatures or approval' },
    draft: { emoji: '📝', description: 'Still being drafted' },
    archived: { emoji: '📦', description: 'Completed or no longer active' },
    terminated: { emoji: '❌', description: 'Ended before natural expiration' },
  }
  
  const info = statusInfo[status.toLowerCase()] || { emoji: '📋', description: '' }
  
  return {
    success: true,
    message: `${info.emoji} **${status.charAt(0).toUpperCase() + status.slice(1)} Contracts**

${info.description}

Click to view all ${status} contracts:`,
    data: { url: `/contracts?status=${status}` }
  }
}

// ============ STATISTICS ============

async function getContractStats(tenantId: string): Promise<ChatActionResult> {
  try {
    // Get total count
    const total = await prisma.contract.count({
      where: { tenantId }
    })
    
    // Get status breakdown
    const statusBreakdown = await prisma.contract.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true }
    })
    
    const statusMap = statusBreakdown.reduce((acc, row) => {
      acc[row.status || 'unknown'] = row._count.id
      return acc
    }, {} as Record<string, number>)
    
    // Get total value
    const valueResult = await prisma.contract.aggregate({
      where: { tenantId },
      _sum: { totalValue: true }
    })
    
    const totalValue = Number(valueResult._sum.totalValue || 0)
    
    return {
      success: true,
      message: `📊 **Contract Repository Statistics**

**Total Contracts:** ${total.toLocaleString()}

**By Status:**
• Active: ${statusMap['active'] || 0}
• Pending: ${statusMap['pending'] || 0}
• Draft: ${statusMap['draft'] || 0}
• Archived: ${statusMap['archived'] || 0}

**Total Portfolio Value:** $${totalValue.toLocaleString()}

Want more detailed analytics? Check the Analytics dashboard for trends, insights, and reports.`,
      data: { url: '/analytics' }
    }
  } catch {
    return {
      success: true,
      message: `📊 For detailed contract statistics and analytics, visit the Analytics dashboard:`,
      data: { url: '/analytics' }
    }
  }
}

// ============ BULK OPERATIONS ============

function showBulkOperations(): ChatActionResult {
  return {
    success: true,
    message: `📦 **Bulk Operations**

You can perform bulk actions on multiple contracts:

**Selection:**
• Click checkboxes to select individual contracts
• Use "Select All" to select all visible
• Shift+click for range selection

**Available Bulk Actions:**
• 🏷️ **Add Tags** - Apply tags to selected
• 📂 **Categorize** - Set category for all
• 📤 **Export** - Download as CSV/Excel
• 📧 **Send Notifications** - Alert stakeholders
• 🗑️ **Archive** - Move to archive

To use bulk operations, go to the contracts list and select multiple items.`,
    data: { url: '/contracts' }
  }
}

// ============ VIEW CONTROLS ============

function handleViewChange(
  entities: DetectedIntent['entities']
): ChatActionResult {
  const viewType = entities.viewMode || 'grid'
  
  const viewDescriptions: Record<string, string> = {
    grid: '📱 Grid view shows contracts as cards in a responsive layout',
    list: '📝 List view provides a compact, scannable format',
    table: '📊 Table view enables sorting and comparison',
    kanban: '📋 Kanban view organizes contracts by status columns',
  }
  
  return {
    success: true,
    message: `👁️ **View Mode: ${viewType.charAt(0).toUpperCase() + viewType.slice(1)}**

${viewDescriptions[viewType.toLowerCase()] || 'Switching to your preferred view.'}

You can also:
• Use keyboard shortcuts to switch views (G for grid, L for list)
• Save your preferred view as default
• Customize visible columns in table view`,
    action: {
      type: 'ui_event',
      data: { 
        event: 'setViewMode',
        payload: { mode: viewType.toLowerCase() }
      }
    }
  }
}

export default handleRepositoryAction
