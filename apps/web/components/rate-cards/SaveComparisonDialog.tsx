'use client';

/**
 * Save Comparison Dialog Component
 * 
 * Dialog for saving and sharing rate card comparisons
 * Requirements: 6.5
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { copyToClipboard } from '@/hooks/useCopyToClipboard';
import { Save, Share2, CheckCircle } from 'lucide-react';

interface SaveComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rateCardIds: string[];
  comparisonType?: string;
  onSave?: (comparisonId: string) => void;
}

export function SaveComparisonDialog({
  open,
  onOpenChange,
  rateCardIds,
  comparisonType,
  onSave,
}: SaveComparisonDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [comparisonId, setComparisonId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for this comparison');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/rate-cards/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          rateCardIds,
          comparisonType,
          isShared,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setComparisonId(data.comparison.id);
        setSaved(true);
        
        if (onSave) {
          onSave(data.comparison.id);
        }

        // Reset form after 2 seconds and close
        setTimeout(() => {
          setName('');
          setDescription('');
          setIsShared(false);
          setSaved(false);
          setComparisonId(null);
          onOpenChange(false);
        }, 2000);
      } else {
        const error = await response.json();
        toast.error(`Failed to save comparison: ${error.error}`);
      }
    } catch {
      toast.error('Failed to save comparison');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!comparisonId) return;

    try {
      const response = await fetch(`/api/rate-cards/comparisons/${comparisonId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isShared: true }),
      });

      if (response.ok) {
        const data = await response.json();
        // Copy share URL to clipboard
        copyToClipboard(window.location.origin + data.shareUrl, {
          successMessage: 'Share link copied to clipboard!',
        });
      }
    } catch {
      toast.error('Failed to share comparison');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {saved ? 'Comparison Saved!' : 'Save Comparison'}
          </DialogTitle>
          <DialogDescription>
            {saved
              ? 'Your comparison has been saved successfully.'
              : 'Save this comparison to access it later or share with your team.'}
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <div className="py-6">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-green-100 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <p className="text-center text-muted-foreground">
                Comparing {rateCardIds.length} rate cards
              </p>
              <Button onClick={handleShare} variant="outline" className="w-full">
                <Share2 className="h-4 w-4 mr-2" />
                Share with Team
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Comparison Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Q4 2024 Supplier Comparison"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add notes about this comparison..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="share">Share with Team</Label>
                <p className="text-sm text-muted-foreground">
                  Allow team members to view this comparison
                </p>
              </div>
              <Switch
                id="share"
                checked={isShared}
                onCheckedChange={setIsShared}
                disabled={saving}
              />
            </div>

            <div className="p-3 bg-violet-50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Comparing <span className="font-semibold">{rateCardIds.length}</span> rate cards
              </p>
            </div>
          </div>
        )}

        {!saved && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Comparison'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
