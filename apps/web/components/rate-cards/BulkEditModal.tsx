'use client';

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
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BulkEditModalProps {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSuccess: () => void;
}

const BASELINE_TYPES = [
  'Market Median',
  'Negotiated Cap',
  'Historical Average',
  'Supplier Commitment',
  'Industry Standard',
  'Client Specific',
  'Regional Benchmark',
  'Custom Baseline',
];

export function BulkEditModal({
  open,
  onClose,
  selectedIds,
  onSuccess,
}: BulkEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('client');

  // Client assignment state
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');

  // Baseline state
  const [markAsBaseline, setMarkAsBaseline] = useState(false);
  const [baselineType, setBaselineType] = useState('');

  // Negotiation state
  const [markAsNegotiated, setMarkAsNegotiated] = useState(false);
  const [negotiationDate, setNegotiationDate] = useState('');
  const [negotiatedBy, setNegotiatedBy] = useState('');
  const [msaReference, setMsaReference] = useState('');

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const updates: any = {};

      // Add updates based on active tab
      if (activeTab === 'client' && clientName) {
        updates.clientName = clientName;
        updates.clientId = clientId || null;
      }

      if (activeTab === 'baseline') {
        updates.isBaseline = markAsBaseline;
        if (markAsBaseline && baselineType) {
          updates.baselineType = baselineType;
        }
      }

      if (activeTab === 'negotiation') {
        updates.isNegotiated = markAsNegotiated;
        if (markAsNegotiated) {
          if (negotiationDate) updates.negotiationDate = negotiationDate;
          if (negotiatedBy) updates.negotiatedBy = negotiatedBy;
          if (msaReference) updates.msaReference = msaReference;
        }
      }

      const response = await fetch('/api/rate-cards/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: selectedIds,
          updates,
        }),
      });

      if (response.ok) {
        toast.success(`Updated ${selectedIds.length} rate card(s) successfully`);
        onSuccess();
        handleClose();
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.error || 'Failed to update rate cards'}`);
      }
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Failed to update rate cards');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setClientName('');
    setClientId('');
    setMarkAsBaseline(false);
    setBaselineType('');
    setMarkAsNegotiated(false);
    setNegotiationDate('');
    setNegotiatedBy('');
    setMsaReference('');
    setActiveTab('client');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Edit Rate Cards</DialogTitle>
          <DialogDescription>
            Update {selectedIds.length} selected rate card(s)
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="client">Client</TabsTrigger>
            <TabsTrigger value="baseline">Baseline</TabsTrigger>
            <TabsTrigger value="negotiation">Negotiation</TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name *</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g., UBS, Credit Suisse"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID (Optional)</Label>
              <Input
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g., CLIENT-001"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Assign all selected rate cards to this client
            </p>
          </TabsContent>

          <TabsContent value="baseline" className="space-y-4 mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="markAsBaseline"
                checked={markAsBaseline}
                onCheckedChange={(checked) => setMarkAsBaseline(checked as boolean)}
              />
              <Label htmlFor="markAsBaseline" className="cursor-pointer">
                Mark as Baseline
              </Label>
            </div>

            {markAsBaseline && (
              <div className="space-y-2">
                <Label htmlFor="baselineType">Baseline Type *</Label>
                <Select value={baselineType} onValueChange={setBaselineType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select baseline type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BASELINE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              Mark selected rate cards as baseline rates for benchmarking
            </p>
          </TabsContent>

          <TabsContent value="negotiation" className="space-y-4 mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="markAsNegotiated"
                checked={markAsNegotiated}
                onCheckedChange={(checked) => setMarkAsNegotiated(checked as boolean)}
              />
              <Label htmlFor="markAsNegotiated" className="cursor-pointer">
                Mark as Negotiated
              </Label>
            </div>

            {markAsNegotiated && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="negotiationDate">Negotiation Date</Label>
                  <Input
                    id="negotiationDate"
                    type="date"
                    value={negotiationDate}
                    onChange={(e) => setNegotiationDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="negotiatedBy">Negotiated By</Label>
                  <Input
                    id="negotiatedBy"
                    value={negotiatedBy}
                    onChange={(e) => setNegotiatedBy(e.target.value)}
                    placeholder="e.g., john.doe@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="msaReference">MSA Reference</Label>
                  <Input
                    id="msaReference"
                    value={msaReference}
                    onChange={(e) => setMsaReference(e.target.value)}
                    placeholder="e.g., MSA-2024-UBS-001"
                  />
                </div>
              </>
            )}

            <p className="text-sm text-muted-foreground">
              Mark selected rate cards as negotiated with MSA details
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Updating...' : `Update ${selectedIds.length} Rate Card(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
