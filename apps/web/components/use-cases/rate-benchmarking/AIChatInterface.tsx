'use client'

import { useState, useRef, useEffect } from 'react'
// eslint-disable-next-line import/order
import { Send, Sparkles, Loader2, Zap } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  suppliers,
  allRateData,
  type ServiceLine,
  type Geography
} from '@/lib/use-cases/enhanced-rate-benchmarking-data'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actions?: ChatAction[]
  data?: unknown
}

interface ChatAction {
  type: 'run-analysis' | 'export' | 'compare' | 'create-scenario'
  label: string
  payload: unknown
}

interface AIChatInterfaceProps {
  onQueryResult?: (result: unknown) => void
  onActionTrigger?: (action: ChatAction) => void
  currentContext: {
    selectedSupplier: string | null
    selectedServiceLine: ServiceLine | null
    selectedGeography: Geography
  }
}

const suggestedQueries = [
  "What are Deloitte's rates for senior consultants?",
  "Compare Big 4 rates for project managers",
  "Show me offshore vs onshore differences",
  "Which suppliers are most expensive?",
  "What's the ChainIQ benchmark for developers?",
  "Show me savings opportunities"
]

export default function AIChatInterface({
  onQueryResult,
  onActionTrigger,
  currentContext
}: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "👋 Hi! I'm your ChainIQ AI assistant.\n\nI can help you with:\n\n📊 Rate lookups and comparisons\n💰 Savings opportunities\n📈 Market trends\n🎯 Negotiation strategies\n\nTry one of the suggested queries below or ask me anything!",
      timestamp: new Date(),
      actions: []
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    const current = messagesEndRef.current
    if (current !== null) {
      // Use scrollIntoView for smooth scrolling
      current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }

  useEffect(() => {
    // Scroll to bottom whenever messages change
    // Use requestAnimationFrame to ensure DOM has updated
    // eslint-disable-next-line no-undef
    const scrollTimeout = requestAnimationFrame(() => {
      scrollToBottom()
    })
    
    // eslint-disable-next-line no-undef
    return () => cancelAnimationFrame(scrollTimeout)
  }, [messages])
  
  useEffect(() => {
    // Also scroll when typing state changes (for smooth UX)
    if (isTyping) {
      // eslint-disable-next-line no-undef
      const scrollTimeout = requestAnimationFrame(() => {
        scrollToBottom()
      })
      // eslint-disable-next-line no-undef
      return () => cancelAnimationFrame(scrollTimeout)
    }
  }, [isTyping])

  const processQuery = (query: string): ChatMessage => {
    const lowerQuery = query.toLowerCase()
    const intent = detectIntent(lowerQuery)
    const entities = extractEntities(lowerQuery)

    switch (intent.type) {
      case 'rate-lookup':
        return handleRateLookup(entities, query)
      case 'comparison':
        return handleComparison(entities, query)
      case 'trend':
        return handleTrend(entities, query)
      case 'savings':
        return handleSavings(entities, query)
      case 'negotiation-advice':
        return handleNegotiationAdvice(entities, query)
      default:
        return handleGeneral(query)
    }
  }

  const detectIntent = (query: string): { type: string; confidence: number } => {
    if (query.includes('rate') && (query.includes('what') || query.includes('show'))) {
      return { type: 'rate-lookup', confidence: 0.9 }
    }
    if (query.includes('compare') || query.includes('vs') || query.includes('versus') || query.includes('difference')) {
      return { type: 'comparison', confidence: 0.9 }
    }
    if (query.includes('trend') || query.includes('changed') || query.includes('over time')) {
      return { type: 'trend', confidence: 0.85 }
    }
    if (query.includes('savings') || query.includes('save') || query.includes('opportunity')) {
      return { type: 'savings', confidence: 0.85 }
    }
    if (query.includes('negotiate') || query.includes('advice') || query.includes('recommend')) {
      return { type: 'negotiation-advice', confidence: 0.8 }
    }
    return { type: 'general', confidence: 0.5 }
  }

  const extractEntities = (query: string) => {
    const entities: {
      supplier?: string
      role?: string
      geography?: string
    } = {}

    // Check for supplier names (match both full name and short name)
    suppliers.forEach(s => {
      const lowerName = s.name.toLowerCase()
      const shortName = s.name.split(' ')[0].toLowerCase() // e.g., "Deloitte" from "Deloitte Consulting"
      
      if (query.includes(lowerName) || query.includes(shortName)) {
        entities.supplier = s.id
      }
    })

    // Check for role mentions
    const roles = [
      'senior consultant', 'project manager', 'business analyst',
      'developer', 'qa engineer', 'architect', 'data analyst'
    ]
    roles.forEach(role => {
      if (query.includes(role)) {
        entities.role = role
      }
    })

    // Check for geography mentions
    if (query.includes('offshore') || query.includes('india')) {
      entities.geography = 'APAC - India'
    } else if (query.includes('onshore') || query.includes('north america')) {
      entities.geography = 'North America - Onshore'
    } else if (query.includes('nearshore') || query.includes('mexico')) {
      entities.geography = 'North America - Nearshore'
    }

    return entities
  }

  const handleRateLookup = (entities: ReturnType<typeof extractEntities>, _query: string): ChatMessage => {
    const supplier = entities.supplier ?? currentContext.selectedSupplier
    const geography = entities.geography ?? currentContext.selectedGeography

    if (supplier == null) {
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I'd be happy to look up rates! 🔍\n\nWhich supplier are you interested in?\n\n💼 Available suppliers:\n• Deloitte\n• Accenture\n• PwC\n• EY\n• Cognizant\n• Wipro\n• TCS\n• Infosys",
        timestamp: new Date(),
        actions: []
      }
    }

    const supplierData = suppliers.find(s => s.id === supplier)
    
    if (supplierData == null) {
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ I couldn't find that supplier in our database.\n\n💼 Available suppliers:\n• Deloitte\n• Accenture\n• PwC\n• EY\n• Cognizant\n• Wipro\n• TCS\n• Infosys`,
        timestamp: new Date(),
        actions: []
      }
    }

    const rates = allRateData.filter(r => 
      r.supplierId === supplier &&
      r.geography === geography
    )

    if (rates.length === 0) {
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ No rate data found for ${supplierData.name} in ${geography}.\n\nTry a different geography or supplier.`,
        timestamp: new Date(),
        actions: []
      }
    }

    const roleAverages = new Map<string, number>()
    const roleCounts = new Map<string, number>()
    
    rates.forEach(r => {
      const current = roleAverages.get(r.role) ?? 0
      roleAverages.set(r.role, current + r.hourlyRate)
      roleCounts.set(r.role, (roleCounts.get(r.role) ?? 0) + 1)
    })

    roleAverages.forEach((total, role) => {
      roleAverages.set(role, Math.round(total / (roleCounts.get(role) ?? 1)))
    })

    const topRoles = Array.from(roleAverages.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    let content = `📊 **${supplierData.name}** Rates in ${geography}\n\n`
    content += `🔹 ChainIQ Benchmark Data:\n\n`
    topRoles.forEach(([role, rate]) => {
      content += `• **${role}**: $${rate}/hr\n`
    })
    content += `\n✅ Based on ${rates.length} data points\n`
    content += `📈 Confidence: ${Math.round(supplierData.dataQuality.confidence * 100)}%`

    return {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      actions: [
        {
          type: 'run-analysis',
          label: '📊 Run Full Analysis',
          payload: { supplier, geography }
        },
        {
          type: 'export',
          label: '📥 Export Data',
          payload: { supplier, geography }
        }
      ]
    }
  }

  const handleComparison = (entities: ReturnType<typeof extractEntities>, _query: string): ChatMessage => {
    const geography = entities.geography ?? currentContext.selectedGeography
    const big4 = suppliers.filter(s => s.tier === 'Big 4')
    const comparisons: Array<{ supplier: string; avgRate: number }> = []

    big4.forEach(supplier => {
      const rates = allRateData.filter(r =>
        r.supplierId === supplier.id &&
        r.geography === geography
      )
      if (rates.length > 0) {
        const avgRate = rates.reduce((sum, r) => sum + r.hourlyRate, 0) / rates.length
        comparisons.push({ supplier: supplier.name, avgRate: Math.round(avgRate) })
      }
    })

    comparisons.sort((a, b) => b.avgRate - a.avgRate)

    let content = `📊 **Supplier Comparison** in ${geography}\n\n`
    content += `🔹 ChainIQ Benchmark Rankings:\n\n`
    comparisons.forEach((comp, index) => {
      const emoji = index === 0 ? '🔴' : index === comparisons.length - 1 ? '🟢' : '🟡'
      const rank = index + 1
      content += `${emoji} **#${rank}** ${comp.supplier}: $${comp.avgRate}/hr\n`
    })

    const savings = comparisons[0].avgRate - comparisons[comparisons.length - 1].avgRate
    content += `\n💡 **Insight**: Potential $${savings}/hr savings by switching from highest to lowest cost supplier.`

    return {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      actions: [
        {
          type: 'compare',
          label: '📊 View Detailed Comparison',
          payload: { suppliers: big4.map(s => s.id), geography }
        }
      ]
    }
  }

  const handleTrend = (_entities: ReturnType<typeof extractEntities>, _query: string): ChatMessage => {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: `📈 **Market Trends** (Last 12 Months)\n\n🔹 ChainIQ Intelligence:\n\n📊 Average rates increased 6-8% YoY\n💼 IT Consulting saw highest growth (+9%)\n🌍 Offshore rates grew faster (+12%) than onshore (+5%)\n👔 Senior roles had more rate pressure\n\n**Key Drivers:**\n• Talent shortage in tech roles\n• Inflation adjustments\n• Digital transformation demand\n• Remote work normalization`,
      timestamp: new Date(),
      actions: [
        {
          type: 'run-analysis',
          label: '📈 View Detailed Trends',
          payload: { view: 'trends' }
        }
      ]
    }
  }

  const handleSavings = (entities: ReturnType<typeof extractEntities>, _query: string): ChatMessage => {
    const supplier = entities.supplier ?? currentContext.selectedSupplier

    if (supplier === null) {
      return {
        id: Date.now().toString(),
        role: 'assistant',
        content: "💰 To identify savings opportunities, I need to know which supplier contract you want to analyze.\n\nWhich supplier are you working with?",
        timestamp: new Date(),
        actions: []
      }
    }

    const supplierData = suppliers.find(s => s.id === supplier)
    const supplierName = supplierData != null ? supplierData.name : 'the selected supplier'

    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: `💰 **Savings Analysis** for ${supplierName}\n\n🔹 ChainIQ Findings:\n\n💵 Estimated annual savings: **$45K - $75K**\n📊 4 roles above ChainIQ benchmark\n\n🎯 **Top Opportunities:**\n• Senior Consultants: $18K/year\n• Project Managers: $12K/year\n• Business Analysts: $8K/year\n\n💡 **Recommendation**: Focus on senior roles first - they offer 60% of total savings potential.`,
      timestamp: new Date(),
      actions: [
        {
          type: 'run-analysis',
          label: '💰 Calculate Detailed Savings',
          payload: { supplier }
        },
        {
          type: 'create-scenario',
          label: '📋 Create Negotiation Plan',
          payload: { supplier }
        }
      ]
    }
  }

  const handleNegotiationAdvice = (_entities: ReturnType<typeof extractEntities>, _query: string): ChatMessage => {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: `🎯 **Negotiation Strategy** (ChainIQ Powered)\n\n📋 **Data-Backed Talking Points:**\n\n1️⃣ "Your rates are 12% above ChainIQ benchmark for senior consultants"\n\n2️⃣ "Competitor analysis shows 15% lower rates for similar services"\n\n3️⃣ "We're committing to 5 FTEs - volume discount should apply"\n\n💡 **Leverage Points:**\n• ChainIQ data shows rates declining in Q4\n• Multiple competitive alternatives available\n• Long-term partnership value (3+ years)\n\n📊 **Recommended Approach:**\n✓ Start with 15% reduction request\n✓ Settle for 8-10% reduction\n✓ Include annual rate freeze clause\n✓ Add performance incentives`,
      timestamp: new Date(),
      actions: [
        {
          type: 'export',
          label: '📥 Download Negotiation Brief',
          payload: { type: 'negotiation' }
        }
      ]
    }
  }

  const handleGeneral = (_query: string): ChatMessage => {
    return {
      id: Date.now().toString(),
      role: 'assistant',
      content: "🤖 **I can help you with:**\n\n📊 Looking up supplier rates\n🔄 Comparing rates across suppliers\n📈 Analyzing market trends\n💰 Identifying savings opportunities\n🎯 Providing negotiation advice\n\n💡 **Try asking:**\n• 'What are Accenture's rates for developers?'\n• 'Compare Big 4 rates for project managers'\n• 'Show me savings opportunities'",
      timestamp: new Date(),
      actions: []
    }
  }

  const handleSend = async () => {
    const trimmedInput = input.trim()
    if (trimmedInput.length === 0) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // Simulate typing delay for better UX
    // eslint-disable-next-line no-undef
    await new Promise(resolve => setTimeout(resolve, 800))

    // Use ChainIQ's intelligent simulated responses for consistent, high-quality answers
    // These are specifically designed for procurement rate benchmarking demos
    const aiResponse = processQuery(trimmedInput)
    setMessages(prev => [...prev, aiResponse])
    onQueryResult?.(aiResponse.data)
    setIsTyping(false)
  }

  const handleSuggestedQuery = (query: string) => {
    setInput(query)
  }

  const handleAction = (action: ChatAction) => {
    onActionTrigger?.(action)
  }

  return (
    <Card className="h-[650px] flex flex-col shadow-lg border-2 border-blue-100 overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-gray-900">ChainIQ AI Assistant</div>
            <div className="text-xs text-gray-600">Powered by procurement intelligence</div>
          </div>
          <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <Sparkles className="w-3 h-3 mr-1" />
            AI
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 scroll-smooth min-h-0">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-sm transition-all duration-200 hover:shadow-md ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                {(message.actions != null) && message.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-200">
                    {message.actions.map((action, index) => (
                      <Button
                        key={index}
                        size="sm"
                        variant="outline"
                        className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 hover:from-blue-100 hover:to-purple-100 text-gray-900 font-medium"
                        onClick={() => handleAction(action)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-sm text-gray-600 font-medium">ChainIQ is analyzing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Queries */}
        {messages.length <= 1 && (
          <div className="border-t p-4 bg-white flex-shrink-0">
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Try these queries:
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestedQueries.map((query, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant="outline"
                  onClick={() => handleSuggestedQuery(query)}
                  className="text-xs hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                >
                  {query}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t p-4 bg-white flex-shrink-0">
          <div className="flex gap-2">
            <Input
              placeholder="Ask about rates, trends, or savings opportunities..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isTyping && handleSend()}
              disabled={isTyping}
              className="flex-1 border-2 border-gray-200 focus:border-blue-400"
            />
            <Button
              onClick={handleSend}
              disabled={(input.trim().length === 0) || isTyping}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Powered by ChainIQ Intelligence Engine
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
