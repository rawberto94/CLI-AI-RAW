/**
 * Remote File Browser Component
 * 
 * Allows users to browse and select folders from connected contract sources.
 * Supports navigation, folder selection, and file preview.
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Folder,
  File,
  FileText,
  Image,
  ChevronRight,
  ChevronLeft,
  Home,
  Loader2,
  Search,
  RefreshCw,
  Check,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface RemoteFile {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  size?: number;
  mimeType?: string;
  modifiedAt?: string;
}

interface FileBrowserProps {
  sourceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  initialPath?: string;
  selectMode?: "folder" | "file" | "both";
  title?: string;
  description?: string;
}

export function FileBrowser({
  sourceId,
  open,
  onOpenChange,
  onSelect,
  initialPath = "/",
  selectMode = "folder",
  title = "Browse Files",
  description = "Select a folder to sync contracts from",
}: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>([]);

  // Fetch files for current path
  const fetchFiles = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        sourceId,
        path,
      });
      const res = await fetch(`/api/contract-sources/browse?${params}`);
      const data = await res.json();
      
      if (data.success) {
        setFiles(data.data.files);
      } else {
        setError(data.error || "Failed to load files");
      }
    } catch (err) {
      setError("Failed to connect to source");
    } finally {
      setIsLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    if (open && sourceId) {
      fetchFiles(currentPath);
    }
  }, [open, sourceId, currentPath, fetchFiles]);

  // Navigate to folder
  const navigateToFolder = (folder: RemoteFile) => {
    setPathHistory([...pathHistory, currentPath]);
    setCurrentPath(folder.path || `${currentPath}/${folder.name}`);
  };

  // Navigate back
  const navigateBack = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      setCurrentPath(previousPath);
    }
  };

  // Navigate to root
  const navigateToRoot = () => {
    setPathHistory([]);
    setCurrentPath("/");
  };

  // Handle selection
  const handleSelect = (file: RemoteFile) => {
    if (selectMode === "folder" && !file.isFolder) return;
    if (selectMode === "file" && file.isFolder) {
      navigateToFolder(file);
      return;
    }
    setSelectedPath(file.path || `${currentPath}/${file.name}`);
  };

  // Confirm selection
  const handleConfirm = () => {
    const pathToSelect = selectedPath || currentPath;
    onSelect(pathToSelect);
    onOpenChange(false);
  };

  // Filter files by search
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort: folders first, then alphabetically
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  // Get file icon
  const getFileIcon = (file: RemoteFile) => {
    if (file.isFolder) {
      return <Folder className="w-5 h-5 text-blue-500" />;
    }
    if (file.mimeType?.startsWith("image/")) {
      return <Image className="w-5 h-5 text-green-500" />;
    }
    if (file.mimeType?.includes("pdf") || file.mimeType?.includes("document")) {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Breadcrumb path parts
  const pathParts = currentPath.split("/").filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Navigation Bar */}
        <div className="flex items-center gap-2 py-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={navigateBack}
            disabled={pathHistory.length === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={navigateToRoot}>
            <Home className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm text-slate-600 overflow-x-auto">
            <span>/</span>
            {pathParts.map((part, index) => (
              <React.Fragment key={index}>
                <span className="truncate max-w-[100px]">{part}</span>
                {index < pathParts.length - 1 && (
                  <ChevronRight className="w-3 h-3 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchFiles(currentPath)}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* File List */}
        <ScrollArea className="flex-1 min-h-[300px] border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-slate-600">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchFiles(currentPath)}
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          ) : sortedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Folder className="w-12 h-12 mb-4 opacity-50" />
              <p>This folder is empty</p>
            </div>
          ) : (
            <div className="divide-y">
              {sortedFiles.map((file) => {
                const filePath = file.path || `${currentPath}/${file.name}`;
                const isSelected = selectedPath === filePath;
                const isSelectable =
                  selectMode === "both" ||
                  (selectMode === "folder" && file.isFolder) ||
                  (selectMode === "file" && !file.isFolder);

                return (
                  <div
                    key={file.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors",
                      isSelected && "bg-blue-50 dark:bg-blue-900/20"
                    )}
                    onClick={() => handleSelect(file)}
                    onDoubleClick={() => file.isFolder && navigateToFolder(file)}
                  >
                    {getFileIcon(file)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {file.modifiedAt && (
                          <span>
                            {formatDistanceToNow(new Date(file.modifiedAt), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                        {!file.isFolder && file.size && (
                          <span>{formatSize(file.size)}</span>
                        )}
                      </div>
                    </div>
                    {isSelected && isSelectable && (
                      <Check className="w-5 h-5 text-blue-600" />
                    )}
                    {file.isFolder && (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Selected Path */}
        {(selectedPath || selectMode === "folder") && (
          <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <span className="text-sm text-slate-600">Selected:</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {selectedPath || currentPath}
            </Badge>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            <Check className="w-4 h-4 mr-2" />
            Select {selectMode === "file" ? "File" : "Folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FileBrowser;
