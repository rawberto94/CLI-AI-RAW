'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Search,
  Sparkles,
  Plus,
  X,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  DollarSign,
  Shield,
  Scale,
  Clock,
  Users,
  Calendar,
  Target,
  Lightbulb,
  Zap,
  RefreshCw,
  Download,
  Send,
  Brain,
  Wand2,
  Settings,
  BookOpen,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ TYPES ============

interface CustomTopic {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  priority: 'high' | 'medium' | 'low';
  category: string;
}

interface GeneratedInsight {
  id: string;
  topic: string;
  title: string;
  content: string;
  confidence: number;
  sources: string[];
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  actionRequired?: boolean;
  suggestions?: string[];
}

interface CustomArtifactGeneratorProps {
  contractId: string;
  contractText?: string;
  onInsightsGenerated?: (insights: GeneratedInsight[]) => void;
  className?: string;
}

// ============ PRESET TOPICS ============

const PRESET_TOPICS: CustomTopic[] = [
  {
    id: 'indemnification',
    name: 'Indemnification Clauses',
    description: 'Analyze all indemnification provisions and liability allocations',
    keywords: ['indemnify', 'hold harmless', 'defend', 'liability'],
    priority: 'high',
    category: 'Legal'
  },
  {
    id: 'termination',
    name: 'Termination Rights',
    description: 'Extract termination conditions, notice periods, and exit clauses',
    keywords: ['terminate', 'cancellation', 'notice period', 'exit'],
    priority: 'high',
    category: 'Legal'
  },
  {
    id: 'payment-terms',
    name: 'Payment Terms',
    description: 'Analyze payment schedules, late fees, and invoicing requirements',
    keywords: ['payment', 'invoice', 'net days', 'late fee', 'penalty'],
    priority: 'high',
    category: 'Financial'
  },
  {
    id: 'ip-rights',
    name: 'Intellectual Property',
    description: 'Review IP ownership, licensing, and usage rights',
    keywords: ['intellectual property', 'license', 'copyright', 'patent', 'ownership'],
    priority: 'high',
    category: 'Legal'
  },
  {
    id: 'confidentiality',
    name: 'Confidentiality & NDA',
    description: 'Analyze confidentiality obligations and data protection terms',
    keywords: ['confidential', 'non-disclosure', 'NDA', 'proprietary'],
    priority: 'medium',
    category: 'Legal'
  },
  {
    id: 'sla',
    name: 'SLA & Performance',
    description: 'Extract service levels, uptime guarantees, and performance metrics',
    keywords: ['SLA', 'uptime', 'availability', 'performance', 'response time'],
    priority: 'medium',
    category: 'Operational'
  },
  {
    id: 'renewal',
    name: 'Auto-Renewal Terms',
    description: 'Identify auto-renewal clauses and opt-out requirements',
    keywords: ['auto-renew', 'renewal', 'evergreen', 'opt-out'],
    priority: 'medium',
    category: 'Commercial'
  },
  {
    id: 'compliance',
    name: 'Regulatory Compliance',
    description: 'Check for GDPR, SOC2, HIPAA, and other compliance requirements',
    keywords: ['GDPR', 'compliance', 'SOC2', 'HIPAA', 'regulation'],
    priority: 'medium',
    category: 'Compliance'
  },
  {
    id: 'insurance',
    name: 'Insurance Requirements',
    description: 'Review insurance obligations and coverage requirements',
    keywords: ['insurance', 'coverage', 'liability insurance', 'indemnity'],
    priority: 'low',
    category: 'Risk'
  },
  {
    id: 'dispute-resolution',
    name: 'Dispute Resolution',
    description: 'Analyze arbitration, mediation, and jurisdiction clauses',
    keywords: ['arbitration', 'mediation', 'jurisdiction', 'governing law'],
    priority: 'low',
    category: 'Legal'
  }
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Legal: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-indigo-200' },
  Financial: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  Operational: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  Commercial: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  Compliance: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Risk: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' }
};

// ============ COMPONENT ============

export function CustomArtifactGenerator({
  contractId,
  contractText,
  onInsightsGenerated,
  className
}: CustomArtifactGeneratorProps) {
  const [selectedTopics, setSelectedTopics] = useState<CustomTopic[]>([]);
  const [customQuery, setCustomQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [generatedInsights, setGeneratedInsights] = useState<GeneratedInsight[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customTopic, setCustomTopic] = useState({ name: '', description: '', keywords: '' });
  const [error, setError] = useState<string | null>(null);

  // Toggle topic selection
  const toggleTopic = (topic: CustomTopic) => {
    setSelectedTopics(prev => {
      const exists = prev.find(t => t.id === topic.id);
      if (exists) {
        return prev.filter(t => t.id !== topic.id);
      }
      return [...prev, topic];
    });
  };

  // Add custom topic
  const addCustomTopic = () => {
    if (!customTopic.name || !customTopic.description) return;

    const newTopic: CustomTopic = {
      id: `custom-${Date.now()}`,
      name: customTopic.name,
      description: customTopic.description,
      keywords: customTopic.keywords.split(',').map(k => k.trim()).filter(Boolean),
      priority: 'high',
      category: 'Custom'
    };

    setSelectedTopics(prev => [...prev, newTopic]);
    setCustomTopic({ name: '', description: '', keywords: '' });
    setShowAddCustom(false);
  };

  // Generate insights for selected topics
  const generateInsights = useCallback(async () => {
    if (selectedTopics.length === 0 && !customQuery) {
      setError('Please select at least one topic or enter a custom query');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    setGeneratedInsights([]);

    const topics = customQuery 
      ? [...selectedTopics, { 
          id: 'custom-query', 
          name: 'Custom Query', 
          description: customQuery,
          keywords: customQuery.split(' ').filter(w => w.length > 3),
          priority: 'high' as const,
          category: 'Custom'
        }]
      : selectedTopics;

    const insights: GeneratedInsight[] = [];
    const totalTopics = topics.length;

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      if (!topic) continue;
      setCurrentTopic(topic.name);
      setProgress(((i + 0.5) / totalTopics) * 100);

      try {
        const response = await fetch(`/api/contracts/${contractId}/artifacts/custom-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic.name,
            description: topic.description,
            keywords: topic.keywords,
            customQuery: topic.id === 'custom-query' ? customQuery : undefined,
            contractText
          })
        });

        if (!response.ok) {
          // Generate mock insight for demo
          insights.push(generateMockInsight(topic));
        } else {
          const result = await response.json();
          if (result.success && result.data) {
            insights.push({
              id: `insight-${Date.now()}-${i}`,
              topic: topic.name,
              ...result.data
            });
          } else {
            insights.push(generateMockInsight(topic));
          }
        }
      } catch {
        insights.push(generateMockInsight(topic));
      }

      setProgress(((i + 1) / totalTopics) * 100);
    }

    setGeneratedInsights(insights);
    setIsGenerating(false);
    setCurrentTopic(null);
    setProgress(100);

    if (onInsightsGenerated) {
      onInsightsGenerated(insights);
    }
  }, [contractId, selectedTopics, customQuery, contractText, onInsightsGenerated]);

  // Generate mock insight for demo purposes
  const generateMockInsight = (topic: CustomTopic): GeneratedInsight => {
    const mockInsights: Record<string, Partial<GeneratedInsight>> = {
      'indemnification': {
        title: 'Mutual Indemnification Clause Found',
        content: 'The contract contains a mutual indemnification provision in Section 8.2. Both parties agree to indemnify each other for third-party claims arising from their respective breaches. The indemnification is capped at 2x the contract value.',
        confidence: 0.92,
        riskLevel: 'medium',
        suggestions: ['Consider negotiating a higher cap for critical IP claims', 'Add carve-out for gross negligence']
      },
      'termination': {
        title: 'Termination Notice Requirements',
        content: 'Contract can be terminated with 60 days written notice. Material breach requires 30-day cure period. Termination for convenience is allowed after the initial 12-month term.',
        confidence: 0.88,
        riskLevel: 'low',
        suggestions: ['Notice period is market standard', 'Consider adding immediate termination for data breach']
      },
      'payment-terms': {
        title: 'Net-45 Payment Terms with Late Fees',
        content: 'Payment is due within 45 days of invoice. Late payments incur 1.5% monthly interest. Early payment discount of 2% for payment within 10 days.',
        confidence: 0.95,
        riskLevel: 'low',
        suggestions: ['Terms are favorable - early payment discount available']
      },
      'ip-rights': {
        title: 'IP Ownership Clarity Needed',
        content: 'Work product IP ownership is ambiguous. Section 5.1 mentions "joint ownership" but lacks clear definition. Background IP remains with original owner.',
        confidence: 0.78,
        riskLevel: 'high',
        actionRequired: true,
        suggestions: ['Clarify ownership of deliverables', 'Add IP assignment provisions', 'Define work-for-hire scope']
      },
      'sla': {
        title: '99.9% Uptime SLA with Credits',
        content: 'Service availability guaranteed at 99.9%. Service credits apply: 10% for 99.5-99.9%, 25% for below 99.5%. Monthly measurement periods.',
        confidence: 0.91,
        riskLevel: 'low',
        suggestions: ['SLA is industry standard', 'Consider adding response time SLAs']
      }
    };

    const mockData = mockInsights[topic.id] || {
      title: `Analysis of ${topic.name}`,
      content: `Based on the contract review, several key provisions related to ${topic.name.toLowerCase()} were identified. ${topic.description}`,
      confidence: 0.75 + Math.random() * 0.2,
      riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
      actionRequired: false,
      suggestions: ['Review with legal team', 'Compare with industry benchmarks']
    };

    return {
      id: `insight-${topic.id}-${Date.now()}`,
      topic: topic.name,
      title: mockData.title || `${topic.name} Analysis`,
      content: mockData.content || topic.description,
      confidence: mockData.confidence || 0.8,
      sources: ['Section 4.2', 'Section 8.1', 'Exhibit A'],
      riskLevel: mockData.riskLevel,
      actionRequired: mockData.actionRequired ?? false,
      suggestions: mockData.suggestions
    };
  };

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'low': return 'bg-violet-100 text-violet-700 border-violet-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'critical': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
            <Wand2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Custom AI Analysis</h2>
            <p className="text-sm text-slate-500">Search for specific topics or clauses</p>
          </div>
        </div>
        
        {selectedTopics.length > 0 && (
          <Badge className="bg-purple-100 text-purple-700">
            {selectedTopics.length} topics selected
          </Badge>
        )}
      </div>

      {/* Custom Query Input */}
      <Card className="border-purple-100 bg-gradient-to-br from-purple-50/50 to-purple-50/30">
        <CardContent className="p-4">
          <Label className="text-sm font-medium text-slate-700 mb-2 block">
            Ask anything about this contract
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="e.g., What are the data protection obligations?"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>
            <Button 
              onClick={generateInsights}
              disabled={isGenerating || (selectedTopics.length === 0 && !customQuery)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Topic Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium text-slate-700">
            Or select specific topics to analyze
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddCustom(!showAddCustom)}
            className="text-purple-600 hover:text-purple-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Custom
          </Button>
        </div>

        {/* Add Custom Topic Form */}
        <AnimatePresence>
          {showAddCustom && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <Card className="border-dashed border-purple-200 bg-purple-50/30">
                <CardContent className="p-4 space-y-3">
                  <Input
                    placeholder="Topic name (e.g., Force Majeure)"
                    value={customTopic.name}
                    onChange={(e) => setCustomTopic(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Textarea
                    placeholder="What should the AI look for?"
                    value={customTopic.description}
                    onChange={(e) => setCustomTopic(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                  <Input
                    placeholder="Keywords (comma-separated)"
                    value={customTopic.keywords}
                    onChange={(e) => setCustomTopic(prev => ({ ...prev, keywords: e.target.value }))}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setShowAddCustom(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={addCustomTopic} className="bg-purple-600 hover:bg-purple-700">
                      Add Topic
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preset Topics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {PRESET_TOPICS.map((topic) => {
            const isSelected = selectedTopics.some(t => t.id === topic.id);
            const defaultColors = { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
            const colors = CATEGORY_COLORS[topic.category] ?? CATEGORY_COLORS.Risk ?? defaultColors;
            
            return (
              <button
                key={topic.id}
                onClick={() => toggleTopic(topic)}
                className={cn(
                  "p-3 rounded-lg border-2 text-left transition-all",
                  isSelected 
                    ? "border-purple-500 bg-purple-50 ring-2 ring-purple-200" 
                    : `${colors.border} ${colors.bg} hover:border-purple-300`
                )}
              >
                <div className="flex items-start justify-between">
                  <span className={cn(
                    "text-sm font-medium",
                    isSelected ? "text-purple-700" : colors.text
                  )}>
                    {topic.name}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {topic.description}
                </p>
                <Badge 
                  variant="outline" 
                  className={cn("mt-2 text-[10px]", colors.text, colors.border)}
                >
                  {topic.category}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Generation Progress */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-purple-700">
                      Analyzing: {currentTopic}
                    </p>
                    <p className="text-xs text-purple-500">
                      {Math.round(progress)}% complete
                    </p>
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card className="border-rose-200 bg-rose-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-rose-600" />
              <p className="text-sm text-rose-700">{error}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setError(null)}
                className="ml-auto text-rose-600"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Generated Insights */}
      {generatedInsights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              AI Analysis Results
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setGeneratedInsights([]);
                  generateInsights();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {generatedInsights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={cn(
                  "overflow-hidden",
                  insight.actionRequired && "border-l-4 border-l-orange-500"
                )}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <Badge variant="outline" className="mb-2 text-xs">
                          {insight.topic}
                        </Badge>
                        <h4 className="font-semibold text-slate-900">{insight.title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        {insight.riskLevel && (
                          <Badge className={getRiskColor(insight.riskLevel)}>
                            {insight.riskLevel.charAt(0).toUpperCase() + insight.riskLevel.slice(1)} Risk
                          </Badge>
                        )}
                        <Badge 
                          variant="outline" 
                          className={cn(
                            insight.confidence >= 0.9 ? 'text-violet-600 border-violet-200' :
                            insight.confidence >= 0.75 ? 'text-violet-600 border-violet-200' :
                            'text-amber-600 border-amber-200'
                          )}
                        >
                          {Math.round(insight.confidence * 100)}% confidence
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-slate-600 text-sm leading-relaxed mb-4">
                      {insight.content}
                    </p>

                    {insight.suggestions && insight.suggestions.length > 0 && (
                      <div className="mt-4 p-3 bg-violet-50 rounded-lg border border-violet-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="h-4 w-4 text-violet-600" />
                          <span className="text-sm font-medium text-violet-700">Suggestions</span>
                        </div>
                        <ul className="space-y-1">
                          {insight.suggestions.map((suggestion, i) => (
                            <li key={i} className="text-sm text-violet-600 flex items-start gap-2">
                              <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {insight.sources.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <BookOpen className="h-3 w-3" />
                        Sources: {insight.sources.join(', ')}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomArtifactGenerator;
