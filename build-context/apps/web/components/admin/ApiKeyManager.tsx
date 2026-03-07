'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Key, Plus, Copy, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', expiresInDays: '90' });

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/api-keys');
      const json = await res.json();
      if (json.success) setKeys(json.data.apiKeys);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const handleAdd = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      const res = await fetch('/api/admin/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, expiresInDays: parseInt(form.expiresInDays) }) });
      const json = await res.json();
      if (json.success) { setNewKey(json.data.apiKey.key); toast.success('API key created'); fetchKeys(); }
    } catch { toast.error('Failed'); }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/api-keys?id=${id}`, { method: 'DELETE' });
      if ((await res.json()).success) { toast.success('Key revoked'); fetchKeys(); }
    } catch { toast.error('Failed'); }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><Key className="h-8 w-8" /> API Keys</h1><p className="text-muted-foreground mt-1">Manage API keys for external integrations</p></div>
        <Button onClick={() => { setShowAdd(true); setNewKey(null); }}><Plus className="h-4 w-4 mr-2" /> Generate Key</Button>
      </div>

      <div className="space-y-3">
        {keys.map((key: any) => (
          <Card key={key.id}><CardContent className="py-4 px-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{key.name}</h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <code className="bg-muted px-2 py-0.5 rounded text-xs">{key.key_prefix}...</code>
                <span>Used {key.usage_count || 0} times</span>
                {key.last_used_at && <span>Last: {new Date(key.last_used_at).toLocaleDateString()}</span>}
                {key.expires_at && <span>Expires: {new Date(key.expires_at).toLocaleDateString()}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={key.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{key.is_active ? 'Active' : 'Revoked'}</Badge>
              {key.is_active && <Button size="sm" variant="ghost" className="text-red-500" onClick={() => handleRevoke(key.id)}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </CardContent></Card>
        ))}
        {keys.length === 0 && (
          <EmptyState
            variant="no-data"
            title="No API keys"
            description="Generate API keys for external integrations and automation."
            primaryAction={{
              label: 'Generate Key',
              onClick: () => setShowAdd(true),
              icon: Plus,
            }}
          />
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{newKey ? 'API Key Generated' : 'Generate API Key'}</DialogTitle></DialogHeader>
          {newKey ? (
            <div className="space-y-4">
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-2"><AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" /><p className="text-sm">Copy this key now. It will not be shown again.</p></div>
              <div className="flex items-center gap-2"><code className="flex-1 p-3 bg-muted rounded text-xs break-all">{newKey}</code><Button size="sm" variant="outline" onClick={() => copyToClipboard(newKey)}><Copy className="h-4 w-4" /></Button></div>
              <DialogFooter><Button onClick={() => { setShowAdd(false); setNewKey(null); }}>Done</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div><Label>Key Name *</Label><Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. ERP Integration" /></div>
              <div><Label>Expires In (days)</Label><Input type="number" value={form.expiresInDays} onChange={(e) => setForm(p => ({ ...p, expiresInDays: e.target.value }))} /></div>
              <DialogFooter><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Generate</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
