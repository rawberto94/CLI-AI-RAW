 'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { BackButton } from '@/components/ui/back-button';
import { 
  FileEdit, 
  Download, 
  GitCompare, 
  Library, 
  Braces, 
  MessageSquare,
  CheckCheck,
  X,
  Highlighter,
  Settings
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/config';
import { tenantHeaders } from '@/lib/tenant';

interface Draft {
  id: string;
  title: string;
  status: string; // Accept API statuses as-is (UPLOADED, PROCESSING, COMPLETED, FAILED)
  version: string;
  lastSaved: string;
  content: string;
}

type ApiContract = {
  id: string;
  name: string;
  status: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  createdAt?: string;
  updatedAt?: string;
};

const fetcher = (url: string) => fetch(url, { headers: tenantHeaders() }).then(async (r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return Array.isArray(data) ? data : (data?.items || []);
});

export default function DraftsPage() {
  const router = useRouter();
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [activeTab, setActiveTab] = useState<'findings' | 'library' | 'variables'>('findings');
  const [isEditing] = useState(false);

  // Load real contracts from backend
  const { data, error, isLoading } = useSWR<ApiContract[]>(`${API_BASE_URL}/api/contracts`, fetcher, {
    revalidateOnFocus: false,
  });

  const drafts: Draft[] = useMemo(() => {
    if (!data) return [];
    return data.map((c) => {
      const updated = c.updatedAt ? new Date(c.updatedAt) : undefined;
      const lastSaved = updated ? updated.toLocaleString() : '—';
      return {
        id: c.id,
        title: c.name || c.id,
        status: c.status,
        version: 'v1.0',
        lastSaved,
        content: '',
      } as Draft;
    });
  }, [data]);

  const getStatusColor = (status: string) => {
    switch (status) {
      // Legacy UI statuses
      case 'Draft':
      case 'UPLOADED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'For Review':
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Approved':
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const createAndOpenDraft = () => {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    router.push(`/drafts/workspace/${id}?role=client`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div className="mb-2"><BackButton hrefFallback="/" /></div>
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
                <FileEdit className="w-7 h-7 mr-3 text-indigo-600" />
                Draft Editor
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Create, edit, and redline contract drafts with AI assistance
              </p>
            </div>
            <button onClick={createAndOpenDraft} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors">
              <FileEdit className="w-4 h-4" />
              <span>New Draft</span>
            </button>
          </div>
        </div>

        {selectedDraft ? (
          /* Editor View */
          <div className="space-y-6">
            
            {/* Draft Header */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <input 
                    type="text" 
                    value={selectedDraft.title}
                    className="text-xl font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-white"
                    readOnly={!isEditing}
                  />
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Version: {selectedDraft.version}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedDraft.status)}`}>
                      {selectedDraft.status}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Last saved: {selectedDraft.lastSaved}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDraft(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center space-x-2">
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors">
                    <Library className="w-4 h-4" />
                    <span>Insert Clause</span>
                  </button>
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors">
                    <Settings className="w-4 h-4" />
                    <span>AI Rewrite</span>
                  </button>
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors">
                    <GitCompare className="w-4 h-4" />
                    <span>Compare</span>
                  </button>
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors">
                    <Highlighter className="w-4 h-4" />
                    <span>Track Changes</span>
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <Link
                    href={`/drafts/workspace/${selectedDraft.id}`}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md transition-colors border border-indigo-200"
                  >
                    <FileEdit className="w-4 h-4" />
                    <span>Open Workspace</span>
                  </Link>
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800 rounded-md transition-colors">
                    <CheckCheck className="w-4 h-4" />
                    <span>Accept</span>
                  </button>
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:text-red-200 dark:hover:bg-red-800 rounded-md transition-colors">
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors">
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Editor Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-6">
              
              {/* Editor Pane */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-6">
                  <textarea 
                    className="w-full h-96 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={selectedDraft.content}
                    placeholder="Start typing your contract draft..."
                  />
                </div>
              </div>

              {/* Context Drawer */}
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                  
                  {/* Tabs */}
                  <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex">
                      {[
                        { id: 'findings', label: 'Findings', icon: MessageSquare },
                        { id: 'library', label: 'Library', icon: Library },
                        { id: 'variables', label: 'Variables', icon: Braces }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                          }`}
                        >
                          <tab.icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Tab Content */}
                  <div className="p-4">
                    {activeTab === 'findings' && (
                      <div className="space-y-3">
                        <h3 className="font-medium text-gray-900 dark:text-white">Compliance Issues</h3>
                        <div className="space-y-2">
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-red-800 dark:text-red-200">Payment Terms Violation</p>
                                <p className="text-xs text-red-600 dark:text-red-300 mt-1">Exceeds 30-day limit</p>
                              </div>
                              <button className="text-xs text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100">
                                Apply Fix
                              </button>
                            </div>
                          </div>
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Missing Clause</p>
                                <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">Termination clause recommended</p>
                              </div>
                              <button className="text-xs text-yellow-700 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-100">
                                Apply Fix
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'library' && (
                      <div className="space-y-3">
                        <h3 className="font-medium text-gray-900 dark:text-white">Template Clauses</h3>
                        <div className="space-y-2">
                          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Standard Termination</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">30-day notice period</p>
                          </div>
                          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Confidentiality</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Standard NDA terms</p>
                          </div>
                          <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Payment Terms</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Net 30 payment terms</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'variables' && (
                      <div className="space-y-3">
                        <h3 className="font-medium text-gray-900 dark:text-white">Contract Variables</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Customer Legal Name
                            </label>
                            <input 
                              type="text" 
                              placeholder="{{CustomerLegalName}}"
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Notice Days
                            </label>
                            <input 
                              type="number" 
                              placeholder="{{NoticeDays}}"
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Effective Date
                            </label>
                            <input 
                              type="date" 
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            />
                          </div>
                          <button className="w-full mt-3 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors">
                            Apply Variables
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Draft List View */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Drafts</h2>
              {isLoading && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading drafts…</p>
              )}
              {error && (
                <p className="text-sm text-red-600 dark:text-red-300">Failed to load drafts</p>
              )}
              <div className="space-y-3">
                {drafts.map((draft) => (
                  <div 
                    key={draft.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => setSelectedDraft(draft)}>
                        <h3 className="font-medium text-gray-900 dark:text-white">{draft.title}</h3>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{draft.version}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(draft.status)}`}>
                            {draft.status}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">Updated {draft.lastSaved}</span>
                        </div>
                      </div>
                      <Link href={`/drafts/workspace/${draft.id}`} className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1">
                        <FileEdit className="w-4 h-4" />
                        <span>Open Workspace</span>
                      </Link>
                    </div>
                  </div>
                ))}
                {!isLoading && !error && drafts.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No drafts yet. Upload a contract or create a new draft.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
