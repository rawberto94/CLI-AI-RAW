/**
 * Thinking Mode Display Component
 * Shows AI reasoning steps, agent thoughts, and decision-making process in real-time
 * 
 * Features:
 * - Collapsible thinking sections
 * - Step-by-step reasoning visualization
 * - Tool usage indicators
 * - Confidence meters
 * - Self-critique feedback display
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  ChevronDown, 
  ChevronUp, 
  Wrench,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2,
  Zap,
  Target,
  Scale,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface ThinkingStep {
  id: string;
  type: 'thought' | 'action' | 'observation' | 'critique' | 'revision' | 'decision' | 'tool_call' | 'debate_turn';
  content: string;
  timestamp: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  metadata?: {
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: unknown;
    confidence?: number;
    agentId?: string;
    agentRole?: string;
    critiqueScore?: number;
    reasoning?: string;
  };
}

export interface DebateTurn {
  agentId: string;
  agentRole: string;
  position: string;
  argument: string;
  evidence?: string[];
  confidence: number;
}

export interface ThinkingModeDisplayProps {
  steps: ThinkingStep[];
  isThinking: boolean;
  showByDefault?: boolean;
  onToggle?: (visible: boolean) => void;
  className?: string;
  variant?: 'compact' | 'expanded' | 'inline';
  maxVisibleSteps?: number;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StepIcon: React.FC<{ type: ThinkingStep['type']; status: ThinkingStep['status'] }> = ({ type, status }) => {
  if (status === 'in_progress') {
    return <Loader2 className="h-4 w-4 animate-spin text-violet-500" />;
  }
  
  const icons: Record<ThinkingStep['type'], React.ReactNode> = {
    thought: <Brain className="h-4 w-4 text-violet-500" />,
    action: <Zap className="h-4 w-4 text-yellow-500" />,
    observation: <Eye className="h-4 w-4 text-violet-500" />,
    critique: <Scale className="h-4 w-4 text-orange-500" />,
    revision: <RefreshCw className="h-4 w-4 text-green-500" />,
    decision: <Target className="h-4 w-4 text-violet-500" />,
    tool_call: <Wrench className="h-4 w-4 text-gray-500 dark:text-slate-400" />,
    debate_turn: <Users className="h-4 w-4 text-violet-500" />,
  };
  
  return <>{icons[type]}</>;
};

const ConfidenceMeter: React.FC<{ confidence: number }> = ({ confidence }) => {
  const percentage = Math.round(confidence * 100);
  const color = confidence >= 0.8 ? 'bg-green-500' : confidence >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div 
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-slate-400">{percentage}%</span>
    </div>
  );
};

const ToolCallDisplay: React.FC<{ 
  toolName: string; 
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  status: ThinkingStep['status'];
}> = ({ toolName, toolInput, toolOutput, status }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="mt-2 bg-gray-50 dark:bg-gray-900 rounded-md p-2 text-xs font-mono">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Wrench className="h-3 w-3" />
          <span className="font-semibold">{toolName}</span>
          {status === 'in_progress' && <Loader2 className="h-3 w-3 animate-spin" />}
          {status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
          {status === 'error' && <XCircle className="h-3 w-3 text-red-500" />}
        </div>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 space-y-2 overflow-hidden"
          >
            {toolInput && (
              <div>
                <span className="text-gray-500 dark:text-slate-400">Input:</span>
                <pre className="mt-1 p-1 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                  {JSON.stringify(toolInput, null, 2)}
                </pre>
              </div>
            )}
            {toolOutput && (
              <div>
                <span className="text-gray-500 dark:text-slate-400">Output:</span>
                <pre className="mt-1 p-1 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto max-h-32">
                  {typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput, null, 2)}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CritiqueDisplay: React.FC<{ 
  score: number; 
  content: string;
  reasoning?: string;
}> = ({ score, content, reasoning }) => {
  const scoreColor = score >= 0.8 ? 'text-green-500' : score >= 0.5 ? 'text-yellow-500' : 'text-red-500';
  const scoreLabel = score >= 0.8 ? 'Excellent' : score >= 0.5 ? 'Acceptable' : 'Needs Improvement';
  
  return (
    <div className="mt-2 border-l-2 border-orange-300 pl-3">
      <div className="flex items-center gap-2 mb-1">
        <Scale className="h-4 w-4 text-orange-500" />
        <span className={cn("font-medium", scoreColor)}>{scoreLabel}</span>
        <span className="text-xs text-gray-500 dark:text-slate-400">({Math.round(score * 100)}%)</span>
      </div>
      <p className="text-sm text-gray-600 dark:text-slate-400 dark:text-gray-300">{content}</p>
      {reasoning && (
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 italic">{reasoning}</p>
      )}
    </div>
  );
};

const DebateTurnDisplay: React.FC<{ turn: DebateTurn }> = ({ turn }) => {
  const roleColors: Record<string, string> = {
    'risk_analyst': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    'opportunity_advocate': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'financial_expert': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    'legal_counsel': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    'moderator': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  };
  
  const colorClass = roleColors[turn.agentRole] || roleColors.moderator;
  
  return (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", colorClass)}>
            {turn.agentRole.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        </div>
        <ConfidenceMeter confidence={turn.confidence} />
      </div>
      <p className="text-sm font-medium mb-1">{turn.position}</p>
      <p className="text-sm text-gray-600 dark:text-slate-400 dark:text-gray-300">{turn.argument}</p>
      {turn.evidence && turn.evidence.length > 0 && (
        <div className="mt-2">
          <span className="text-xs text-gray-500 dark:text-slate-400">Evidence:</span>
          <ul className="list-disc list-inside text-xs text-gray-500 dark:text-slate-400 mt-1">
            {turn.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ThinkingModeDisplay: React.FC<ThinkingModeDisplayProps> = ({
  steps,
  isThinking,
  showByDefault = false,
  onToggle,
  className,
  variant = 'expanded',
  maxVisibleSteps = 10,
}) => {
  const [isVisible, setIsVisible] = useState(showByDefault);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to latest step
  useEffect(() => {
    if (scrollRef.current && isThinking) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps, isThinking]);
  
  const toggleVisibility = () => {
    const newVisible = !isVisible;
    setIsVisible(newVisible);
    onToggle?.(newVisible);
  };
  
  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };
  
  const visibleSteps = steps.slice(-maxVisibleSteps);
  const hiddenCount = Math.max(0, steps.length - maxVisibleSteps);
  
  // Compact inline variant
  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        {isThinking && (
          <motion.div 
            className="flex items-center gap-1 text-violet-500"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Brain className="h-4 w-4" />
            <span>Thinking...</span>
          </motion.div>
        )}
        {steps.length > 0 && (
          <span className="text-gray-500 dark:text-slate-400">
            ({steps.length} reasoning step{steps.length !== 1 ? 's' : ''})
          </span>
        )}
      </div>
    );
  }
  
  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={cn("bg-gray-50 dark:bg-gray-900 rounded-lg p-2", className)}>
        <button
          onClick={toggleVisibility}
          className="flex items-center gap-2 w-full text-sm text-gray-600 dark:text-slate-400 dark:text-gray-300 hover:text-gray-900 dark:text-slate-100 dark:hover:text-gray-100"
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <Brain className="h-4 w-4 text-violet-500" />
          <span className="font-medium">AI Reasoning</span>
          {isThinking && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
          {!isThinking && steps.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </span>
          )}
        </button>
        
        <AnimatePresence>
          {isVisible && (
            <motion.div key="visible"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto text-xs">
                {visibleSteps.map((step) => (
                  <div 
                    key={step.id}
                    className="flex items-start gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <StepIcon type={step.type} status={step.status} />
                    <span className="text-gray-600 dark:text-slate-400 dark:text-gray-300 line-clamp-2">
                      {step.content}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  
  // Expanded variant (default)
  return (
    <div className={cn(
      "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-gray-900 dark:to-gray-800",
      "border border-violet-200 dark:border-violet-900",
      "rounded-xl shadow-sm overflow-hidden",
      className
    )}>
      {/* Header */}
      <button
        onClick={toggleVisibility}
        className="flex items-center gap-3 w-full p-4 text-left hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/50">
          <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 dark:text-gray-100">
            AI Thinking Process
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 dark:text-gray-400">
            {isThinking ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Reasoning in progress...
              </span>
            ) : (
              `${steps.length} reasoning step${steps.length !== 1 ? 's' : ''} completed`
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isVisible ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>
      
      {/* Content */}
      <AnimatePresence>
        {isVisible && (
          <motion.div key="visible"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div 
              ref={scrollRef}
              className="px-4 pb-4 max-h-96 overflow-y-auto"
            >
              {hiddenCount > 0 && (
                <div className="text-center text-sm text-gray-500 dark:text-slate-400 py-2 border-b border-gray-200 dark:border-gray-700 mb-3">
                  {hiddenCount} earlier step{hiddenCount !== 1 ? 's' : ''} hidden
                </div>
              )}
              
              <div className="space-y-3">
                {visibleSteps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "relative pl-8 pb-3",
                      index !== visibleSteps.length - 1 && "border-l-2 border-gray-200 dark:border-gray-700"
                    )}
                  >
                    {/* Step indicator */}
                    <div className="absolute left-0 top-0 -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                      <StepIcon type={step.type} status={step.status} />
                    </div>
                    
                    {/* Step content */}
                    <div 
                      className={cn(
                        "bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm cursor-pointer",
                        "hover:shadow-md transition-shadow",
                        step.status === 'in_progress' && "ring-2 ring-violet-300 dark:ring-violet-700"
                      )}
                      onClick={() => toggleStepExpansion(step.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium uppercase text-gray-400">
                              {step.type.replace(/_/g, ' ')}
                            </span>
                            {step.metadata?.confidence && (
                              <ConfidenceMeter confidence={step.metadata.confidence} />
                            )}
                          </div>
                          <p className={cn(
                            "text-sm text-gray-700 dark:text-slate-300 dark:text-gray-200",
                            !expandedSteps.has(step.id) && "line-clamp-2"
                          )}>
                            {step.content}
                          </p>
                        </div>
                        {step.status === 'in_progress' && (
                          <Loader2 className="h-4 w-4 animate-spin text-violet-500 flex-shrink-0" />
                        )}
                        {step.status === 'completed' && (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                        {step.status === 'error' && (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                      
                      {/* Tool call display */}
                      {step.type === 'tool_call' && step.metadata?.toolName && (
                        <ToolCallDisplay
                          toolName={step.metadata.toolName}
                          toolInput={step.metadata.toolInput}
                          toolOutput={step.metadata.toolOutput}
                          status={step.status}
                        />
                      )}
                      
                      {/* Critique display */}
                      {step.type === 'critique' && step.metadata?.critiqueScore !== undefined && (
                        <CritiqueDisplay
                          score={step.metadata.critiqueScore}
                          content={step.content}
                          reasoning={step.metadata.reasoning}
                        />
                      )}
                      
                      {/* Debate turn display */}
                      {step.type === 'debate_turn' && step.metadata?.agentRole && (
                        <DebateTurnDisplay
                          turn={{
                            agentId: step.metadata.agentId || 'unknown',
                            agentRole: step.metadata.agentRole,
                            position: step.content.split('\n')[0] || '',
                            argument: step.content.split('\n').slice(1).join('\n'),
                            confidence: step.metadata.confidence || 0.5,
                          }}
                        />
                      )}
                      
                      {/* Timestamp */}
                      <div className="mt-2 text-xs text-gray-400">
                        {step.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {/* Thinking indicator */}
                {isThinking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 pl-8 text-sm text-violet-500"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </motion.div>
                    <span>Processing...</span>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// HOOK FOR MANAGING THINKING STEPS
// ============================================================================

export interface UseThinkingModeReturn {
  steps: ThinkingStep[];
  isThinking: boolean;
  addStep: (step: Omit<ThinkingStep, 'id' | 'timestamp'>) => string;
  updateStep: (id: string, updates: Partial<ThinkingStep>) => void;
  completeStep: (id: string) => void;
  failStep: (id: string) => void;
  startThinking: () => void;
  stopThinking: () => void;
  reset: () => void;
}

export function useThinkingMode(): UseThinkingModeReturn {
  const [steps, setSteps] = useState<ThinkingStep[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  
  const addStep = (step: Omit<ThinkingStep, 'id' | 'timestamp'>): string => {
    const id = `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newStep: ThinkingStep = {
      ...step,
      id,
      timestamp: new Date(),
    };
    setSteps(prev => [...prev, newStep]);
    return id;
  };
  
  const updateStep = (id: string, updates: Partial<ThinkingStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, ...updates } : step
    ));
  };
  
  const completeStep = (id: string) => {
    updateStep(id, { status: 'completed' });
  };
  
  const failStep = (id: string) => {
    updateStep(id, { status: 'error' });
  };
  
  const startThinking = () => setIsThinking(true);
  const stopThinking = () => setIsThinking(false);
  
  const reset = () => {
    setSteps([]);
    setIsThinking(false);
  };
  
  return {
    steps,
    isThinking,
    addStep,
    updateStep,
    completeStep,
    failStep,
    startThinking,
    stopThinking,
    reset,
  };
}

export default ThinkingModeDisplay;
