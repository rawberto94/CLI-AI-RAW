'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Edit2, Save, X, Loader2, AlertCircle } from 'lucide-react';

interface RateEntry {
  id: string;
  role: string;
  seniorityLevel: string;
  hourlyRate?: number;
  dailyRate?: number;
  monthlyRate?: number;
  currency: string;
  location?: string;
}

interface RateCardEditorProps {
  artifact: any;
  contractId: string;
  onUpdate?: () => void;
}

export function RateCardEditor({
  artifact,
  contractId,
  onUpdate,
}: RateCardEditorProps) {
  const [rates, setRates] = useState<RateEntry[]>(artifact.data?.rates || []);
  const [selectedRates, setSelectedRates] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<RateEntry>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newRate, setNewRate] = useState<Partial<RateEntry>>({
    role: '',
    seniorityLevel: 'Mid-Level',
    currency: 'USD',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectRate = (rateId: string) => {
    const newSelected = new Set(selectedRates);
    if (newSelected.has(rateId)) {
      newSelected.delete(rateId);
    } else {
      newSelected.add(rateId);
    }
    setSelectedRates(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRates.size === rates.length) {
      setSelectedRates(new Set());
    } else {
      setSelectedRates(new Set(rates.map(r => r.id)));
    }
  };

  const handleEdit = (rate: RateEntry) => {
    setEditingId(rate.id);
    setEditingData({ ...rate });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/contracts/${contractId}/artifacts/${artifact.id}/rates/${editingId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updates: editingData,
            userId: 'current-user',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update rate');
      }

      // Update local state
      setRates(rates.map(r => r.id === editingId ? { ...r, ...editingData } : r));
      setEditingId(null);
      setEditingData({});
      
      // Dispatch event to notify chatbot and other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('artifact-updated', { 
          detail: { contractId, artifactId: artifact.id, type: 'rate-card', timestamp: Date.now() } 
        }));
        window.dispatchEvent(new CustomEvent('ratecards:refresh', { detail: { contractId } }));
      }
      
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddRate = async () => {
    if (!newRate.role || !newRate.seniorityLevel) {
      setError('Role and seniority level are required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/contracts/${contractId}/artifacts/${artifact.id}/rates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rate: newRate,
            userId: 'current-user',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add rate');
      }

      const result = await response.json();
      
      // Add to local state
      setRates([...rates, { ...newRate, id: result.rateId } as RateEntry]);
      setIsAdding(false);
      setNewRate({
        role: '',
        seniorityLevel: 'Mid-Level',
        currency: 'USD',
      });
      
      // Dispatch event to notify chatbot and other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('artifact-updated', { 
          detail: { contractId, artifactId: artifact.id, type: 'rate-card', timestamp: Date.now() } 
        }));
        window.dispatchEvent(new CustomEvent('ratecards:refresh', { detail: { contractId } }));
      }
      
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add rate');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedRates.size === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      // Delete each selected rate
      await Promise.all(
        Array.from(selectedRates).map(rateId =>
          fetch(
            `/api/contracts/${contractId}/artifacts/${artifact.id}/rates/${rateId}?userId=current-user`,
            { method: 'DELETE' }
          )
        )
      );

      // Update local state
      setRates(rates.filter(r => !selectedRates.has(r.id)));
      setSelectedRates(new Set());
      
      // Dispatch event to notify chatbot and other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('artifact-updated', { 
          detail: { contractId, artifactId: artifact.id, type: 'rate-card', timestamp: Date.now() } 
        }));
        window.dispatchEvent(new CustomEvent('ratecards:refresh', { detail: { contractId } }));
      }
      
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rates');
    } finally {
      setIsSaving(false);
    }
  };

  const renderEditableCell = (
    rate: RateEntry,
    field: keyof RateEntry,
    type: 'text' | 'number' = 'text'
  ) => {
    if (editingId === rate.id) {
      return (
        <Input
          type={type}
          value={editingData[field]?.toString() || ''}
          onChange={(e) =>
            setEditingData({
              ...editingData,
              [field]: type === 'number' ? parseFloat(e.target.value) : e.target.value,
            })
          }
          className="w-full"
        />
      );
    }
    return rate[field]?.toString() || '-';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Rate Card</h3>
        <div className="flex gap-2">
          {selectedRates.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={isSaving}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedRates.size})
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Rate
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedRates.size === rates.length && rates.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Hourly Rate</TableHead>
              <TableHead>Daily Rate</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Add New Rate Row */}
            {isAdding && (
              <TableRow className="bg-violet-50">
                <TableCell />
                <TableCell>
                  <Input
                    value={newRate.role || ''}
                    onChange={(e) => setNewRate({ ...newRate, role: e.target.value })}
                    placeholder="Role"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={newRate.seniorityLevel || ''}
                    onChange={(e) => setNewRate({ ...newRate, seniorityLevel: e.target.value })}
                    placeholder="Level"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={newRate.hourlyRate || ''}
                    onChange={(e) => setNewRate({ ...newRate, hourlyRate: parseFloat(e.target.value) })}
                    placeholder="0.00"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={newRate.dailyRate || ''}
                    onChange={(e) => setNewRate({ ...newRate, dailyRate: parseFloat(e.target.value) })}
                    placeholder="0.00"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={newRate.currency || ''}
                    onChange={(e) => setNewRate({ ...newRate, currency: e.target.value })}
                    placeholder="USD"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={newRate.location || ''}
                    onChange={(e) => setNewRate({ ...newRate, location: e.target.value })}
                    placeholder="Location"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleAddRate} disabled={isSaving}>
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Existing Rates */}
            {rates.map((rate) => (
              <TableRow key={rate.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedRates.has(rate.id)}
                    onCheckedChange={() => handleSelectRate(rate.id)}
                  />
                </TableCell>
                <TableCell>{renderEditableCell(rate, 'role')}</TableCell>
                <TableCell>{renderEditableCell(rate, 'seniorityLevel')}</TableCell>
                <TableCell>{renderEditableCell(rate, 'hourlyRate', 'number')}</TableCell>
                <TableCell>{renderEditableCell(rate, 'dailyRate', 'number')}</TableCell>
                <TableCell>{renderEditableCell(rate, 'currency')}</TableCell>
                <TableCell>{renderEditableCell(rate, 'location')}</TableCell>
                <TableCell>
                  {editingId === rate.id ? (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(rate)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {rates.length === 0 && !isAdding && (
        <div className="text-center py-8 text-gray-500">
          No rate entries yet. Click &ldquo;Add Rate&rdquo; to get started.
        </div>
      )}
    </div>
  );
}
