/**
 * UI/UX Features Showcase
 * Demonstrates all new efficiency and usability features
 */

'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { FilterChips, useFilterChips } from '@/components/ui/filter-chips';
import { showSuccessUndo, showErrorUndo, useUndoable } from '@/components/ui/undo-toast';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Sparkles, 
  Trash2, 
  Download, 
  CheckCircle,
  Clock,
  Zap,
  Keyboard,
  Filter,
  Undo2,
  Save,
  History,
} from 'lucide-react';
import { toast } from 'sonner';



export default function UIFeaturesShowcase() {
  // Demo states
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Auto-save demo
  const { isSaving, lastSaved, hasUnsavedChanges } = useAutoSave({
    data: formData,
    onSave: async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    delay: 2000,
    showSuccessToast: true,
    successMessage: 'Draft saved',
  });

  // Filter chips demo
  const { filters, addFilter, removeFilter, clearAll } = useFilterChips();

  // Recently viewed demo
  const { items: recentItems, addItem, clearAll: clearRecent } = useRecentlyViewed({
    storageKey: 'recentDemo',
    maxItems: 5,
  });

  // Undoable actions demo
  const { executeWithUndo } = useUndoable();

  const handleAddFilter = () => {
    const colors: Array<'blue' | 'green' | 'yellow' | 'purple'> = ['blue', 'green', 'yellow', 'purple'];
    const types = ['Status', 'Priority', 'Category', 'Type'];
    const values = ['Active', 'High', 'Contract', 'SOW'];
    
    const randomType = types[Math.floor(Math.random() * types.length)];
    const randomValue = values[Math.floor(Math.random() * values.length)];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    addFilter({
      id: `filter-${Date.now()}`,
      label: randomType,
      value: randomValue,
      color: randomColor,
    });
  };

  const handleDeleteWithUndo = async () => {
    setIsDeleting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsDeleting(false);

    const deletedItem = { id: '1', title: 'Contract XYZ' };

    showSuccessUndo(
      'Contract deleted',
      async () => {
        // Restore the item
        await new Promise(resolve => setTimeout(resolve, 500));
        toast.success('Contract restored');
      },
      'Undo'
    );
  };

  const handleBulkDelete = async () => {
    await executeWithUndo({
      action: async () => {
        // Simulate bulk delete
        await new Promise(resolve => setTimeout(resolve, 1000));
      },
      undo: async () => {
        // Simulate restore
        await new Promise(resolve => setTimeout(resolve, 500));
      },
      message: 'Deleted 3 contracts',
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsExporting(false);
    toast.success('Export complete');
  };

  const handleAddRecentItem = () => {
    addItem({
      id: `item-${Date.now()}`,
      title: `Contract ${Math.floor(Math.random() * 1000)}`,
      type: 'contract',
      href: `/contracts/${Date.now()}`,
      metadata: { status: 'active' },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 py-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            UI/UX Features Showcase
          </h1>
          <p className="text-slate-600 text-lg">
            Comprehensive efficiency and usability improvements
          </p>
        </div>

        {/* Keyboard Shortcuts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-violet-600" />
              <CardTitle>Keyboard Shortcuts</CardTitle>
            </div>
            <CardDescription>
              Quick navigation and actions via keyboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-sm text-slate-600">Command Palette</span>
                <div className="flex gap-1">
                  <Badge variant="outline">Cmd</Badge>
                  <span className="text-slate-400">+</span>
                  <Badge variant="outline">K</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-sm text-slate-600">New Contract</span>
                <div className="flex gap-1">
                  <Badge variant="outline">Cmd</Badge>
                  <span className="text-slate-400">+</span>
                  <Badge variant="outline">N</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-sm text-slate-600">Focus Search</span>
                <Badge variant="outline">/</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <span className="text-sm text-slate-600">Go to Contracts</span>
                <div className="flex gap-1">
                  <Badge variant="outline">Alt</Badge>
                  <span className="text-slate-400">+</span>
                  <Badge variant="outline">C</Badge>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                document.dispatchEvent(event);
              }}
              className="w-full"
            >
              <Keyboard className="mr-2 h-4 w-4" />
              Try Opening Command Palette (Cmd+K)
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Auto-Save */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Save className="h-5 w-5 text-green-600" />
                <CardTitle>Auto-Save</CardTitle>
              </div>
              <CardDescription>
                Automatic form data persistence
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Contract title..."
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
                <Input
                  placeholder="Description..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {isSaving ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin text-violet-600" />
                      <span className="text-violet-600">Saving...</span>
                    </>
                  ) : hasUnsavedChanges ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                      <span className="text-slate-600">Unsaved changes</span>
                    </>
                  ) : lastSaved ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-green-600">All changes saved</span>
                    </>
                  ) : null}
                </div>
                {lastSaved && (
                  <span className="text-xs text-slate-400">
                    {new Date(lastSaved).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filter Chips */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-violet-600" />
                <CardTitle>Filter Chips</CardTitle>
              </div>
              <CardDescription>
                Visual active filter indicators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterChips
                filters={filters}
                onRemove={removeFilter}
                onClearAll={clearAll}
                showClearAll={true}
              />
              {filters.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No active filters. Click &quot;Add Filter&quot; below.
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleAddFilter} variant="outline" className="flex-1">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Add Filter
                </Button>
                {filters.length > 0 && (
                  <Button onClick={clearAll} variant="ghost">
                    Clear All
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading Buttons & Undo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                <CardTitle>Loading Buttons</CardTitle>
              </div>
              <CardDescription>
                Buttons with integrated loading states
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <LoadingButton
                loading={isExporting}
                loadingText="Exporting..."
                onClick={handleExport}
                variant="default"
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
              </LoadingButton>
              <LoadingButton
                loading={isDeleting}
                loadingText="Deleting..."
                onClick={handleDeleteWithUndo}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete with Undo
              </LoadingButton>
              <Button
                onClick={handleBulkDelete}
                variant="outline"
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Bulk Delete (Undoable)
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-violet-600" />
                <CardTitle>Recently Viewed</CardTitle>
              </div>
              <CardDescription>
                Track and access recent items
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No recent items. Click &quot;Add Item&quot; below.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-700">{item.title}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      <Badge variant="outline">{item.type}</Badge>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleAddRecentItem} variant="outline" className="flex-1">
                  Add Item
                </Button>
                {recentItems.length > 0 && (
                  <Button onClick={clearRecent} variant="ghost">
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Panel */}
        <Card className="border-violet-200 bg-violet-50/50">
          <CardHeader>
            <CardTitle className="text-violet-900">✨ What&apos;s New</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-violet-800">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span><strong>Keyboard Shortcuts:</strong> Navigate faster with Cmd+K, Cmd+N, and more</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span><strong>Auto-Save:</strong> Your work is automatically saved every 3 seconds</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span><strong>Filter Chips:</strong> See active filters at a glance and remove them easily</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span><strong>Undo Actions:</strong> Accidentally deleted something? Undo it instantly</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span><strong>Recently Viewed:</strong> Quick access to your recent contracts and items</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span><strong>Loading States:</strong> Clear feedback for all async operations</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
