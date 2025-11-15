'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  RefreshCw,
  Sparkles,
  FileText,
  Eye,
  MessageSquare,
  Edit3,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImprovementStream } from '@/hooks/useImprovementStream';
import { ImprovementDialog } from '@/components/contracts/ImprovementDialog';

export interface EnhancedArtifact {
  id: string;
  type: string;
  status: string;
  content: string;
  metadata?: {
    confidence?: number;
    processingTime?: number;
    model?: string;
    tokens?: number;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

interface EnhancedArtifactCardProps {
  artifact: EnhancedArtifact;
  contractId: string;
  onRegenerate?: () => void;
  onView?: () => void;
  defaultExpanded?: boolean;
}

const artifactLabels: Record<string, string> = {
  OVERVIEW: 'Contract Overview',
  FINANCIAL: 'Financial Analysis',
  CLAUSES: 'Key Clauses',
  RATES: 'Rate Cards',
  COMPLIANCE: 'Compliance Check',
  RISK: 'Risk Assessment'
};

const artifactDescriptions: Record<string, string> = {
  OVERVIEW: 'High-level summary of contract terms and parties',
  FINANCIAL: 'Financial obligations, payment terms, and monetary values',
  CLAUSES: 'Important contractual clauses and provisions',
  RATES: 'Service rates, pricing, and cost structures',
  COMPLIANCE: 'Regulatory compliance and legal requirements',
  RISK: 'Identified risks and mitigation strategies'
};

export function EnhancedArtifactCard({ 
  artifact, 
  contractId,
  onRegenerate,
  onView,
  defaultExpanded = false 
}: EnhancedArtifactCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isCopied, setIsCopied] = useState(false);
  const [showImproveDialog, setShowImproveDialog] = useState(false);
  const [improvePrompt, setImprovePrompt] = useState('');
  const [startStream, setStartStream] = useState(false);
  const [userId] = useState('user-123'); // TODO: Get from auth context

  const {
    streamedContent,
    isStreaming,
    error: streamError,
    validation,
    completed
  } = useImprovementStream(
    contractId,
    artifact.id,
    improvePrompt,
    userId,
    startStream
  );

  const handleImproveSubmit = (prompt: string) => {
    setImprovePrompt(prompt);
    setStartStream(true);
    setTimeout(() => setStartStream(false), 100);
    setShowImproveDialog(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.type.toLowerCase()}_${artifact.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseContent = () => {
    try {
      return JSON.parse(artifact.content);
    } catch {
      return null;
    }
  };

  const parsedContent = parseContent();
  const contentPreview = artifact.content.substring(0, 200) + (artifact.content.length > 200 ? '...' : '');

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">
                {artifactLabels[artifact.type] || artifact.type}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {artifact.status}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {artifactDescriptions[artifact.type] || 'AI-generated artifact'}
            </CardDescription>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 w-8 p-0"
            >
              {isCopied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-8 w-8 p-0"
            >
              <Download className="h-4 w-4" />
            </Button>
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onView}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerate}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            {/* Improve / Explain buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImproveDialog(prev => !prev)}
              className="h-8 w-8 p-0"
              title="Improve artifact with LLM"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
                        <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImproveDialog(true)}
              className="h-8 w-8 p-0"
              title="Improve artifact"
              disabled={isStreaming}
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Edit3 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setImprovePrompt('Provide a brief explanation of this artifact and cite supporting clauses');
                setStartStream(true);
                setTimeout(() => setStartStream(false), 100);
              }}
              className="h-8 w-8 p-0"
              title="Explain artifact"
              disabled={isStreaming}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata */}
        {artifact.metadata && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {artifact.metadata.confidence !== undefined && (
              <div>
                <span className="text-gray-500">Confidence</span>
                <div className="font-semibold mt-1">
                  <Badge variant={artifact.metadata.confidence >= 0.8 ? 'default' : 'secondary'}>
                    {Math.round(artifact.metadata.confidence * 100)}%
                  </Badge>
                </div>
              </div>
            )}
            {artifact.metadata.processingTime && (
              <div>
                <span className="text-gray-500">Processing</span>
                <div className="font-semibold mt-1">
                  {(artifact.metadata.processingTime / 1000).toFixed(2)}s
                </div>
              </div>
            )}
            {artifact.metadata.model && (
              <div>
                <span className="text-gray-500">Model</span>
                <div className="font-semibold mt-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-purple-600" />
                  {artifact.metadata.model}
                </div>
              </div>
            )}
            {artifact.metadata.tokens && (
              <div>
                <span className="text-gray-500">Tokens</span>
                <div className="font-semibold mt-1">
                  {artifact.metadata.tokens.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Preview */}
        <div className={cn(
          "transition-all duration-300",
          !isExpanded && "max-h-32 overflow-hidden"
        )}>
          {parsedContent ? (
            <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96 font-mono">
              {JSON.stringify(parsedContent, null, 2)}
            </pre>
          ) : (
            <div className="text-sm text-gray-700 bg-gray-50 p-4 rounded whitespace-pre-wrap">
              {isExpanded ? artifact.content : contentPreview}
            </div>
          )}
        </div>

        {/* Streaming Status */}
        {isStreaming && (
          <div className="mt-3 bg-blue-50 border border-blue-200 p-4 rounded">
            <div className="flex items-center gap-2 mb-3 text-sm text-blue-900">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-semibold">Streaming improvement from AI...</span>
            </div>
            {streamedContent && (
              <div className="bg-white border border-gray-200 p-3 rounded">
                <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700 max-h-48 overflow-auto">
                  {streamedContent}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Completion Result */}
        {completed && validation && !isStreaming && (
          <div className="mt-3 bg-green-50 border border-green-200 p-3 rounded">
            <div className="text-sm font-semibold text-green-900 mb-2">✓ Improvement Complete</div>
            {validation.isValid !== undefined && (
              <div className="text-xs text-gray-700">
                Valid: {validation.isValid ? 'Yes' : 'No'} 
                {validation.confidence && ` (${Math.round(validation.confidence * 100)}% confidence)`}
              </div>
            )}
            {validation.errors?.length > 0 && (
              <div className="text-xs text-red-600 mt-1">
                Errors: {validation.errors.join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {streamError && (
          <div className="mt-3 bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
            Error: {streamError}
          </div>
        )}

        {/* Expand/Collapse */}
        {artifact.content.length > 200 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show More ({((artifact.content.length - 200) / 1024).toFixed(1)}KB more)
              </>
            )}
          </Button>
        )}

        {/* Copy Success Message */}
        {isCopied && (
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded">
            <Check className="h-3 w-3" />
            <span>Copied to clipboard!</span>
          </div>
        )}
      </CardContent>

      {/* Improvement Dialog */}
      <ImprovementDialog
        open={showImproveDialog}
        onOpenChange={setShowImproveDialog}
        onSubmit={handleImproveSubmit}
        isStreaming={isStreaming}
        artifactType={artifact.type}
      />
    </Card>
  );
}
