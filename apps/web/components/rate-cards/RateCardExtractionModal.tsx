'use client';

/**
 * Rate Card Extraction Modal
 * Displays extracted rate cards for review and editing before saving
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Edit2, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ExtractedRate {
  roleOriginal: string;
  roleStandardized: string;
  roleCategory?: string;
  seniority: string;
  dailyRate: number;
  currency: string;
  location?: string;
  lineOfService?: string;
  skills?: string[];
  confidence: number;
  extractionMethod: string;
}

interface ExtractionResult {
  rates: ExtractedRate[];
  supplierInfo: {
    name: string;
    country?: string;
    tier?: string;
    confidence: number;
  };
  contractContext: {
    effectiveDate?: string;
    expiryDate?: string;
    contractType?: string;
  };
  confidence: number;
  warnings: string[];
}

interface ValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string; severity: string }>;
  warnings: Array<{ field: string; message: string; suggestion?: string }>;
}

interface RateCardExtractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  contractName: string;
  extraction: ExtractionResult | null;
  validation: ValidationResult | null;
  onSave: (rates: ExtractedRate[]) => Promise<void>;
}

export function RateCardExtractionModal({
  isOpen,
  onClose,
  contractId,
  contractName,
  extraction,
  validation,
  onSave,
}: RateCardExtractionModalProps) {
  const [editedRates, setEditedRates] = useState<ExtractedRate[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize edited rates when extraction changes
  useState(() => {
    if (extraction) {
      setEditedRates(extraction.rates);
    }
  });

  const handleEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleSaveEdit = (index: number, updatedRate: Partial<ExtractedRate>) => {
    const newRates = [...editedRates];
    const existingRate = newRates[index];
    if (existingRate) {
      newRates[index] = { ...existingRate, ...updatedRate };
    }
    setEditedRates(newRates);
    setEditingIndex(null);
  };

  const handleRemove = (index: number) => {
    const newRates = editedRates.filter((_, i) => i !== index);
    setEditedRates(newRates);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await onSave(editedRates);
      onClose();
    } catch (error) {
      console.error('Error saving rate cards:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge className="bg-green-500">High ({(confidence * 100).toFixed(0)}%)</Badge>;
    } else if (confidence >= 0.5) {
      return <Badge className="bg-yellow-500">Medium ({(confidence * 100).toFixed(0)}%)</Badge>;
    } else {
      return <Badge className="bg-red-500">Low ({(confidence * 100).toFixed(0)}%)</Badge>;
    }
  };

  if (!extraction) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Extracted Rate Cards</DialogTitle>
          <DialogDescription>
            {contractName} - {editedRates.length} rate cards extracted
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="text-sm text-gray-600">Total Rates</div>
            <div className="text-2xl font-bold">{editedRates.length}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Supplier</div>
            <div className="text-lg font-semibold">{extraction.supplierInfo.name}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Overall Confidence</div>
            <div className="text-lg">{getConfidenceBadge(extraction.confidence)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600">Warnings</div>
            <div className="text-lg font-semibold text-yellow-600">
              {extraction.warnings.length}
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {validation && !validation.isValid && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-red-900">Validation Errors</span>
            </div>
            <ul className="list-disc list-inside space-y-1">
              {validation.errors.map((error, idx) => (
                <li key={idx} className="text-sm text-red-700">
                  {error.field}: {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warnings */}
        {extraction.warnings.length > 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold text-yellow-900">Warnings</span>
            </div>
            <ul className="list-disc list-inside space-y-1">
              {extraction.warnings.map((warning, idx) => (
                <li key={idx} className="text-sm text-yellow-700">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rate Cards Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold">Role</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Seniority</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Rate</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Location</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Confidence</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {editedRates.map((rate, index) => (
                <tr key={index} className="border-t hover:bg-gray-50">
                  {editingIndex === index ? (
                    <EditRateRow
                      rate={rate}
                      onSave={(updated) => handleSaveEdit(index, updated)}
                      onCancel={() => setEditingIndex(null)}
                    />
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <div className="font-medium">{rate.roleStandardized}</div>
                        <div className="text-xs text-gray-500">{rate.roleOriginal}</div>
                        {rate.roleCategory && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {rate.roleCategory}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{rate.seniority}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">
                          {rate.dailyRate.toLocaleString()} {rate.currency}
                        </div>
                        <div className="text-xs text-gray-500">per day</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{rate.location || '-'}</div>
                        {rate.lineOfService && (
                          <div className="text-xs text-gray-500">{rate.lineOfService}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{getConfidenceBadge(rate.confidence)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(index)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemove(index)}
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={handleSaveAll}
              disabled={isSaving || editedRates.length === 0}
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save {editedRates.length} Rate Cards
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Rate Row Component
function EditRateRow({
  rate,
  onSave,
  onCancel,
}: {
  rate: ExtractedRate;
  onSave: (updated: Partial<ExtractedRate>) => void;
  onCancel: () => void;
}) {
  const [editedRate, setEditedRate] = useState(rate);

  return (
    <>
      <td className="px-4 py-3" colSpan={6}>
        <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded">
          <div>
            <Label>Standardized Role</Label>
            <Input
              value={editedRate.roleStandardized}
              onChange={(e) =>
                setEditedRate({ ...editedRate, roleStandardized: e.target.value })
              }
            />
          </div>
          <div>
            <Label>Seniority</Label>
            <select
              className="w-full px-3 py-2 border rounded"
              value={editedRate.seniority}
              onChange={(e) =>
                setEditedRate({ ...editedRate, seniority: e.target.value })
              }
            >
              <option value="JUNIOR">Junior</option>
              <option value="MID">Mid</option>
              <option value="SENIOR">Senior</option>
              <option value="PRINCIPAL">Principal</option>
              <option value="PARTNER">Partner</option>
            </select>
          </div>
          <div>
            <Label>Daily Rate</Label>
            <Input
              type="number"
              value={editedRate.dailyRate}
              onChange={(e) =>
                setEditedRate({ ...editedRate, dailyRate: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <Label>Currency</Label>
            <Input
              value={editedRate.currency}
              onChange={(e) =>
                setEditedRate({ ...editedRate, currency: e.target.value })
              }
            />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => onSave(editedRate)}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </td>
    </>
  );
}
