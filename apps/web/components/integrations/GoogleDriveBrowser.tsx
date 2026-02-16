'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  Folder,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  ChevronRight,
  ChevronDown,
  Home,
  RefreshCw,
  Check,
  X,
  Upload,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Search,
  Filter,
  Grid,
  List,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  iconLink?: string;
  thumbnailLink?: string;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface GoogleDriveBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (files: DriveFile[]) => void;
}

const MIME_TYPE_ICONS: Record<string, React.ReactNode> = {
  'application/vnd.google-apps.folder': <Folder className="h-5 w-5 text-yellow-500" />,
  'application/pdf': <FileText className="h-5 w-5 text-red-500" />,
  'application/msword': <FileText className="h-5 w-5 text-violet-500" />,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': <FileText className="h-5 w-5 text-violet-500" />,
  'application/vnd.ms-excel': <FileSpreadsheet className="h-5 w-5 text-green-500" />,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': <FileSpreadsheet className="h-5 w-5 text-green-500" />,
  'image/jpeg': <FileImage className="h-5 w-5 text-violet-500" />,
  'image/png': <FileImage className="h-5 w-5 text-violet-500" />,
  'text/plain': <FileText className="h-5 w-5 text-gray-500" />,
  'text/csv': <FileSpreadsheet className="h-5 w-5 text-green-500" />,
};

function getFileIcon(mimeType: string): React.ReactNode {
  return MIME_TYPE_ICONS[mimeType] || <File className="h-5 w-5 text-gray-400" />;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function GoogleDriveBrowser({ isOpen, onClose, onImport }: GoogleDriveBrowserProps) {
  const { toast } = useToast();
  
  const [connected, setConnected] = useState<boolean | null>(null);
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [importing, setImporting] = useState(false);

  // Check connection status
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/google-drive');
      const data = await response.json();
      
      setConnected(data.connected);
      if (data.accountEmail) {
        setAccountEmail(data.accountEmail);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  // Load files from current folder
  const loadFiles = useCallback(async (folderId: string = 'root') => {
    setLoading(true);
    try {
      const response = await fetch('/api/integrations/google-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', folderId }),
      });

      const data = await response.json();
      
      if (data.success) {
        setFiles(data.files || []);
      } else {
        throw new Error(data.error);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load files from Google Drive',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen, checkConnection]);

  // Load files when connected
  useEffect(() => {
    if (connected && isOpen) {
      loadFiles('root');
    }
  }, [connected, isOpen, loadFiles]);

  // Connect to Google Drive
  const handleConnect = async () => {
    try {
      const response = await fetch('/api/integrations/google-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' }),
      });

      const data = await response.json();
      
      if (data.authUrl) {
        // Open OAuth popup
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.authUrl,
          'Connect Google Drive',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Poll for popup close
        const interval = setInterval(() => {
          if (popup?.closed) {
            clearInterval(interval);
            checkConnection();
          }
        }, 500);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(interval);
        }, 5 * 60 * 1000);
      }
    } catch {
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to Google Drive',
        variant: 'destructive',
      });
    }
  };

  // Navigate to folder
  const handleFolderClick = (folder: DriveFile) => {
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFiles(new Set());
    loadFiles(folder.id);
  };

  // Navigate via breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBreadcrumbs);
    setSelectedFiles(new Set());
    const lastBreadcrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
    if (lastBreadcrumb) {
      loadFiles(lastBreadcrumb.id);
    }
  };

  // Toggle file selection
  const handleFileSelect = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  // Select all files (not folders)
  const handleSelectAll = () => {
    const selectableFiles = files.filter(
      f => f.mimeType !== 'application/vnd.google-apps.folder'
    );
    
    if (selectedFiles.size === selectableFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(selectableFiles.map(f => f.id)));
    }
  };

  // Import selected files
  const handleImport = async () => {
    if (selectedFiles.size === 0) return;

    setImporting(true);
    try {
      const response = await fetch('/api/integrations/google-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import-batch',
          fileIds: Array.from(selectedFiles),
        }),
      });

      const data = await response.json();

      if (data.success) {
        const importedFiles = files.filter(f => selectedFiles.has(f.id));
        toast({
          title: 'Import Complete',
          description: `Successfully imported ${data.imported.length} file(s)`,
        });
        onImport(importedFiles);
        onClose();
      } else {
        throw new Error(data.error);
      }
    } catch {
      toast({
        title: 'Import Failed',
        description: 'Failed to import selected files',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  // Filter files by search
  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Separate folders and files
  const folders = filteredFiles.filter(
    f => f.mimeType === 'application/vnd.google-apps.folder'
  );
  const documents = filteredFiles.filter(
    f => f.mimeType !== 'application/vnd.google-apps.folder'
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Cloud className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <DialogTitle>Import from Google Drive</DialogTitle>
                <DialogDescription>
                  {connected ? (
                    <span className="text-green-600">Connected as {accountEmail}</span>
                  ) : (
                    'Connect your Google Drive to import documents'
                  )}
                </DialogDescription>
              </div>
            </div>
            {connected && (
              <Button variant="outline" size="sm" onClick={() => {
                const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
                if (lastBreadcrumb) {
                  loadFiles(lastBreadcrumb.id);
                }
              }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
          </div>
        </DialogHeader>

        {connected === null ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          </div>
        ) : !connected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="p-4 bg-gray-100 rounded-full">
              <Cloud className="h-12 w-12 text-gray-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Connect Google Drive</h3>
              <p className="text-gray-500 mt-1 max-w-md">
                Link your Google Drive account to browse and import contract documents directly.
              </p>
            </div>
            <Button onClick={handleConnect} size="lg">
              <Cloud className="h-5 w-5 mr-2" />
              Connect Google Drive
            </Button>
            <p className="text-xs text-gray-400 max-w-sm text-center">
              We only request read access to your files. You control which files to import.
            </p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between gap-4">
              {/* Breadcrumbs */}
              <div className="flex items-center gap-1 text-sm overflow-x-auto">
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.id}>
                    {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className={cn(
                        "px-2 py-1 rounded hover:bg-gray-200 whitespace-nowrap",
                        index === breadcrumbs.length - 1 ? "font-medium text-gray-900" : "text-gray-500"
                      )}
                    >
                      {index === 0 ? <Home className="h-4 w-4" /> : crumb.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* Search and view toggle */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-48"
                  />
                </div>
                <div className="flex border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-2",
                      viewMode === 'list' ? "bg-gray-100" : "hover:bg-gray-50"
                    )}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "p-2",
                      viewMode === 'grid' ? "bg-gray-100" : "hover:bg-gray-50"
                    )}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* File browser */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Folder className="h-12 w-12 mb-4" />
                  <p>No files found</p>
                </div>
              ) : viewMode === 'list' ? (
                <div className="space-y-1">
                  {/* Select all header */}
                  {documents.length > 0 && (
                    <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-500 border-b">
                      <Checkbox
                        checked={selectedFiles.size === documents.length && documents.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                      <span>Select all ({documents.length} files)</span>
                    </div>
                  )}

                  {/* Folders first */}
                  {folders.map((folder) => (
                    <motion.div
                      key={folder.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleFolderClick(folder)}
                    >
                      {getFileIcon(folder.mimeType)}
                      <span className="flex-1 font-medium">{folder.name}</span>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </motion.div>
                  ))}

                  {/* Then files */}
                  {documents.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
                        selectedFiles.has(file.id) ? "bg-violet-50" : "hover:bg-gray-100"
                      )}
                      onClick={() => handleFileSelect(file.id)}
                    >
                      <Checkbox
                        checked={selectedFiles.has(file.id)}
                        onCheckedChange={() => handleFileSelect(file.id)}
                      />
                      {getFileIcon(file.mimeType)}
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-sm text-gray-400">
                        {formatFileSize(file.size)}
                      </span>
                      <span className="text-sm text-gray-400 w-24">
                        {formatDate(file.modifiedTime)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {/* Folders */}
                  {folders.map((folder) => (
                    <motion.div
                      key={folder.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleFolderClick(folder)}
                    >
                      <Folder className="h-12 w-12 text-yellow-500" />
                      <span className="text-sm text-center truncate w-full">{folder.name}</span>
                    </motion.div>
                  ))}

                  {/* Files */}
                  {documents.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-lg cursor-pointer relative",
                        selectedFiles.has(file.id) ? "bg-violet-50 ring-2 ring-violet-500" : "hover:bg-gray-100"
                      )}
                      onClick={() => handleFileSelect(file.id)}
                    >
                      {selectedFiles.has(file.id) && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-5 w-5 text-violet-600" />
                        </div>
                      )}
                      {file.thumbnailLink ? (
                        
                        <img
                          src={file.thumbnailLink}
                          alt={file.name}
                          className="h-12 w-12 object-cover rounded"
                        />
                      ) : (
                        <div className="h-12 w-12 flex items-center justify-center">
                          {getFileIcon(file.mimeType)}
                        </div>
                      )}
                      <span className="text-sm text-center truncate w-full">{file.name}</span>
                      <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <DialogFooter className="px-6 py-4 border-t bg-gray-50">
              <div className="flex items-center justify-between w-full">
                <div className="text-sm text-gray-500">
                  {selectedFiles.size > 0 ? (
                    <span className="text-violet-600 font-medium">
                      {selectedFiles.size} file(s) selected
                    </span>
                  ) : (
                    'Select files to import'
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={selectedFiles.size === 0 || importing}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import {selectedFiles.size > 0 ? `(${selectedFiles.size})` : ''}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default GoogleDriveBrowser;
