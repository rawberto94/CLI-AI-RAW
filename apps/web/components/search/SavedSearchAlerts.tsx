'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Bell, BellOff, Pin, PinOff, Trash2, Plus, Star, Filter, Clock,
  Mail, MessageSquare, Smartphone, AlertTriangle, SaveAll
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, any>;
  alert_enabled: boolean;
  alert_frequency: string;
  alert_channels: string[];
  last_alert_at: string | null;
  result_count: number;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export default function SavedSearchAlerts() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const [newSearch, setNewSearch] = useState({
    name: '',
    query: '',
    filters: {} as Record<string, any>,
    alertEnabled: false,
    alertFrequency: 'daily',
    alertChannels: ['in_app'] as string[],
    isPinned: false,
  });

  const fetchSearches = useCallback(async () => {
    try {
      const res = await fetch('/api/search/saved');
      const json = await res.json();
      if (json.success) setSearches(json.data.searches || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSearches(); }, [fetchSearches]);

  const handleCreate = async () => {
    if (!newSearch.name || !newSearch.query) { toast.error('Name and query are required'); return; }
    try {
      const res = await fetch('/api/search/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSearch),
      });
      if ((await res.json()).success) {
        toast.success('Search saved');
        setCreateOpen(false);
        setNewSearch({ name: '', query: '', filters: {}, alertEnabled: false, alertFrequency: 'daily', alertChannels: ['in_app'], isPinned: false });
        fetchSearches();
      }
    } catch { toast.error('Failed to save search'); }
  };

  const toggleAlert = async (id: string) => {
    try {
      await fetch('/api/search/saved', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'toggle-alert' }),
      });
      setSearches(prev => prev.map(s => s.id === id ? { ...s, alert_enabled: !s.alert_enabled } : s));
      toast.success('Alert toggled');
    } catch { toast.error('Failed'); }
  };

  const togglePin = async (id: string) => {
    try {
      await fetch('/api/search/saved', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'toggle-pin' }),
      });
      setSearches(prev => prev.map(s => s.id === id ? { ...s, is_pinned: !s.is_pinned } : s));
    } catch { toast.error('Failed'); }
  };

  const deleteSearch = async (id: string) => {
    try {
      await fetch(`/api/search/saved?id=${id}`, { method: 'DELETE' });
      setSearches(prev => prev.filter(s => s.id !== id));
      toast.success('Search deleted');
    } catch { toast.error('Failed'); }
  };

  const filteredSearches = searches.filter(s => {
    if (tab === 'pinned') return s.is_pinned;
    if (tab === 'alerts') return s.alert_enabled;
    return true;
  });

  const channelIcons: Record<string, any> = {
    in_app: Bell,
    email: Mail,
    slack: MessageSquare,
    push: Smartphone,
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SaveAll className="h-8 w-8" /> Saved Searches & Alerts
          </h1>
          <p className="text-muted-foreground mt-1">Save frequently used searches and get alerts for new matches</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Saved Search
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{searches.length}</p>
            <p className="text-sm text-blue-600">Total Saved</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-yellow-700">{searches.filter(s => s.is_pinned).length}</p>
            <p className="text-sm text-yellow-600">Pinned</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-green-700">{searches.filter(s => s.alert_enabled).length}</p>
            <p className="text-sm text-green-600">Active Alerts</p>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold text-purple-700">
              {searches.reduce((sum, s) => sum + s.result_count, 0)}
            </p>
            <p className="text-sm text-purple-600">Total Results</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All ({searches.length})</TabsTrigger>
          <TabsTrigger value="pinned">Pinned ({searches.filter(s => s.is_pinned).length})</TabsTrigger>
          <TabsTrigger value="alerts">With Alerts ({searches.filter(s => s.alert_enabled).length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {filteredSearches.map(s => (
                <Card key={s.id} className={cn('hover:shadow-md transition-shadow', s.is_pinned && 'border-yellow-300 bg-yellow-50/30')}>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{s.name}</h3>
                          {s.is_pinned && <Pin className="h-3 w-3 text-yellow-500" />}
                          {s.alert_enabled && <Badge variant="outline" className="text-green-600 border-green-300"><Bell className="h-3 w-3 mr-1" /> {s.alert_frequency}</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="font-mono text-xs">
                            <Search className="h-3 w-3 mr-1" /> {s.query || 'No query'}
                          </Badge>
                          {Object.keys(s.filters || {}).length > 0 && (
                            <Badge variant="outline">
                              <Filter className="h-3 w-3 mr-1" /> {Object.keys(s.filters).length} filters
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Created {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</span>
                          {s.last_alert_at && (
                            <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Last alert {formatDistanceToNow(new Date(s.last_alert_at), { addSuffix: true })}</span>
                          )}
                        </div>
                        {s.alert_enabled && s.alert_channels.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">Channels:</span>
                            {s.alert_channels.map(ch => {
                              const Icon = channelIcons[ch] || Bell;
                              return <Badge key={ch} variant="outline" className="text-xs"><Icon className="h-3 w-3 mr-1" /> {ch}</Badge>;
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => togglePin(s.id)} title={s.is_pinned ? 'Unpin' : 'Pin'}>
                          {s.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleAlert(s.id)} title={s.alert_enabled ? 'Disable alert' : 'Enable alert'}>
                          {s.alert_enabled ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteSearch(s.id)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredSearches.length === 0 && (
                <Card className="p-12 text-center text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No saved searches yet</p>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Save a Search</DialogTitle>
            <DialogDescription>Save your search criteria and optionally set up alerts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input value={newSearch.name} onChange={e => setNewSearch(s => ({ ...s, name: e.target.value }))} placeholder="e.g., Expiring contracts this quarter" />
            </div>
            <div>
              <Label>Search Query</Label>
              <Input value={newSearch.query} onChange={e => setNewSearch(s => ({ ...s, query: e.target.value }))} placeholder="Enter search terms..." />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Alert</Label>
                <p className="text-xs text-muted-foreground">Get notified when new results match</p>
              </div>
              <Switch checked={newSearch.alertEnabled} onCheckedChange={v => setNewSearch(s => ({ ...s, alertEnabled: v }))} />
            </div>
            {newSearch.alertEnabled && (
              <>
                <div>
                  <Label>Frequency</Label>
                  <Select value={newSearch.alertFrequency} onValueChange={v => setNewSearch(s => ({ ...s, alertFrequency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time</SelectItem>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Alert Channels</Label>
                  <div className="flex gap-2 mt-2">
                    {['in_app', 'email', 'push'].map(ch => (
                      <Button
                        key={ch}
                        size="sm"
                        variant={newSearch.alertChannels.includes(ch) ? 'default' : 'outline'}
                        onClick={() => setNewSearch(s => ({
                          ...s,
                          alertChannels: s.alertChannels.includes(ch)
                            ? s.alertChannels.filter(c => c !== ch)
                            : [...s.alertChannels, ch]
                        }))}
                      >
                        {ch === 'in_app' ? <Bell className="h-3 w-3 mr-1" /> : ch === 'email' ? <Mail className="h-3 w-3 mr-1" /> : <Smartphone className="h-3 w-3 mr-1" />}
                        {ch.replace('_', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <Label>Pin to top</Label>
              <Switch checked={newSearch.isPinned} onCheckedChange={v => setNewSearch(s => ({ ...s, isPinned: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Save Search</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
