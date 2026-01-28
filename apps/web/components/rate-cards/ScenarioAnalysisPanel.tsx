'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Scenario {
  scenarioType: 'best' | 'likely' | 'worst';
  targetRate: number;
  probability: number;
  annualSavings: number;
  assumptions: string[];
  risks: string[];
  recommendations: string[];
}

interface ScenarioAnalysis {
  currentRate: number;
  marketMedian: number;
  scenarios: Scenario[];
  probabilityWeightedSavings: number;
  recommendedTarget: number;
  confidenceLevel: number;
}

interface ScenarioAnalysisPanelProps {
  rateCardId: string;
  tenantId: string;
}

export function ScenarioAnalysisPanel({ rateCardId, tenantId }: ScenarioAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<ScenarioAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadScenarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateCardId]);

  const loadScenarios = async () => {
    try {
      const response = await fetch(
        `/api/rate-cards/${rateCardId}/negotiation/scenarios?tenantId=${tenantId}`
      );
      const data = await response.json();
      setAnalysis(data);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading scenario analysis...</div>;
  }

  if (!analysis) {
    return <div className="text-center py-8 text-gray-500">No scenario data available</div>;
  }

  const getScenarioColor = (type: string) => {
    switch (type) {
      case 'best': return 'bg-green-100 border-green-300 text-green-800';
      case 'likely': return 'bg-violet-100 border-violet-300 text-violet-800';
      case 'worst': return 'bg-orange-100 border-orange-300 text-orange-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getScenarioIcon = (type: string) => {
    switch (type) {
      case 'best': return '🎯';
      case 'likely': return '📊';
      case 'worst': return '⚠️';
      default: return '📈';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="p-6 bg-gradient-to-r from-violet-50 to-purple-50">
        <h3 className="text-xl font-bold mb-4">Negotiation Scenario Analysis</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-600">Current Rate</div>
            <div className="text-2xl font-bold">${analysis.currentRate}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Market Median</div>
            <div className="text-2xl font-bold">${analysis.marketMedian}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Recommended Target</div>
            <div className="text-2xl font-bold text-violet-600">${analysis.recommendedTarget}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Expected Savings</div>
            <div className="text-2xl font-bold text-green-600">
              ${analysis.probabilityWeightedSavings.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-600">Confidence Level:</div>
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-violet-600 h-2 rounded-full"
              style={{ width: `${analysis.confidenceLevel}%` }}
            />
          </div>
          <div className="text-sm font-semibold">{analysis.confidenceLevel}%</div>
        </div>
      </Card>

      {/* Scenarios */}
      <div className="grid gap-4">
        {analysis.scenarios.map((scenario) => (
          <Card
            key={scenario.scenarioType}
            className={`p-6 border-l-4 ${getScenarioColor(scenario.scenarioType)}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getScenarioIcon(scenario.scenarioType)}</span>
                <div>
                  <h4 className="text-lg font-bold capitalize">
                    {scenario.scenarioType} Case Scenario
                  </h4>
                  <p className="text-sm text-gray-600">
                    {(scenario.probability * 100).toFixed(0)}% probability
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">${scenario.targetRate}</div>
                <div className="text-sm text-green-600 font-semibold">
                  ${((scenario as any).annualSavingsPotential || 0).toLocaleString()}/year
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <h5 className="font-semibold mb-2 text-sm">Assumptions</h5>
                <ul className="text-sm space-y-1">
                  {scenario.assumptions.map((assumption, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-violet-500">•</span>
                      <span>{assumption}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h5 className="font-semibold mb-2 text-sm">Risks</h5>
                <ul className="text-sm space-y-1">
                  {scenario.risks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-orange-500">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h5 className="font-semibold mb-2 text-sm">Recommendations</h5>
                <ul className="text-sm space-y-1">
                  {scenario.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-500">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button className="flex-1">
          Use Likely Scenario (${analysis.recommendedTarget})
        </Button>
        <Button variant="outline">
          Export Analysis
        </Button>
      </div>
    </div>
  );
}
