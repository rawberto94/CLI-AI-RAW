'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Lightbulb, 
  ListChecks, 
  Wrench,
  History,
  Copy,
  Check
} from 'lucide-react';

interface ImprovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (prompt: string) => void;
  isStreaming?: boolean;
  artifactType: string;
}

const PROMPT_TEMPLATES: Record<string, string[]> = {
  OVERVIEW: [
    'Increase precision of contract summary with more specific details',
    'Extract missing key dates and milestones',
    'Identify primary objectives and success criteria',
    'Add more context about contracting parties'
  ],
  CLAUSES: [
    'Focus on payment terms and billing cycles',
    'Extract termination and renewal clauses with exact conditions',
    'Identify all obligations and responsibilities for each party',
    'List all compliance requirements mentioned'
  ],
  FINANCIAL: [
    'Extract detailed payment schedules with dates',
    'Identify all cost items including hidden fees',
    'Calculate total contract value with breakdown',
    'List all financial penalties and incentives'
  ],
  RISK: [
    'Identify compliance risks with severity ratings',
    'Extract liability caps and indemnification clauses',
    'Assess termination risks and notice periods',
    'Evaluate financial exposure and penalties'
  ],
  COMPLIANCE: [
    'List all regulatory requirements mentioned',
    'Extract data protection and privacy clauses',
    'Identify audit rights and reporting obligations',
    'Check for industry-specific compliance standards'
  ],
  RATES: [
    'Extract all rate cards with effective dates',
    'Identify escalation clauses and adjustment formulas',
    'List volume discounts and tiered pricing',
    'Extract currency and invoicing details'
  ]
};

const RECENT_PROMPTS_KEY = 'artifact_improvement_history';

export function ImprovementDialog({
  open,
  onOpenChange,
  onSubmit,
  isStreaming = false,
  artifactType
}: ImprovementDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const [recentPrompts, setRecentPrompts] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(RECENT_PROMPTS_KEY);
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  });

  const templates = PROMPT_TEMPLATES[artifactType] ?? PROMPT_TEMPLATES.OVERVIEW ?? [];

  const handleSubmit = () => {
    if (prompt.trim()) {
      // Save to history
      const updated = [prompt, ...recentPrompts.filter(p => p !== prompt)].slice(0, 5);
      setRecentPrompts(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem(RECENT_PROMPTS_KEY, JSON.stringify(updated));
      }
      
      onSubmit(prompt);
      setPrompt('');
    }
  };

  const handleUseTemplate = (template: string) => {
    setPrompt(template);
    setCopiedTemplate(template);
    setTimeout(() => setCopiedTemplate(null), 2000);
  };

  const handleUseRecent = (recentPrompt: string) => {
    setPrompt(recentPrompt);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Improve Artifact
          </DialogTitle>
          <DialogDescription>
            Describe how you'd like to refine this {artifactType.toLowerCase()} artifact. 
            Use templates or your own custom instructions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="improvement-prompt" className="text-sm font-semibold">
              Improvement Instructions
            </Label>
            <Textarea
              id="improvement-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Focus on extracting payment terms and billing cycles with exact dates..."
              rows={6}
              className="resize-none"
              disabled={isStreaming}
            />
            <p className="text-xs text-gray-500">
              Be specific about what information you want extracted or how you want the artifact improved.
            </p>
          </div>

          {/* Templates Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-600" />
              <Label className="text-sm font-semibold">Quick Templates</Label>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {templates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => handleUseTemplate(template)}
                  className="text-left text-sm p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors group"
                  disabled={isStreaming}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex-1">{template}</span>
                    {copiedTemplate === template ? (
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Copy className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Prompts */}
          {recentPrompts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-gray-600" />
                <Label className="text-sm font-semibold">Recent Prompts</Label>
              </div>
              <div className="space-y-2">
                {recentPrompts.slice(0, 3).map((recentPrompt, index) => (
                  <button
                    key={index}
                    onClick={() => handleUseRecent(recentPrompt)}
                    className="text-left text-sm p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors w-full"
                    disabled={isStreaming}
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 truncate">{recentPrompt}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tips Section */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-start gap-3">
              <ListChecks className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">Tips for better results:</p>
                <ul className="text-xs text-gray-700 space-y-1">
                  <li>• Be specific about what information you want extracted</li>
                  <li>• Mention exact clause types or terms you're looking for</li>
                  <li>• Request structured formats (lists, tables, dates, amounts)</li>
                  <li>• Ask for confidence levels on uncertain extractions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isStreaming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isStreaming}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isStreaming ? 'Improving...' : 'Request Improvement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
