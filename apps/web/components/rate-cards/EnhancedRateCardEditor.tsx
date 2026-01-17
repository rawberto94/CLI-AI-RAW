'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, X, Edit2, History } from 'lucide-react';

interface RateCardData {
  id: string;
  clientName?: string;
  clientId?: string;
  supplierName: string;
  roleStandardized: string;
  seniority: string;
  country: string;
  dailyRate: number;
  currency: string;
  isBaseline: boolean;
  baselineType?: string;
  isNegotiated: boolean;
  negotiationDate?: string;
  negotiatedBy?: string;
  msaReference?: string;
  isEditable: boolean;
  editHistory?: any[];
}

interface EnhancedRateCardEditorProps {
  rateCard: RateCardData;
  onSave: (updatedData: Partial<RateCardData>) => Promise<void>;
  onCancel: () => void;
}

export function EnhancedRateCardEditor({
  rateCard,
  onSave,
  onCancel,
}: EnhancedRateCardEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<RateCardData>>(rateCard);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleChange = (field: keyof RateCardData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
      setIsEditing(false);
    } catch {
      // Error saving rate card
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(rateCard);
    setIsEditing(false);
    onCancel();
  };

  if (!rateCard.isEditable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rate Card Details</CardTitle>
          <CardDescription>This rate card is locked and cannot be edited</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <RateCardDisplay rateCard={rateCard} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Rate Card Editor</CardTitle>
            <CardDescription>Edit rate card details and metadata</CardDescription>
          </div>
          <div className="flex gap-2">
            {rateCard.editHistory && rateCard.editHistory.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="h-4 w-4 mr-2" />
                History ({rateCard.editHistory.length})
              </Button>
            )}
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} size="sm">
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <>
                <Button onClick={handleSave} disabled={saving} size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button onClick={handleCancel} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Client Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Client Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  value={formData.clientName || ''}
                  onChange={(e) => handleChange('clientName', e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g., UBS, Pictet, KPMG"
                />
              </div>
              <div>
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  value={formData.clientId || ''}
                  onChange={(e) => handleChange('clientId', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Optional client reference ID"
                />
              </div>
            </div>
          </div>

          {/* Baseline & Negotiation Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Status & Classification</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isBaseline"
                  checked={formData.isBaseline || false}
                  onCheckedChange={(checked) => handleChange('isBaseline', checked)}
                  disabled={!isEditing}
                />
                <Label htmlFor="isBaseline" className="font-normal">
                  Mark as Baseline Rate
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isNegotiated"
                  checked={formData.isNegotiated || false}
                  onCheckedChange={(checked) => handleChange('isNegotiated', checked)}
                  disabled={!isEditing}
                />
                <Label htmlFor="isNegotiated" className="font-normal">
                  Negotiated Rate
                </Label>
              </div>
            </div>

            {formData.isBaseline && (
              <div>
                <Label htmlFor="baselineType">Baseline Type</Label>
                <select
                  id="baselineType"
                  value={formData.baselineType || ''}
                  onChange={(e) => handleChange('baselineType', e.target.value)}
                  disabled={!isEditing}
                  className="w-full border rounded-md p-2"
                >
                  <option value="">Select type...</option>
                  <option value="TARGET_RATE">Target Rate</option>
                  <option value="MARKET_BENCHMARK">Market Benchmark</option>
                  <option value="HISTORICAL_BEST">Historical Best</option>
                  <option value="COMPETITIVE_BID">Competitive Bid</option>
                  <option value="NEGOTIATED_CAP">Negotiated Cap</option>
                  <option value="INDUSTRY_STANDARD">Industry Standard</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </div>
            )}

            {formData.isNegotiated && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="negotiationDate">Negotiation Date</Label>
                  <Input
                    id="negotiationDate"
                    type="date"
                    value={formData.negotiationDate || ''}
                    onChange={(e) => handleChange('negotiationDate', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="negotiatedBy">Negotiated By</Label>
                  <Input
                    id="negotiatedBy"
                    value={formData.negotiatedBy || ''}
                    onChange={(e) => handleChange('negotiatedBy', e.target.value)}
                    disabled={!isEditing}
                    placeholder="User name"
                  />
                </div>
                <div>
                  <Label htmlFor="msaReference">MSA Reference</Label>
                  <Input
                    id="msaReference"
                    value={formData.msaReference || ''}
                    onChange={(e) => handleChange('msaReference', e.target.value)}
                    disabled={!isEditing}
                    placeholder="MSA-2024-001"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rate Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Rate Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dailyRate">Daily Rate</Label>
                <Input
                  id="dailyRate"
                  type="number"
                  step="0.01"
                  value={formData.dailyRate || ''}
                  onChange={(e) => handleChange('dailyRate', parseFloat(e.target.value))}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={formData.currency || 'USD'}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  disabled={!isEditing}
                  className="w-full border rounded-md p-2"
                >
                  <option value="USD">USD</option>
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country || ''}
                  onChange={(e) => handleChange('country', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          {/* Role Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Role Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="roleStandardized">Role</Label>
                <Input
                  id="roleStandardized"
                  value={formData.roleStandardized || ''}
                  onChange={(e) => handleChange('roleStandardized', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label htmlFor="seniority">Seniority</Label>
                <select
                  id="seniority"
                  value={formData.seniority || ''}
                  onChange={(e) => handleChange('seniority', e.target.value)}
                  disabled={!isEditing}
                  className="w-full border rounded-md p-2"
                >
                  <option value="JUNIOR">Junior</option>
                  <option value="MID">Mid</option>
                  <option value="SENIOR">Senior</option>
                  <option value="PRINCIPAL">Principal</option>
                  <option value="PARTNER">Partner</option>
                </select>
              </div>
              <div>
                <Label htmlFor="supplierName">Supplier</Label>
                <Input
                  id="supplierName"
                  value={formData.supplierName || ''}
                  onChange={(e) => handleChange('supplierName', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>

          {/* Edit History */}
          {showHistory && rateCard.editHistory && rateCard.editHistory.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Edit History</h3>
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                {rateCard.editHistory.map((edit: any, index: number) => (
                  <div key={index} className="mb-3 pb-3 border-b last:border-b-0">
                    <div className="text-sm text-muted-foreground">
                      {new Date(edit.timestamp).toLocaleString()}
                    </div>
                    <div className="text-sm font-medium">{edit.editedBy}</div>
                    <div className="text-sm">{edit.changes}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RateCardDisplay({ rateCard }: { rateCard: RateCardData }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-sm text-muted-foreground">Client</div>
        <div className="font-medium">{rateCard.clientName || 'N/A'}</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Supplier</div>
        <div className="font-medium">{rateCard.supplierName}</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Role</div>
        <div className="font-medium">{rateCard.roleStandardized}</div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Rate</div>
        <div className="font-medium">
          {rateCard.currency} {rateCard.dailyRate}/day
        </div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Status</div>
        <div className="flex gap-2">
          {rateCard.isBaseline && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Baseline</span>
          )}
          {rateCard.isNegotiated && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Negotiated</span>
          )}
        </div>
      </div>
    </div>
  );
}
