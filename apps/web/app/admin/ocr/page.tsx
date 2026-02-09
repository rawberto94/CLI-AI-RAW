'use client';

/**
 * OCR Admin Dashboard Page
 * 
 * Central admin interface for:
 * - Review queue management
 * - OCR quality monitoring
 * - Batch processing
 * - System configuration
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  Users,
  BarChart3,
  Settings,
  Upload,
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

// Import OCR components
import { HumanReviewQueue } from '@/components/contracts/HumanReviewQueue';
import { OCRQualityDashboard } from '@/components/contracts/OCRQualityDashboard';

// ============================================================================
// BATCH UPLOAD COMPONENT
// ============================================================================

const BatchUploadSection: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [jobs, _setJobs] = useState<Array<{
    id: string;
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    documents: number;
  }>>([
    { id: '1', name: 'Batch_20240115', status: 'completed', progress: 100, documents: 25 },
    { id: '2', name: 'Batch_20240116', status: 'processing', progress: 65, documents: 42 },
    { id: '3', name: 'Batch_20240117', status: 'pending', progress: 0, documents: 18 },
  ]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleUpload = async () => {
    setUploading(true);
    // Simulate upload
    await new Promise(r => setTimeout(r, 2000));
    setUploading(false);
    setFiles([]);
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Batch Upload
          </CardTitle>
          <CardDescription>
            Upload multiple documents for batch OCR processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Supports PDF, PNG, JPG, TIFF (max 50MB each)
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  setFiles(Array.from(e.target.files));
                }
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{files.length} files selected</span>
                <Button onClick={() => setFiles([])}>Clear</Button>
              </div>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {files.map((file, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {file.name}
                    <span className="text-muted-foreground">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4 w-full"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Start Batch Processing
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Batch Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    job.status === 'completed' ? 'bg-green-100 text-green-600' :
                    job.status === 'processing' ? 'bg-violet-100 text-violet-600' :
                    job.status === 'failed' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {job.status === 'completed' && <CheckCircle2 className="h-5 w-5" />}
                    {job.status === 'processing' && <RefreshCw className="h-5 w-5 animate-spin" />}
                    {job.status === 'failed' && <AlertTriangle className="h-5 w-5" />}
                    {job.status === 'pending' && <Clock className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-medium">{job.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {job.documents} documents
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      {job.progress}%
                    </p>
                  </div>
                  <Badge variant={
                    job.status === 'completed' ? 'default' :
                    job.status === 'processing' ? 'secondary' :
                    job.status === 'failed' ? 'destructive' :
                    'outline'
                  }>
                    {job.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================================
// SETTINGS SECTION
// ============================================================================

const SettingsSection: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>OCR Configuration</CardTitle>
          <CardDescription>
            Configure OCR processing settings and thresholds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Confidence Threshold</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Documents below this confidence level are routed to review
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="70"
                  className="flex-1"
                />
                <span className="font-mono">70%</span>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Max Concurrent Jobs</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Maximum parallel batch processing jobs
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="10"
                  defaultValue="5"
                  className="w-20 border rounded px-2 py-1"
                />
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">LLM Correction</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Enable AI-powered spell correction
              </p>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="rounded" />
                <span>Enabled</span>
              </label>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Data Residency</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Where AI processing can occur
              </p>
              <select className="w-full border rounded px-2 py-1">
                <option value="CH">Switzerland Only (CH)</option>
                <option value="EU">European Union (EU)</option>
                <option value="ANY">Any Region</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Language Settings</CardTitle>
          <CardDescription>
            Configure supported languages and dictionaries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[
              { code: 'en', name: 'English', flag: '🇬🇧' },
              { code: 'de', name: 'German', flag: '🇩🇪' },
              { code: 'fr', name: 'French', flag: '🇫🇷' },
              { code: 'it', name: 'Italian', flag: '🇮🇹' },
            ].map((lang) => (
              <label
                key={lang.code}
                className="p-4 border rounded-lg flex items-center gap-3 cursor-pointer hover:bg-muted/50"
              >
                <input type="checkbox" defaultChecked className="rounded" />
                <span className="text-2xl">{lang.flag}</span>
                <span>{lang.name}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function OCRAdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="container mx-auto py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Eye className="h-8 w-8" />
            OCR Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage OCR processing, review queues, and quality metrics
          </p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Quality Dashboard
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-2">
              <Users className="h-4 w-4" />
              Review Queue
            </TabsTrigger>
            <TabsTrigger value="batch" className="gap-2">
              <Upload className="h-4 w-4" />
              Batch Processing
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <OCRQualityDashboard />
          </TabsContent>

          <TabsContent value="review">
            <HumanReviewQueue />
          </TabsContent>

          <TabsContent value="batch">
            <BatchUploadSection />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsSection />
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
