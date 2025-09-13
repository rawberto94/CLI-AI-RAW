"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../../../../lib/config';
import Link from 'next/link';

type Range = { start: number; end: number };
type Party = 'client' | 'supplier' | 'ai';
type Suggestion = { id: string; createdAt: string; createdBy: Party; type: 'change' | 'policy' | 'benchmark'; message: string; range?: Range; patch?: any; status: 'pending' | 'accepted' | 'rejected' | 'needs-approval' | 'approved'; approverRole?: string; highlightId?: string };
type Comment = { id: string; author: Party; channel: 'client' | 'supplier' | 'shared'; text: string; range?: Range; status: 'open' | 'resolved' | 'rejected'; createdAt: string };
type Highlight = { id: string; author: Party; color: string; note?: string; range: Range; createdAt: string };
type NegotiationState = { docId: string; content: string; version: number; baselineLocked: boolean; sharedWithSupplier: boolean; comments: Comment[]; highlights: Highlight[]; suggestions: Suggestion[] };

export default function NegotiatePage({ params }: { params: { docId: string } }) {
  const { docId } = params;
  const [state, setState] = useState<NegotiationState | null>(null);
  const [content, setContent] = useState('');
  const [role, setRole] = useState<Party>('client');
  const [commentInput, setCommentInput] = useState('');
  const [selection, setSelection] = useState<Range | null>(null);
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate`);
      if (r.ok) {
        const s = await r.json();
        setState(s);
        setContent(s.content || '');
      }
      const a = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/activity`);
      if (a.ok) setActivity(await a.json());
    } catch {}
  }, [docId]);

  useEffect(() => {
    fetchState();
    const id = setInterval(fetchState, 2000);
    return () => clearInterval(id);
  }, [fetchState]);

  const initIfNeeded = useCallback(async () => {
    if (state) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/init`, { method: 'POST' });
      if (r.ok) {
        const s = await r.json();
        setState(s);
        setContent(s.content || '');
      }
    } catch {}
  }, [docId, state]);

  useEffect(() => { initIfNeeded(); }, [initIfNeeded]);

  const onSave = useCallback(async () => {
    try {
      setBusy(true);
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/content`, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ content, by: role }) });
      if (r.ok) setState(await r.json());
    } finally { setBusy(false); }
  }, [docId, content, role]);

  const onAddComment = useCallback(async () => {
    const text = commentInput.trim();
    if (!text) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/comment`, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ author: role, channel: role, text, range: selection || undefined }) });
      if (r.ok) {
        setCommentInput('');
        fetchState();
      }
    } catch {}
  }, [docId, role, commentInput, selection, fetchState]);

  const onAddHighlight = useCallback(async () => {
    if (!selection) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/highlight`, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ author: role, color: role==='client' ? '#60a5fa' : '#fb923c', range: selection, note: '' }) });
      if (r.ok) fetchState();
    } catch {}
  }, [docId, role, selection, fetchState]);

  const applySuggestion = useCallback(async (id: string, action: 'accept'|'reject') => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest/${id}/resolve`, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ action, by: role }) });
      if (r.ok) fetchState();
    } catch {}
  }, [docId, role, fetchState]);

  const approveSuggestion = useCallback(async (id: string, roleName: string) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest/${id}/approve`, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ role: roleName, by: 'approver' }) });
      if (r.ok) fetchState();
    } catch {}
  }, [docId, fetchState]);

  const addDraftingTip = useCallback(async () => {
    // Minimal AI stub: suggest tightening payment terms if mentions 45 days
    const idx = content.toLowerCase().indexOf('45 day');
    const message = idx !== -1 ? 'Supplier proposed 45-day payment term → policy max = 30 days. Suggest counter with 30.' : 'Benchmark suggests counteroffer at $950/day for Senior Consultant.';
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest`, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ createdBy:'ai', type: idx!==-1? 'policy':'benchmark', message, patch: idx!==-1 ? { from: '45 day', to: '30 day' } : undefined }) });
      if (r.ok) fetchState();
    } catch {}
  }, [docId, content, fetchState]);

  const fetchAISuggestions = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/ai/suggest`);
      if (!r.ok) return;
      const data = await r.json();
      // insert first suggestion to list for demo
      const s = data?.suggestions?.[0];
      if (!s) return;
      await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/suggest`, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ createdBy:'ai', type: s.type, message: s.message, patch: s.patch }) });
      fetchState();
    } catch {}
  }, [docId, fetchState]);

  // selection from textarea
  const updateSelectionFromTA = useCallback(() => {
    const ta = taRef.current; if (!ta) return;
    const start = ta.selectionStart; const end = ta.selectionEnd;
    if (typeof start === 'number' && typeof end === 'number' && end > start) setSelection({ start, end });
    else setSelection(null);
  }, []);

  const coloredContent = useMemo(() => {
    // Render highlights on top of plaintext by splitting segments
    const hs = state?.highlights || [];
    if (!hs.length) return <pre className="whitespace-pre-wrap text-sm">{content}</pre>;
    const segments: Array<{ text: string; color?: string; anchorId?: string; title?: string }> = [];
    let i = 0;
    const sorted = hs.slice().sort((a,b)=> a.range.start - b.range.start);
    for (const h of sorted) {
      if (h.range.start > i) segments.push({ text: content.slice(i, h.range.start) });
      segments.push({ text: content.slice(h.range.start, h.range.end), color: h.color, anchorId: h.id, title: h.note });
      i = h.range.end;
    }
    if (i < content.length) segments.push({ text: content.slice(i) });
    return (
      <pre className="whitespace-pre-wrap text-sm">
        {segments.map((s, idx) => (
          <span
            key={idx}
            id={s.anchorId ? `hl-${s.anchorId}` : undefined}
            title={s.title || undefined}
            style={{
              backgroundColor: s.color || 'transparent',
              outline: s.color==='#fee2e2' ? '1px solid #ef4444' : 'none',
              boxShadow: s.anchorId && flashId===s.anchorId ? '0 0 0 3px rgba(239,68,68,0.4)' : 'none',
              transition: 'box-shadow 0.3s ease-in-out',
            }}
          >
            {s.text}
          </span>
        ))}
      </pre>
    );
  }, [content, state?.highlights, flashId]);

  const goToHighlight = useCallback((hid?: string, range?: Range) => {
    if (hid) {
      const el = document.getElementById(`hl-${hid}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFlashId(hid);
        setTimeout(() => setFlashId(null), 1500);
        return;
      }
    }
    if (range && taRef.current) {
      const ta = taRef.current;
      try {
        ta.focus();
        ta.setSelectionRange(range.start, range.end);
      } catch {}
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/contracts/${docId}`} className="text-sm text-indigo-600">← Back</Link>
          <h1 className="text-xl font-semibold">Negotiation Workflow</h1>
          <span className="text-xs text-gray-500">Doc: {docId}</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={role} onChange={e=> setRole(e.target.value as Party)} className="border rounded px-2 py-1 text-sm">
            <option value="client">Client (Procurement)</option>
            <option value="supplier">Supplier</option>
          </select>
          <button disabled={busy} onClick={onSave} className={`px-3 py-1 rounded text-sm ${busy? 'bg-gray-200':'bg-indigo-600 text-white'}`}>{busy? 'Saving…':'Save'}</button>
          <a href={`${API_BASE_URL}/api/contracts/${docId}/negotiate/export`} target="_blank" className="px-3 py-1 rounded text-sm border">Export</a>
          <button onClick={()=> fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/share`, { method:'POST' }).then(fetchState)} className="px-3 py-1 rounded text-sm border">Share</button>
          <button onClick={()=> fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/lock`, { method:'POST' }).then(fetchState)} className="px-3 py-1 rounded text-sm border">Lock Baseline</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          <div className="text-xs text-gray-500">Track changes-like collaborative editor (demo)</div>
          <textarea ref={taRef} value={content} onChange={e=> setContent(e.target.value)} onSelect={updateSelectionFromTA} className="w-full h-64 border rounded p-2 text-sm font-mono" />
          <div>
            <div className="mb-1 text-xs text-gray-500">Rendered with highlights</div>
            <div className="rounded border p-2 bg-white">{coloredContent}</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded border p-2">
            <div className="text-sm font-medium">AI Sidebar (Drafting Agent)</div>
            <div className="text-xs text-gray-500">Contextual tips appear here</div>
            <button onClick={addDraftingTip} className="mt-2 text-xs px-2 py-1 rounded bg-emerald-600 text-white">Add AI Suggestion</button>
            <button onClick={fetchAISuggestions} className="mt-2 ml-2 text-xs px-2 py-1 rounded border">Auto Suggest</button>
            <div className="mt-2 space-y-2">
              {(state?.suggestions||[]).slice(0,3).map(s => (
                <div key={s.id} className="rounded border p-2">
                  <div className="text-xs text-gray-500">{s.type} · {new Date(s.createdAt).toLocaleString()}</div>
                  <div className="text-sm">{s.message}</div>
                  <div className="mt-1 flex items-center gap-2">
                    {s.status==='needs-approval' && <span className="text-[11px] text-orange-600">Needs {s.approverRole} approval</span>}
                    {s.status==='pending' && <>
                      <button onClick={()=>applySuggestion(s.id,'accept')} className="text-xs px-2 py-1 rounded bg-indigo-600 text-white">Accept</button>
                      <button onClick={()=>applySuggestion(s.id,'reject')} className="text-xs px-2 py-1 rounded border">Reject</button>
                    </>}
                    {s.status==='needs-approval' && <button onClick={()=>approveSuggestion(s.id, s.approverRole || 'Procurement')} className="text-xs px-2 py-1 rounded border">Approve as {s.approverRole}</button>}
                    {(s.status==='accepted'||s.status==='approved') && <span className="text-[11px] text-emerald-700">Accepted</span>}
                    {s.status==='rejected' && <span className="text-[11px] text-gray-500">Rejected</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border p-2">
            <div className="text-sm font-medium">Add Comment</div>
            <div className="text-xs text-gray-500">Blue = Client · Orange = Supplier</div>
            <div className="mt-2 flex items-center gap-2">
              <input value={commentInput} onChange={e=> setCommentInput(e.target.value)} placeholder="Write a comment…" className="flex-1 border rounded px-2 py-1 text-sm" />
              <button onClick={onAddComment} className="text-xs px-2 py-1 rounded border">Add</button>
              <button onClick={onAddHighlight} disabled={!selection} className={`text-xs px-2 py-1 rounded ${selection? 'border':'bg-gray-100 text-gray-500'}`}>Highlight</button>
            </div>
            <div className="mt-2 space-y-1 max-h-48 overflow-auto">
              {(state?.comments||[]).slice().reverse().map(c => (
                <div key={c.id} className="text-sm p-2 rounded" style={{ background: c.author==='client'? '#dbeafe':'#ffedd5' }}>
                  <div className="text-[11px] text-gray-600">{c.author} · {new Date(c.createdAt).toLocaleString()} {c.range? ` · [${c.range.start}-${c.range.end}]`:''}</div>
                  <div>{c.text}</div>
                </div>
              ))}
            </div>
          </div>

          <TasksPanel docId={docId} onGoToHighlight={(hid?: string, range?: Range) => goToHighlight(hid, range)} />
          <div className="rounded border p-2">
            <div className="text-sm font-medium">Activity</div>
            <div className="text-xs text-gray-500">Recent events</div>
            <div className="mt-2 max-h-48 overflow-auto space-y-1">
              {activity.length===0 ? <div className="text-xs text-gray-500">No events.</div> : (
                activity.map((e:any, i:number) => (
                  <div key={i} className="text-xs text-gray-700">{new Date(e.ts).toLocaleString()} · {e.kind}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TasksPanel({ docId, onGoToHighlight }: { docId: string; onGoToHighlight?: (highlightId?: string, range?: Range) => void }){
  const [tasks, setTasks] = useState<{ approvals: Suggestion[] }>({ approvals: [] });
  const fetchTasks = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/contracts/${docId}/negotiate/tasks`);
      if (r.ok) setTasks(await r.json());
    } catch {}
  }, [docId]);
  useEffect(() => { fetchTasks(); const id = setInterval(fetchTasks, 3000); return ()=> clearInterval(id); }, [fetchTasks]);
  return (
    <div className="rounded border p-2">
      <div className="text-sm font-medium">Approvals</div>
      {tasks.approvals.length===0 ? (
        <div className="text-xs text-gray-500 mt-1">No pending approvals.</div>
      ) : (
        <ul className="mt-2 space-y-2">
          {tasks.approvals.map(s => (
            <li key={s.id} className="rounded border p-2">
              <div className="text-xs text-gray-500">Needs {s.approverRole} approval</div>
              <div className="text-sm">{s.message}</div>
              <div className="mt-1">
                <button onClick={() => onGoToHighlight?.(s.highlightId, s.range)} className="text-xs px-2 py-1 rounded border">View</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
