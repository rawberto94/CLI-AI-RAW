'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';

interface ImportResult {
  email: string;
  status: 'created' | 'invited' | 'skipped' | 'error';
  reason?: string;
}

interface ImportSummary {
  total: number;
  created: number;
  invited: number;
  skipped: number;
  errors: number;
}

export function BulkUserImport() {
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [sendInvitations, setSendInvitations] = useState(true);
  const [defaultRole, setDefaultRole] = useState('member');
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setFileName(file.name);
      setResults(null);
      setSummary(null);
      
      // Count users in CSV
      const lines = content.split('\n').filter(l => l.trim());
      const userCount = Math.max(0, lines.length - 1); // Minus header
      toast.success(`Loaded ${userCount} users from ${file.name}`);
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/users/bulk-import');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'user-import-template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleImport = async () => {
    if (!csvContent) {
      toast.error('Please upload a CSV file first');
      return;
    }

    setIsImporting(true);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90));
      }, 200);

      const response = await fetch('/api/admin/users/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent,
          sendInvitations,
          defaultRole,
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Import failed');
      }

      const data = await response.json();
      setResults(data.results);
      setSummary(data.summary);
      setShowResultsDialog(true);
      
      toast.success(`Imported ${data.summary.created + data.summary.invited} users`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setIsImporting(false);
      setProgress(0);
    }
  };

  const getStatusIcon = (status: ImportResult['status']) => {
    switch (status) {
      case 'created':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'invited':
        return <Clock className="h-4 w-4 text-violet-500" />;
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: ImportResult['status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      created: 'default',
      invited: 'secondary',
      skipped: 'outline',
      error: 'destructive',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk User Import
          </CardTitle>
          <CardDescription>
            Import multiple users at once from a CSV file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            `}
          >
            <input {...getInputProps()} />
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-primary">Drop the CSV file here...</p>
            ) : csvContent ? (
              <div>
                <p className="font-medium">{fileName}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Click or drag to replace
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Drag & drop a CSV file here</p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse
                </p>
              </div>
            )}
          </div>

          {/* Template Download */}
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download CSV Template
          </Button>

          {/* Import Options */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default Role</Label>
              <Select value={defaultRole} onValueChange={setDefaultRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used when role is not specified in CSV
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="send-invitations">Send Invitations</Label>
                <Switch
                  id="send-invitations"
                  checked={sendInvitations}
                  onCheckedChange={setSendInvitations}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {sendInvitations
                  ? 'Users will receive email invitations'
                  : 'Users will be created with pending status'}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Importing users...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={!csvContent || isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>
                <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import Users
              </>
            )}
          </Button>

          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              CSV should have columns: email (required), firstName, lastName, role, department, groups
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Results</DialogTitle>
            <DialogDescription>
              Summary of the user import operation
            </DialogDescription>
          </DialogHeader>

          {summary && (
            <div className="grid grid-cols-4 gap-4 py-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.created}</div>
                <div className="text-xs text-muted-foreground">Created</div>
              </div>
              <div className="text-center p-3 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                <div className="text-2xl font-bold text-violet-600">{summary.invited}</div>
                <div className="text-xs text-muted-foreground">Invited</div>
              </div>
              <div className="text-center p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <div className="space-y-2">
              {results?.map((result, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 border rounded"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-mono text-sm">{result.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.reason && (
                      <span className="text-xs text-muted-foreground">
                        {result.reason}
                      </span>
                    )}
                    {getStatusBadge(result.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowResultsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BulkUserImport;
