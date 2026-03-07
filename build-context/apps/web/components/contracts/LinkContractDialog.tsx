/**
 * Link Contract Dialog Component
 * 
 * UI for linking contracts in parent-child relationships
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { ContractCategoryBadge } from './ContractCategoryBadge';
import { useToast } from '@/hooks/use-toast';

interface SuggestedParent {
  id: string;
  fileName: string;
  contractCategoryId?: string;
  score: number;
  reason: string;
}

interface LinkContractDialogProps {
  contractId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked?: () => void;
}

const RELATIONSHIP_TYPES = [
  { value: 'SOW_UNDER_MSA', label: 'SOW under MSA' },
  { value: 'WORK_ORDER_UNDER_MSA', label: 'Work Order under MSA' },
  { value: 'TASK_ORDER_UNDER_MSA', label: 'Task Order under MSA' },
  { value: 'PO_UNDER_SUPPLY_AGREEMENT', label: 'PO under Supply Agreement' },
  { value: 'AMENDMENT', label: 'Amendment' },
  { value: 'ADDENDUM', label: 'Addendum' },
  { value: 'RENEWAL', label: 'Renewal' },
  { value: 'CHANGE_ORDER', label: 'Change Order' },
  { value: 'APPENDIX', label: 'Appendix' },
  { value: 'EXHIBIT', label: 'Exhibit' },
  { value: 'SCHEDULE', label: 'Schedule' },
  { value: 'SLA_UNDER_MSA', label: 'SLA under MSA' },
  { value: 'DPA_UNDER_MSA', label: 'DPA under MSA' },
  { value: 'RATE_CARD_UNDER_MSA', label: 'Rate Card under MSA' },
  { value: 'SUPERSEDES', label: 'Supersedes' },
  { value: 'RELATED', label: 'Related' },
];

export function LinkContractDialog({ 
  contractId, 
  open, 
  onOpenChange,
  onLinked 
}: LinkContractDialogProps) {
  const [suggestions, setSuggestions] = useState<SuggestedParent[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedParent, setSelectedParent] = useState<string>('');
  const [relationshipType, setRelationshipType] = useState<string>('');
  const [relationshipNote, setRelationshipNote] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchSuggestions();
    }
  }, [open, contractId]);

  async function fetchSuggestions() {
    try {
      setLoading(true);
      const response = await fetch(`/api/contracts/${contractId}/suggested-parents`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load parent contract suggestions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleLink() {
    if (!selectedParent || !relationshipType) {
      toast({
        title: 'Missing Information',
        description: 'Please select a parent contract and relationship type',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLinking(true);

      const response = await fetch(`/api/contracts/${contractId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: selectedParent,
          relationshipType,
          relationshipNote,
          validateCompatibility: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to link contracts');
      }

      toast({
        title: 'Success',
        description: 'Contracts linked successfully',
      });

      onOpenChange(false);
      onLinked?.();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to link contracts',
        variant: 'destructive',
      });
    } finally {
      setLinking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Link to Parent Contract
          </DialogTitle>
          <DialogDescription>
            Select a parent contract and define the relationship type
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Suggested Parents */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-2">
              <Label>Suggested Parent Contracts</Label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {suggestions.map(suggestion => (
                  <div
                    key={suggestion.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedParent === suggestion.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedParent(suggestion.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="font-medium">{suggestion.fileName}</div>
                        {suggestion.contractCategoryId && (
                          <ContractCategoryBadge 
                            categoryId={suggestion.contractCategoryId}
                            className="text-xs"
                          />
                        )}
                        <p className="text-sm text-muted-foreground">
                          {suggestion.reason}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        Score: {suggestion.score}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No parent contract suggestions found</p>
              <p className="text-sm">You can still manually link contracts</p>
            </div>
          )}

          {/* Manual Parent Selection */}
          <div className="space-y-2">
            <Label>Or Enter Parent Contract ID</Label>
            <Input
              placeholder="Contract ID..."
              value={selectedParent}
              onChange={(e) => setSelectedParent(e.target.value)}
            />
          </div>

          {/* Relationship Type */}
          <div className="space-y-2">
            <Label>Relationship Type</Label>
            <Select value={relationshipType} onValueChange={setRelationshipType}>
              <SelectTrigger>
                <SelectValue placeholder="Select relationship type..." />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Relationship Note */}
          <div className="space-y-2">
            <Label>Note (Optional)</Label>
            <Textarea
              placeholder="Add context about this relationship..."
              value={relationshipNote}
              onChange={(e) => setRelationshipNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleLink} 
            disabled={!selectedParent || !relationshipType || linking}
          >
            {linking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Link Contracts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
