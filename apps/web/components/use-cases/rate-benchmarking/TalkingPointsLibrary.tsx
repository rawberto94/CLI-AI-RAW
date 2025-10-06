'use client'

import React, { useState, useMemo } from 'react'
import { TalkingPoint } from '@/lib/use-cases/rate-history-types'
import { TalkingPointsUtils } from '@/lib/use-cases/talking-points-generator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  MessageSquare, 
  Download, 
  Copy, 
  Check,
  Filter,
  Star,
  TrendingUp,
  Users,
  Target,
  Award,
  Heart
} from 'lucide-react'

interface TalkingPointsLibraryProps {
  talkingPoints: TalkingPoint[]
  onExport?: () => void
  showCategoryFilter?: boolean
  showPersuasivenessFilter?: boolean
}

export function TalkingPointsLibrary({
  talkingPoints,
  onExport,
  showCategoryFilter = true,
  showPersuasivenessFilter = true
}: TalkingPointsLibraryProps) {
  const [selectedCategory, setSelectedCategory] = useState<TalkingPoint['category'] | 'all'>('all')
  const [minPersuasiveness, setMinPersuasiveness] = useState(0)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  // Filter talking points
  const filteredPoints = useMemo(() => {
    return talkingPoints.filter(point => {
      if (selectedCategory !== 'all' && point.category !== selectedCategory) return false
      if (point.persuasivenessScore < minPersuasiveness) return false
      return true
    })
  }, [talkingPoints, selectedCategory, minPersuasiveness])
  
  // Group by category
  const pointsByCategory = useMemo(() => {
    const grouped: Record<TalkingPoint['category'], TalkingPoint[]> = {
      market: [],
      volume: [],
      competitive: [],
      performance: [],
      relationship: []
    }
    
    filteredPoints.forEach(point => {
      grouped[point.category].push(point)
    })
    
    return grouped
  }, [filteredPoints])
  
  // Get category icon
  const getCategoryIcon = (category: TalkingPoint['category']) => {
    const icons = {
      market: TrendingUp,
      volume: Users,
      competitive: Target,
      performance: Award,
      relationship: Heart
    }
    const Icon = icons[category]
    return <Icon className="w-4 h-4" />
  }
  
  // Copy talking point to clipboard
  const copyToClipboard = async (point: TalkingPoint) => {
    const text = `${point.title}\n\n${point.text}\n\nSupporting Data: ${point.supportingData}\nSource: ${point.dataSource}`
    
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(point.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }
  
  // Export all points
  const handleExport = () => {
    const text = TalkingPointsUtils.exportToText(filteredPoints)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'negotiation-talking-points.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    if (onExport) onExport()
  }
  
  // Render a single talking point card
  const renderTalkingPoint = (point: TalkingPoint) => {
    const categoryStyle = TalkingPointsUtils.getCategoryStyle(point.category)
    const persuasivenessBadge = TalkingPointsUtils.getPersuasivenessBadge(point.persuasivenessScore)
    const isCopied = copiedId === point.id
    
    return (
      <div
        key={point.id}
        className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-all bg-white"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded ${categoryStyle.bgColor} ${categoryStyle.color}`}>
              {getCategoryIcon(point.category)}
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">{point.title}</h4>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`${categoryStyle.bgColor} ${categoryStyle.color} border-0`}>
                  {categoryStyle.label}
                </Badge>
                <Badge className={persuasivenessBadge.className}>
                  <Star className="w-3 h-3 mr-1" />
                  {persuasivenessBadge.label}
                </Badge>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(point)}
            className="flex-shrink-0"
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4 mr-1 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </>
            )}
          </Button>
        </div>
        
        <p className="text-gray-700 mb-3 leading-relaxed">{point.text}</p>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="font-medium text-gray-600 min-w-[120px]">Supporting Data:</span>
            <span className="text-gray-700">{point.supportingData}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-gray-600 min-w-[120px]">Source:</span>
            <span className="text-gray-700">{point.dataSource}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-gray-600 min-w-[120px]">Persuasiveness:</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-4 rounded-sm ${
                    i < point.persuasivenessScore
                      ? 'bg-blue-600'
                      : 'bg-gray-200'
                  }`}
                />
              ))}
              <span className="ml-2 text-gray-600">
                {point.persuasivenessScore}/10
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // Render category section
  const renderCategorySection = (category: TalkingPoint['category']) => {
    const points = pointsByCategory[category]
    if (points.length === 0) return null
    
    const categoryStyle = TalkingPointsUtils.getCategoryStyle(category)
    
    return (
      <div key={category} className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded ${categoryStyle.bgColor} ${categoryStyle.color}`}>
            {getCategoryIcon(category)}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {categoryStyle.label} Arguments
          </h3>
          <Badge variant="outline">{points.length}</Badge>
        </div>
        
        <div className="space-y-3">
          {points.map(point => renderTalkingPoint(point))}
        </div>
      </div>
    )
  }
  
  if (talkingPoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Negotiation Talking Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No talking points generated yet</p>
            <p className="text-sm">Generate talking points to see negotiation arguments</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <CardTitle>Negotiation Talking Points</CardTitle>
            <Badge variant="outline">{filteredPoints.length} points</Badge>
          </div>
          
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>
        
        {/* Filters */}
        <div className="space-y-3">
          {showCategoryFilter && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filter by Category:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory('all')}
                >
                  All Categories
                </Button>
                {(['market', 'volume', 'competitive', 'performance', 'relationship'] as const).map(category => {
                  const style = TalkingPointsUtils.getCategoryStyle(category)
                  const count = pointsByCategory[category].length
                  
                  return (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      disabled={count === 0}
                    >
                      {getCategoryIcon(category)}
                      <span className="ml-1">{style.label}</span>
                      <Badge className="ml-1" variant="outline">{count}</Badge>
                    </Button>
                  )
                })}
              </div>
            </div>
          )}
          
          {showPersuasivenessFilter && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Minimum Persuasiveness: {minPersuasiveness}/10
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={minPersuasiveness}
                onChange={(e) => setMinPersuasiveness(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>All</span>
                <span>Moderate (6+)</span>
                <span>Strong (8+)</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {selectedCategory === 'all' ? (
          <div className="space-y-6">
            {(['market', 'volume', 'competitive', 'performance', 'relationship'] as const).map(category =>
              renderCategorySection(category)
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {pointsByCategory[selectedCategory].map(point => renderTalkingPoint(point))}
          </div>
        )}
        
        {filteredPoints.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Filter className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No talking points match your filters</p>
            <p className="text-sm">Try adjusting your filter criteria</p>
          </div>
        )}
        
        {/* Summary Stats */}
        {filteredPoints.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-3">Talking Points Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-900">{filteredPoints.length}</div>
                <div className="text-blue-700">Total Points</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-900">
                  {filteredPoints.filter(p => p.persuasivenessScore >= 8).length}
                </div>
                <div className="text-green-700">Strong Arguments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-900">
                  {Math.round(
                    filteredPoints.reduce((sum, p) => sum + p.persuasivenessScore, 0) / 
                    filteredPoints.length * 10
                  ) / 10}
                </div>
                <div className="text-purple-700">Avg. Persuasiveness</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-900">
                  {Object.keys(pointsByCategory).filter(
                    cat => pointsByCategory[cat as TalkingPoint['category']].length > 0
                  ).length}
                </div>
                <div className="text-orange-700">Categories Covered</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
