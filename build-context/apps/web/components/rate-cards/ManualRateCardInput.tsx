'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';

interface ManualRateCardInputProps {
  onSuccess?: () => void;
  tenantId?: string;
}

export function ManualRateCardInput({ onSuccess, tenantId = 'demo' }: ManualRateCardInputProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const [formData, setFormData] = useState({
    roleStandardized: '',
    roleOriginal: '',
    seniority: '',
    supplierName: '',
    supplierTier: '',
    dailyRateUSD: '',
    currency: 'USD',
    country: '',
    region: '',
    lineOfService: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    volumeCommitted: '1',
    isNegotiated: false,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/rate-cards/import/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          ...formData,
          dailyRateUSD: Number(formData.dailyRateUSD),
          volumeCommitted: Number(formData.volumeCommitted),
        }),
      });

      const result = await response.json();

      if (result.success) {
        success('Success', 'Rate card entry created successfully');
        setOpen(false);
        setFormData({
          roleStandardized: '',
          roleOriginal: '',
          seniority: '',
          supplierName: '',
          supplierTier: '',
          dailyRateUSD: '',
          currency: 'USD',
          country: '',
          region: '',
          lineOfService: '',
          effectiveDate: new Date().toISOString().split('T')[0],
          expiryDate: '',
          volumeCommitted: '1',
          isNegotiated: false,
          notes: '',
        });
        onSuccess?.();
      } else {
        error('Error', result.error || 'Failed to create rate card entry');
      }
    } catch (err) {
      error('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Rate Card
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Rate Card Entry</DialogTitle>
          <DialogDescription>
            Manually enter a new rate card entry into the system
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Role Information */}
            <div className="space-y-2 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700">Role Information</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleStandardized">
                Standardized Role <span className="text-red-500">*</span>
              </Label>
              <Input
                id="roleStandardized"
                value={formData.roleStandardized}
                onChange={(e) => setFormData({ ...formData, roleStandardized: e.target.value })}
                placeholder="e.g., Software Developer"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleOriginal">Original Role Title</Label>
              <Input
                id="roleOriginal"
                value={formData.roleOriginal}
                onChange={(e) => setFormData({ ...formData, roleOriginal: e.target.value })}
                placeholder="e.g., Senior Software Engineer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seniority">
                Seniority <span className="text-red-500">*</span>
              </Label>
              <Select value={formData.seniority} onValueChange={(value) => setFormData({ ...formData, seniority: value })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select seniority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JUNIOR">Junior</SelectItem>
                  <SelectItem value="MID">Mid-Level</SelectItem>
                  <SelectItem value="SENIOR">Senior</SelectItem>
                  <SelectItem value="LEAD">Lead</SelectItem>
                  <SelectItem value="PRINCIPAL">Principal</SelectItem>
                  <SelectItem value="DIRECTOR">Director</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lineOfService">Line of Service</Label>
              <Input
                id="lineOfService"
                value={formData.lineOfService}
                onChange={(e) => setFormData({ ...formData, lineOfService: e.target.value })}
                placeholder="e.g., Software Development"
              />
            </div>

            {/* Supplier Information */}
            <div className="space-y-2 md:col-span-2 pt-4">
              <h3 className="text-sm font-semibold text-gray-700">Supplier Information</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplierName">Supplier Name</Label>
              <Input
                id="supplierName"
                value={formData.supplierName}
                onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                placeholder="e.g., TechConsult Inc"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplierTier">Supplier Tier</Label>
              <Select value={formData.supplierTier} onValueChange={(value) => setFormData({ ...formData, supplierTier: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TIER_1">Tier 1 (Strategic)</SelectItem>
                  <SelectItem value="TIER_2">Tier 2 (Preferred)</SelectItem>
                  <SelectItem value="TIER_3">Tier 3 (Approved)</SelectItem>
                  <SelectItem value="TIER_4">Tier 4 (Transactional)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rate Information */}
            <div className="space-y-2 md:col-span-2 pt-4">
              <h3 className="text-sm font-semibold text-gray-700">Rate Information</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dailyRateUSD">
                Daily Rate (USD) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dailyRateUSD"
                type="number"
                min="0"
                step="0.01"
                value={formData.dailyRateUSD}
                onChange={(e) => setFormData({ ...formData, dailyRateUSD: e.target.value })}
                placeholder="e.g., 920.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={formData.currency} onValueChange={(value) => setFormData({ ...formData, currency: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="volumeCommitted">Volume Committed</Label>
              <Input
                id="volumeCommitted"
                type="number"
                min="1"
                value={formData.volumeCommitted}
                onChange={(e) => setFormData({ ...formData, volumeCommitted: e.target.value })}
              />
            </div>

            <div className="space-y-2 flex items-center pt-6">
              <Checkbox
                id="isNegotiated"
                checked={formData.isNegotiated}
                onCheckedChange={(checked) => setFormData({ ...formData, isNegotiated: checked as boolean })}
              />
              <Label htmlFor="isNegotiated" className="ml-2 cursor-pointer">
                Negotiated Rate
              </Label>
            </div>

            {/* Location Information */}
            <div className="space-y-2 md:col-span-2 pt-4">
              <h3 className="text-sm font-semibold text-gray-700">Location</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">
                Country <span className="text-red-500">*</span>
              </Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="e.g., United States"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="e.g., North America"
              />
            </div>

            {/* Date Information */}
            <div className="space-y-2 md:col-span-2 pt-4">
              <h3 className="text-sm font-semibold text-gray-700">Validity Period</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveDate">Effective Date</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes or comments..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Rate Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
