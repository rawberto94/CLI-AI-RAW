"use client";

/**
 * AI Tools Page
 * 
 * Central hub for AI-powered features including:
 * - Batch Contract Analysis
 * - AI Analytics Dashboard
 * - A/B Testing Interface
 */

import React, { useState } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  FileStack,
  BarChart3,
  FlaskConical,
  Bot,
} from 'lucide-react';
import { BatchContractAnalysis } from '@/components/ai/BatchContractAnalysis';
import { AIAnalyticsDashboard } from '@/components/ai/AIAnalyticsDashboard';

export default function AIToolsPage() {
  const [activeTab, setActiveTab] = useState('batch');

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Bot className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-slate-900">AI Tools</h1>
        </div>
        <p className="text-slate-600">
          Advanced AI-powered tools for contract analysis and insights
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
          <TabsTrigger value="batch" className="flex items-center gap-2">
            <FileStack className="w-4 h-4" />
            Batch Analysis
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            A/B Testing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="batch">
          <BatchContractAnalysis />
        </TabsContent>

        <TabsContent value="analytics">
          <AIAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="testing">
          <ABTestingInterface />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// A/B Testing Interface Component
function ABTestingInterface() {
  const [tests, setTests] = useState<Array<{
    id: string;
    name: string;
    modelA: string;
    modelB: string;
    status: string;
    runs: number;
    winRate: { a: number; b: number; tie: number };
  }>>([
    {
      id: 'test-1',
      name: 'Contract Summarization',
      modelA: 'gpt-4o-mini',
      modelB: 'gpt-4o',
      status: 'active',
      runs: 47,
      winRate: { a: 35, b: 55, tie: 10 },
    },
    {
      id: 'test-2',
      name: 'Risk Analysis',
      modelA: 'gpt-4o',
      modelB: 'mistral-large',
      status: 'active',
      runs: 23,
      winRate: { a: 62, b: 30, tie: 8 },
    },
  ]);

  const [isRunning, setIsRunning] = useState<string | null>(null);
  const [results, setResults] = useState<{
    modelA: { content: string; latency: number };
    modelB: { content: string; latency: number };
  } | null>(null);

  const runTest = async (testId: string) => {
    setIsRunning(testId);
    setResults(null);

    try {
      const response = await fetch('/api/ai/ab-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute',
          testId,
          prompt: 'Summarize the key terms and obligations in a typical software license agreement.',
        }),
      });

      const data = await response.json();
      
      if (data.results) {
        setResults({
          modelA: {
            content: data.results.modelA.content,
            latency: data.results.modelA.latency,
          },
          modelB: {
            content: data.results.modelB.content,
            latency: data.results.modelB.latency,
          },
        });
      }
    } catch (error) {
      console.error('Failed to run test:', error);
    } finally {
      setIsRunning(null);
    }
  };

  const recordRating = async (testId: string, winner: 'a' | 'b' | 'tie') => {
    try {
      await fetch('/api/ai/ab-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rate',
          testId,
          winner,
        }),
      });

      // Update local state
      setTests(prev => prev.map(test => {
        if (test.id === testId) {
          const newRuns = test.runs + 1;
          return {
            ...test,
            runs: newRuns,
            winRate: {
              a: winner === 'a' ? test.winRate.a + 1 : test.winRate.a,
              b: winner === 'b' ? test.winRate.b + 1 : test.winRate.b,
              tie: winner === 'tie' ? test.winRate.tie + 1 : test.winRate.tie,
            },
          };
        }
        return test;
      }));

      setResults(null);
    } catch (error) {
      console.error('Failed to record rating:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">A/B Testing</h2>
          <p className="text-slate-600 mt-1">
            Compare AI model performance side-by-side
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Create New Test
        </button>
      </div>

      {/* Active Tests */}
      <div className="space-y-4">
        {tests.map((test) => (
          <div
            key={test.id}
            className="border border-slate-200 rounded-lg p-6 bg-white"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{test.name}</h3>
                <p className="text-sm text-slate-500">
                  {test.modelA} vs {test.modelB} • {test.runs} runs
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  test.status === 'active' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {test.status}
                </span>
                <button
                  onClick={() => runTest(test.id)}
                  disabled={isRunning === test.id}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                >
                  {isRunning === test.id ? 'Running...' : 'Run Test'}
                </button>
              </div>
            </div>

            {/* Win Rate Visualization */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2 text-sm">
                <span className="text-blue-600">{test.modelA}: {test.winRate.a}%</span>
                <span className="text-slate-400">|</span>
                <span className="text-green-600">{test.modelB}: {test.winRate.b}%</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-500">Tie: {test.winRate.tie}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full flex overflow-hidden">
                <div 
                  className="bg-blue-500 h-full" 
                  style={{ width: `${test.winRate.a}%` }} 
                />
                <div 
                  className="bg-green-500 h-full" 
                  style={{ width: `${test.winRate.b}%` }} 
                />
                <div 
                  className="bg-slate-300 h-full" 
                  style={{ width: `${test.winRate.tie}%` }} 
                />
              </div>
            </div>

            {/* Test Results (when running this test) */}
            {results && isRunning === null && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Latest Results</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-blue-800">{test.modelA}</span>
                      <span className="text-xs text-blue-600">{results.modelA.latency}ms</span>
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-4">
                      {results.modelA.content}
                    </p>
                    <button
                      onClick={() => recordRating(test.id, 'a')}
                      className="mt-3 w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                    >
                      Select as Winner
                    </button>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-green-800">{test.modelB}</span>
                      <span className="text-xs text-green-600">{results.modelB.latency}ms</span>
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-4">
                      {results.modelB.content}
                    </p>
                    <button
                      onClick={() => recordRating(test.id, 'b')}
                      className="mt-3 w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                    >
                      Select as Winner
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => recordRating(test.id, 'tie')}
                  className="mt-3 w-full py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors text-sm"
                >
                  Mark as Tie
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
