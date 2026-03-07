'use client';

import { useState, useEffect } from 'react';
import { TemplateManager, type MappingTemplate } from '@/lib/import/template-manager';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MappingTemplate | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    const loaded = TemplateManager.getAllTemplates();
    setTemplates(loaded);
  };

  const openDeleteDialog = (id: string) => {
    setTemplateToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;
    
    setIsDeleting(true);
    try {
      await TemplateManager.deleteTemplate(templateToDelete);
      loadTemplates();
      if (selectedTemplate?.id === templateToDelete) {
        setSelectedTemplate(null);
      }
      toast.success('Template deleted successfully');
    } catch (error) {
      toast.error('Failed to delete template');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleExport = (template: MappingTemplate) => {
    const json = TemplateManager.exportTemplate(template);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    try {
      const template = await TemplateManager.importTemplate(importJson, 'current-user');
      loadTemplates();
      setShowImport(false);
      setImportJson('');
      toast.success(`Template "${template.name}" imported successfully!`);
    } catch (error) {
      toast.error('Failed to import template: ' + (error instanceof Error ? error.message : 'Invalid JSON'));
    }
  };

  const stats = TemplateManager.getStatistics();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Mapping Templates</h1>
          <p className="mt-2 text-gray-600 dark:text-slate-400">
            Manage reusable column mapping templates for faster imports
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
            <p className="text-sm text-gray-600 dark:text-slate-400">Total Templates</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-slate-100">{stats.total}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
            <p className="text-sm text-gray-600 dark:text-slate-400">Avg Success Rate</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {Math.round(stats.avgSuccessRate * 100)}%
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6">
            <p className="text-sm text-gray-600 dark:text-slate-400">Suppliers</p>
            <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
              {Object.keys(stats.bySupplier).length}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            Import Template
          </button>
        </div>

        {/* Import Modal */}
        {showImport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-4">Import Template</h2>
              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder="Paste template JSON here..."
                className="w-full h-64 p-4 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 rounded-lg font-mono text-sm"
              />
              <div className="mt-4 flex gap-4">
                <button
                  onClick={handleImport}
                  className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                >
                  Import
                </button>
                <button
                  onClick={() => {
                    setShowImport(false);
                    setImportJson('');
                  }}
                  className="px-6 py-2 border border-gray-300 dark:border-slate-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Templates Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Template List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Templates</h2>
            {templates.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-8 text-center">
                <p className="text-gray-600 dark:text-slate-400">No templates yet</p>
                <p className="text-sm text-gray-500 dark:text-slate-500 mt-2">
                  Create templates while importing rate cards
                </p>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`
                    bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6 cursor-pointer transition-colors
                    ${selectedTemplate?.id === template.id ? 'ring-2 ring-violet-500' : 'hover:shadow-lg dark:hover:shadow-slate-900'}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-slate-100">{template.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{template.description}</p>
                      
                      {template.supplierName && (
                        <p className="text-sm text-violet-600 dark:text-violet-400 mt-2">
                          Supplier: {template.supplierName}
                        </p>
                      )}

                      <div className="flex gap-4 mt-3 text-sm text-gray-500 dark:text-slate-500">
                        <span>Used: {template.usageCount}x</span>
                        <span>Success: {Math.round(template.successRate * 100)}%</span>
                        <span>{template.mappings.length} mappings</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExport(template);
                        }}
                        className="p-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200"
                        title="Export"
                      >
                        ⬇️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteDialog(template.id);
                        }}
                        className="p-2 text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Template Details */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">Details</h2>
            {selectedTemplate ? (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-6 space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-2">Information</h3>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-slate-400">Name:</dt>
                      <dd className="font-medium text-gray-900 dark:text-slate-100">{selectedTemplate.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-slate-400">Version:</dt>
                      <dd className="font-medium text-gray-900 dark:text-slate-100">{selectedTemplate.version}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-slate-400">Created:</dt>
                      <dd className="font-medium text-gray-900 dark:text-slate-100">
                        {selectedTemplate.createdAt.toLocaleDateString()}
                      </dd>
                    </div>
                    {selectedTemplate.lastUsed && (
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-slate-400">Last Used:</dt>
                        <dd className="font-medium text-gray-900 dark:text-slate-100">
                          {selectedTemplate.lastUsed.toLocaleDateString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-2">Column Mappings</h3>
                  <div className="space-y-2">
                    {selectedTemplate.mappings.map((mapping, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700/50 rounded"
                      >
                        <span className="text-sm text-gray-700 dark:text-slate-300">{mapping.sourceColumn}</span>
                        <span className="text-sm text-gray-400 dark:text-slate-500">→</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {mapping.targetField}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          {Math.round(mapping.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTemplate.fileNamePattern && (
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-2">File Pattern</h3>
                    <code className="block p-2 bg-gray-50 dark:bg-slate-700/50 rounded text-sm text-gray-900 dark:text-slate-100">
                      {selectedTemplate.fileNamePattern}
                    </code>
                  </div>
                )}

                <div>
                  <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-2">Header Patterns</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.headerPatterns.map((pattern, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-300 rounded text-sm"
                      >
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow dark:shadow-slate-900/50 p-8 text-center text-gray-500 dark:text-slate-400">
                Select a template to view details
              </div>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Template"
          description="Are you sure you want to delete this template? This action cannot be undone."
          confirmLabel="Delete"
          variant="destructive"
          isLoading={isDeleting}
          onConfirm={handleDelete}
        />
      </div>
    </div>
  );
}
