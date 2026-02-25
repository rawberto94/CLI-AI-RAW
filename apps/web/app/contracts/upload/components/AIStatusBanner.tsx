/**
 * AIStatusBanner — Shows loading, ready, degraded, unavailable, or error state of AI systems
 */

'use client';

import React from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Key,
  WifiOff,
} from 'lucide-react';

export interface AIStatus {
  status: 'healthy' | 'degraded' | 'limited' | 'error';
  providers: {
    openai: { configured: boolean; status: string };
    mistral: { configured: boolean; status: string };
  };
  capabilities: Record<string, boolean>;
  recommendations: string[];
}

interface AIStatusBannerProps {
  status: AIStatus | null;
  loading: boolean;
}

export function AIStatusBanner({ status, loading }: AIStatusBannerProps) {
  if (loading) {
    return (
      <Alert className="bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>Checking AI system status...</AlertDescription>
      </Alert>
    );
  }

  // AI status endpoint unreachable or returned an error status
  if (!status) {
    return (
      <Alert className="border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60">
        <WifiOff className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <AlertTitle className="font-semibold text-slate-700 dark:text-slate-300">AI Status Unavailable</AlertTitle>
        <AlertDescription className="text-slate-600 dark:text-slate-400">
          Unable to reach the AI status service. Uploads will continue normally — AI analysis will begin once the service reconnects.
        </AlertDescription>
      </Alert>
    );
  }

  if (status.status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>AI Features Unavailable</AlertTitle>
        <AlertDescription>
          AI features are limited. Some analysis may be delayed.
        </AlertDescription>
      </Alert>
    );
  }

  if (status.status === 'limited' || status.status === 'degraded') {
    return (
      <Alert
        variant={status.status === 'limited' ? 'destructive' : 'default'}
        className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30"
      >
        <Key className="h-4 w-4" />
        <AlertTitle className="font-semibold">
          {status.status === 'limited' ? 'AI Features Limited' : 'AI System Degraded'}
        </AlertTitle>
        <AlertDescription className="mt-2">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="font-medium">Providers:</span>
              <Badge
                variant={status.providers.openai.configured ? 'default' : 'outline'}
                className="text-xs"
              >
                OpenAI: {status.providers.openai.configured ? '✅ Ready' : '❌ Not configured'}
              </Badge>
              <Badge
                variant={status.providers.mistral.configured ? 'default' : 'outline'}
                className="text-xs"
              >
                Mistral: {status.providers.mistral.configured ? '✅ Ready' : '❌ Not configured'}
              </Badge>
            </div>
            {status.recommendations.length > 0 && (
              <ul className="text-sm list-disc list-inside space-y-1 mt-2 text-muted-foreground">
                {status.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Healthy
  return (
    <Alert className="border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <AlertTitle className="font-semibold text-green-800 dark:text-green-200">AI System Ready</AlertTitle>
      <AlertDescription className="text-green-700 dark:text-green-300">
        All AI providers are configured and operational. Upload your contracts for instant AI analysis.
      </AlertDescription>
    </Alert>
  );
}

export default AIStatusBanner;
