'use client'

import React, { useState, useMemo, useRef } from 'react'
import { RateCardRole } from '@/lib/use-cases/multi-client-rate-data'
import { getRateHistory, analyzeTrend, RateHistoryPoint } from '@/lib/use-cases/rate-history-data'
import { TargetRateCalculator } from '@/lib/use-cases/target-rate-calculator'
import { TalkingPointsGenerator } from '@/lib/use-cases/talking-points-generator'
import { ScenarioModeler } from '@/lib/use-cases/scenario-modeling'
import { TargetRateCalculatorComponent } from './TargetRateCalculator'
import { TalkingPointsLibrary } from './TalkingPointsLibrary'
import { ScenarioComparisonComponent } from './ScenarioComparison'
import { InteractiveRateChart } from '../negotiation-prep/InteractiveRateChart'
import { MarketPositionBar, SavingsPotentialBar, ConfidenceBar } from '../negotiation-prep/AnimatedProgressBar'
import { PDFExportService } from '@/lib/negotiation-prep/pdf-export-service'
import { useKeyboardShortcuts, commonShortcuts, getShortcutDisplay } from '@/hooks/useKeyboardShortcuts'
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout'
import { AIRecommendationPanel } from '../negotiation-prep/AIRecommendationPanel'
import { RecommendationCards } from '../negotiation-prep/RecommendationCards'
import { AIRecommendationEngine, type NegotiationContext } from '@/lib/negotiation-prep/ai-recommendation-engine'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  FileText, 
  Download, 
  Share2,
  Briefcase,
  TrendingUp,
  Target,
  MessageSquare,
  GitCompare,
  Calendar,
  User,
  MapPin,
  Building2,
  Keyboard,
  FileDown
} from 'lucide-react'

interface NegotiationPrepDashboardProps {
  role: string
  level: string
  location: string
  supplier: string
  client?: string
  currentRate: number
  annualVolume?: number
  marketData: RateCardRole[]
  relationshipYears?: number
}

export function NegotiationPrepDashboard({
  role,
  level,
  location,
  supplier,
  client,
  currentRate,
  annualVolume = 220,
  marketData,
  relationshipYears = 2
}: NegotiationPrepDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedTargetRate, setSelectedTargetRate] = useState<number | null>(null)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [aiRecommendation, setAiRecommendation] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const dashboardRef = useRef<HTMLDivElement>(null)
  
  // Responsive layout
  const layout = useResponsiveLayout()
  
  // Generate historical data and trends
  const rateHistory = useMemo(() => {
    return getRateHistory(role, level, location, supplier)
  }, [role, level, location, supplier])
  
  const trendAnalysis = useMemo(() => {
    return analyzeTrend(rateHistory)
  }, [rateHistory])
  
  // Calculate market intelligence
  const marketIntelligence = useMemo(() => {
    const matchingRoles = marketData.filter(r => 
      r.role === role && r.level === level && r.location === location
    )
    
    const rates = matchingRoles.map(r => r.dailyRateCHF).sort((a, b) => a - b)
    const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length
    const medianRate = rates[Math.floor(rates.length / 2)]
    const minRate = rates[0]
    const maxRate = rates[rates.length - 1]
    
    const currentRank = rates.filter(r => r < currentRate).length + 1
    const competitorsBelow = rates.filter(r => r < currentRate).length
    const competitorsAbove = rates.filter(r => r > currentRate).length
    
    return {
      averageRate: avgRate,
      medianRate,
      minRate,
      maxRate,
      competitivePosition: {
        marketRank: currentRank,
        competitorsBelow,
        competitorsAbove,
        percentile: Math.round((currentRank / rates.length) * 100)
      }
    }
  }, [role, level, location, marketData, currentRate])
  
  // Calculate target rates
  const targetRates = useMemo(() => {
    return TargetRateCalculator.calculateTargetRates({
      role,
      level,
      location,
      currentRate,
      annualVolume,
      marketData
    })
  }, [role, level, location, currentRate, annualVolume, marketData])
  
  // Generate talking points
  const talkingPoints = useMemo(() => {
    const targetRate = selectedTargetRate || targetRates.targets.moderate
    
    return TalkingPointsGenerator.generateTalkingPoints({
      role,
      level,
      location,
      supplier,
      currentRate,
      targetRate,
      marketIntelligence,
      trendAnalysis,
      targetRates,
      annualVolume,
      relationshipYears
    })
  }, [role, level, location, supplier, currentRate, selectedTargetRate, targetRates, marketIntelligence, trendAnalysis, annualVolume, relationshipYears])
  
  // Generate scenarios
  const scenarios = useMemo(() => {
    return ScenarioModeler.generateStandardScenarios(
      currentRate,
      annualVolume,
      targetRates.market
    )
  }, [currentRate, annualVolume, targetRates])
  
  const comparison = useMemo(() => {
    return ScenarioModeler.compareScenarios(scenarios)
  }, [scenarios])
  
  // Generate AI recommendation
  React.useEffect(() => {
    const generateRecommendation = async () => {
      // Only generate if we have market intelligence data
      if (!marketIntelligence || !trendAnalysis) {
        return
      }

      setAiLoading(true)
      try {
        const context: NegotiationContext = {
          role,
          level,
          location,
          supplier,
          relationshipYears,
          annualVolume,
          marketPosition: {
            currentRate,
            marketMedian: marketIntelligence.medianRate,
            percentile: marketIntelligence.competitivePosition.percentile,
            competitorsAbove: marketIntelligence.competitivePosition.competitorsAbove,
            competitorsBelow: marketIntelligence.competitivePosition.competitorsBelow
          },
          historicalPattern: {
            trend: trendAnalysis.direction as 'increasing' | 'decreasing' | 'stable',
            volatility: trendAnalysis.volatility > 10 ? 'high' : trendAnalysis.volatility > 5 ? 'medium' : 'low',
            averageChange: trendAnalysis.percentChange
          }
        }
        
        const recommendation = await AIRecommendationEngine.generateRecommendation(context)
        setAiRecommendation(recommendation)
      } catch (error) {
        console.error('Error generating AI recommendation:', error)
      } finally {
        setAiLoading(false)
      }
    }
    
    generateRecommendation()
  }, [role, level, location, supplier, currentRate, relationshipYears, annualVolume, marketIntelligence, trendAnalysis])
  
  // Export to PDF
  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      const pdfService = new PDFExportService()
      
      const negotiationData = {
        role,
        level,
        location,
        currentRate,
        targetRate: selectedTargetRate || targetRates.targets.moderate,
        marketMedian: marketIntelligence.medianRate,
        percentile: marketIntelligence.competitivePosition.percentile,
        potentialSavings: (currentRate - targetRates.targets.aggressive) * annualVolume,
        talkingPoints: talkingPoints.map(tp => tp.point),
        scenarios: scenarios.map(s => ({
          name: s.name,
          rate: s.rate,
          savings: s.annualSavings
        }))
      }
      
      await pdfService.generatePDF(negotiationData, {
        includeCoverPage: true,
        includeExecutiveSummary: true,
        includeCharts: true,
        includeTalkingPoints: true,
        includeScenarios: true,
        includeMarketIntelligence: true,
        companyName: client || 'Your Company',
        preparedBy: 'Procurement Team',
        preparedFor: 'Negotiation Team'
      })
      
      pdfService.downloadPDF(`negotiation-prep-${role}-${level}-${Date.now()}.pdf`)
      setShowExportDialog(false)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Error generating PDF. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }
  
  // Share dashboard (placeholder)
  const handleShare = () => {
    // In a real implementation, this would create a shareable link
    if (navigator.share) {
      navigator.share({
        title: `Negotiation Prep: ${role} - ${level}`,
        text: `Market analysis for ${role} - ${level} in ${location}`,
        url: window.location.href
      }).catch(err => console.log('Error sharing:', err))
    } else {
      alert('Share functionality would be implemented here')
    }
  }
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: true,
    shortcuts: [
      commonShortcuts.tab(1, () => setActiveTab('overview')),
      commonShortcuts.tab(2, () => setActiveTab('calculator')),
      commonShortcuts.tab(3, () => setActiveTab('talking-points')),
      commonShortcuts.tab(4, () => setActiveTab('scenarios')),
      commonShortcuts.tab(5, () => setActiveTab('trends')),
      commonShortcuts.export(() => setShowExportDialog(true)),
      {
        key: 's',
        ctrl: true,
        meta: true,
        shift: true,
        callback: handleShare,
        description: 'Share Dashboard'
      },
      commonShortcuts.help(() => setShowHelpDialog(true))
    ]
  })
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-6 h-6 text-blue-600" />
                <CardTitle className="text-2xl">Negotiation Preparation Dashboard</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {role} • {level}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {location}
                </div>
                <div className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {supplier}
                </div>
                {client && (
                  <div className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    Client: {client}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={handleShare} variant="outline" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button onClick={() => setShowExportDialog(true)} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button onClick={() => setShowHelpDialog(true)} variant="ghost" size="sm" title="Keyboard Shortcuts">
                <Keyboard className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-700">Current Rate</div>
              <div className="text-xl font-bold text-blue-900">
                CHF {currentRate.toLocaleString()}
              </div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-sm text-green-700">Target Rate</div>
              <div className="text-xl font-bold text-green-900">
                CHF {targetRates.targets.moderate.toLocaleString()}
              </div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-700">Potential Savings</div>
              <div className="text-xl font-bold text-purple-900">
                CHF {targetRates.savings.moderate.toLocaleString()}
              </div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-sm text-orange-700">Market Position</div>
              <div className="text-xl font-bold text-orange-900">
                {marketIntelligence.competitivePosition.marketRank}th
              </div>
            </div>
            <div className="text-center p-3 bg-pink-50 rounded-lg">
              <div className="text-sm text-pink-700">Trend</div>
              <div className="text-xl font-bold text-pink-900">
                {trendAnalysis.direction.toUpperCase()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="targets" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Targets
          </TabsTrigger>
          <TabsTrigger value="talking-points" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Talking Points
          </TabsTrigger>
          <TabsTrigger value="scenarios" className="flex items-center gap-2">
            <GitCompare className="w-4 h-4" />
            Scenarios
          </TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Negotiation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Market Position</h4>
                <p className="text-gray-700">
                  Your current rate of CHF {currentRate.toLocaleString()} places you in the{' '}
                  <strong>{marketIntelligence.competitivePosition.marketRank}th percentile</strong> of the market.
                  There are {marketIntelligence.competitivePosition.competitorsBelow} suppliers offering lower rates
                  and {marketIntelligence.competitivePosition.competitorsAbove} offering higher rates.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Recommended Strategy</h4>
                <p className="text-gray-700">
                  Based on market analysis, we recommend a <strong>moderate approach</strong> targeting
                  the 25th percentile (CHF {targetRates.targets.moderate.toLocaleString()}). This represents
                  a {Math.round(((currentRate - targetRates.targets.moderate) / currentRate) * 100)}% reduction
                  with a 60% probability of success.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Key Talking Points</h4>
                <ul className="space-y-2">
                  {talkingPoints.slice(0, 3).map(point => (
                    <li key={point.id} className="flex items-start gap-2">
                      <Badge className="mt-0.5">{point.category}</Badge>
                      <span className="text-gray-700">{point.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Expected Outcome</h4>
                <p className="text-gray-700">
                  Expected value across all scenarios: <strong>CHF {comparison.expectedValue.toLocaleString()}</strong> in annual savings.
                  Risk level: <Badge className={comparison.riskAssessment.level === 'low' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {comparison.riskAssessment.level.toUpperCase()}
                  </Badge>
                </p>
              </div>
            </CardContent>
          </Card>
          
          {/* AI Recommendation Panel */}
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Strategy Recommendation</CardTitle>
            </CardHeader>
            <CardContent>
              <AIRecommendationPanel 
                recommendation={aiRecommendation}
                loading={aiLoading}
              />
              
              {aiRecommendation && aiRecommendation.alternativeStrategies.length > 0 && (
                <div className="mt-6">
                  <RecommendationCards 
                    strategies={aiRecommendation.alternativeStrategies}
                    selectedApproach={aiRecommendation.primaryStrategy.approach}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button onClick={() => setActiveTab('trends')} variant="outline" className="h-auto py-4 flex-col">
                  <TrendingUp className="w-6 h-6 mb-2" />
                  <span>View Trends</span>
                </Button>
                <Button onClick={() => setActiveTab('targets')} variant="outline" className="h-auto py-4 flex-col">
                  <Target className="w-6 h-6 mb-2" />
                  <span>Set Targets</span>
                </Button>
                <Button onClick={() => setActiveTab('talking-points')} variant="outline" className="h-auto py-4 flex-col">
                  <MessageSquare className="w-6 h-6 mb-2" />
                  <span>Review Arguments</span>
                </Button>
                <Button onClick={() => setActiveTab('scenarios')} variant="outline" className="h-auto py-4 flex-col">
                  <GitCompare className="w-6 h-6 mb-2" />
                  <span>Compare Scenarios</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Trends Tab */}
        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Historical Rate Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">Trend Direction</div>
                    <div className="text-xl font-bold capitalize">{trendAnalysis.direction}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">Change</div>
                    <div className="text-xl font-bold">
                      {trendAnalysis.percentChange > 0 ? '+' : ''}
                      {trendAnalysis.percentChange.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">Volatility</div>
                    <div className="text-xl font-bold">{trendAnalysis.volatility.toFixed(1)}%</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">Confidence</div>
                    <div className="text-xl font-bold capitalize">{trendAnalysis.confidence}</div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Historical Data Points</h4>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Date</th>
                          <th className="text-right p-2">Rate (CHF)</th>
                          <th className="text-left p-2">Change Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rateHistory.map(point => (
                          <tr key={point.id} className="border-t">
                            <td className="p-2">{point.timestamp.toLocaleDateString()}</td>
                            <td className="text-right p-2">{point.dailyRateCHF.toLocaleString()}</td>
                            <td className="p-2 capitalize">{point.changeReason?.replace('_', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Targets Tab */}
        <TabsContent value="targets">
          <TargetRateCalculatorComponent
            role={role}
            level={level}
            location={location}
            supplier={supplier}
            currentRate={currentRate}
            annualVolume={annualVolume}
            marketData={marketData}
            onSelectTarget={(rate, scenario) => {
              setSelectedTargetRate(rate)
              setActiveTab('talking-points')
            }}
          />
        </TabsContent>
        
        {/* Talking Points Tab */}
        <TabsContent value="talking-points">
          <TalkingPointsLibrary
            talkingPoints={talkingPoints}
            showCategoryFilter={true}
            showPersuasivenessFilter={true}
          />
        </TabsContent>
        
        {/* Scenarios Tab */}
        <TabsContent value="scenarios">
          <ScenarioComparisonComponent
            currentRate={currentRate}
            annualVolume={annualVolume}
            marketPercentiles={targetRates.market}
            onSelectScenario={(scenario) => {
              setSelectedTargetRate(scenario.targetRate)
              setActiveTab('talking-points')
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5" />
              Export Negotiation Prep Report
            </DialogTitle>
            <DialogDescription>
              Generate a professional PDF report with all negotiation insights
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Report will include:</h4>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li>• Executive Summary</li>
                <li>• Market Intelligence & Position</li>
                <li>• Rate Trends & Charts</li>
                <li>• Negotiation Talking Points</li>
                <li>• Scenario Analysis</li>
              </ul>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleExportPDF} 
                disabled={isExporting}
                className="flex-1"
              >
                {isExporting ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowExportDialog(false)}
                disabled={isExporting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Help Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="w-5 h-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Use these shortcuts to navigate faster
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>Overview</span>
                <kbd className="px-2 py-1 bg-white border rounded text-xs">⌘/Ctrl+1</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>Calculator</span>
                <kbd className="px-2 py-1 bg-white border rounded text-xs">⌘/Ctrl+2</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>Talking Points</span>
                <kbd className="px-2 py-1 bg-white border rounded text-xs">⌘/Ctrl+3</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>Scenarios</span>
                <kbd className="px-2 py-1 bg-white border rounded text-xs">⌘/Ctrl+4</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>Trends</span>
                <kbd className="px-2 py-1 bg-white border rounded text-xs">⌘/Ctrl+5</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>Export</span>
                <kbd className="px-2 py-1 bg-white border rounded text-xs">⌘/Ctrl+E</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>Share</span>
                <kbd className="px-2 py-1 bg-white border rounded text-xs">⌘/Ctrl+Shift+S</kbd>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>Help</span>
                <kbd className="px-2 py-1 bg-white border rounded text-xs">?</kbd>
              </div>
            </div>
            
            <Button 
              onClick={() => setShowHelpDialog(false)}
              className="w-full"
            >
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
