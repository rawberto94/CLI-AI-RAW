/**
 * Memoized Artifact Card Component
 * Optimized to prevent unnecessary re-renders
 */

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import type { Artifact } from '@/types/artifacts';

interface ArtifactCardProps {
  artifact: Artifact;
  artifactIcon: React.ReactNode;
  isCopied: boolean;
  onCopy: (type: string, data: unknown) => void;
  children: React.ReactNode;
}

export const ArtifactCard = memo(function ArtifactCard({
  artifact,
  artifactIcon,
  isCopied,
  onCopy,
  children
}: ArtifactCardProps) {
  const artifactType = artifact.type?.toLowerCase() || 'unknown';
  const artifactData = artifact.data || {};

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 border-2">
      <CardHeader className="bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-800 border-b-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-white dark:bg-gray-900 shadow-md">
              {artifactIcon}
            </div>
            <div>
              <CardTitle className="text-2xl font-bold capitalize tracking-tight">
                {artifactType}
              </CardTitle>
              {artifact.confidence && (
                <CardDescription className="text-sm mt-1.5 font-medium">
                  Confidence: <span className="text-green-600 dark:text-green-400 font-bold">
                    {(artifact.confidence * 100).toFixed(0)}%
                  </span>
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {artifact.model && (
              <Badge variant="outline" className="text-xs font-mono px-3 py-1">
                {artifact.model}
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onCopy(artifactType, artifactData)}
              className="gap-2"
              aria-label={`Copy ${artifactType} artifact data`}
            >
              {isCopied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-8 pb-6 px-8">
        <div className="space-y-6" style={{ lineHeight: '1.7' }}>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimization
  return (
    prevProps.artifact.type === nextProps.artifact.type &&
    prevProps.artifact.confidence === nextProps.artifact.confidence &&
    prevProps.artifact.model === nextProps.artifact.model &&
    prevProps.isCopied === nextProps.isCopied &&
    JSON.stringify(prevProps.artifact.data) === JSON.stringify(nextProps.artifact.data)
  );
});
