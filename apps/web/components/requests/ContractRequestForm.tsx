'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Send, Upload, X, FileText, Clock, Shield, CheckCircle2, Paperclip, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const SLA_INFO: Record<string, { label: string; time: string; color: string }> = {
  CRITICAL: { label: 'Critical', time: '4 hours', color: 'text-red-600 bg-red-50 border-red-200' },
  HIGH: { label: 'High', time: '24 hours', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  MEDIUM: { label: 'Medium', time: '3 days', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  LOW: { label: 'Low', time: '7 days', color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = '.pdf,.docx,.doc,.xlsx,.xls,.pptx,.png,.jpg,.jpeg,.txt,.csv';

export default function ContractRequestForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    title: '', description: '', requestType: 'NEW_CONTRACT', urgency: 'MEDIUM',
    department: '', costCenter: '', estimatedValue: '', currency: 'USD',
    counterpartyName: '', counterpartyEmail: '', contractType: '',
    desiredStartDate: '', desiredEndDate: '', businessJustification: '',
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const arr = Array.from(newFiles);
    const valid: File[] = [];
    for (const f of arr) {
      if (files.length + valid.length >= MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files allowed`);
        break;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} exceeds 10MB limit`);
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      // Build attachment metadata (file names/sizes for the DB record)
      const attachmentMeta = files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        uploadedAt: new Date().toISOString(),
      }));

      const res = await fetch('/api/requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          estimatedValue: form.estimatedValue ? parseFloat(form.estimatedValue) : undefined,
          attachments: attachmentMeta,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Contract request submitted!');
        router.push('/self-service/my-requests');
      } else {
        toast.error(json.error?.message || 'Failed to submit');
      }
    } catch { toast.error('Network error'); }
    finally { setSubmitting(false); }
  };

  const sla = SLA_INFO[form.urgency];
  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;
  const canGoNext = step === 1 ? form.title.trim().length > 0 : true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <div className="max-w-3xl mx-auto p-6">
        <Button variant="ghost" className="mb-4 gap-1.5" onClick={() => router.push('/self-service')}>
          <ArrowLeft className="h-4 w-4" /> Self-Service Hub
        </Button>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-500">Step {step} of 3</p>
            <p className="text-xs text-slate-500">{step === 1 ? 'Basics' : step === 2 ? 'Details' : 'Review & Submit'}</p>
          </div>
          <Progress value={progress} className="h-1.5" />
          <div className="flex justify-between mt-1">
            {['Basics', 'Details', 'Submit'].map((s, i) => (
              <span key={s} className={cn('text-[10px]', step > i ? 'text-violet-600 font-medium' : 'text-slate-400')}>{s}</span>
            ))}
          </div>
        </div>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-violet-500" />
              New Contract Request
            </CardTitle>
            <CardDescription>
              {step === 1 ? 'Tell us what you need' : step === 2 ? 'Provide counterparty and financial details' : 'Review and submit your request'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Basics */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label>Title *</Label>
                    <Input value={form.title} onChange={(e) => update('title', e.target.value)}
                      placeholder="e.g. New SaaS vendor agreement with Acme Corp" className="mt-1" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={form.description} onChange={(e) => update('description', e.target.value)}
                      placeholder="Describe the contract need, scope, and any special requirements..." rows={4} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Request Type</Label>
                      <Select value={form.requestType} onValueChange={(v) => update('requestType', v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW_CONTRACT">New Contract</SelectItem>
                          <SelectItem value="RENEWAL">Renewal</SelectItem>
                          <SelectItem value="AMENDMENT">Amendment</SelectItem>
                          <SelectItem value="ADDENDUM">Addendum</SelectItem>
                          <SelectItem value="TERMINATION">Termination</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Urgency</Label>
                      <Select value={form.urgency} onValueChange={(v) => update('urgency', v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(SLA_INFO).map(([key, info]) => (
                            <SelectItem key={key} value={key}>
                              {info.label} — {info.time} SLA
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {sla && (
                        <div className={cn('flex items-center gap-1.5 mt-2 text-xs p-2 rounded-lg border', sla.color)}>
                          <Clock className="h-3 w-3" />
                          Target response: <strong>{sla.time}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Department</Label>
                      <Input value={form.department} onChange={(e) => update('department', e.target.value)}
                        placeholder="e.g. Engineering" className="mt-1" />
                    </div>
                    <div>
                      <Label>Contract Type</Label>
                      <Input value={form.contractType} onChange={(e) => update('contractType', e.target.value)}
                        placeholder="e.g. MSA, SOW, NDA" className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label>Business Justification</Label>
                    <Textarea value={form.businessJustification} onChange={(e) => update('businessJustification', e.target.value)}
                      placeholder="Why is this contract needed? What business problem does it solve?" rows={3} className="mt-1" />
                  </div>
                </div>
              )}

              {/* Step 2: Details */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Counterparty Name</Label>
                      <Input value={form.counterpartyName} onChange={(e) => update('counterpartyName', e.target.value)}
                        placeholder="Vendor / partner name" className="mt-1" />
                    </div>
                    <div>
                      <Label>Counterparty Email</Label>
                      <Input type="email" value={form.counterpartyEmail} onChange={(e) => update('counterpartyEmail', e.target.value)}
                        placeholder="contact@vendor.com" className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Estimated Value</Label>
                      <Input type="number" value={form.estimatedValue} onChange={(e) => update('estimatedValue', e.target.value)}
                        placeholder="0.00" className="mt-1" />
                    </div>
                    <div>
                      <Label>Currency</Label>
                      <Select value={form.currency} onValueChange={(v) => update('currency', v)}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="CHF">CHF</SelectItem>
                          <SelectItem value="JPY">JPY</SelectItem>
                          <SelectItem value="AUD">AUD</SelectItem>
                          <SelectItem value="CAD">CAD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Cost Center</Label>
                      <Input value={form.costCenter} onChange={(e) => update('costCenter', e.target.value)}
                        placeholder="e.g. CC-1234" className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Desired Start Date</Label>
                      <Input type="date" value={form.desiredStartDate} onChange={(e) => update('desiredStartDate', e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>Desired End Date</Label>
                      <Input type="date" value={form.desiredEndDate} onChange={(e) => update('desiredEndDate', e.target.value)} className="mt-1" />
                    </div>
                  </div>

                  {/* File Attachments */}
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5" /> Attachments
                      <span className="text-slate-400 font-normal">({files.length}/{MAX_FILES})</span>
                    </Label>
                    <div
                      className={cn(
                        "mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                        files.length >= MAX_FILES
                          ? "border-slate-200 bg-slate-50 cursor-not-allowed"
                          : "border-slate-300 hover:border-violet-400 hover:bg-violet-50/30"
                      )}
                      onClick={() => files.length < MAX_FILES && fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files); }}
                    >
                      <Upload className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">
                        {files.length >= MAX_FILES ? 'Maximum files reached' : 'Drag & drop files here, or click to browse'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">PDF, DOCX, Excel, images — up to 10MB each</p>
                      <input ref={fileInputRef} type="file" multiple accept={ACCEPTED_TYPES}
                        className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                    </div>
                    {files.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {files.map((file, i) => (
                          <div key={`${file.name}-${i}`} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-violet-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm text-slate-700 truncate">{file.name}</p>
                                <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => removeFile(i)}>
                              <X className="h-3.5 w-3.5 text-slate-400" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
                    <p className="text-sm font-semibold text-violet-800 mb-3">Review Your Request</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <ReviewRow label="Title" value={form.title} />
                      <ReviewRow label="Type" value={form.requestType.replace(/_/g, ' ')} />
                      <ReviewRow label="Urgency" value={`${SLA_INFO[form.urgency]?.label} (${SLA_INFO[form.urgency]?.time} SLA)`} />
                      <ReviewRow label="Contract Type" value={form.contractType} />
                      <ReviewRow label="Department" value={form.department} />
                      <ReviewRow label="Cost Center" value={form.costCenter} />
                      <ReviewRow label="Counterparty" value={form.counterpartyName} />
                      <ReviewRow label="Email" value={form.counterpartyEmail} />
                      <ReviewRow label="Value" value={form.estimatedValue ? `${form.currency} ${parseFloat(form.estimatedValue).toLocaleString()}` : ''} />
                      <ReviewRow label="Start Date" value={form.desiredStartDate} />
                      <ReviewRow label="End Date" value={form.desiredEndDate} />
                      <ReviewRow label="Attachments" value={files.length > 0 ? `${files.length} file(s)` : ''} />
                    </div>
                    {form.description && (
                      <div className="mt-3 pt-3 border-t border-violet-200">
                        <p className="text-xs text-violet-500 font-medium">Description</p>
                        <p className="text-sm text-violet-700 mt-0.5">{form.description}</p>
                      </div>
                    )}
                    {form.businessJustification && (
                      <div className="mt-2">
                        <p className="text-xs text-violet-500 font-medium">Business Justification</p>
                        <p className="text-sm text-violet-700 mt-0.5">{form.businessJustification}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-xs text-emerald-700">
                      Your request will be automatically routed and triaged. You&apos;ll be able to track progress in My Requests.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex justify-between pt-2 border-t">
                <div>
                  {step > 1 && (
                    <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="ghost" onClick={() => router.push('/self-service')}>Cancel</Button>
                  {step < 3 ? (
                    <Button type="button" disabled={!canGoNext} onClick={() => setStep((s) => s + 1)}>
                      Continue
                    </Button>
                  ) : (
                    <Button type="submit" disabled={submitting} className="gap-1.5">
                      <Send className="h-4 w-4" />
                      {submitting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <>
      <p className="text-violet-500">{label}</p>
      <p className="text-violet-800 font-medium">{value}</p>
    </>
  );
}
