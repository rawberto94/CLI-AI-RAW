"use client";

/**
 * Export Chat to Document Component
 * 
 * Allows users to export AI chat conversations as PDF or Word documents.
 * Includes formatting, branding, and customization options.
 */

import React, { useState, useCallback } from 'react';
import {
  Download,
  FileText,
  FileType,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Types
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    contractId?: string;
    contractName?: string;
  };
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  contractId?: string;
  contractName?: string;
}

interface ExportOptions {
  format: 'pdf' | 'docx' | 'txt' | 'markdown';
  includeTimestamps: boolean;
  includeMetadata: boolean;
  includeBranding: boolean;
  title: string;
  pageSize: 'a4' | 'letter';
  headerText?: string;
  footerText?: string;
}

interface ExportChatDialogProps {
  conversation: Conversation;
  trigger?: React.ReactNode;
  onExportComplete?: (format: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DEFAULT_OPTIONS: ExportOptions = {
  format: 'pdf',
  includeTimestamps: true,
  includeMetadata: false,
  includeBranding: true,
  title: '',
  pageSize: 'a4',
};

export function ExportChatDialog({
  conversation,
  trigger,
  onExportComplete,
  open: controlledOpen,
  onOpenChange,
}: ExportChatDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Support both controlled and uncontrolled modes
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = useCallback((value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    }
    setInternalOpen(value);
  }, [onOpenChange]);
  
  const [options, setOptions] = useState<ExportOptions>({
    ...DEFAULT_OPTIONS,
    title: conversation.title || 'AI Chat Conversation',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportSuccess(false);

    try {
      const content = formatConversation(conversation, options);
      
      switch (options.format) {
        case 'pdf':
          await exportToPDF(content, options);
          break;
        case 'docx':
          await exportToDocx(content, options);
          break;
        case 'txt':
          exportToText(content, options);
          break;
        case 'markdown':
          exportToMarkdown(content, options);
          break;
      }

      setExportSuccess(true);
      onExportComplete?.(options.format);
      
      // Auto-close after success
      setTimeout(() => {
        setOpen(false);
        setExportSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [conversation, options, onExportComplete, setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Conversation</DialogTitle>
          <DialogDescription>
            Download this chat as a document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'pdf', label: 'PDF', icon: FileText },
                { value: 'docx', label: 'Word', icon: FileType },
                { value: 'txt', label: 'Text', icon: FileText },
                { value: 'markdown', label: 'MD', icon: FileText },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setOptions((o) => ({ ...o, format: value as ExportOptions['format'] }))}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                    options.format === value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              value={options.title}
              onChange={(e) => setOptions((o) => ({ ...o, title: e.target.value }))}
              placeholder="Enter document title"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>Options</Label>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="timestamps"
                checked={options.includeTimestamps}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({ ...o, includeTimestamps: !!checked }))
                }
              />
              <label htmlFor="timestamps" className="text-sm text-slate-600 cursor-pointer">
                Include timestamps
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="metadata"
                checked={options.includeMetadata}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({ ...o, includeMetadata: !!checked }))
                }
              />
              <label htmlFor="metadata" className="text-sm text-slate-600 cursor-pointer">
                Include AI metadata (model, tokens)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="branding"
                checked={options.includeBranding}
                onCheckedChange={(checked) =>
                  setOptions((o) => ({ ...o, includeBranding: !!checked }))
                }
              />
              <label htmlFor="branding" className="text-sm text-slate-600 cursor-pointer">
                Include Contigo branding
              </label>
            </div>
          </div>

          {/* Page size for PDF/Word */}
          {(options.format === 'pdf' || options.format === 'docx') && (
            <div className="space-y-2">
              <Label>Page Size</Label>
              <Select
                value={options.pageSize}
                onValueChange={(v) => setOptions((o) => ({ ...o, pageSize: v as 'a4' | 'letter' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Preview */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-2">Preview</p>
            <div className="text-sm">
              <p className="font-medium">{options.title}</p>
              <p className="text-slate-500">
                {conversation.messages.length} messages • {formatDate(conversation.createdAt)}
              </p>
              {conversation.contractName && (
                <p className="text-slate-500 text-xs mt-1">
                  Contract: {conversation.contractName}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : exportSuccess ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export {options.format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Format conversation content
function formatConversation(conversation: Conversation, options: ExportOptions): string {
  let content = '';
  
  // Header
  if (options.includeBranding) {
    content += 'CONTIGO CONTRACT INTELLIGENCE\n';
    content += '================================\n\n';
  }
  
  content += `${options.title}\n`;
  content += `${'='.repeat(options.title.length)}\n\n`;
  
  if (conversation.contractName) {
    content += `Contract: ${conversation.contractName}\n`;
  }
  content += `Date: ${formatDate(conversation.createdAt)}\n`;
  content += `Messages: ${conversation.messages.length}\n\n`;
  content += '---\n\n';
  
  // Messages
  for (const message of conversation.messages) {
    const sender = message.role === 'user' ? 'You' : 'AI Assistant';
    const icon = message.role === 'user' ? '👤' : '🤖';
    
    if (options.includeTimestamps) {
      content += `[${formatTime(message.timestamp)}] `;
    }
    
    content += `${icon} ${sender}:\n`;
    content += `${message.content}\n`;
    
    if (options.includeMetadata && message.metadata) {
      const meta: string[] = [];
      if (message.metadata.model) meta.push(`Model: ${message.metadata.model}`);
      if (message.metadata.tokens) meta.push(`Tokens: ${message.metadata.tokens}`);
      if (meta.length > 0) {
        content += `[${meta.join(' | ')}]\n`;
      }
    }
    
    content += '\n';
  }
  
  // Footer
  if (options.includeBranding) {
    content += '---\n';
    content += `Generated by Contigo on ${formatDate(new Date().toISOString())}\n`;
  }
  
  return content;
}

// Export to PDF using jsPDF
async function exportToPDF(content: string, options: ExportOptions): Promise<void> {
  // Dynamic import jsPDF
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF({
    format: options.pageSize,
    unit: 'mm',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  
  let y = margin;
  
  // Header
  if (options.includeBranding) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('CONTIGO CONTRACT INTELLIGENCE', margin, y);
    y += 10;
  }
  
  // Title
  doc.setFontSize(16);
  doc.setTextColor(0);
  doc.text(options.title, margin, y);
  y += 10;
  
  // Content
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(content, maxWidth);
  
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 5;
  }
  
  // Save
  const filename = sanitizeFilename(options.title) + '.pdf';
  doc.save(filename);
}

// Export to DOCX
async function exportToDocx(content: string, options: ExportOptions): Promise<void> {
  // For full DOCX support, use docx library
  // Simplified: export as HTML that Word can open
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${options.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { color: #666; font-size: 12px; margin-bottom: 20px; }
    h1 { color: #333; }
    .message { margin: 15px 0; padding: 10px; border-radius: 8px; }
    .user { background: #e3f2fd; }
    .assistant { background: #f3e5f5; }
    .sender { font-weight: bold; margin-bottom: 5px; }
    .time { color: #999; font-size: 11px; }
    .meta { color: #999; font-size: 10px; margin-top: 5px; }
    .footer { margin-top: 30px; color: #666; font-size: 11px; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  ${options.includeBranding ? '<div class="header">CONTIGO CONTRACT INTELLIGENCE</div>' : ''}
  <h1>${options.title}</h1>
  <pre>${content}</pre>
  ${options.includeBranding ? `<div class="footer">Generated by Contigo on ${formatDate(new Date().toISOString())}</div>` : ''}
</body>
</html>`;
  
  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-word' });
  downloadBlob(blob, sanitizeFilename(options.title) + '.doc');
}

// Export to plain text
function exportToText(content: string, options: ExportOptions): void {
  const blob = new Blob([content], { type: 'text/plain' });
  downloadBlob(blob, sanitizeFilename(options.title) + '.txt');
}

// Export to Markdown
function exportToMarkdown(content: string, options: ExportOptions): void {
  // Convert to Markdown format
  let markdown = `# ${options.title}\n\n`;
  
  if (options.includeBranding) {
    markdown += `> Generated by **Contigo Contract Intelligence**\n\n`;
  }
  
  markdown += content
    .replace(/^=+$/gm, '')
    .replace(/^---$/gm, '\n---\n')
    .replace(/👤 You:/g, '### 👤 You')
    .replace(/🤖 AI Assistant:/g, '### 🤖 AI Assistant');
  
  const blob = new Blob([markdown], { type: 'text/markdown' });
  downloadBlob(blob, sanitizeFilename(options.title) + '.md');
}

// Utility functions
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Quick export button (simpler interface)
export function QuickExportButton({
  conversation,
  format = 'pdf',
}: {
  conversation: Conversation;
  format?: 'pdf' | 'txt';
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleQuickExport = async () => {
    setIsExporting(true);
    try {
      const options: ExportOptions = {
        ...DEFAULT_OPTIONS,
        format,
        title: conversation.title || 'Chat Export',
      };
      const content = formatConversation(conversation, options);
      
      if (format === 'pdf') {
        await exportToPDF(content, options);
      } else {
        exportToText(content, options);
      }
    } catch (error) {
      console.error('Quick export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleQuickExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
    </Button>
  );
}

export default ExportChatDialog;
