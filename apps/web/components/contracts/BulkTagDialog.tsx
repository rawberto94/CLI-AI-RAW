'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { X, Plus, Tag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractIds: string[];
  onSuccess?: () => void;
}

export function BulkTagDialog({ open, onOpenChange, contractIds, onSuccess }: BulkTagDialogProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setTags([]);
      setInputValue('');
      setMode('add');
      setSuggestions([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || inputValue.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contracts/tags/suggest?q=${encodeURIComponent(inputValue)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions?.map((s: any) => s.tag || s).filter((s: string) => !tags.includes(s)) || []);
        }
      } catch {
        // ignore
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [inputValue, open, tags]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setInputValue('');
    setSuggestions([]);
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (tags.length === 0) {
      toast.error('Please add at least one tag');
      return;
    }
    if (contractIds.length === 0) {
      toast.error('No contracts selected');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/contracts/bulk/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractIds, tags, mode }),
      });
      if (!res.ok) throw new Error('Failed to update tags');
      const data = await res.json();
      toast.success(data.message || `Updated tags for ${contractIds.length} contracts`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update tags');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-violet-500" />
            Tag {contractIds.length} Contract{contractIds.length !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add' && 'Add tags to all selected contracts.'}
            {mode === 'remove' && 'Remove tags from all selected contracts.'}
            {mode === 'set' && 'Replace all tags on selected contracts with these.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode selector */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {(['add', 'remove', 'set'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize',
                  mode === m
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Tag input */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Type a tag and press Enter..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(inputValue);
                  }
                }}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => addTag(inputValue)}
                disabled={!inputValue.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => addTag(s)}
                    className="text-xs px-2 py-1 bg-violet-50 text-violet-700 rounded-full hover:bg-violet-100 transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}

            {/* Selected tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 pr-1 bg-slate-100 dark:bg-slate-800"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || tags.length === 0} className="gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'add' && 'Add Tags'}
            {mode === 'remove' && 'Remove Tags'}
            {mode === 'set' && 'Set Tags'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
