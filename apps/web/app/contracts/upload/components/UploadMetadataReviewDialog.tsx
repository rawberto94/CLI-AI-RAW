'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';

import { getTenantId } from '@/lib/tenant';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

import {
  buildUploadMetadataReviewFields,
  createUploadMetadataReviewDraft,
  mergeReviewedParties,
  unwrapUploadMetadataReviewPayload,
  type UploadMetadataParty,
  type UploadMetadataReviewDraft,
  type UploadMetadataReviewField,
} from './upload-metadata-review';

interface UploadMetadataReviewDialogProps {
  open: boolean;
  contractId: string | null;
  fileName: string;
  remainingCount: number;
  onSkip: () => void;
  onSkipAll: () => void;
  onSaved: () => void;
}

const DOCUMENT_CLASSIFICATION_OPTIONS = [
  { value: 'contract', label: 'Contract' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'quote', label: 'Quote' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'work_order', label: 'Work Order' },
  { value: 'letter_of_intent', label: 'Letter of Intent' },
  { value: 'memorandum', label: 'Memorandum' },
  { value: 'amendment', label: 'Amendment' },
  { value: 'addendum', label: 'Addendum' },
  { value: 'unknown', label: 'Unknown' },
] as const;

const CONTRACT_TYPE_SUGGESTIONS = ['MSA', 'SOW', 'NDA', 'DPA', 'Amendment', 'Addendum', 'License', 'Service Agreement', 'Purchase Order'];
const CONTRACT_LIKE_CLASSIFICATIONS = new Set(['contract', 'purchase_order', 'work_order', 'amendment', 'addendum']);

function formatConfidence(confidence: number | null): string | null {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return null;
  return `${Math.round(confidence * 100)}% confidence`;
}

function getReasonLabel(field: UploadMetadataReviewField): string {
  switch (field.reason) {
    case 'title-review':
      return 'Review suggested title';
    case 'low-confidence':
      return 'Low-confidence extraction';
    default:
      return 'Missing metadata';
  }
}

function getFieldInputType(fieldKey: UploadMetadataReviewField['key']): 'text' | 'date' | 'number' {
  switch (fieldKey) {
    case 'start_date':
    case 'end_date':
      return 'date';
    case 'tcv_amount':
      return 'number';
    default:
      return 'text';
  }
}

export function UploadMetadataReviewDialog({
  open,
  contractId,
  fileName,
  remainingCount,
  onSkip,
  onSkipAll,
  onSaved,
}: UploadMetadataReviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewFields, setReviewFields] = useState<UploadMetadataReviewField[]>([]);
  const [draft, setDraft] = useState<UploadMetadataReviewDraft | null>(null);
  const [existingParties, setExistingParties] = useState<UploadMetadataParty[]>([]);

  useEffect(() => {
    if (!open || !contractId) {
      setLoading(false);
      setSaving(false);
      setError(null);
      setReviewFields([]);
      setDraft(null);
      setExistingParties([]);
      return;
    }

    let active = true;

    async function loadReview() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/contracts/${contractId}/metadata`, {
          headers: {
            'x-tenant-id': getTenantId(),
          },
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('We could not load extracted metadata for review.');
        }

        const payload = unwrapUploadMetadataReviewPayload(await response.json());
        if (!active) return;

        const nextDraft = createUploadMetadataReviewDraft(payload, fileName);
        const nextFields = buildUploadMetadataReviewFields(payload, fileName);

        setExistingParties(payload.metadata?.external_parties || []);
        setDraft(nextDraft);
        setReviewFields(nextFields);

        if (nextFields.length === 0) {
          onSkip();
          return;
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'We could not load extracted metadata for review.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReview();

    return () => {
      active = false;
    };
  }, [open, contractId, fileName, onSkip]);

  const remainingLabel = remainingCount > 0
    ? `${remainingCount} more contract${remainingCount === 1 ? '' : 's'} after this`
    : 'No more review prompts after this';

  const shouldCaptureContractType = draft
    ? CONTRACT_LIKE_CLASSIFICATIONS.has(draft.document_classification)
    : false;

  const updateDraft = (key: keyof UploadMetadataReviewDraft, value: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: value,
      };
    });
  };

  const handleSave = async () => {
    if (!contractId || !draft) return;

    setSaving(true);
    setError(null);

    try {
      const metadata: Record<string, unknown> = {
        document_title: draft.document_title.trim(),
        document_classification: draft.document_classification,
      };

      metadata.contractType = shouldCaptureContractType ? draft.contractType.trim() : '';

      if (draft.start_date.trim()) metadata.start_date = draft.start_date.trim();
      if (draft.end_date.trim()) metadata.end_date = draft.end_date.trim();
      if (draft.currency.trim()) metadata.currency = draft.currency.trim().toUpperCase();
      if (draft.jurisdiction.trim()) metadata.jurisdiction = draft.jurisdiction.trim();

      if (draft.tcv_amount.trim()) {
        const parsedValue = Number(draft.tcv_amount);
        if (!Number.isNaN(parsedValue)) {
          metadata.tcv_amount = parsedValue;
        }
      }

      const mergedParties = mergeReviewedParties(existingParties, draft.clientName, draft.supplierName);
      if (mergedParties) {
        metadata.external_parties = mergedParties;
      }

      const response = await fetch(`/api/contracts/${contractId}/metadata`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': getTenantId(),
        },
        body: JSON.stringify({ metadata }),
      });

      if (!response.ok) {
        throw new Error('We could not save the reviewed metadata.');
      }

      toast.success('Contract metadata updated.');
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'We could not save the reviewed metadata.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen && !loading && !saving) {
        onSkip();
      }
    }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="border-b border-slate-200 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#312e81] px-6 py-5 text-white">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-semibold text-white">
                  Review extracted metadata
                </DialogTitle>
                <DialogDescription className="text-xs text-white/70">
                  Contigo found a few fields that need a quick human check before you move on.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Uploaded file</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{fileName}</div>
            <div className="mt-1 text-xs text-slate-500">{remainingLabel}</div>
          </div>

          {loading && (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white">
              <div className="text-center text-slate-600">
                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-indigo-600" />
                <p className="text-sm font-medium">Loading extracted metadata...</p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && draft && (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {reviewFields.map((field) => {
                const confidenceLabel = formatConfidence(field.confidence);
                const isTitleField = field.key === 'document_title';
                const isClassificationField = field.key === 'document_classification';
                const isContractTypeField = field.key === 'contractType';
                const inputId = `upload-metadata-review-${field.key}`;

                return (
                  <div
                    key={field.key}
                    className={cn(
                      'rounded-xl border px-4 py-4',
                      field.reason === 'low-confidence'
                        ? 'border-amber-200 bg-amber-50/70'
                        : field.reason === 'missing'
                          ? 'border-rose-200 bg-rose-50/60'
                          : 'border-indigo-200 bg-indigo-50/70',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Label htmlFor={inputId} className="text-sm font-semibold text-slate-900">{field.label}</Label>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-white/80 px-2 py-1 font-medium text-slate-700">
                            {getReasonLabel(field)}
                          </span>
                          {confidenceLabel && (
                            <span className="rounded-full bg-white/80 px-2 py-1 font-medium text-slate-600">
                              {confidenceLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      {isTitleField && (
                        <span className="text-xs text-slate-500">Change it now if you want a cleaner title in the app.</span>
                      )}
                    </div>

                    {isClassificationField ? (
                      <Select
                        value={draft.document_classification}
                        onValueChange={(value) => updateDraft('document_classification', value)}
                      >
                        <SelectTrigger id={inputId} className="mt-3 bg-white">
                          <SelectValue placeholder="Select a document classification" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_CLASSIFICATION_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={inputId}
                        type={getFieldInputType(field.key)}
                        inputMode={field.key === 'tcv_amount' ? 'decimal' : undefined}
                        step={field.key === 'tcv_amount' ? '0.01' : undefined}
                        value={draft[field.key]}
                        onChange={(event) => updateDraft(field.key, event.target.value)}
                        className="mt-3 bg-white"
                        placeholder={isContractTypeField ? 'e.g. MSA, NDA, SOW' : undefined}
                      />
                    )}

                    {isContractTypeField && shouldCaptureContractType && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {CONTRACT_TYPE_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => updateDraft('contractType', suggestion)}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                              draft.contractType === suggestion
                                ? 'border-indigo-300 bg-indigo-100 text-indigo-800'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50',
                            )}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {reviewFields.length > 1 && (
                <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                  <p>
                    Save to confirm these fields now, or skip to leave the current extraction in place and review it later from the contract details page.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="text-xs text-slate-500">Prompt appears only when the title looks generic or metadata is missing / low confidence.</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onSkip} disabled={loading || saving}>
              Skip
            </Button>
            <Button variant="outline" onClick={onSkipAll} disabled={loading || saving}>
              Skip all
            </Button>
            <Button onClick={handleSave} disabled={loading || saving || !draft}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save and continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default UploadMetadataReviewDialog