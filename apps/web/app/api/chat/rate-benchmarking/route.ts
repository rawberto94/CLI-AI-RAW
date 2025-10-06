import { type NextRequest, NextResponse } from 'next/server'

import { generateRateData } from '@/lib/use-cases/enhanced-rate-benchmarking-data'

export const runtime = 'edge'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatContext {
  selectedSupplier?: string | null
  selectedServiceLine?: string | null
  selectedGeography?: string | null
}

interface RequestBody {
  messages: ChatMessage[]
  context: ChatContext
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as RequestBody
    const { messages, context } = body
    
    const apiKey = process.env.OPENAI_API_KEY
    
    if (apiKey === undefined || apiKey === null || apiKey.trim().length === 0) {
      return NextResponse.json(
        { 
          error: 'OpenAI API key not configured',
          details: 'Please set OPENAI_API_KEY in your environment variables'
        },
        { status: 500 }
      )
    }

    // Get rate data for context
    const allRates = generateRateData()
    const { selectedSupplier, selectedServiceLine, selectedGeography } = context
    
    // Filter rates based on context
    let relevantRates = allRates
    if (selectedSupplier !== null && selectedSupplier !== undefined && selectedSupplier.length > 0) {
      relevantRates = relevantRates.filter(r => r.supplierName === selectedSupplier)
    }
    if (selectedServiceLine !== null && selectedServiceLine !== undefined && selectedServiceLine.length > 0) {
      relevantRates = relevantRates.filter(r => r.serviceLine === selectedServiceLine)
    }
    if (selectedGeography !== null && selectedGeography !== undefined && selectedGeography.length > 0) {
      relevantRates = relevantRates.filter(r => r.geography === selectedGeography)
    }

    // Calculate aggregate statistics for better context
    const totalRoles = relevantRates.length
    const avgVariance = relevantRates.reduce((sum, r) => sum + (r.hourlyRate - r.chainIQBenchmark), 0) / totalRoles
    const avgVariancePercent = (avgVariance / relevantRates.reduce((sum, r) => sum + r.chainIQBenchmark, 0) * totalRoles * 100).toFixed(1)
    const overMarketCount = relevantRates.filter(r => r.hourlyRate > r.chainIQBenchmark).length
    const underMarketCount = relevantRates.filter(r => r.hourlyRate < r.chainIQBenchmark).length
    
    // Calculate potential savings
    const totalAnnualSpend = relevantRates.reduce((sum, r) => sum + r.totalAnnualCost, 0)
    const potentialSavingsAtP50 = relevantRates.reduce((sum, r) => {
      if (r.hourlyRate > r.chainIQBenchmark) {
        const hoursSaved = (r.hourlyRate - r.chainIQBenchmark) * (r.totalAnnualCost / r.hourlyRate)
        return sum + hoursSaved
      }
      return sum
    }, 0)
    const potentialSavingsAtP25 = relevantRates.reduce((sum, r) => {
      if (r.hourlyRate > r.chainIQPercentile.p25) {
        const hoursSaved = (r.hourlyRate - r.chainIQPercentile.p25) * (r.totalAnnualCost / r.hourlyRate)
        return sum + hoursSaved
      }
      return sum
    }, 0)

    // Prepare detailed context for LLM with top opportunities
    const rateContext = relevantRates
      .sort((a, b) => {
        // Sort by savings opportunity (variance * annual cost)
        const savingsA = Math.max(0, a.hourlyRate - a.chainIQBenchmark) * a.totalAnnualCost / a.hourlyRate
        const savingsB = Math.max(0, b.hourlyRate - b.chainIQBenchmark) * b.totalAnnualCost / b.hourlyRate
        return savingsB - savingsA
      })
      .slice(0, 15)
      .map(r => {
        const variance = r.hourlyRate - r.chainIQBenchmark
        const variancePercent = ((variance / r.chainIQBenchmark) * 100).toFixed(1)
        const annualSavingsAtP50 = Math.max(0, variance) * (r.totalAnnualCost / r.hourlyRate)
        const annualSavingsAtP25 = Math.max(0, r.hourlyRate - r.chainIQPercentile.p25) * (r.totalAnnualCost / r.hourlyRate)
        
        return {
          role: r.role,
          level: r.level,
          supplier: r.supplierName,
          serviceLine: r.serviceLine,
          geography: r.geography,
          currentRate: {
            hourly: r.hourlyRate,
            daily: r.dailyRate,
            annualCost: r.totalAnnualCost
          },
          benchmarks: {
            chainIQMedian: r.chainIQBenchmark,
            p25BestInClass: r.chainIQPercentile.p25,
            p75: r.chainIQPercentile.p75,
            p90Premium: r.chainIQPercentile.p90,
            industryAverage: r.industryAverage
          },
          variance: {
            vsMedian: variance,
            vsMedianPercent: variancePercent,
            status: variance > 0 ? 'above market' : variance < 0 ? 'below market' : 'at market'
          },
          savingsOpportunity: {
            atMedian: Math.round(annualSavingsAtP50),
            atP25: Math.round(annualSavingsAtP25),
            priority: annualSavingsAtP50 > 50000 ? 'HIGH' : annualSavingsAtP50 > 20000 ? 'MEDIUM' : 'LOW'
          },
          dataQuality: {
            lastUpdated: r.lastUpdated.toISOString().split('T')[0],
            contractDate: r.contractDate.toISOString().split('T')[0]
          }
        }
      })

    const systemPrompt = `You are ChainIQ AI Assistant, an expert in procurement rate benchmarking and contract negotiations. 

Your role is to help procurement professionals analyze supplier rates, identify savings opportunities, and develop negotiation strategies using ChainIQ's proprietary benchmark data.

Key capabilities:
- Analyze rates vs ChainIQ benchmarks (P25, P50, P75, P90 percentiles)
- Identify savings opportunities and calculate ROI
- Provide data-driven negotiation strategies
- Compare suppliers and service lines
- Explain market trends and positioning
- Prioritize high-impact opportunities

Current Analysis Context:
${selectedSupplier !== null && selectedSupplier !== undefined && selectedSupplier.length > 0 ? `- Supplier: ${selectedSupplier}` : '- All suppliers'}
${selectedServiceLine !== null && selectedServiceLine !== undefined && selectedServiceLine.length > 0 ? `- Service Line: ${selectedServiceLine}` : '- All service lines'}
${selectedGeography !== null && selectedGeography !== undefined && selectedGeography.length > 0 ? `- Geography: ${selectedGeography}` : '- All geographies'}

Portfolio Summary:
- Total roles analyzed: ${totalRoles}
- Roles above ChainIQ median: ${overMarketCount} (${((overMarketCount/totalRoles)*100).toFixed(0)}%)
- Roles below ChainIQ median: ${underMarketCount} (${((underMarketCount/totalRoles)*100).toFixed(0)}%)
- Average variance from median: ${avgVariancePercent}%
- Total annual spend: $${totalAnnualSpend.toLocaleString()}
- Potential savings at median (P50): $${Math.round(potentialSavingsAtP50).toLocaleString()}
- Potential savings at best-in-class (P25): $${Math.round(potentialSavingsAtP25).toLocaleString()}

Top Rate Opportunities (sorted by savings potential):
${JSON.stringify(rateContext, null, 2)}

Benchmark Definitions:
- ChainIQ Median (P50): Middle of the market, typical rate
- Best in Class (P25): Top quartile, aggressive but achievable target
- P75: Third quartile, above-market rates
- P90: Premium rates, typically for specialized skills
- Industry Average: Broader market average including all suppliers

Guidelines for Responses:
1. Always reference specific data from the context above
2. Prioritize HIGH priority opportunities (>$50K annual savings)
3. Provide specific dollar amounts and percentages
4. Include percentile references (P25, P50, P75, P90)
5. Suggest concrete negotiation strategies with rationale
6. Be concise but comprehensive (aim for 150-300 words)
7. Use professional, confident tone
8. Structure responses with clear sections and bullet points
9. When comparing, show specific rate differences
10. Always tie recommendations back to ChainIQ benchmark data

Response Format:
- Start with a brief summary of the key finding
- Use bullet points for multiple items
- Include specific numbers: "$X savings" or "Y% above market"
- End with actionable next steps when appropriate
- Use emojis sparingly for visual emphasis (💰 for savings, 📊 for data, ⚠️ for warnings)

Example phrases to use:
- "Based on ChainIQ benchmarks..."
- "Your rate of $X is Y% above the P50 median of $Z"
- "This represents a $X annual savings opportunity"
- "Target the P25 rate of $X for best-in-class pricing"
- "HIGH priority: This role offers $X in potential savings"`

    // Call OpenAI API
    // eslint-disable-next-line no-undef
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      // Log error for debugging but don't expose to client
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('OpenAI API error:', errorText)
      }
      return NextResponse.json(
        { 
          error: 'Failed to get AI response',
          details: response.status === 429 ? 'Rate limit exceeded. Please try again later.' : 'Please try again.'
        },
        { status: response.status }
      )
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string
        }
      }>
      usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
    }
    
    const aiMessage = data.choices?.[0]?.message?.content ?? 'Sorry, I could not generate a response.'

    return NextResponse.json({
      message: aiMessage,
      usage: data.usage
    })

  } catch (error) {
    // Log error for debugging but don't expose details to client
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Chat API error:', error)
    }
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: 'An unexpected error occurred. Please try again.'
      },
      { status: 500 }
    )
  }
}
