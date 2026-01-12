/**
 * Help Actions Handler
 * 
 * Provides help and guidance on chatbot capabilities.
 * Shows available commands organized by category.
 */

import { DetectedIntent, ActionResponse } from '../types'

// Type alias for cleaner code
type ChatActionResult = ActionResponse

// ============ HELP CONTENT ============

const COMMAND_CATEGORIES = {
  creation: {
    title: '📝 Create Contracts',
    commands: [
      { phrase: '"Create a new contract"', description: 'Opens 5-step contract creation wizard' },
      { phrase: '"Quick upload a contract"', description: 'Opens fast upload dialog' },
      { phrase: '"Help me draft an NDA"', description: 'AI-assisted contract drafting' },
      { phrase: '"Use the MSA template"', description: 'Generate from template' },
    ]
  },
  versions: {
    title: '📚 Version Control',
    commands: [
      { phrase: '"Show version history"', description: 'View all contract versions' },
      { phrase: '"Compare version 1 with version 3"', description: 'Side-by-side comparison' },
      { phrase: '"Create a snapshot"', description: 'Save current state as new version' },
      { phrase: '"Revert to version 2"', description: 'Restore a previous version' },
      { phrase: '"Export version history"', description: 'Download as CSV' },
    ]
  },
  repository: {
    title: '📋 Browse & Filter',
    commands: [
      { phrase: '"Show expired contracts"', description: 'List past-due contracts' },
      { phrase: '"Find expiring soon"', description: 'Contracts ending in 30 days' },
      { phrase: '"Show high risk contracts"', description: 'Critical attention needed' },
      { phrase: '"List uncategorized contracts"', description: 'Missing category' },
      { phrase: '"Show active contracts"', description: 'Filter by status' },
      { phrase: '"Contract statistics"', description: 'Repository overview' },
    ]
  },
  search: {
    title: '🔍 Search',
    commands: [
      { phrase: '"Search for NDA agreements"', description: 'Find by name/title' },
      { phrase: '"Contracts with Acme Corp"', description: 'Find by party name' },
      { phrase: '"Find contracts over $100k"', description: 'Filter by value' },
    ]
  },
  analytics: {
    title: '📊 Analytics & Insights',
    commands: [
      { phrase: '"How many contracts do I have?"', description: 'Total count' },
      { phrase: '"Top 5 suppliers by spend"', description: 'Supplier analytics' },
      { phrase: '"Spend by category"', description: 'Category breakdown' },
      { phrase: '"Show savings opportunities"', description: 'Optimization insights' },
    ]
  },
  updates: {
    title: '✏️ Update Contracts',
    commands: [
      { phrase: '"Change expiration date to Dec 2026"', description: 'Update dates' },
      { phrase: '"Set contract value to $50,000"', description: 'Update financials' },
      { phrase: '"Change status to active"', description: 'Update status' },
      { phrase: '"Update supplier to Microsoft"', description: 'Update parties' },
    ]
  },
  workflows: {
    title: '🔄 Workflows & Approvals',
    commands: [
      { phrase: '"Start approval workflow"', description: 'Initiate approval process' },
      { phrase: '"Show my pending approvals"', description: 'Items awaiting your review' },
      { phrase: '"Approve this contract"', description: 'Approve current step' },
      { phrase: '"Reject with reason: needs revision"', description: 'Reject with feedback' },
      { phrase: '"Check workflow status"', description: 'See approval progress' },
      { phrase: '"List available workflows"', description: 'Show workflow templates' },
      { phrase: '"Assign to John Smith"', description: 'Delegate approval' },
      { phrase: '"Escalate this workflow"', description: 'Expedite urgent items' },
      { phrase: '"Cancel the approval process"', description: 'Stop workflow' },
      { phrase: '"Create approval workflow"', description: 'New workflow template' },
    ]
  },
  views: {
    title: '👁️ View Controls',
    commands: [
      { phrase: '"Switch to grid view"', description: 'Card layout' },
      { phrase: '"Show in table view"', description: 'Tabular format' },
      { phrase: '"Kanban view"', description: 'Status columns' },
      { phrase: '"Bulk operations"', description: 'Multi-select actions' },
    ]
  },
}

// ============ ACTION HANDLERS ============

export async function handleHelpAction(
  action: string,
  entities: DetectedIntent['entities']
): Promise<ChatActionResult> {
  switch (action) {
    case 'show_help':
      return showGeneralHelp()
    case 'show_category_help':
      return showCategoryHelp(entities.categoryName || 'all')
    case 'list_commands':
      return listAllCommands()
    default:
      return showGeneralHelp()
  }
}

function showGeneralHelp(): ChatActionResult {
  return {
    success: true,
    message: `# 🤖 Contigo AI Assistant

I can help you manage your contracts! Here's what I can do:

## Quick Commands

**Creating Contracts**
• "Create a new contract" → Opens creation wizard
• "Quick upload" → Fast upload dialog
• "Draft an NDA" → AI drafting assistant

**Finding Contracts**
• "Show expired contracts"
• "Find expiring soon"
• "Search for [name]"
• "Contracts with [supplier]"

**Version Control**
• "Show version history"
• "Compare versions"
• "Create snapshot"

**Analytics**
• "Contract statistics"
• "Top suppliers"
• "Spend analysis"

**Updates**
• "Update [field] to [value]"
• "Change status to active"

---
💡 **Tip:** Ask "help with [topic]" for detailed guidance.
Type "list all commands" to see everything I can do.`,
  }
}

function showCategoryHelp(category: string): ChatActionResult {
  const categoryKey = category.toLowerCase()
  const categoryMap: Record<string, keyof typeof COMMAND_CATEGORIES> = {
    'create': 'creation',
    'creating': 'creation',
    'creation': 'creation',
    'new': 'creation',
    'version': 'versions',
    'versions': 'versions',
    'history': 'versions',
    'compare': 'versions',
    'filter': 'repository',
    'browse': 'repository',
    'repository': 'repository',
    'list': 'repository',
    'search': 'search',
    'find': 'search',
    'analytics': 'analytics',
    'stats': 'analytics',
    'statistics': 'analytics',
    'insights': 'analytics',
    'update': 'updates',
    'updates': 'updates',
    'edit': 'updates',
    'change': 'updates',
    'workflow': 'workflows',
    'workflows': 'workflows',
    'approve': 'workflows',
    'renew': 'workflows',
    'view': 'views',
    'views': 'views',
  }
  
  const mappedCategory = categoryMap[categoryKey]
  
  if (mappedCategory && COMMAND_CATEGORIES[mappedCategory]) {
    const cat = COMMAND_CATEGORIES[mappedCategory]
    const commandList = cat.commands
      .map(c => `• ${c.phrase}\n  _${c.description}_`)
      .join('\n\n')
    
    return {
      success: true,
      message: `## ${cat.title}

${commandList}

---
Need help with something else? Just ask!`,
    }
  }
  
  // Return general help if category not found
  return showGeneralHelp()
}

function listAllCommands(): ChatActionResult {
  const sections = Object.values(COMMAND_CATEGORIES)
    .map(cat => {
      const commands = cat.commands
        .map(c => `• ${c.phrase} - ${c.description}`)
        .join('\n')
      return `### ${cat.title}\n${commands}`
    })
    .join('\n\n')
  
  return {
    success: true,
    message: `# 📖 All Available Commands

${sections}

---
💡 Just type naturally - I understand variations of these phrases!`,
  }
}

// ============ PATTERN DETECTION ============

export const helpActionPatterns = {
  generalHelp: /^(?:help|h|\?|what\s+can\s+you\s+do|commands?|how\s+do\s+i\s+use)/i,
  categoryHelp: /(?:help\s+(?:me\s+)?(?:with|about|on))\s+(.+)/i,
  listCommands: /(?:list|show|all)\s+(?:all\s+)?commands?/i,
}

export function detectHelpIntent(query: string): DetectedIntent | null {
  const lowerQuery = query.toLowerCase().trim()
  
  // List all commands
  if (helpActionPatterns.listCommands.test(lowerQuery)) {
    return {
      type: 'question',
      action: 'list_commands' as any,
      entities: {},
      confidence: 0.95,
    }
  }
  
  // Category-specific help
  const categoryMatch = lowerQuery.match(helpActionPatterns.categoryHelp)
  if (categoryMatch) {
    return {
      type: 'question',
      action: 'show_category_help' as any,
      entities: { categoryName: categoryMatch[1].trim() },
      confidence: 0.9,
    }
  }
  
  // General help
  if (helpActionPatterns.generalHelp.test(lowerQuery)) {
    return {
      type: 'question',
      action: 'show_help' as any,
      entities: {},
      confidence: 0.95,
    }
  }
  
  return null
}

export default handleHelpAction
