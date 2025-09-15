"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { API_BASE_URL } from '../../../../lib/config';
import { tenantHeaders, getTenantId } from '../../../../lib/tenant';
import { CheckCheck, FileEdit, Highlighter, MessageSquare, ShieldCheck, Sparkles, Workflow, X, Upload, FileText, Users, Save, Download, Building2, Briefcase, Settings2, Layers, Search, History } from 'lucide-react';

// Local types to mirror API shapes (kept minimal to avoid tight coupling)
type Party = 'client' | 'supplier' | 'ai';
type Range = { start: number; end: number };
type Suggestion = { id: string; type: string; message: string; createdAt: string; status?: 'pending' | 'needs-approval' | 'approved' | 'accepted' | 'rejected'; approverRole?: string };
type ApprovalTask = { id: string; message: string; approverRole?: string };
type CommentItem = { id: string; author: Party; text: string; createdAt: string; range?: Range; status?: 'open'|'resolved'|'rejected' };
type HighlightItem = { id: string; author: Party; color: string; note?: string; range?: Range; createdAt: string; status?: 'open' | 'approved'; approvedBy?: string; approvedAt?: string };
type TemplateItem = { id: string; name: string; clientId?: string; lob?: string; tags?: string[]; version?: number; updatedAt?: string; changeNote?: string; parentId?: string; tenantId?: string };
type PolicyPack = { id: string; name?: string };

function WorkspacePageClient({ params }: { params: { docId: string } }) {
  const { docId } = params;
  const searchParams = useSearchParams();

  // Role
  const initialRole = (searchParams.get('role') as Party) || 'client';
  const [role, setRole] = useState<Party>(initialRole);
  useEffect(() => {
    const qRole = searchParams.get('role');
    if (qRole === 'client' || qRole === 'supplier') setRole(qRole);
  }, [searchParams]);

  // Content and negotiation state
  const [content, setContent] = useState<string>('');
  const [savedContent, setSavedContent] = useState<string>('');
  const [aiSuggestions, setAiSuggestions] = useState<Suggestion[]>([]);
  const [approvalTasks, setApprovalTasks] = useState<ApprovalTask[]>([]);
  const [checklist, setChecklist] = useState<any>(null);

  // Meta state
  const [contractType, setContractType] = useState<string>('MSA');
  const [clientId, setClientId] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [policyPackId, setPolicyPackId] = useState<string>('');
  const [policyPacks, setPolicyPacks] = useState<PolicyPack[]>([]);
  const [clientDefaults, setClientDefaults] = useState<Record<string, string>>({});
  const [metaSaving, setMetaSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // UI state
  const [inviteOpen, setInviteOpen] = useState<boolean>(false);
  const [activeRightTab, setActiveRightTab] = useState<'ai' | 'compliance' | 'tasks'>('ai');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  // Autosave state
  const [autoSave, setAutoSave] = useState<'idle'|'dirty'|'saving'|'saved'|'error'>('idle');
  // Local recovery flag
  const [restoredLocal, setRestoredLocal] = useState<boolean>(false);
  // In-doc search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchIdx, setSearchIdx] = useState<number>(0);
  const searchMatches = useMemo(() => {
    const term = searchTerm.trim();
    if (!term) return [] as Array<{ start: number; end: number }>;
    const out: Array<{ start: number; end: number }> = [];
    const lower = content.toLowerCase();
    const t = term.toLowerCase();
    let i = 0;
    while (i < lower.length) {
      const k = lower.indexOf(t, i);
      if (k === -1) break;
      out.push({ start: k, end: k + t.length });
      i = k + Math.max(1, t.length);
    }
    return out;
  }, [content, searchTerm]);
  useEffect(() => { if (searchIdx >= searchMatches.length) setSearchIdx(0); }, [searchMatches.length]);

  // Templates
  const [tplOpen, setTplOpen] = useState<boolean>(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [tplClient, setTplClient] = useState<string>('');
  const [tplLob, setTplLob] = useState<string>('');
  const [tplTags, setTplTags] = useState<string>('');
  // Template history/versioning UI
  const [tplHistoryOpen, setTplHistoryOpen] = useState<boolean>(false);
  const [tplHistoryFor, setTplHistoryFor] = useState<TemplateItem | null>(null);
  const [tplHistory, setTplHistory] = useState<TemplateItem[] | null>(null);
  const [tplNewVersionName, setTplNewVersionName] = useState<string>('');
  const [tplNewVersionNote, setTplNewVersionNote] = useState<string>('');

  // Comments (local UI for now; API exists for selection comments)
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentInput, setCommentInput] = useState<string>('');
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [showHighlights, setShowHighlights] = useState<boolean>(true);

  // Text selection state
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [taScrollTop, setTaScrollTop] = useState<number>(0);
  const [lineHeightPx, setLineHeightPx] = useState<number>(24);
  const [approvedHighlightIds, setApprovedHighlightIds] = useState<Set<string>>(new Set());
  const [tooltipInput, setTooltipInput] = useState<string>('');
  const [selection, setSelection] = useState<Range | null>(null);
  const [selOpen, setSelOpen] = useState<boolean>(false);
  const [selApprover, setSelApprover] = useState<string>('');
  // Color is derived: procurement = yellow, client/supplier = light blue
  // Removed unused selColor state (color derived at usage time)
  const [selNote, setSelNote] = useState<string>('');
  // Optional proposed replacement text for selected range
  const [selProposedText, setSelProposedText] = useState<string>('');

  // Track changes toggle
  const [trackChanges, setTrackChanges] = useState<boolean>(false);

  // Outline derived from content
  const outline = useMemo(() => {
    const lines = content.split(/\r?\n/);
    const items: { idx: number; title: string }[] = [];
    const reNum = /^\s*(\d+(?:\.\d+)*)[\).]?\s+(.*)$/;
    const reHash = /^\s*#{1,6}\s+(.*)$/;
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      const m1 = L.match(reNum);
      if (m1) { items.push({ idx: i, title: `${m1[1]} ${m1[2].trim()}` }); continue; }
      const m2 = L.match(reHash);
      if (m2) { items.push({ idx: i, title: m2[1].trim() }); continue; }
    }
    // Fallback: grab first lines of paragraphs
    if (items.length === 0) {
      let paraStart = true;
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        if (L.trim().length === 0) { paraStart = true; continue; }
        if (paraStart) {
          items.push({ idx: i, title: L.trim().slice(0, 60) + (L.trim().length > 60 ? '…' : '') });
          paraStart = false;
        }
      }
    }
    return items.slice(0, 50);
  }, [content]);

  // Line offsets for mapping ranges to sections
  const lineOffsets = useMemo(() => {
    const arr: number[] = [];
    let pos = 0;
    for (const L of content.split(/\r?\n/)) {
      arr.push(pos);
      pos += L.length + 1; // include newline
    }
    return arr;
  }, [content]);

  const outlineWithPos = useMemo(() => {
    // Map outline[idx] -> absolute char position (lineOffsets[idx])
    return outline.map(o => ({ ...o, pos: lineOffsets[o.idx] ?? 0 }));
  }, [outline, lineOffsets]);

  // Group comments by nearest preceding outline item
  const commentsBySection = useMemo(() => {
    if (comments.length === 0 || outlineWithPos.length === 0) return {} as Record<string, CommentItem[]>;
    const buckets: Record<string, CommentItem[]> = {};
    for (const c of comments) {
      const start = (c as any).range?.start ?? 0;
      // find last outline where pos <= start
      let kIdx = 0;
      for (let i = 0; i < outlineWithPos.length; i++) {
        if (outlineWithPos[i].pos <= start) kIdx = i; else break;
      }
      const key = `${kIdx}:${outlineWithPos[kIdx].title}`;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(c);
    }
    return buckets;
  }, [comments, outlineWithPos]);

  // Jump helpers
  const jumpToPos = useCallback((pos: number) => {
    const el = taRef.current;
    if (!el) return;
    const p = Math.max(0, Math.min(content.length, pos));
    el.focus();
    el.setSelectionRange(p, p);
    // attempt to scroll caret into view
    const lines = content.slice(0, p).split(/\n/).length;
    el.scrollTop = Math.max(0, (lines - 3) * 18);
  }, [content]);
  const jumpToRange = useCallback((start: number, end: number) => {
    const el = taRef.current; if (!el) return;
    const s = Math.max(0, Math.min(content.length, start));
    const e = Math.max(s, Math.min(content.length, end));
    el.focus();
    el.setSelectionRange(s, e);
    const lines = content.slice(0, s).split(/\n/).length;
    el.scrollTop = Math.max(0, (lines - 3) * lineHeightPx);
  }, [content, lineHeightPx]);

  // Helpers
  const fetchOrInit = useCallback(async () => {
    try {
      // Try get existing negotiation state
  let r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate`, { headers: tenantHeaders() });
      if (!r.ok) {
        // Attempt to initialize if missing
  await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/init`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }) });
  r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate`, { headers: tenantHeaders() });
      }
      if (r.ok) {
        const s = await r.json();
        if (typeof s?.content === 'string') { setContent(s.content); setSavedContent(s.content); }
        if (Array.isArray(s?.suggestions)) setAiSuggestions(s.suggestions);
  if (Array.isArray(s?.comments)) setComments(s.comments);
  if (Array.isArray(s?.highlights)) setHighlights(s.highlights);
        if (s?.meta) {
          if (s.meta.contractType) setContractType(s.meta.contractType);
          if (s.meta.clientId) setClientId(s.meta.clientId);
          if (s.meta.supplierId) setSupplierId(s.meta.supplierId);
          if (s.meta.policyPackId) setPolicyPackId(s.meta.policyPackId);
        }
      }
    } catch {
      // no-op
    }
  }, [docId]);

  useEffect(() => { void fetchOrInit(); }, [fetchOrInit]);

  // Attempt local recovery once after initial load
  useEffect(() => {
    if (restoredLocal) return;
    try {
      const key = `workspace.${docId}.buffer`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw || 'null');
      if (parsed && typeof parsed.text === 'string' && parsed.text && parsed.text !== savedContent) {
        setContent(parsed.text as string);
        setAutoSave('dirty');
        setToast({ type: 'success', msg: 'Recovered local draft' });
        setTimeout(() => setToast(null), 1500);
        try { window.localStorage.removeItem(key); } catch {}
      }
    } catch {}
    setRestoredLocal(true);
  }, [docId, savedContent, restoredLocal]);

  // Persist buffer locally on change (lightweight autosave for recovery)
  useEffect(() => {
    try {
      const key = `workspace.${docId}.buffer`;
      const payload = JSON.stringify({ text: content, ts: Date.now() });
      window.localStorage.setItem(key, payload);
    } catch {}
  }, [docId, content]);

  // Load policy packs and client defaults
  useEffect(() => {
    (async () => {
      try {
  const r = await fetch(`${API_BASE_URL}/api/policies/packs`, { headers: tenantHeaders() });
        if (r.ok) {
          const j = await r.json();
          setPolicyPacks(Array.isArray(j?.packs) ? j.packs : []);
        }
      } catch {}
    })();
    (async () => {
      try {
  const r = await fetch(`${API_BASE_URL}/api/policies/clients`, { headers: tenantHeaders() });
        if (r.ok) {
          const j = await r.json();
          if (j && typeof j.defaults === 'object') setClientDefaults(j.defaults);
        }
      } catch {}
    })();
  }, []);

  // Suggest a default policy pack when clientId changes
  useEffect(() => {
    if (!clientId) return;
    const suggested = clientDefaults[clientId];
    if (suggested && !policyPackId) setPolicyPackId(suggested);
  }, [clientId, clientDefaults, policyPackId]);

  // Load approval tasks
  const loadTasks = useCallback(async () => {
    try {
  const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/tasks`, { headers: tenantHeaders() });
      if (r.ok) {
        const j = await r.json();
        setApprovalTasks(Array.isArray(j?.approvals) ? j.approvals : []);
      }
    } catch {}
  }, [docId]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);

  // Load templates list (optionally filtered)
  const loadTemplates = useCallback(async (filters?: { clientId?: string; lob?: string; tags?: string[] }) => {
    try {
      const params = new URLSearchParams();
      if (filters?.clientId) params.set('clientId', filters.clientId);
      if (filters?.lob) params.set('lob', filters.lob);
      if (filters?.tags && filters.tags.length) params.set('tags', filters.tags.join(','));
      const url = `${API_BASE_URL}/api/templates${params.toString() ? `?${params.toString()}` : ''}`;
  const r = await fetch(url, { headers: tenantHeaders() });
      if (r.ok) {
        const j = await r.json();
        setTemplates(Array.isArray(j?.templates) ? j.templates : []);
      }
    } catch {}
  }, []);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  // Selection helpers
  const updateSelectionFromTA = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start !== end) {
      setSelection({ start, end });
      setSelOpen(true);
    } else {
      setSelection(null);
      setSelOpen(false);
    }
  }, []);

  // Sync textarea scroll and measure line height for precise marker positioning
  const onEditorScroll = useCallback(() => {
    const el = taRef.current; if (!el) return;
    setTaScrollTop(el.scrollTop);
  }, []);
  useEffect(() => {
    const el = taRef.current; if (!el) return;
    const cs = window.getComputedStyle(el);
    const lh = cs.lineHeight;
    const px = lh.endsWith('px') ? parseFloat(lh) : 24;
    setLineHeightPx(px || 24);
  }, [taRef.current]);

  const charToLine = useCallback((pos: number) => {
    // binary search in lineOffsets
    const arr = lineOffsets;
    let lo = 0, hi = arr.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= pos) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return ans;
  }, [lineOffsets]);

  // Actions
  const saveDraft = useCallback(async () => {
    try {
  await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/content`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ content, by: role }) });
      setToast({ type: 'success', msg: 'Draft saved' });
      setTimeout(() => setToast(null), 1500);
  setSavedContent(content);
      setAutoSave('saved');
      setTimeout(() => setAutoSave('idle'), 1200);
    } catch {}
  }, [docId, content, role]);

  // Debounced autosave when content changes
  useEffect(() => {
    if (content === savedContent) { return; }
    setAutoSave('dirty');
    const id = setTimeout(async () => {
      try {
        setAutoSave('saving');
        await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/content`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ content, by: role }) });
        setSavedContent(content);
        setAutoSave('saved');
        setTimeout(() => setAutoSave('idle'), 900);
      } catch {
        setAutoSave('error');
      }
    }, 800);
    return () => clearTimeout(id);
  }, [content]);

  const addAISuggestion = useCallback(async () => {
    try {
  const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/ai/suggest`, { headers: tenantHeaders() });
      if (!r.ok) return;
      const data = await r.json();
      const s = data?.suggestions?.[0];
      if (!s) return;
  await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ createdBy: 'ai', type: s.type, message: s.message, patch: s.patch }) });
      await fetchOrInit();
      await loadTasks();
    } catch {}
  }, [docId, fetchOrInit, loadTasks]);

  const runChecklist = useCallback(async () => {
    try {
      let chosenPack: string | undefined = undefined;
      try {
  const g = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate`, { headers: tenantHeaders() });
        if (g.ok) { const s = await g.json(); chosenPack = s?.meta?.policyPackId; }
      } catch {}
  const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/checklist`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ policyPackId: chosenPack || 'default', includeRateBaseline: true }) });
      if (r.ok) setChecklist(await r.json());
    } catch {}
  }, [docId]);

  const applyTemplate = useCallback(async (templateId: string) => {
    try {
  const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/apply-template/${templateId}`, { method: 'POST', headers: tenantHeaders() });
      if (!r.ok) return;
      const data = await r.json();
      setContent(String(data?.negotiation?.content || ''));
      setTplOpen(false);
    } catch {}
  }, [docId]);

  const uploadTemplate = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    if (tplClient.trim()) fd.append('clientId', tplClient.trim());
    if (tplLob.trim()) fd.append('lob', tplLob.trim());
    if (tplTags.trim()) fd.append('tags', tplTags.trim());
    try { const tid = getTenantId(); if (tid) fd.append('tenantId', tid); } catch {}
  const r = await fetch(`${API_BASE_URL}/api/templates/upload`, { method: 'POST', body: fd, headers: tenantHeaders() });
    if (r.ok) {
      await loadTemplates({ clientId: tplClient.trim() || undefined, lob: tplLob.trim() || undefined, tags: tplTags.trim() ? tplTags.split(',').map(s => s.trim()).filter(Boolean) : undefined });
    }
  }, [loadTemplates, tplClient, tplLob, tplTags]);

  // Template history/version helpers
  const openTemplateHistory = useCallback(async (t: TemplateItem) => {
    try {
      setTplHistoryOpen(true);
      setTplHistoryFor(t);
      setTplHistory(null);
      setTplNewVersionName(t.name || '');
      setTplNewVersionNote('');
      const r = await fetch(`${API_BASE_URL}/api/templates/${t.id}/history`, { headers: tenantHeaders() });
      if (r.ok) {
        const j = await r.json();
        const list = Array.isArray(j?.history) ? (j.history as TemplateItem[]) : [];
        setTplHistory(list);
      } else {
        setTplHistory([]);
      }
    } catch {
      setTplHistory([]);
    }
  }, []);

  const createNewTemplateVersion = useCallback(async () => {
    if (!tplHistoryFor) return;
    try {
      const body: any = { text: content };
      if (tplNewVersionName && tplNewVersionName.trim()) body.name = tplNewVersionName.trim();
      if (tplNewVersionNote && tplNewVersionNote.trim()) body.changeNote = tplNewVersionNote.trim();
      const r = await fetch(`${API_BASE_URL}/api/templates/${tplHistoryFor.id}/version`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify(body) });
      if (r.ok) {
        setToast({ type: 'success', msg: 'New template version created' });
        setTimeout(() => setToast(null), 1500);
        await openTemplateHistory(tplHistoryFor);
        await loadTemplates();
      } else {
        setToast({ type: 'error', msg: 'Failed to create version' });
        setTimeout(() => setToast(null), 1500);
      }
    } catch {
      setToast({ type: 'error', msg: 'Failed to create version' });
      setTimeout(() => setToast(null), 1500);
    }
  }, [tplHistoryFor, tplNewVersionName, tplNewVersionNote, content, loadTemplates, openTemplateHistory]);

  // Suggestion actions
  const acceptSuggestion = useCallback(async (id: string) => {
    try {
  const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest/${id}/resolve`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ action: 'accept', by: role }) });
      if (r.ok) { await fetchOrInit(); await loadTasks(); }
    } catch {}
  }, [docId, role, fetchOrInit, loadTasks]);

  const rejectSuggestion = useCallback(async (id: string) => {
    try {
  const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest/${id}/resolve`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ action: 'reject', by: role }) });
      if (r.ok) { await fetchOrInit(); await loadTasks(); }
    } catch {}
  }, [docId, role, fetchOrInit, loadTasks]);

  const approveSuggestion = useCallback(async (id: string, approverRole?: string) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest/${id}/approve`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ role: approverRole || 'Procurement', by: role }) });
      if (r.ok) {
        // Auto-apply approved suggestions
        await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest/${id}/resolve`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ action: 'accept', by: role }) });
        await fetchOrInit();
        await loadTasks();
      }
    } catch {}
  }, [docId, role, fetchOrInit, loadTasks]);

  const addComment = useCallback(async () => {
    const text = commentInput.trim();
    if (!text) return;
    try {
  await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/comment`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ author: role, text, channel: role === 'supplier' ? 'supplier' : 'client' }) });
      setCommentInput('');
      await fetchOrInit();
    } catch {}
  }, [commentInput, role, docId, fetchOrInit]);

  // Simple word-level diff for track changes preview
  function tokenize(s: string): string[] {
    return s.split(/(\s+|\b)/).filter(t => t.length > 0);
  }
  type DiffSeg = { type: 'eq' | 'add' | 'del'; text: string };
  function diffTokens(a: string[], b: string[]): DiffSeg[] {
    const n = a.length, m = b.length;
    if (n * m > 2_000_000) { // safety guard
      return [{ type: 'eq', text: '' }];
    }
    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1; else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const out: DiffSeg[] = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { out.push({ type: 'eq', text: a[i++] }); j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: a[i++] }); }
      else { out.push({ type: 'add', text: b[j++] }); }
    }
    while (i < n) out.push({ type: 'del', text: a[i++] });
    while (j < m) out.push({ type: 'add', text: b[j++] });
    return out;
  }
  const trackPreview = useMemo(() => {
    if (!trackChanges) return null;
    const A = tokenize(savedContent);
    const B = tokenize(content);
    const segs = diffTokens(A, B);
    return (
      <div className="mt-2 text-sm leading-6 border rounded p-2">
        {segs.map((s, idx) => s.type === 'eq' ? <span key={idx}>{s.text}</span> : s.type === 'add' ? <span key={idx} className="bg-green-100 text-green-800 rounded-sm">{s.text}</span> : <span key={idx} className="bg-red-100 text-red-800 line-through rounded-sm">{s.text}</span>)}
      </div>
    );
  }, [trackChanges, savedContent, content]);

  // Render read-only highlighted content preview
  // Removed unused highlightedPreview memo (not rendered)

  // Inline overlay: background color under text and gutter markers with tooltips
  const [hoverMarker, setHoverMarker] = useState<null | { id: string; type: 'highlight' | 'comment'; text?: string; top: number; status?: 'open'|'approved'; approvedBy?: string; approvedAt?: string }>(null);
  const overlayContent = useMemo(() => {
    if (!showHighlights && comments.every(c => !c.range) && (!searchTerm.trim() || searchMatches.length === 0)) return null;
    // Build combined segments by start/end with styles for highlights and comment ranges
    type Seg = { from: number; to: number; bg?: string; underline?: boolean };
    const segs: Seg[] = [];
    for (const h of highlights) {
      if (!h.range) continue;
      if (h.status === 'approved' || approvedHighlightIds.has(h.id)) continue;
      const a = Math.max(0, Math.min(content.length, h.range.start));
      const b = Math.max(0, Math.min(content.length, h.range.end));
      if (b <= a) continue;
  // Constrain to our palette if missing
  const bg = h.color ? h.color : '#fef08a';
  if (showHighlights) segs.push({ from: a, to: b, bg });
    }
    for (const c of comments) {
      const r = c.range; if (!r) continue;
      const a = Math.max(0, Math.min(content.length, r.start));
      const b = Math.max(0, Math.min(content.length, r.end));
      if (b <= a) continue;
      segs.push({ from: a, to: b, underline: true });
    }
    // In-document search highlights (light blue)
    if (searchTerm.trim() && searchMatches.length) {
      for (const m of searchMatches) {
        const a = Math.max(0, Math.min(content.length, m.start));
        const b = Math.max(0, Math.min(content.length, m.end));
        if (b > a) segs.push({ from: a, to: b, bg: '#dbeafe' });
      }
    }
    if (segs.length === 0) return null;
    segs.sort((x, y) => x.from - y.from || x.to - y.to);
    // split into non-overlapping with priority to bg highlights
    const merged: Seg[] = [];
    let cursor = 0;
    const pushPlain = (start: number, end: number) => {
      if (end <= start) return;
      merged.push({ from: start, to: end });
    };
    for (const s of segs) {
      if (s.from > cursor) pushPlain(cursor, s.from);
      merged.push({ ...s });
      cursor = Math.max(cursor, s.to);
    }
    if (cursor < content.length) pushPlain(cursor, content.length);
    // render
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < merged.length; i++) {
      const s = merged[i];
      const text = content.slice(s.from, s.to);
      const style: React.CSSProperties = {};
      if (s.bg) style.background = s.bg;
      if (s.underline) style.textDecoration = 'underline';
      nodes.push(<span key={`ov-${i}`} style={style}>{text}</span>);
    }
    return <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <div className="p-3 font-mono text-sm leading-6 whitespace-pre-wrap break-words" style={{ transform: `translateY(${-taScrollTop}px)` }}>
        {nodes}
      </div>
    </div>;
  }, [showHighlights, comments, highlights, content, taScrollTop, approvedHighlightIds, searchTerm, searchMatches.length]);

  const markerNodes = useMemo(() => {
    const markers: Array<{ id: string; type: 'highlight'|'comment'; top: number; text?: string; color?: string; start: number; end: number; status?: 'open'|'approved'; approvedBy?: string; approvedAt?: string }> = [];
    const pad = 12; // p-3
    for (const h of highlights) {
      if (!h.range) continue;
      if (h.status === 'approved' || approvedHighlightIds.has(h.id)) continue;
      const ln = charToLine(h.range.start);
      const top = pad + ln * lineHeightPx - taScrollTop;
  markers.push({ id: h.id, type: 'highlight', top, text: h.note, color: h.color || '#fef08a', start: h.range.start, end: h.range.end, status: h.status, approvedBy: (h as any).approvedBy, approvedAt: (h as any).approvedAt });
    }
    for (const c of comments) {
      if (!c.range) continue;
      const ln = charToLine(c.range.start);
      const top = pad + ln * lineHeightPx - taScrollTop;
      markers.push({ id: c.id, type: 'comment', top, text: `${c.author}: ${c.text}`, color: undefined, start: c.range.start, end: c.range.end });
    }
    return markers;
  }, [highlights, comments, charToLine, lineHeightPx, taScrollTop, approvedHighlightIds]);

  // Snapshot modal state
  const [snapOpen, setSnapOpen] = useState<boolean>(false);
  const [snapshots, setSnapshots] = useState<Array<{ id: string; createdAt: string; author: string; label?: string; version: number }>>([]);
  // Removed unused snapBusy state
  const [snapDiff, setSnapDiff] = useState<null | { snapshotId: string; fromVersion: number; toVersion: number; summary: { adds: number; dels: number; equals: number } }>(null);
  const loadSnapshots = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/snapshots`, { headers: tenantHeaders() });
      if (r.ok) {
        const j = await r.json();
        setSnapshots(Array.isArray(j?.snapshots) ? j.snapshots : []);
      }
    } catch {}
  }, [docId]);
  const createSnap = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/snapshots`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ by: role }) });
      if (r.ok) { await loadSnapshots(); }
    } catch {}
  }, [docId, role, loadSnapshots]);
  const viewSnapDiff = useCallback(async (sid: string) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/snapshots/${sid}/diff`, { headers: tenantHeaders() });
      if (r.ok) setSnapDiff(await r.json()); else setSnapDiff(null);
    } catch { setSnapDiff(null); }
  }, [docId]);

  // Invite helpers
  const makeInviteUrl = useCallback((target: Party) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const path = `/drafts/workspace/${docId}?role=${target}`;
    return `${base}${path}`;
  }, [docId]);

  const copyInvite = useCallback(async (target: Party) => {
    const url = makeInviteUrl(target);
    try {
      await navigator.clipboard.writeText(url);
      alert(`${target} invite link copied to clipboard`);
    } catch {
      prompt('Copy this link', url);
    }
  }, [makeInviteUrl]);

  const mailtoInvite = useCallback((target: Party) => {
    const url = makeInviteUrl(target);
    const subject = encodeURIComponent(`Invitation to collaborate on contract ${docId}`);
    const body = encodeURIComponent(`Hi,\n\nPlease join the negotiation workspace as ${target}:\n${url}\n\nThanks!`);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [docId, makeInviteUrl]);

  // Derived findings UI
  const coloredFindings = useMemo(() => {
    const list: Array<{ kind: 'policy' | 'warn' | 'fail' | 'benchmark'; text: string }> = [];
    if (checklist?.compliance) {
      for (const c of checklist.compliance) {
        list.push({ kind: c.status === 'PASS' ? 'policy' : (c.status === 'WARN' ? 'warn' : 'fail'), text: `${c.policyId}: ${c.status}${c.details ? ` — ${c.details}` : ''}` });
      }
    }
    if (checklist?.governingLaw) {
      const g = checklist.governingLaw;
      list.push({ kind: g.status === 'PASS' ? 'policy' : (g.status === 'WARN' ? 'warn' : 'fail'), text: `Governing law expected ${g.expected || '—'}, found ${g.found || '—'} (${g.status})` });
    }
    if (checklist?.rateBaseline?.gaps?.length) {
      for (const gap of checklist.rateBaseline.gaps) {
        list.push({ kind: 'benchmark', text: `${gap.role} ${gap.seniority || ''} above P${checklist.rateBaseline.capPercentile} cap: ${gap.found.toFixed(0)} > ${gap.baseline.toFixed(0)} (Δ ${gap.delta.toFixed(0)})` });
      }
    }
    if (!list.length) return <div className="text-xs text-gray-500">Run checklist to see compliance and benchmark alerts.</div>;
    return (
      <ul className="space-y-2">
        {list.map((it, i) => (
          <li key={i} className={`text-sm p-2 rounded border ${it.kind === 'fail' ? 'bg-red-50 border-red-200' : it.kind === 'warn' ? 'bg-yellow-50 border-yellow-200' : it.kind === 'benchmark' ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
            {it.text}
          </li>
        ))}
      </ul>
    );
  }, [checklist]);

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed right-4 top-4 z-50 px-3 py-2 rounded shadow text-sm ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>{toast.msg}</div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between sticky top-0 bg-white/70 backdrop-blur z-30 border-b py-2 px-1">
        <div className="flex items-center gap-3">
          <Link href={`/drafts`} className="text-sm text-indigo-600">← Drafts</Link>
          <h1 className="text-lg font-semibold flex items-center gap-2"><FileEdit className="w-5 h-5 text-indigo-600"/> Negotiation & Drafting Workspace</h1>
          <span className="text-[11px] text-gray-500">Doc: {docId}</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Invite */}
          <div className="relative">
            <button onClick={() => setInviteOpen(v => !v)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm border hover:bg-gray-50"><Users className="w-4 h-4"/> Invite</button>
            {inviteOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded border bg-white shadow-md z-10 p-2 space-y-2">
                <div className="text-xs text-gray-600">Share collaboration links</div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Invite Client</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => copyInvite('client')} className="text-xs px-2 py-0.5 rounded border hover:bg-gray-50">Copy</button>
                      <a href={mailtoInvite('client')} className="text-xs px-2 py-0.5 rounded border">Email</a>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Invite Supplier</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => copyInvite('supplier')} className="text-xs px-2 py-0.5 rounded border hover:bg-gray-50">Copy</button>
                      <a href={mailtoInvite('supplier')} className="text-xs px-2 py-0.5 rounded border">Email</a>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-gray-500">Links include role preselection. Add auth or tokens later.</div>
              </div>
            )}
          </div>

          {/* Meta controls */}
          <div className="hidden lg:flex items-center gap-2 px-2">
            <div className="h-5 w-px bg-gray-200"/>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-600"><Layers className="w-3.5 h-3.5"/> Type</div>
              <select value={contractType} onChange={(e) => setContractType(e.target.value)} className="border rounded px-2 py-1 text-sm hover:bg-gray-50">
                {['MSA', 'SOW', 'LOI', 'Secondment'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-600"><Building2 className="w-3.5 h-3.5"/> Client</div>
              <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="ID" className="border rounded px-2 py-1 text-sm w-28 hover:bg-gray-50"/>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-600"><Briefcase className="w-3.5 h-3.5"/> Supplier</div>
              <input value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="ID" className="border rounded px-2 py-1 text-sm w-28 hover:bg-gray-50"/>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-600"><Settings2 className="w-3.5 h-3.5"/> Pack</div>
              {policyPacks.length > 0 ? (
                <select value={policyPackId} onChange={(e) => setPolicyPackId(e.target.value)} className="border rounded px-2 py-1 text-sm hover:bg-gray-50">
                  <option value="">Select pack</option>
                  {policyPacks.map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                </select>
              ) : (
                <input value={policyPackId} onChange={(e) => setPolicyPackId(e.target.value)} placeholder="Policy Pack" className="border rounded px-2 py-1 text-sm w-28"/>
              )}
            </div>
            {clientId && !policyPackId ? (
              <span className="text-[11px] text-amber-700">Select a policy pack</span>
            ) : null}
            <button onClick={async () => {
              try {
                setMetaSaving('saving');
                const body: any = { contractType, clientId, supplierId, policyPackId };
                const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/meta`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify(body) });
                if (!r.ok) throw new Error('save failed');
                setMetaSaving('saved');
                setToast({ type: 'success', msg: 'Metadata saved' });
                await Promise.all([loadTasks(), runChecklist()]);
                setTimeout(() => setMetaSaving('idle'), 1200);
                setTimeout(() => setToast(null), 1600);
              } catch {
                setMetaSaving('error');
                setToast({ type: 'error', msg: 'Failed to save metadata' });
                setTimeout(() => setToast(null), 2200);
              }
            }} disabled={metaSaving === 'saving' || (Boolean(clientId) && !policyPackId)} className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm border hover:bg-gray-50 ${metaSaving === 'saving' || (clientId && !policyPackId) ? 'opacity-60 cursor-not-allowed' : ''}`}>{metaSaving === 'saving' ? <><Save className="w-4 h-4 animate-pulse"/> Saving…</> : metaSaving === 'saved' ? <><Save className="w-4 h-4"/> Saved</> : <><Save className="w-4 h-4"/> Save meta</>}</button>
          </div>

          <div className="h-5 w-px bg-gray-200"/>
          <select value={role} onChange={(e) => setRole(e.target.value as Party)} className="border rounded px-2 py-1 text-sm hover:bg-gray-50">
            <option value="client">Client</option>
            <option value="supplier">Supplier</option>
          </select>
          <div className="text-[11px] text-gray-500 min-w-[100px] text-right">
            {autoSave === 'saving' ? 'Saving…' : autoSave === 'saved' ? 'Saved' : autoSave === 'dirty' ? 'Unsaved changes' : ''}
          </div>
          <button onClick={saveDraft} className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm bg-indigo-600 text-white hover:bg-indigo-700"><Save className="w-4 h-4"/> Save</button>
          <a href={`${API_BASE_URL}/api/contracts/${docId}/negotiate/export`} target="_blank" className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm border hover:bg-gray-50"><Download className="w-4 h-4"/> Export</a>
          <button onClick={() => { setSnapOpen(true); loadSnapshots(); }} className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm border hover:bg-gray-50"><History className="w-4 h-4"/> Snapshots</button>
        </div>
      </div>

      {/* Layout grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr,360px] gap-4">
        {/* Left outline */}
        <div className="rounded border p-3 space-y-2">
          <div className="text-sm font-medium">Outline</div>
          <div className="text-xs text-gray-500">Auto-generated from content</div>
          <ul className="text-sm space-y-1 max-h-72 overflow-auto">
            {outlineWithPos.length === 0 ? <li className="text-xs text-gray-500">No sections detected</li> : outlineWithPos.map((o, i) => (
              <li key={`${o.idx}-${i}`} className="truncate cursor-pointer hover:underline" onClick={() => jumpToPos(o.pos)}>{o.title}</li>
            ))}
          </ul>
        </div>

        {/* Main editor */}
        <div className="space-y-2">
          {/* Toolbar */}
          <div className="flex items-center justify-between rounded border p-2">
            <div className="flex items-center gap-2">
              <button title="Toggle track changes" onClick={() => setTrackChanges(v => !v)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${trackChanges ? 'bg-indigo-50 border-indigo-300' : ''}`}><Highlighter className="w-3.5 h-3.5"/> Track changes</button>
              <button title="Toggle highlights" onClick={() => setShowHighlights(v => !v)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${showHighlights ? 'bg-yellow-50 border-yellow-300' : ''}`}><Highlighter className="w-3.5 h-3.5"/> Highlights</button>
              <div className="hidden md:flex items-center gap-2 text-[11px] ml-1">
                <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background:'#fef08a' }}/><span>Procurement</span></span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background:'#dbeafe' }}/><span>Client/Supplier</span></span>
              </div>
              <button onClick={addAISuggestion} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-600 text-white"><Sparkles className="w-3.5 h-3.5"/> AI Suggest</button>
              <button onClick={runChecklist} className="flex items-center gap-1 text-xs px-2 py-1 rounded border"><ShieldCheck className="w-3.5 h-3.5"/> Checklist</button>
              <div className="hidden md:flex items-center gap-1 ml-2">
                <Search className="w-3.5 h-3.5 text-gray-500"/>
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search doc" className="border rounded px-2 py-1 text-xs w-40"/>
                <span className="text-[11px] text-gray-500">{searchMatches.length || 0}</span>
                <button disabled={!searchMatches.length} onClick={() => {
                  if (!searchMatches.length) return;
                  const next = (searchIdx - 1 + searchMatches.length) % searchMatches.length;
                  setSearchIdx(next);
                  const r = searchMatches[next];
                  jumpToRange(r.start, r.end);
                }} className={`text-[11px] px-2 py-0.5 rounded border ${!searchMatches.length ? 'opacity-50 cursor-not-allowed' : ''}`}>Prev</button>
                <button disabled={!searchMatches.length} onClick={() => {
                  if (!searchMatches.length) return;
                  const next = (searchIdx + 1) % searchMatches.length;
                  setSearchIdx(next);
                  const r = searchMatches[next];
                  jumpToRange(r.start, r.end);
                }} className={`text-[11px] px-2 py-0.5 rounded border ${!searchMatches.length ? 'opacity-50 cursor-not-allowed' : ''}`}>Next</button>
              </div>
              <div className="relative">
                <button onClick={() => setTplOpen(v => !v)} className="flex items-center gap-1 text-xs px-2 py-1 rounded border"><FileText className="w-3.5 h-3.5"/> Templates</button>
                {tplOpen && (
                  <div className="absolute z-10 mt-2 w-80 rounded border bg-white shadow p-2">
                    <div className="text-xs text-gray-600 mb-1">Apply a template or upload a new one</div>
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      <input value={tplClient} onChange={(e) => setTplClient(e.target.value)} placeholder="Client" className="border rounded px-1 py-0.5 text-xs col-span-1"/>
                      <input value={tplLob} onChange={(e) => setTplLob(e.target.value)} placeholder="LOB" className="border rounded px-1 py-0.5 text-xs col-span-1"/>
                      <input value={tplTags} onChange={(e) => setTplTags(e.target.value)} placeholder="tags (a,b)" className="border rounded px-1 py-0.5 text-xs col-span-1"/>
                      <div className="col-span-3 flex items-center justify-end gap-1">
                        <button onClick={() => { setTplClient(''); setTplLob(''); setTplTags(''); loadTemplates(); }} className="text-[11px] px-2 py-0.5 rounded border">Clear</button>
                        <button onClick={() => loadTemplates({ clientId: tplClient.trim() || undefined, lob: tplLob.trim() || undefined, tags: tplTags.trim() ? tplTags.split(',').map(s => s.trim()).filter(Boolean) : undefined })} className="text-[11px] px-2 py-0.5 rounded bg-indigo-600 text-white">Filter</button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-auto divide-y">
                      {templates.length === 0 ? (
                        <div className="p-2 text-xs text-gray-500">No templates yet.</div>
                      ) : templates.map((t) => (
                        <div key={t.id} className="w-full text-left px-2 py-2 hover:bg-gray-50 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{t.name}</div>
                              <div className="text-[11px] text-gray-500 truncate">{[t.clientId, t.lob].filter(Boolean).join(' • ')}{t.version ? ` • v${t.version}` : ''}</div>
                              {t.tags?.length ? <div className="mt-0.5 flex flex-wrap gap-1">{t.tags.map(tag => <span key={tag} className="text-[10px] px-1 py-0.5 rounded bg-gray-100">{tag}</span>)}</div> : null}
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1">
                              <button onClick={() => applyTemplate(t.id)} className="text-[11px] px-2 py-0.5 rounded border">Apply</button>
                              <button onClick={() => openTemplateHistory(t)} className="text-[11px] px-2 py-0.5 rounded border">History</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 border-t pt-2">
                      <div className="grid grid-cols-3 gap-1 mb-2">
                        <input value={tplClient} onChange={(e) => setTplClient(e.target.value)} placeholder="Client" className="border rounded px-1 py-0.5 text-xs col-span-1"/>
                        <input value={tplLob} onChange={(e) => setTplLob(e.target.value)} placeholder="LOB" className="border rounded px-1 py-0.5 text-xs col-span-1"/>
                        <input value={tplTags} onChange={(e) => setTplTags(e.target.value)} placeholder="tags (a,b)" className="border rounded px-1 py-0.5 text-xs col-span-1"/>
                      </div>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Upload className="w-3.5 h-3.5"/>
                        <span>Upload template</span>
                        <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTemplate(f); }}/>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              {/* Template history modal */}
              {tplHistoryOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/20" onClick={() => setTplHistoryOpen(false)} />
                  <div className="relative z-50 w-[680px] max-w-[95vw] bg-white rounded shadow border p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Template History{tplHistoryFor ? ` — ${tplHistoryFor.name}` : ''}</div>
                      <button onClick={() => setTplHistoryOpen(false)} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4"/></button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="border rounded p-2">
                        <div className="text-xs text-gray-600 mb-1">Versions</div>
                        <div className="max-h-64 overflow-auto divide-y">
                          {!tplHistory ? (
                            <div className="p-2 text-xs text-gray-500">Loading…</div>
                          ) : tplHistory.length === 0 ? (
                            <div className="p-2 text-xs text-gray-500">No history.</div>
                          ) : tplHistory.map((v) => (
                            <div key={v.id} className="py-2 px-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm truncate">{v.name}{v.version ? ` · v${v.version}` : ''}</div>
                                  <div className="text-[11px] text-gray-500 truncate">{v.updatedAt ? new Date(v.updatedAt).toLocaleString() : ''}{v.changeNote ? ` · ${v.changeNote}` : ''}</div>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-1">
                                  <button onClick={() => applyTemplate(v.id)} className="text-[11px] px-2 py-0.5 rounded border">Apply</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="border rounded p-2">
                        <div className="text-xs text-gray-600 mb-1">Create new version from current content</div>
                        <div className="space-y-2">
                          <input value={tplNewVersionName} onChange={(e) => setTplNewVersionName(e.target.value)} placeholder="Name (optional)" className="w-full border rounded px-2 py-1 text-sm"/>
                          <input value={tplNewVersionNote} onChange={(e) => setTplNewVersionNote(e.target.value)} placeholder="Change note (optional)" className="w-full border rounded px-2 py-1 text-sm"/>
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setTplHistoryOpen(false)} className="text-xs px-3 py-1 rounded border">Cancel</button>
                            <button onClick={createNewTemplateVersion} className="text-xs px-3 py-1 rounded bg-indigo-600 text-white">Create version</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Status: Draft</span>
              <span className="text-gray-300">•</span>
              <span className="text-gray-500">Version: 1</span>
            </div>
          </div>

          {/* Removed duplicate read-only preview to keep a single, source-of-truth editor */}

          {/* Editor area */}
          <div className="relative">
            {/* Background overlay with inline highlights and comment underlines */}
            {overlayContent}

            {/* Right gutter markers */}
            <div className="absolute top-0 right-1 h-full w-6" style={{ pointerEvents: 'auto' }}>
    {markerNodes.map(m => (
                <div key={m.id}
                     className="absolute right-0 w-3 h-3 rounded-full border border-gray-400 bg-white shadow cursor-pointer"
                     style={{ top: Math.max(4, m.top), background: m.type === 'highlight' ? (m.color || '#fef08a') : '#fff' }}
      onMouseEnter={() => setHoverMarker({ id: m.id, type: m.type, text: m.text, top: m.top, status: (m as any).status, approvedBy: (m as any).approvedBy, approvedAt: (m as any).approvedAt })}
                     onMouseLeave={() => setHoverMarker(null)}
                     onClick={() => jumpToRange(m.start, m.end)}
                />
              ))}
            </div>

            {/* Tooltip */}
            {hoverMarker && (
              <div className="absolute right-8 z-20 max-w-xs bg-white text-gray-900 text-xs rounded border shadow p-2 space-y-2"
                   style={{ top: Math.max(8, hoverMarker.top) }}>
                <div className="text-[11px] text-gray-600">{hoverMarker.type === 'highlight' ? 'Highlight' : 'Comment'}</div>
                <div className="text-xs">{hoverMarker.text || (hoverMarker.type === 'highlight' ? 'No note' : '')}</div>
                {hoverMarker.type === 'highlight' && hoverMarker.status === 'approved' && (
                  <div className="text-[11px] text-emerald-700">Approved by {hoverMarker.approvedBy || '—'} {hoverMarker.approvedAt ? `· ${new Date(hoverMarker.approvedAt).toLocaleString()}` : ''}</div>
                )}
                <div className="flex items-center gap-2 justify-end">
                  {hoverMarker.type === 'highlight' && (
                    <button className="px-2 py-0.5 rounded text-xs border" onClick={async () => {
                      try {
                        await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/highlight/${hoverMarker.id}/approve`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ by: role }) });
                        setApprovedHighlightIds(prev => new Set(prev).add(hoverMarker.id));
                        await fetchOrInit();
                      } finally {
                        setHoverMarker(null);
                      }
                    }}>Approve</button>
                  )}
          <button className="px-2 py-0.5 rounded text-xs border" onClick={() => {
                    // focus comment input within tooltip
                    setTooltipInput('');
                  }}>Comment</button>
                </div>
                <div className="flex items-center gap-1">
                  <input value={tooltipInput} onChange={(e) => setTooltipInput(e.target.value)} placeholder="Add a comment…" className="flex-1 border rounded px-2 py-1"/>
                  <button className="px-2 py-1 rounded bg-indigo-600 text-white" onClick={async () => {
                    const m = markerNodes.find(mm => mm.id === hoverMarker.id);
                    if (!m) return;
                    try {
            await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/comment`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ author: role, text: tooltipInput, range: { start: m.start, end: m.end } }) });
                      setTooltipInput('');
                      await fetchOrInit();
                    } finally {
                      setHoverMarker(null);
                    }
                  }}>Add</button>
                </div>
              </div>
            )}

            <textarea ref={taRef}
                      value={content}
                      onChange={(e) => {
                        const oldText = content;
                        const newText = e.target.value;
                        // Simple diff heuristic for one edit
                        let p = 0; while (p < oldText.length && p < newText.length && oldText[p] === newText[p]) p++;
                        let s = 0; while (s < (oldText.length - p) && s < (newText.length - p) && oldText[oldText.length - 1 - s] === newText[newText.length - 1 - s]) s++;
                        const oldMid = oldText.slice(p, oldText.length - s);
                        const newMid = newText.slice(p, newText.length - s);
                        const delta = newMid.length - oldMid.length;
                        // Adjust ranges
                        if (delta !== 0) {
                          const at = p;
                          const adj = (r?: Range): Range | undefined => {
                            if (!r) return r;
                            if (at <= r.start) return { start: r.start + delta, end: r.end + delta };
                            if (at > r.start && at <= r.end) return { start: r.start, end: Math.max(r.start, r.end + delta) };
                            return r;
                          };
                          setHighlights(hs => hs.map(h => h.range ? { ...h, range: adj(h.range) } : h));
                          setComments(cs => cs.map(c => c.range ? { ...c, range: adj(c.range) } as any : c));
                        }
                        setContent(newText);
                      }}
                      onSelect={updateSelectionFromTA}
                      onScroll={onEditorScroll}
                      className="w-full h-80 border rounded p-3 text-sm font-mono leading-6 bg-transparent"
                      placeholder="Start drafting…"/>
            {selOpen && selection && (
              <div className="absolute right-2 top-2 z-10 bg-white border rounded shadow p-2 text-xs flex flex-col gap-1 w-72">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Selection actions</div>
                  <button onClick={() => setSelOpen(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5"/></button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <input value={selApprover} onChange={(e) => setSelApprover(e.target.value)} placeholder="Approver role" className="border rounded px-1 py-0.5 col-span-3"/>
                  <input value={selNote} onChange={(e) => setSelNote(e.target.value)} placeholder="Note (optional)" className="border rounded px-1 py-0.5 col-span-3"/>
                  <input value={selProposedText} onChange={(e) => setSelProposedText(e.target.value)} placeholder="Propose replacement (optional)" className="border rounded px-1 py-0.5 col-span-3"/>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={async () => {
                    try {
                      // Use derived color mapping: procurement approvals yellow, others light blue
                      const derivedColor = (selApprover.trim().toLowerCase() === 'procurement') ? '#fef08a' : '#dbeafe';
                      await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/highlight`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ author: role, color: derivedColor, note: selNote || (selApprover ? `Needs ${selApprover} approval` : undefined), range: selection }) });
                      if (selNote.trim()) {
                        await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/comment`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ author: role, text: selNote, range: selection }) });
                      }
                      if (selProposedText.trim()) {
                        await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ createdBy: role, type: 'change', message: selNote || 'Proposed change', approverRole: selApprover.trim() || undefined, patch: { position: { start: selection.start, end: selection.end }, to: selProposedText.trim() } }) });
                      } else if (selApprover.trim()) {
                        await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ createdBy: role, type: 'policy', message: selNote || `Approval required`, range: selection, approverRole: selApprover.trim() }) });
                      }
                    } finally {
                      setSelOpen(false); setSelNote(''); setSelApprover(''); setSelProposedText('');
                      await fetchOrInit();
                      await loadTasks();
                    }
                  }} className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700">Mark</button>
                </div>
              </div>
            )}
          </div>
          {trackPreview}

          {/* Comments */}
          <div className="rounded border p-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Comments</div>
              <div className="text-xs text-gray-500">Blue = Client · Orange = Supplier</div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input value={commentInput} onChange={(e) => setCommentInput(e.target.value)} placeholder="Write a comment…" className="flex-1 border rounded px-2 py-1 text-sm"/>
              <button onClick={addComment} className="text-xs px-2 py-1 rounded border">Add</button>
            </div>
            <div className="mt-2 space-y-2 max-h-56 overflow-auto">
              {comments.length === 0 ? <div className="text-xs text-gray-500">No comments yet.</div> : (
                Object.entries(commentsBySection).map(([key, list]) => {
                  const [idx, title] = key.split(':');
                  const pos = outlineWithPos[Number(idx)]?.pos ?? 0;
                  return (
                    <div key={key} className="border rounded">
                      <div className="px-2 py-1 text-xs bg-gray-50 flex items-center justify-between">
                        <button className="hover:underline" onClick={() => jumpToPos(pos)}>{title}</button>
                        <span className="text-gray-500">{list.length}</span>
                      </div>
                      <div className="p-2 space-y-1">
                        {list.slice().reverse().map(c => (
                          <div key={c.id} className="text-sm p-2 rounded cursor-pointer" style={{ background: c.author === 'client' ? '#dbeafe' : '#ffedd5' }}
                               onClick={() => jumpToPos(((c as any).range?.start ?? 0))}>
                            <div className="flex items-center justify-between">
                              <div className="text-[11px] text-gray-600">{c.author} · {new Date(c.createdAt).toLocaleString()}</div>
                              <div className="text-[11px] text-gray-600">{c.status === 'resolved' ? 'Resolved' : c.status === 'rejected' ? 'Rejected' : 'Open'}</div>
                            </div>
                            <div className="mt-0.5">{c.text}</div>
                            <div className="mt-1 flex items-center gap-2">
                              {c.status !== 'resolved' && (
                                <button className="text-[11px] px-2 py-0.5 rounded border" onClick={async (e) => {
                                  e.stopPropagation();
                                  await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/comment/${c.id}/status`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ status: 'resolved', by: role }) });
                                  await fetchOrInit();
                                }}>Resolve</button>
                              )}
                              {c.status === 'resolved' && (
                                <button className="text-[11px] px-2 py-0.5 rounded border" onClick={async (e) => {
                                  e.stopPropagation();
                                  await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/comment/${c.id}/status`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ status: 'open', by: role }) });
                                  await fetchOrInit();
                                }}>Reopen</button>
                              )}
                              {c.status !== 'rejected' && (
                                <button className="text-[11px] px-2 py-0.5 rounded border" onClick={async (e) => {
                                  e.stopPropagation();
                                  await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/comment/${c.id}/status`, { method: 'POST', headers: tenantHeaders({ 'content-type': 'application/json' }), body: JSON.stringify({ status: 'rejected', by: role }) });
                                  await fetchOrInit();
                                }}>Reject</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="rounded border p-2">
          <div className="flex items-center gap-2 text-sm border-b pb-2">
            <button onClick={() => setActiveRightTab('ai')} className={`px-2 py-1 rounded ${activeRightTab === 'ai' ? 'bg-indigo-600 text-white' : 'border'}`}><Sparkles className="inline w-4 h-4 mr-1"/> AI</button>
            <button onClick={() => setActiveRightTab('compliance')} className={`px-2 py-1 rounded ${activeRightTab === 'compliance' ? 'bg-indigo-600 text-white' : 'border'}`}><ShieldCheck className="inline w-4 h-4 mr-1"/> Compliance</button>
            <button onClick={() => setActiveRightTab('tasks')} className={`px-2 py-1 rounded ${activeRightTab === 'tasks' ? 'bg-indigo-600 text-white' : 'border'}`}><Workflow className="inline w-4 h-4 mr-1"/> Tasks</button>
          </div>

          <div className="mt-3 space-y-3">
            {activeRightTab === 'ai' && (
              <div className="space-y-2">
                <div className="text-sm font-medium">AI Suggestions</div>
                {aiSuggestions.length === 0 ? (
                  <div className="text-xs text-gray-500">No suggestions yet. Click AI Suggest to add one.</div>
                ) : (
                  <div className="space-y-2">
                    {aiSuggestions.slice(0, 3).map(s => (
                      <div key={s.id} className="rounded border p-2">
                        <div className="text-xs text-gray-500">{s.type} · {new Date(s.createdAt).toLocaleString()}</div>
                        <div className="text-sm">{s.message}</div>
                        <div className="mt-1 flex items-center gap-2">
                          {(s.status === 'pending' || s.status === 'approved') && <>
                            <button onClick={() => acceptSuggestion(s.id)} className="text-xs px-2 py-1 rounded bg-indigo-600 text-white">Accept</button>
                            <button onClick={() => rejectSuggestion(s.id)} className="text-xs px-2 py-1 rounded border">Reject</button>
                          </>}
                          {s.status === 'needs-approval' && <>
                            <button onClick={() => approveSuggestion(s.id, s.approverRole)} className="text-xs px-2 py-1 rounded bg-amber-600 text-white">Approve{s.approverRole ? ` (${s.approverRole})` : ''}</button>
                          </>}
                          {s.status === 'accepted' && <span className="text-[11px] text-emerald-700">Accepted</span>}
                          {s.status === 'rejected' && <span className="text-[11px] text-gray-500">Rejected</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeRightTab === 'compliance' && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Compliance & Benchmarks</div>
                <div className="text-xs text-gray-500">Powered by policy packs{policyPackId ? ` • Pack: ${policyPackId}` : ''}</div>
                <div className="mt-2">{coloredFindings}</div>
              </div>
            )}

            {activeRightTab === 'tasks' && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Approval Tasks</div>
                <div className="text-xs text-gray-500">Pending approvals will appear here</div>
                {approvalTasks.length === 0 ? (
                  <div className="rounded border p-2 flex items-center gap-2 text-xs"><CheckCheck className="w-4 h-4 text-emerald-600"/> No pending approvals.</div>
                ) : (
                  <div className="space-y-2">
                    {approvalTasks.map(t => (
                      <div key={t.id} className="rounded border p-2 text-sm">
                        <div className="text-[11px] text-gray-500 mb-1">Needs approval{t.approverRole ? ` · ${t.approverRole}` : ''}</div>
                        <div>{t.message}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <button onClick={() => approveSuggestion(t.id, t.approverRole)} className="text-xs px-2 py-1 rounded bg-amber-600 text-white">Approve</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {snapOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSnapOpen(false)} />
          <div className="relative z-50 w-[680px] max-w-[95vw] bg-white rounded shadow border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Snapshots</div>
              <button onClick={() => setSnapOpen(false)} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4"/></button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-gray-600">Create a snapshot to mark a version and compare later.</div>
              <button onClick={createSnap} className="text-xs px-2 py-1 rounded border">Create snapshot</button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="border rounded p-2">
                <div className="text-xs text-gray-600 mb-1">History</div>
                <div className="max-h-64 overflow-auto divide-y">
                  {snapshots.length === 0 ? (
                    <div className="p-2 text-xs text-gray-500">No snapshots yet.</div>
                  ) : snapshots.slice().reverse().map((s) => (
                    <div key={s.id} className="py-2 px-1 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm truncate">{new Date(s.createdAt).toLocaleString()} · v{s.version}</div>
                        <div className="text-[11px] text-gray-500 truncate">By {s.author}{s.label ? ` · ${s.label}` : ''}</div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1">
                        <button onClick={() => viewSnapDiff(s.id)} className="text-[11px] px-2 py-0.5 rounded border">Diff</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border rounded p-2">
                <div className="text-xs text-gray-600 mb-1">Diff</div>
                {!snapDiff ? (
                  <div className="p-2 text-xs text-gray-500">Select a snapshot to compare with current.</div>
                ) : (
                  <div className="text-sm space-y-1">
                    <div>From v{snapDiff.fromVersion} → To v{snapDiff.toVersion}</div>
                    <div className="text-[11px] text-gray-600">Adds: {snapDiff.summary.adds} · Deletes: {snapDiff.summary.dels} · Unchanged: {snapDiff.summary.equals}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Server component wrapper for Next.js 15 async params
export default async function WorkspacePage({ params }: { params: Promise<{ docId: string }> }) {
  const awaitedParams = await params;
  return <WorkspacePageClient params={awaitedParams} />;
}
