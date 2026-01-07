'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Settings2,
  Brain,
  Zap,
  Shield,
  Clock,
  FileText,
  Sparkles,
  AlertTriangle,
  DollarSign,
  Users,
  Calendar,
  FileEdit,
  ChevronRight,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

export interface ProcessingOptions {
  aiModel: 'gpt-4o' | 'gpt-4o-mini' | 'auto';
  processingMode: 'standard' | 'thorough' | 'quick';
  concurrency: number;
  enabledArtifacts: string[];
  enableRagIndexing: boolean;
  enableRateCardExtraction: boolean;
  enableDuplicateDetection: boolean;
  prioritizeRiskAnalysis: boolean;
  customPromptHints?: string;
}

export interface ProcessingConfigProps {
  options: ProcessingOptions;
  onChange: (options: ProcessingOptions) => void;
  disabled?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const AI_MODELS = [
  { 
    id: 'gpt-4o', 
    name: 'GPT-4o', 
    description: 'Most accurate, best for complex contracts',
    badge: 'Recommended',
    badgeColor: 'bg-green-100 text-green-700'
  },
  { 
    id: 'gpt-4o-mini', 
    name: 'GPT-4o Mini', 
    description: 'Fast and cost-effective',
    badge: 'Fast',
    badgeColor: 'bg-blue-100 text-blue-700'
  },
  { 
    id: 'auto', 
    name: 'Auto Select', 
    description: 'Automatically choose based on document complexity',
    badge: 'Smart',
    badgeColor: 'bg-purple-100 text-purple-700'
  },
];

const PROCESSING_MODES = [
  {
    id: 'quick',
    name: 'Quick',
    description: 'Basic extraction, 5-10 seconds',
    icon: <Zap className="h-4 w-4" />,
    artifacts: 4,
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Full analysis, 15-30 seconds',
    icon: <Clock className="h-4 w-4" />,
    artifacts: 10,
  },
  {
    id: 'thorough',
    name: 'Thorough',
    description: 'Deep analysis with validation, 45-60 seconds',
    icon: <Shield className="h-4 w-4" />,
    artifacts: 10,
    extra: 'Multi-pass validation',
  },
];

const ARTIFACT_TYPES = [
  { id: 'OVERVIEW', name: 'Overview', icon: <FileText className="h-4 w-4" />, required: true },
  { id: 'CLAUSES', name: 'Key Clauses', icon: <FileEdit className="h-4 w-4" /> },
  { id: 'FINANCIAL', name: 'Financial Analysis', icon: <DollarSign className="h-4 w-4" /> },
  { id: 'RISK', name: 'Risk Assessment', icon: <AlertTriangle className="h-4 w-4" /> },
  { id: 'COMPLIANCE', name: 'Compliance Check', icon: <Shield className="h-4 w-4" /> },
  { id: 'OBLIGATIONS', name: 'Obligations', icon: <FileEdit className="h-4 w-4" /> },
  { id: 'RENEWAL', name: 'Renewal Terms', icon: <Calendar className="h-4 w-4" /> },
  { id: 'NEGOTIATION_POINTS', name: 'Negotiation Points', icon: <Users className="h-4 w-4" /> },
  { id: 'AMENDMENTS', name: 'Amendments', icon: <FileEdit className="h-4 w-4" /> },
  { id: 'CONTACTS', name: 'Contacts', icon: <Users className="h-4 w-4" /> },
];

// ============================================================================
// Main Component
// ============================================================================

export function ProcessingConfig({ options, onChange, disabled }: ProcessingConfigProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateOption = <K extends keyof ProcessingOptions>(
    key: K,
    value: ProcessingOptions[K]
  ) => {
    onChange({ ...options, [key]: value });
  };

  const toggleArtifact = (artifactId: string) => {
    const artifact = ARTIFACT_TYPES.find(a => a.id === artifactId);
    if (artifact?.required) return; // Can't disable required artifacts
    
    const newArtifacts = options.enabledArtifacts.includes(artifactId)
      ? options.enabledArtifacts.filter(a => a !== artifactId)
      : [...options.enabledArtifacts, artifactId];
    
    updateOption('enabledArtifacts', newArtifacts);
  };

  const selectedModel = AI_MODELS.find(m => m.id === options.aiModel);
  const selectedMode = PROCESSING_MODES.find(m => m.id === options.processingMode);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Settings2 className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <CardTitle className="text-base">Processing Settings</CardTitle>
              <CardDescription className="text-xs">
                {selectedMode?.name} mode with {selectedModel?.name}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            disabled={disabled}
          >
            {isExpanded ? 'Collapse' : 'Configure'}
            <ChevronRight className={cn(
              'h-4 w-4 ml-1 transition-transform',
              isExpanded && 'rotate-90'
            )} />
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <Accordion type="single" collapsible className="w-full" defaultValue="model">
            {/* AI Model Selection */}
            <AccordionItem value="model">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  AI Model
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {AI_MODELS.map(model => (
                    <button
                      key={model.id}
                      onClick={() => updateOption('aiModel', model.id as ProcessingOptions['aiModel'])}
                      disabled={disabled}
                      className={cn(
                        'w-full p-3 rounded-lg border text-left transition-all',
                        options.aiModel === model.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{model.name}</span>
                        <Badge className={model.badgeColor}>{model.badge}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{model.description}</p>
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Processing Mode */}
            <AccordionItem value="mode">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-600" />
                  Processing Mode
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-3 gap-2">
                  {PROCESSING_MODES.map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => updateOption('processingMode', mode.id as ProcessingOptions['processingMode'])}
                      disabled={disabled}
                      className={cn(
                        'p-3 rounded-lg border text-center transition-all',
                        options.processingMode === mode.id
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className="flex justify-center mb-2 text-amber-600">
                        {mode.icon}
                      </div>
                      <span className="font-medium text-sm block">{mode.name}</span>
                      <p className="text-[10px] text-slate-500 mt-1">{mode.description}</p>
                      {mode.extra && (
                        <Badge variant="outline" className="mt-2 text-[10px]">
                          {mode.extra}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Concurrency */}
            <AccordionItem value="concurrency">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Parallel Processing
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Files processed simultaneously</Label>
                    <Badge variant="secondary">{options.concurrency}</Badge>
                  </div>
                  <Slider
                    value={[options.concurrency]}
                    onValueChange={([value]) => updateOption('concurrency', value)}
                    min={1}
                    max={5}
                    step={1}
                    disabled={disabled}
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500">
                    Higher values process faster but may impact quality on complex documents.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Artifact Selection */}
            <AccordionItem value="artifacts">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-600" />
                  Generated Artifacts ({options.enabledArtifacts.length}/{ARTIFACT_TYPES.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-2">
                  {ARTIFACT_TYPES.map(artifact => {
                    const isEnabled = options.enabledArtifacts.includes(artifact.id);
                    return (
                      <button
                        key={artifact.id}
                        onClick={() => toggleArtifact(artifact.id)}
                        disabled={disabled || artifact.required}
                        className={cn(
                          'p-2 rounded-lg border text-left text-sm transition-all flex items-center gap-2',
                          isEnabled
                            ? 'border-green-500 bg-green-50'
                            : 'border-slate-200 hover:border-slate-300',
                          artifact.required && 'cursor-not-allowed opacity-75'
                        )}
                      >
                        <div className={cn(
                          'p-1.5 rounded',
                          isEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'
                        )}>
                          {artifact.icon}
                        </div>
                        <span className={cn(
                          'flex-1',
                          isEnabled ? 'text-green-700' : 'text-slate-600'
                        )}>
                          {artifact.name}
                        </span>
                        {artifact.required && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex">
                                  <Info className="h-3 w-3 text-slate-400" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Required artifact</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </button>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Advanced Options */}
            <AccordionItem value="advanced">
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-slate-600" />
                  Advanced Options
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">RAG Indexing</Label>
                      <p className="text-xs text-slate-500">Enable semantic search</p>
                    </div>
                    <Switch
                      checked={options.enableRagIndexing}
                      onCheckedChange={(checked) => updateOption('enableRagIndexing', checked)}
                      disabled={disabled}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Rate Card Extraction</Label>
                      <p className="text-xs text-slate-500">Extract pricing tables</p>
                    </div>
                    <Switch
                      checked={options.enableRateCardExtraction}
                      onCheckedChange={(checked) => updateOption('enableRateCardExtraction', checked)}
                      disabled={disabled}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Duplicate Detection</Label>
                      <p className="text-xs text-slate-500">Check for existing copies</p>
                    </div>
                    <Switch
                      checked={options.enableDuplicateDetection}
                      onCheckedChange={(checked) => updateOption('enableDuplicateDetection', checked)}
                      disabled={disabled}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Priority Risk Analysis</Label>
                      <p className="text-xs text-slate-500">Generate risk report first</p>
                    </div>
                    <Switch
                      checked={options.prioritizeRiskAnalysis}
                      onCheckedChange={(checked) => updateOption('prioritizeRiskAnalysis', checked)}
                      disabled={disabled}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      )}
    </Card>
  );
}

export default ProcessingConfig;
