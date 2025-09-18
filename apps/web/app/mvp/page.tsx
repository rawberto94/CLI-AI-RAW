"use client";

import React, { useState } from 'react';
import { 
  Sparkles, 
  Brain, 
  TrendingUp, 
  Zap, 
  ArrowRight,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Import MVP components
import { EnhancedContractDashboard } from '@/components/mvp/EnhancedContractDashboard';
import { RealTimeProgressTracker } from '@/components/mvp/RealTimeProgressTracker';
import { SmartContractComparison } from '@/components/mvp/SmartContractComparison';
import { NaturalLanguageQuery } from '@/components/mvp/NaturalLanguageQuery';

export default function MVPShowcase() {
  const [demoMode, setDemoMode] = useState<'auto' | 'manual'>('manual');
  const [currentDemo, setCurrentDemo] = useState(0);

  const demoScenarios = [
    {
      id: 'dashboard',
      title: 'Executive Dashboard',
      description: 'Real-time portfolio overview with AI insights',
      component: <EnhancedContractDashboard />,
      highlights: [
        'Live contract metrics and KPIs',
        'Risk distribution visualization', 
        'Recent activity tracking',
        'Quick action shortcuts'
      ]
    },
    {
      id: 'analysis',
      title: 'Real-Time AI Analysis',
      description: 'Watch AI process contracts in real-time',
      component: <RealTimeProgressTracker />,
      highlights: [
        'Live analysis pipeline visualization',
        'Stage-by-stage progress tracking',
        'AI insights generation',
        'Processing queue management'
      ]
    },
    {
      id: 'comparison',
      title: 'AI Contract Comparison',
      description: 'Intelligent contract comparison and recommendations',
      component: <SmartContractComparison />,
      highlights: [
        'Side-by-side contract analysis',
        'AI-powered similarity scoring',
        'Risk and financial comparison',
        'Automated recommendations'
      ]
    },
    {
      id: 'query',
      title: 'Natural Language Queries',
      description: 'Ask your contracts anything in plain English',
      component: <NaturalLanguageQuery />,
      highlights: [
        'Natural language processing',
        'Intelligent query understanding',
        'Visual data responses',
        'Source attribution'
      ]
    }
  ];

  const nextDemo = () => {
    setCurrentDemo((prev) => (prev + 1) % demoScenarios.length);
  };

  const prevDemo = () => {
    setCurrentDemo((prev) => (prev - 1 + demoScenarios.length) % demoScenarios.length);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-8 h-8" />
              <h1 className="text-4xl md:text-6xl font-bold">
                Contract Intelligence MVP
              </h1>
            </div>
            <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl mx-auto">
              Revolutionary AI-powered contract management that transforms how your company handles contracts
            </p>
            <div className="flex items-center justify-center gap-4 mb-8">
              <Badge className="bg-white/20 text-white text-lg px-4 py-2">
                <Brain className="w-5 h-5 mr-2" />
                AI-Powered
              </Badge>
              <Badge className="bg-white/20 text-white text-lg px-4 py-2">
                <Zap className="w-5 h-5 mr-2" />
                Real-Time
              </Badge>
              <Badge className="bg-white/20 text-white text-lg px-4 py-2">
                <TrendingUp className="w-5 h-5 mr-2" />
                Intelligent
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Navigation */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-600" />
                Interactive Demo
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevDemo}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  {currentDemo + 1} of {demoScenarios.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextDemo}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {demoScenarios.map((scenario, index) => (
                <button
                  key={scenario.id}
                  onClick={() => setCurrentDemo(index)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    currentDemo === index
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <h3 className={`font-medium mb-2 ${
                    currentDemo === index ? 'text-blue-900' : 'text-gray-900'
                  }`}>
                    {scenario.title}
                  </h3>
                  <p className={`text-sm ${
                    currentDemo === index ? 'text-blue-700' : 'text-gray-600'
                  }`}>
                    {scenario.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Current Demo Highlights */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                {demoScenarios[currentDemo].title} - Key Features:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {demoScenarios[currentDemo].highlights.map((highlight, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demo Content */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {demoScenarios[currentDemo].component}
        </div>

        {/* Value Proposition */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">10x Faster Analysis</h3>
              <p className="text-gray-600">
                AI processes contracts in minutes, not hours. Automated analysis pipeline delivers insights instantly.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Brain className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">AI-Powered Insights</h3>
              <p className="text-gray-600">
                Advanced language models provide expert-level analysis and recommendations for every contract.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Predictive Analytics</h3>
              <p className="text-gray-600">
                Identify risks before they become problems. Predictive models forecast issues and opportunities.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Business Impact */}
        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Business Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-2">95%</div>
                <div className="text-sm text-gray-600">Risk Detection Accuracy</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 mb-2">$2.4M</div>
                <div className="text-sm text-gray-600">Average Cost Savings</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-2">75%</div>
                <div className="text-sm text-gray-600">Time Reduction</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-orange-600 mb-2">99.9%</div>
                <div className="text-sm text-gray-600">Compliance Score</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="mt-12 text-center">
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Contract Management?</h2>
              <p className="text-xl text-blue-100 mb-6">
                Join the AI revolution in contract intelligence. See the difference advanced AI can make.
              </p>
              <div className="flex items-center justify-center gap-4">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                  Schedule Demo
                </Button>
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  Learn More
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}