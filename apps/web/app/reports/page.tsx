/**
 * Unified Report Dashboard Component
 * Combines AI templates + custom field selection + multi-format export
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileText, Download, TrendingUp, AlertTriangle, DollarSign, Shield, Building2, BarChart3, Settings } from 'lucide-react';

type ReportType = 'executive' | 'financial' | 'risk' | 'compliance' | 'supplier' | 'custom';
type ExportFormat = 'json' | 'pdf' | 'csv';

interface ReportTemplate {
  type: ReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    type: 'executive',
    title: 'Executive Portfolio Report',
    description: 'Comprehensive overview of contract portfolio health, key metrics, and strategic insights',
    icon: <BarChart3 className="h-8 w-8" />,
    color: 'text-blue-500',
  },
  {
    type: 'financial',
    title: 'Financial Analysis Report',
    description: 'Deep dive into spend analysis, cost optimization opportunities, and financial trends',
    icon: <DollarSign className="h-8 w-8" />,
    color: 'text-green-500',
  },
  {
    type: 'risk',
    title: 'Risk Assessment Report',
    description: 'Identify and analyze contract risks, expiring agreements, and mitigation strategies',
    icon: <AlertTriangle className="h-8 w-8" />,
    color: 'text-red-500',
  },
  {
    type: 'compliance',
    title: 'Compliance Status Report',
    description: 'Evaluate contract compliance, identify gaps, and ensure regulatory adherence',
    icon: <Shield className="h-8 w-8" />,
    color: 'text-purple-500',
  },
  {
    type: 'supplier',
    title: 'Supplier Performance Report',
    description: 'Analyze supplier relationships, performance metrics, and partnership value',
    icon: <Building2 className="h-8 w-8" />,
    color: 'text-orange-500',
  },
];

const CUSTOM_FIELDS = [
  { id: 'contract_name', label: 'Contract Name', category: 'basic' },
  { id: 'supplier_name', label: 'Supplier Name', category: 'basic' },
  { id: 'contract_value', label: 'Contract Value', category: 'financial' },
  { id: 'start_date', label: 'Start Date', category: 'basic' },
  { id: 'end_date', label: 'End Date', category: 'basic' },
  { id: 'status', label: 'Status', category: 'basic' },
  { id: 'days_to_renewal', label: 'Days to Renewal', category: 'risk' },
  { id: 'category', label: 'Category', category: 'basic' },
  { id: 'auto_renewal', label: 'Auto-Renewal', category: 'risk' },
];

export default function ReportDashboard() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('executive');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [loading, setLoading] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [reportMode, setReportMode] = useState<'template' | 'custom'>('template');

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      if (reportMode === 'custom') {
        // Custom report with field selection
        if (selectedFields.length === 0) {
          alert('Please select at least one field');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'custom_report',
            fields: selectedFields,
            filters: {},
          }),
        });

        if (!response.ok) throw new Error('Failed to generate custom report');

        const data = await response.json();
        alert(`Custom report generated with ${data.rows} rows!`);
      } else {
        // Template report
        const params = new URLSearchParams({
          type: selectedReport,
          format: exportFormat,
        });

        if (selectedReport === 'supplier' && supplierName) {
          params.append('supplier', supplierName);
        }

        const response = await fetch(`/api/reports?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to generate report');
        }

        if (exportFormat === 'json') {
          const data = await response.json();
          alert('Report generated successfully!');
        } else {
          // Download file
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${selectedReport}-report-${Date.now()}.${exportFormat === 'pdf' ? 'html' : 'csv'}`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }
    } catch {
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  };

  const selectedTemplate = REPORT_TEMPLATES.find((t) => t.type === selectedReport);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">AI-Powered Reports</h1>
        <p className="text-muted-foreground">
          Generate comprehensive analytics reports with AI-driven insights and recommendations
        </p>
      </div>

      {/* Report Template Selection */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORT_TEMPLATES.map((template) => (
          <Card
            key={template.type}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedReport === template.type ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedReport(template.type)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className={template.color}>{template.icon}</div>
                <div>
                  <CardTitle className="text-lg">{template.title}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{template.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Mode Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Report
          </CardTitle>
          <CardDescription>Choose between AI-powered templates or custom field selection</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={reportMode} onValueChange={(v) => setReportMode(v as 'template' | 'custom')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template">
                <BarChart3 className="mr-2 h-4 w-4" />
                AI Templates
              </TabsTrigger>
              <TabsTrigger value="custom">
                <Settings className="mr-2 h-4 w-4" />
                Custom Fields
              </TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="space-y-6 mt-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Export Format */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Export Format</label>
                  <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON (View in Browser)</SelectItem>
                      <SelectItem value="csv">CSV (Excel Compatible)</SelectItem>
                      <SelectItem value="pdf">PDF (Download HTML)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Supplier Name (only for supplier reports) */}
                {selectedReport === 'supplier' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Supplier Name</label>
                    <input
                      type="text"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Enter supplier name"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Selected Report Info */}
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <div className={selectedTemplate?.color}>{selectedTemplate?.icon}</div>
                  {selectedTemplate?.title}
                </div>
                <p className="text-sm text-muted-foreground">{selectedTemplate?.description}</p>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-6 mt-6">
              <div className="space-y-4">
                <Label>Select Fields to Include</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {CUSTOM_FIELDS.map((field) => (
                    <div key={field.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={field.id}
                        checked={selectedFields.includes(field.id)}
                        onCheckedChange={() => toggleField(field.id)}
                      />
                      <label
                        htmlFor={field.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {field.label}
                      </label>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''}
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Selected Report Info */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className={selectedTemplate?.color}>{selectedTemplate?.icon}</div>
              {selectedTemplate?.title}
            </div>
            <p className="text-sm text-muted-foreground">{selectedTemplate?.description}</p>
          </div>

          {/* Generate Button */}
          <Button onClick={handleGenerateReport} disabled={loading} className="w-full" size="lg">
            <Download className="mr-2 h-4 w-4" />
            {loading ? 'Generating Report...' : 'Generate Report'}
          </Button>

          {/* Feature Highlights */}
          <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
            <div className="space-y-1">
              <TrendingUp className="h-4 w-4 text-green-500 mb-1" />
              <p className="text-xs font-medium">AI Insights</p>
              <p className="text-xs text-muted-foreground">Automated analysis and recommendations</p>
            </div>
            <div className="space-y-1">
              <BarChart3 className="h-4 w-4 text-blue-500 mb-1" />
              <p className="text-xs font-medium">Visual Charts</p>
              <p className="text-xs text-muted-foreground">Interactive data visualizations</p>
            </div>
            <div className="space-y-1">
              <FileText className="h-4 w-4 text-purple-500 mb-1" />
              <p className="text-xs font-medium">Multiple Formats</p>
              <p className="text-xs text-muted-foreground">Export to PDF, Excel, or JSON</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Metrics Preview */}
      <Card>
        <CardHeader>
          <CardTitle>What's Included</CardTitle>
          <CardDescription>Each report includes comprehensive analytics and actionable insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">Analytics & Metrics</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Portfolio health indicators</li>
                <li>• Spend analysis by supplier/category</li>
                <li>• Risk assessment and scoring</li>
                <li>• Compliance status tracking</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">AI-Generated Content</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Executive summary narratives</li>
                <li>• Key insights and trends</li>
                <li>• Actionable recommendations</li>
                <li>• Cost optimization opportunities</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
