/**
 * Scenario Modeling Component
 * Create and compare different rate negotiation scenarios
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Copy,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Calculator,
  Sparkles,
} from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  discountPercent: number;
  volumeIncrease: number;
  termLengthYears: number;
}

export interface ScenarioModelingProps {
  className?: string;
  baseRate?: number;
  annualSpend?: number;
  onScenarioSelect?: (scenario: Scenario) => void;
}

export function ScenarioModeling({ 
  className,
  baseRate = 150,
  annualSpend = 1000000,
  onScenarioSelect 
}: ScenarioModelingProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([
    { id: '1', name: 'Conservative', discountPercent: 5, volumeIncrease: 0, termLengthYears: 1 },
    { id: '2', name: 'Moderate', discountPercent: 10, volumeIncrease: 10, termLengthYears: 2 },
    { id: '3', name: 'Aggressive', discountPercent: 15, volumeIncrease: 25, termLengthYears: 3 },
  ]);

  const [selectedId, setSelectedId] = useState<string>('2');

  const calculateSavings = (scenario: Scenario) => {
    const discountSavings = annualSpend * (scenario.discountPercent / 100);
    const volumeAdjustedSpend = annualSpend * (1 + scenario.volumeIncrease / 100);
    const totalSavingsPerYear = volumeAdjustedSpend * (scenario.discountPercent / 100);
    const totalSavings = totalSavingsPerYear * scenario.termLengthYears;
    const newRate = baseRate * (1 - scenario.discountPercent / 100);
    
    return {
      discountSavings,
      totalSavingsPerYear,
      totalSavings,
      newRate,
      savingsPercent: scenario.discountPercent,
    };
  };

  const addScenario = () => {
    const newScenario: Scenario = {
      id: Date.now().toString(),
      name: `Scenario ${scenarios.length + 1}`,
      discountPercent: 10,
      volumeIncrease: 0,
      termLengthYears: 1,
    };
    setScenarios([...scenarios, newScenario]);
    setSelectedId(newScenario.id);
  };

  const duplicateScenario = (scenario: Scenario) => {
    const newScenario: Scenario = {
      ...scenario,
      id: Date.now().toString(),
      name: `${scenario.name} (Copy)`,
    };
    setScenarios([...scenarios, newScenario]);
    setSelectedId(newScenario.id);
  };

  const deleteScenario = (id: string) => {
    if (scenarios.length <= 1) return;
    setScenarios(scenarios.filter(s => s.id !== id));
    if (selectedId === id) {
      setSelectedId(scenarios[0].id);
    }
  };

  const updateScenario = (id: string, updates: Partial<Scenario>) => {
    setScenarios(scenarios.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  };

  const selectedScenario = scenarios.find(s => s.id === selectedId);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Scenario tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {scenarios.map((scenario) => {
          const savings = calculateSavings(scenario);
          const isSelected = scenario.id === selectedId;
          
          return (
            <button
              key={scenario.id}
              onClick={() => setSelectedId(scenario.id)}
              className={cn(
                'flex-shrink-0 px-4 py-3 rounded-xl border-2 transition-all text-left min-w-[160px]',
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              )}
            >
              <p className={cn('font-medium text-sm', isSelected ? 'text-blue-700' : 'text-slate-700')}>
                {scenario.name}
              </p>
              <p className="text-lg font-bold text-emerald-600">
                ${(savings.totalSavingsPerYear / 1000).toFixed(0)}K/yr
              </p>
            </button>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          onClick={addScenario}
          className="flex-shrink-0 h-[72px] px-4"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Selected scenario editor */}
      {selectedScenario && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Input
                  value={selectedScenario.name}
                  onChange={(e) => updateScenario(selectedScenario.id, { name: e.target.value })}
                  className="h-8 w-48 font-semibold"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => duplicateScenario(selectedScenario)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                {scenarios.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteScenario(selectedScenario.id)}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => onScenarioSelect?.(selectedScenario)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Apply Scenario
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Discount slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Percent className="h-4 w-4 text-slate-400" />
                  Discount Rate
                </label>
                <span className="text-lg font-bold text-blue-600">{selectedScenario.discountPercent}%</span>
              </div>
              <Slider
                value={[selectedScenario.discountPercent]}
                onValueChange={([value]) => updateScenario(selectedScenario.id, { discountPercent: value })}
                max={30}
                step={1}
                className="py-2"
              />
            </div>

            {/* Volume increase slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                  Volume Commitment Increase
                </label>
                <span className="text-lg font-bold text-purple-600">+{selectedScenario.volumeIncrease}%</span>
              </div>
              <Slider
                value={[selectedScenario.volumeIncrease]}
                onValueChange={([value]) => updateScenario(selectedScenario.id, { volumeIncrease: value })}
                max={50}
                step={5}
                className="py-2"
              />
            </div>

            {/* Term length */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-slate-400" />
                  Contract Term
                </label>
                <span className="text-lg font-bold text-amber-600">{selectedScenario.termLengthYears} years</span>
              </div>
              <Slider
                value={[selectedScenario.termLengthYears]}
                onValueChange={([value]) => updateScenario(selectedScenario.id, { termLengthYears: value })}
                min={1}
                max={5}
                step={1}
                className="py-2"
              />
            </div>

            {/* Results */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              {(() => {
                const savings = calculateSavings(selectedScenario);
                return (
                  <>
                    <div className="p-3 rounded-lg bg-blue-50">
                      <p className="text-xs text-blue-600 mb-1">New Rate</p>
                      <p className="text-xl font-bold text-blue-700">${savings.newRate.toFixed(0)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50">
                      <p className="text-xs text-emerald-600 mb-1">Annual Savings</p>
                      <p className="text-xl font-bold text-emerald-700">${(savings.totalSavingsPerYear / 1000).toFixed(0)}K</p>
                    </div>
                    <div className="p-3 rounded-lg bg-purple-50">
                      <p className="text-xs text-purple-600 mb-1">Total Savings</p>
                      <p className="text-xl font-bold text-purple-700">${(savings.totalSavings / 1000).toFixed(0)}K</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50">
                      <p className="text-xs text-amber-600 mb-1">Savings %</p>
                      <p className="text-xl font-bold text-amber-700">{savings.savingsPercent}%</p>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ScenarioModeling;
