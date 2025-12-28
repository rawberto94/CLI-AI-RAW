"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Download, Eye, Save, FileText, BarChart, PieChart, TrendingUp } from "lucide-react";

interface ReportField {
  id: string;
  label: string;
  category: string;
  type: "metric" | "dimension" | "chart";
}

interface ReportConfig {
  name: string;
  type: "supplier" | "rate-card" | "contract" | "performance" | "financial";
  fields: string[];
  groupBy?: string;
  filters: Record<string, any>;
  chartType?: "bar" | "line" | "pie" | "table";
}

const availableFields: ReportField[] = [
  // Supplier fields
  { id: "supplier_name", label: "Supplier Name", category: "supplier", type: "dimension" },
  { id: "supplier_count", label: "Supplier Count", category: "supplier", type: "metric" },
  { id: "active_contracts", label: "Active Contracts", category: "supplier", type: "metric" },
  { id: "total_spend", label: "Total Spend", category: "supplier", type: "metric" },
  { id: "avg_performance", label: "Avg Performance", category: "supplier", type: "metric" },
  
  // Rate Card fields
  { id: "role_name", label: "Role Name", category: "rate-card", type: "dimension" },
  { id: "seniority", label: "Seniority Level", category: "rate-card", type: "dimension" },
  { id: "daily_rate", label: "Daily Rate", category: "rate-card", type: "metric" },
  { id: "avg_rate", label: "Average Rate", category: "rate-card", type: "metric" },
  { id: "rate_count", label: "Rate Count", category: "rate-card", type: "metric" },
  { id: "rate_trend", label: "Rate Trend", category: "rate-card", type: "chart" },
  
  // Contract fields
  { id: "contract_name", label: "Contract Name", category: "contract", type: "dimension" },
  { id: "contract_value", label: "Contract Value", category: "contract", type: "metric" },
  { id: "start_date", label: "Start Date", category: "contract", type: "dimension" },
  { id: "end_date", label: "End Date", category: "contract", type: "dimension" },
  { id: "days_to_renewal", label: "Days to Renewal", category: "contract", type: "metric" },
  
  // Performance fields
  { id: "on_time_delivery", label: "On-Time Delivery %", category: "performance", type: "metric" },
  { id: "quality_score", label: "Quality Score", category: "performance", type: "metric" },
  { id: "cost_efficiency", label: "Cost Efficiency", category: "performance", type: "metric" },
  { id: "responsiveness", label: "Responsiveness", category: "performance", type: "metric" },
  { id: "performance_chart", label: "Performance Trend", category: "performance", type: "chart" },
  
  // Financial fields
  { id: "monthly_spend", label: "Monthly Spend", category: "financial", type: "metric" },
  { id: "quarterly_spend", label: "Quarterly Spend", category: "financial", type: "metric" },
  { id: "cost_savings", label: "Cost Savings", category: "financial", type: "metric" },
  { id: "spend_trend", label: "Spend Trend", category: "financial", type: "chart" },
];

export function ReportBuilder() {
  const { toast } = useToast();
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    name: "",
    type: "supplier",
    fields: [],
    filters: {},
    chartType: "table",
  });
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [previewMode, setPreviewMode] = useState(false);

  const handleReportTypeChange = (type: ReportConfig["type"]) => {
    setReportConfig({ ...reportConfig, type, fields: [] });
    setSelectedFields([]);
  };

  const toggleField = (fieldId: string) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter((id) => id !== fieldId));
    } else {
      setSelectedFields([...selectedFields, fieldId]);
    }
  };

  const filteredFields = availableFields.filter(
    (field) => field.category === reportConfig.type
  );

  const handleGenerateReport = async () => {
    if (selectedFields.length === 0) {
      toast({
        title: "No fields selected",
        description: "Please select at least one field for your report.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...reportConfig,
          fields: selectedFields,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate report");

      const data = await response.json();
      toast({
        title: "Report generated",
        description: `${data.rows} rows of data generated successfully.`,
      });

      setPreviewMode(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportReport = async (format: "pdf" | "excel") => {
    try {
      const response = await fetch("/api/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...reportConfig,
          fields: selectedFields,
          format,
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${Date.now()}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: `Report exported as ${format.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!reportConfig.name) {
      toast({
        title: "Name required",
        description: "Please enter a name for your report template.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/reports/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...reportConfig,
          fields: selectedFields,
        }),
      });

      if (!response.ok) throw new Error("Failed to save template");

      toast({
        title: "Template saved",
        description: "Your report template has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Report Builder</h2>
          <p className="text-muted-foreground">
            Create custom reports with your preferred data fields and visualizations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveTemplate}>
            <Save className="mr-2 h-4 w-4" />
            Save Template
          </Button>
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {previewMode ? "Edit" : "Preview"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="configure" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configure">
            <FileText className="mr-2 h-4 w-4" />
            Configure
          </TabsTrigger>
          <TabsTrigger value="visualize">
            <BarChart className="mr-2 h-4 w-4" />
            Visualize
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="mr-2 h-4 w-4" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configure" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report Configuration</CardTitle>
              <CardDescription>
                Select the report type and fields you want to include
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-name">Report Name</Label>
                <input
                  id="report-name"
                  type="text"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="e.g., Monthly Supplier Performance"
                  value={reportConfig.name}
                  onChange={(e) =>
                    setReportConfig({ ...reportConfig, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-type">Report Type</Label>
                <Select
                  value={reportConfig.type}
                  onValueChange={handleReportTypeChange}
                >
                  <SelectTrigger id="report-type">
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Supplier Reports</SelectItem>
                    <SelectItem value="rate-card">Rate Card Reports</SelectItem>
                    <SelectItem value="contract">Contract Reports</SelectItem>
                    <SelectItem value="performance">Performance Reports</SelectItem>
                    <SelectItem value="financial">Financial Reports</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Available Fields</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Dimensions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {filteredFields
                        .filter((f) => f.type === "dimension")
                        .map((field) => (
                          <div
                            key={field.id}
                            className="flex items-center space-x-2"
                          >
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
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {filteredFields
                        .filter((f) => f.type === "metric")
                        .map((field) => (
                          <div
                            key={field.id}
                            className="flex items-center space-x-2"
                          >
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
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <Badge variant="secondary">{selectedFields.length} fields selected</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visualize" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Visualization Options</CardTitle>
              <CardDescription>
                Choose how you want to visualize your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chart-type">Chart Type</Label>
                <Select
                  value={reportConfig.chartType}
                  onValueChange={(value) =>
                    setReportConfig({ ...reportConfig, chartType: value as any })
                  }
                >
                  <SelectTrigger id="chart-type">
                    <SelectValue placeholder="Select chart type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Data Table</SelectItem>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="line">Line Chart</SelectItem>
                    <SelectItem value="pie">Pie Chart</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4">
                <Card className="cursor-pointer hover:bg-accent">
                  <CardContent className="p-6 text-center">
                    <BarChart className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Bar Chart</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent">
                  <CardContent className="p-6 text-center">
                    <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Line Chart</p>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-accent">
                  <CardContent className="p-6 text-center">
                    <PieChart className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Pie Chart</p>
                  </CardContent>
                </Card>
              </div>

              <Button onClick={handleGenerateReport} className="w-full">
                <Eye className="mr-2 h-4 w-4" />
                Generate Preview
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
              <CardDescription>
                Download your report in various formats
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => handleExportReport("pdf")}
                  className="h-24 flex-col"
                >
                  <FileText className="h-8 w-8 mb-2" />
                  <span>Export as PDF</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleExportReport("excel")}
                  className="h-24 flex-col"
                >
                  <Download className="h-8 w-8 mb-2" />
                  <span>Export as Excel</span>
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Export Settings</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-charts" defaultChecked />
                    <label htmlFor="include-charts" className="text-sm">
                      Include charts and visualizations
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-summary" defaultChecked />
                    <label htmlFor="include-summary" className="text-sm">
                      Include summary statistics
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="include-metadata" />
                    <label htmlFor="include-metadata" className="text-sm">
                      Include report metadata
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
