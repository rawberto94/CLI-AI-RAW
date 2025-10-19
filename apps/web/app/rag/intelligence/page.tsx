'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/enhanced-card'
import { Tabs } from '@/components/ui/tabs'

export default function RAGIntelligencePage() {
  const [patterns, setPatterns] = useState<any[]>([])
  const [risks, setRisks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const tenantId = 'tenant-456' // TODO: Get from auth

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [patternsRes, risksRes] = await Promise.all([
        fetch(`/api/rag/intelligence/patterns?tenantId=${tenantId}&type=clause`),
        fetch(`/api/rag/intelligence/risks?tenantId=${tenantId}`)
      ])

      const patternsData = await patternsRes.json()
      const risksData = await risksRes.json()

      setPatterns(patternsData.patterns || [])
      setRisks(risksData.risks || [])
    } catch (error) {
      console.error('Failed to load intelligence data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Contract Intelligence</h1>
        <p className="text-gray-600 mt-2">
          Patterns, risks, and insights across your contract portfolio
        </p>
      </div>

      <Tabs
        tabs={[
          {
            id: 'patterns',
            label: 'Patterns',
            content: <PatternsView patterns={patterns} />
          },
          {
            id: 'risks',
            label: 'Risks',
            content: <RisksView risks={risks} />
          },
          {
            id: 'relationships',
            label: 'Relationships',
            content: <RelationshipsView tenantId={tenantId} />
          }
        ]}
      />
    </div>
  )
}

function PatternsView({ patterns }: { patterns: any[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patterns.map((pattern, idx) => (
          <Card key={idx} className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-500">Pattern</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  pattern.isStandard ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {pattern.isStandard ? 'Standard' : 'Non-Standard'}
                </span>
              </div>
              <p className="text-sm">{pattern.pattern}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Frequency: {(pattern.frequency * 100).toFixed(1)}%</span>
                <span>{pattern.contracts.length} contracts</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${pattern.frequency * 100}%` }}
                ></div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {patterns.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No patterns detected yet. Process more contracts to see patterns.
        </div>
      )}
    </div>
  )
}

function RisksView({ risks }: { risks: any[] }) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  return (
    <div className="space-y-4">
      {risks.map((risk, idx) => (
        <Card key={idx} className={`p-6 border-l-4 ${getSeverityColor(risk.severity)}`}>
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{risk.riskType}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {risk.affectedContracts.length} contracts affected
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(risk.severity)}`}>
                {risk.severity.toUpperCase()}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Correlation Score</span>
                <span className="font-medium">{(risk.correlationScore * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full"
                  style={{ width: `${risk.correlationScore * 100}%` }}
                ></div>
              </div>
            </div>

            {risk.recommendations && risk.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Recommendations</h4>
                <ul className="space-y-1">
                  {risk.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start">
                      <span className="mr-2">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      ))}

      {risks.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No risks detected. Your contract portfolio looks healthy!
        </div>
      )}
    </div>
  )
}

function RelationshipsView({ tenantId }: { tenantId: string }) {
  const [contractId, setContractId] = useState('')
  const [relationships, setRelationships] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadRelationships = async () => {
    if (!contractId) return

    setLoading(true)
    try {
      const res = await fetch(
        `/api/rag/intelligence/relationships?contractId=${contractId}&tenantId=${tenantId}`
      )
      const data = await res.json()
      setRelationships(data)
    } catch (error) {
      console.error('Failed to load relationships:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Enter contract ID"
          value={contractId}
          onChange={(e) => setContractId(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <button
          onClick={loadRelationships}
          disabled={loading || !contractId}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Analyze'}
        </button>
      </div>

      {relationships && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Network Metrics</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {relationships.networkMetrics.degree}
                </div>
                <div className="text-sm text-gray-600">Direct Connections</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {(relationships.networkMetrics.centrality * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Centrality</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {(relationships.networkMetrics.clustering * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Clustering</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Direct Relationships</h3>
            <div className="space-y-2">
              {relationships.directRelationships.map((rel: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="font-medium">{rel.contractId}</div>
                    <div className="text-sm text-gray-600">{rel.type}</div>
                  </div>
                  <div className="text-sm font-medium text-blue-600">
                    {(rel.strength * 100).toFixed(0)}% strength
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {relationships.indirectRelationships.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-lg mb-4">Indirect Relationships</h3>
              <div className="space-y-2">
                {relationships.indirectRelationships.map((rel: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{rel.contractId}</div>
                      <div className="text-sm text-gray-600">
                        Path: {rel.path.join(' → ')}
                      </div>
                    </div>
                    <div className="text-sm font-medium text-purple-600">
                      {(rel.strength * 100).toFixed(0)}% strength
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {!relationships && !loading && (
        <div className="text-center py-12 text-gray-500">
          Enter a contract ID to analyze its relationships
        </div>
      )}
    </div>
  )
}
