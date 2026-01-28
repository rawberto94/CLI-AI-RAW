/**
 * Real-time AI Cost Widget
 * 
 * Displays live token usage and cost tracking for AI chat sessions.
 * Shows per-request and cumulative session costs.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
} from "lucide-react";

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  cost: number;
}

interface SessionStats {
  totalRequests: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCost: number;
  averageTokensPerRequest: number;
  modelUsage: Record<string, { requests: number; tokens: number; cost: number }>;
}

interface AICostWidgetProps {
  sessionId?: string;
  currentUsage?: TokenUsage | null;
  dailyBudget?: number;
  onBudgetAlert?: (percentUsed: number) => void;
  compact?: boolean;
}

// Model pricing per 1K tokens (approximate)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-4": { input: 0.03, output: 0.06 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "claude-3-opus": { input: 0.015, output: 0.075 },
  "claude-3-sonnet": { input: 0.003, output: 0.015 },
  "claude-3-haiku": { input: 0.00025, output: 0.00125 },
};

export function AICostWidget({
  sessionId: _sessionId,
  currentUsage,
  dailyBudget = 1.0, // Default $1/day
  onBudgetAlert,
  compact = false,
}: AICostWidgetProps) {
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    totalRequests: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCost: 0,
    averageTokensPerRequest: 0,
    modelUsage: {},
  });
  const [isAnimating, setIsAnimating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Update session stats when new usage comes in
  useEffect(() => {
    if (currentUsage) {
      setIsAnimating(true);
      setSessionStats((prev) => {
        const newStats = {
          totalRequests: prev.totalRequests + 1,
          totalPromptTokens: prev.totalPromptTokens + currentUsage.promptTokens,
          totalCompletionTokens: prev.totalCompletionTokens + currentUsage.completionTokens,
          totalCost: prev.totalCost + currentUsage.cost,
          averageTokensPerRequest:
            (prev.totalPromptTokens +
              prev.totalCompletionTokens +
              currentUsage.totalTokens) /
            (prev.totalRequests + 1),
          modelUsage: {
            ...prev.modelUsage,
            [currentUsage.model]: {
              requests: (prev.modelUsage[currentUsage.model]?.requests || 0) + 1,
              tokens:
                (prev.modelUsage[currentUsage.model]?.tokens || 0) +
                currentUsage.totalTokens,
              cost:
                (prev.modelUsage[currentUsage.model]?.cost || 0) +
                currentUsage.cost,
            },
          },
        };

        // Check budget alert
        const percentUsed = (newStats.totalCost / dailyBudget) * 100;
        if (percentUsed >= 80 && onBudgetAlert) {
          onBudgetAlert(percentUsed);
        }

        return newStats;
      });

      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentUsage, dailyBudget, onBudgetAlert]);

  const formatCost = useCallback((cost: number) => {
    if (cost < 0.01) return `$${(cost * 100).toFixed(2)}¢`;
    return `$${cost.toFixed(4)}`;
  }, []);

  const formatTokens = useCallback((tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  }, []);

  const budgetPercentUsed = (sessionStats.totalCost / dailyBudget) * 100;
  const isBudgetWarning = budgetPercentUsed >= 80;
  const isBudgetCritical = budgetPercentUsed >= 95;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 gap-1.5 text-xs ${
                isBudgetCritical
                  ? "text-red-500"
                  : isBudgetWarning
                  ? "text-amber-500"
                  : "text-gray-500"
              }`}
            >
              <motion.div
                animate={isAnimating ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Coins className="w-3.5 h-3.5" />
              </motion.div>
              <span>{formatCost(sessionStats.totalCost)}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p className="font-medium">Session Costs</p>
              <p>Tokens: {formatTokens(sessionStats.totalPromptTokens + sessionStats.totalCompletionTokens)}</p>
              <p>Requests: {sessionStats.totalRequests}</p>
              <p>Budget: {budgetPercentUsed.toFixed(1)}% used</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={showDetails} onOpenChange={setShowDetails}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-2 text-xs border transition-colors ${
            isBudgetCritical
              ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
              : isBudgetWarning
              ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border-gray-200 hover:bg-gray-50"
          }`}
        >
          <motion.div
            animate={isAnimating ? { rotate: 360 } : {}}
            transition={{ duration: 0.5 }}
          >
            <Coins className="w-4 h-4" />
          </motion.div>
          <span className="font-medium">{formatCost(sessionStats.totalCost)}</span>
          <span className="text-gray-400">|</span>
          <Zap className="w-3.5 h-3.5" />
          <span>{formatTokens(sessionStats.totalPromptTokens + sessionStats.totalCompletionTokens)}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-white shadow-sm">
                <Coins className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Session Usage</p>
                <p className="text-xs text-gray-500">{sessionStats.totalRequests} requests</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">
                {formatCost(sessionStats.totalCost)}
              </p>
              <p className="text-xs text-gray-500">
                of {formatCost(dailyBudget)} budget
              </p>
            </div>
          </div>

          {/* Budget progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">Daily Budget</span>
              <span
                className={
                  isBudgetCritical
                    ? "text-red-600 font-medium"
                    : isBudgetWarning
                    ? "text-amber-600 font-medium"
                    : "text-gray-600"
                }
              >
                {budgetPercentUsed.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(budgetPercentUsed, 100)}
              className={`h-2 ${
                isBudgetCritical
                  ? "[&>div]:bg-red-500"
                  : isBudgetWarning
                  ? "[&>div]:bg-amber-500"
                  : "[&>div]:bg-purple-500"
              }`}
            />
          </div>
        </div>

        {/* Token breakdown */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-violet-50">
              <div className="flex items-center gap-1.5 text-violet-600 text-xs font-medium mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Input Tokens
              </div>
              <p className="text-lg font-bold text-violet-900">
                {formatTokens(sessionStats.totalPromptTokens)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium mb-1">
                <TrendingDown className="w-3.5 h-3.5" />
                Output Tokens
              </div>
              <p className="text-lg font-bold text-green-900">
                {formatTokens(sessionStats.totalCompletionTokens)}
              </p>
            </div>
          </div>

          {/* Model breakdown */}
          {Object.keys(sessionStats.modelUsage).length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">By Model</p>
              <div className="space-y-2">
                {Object.entries(sessionStats.modelUsage).map(([model, usage]) => (
                  <div
                    key={model}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        {model}
                      </Badge>
                      <span className="text-gray-500">
                        {usage.requests} req
                      </span>
                    </div>
                    <span className="font-medium text-gray-700">
                      {formatCost(usage.cost)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last request */}
          {currentUsage && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-2">Last Request</p>
              <div className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                <div>
                  <span className="text-gray-600">{currentUsage.totalTokens} tokens</span>
                  <span className="text-gray-400 mx-1">•</span>
                  <span className="font-mono text-gray-500">{currentUsage.model}</span>
                </div>
                <span className="font-medium text-purple-600">
                  {formatCost(currentUsage.cost)}
                </span>
              </div>
            </div>
          )}

          {/* Warning banner */}
          {isBudgetWarning && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-2 p-2 rounded text-xs ${
                isBudgetCritical
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>
                {isBudgetCritical
                  ? "Budget almost exhausted! Consider limiting requests."
                  : "Approaching daily budget limit."}
              </span>
            </motion.div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helper function to calculate cost from token usage
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING["gpt-4o-mini"];
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

export default AICostWidget;
