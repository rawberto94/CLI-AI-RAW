'use client';

import React, { useState, useEffect } from 'react';
import { getTenantId } from '@/lib/tenant';
import { Lightbulb, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface Recommendation {
  name: string;
  confidence: number;
  reason: string;
}

interface TagRecommenderProps {
  contractId: string;
  onApply?: (tags: string[]) => void;
  maxRecommendations?: number;
}

export function TagRecommender({
  contractId,
  onApply,
  maxRecommendations = 5,
}: TagRecommenderProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/tags/recommend?contractId=${contractId}&limit=${maxRecommendations}`,
        {
          headers: { 'x-tenant-id': getTenantId() },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      const data = await response.json();
      setRecommendations(data.data?.recommendations || []);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      toast.error('Failed to load tag recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contractId) {
      fetchRecommendations();
    }
  }, [contractId]);

  const handleToggleTag = (tagName: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tagName)) {
      newSelected.delete(tagName);
    } else {
      newSelected.add(tagName);
    }
    setSelectedTags(newSelected);
  };

  const handleApply = () => {
    if (selectedTags.size === 0) {
      toast.error('Select at least one tag');
      return;
    }
    onApply?.(Array.from(selectedTags));
    setSelectedTags(new Set());
  };

  if (recommendations.length === 0 && !loading) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-300">
          <Lightbulb className="w-5 h-5" />
          Suggested Tags
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {recommendations.map((rec) => (
                <label key={rec.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedTags.has(rec.name)}
                    onChange={() => handleToggleTag(rec.name)}
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {rec.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          rec.confidence > 0.8
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : rec.confidence > 0.5
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}
                      >
                        {Math.round(rec.confidence * 100)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-1">
                      {rec.reason}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {selectedTags.size > 0 && (
              <Button
                onClick={handleApply}
                size="sm"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                Apply {selectedTags.size} tag{selectedTags.size !== 1 ? 's' : ''}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
