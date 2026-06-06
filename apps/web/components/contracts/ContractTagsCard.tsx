'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tag, X, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTagStyle } from '@/lib/tag-colors';
import { toast } from 'sonner';

interface ContractTagsCardProps {
  contractId: string;
  tenantId: string;
  initialTags?: string[];
  onChanged?: () => void;
}

export function ContractTagsCard({ contractId, tenantId, initialTags = [], onChanged }: ContractTagsCardProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const addTag = useCallback(async (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || tags.includes(tag)) return;
    setBusy('add');
    try {
      const res = await fetch(`/api/contracts/${contractId}/metadata/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({ tags: [tag] }),
      });
      if (!res.ok) throw new Error();
      setTags(prev => [...prev, tag]);
      setInput('');
      onChanged?.();
    } catch {
      toast.error('Failed to add tag');
    } finally {
      setBusy(null);
    }
  }, [contractId, tenantId, tags, onChanged]);

  const removeTag = useCallback(async (tag: string) => {
    setBusy(tag);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/metadata/tags/${encodeURIComponent(tag)}`,
        { method: 'DELETE', headers: { 'x-tenant-id': tenantId } },
      );
      if (!res.ok) throw new Error();
      setTags(prev => prev.filter(t => t !== tag));
      onChanged?.();
    } catch {
      toast.error('Failed to remove tag');
    } finally {
      setBusy(null);
    }
  }, [contractId, tenantId, onChanged]);

  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Tag className="h-4 w-4 text-violet-500" />
          Tags
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 min-h-[28px]">
          {tags.length === 0 ? (
            <span className="text-sm text-slate-400">No tags yet — add one below</span>
          ) : tags.map(tag => (
            <Badge
              key={tag}
              variant="secondary"
              className={cn('px-2 py-0.5 flex items-center gap-1.5 text-xs font-medium border', getTagStyle(tag))}
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                disabled={busy === tag}
                className="hover:text-red-500 transition-colors disabled:opacity-40"
              >
                {busy === tag
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <X className="h-3 w-3" />}
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(input); } }}
            placeholder="Type a tag and press Enter"
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => addTag(input)}
            disabled={!input.trim() || busy === 'add'}
            className="h-8 px-3"
          >
            {busy === 'add' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
