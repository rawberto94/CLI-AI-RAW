'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Inbox,
  Search,
  Trash2,
  Play,
  Bell,
  BellOff,
  Clock,
  FileText,
  Loader2,
  Plus,
  Star,
  StarOff,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { PageBreadcrumb } from '@/components/navigation';

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: Record<string, string>;
  resultCount: number;
  alertsEnabled: boolean;
  isFavorite: boolean;
  lastRun: string;
  createdAt: string;
}

export default function SavedSearchesPage() {
  const router = useRouter();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchSavedSearches();
  }, []);

  const fetchSavedSearches = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/search/saved');
      if (res.ok) {
        const data = await res.json();
        setSearches(data.data?.searches || data.searches || []);
      } else {
        // Fallback: load from localStorage
        const stored = localStorage.getItem('savedSearches');
        if (stored) {
          setSearches(JSON.parse(stored));
        }
      }
    } catch {
      const stored = localStorage.getItem('savedSearches');
      if (stored) {
        setSearches(JSON.parse(stored));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSearches(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('savedSearches', JSON.stringify(updated));
      return updated;
    });
    toast.success('Search deleted');
  };

  const toggleAlert = (id: string) => {
    setSearches(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, alertsEnabled: !s.alertsEnabled } : s);
      localStorage.setItem('savedSearches', JSON.stringify(updated));
      return updated;
    });
    toast.success('Alert preference updated');
  };

  const toggleFavorite = (id: string) => {
    setSearches(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
      localStorage.setItem('savedSearches', JSON.stringify(updated));
      return updated;
    });
  };

  const runSearch = (search: SavedSearch) => {
    const params = new URLSearchParams({ q: search.query, ...search.filters });
    router.push(`/search?${params.toString()}`);
  };

  const filteredSearches = searches
    .filter(s => !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.query.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <PageBreadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <Inbox className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              Saved Searches
            </h1>
            <p className="text-muted-foreground">
              {searches.length} saved search{searches.length !== 1 ? 'es' : ''} with optional alerts
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSavedSearches}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
          <Button onClick={() => router.push('/search')}><Plus className="h-4 w-4 mr-2" /> New Search</Button>
        </div>
      </div>

      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter saved searches..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Search List */}
      {filteredSearches.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h3 className="text-lg font-medium mb-2">No saved searches</h3>
            <p className="text-muted-foreground mb-4">
              Save searches from the Smart Search page to quickly re-run them later
            </p>
            <Button onClick={() => router.push('/search')}>
              <Search className="h-4 w-4 mr-2" /> Go to Search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredSearches.map((search) => (
              <motion.div
                key={search.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <button onClick={() => toggleFavorite(search.id)} className="flex-shrink-0">
                        {search.isFavorite ? (
                          <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                        ) : (
                          <StarOff className="h-5 w-5 text-muted-foreground hover:text-amber-500" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{search.name}</span>
                          {search.alertsEnabled && (
                            <Badge variant="outline" className="bg-violet-50 text-violet-700 text-xs">
                              <Bell className="h-3 w-3 mr-1" /> Alerts On
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          <Search className="h-3 w-3 inline mr-1" />
                          {search.query}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span><FileText className="h-3 w-3 inline mr-1" />{search.resultCount} results</span>
                          <span><Clock className="h-3 w-3 inline mr-1" />Last run {new Date(search.lastRun).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => runSearch(search)} title="Run search">
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleAlert(search.id)} title={search.alertsEnabled ? 'Disable alerts' : 'Enable alerts'}>
                          {search.alertsEnabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(search.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
