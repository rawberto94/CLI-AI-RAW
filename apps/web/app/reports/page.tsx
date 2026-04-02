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
import { FileText, Download, TrendingUp, AlertTriangle, DollarSign, Shield, Building2, BarChart3, Settings, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageBreadcrumb } from '@/components/navigation';



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
    color: 'text-violet-500',
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
    color: 'text-violet-500',
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
          toast.error('Please select at least one field to generate a custom report.');
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
        toast.success(`Custom report generated with ${data.rows} rows.`);
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
          toast.success('Report generated successfully!');
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
    } catch (error) {
      toast.error('Failed to generate report. Please try again.');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 dark:from-slate-900 dark:via-purple-950/30 dark:to-purple-950/20">
      <div className="max-w-[1600px] mx-auto py-8 space-y-8">
        <PageBreadcrumb />
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-purple-600 text-white shadow-xl shadow-violet-500/30">
            <FileText className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-purple-600 bg-clip-text text-transparent">AI-Powered Reports</h1>
            <p className="text-muted-foreground">
              Generate comprehensive analytics reports with AI-driven insights and recommendations
            </p>
          </div>
        </div>

        {/* Report Template Selection */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {REPORT_TEMPLATES.map((template) => (
            <Card
              key={template.type}
              className={`group cursor-pointer transition-all duration-300 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 hover:shadow-2xl hover:-translate-y-1 ${
                selectedReport === template.type ? 'ring-2 ring-primary shadow-xl shadow-primary/20' : 'hover:shadow-violet-200/40'
              }`}
              onClick={() => setSelectedReport(template.type)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${
                    template.color === 'text-violet-500' ? 'from-violet-400 to-purple-600' :
                    template.color === 'text-green-500' ? 'from-violet-400 to-violet-600' :
                    template.color === 'text-red-500' ? 'from-red-400 to-rose-600' :
                    template.color === 'text-violet-500' ? 'from-violet-400 to-purple-600' :
                    'from-orange-400 to-amber-600'
                  } text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {template.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">{template.title}</CardTitle>
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
      <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 text-white shadow-lg shadow-violet-500/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Generate Report</CardTitle>
              <CardDescription>Choose between AI-powered templates or custom field selection</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={reportMode} onValueChange={(v) => setReportMode(v as 'template' | 'custom')}>
            <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl">
              <TabsTrigger value="template" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/30 transition-all duration-300">
                <BarChart3 className="mr-2 h-4 w-4" />
                AI Templates
              </TabsTrigger>
              <TabsTrigger value="custom" className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/30 transition-all duration-300">
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
                      <SelectItem value="pdf">HTML Report (Download)</SelectItem>
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
          <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-4 space-y-2 border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className={`p-1.5 rounded-lg ${
                selectedTemplate?.color === 'text-violet-500' ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400' :
                selectedTemplate?.color === 'text-green-500' ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400' :
                selectedTemplate?.color === 'text-red-500' ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' :
                selectedTemplate?.color === 'text-violet-500' ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400' :
                'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400'
              }`}>{selectedTemplate?.icon}</div>
              {selectedTemplate?.title}
            </div>
            <p className="text-sm text-muted-foreground">{selectedTemplate?.description}</p>
          </div>

          {/* Generate Button */}
          <Button onClick={handleGenerateReport} disabled={loading} className="w-full bg-gradient-to-r from-violet-500 via-purple-500 to-purple-600 hover:from-violet-600 hover:via-purple-600 hover:to-purple-700 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all duration-300" size="lg">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {loading ? 'Generating Report...' : 'Generate Report'}
          </Button>

          {/* Feature Highlights */}
          <div className="grid gap-4 md:grid-cols-3 pt-6 border-t border-slate-200/50 dark:border-slate-700/50">
            <div className="group space-y-2 p-4 rounded-xl bg-gradient-to-br from-violet-50 to-violet-50 dark:from-violet-950/30 dark:to-violet-950/30 border border-green-200/50 dark:border-green-800/50 hover:shadow-lg hover:shadow-green-200/30 transition-all duration-300">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 text-white w-fit shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-green-900 dark:text-green-100">AI Insights</p>
              <p className="text-xs text-green-700 dark:text-green-300">Automated analysis and recommendations</p>
            </div>
            <div className="group space-y-2 p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/50 dark:border-violet-800/50 hover:shadow-lg hover:shadow-violet-200/30 transition-all duration-300">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 text-white w-fit shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                <BarChart3 className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-violet-900 dark:text-violet-100">Visual Charts</p>
              <p className="text-xs text-violet-700 dark:text-violet-300">Interactive data visualizations</p>
            </div>
            <div className="group space-y-2 p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-violet-950/30 border border-violet-200/50 dark:border-violet-800/50 hover:shadow-lg hover:shadow-violet-200/30 transition-all duration-300">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 text-white w-fit shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                <FileText className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-violet-900 dark:text-violet-100">Multiple Formats</p>
              <p className="text-xs text-violet-700 dark:text-violet-300">Export to PDF, Excel, or JSON</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Metrics Preview */}
      <Card className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-white/50 dark:border-slate-700/50 shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-orange-500/30">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>What&apos;s Included</CardTitle>
              <CardDescription>Each report includes comprehensive analytics and actionable insights</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/50 dark:border-violet-800/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 text-white">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <h4 className="font-medium text-violet-900 dark:text-violet-100">Analytics & Metrics</h4>
              </div>
              <ul className="text-sm text-violet-700 dark:text-violet-300 space-y-2">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>Portfolio health indicators</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>Spend analysis by supplier/category</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>Risk assessment and scoring</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>Compliance status tracking</li>
              </ul>
            </div>
            <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-violet-950/30 border border-violet-200/50 dark:border-violet-800/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h4 className="font-medium text-violet-900 dark:text-violet-100">AI-Generated Content</h4>
              </div>
              <ul className="text-sm text-violet-700 dark:text-violet-300 space-y-2">
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>Executive summary narratives</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>Key insights and trends</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>Actionable recommendations</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-500"></span>Cost optimization opportunities</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
