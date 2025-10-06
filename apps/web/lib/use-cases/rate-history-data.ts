// Rate History Data Structures and Mock Data
import { allRateCardRoles } from './multi-client-rate-data'

export interface RateHistoryPoint {
  id: string
  rateCardId: string
  role: string
  level: string
  location: string
  supplier: string
  client: string
  dailyRateCHF: number
  timestamp: Date
  changeReason?: 'market_adjustment' | 'renegotiation' | 'contract_renewal' | 'initial'
  changePercent?: number
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  percentChange: number
  volatility: number
  confidence: 'high' | 'medium' | 'low'
}

export interface RateForecast {
  date: Date
  bestCase: number
  expected: number
  worstCase: number
  confidence: number
}

// Generate mock historical data (12 months of history)
export function generateRateHistory(): RateHistoryPoint[] {
  const history: RateHistoryPoint[] = []
  const now = new Date()
  
  allRateCardRoles.forEach((role) => {
    // Generate 12 monthly snapshots
    for (let monthsAgo = 12; monthsAgo >= 0; monthsAgo--) {
      const timestamp = new Date(now)
      timestamp.setMonth(timestamp.getMonth() - monthsAgo)
      
      // Simulate rate changes over time
      const baseRate = role.dailyRateCHF
      const trendFactor = 1 + (monthsAgo * 0.005) // Slight downward trend (rates decreasing)
      const volatility = (Math.random() - 0.5) * 0.1 // ±5% random variation
      const historicalRate = baseRate * trendFactor * (1 + volatility)
      
      // Determine change reason
      let changeReason: RateHistoryPoint['changeReason'] = 'market_adjustment'
      if (monthsAgo === 12) changeReason = 'initial'
      else if (monthsAgo % 6 === 0) changeReason = 'contract_renewal'
      else if (monthsAgo % 4 === 0) changeReason = 'renegotiation'
      
      history.push({
        id: `${role.id}-${monthsAgo}`,
        rateCardId: role.id,
        role: role.role,
        level: role.level,
        location: role.location,
        supplier: role.supplierName,
        client: role.clientName,
        dailyRateCHF: Math.round(historicalRate),
        timestamp,
        changeReason,
        changePercent: monthsAgo > 0 ? ((historicalRate - baseRate) / baseRate) * 100 : undefined
      })
    }
  })
  
  return history.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

// Get history for specific role/supplier/location combination
export function getRateHistory(
  role: string,
  level: string,
  location: string,
  supplier?: string
): RateHistoryPoint[] {
  const allHistory = generateRateHistory()
  
  return allHistory.filter(h => 
    h.role === role &&
    h.level === level &&
    h.location === location &&
    (!supplier || h.supplier === supplier)
  )
}

// Calculate trend analysis
export function analyzeTrend(history: RateHistoryPoint[]): TrendAnalysis {
  if (history.length < 3) {
    return {
      direction: 'stable',
      percentChange: 0,
      volatility: 0,
      confidence: 'low'
    }
  }
  
  // Sort by timestamp
  const sorted = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const rates = sorted.map(h => h.dailyRateCHF)
  
  // Calculate linear regression
  const n = rates.length
  const xValues = Array.from({ length: n }, (_, i) => i)
  const xMean = xValues.reduce((sum, x) => sum + x, 0) / n
  const yMean = rates.reduce((sum, y) => sum + y, 0) / n
  
  let numerator = 0
  let denominator = 0
  
  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (rates[i] - yMean)
    denominator += Math.pow(xValues[i] - xMean, 2)
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0
  
  // Calculate volatility (standard deviation)
  const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - yMean, 2), 0) / n
  const stdDev = Math.sqrt(variance)
  const volatility = (stdDev / yMean) * 100
  
  // Determine direction
  const percentChange = ((rates[n - 1] - rates[0]) / rates[0]) * 100
  let direction: TrendAnalysis['direction']
  
  if (volatility > 10) {
    direction = 'volatile'
  } else if (Math.abs(percentChange) < 2) {
    direction = 'stable'
  } else if (percentChange > 0) {
    direction = 'increasing'
  } else {
    direction = 'decreasing'
  }
  
  // Determine confidence
  const confidence = n >= 12 ? 'high' : n >= 6 ? 'medium' : 'low'
  
  return {
    direction,
    percentChange,
    volatility,
    confidence
  }
}

// Generate forecast for next 6 months
export function generateForecast(history: RateHistoryPoint[]): RateForecast[] {
  if (history.length < 6) return []
  
  const sorted = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const rates = sorted.map(h => h.dailyRateCHF)
  const lastDate = sorted[sorted.length - 1].timestamp
  
  // Simple linear regression for forecast
  const n = rates.length
  const xValues = Array.from({ length: n }, (_, i) => i)
  const xMean = xValues.reduce((sum, x) => sum + x, 0) / n
  const yMean = rates.reduce((sum, y) => sum + y, 0) / n
  
  let numerator = 0
  let denominator = 0
  
  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (rates[i] - yMean)
    denominator += Math.pow(xValues[i] - xMean, 2)
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0
  const intercept = yMean - slope * xMean
  
  // Calculate standard error for confidence intervals
  const predictions = xValues.map(x => slope * x + intercept)
  const residuals = rates.map((y, i) => y - predictions[i])
  const mse = residuals.reduce((sum, r) => sum + r * r, 0) / n
  const standardError = Math.sqrt(mse)
  
  // Generate 6-month forecast
  const forecasts: RateForecast[] = []
  
  for (let month = 1; month <= 6; month++) {
    const forecastDate = new Date(lastDate)
    forecastDate.setMonth(forecastDate.getMonth() + month)
    
    const x = n + month - 1
    const expected = slope * x + intercept
    const margin = standardError * 1.96 // 95% confidence interval
    
    forecasts.push({
      date: forecastDate,
      expected: Math.round(expected),
      bestCase: Math.round(expected - margin),
      worstCase: Math.round(expected + margin),
      confidence: n >= 12 ? 0.9 : n >= 6 ? 0.7 : 0.5
    })
  }
  
  return forecasts
}

// Detect significant rate changes (>10%)
export function detectRateChanges(history: RateHistoryPoint[]): Array<{
  point: RateHistoryPoint
  previousRate: number
  changePercent: number
  isSignificant: boolean
}> {
  if (history.length < 2) return []
  
  const sorted = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const changes: Array<any> = []
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const previous = sorted[i - 1]
    const changePercent = ((current.dailyRateCHF - previous.dailyRateCHF) / previous.dailyRateCHF) * 100
    
    if (Math.abs(changePercent) > 10) {
      changes.push({
        point: current,
        previousRate: previous.dailyRateCHF,
        changePercent,
        isSignificant: true
      })
    }
  }
  
  return changes
}

// Get all unique role/level/location combinations for trend analysis
export function getUniqueCombinations() {
  const combinations = new Set<string>()
  
  allRateCardRoles.forEach(role => {
    combinations.add(`${role.role}|${role.level}|${role.location}`)
  })
  
  return Array.from(combinations).map(combo => {
    const [role, level, location] = combo.split('|')
    return { role, level, location }
  })
}
