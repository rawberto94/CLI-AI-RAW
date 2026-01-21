/**
 * AI Report Modal
 * Displays generated AI report for selected contracts
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign,
  Download,
  Copy,
  Target,
  Shield,
  Lightbulb,
  ChevronRight,
  AlertCircle,
  Info,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface KeyFinding {
  type: 'risk' | 'opportunity' | 'compliance' | 'action-needed';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedContracts: string[];
}

interface ContractHighlight {
  contractId: string;
  contractName: string;
  summary: string;
  keyRisks: string[];
  recommendations: string[];
}

interface ActionItem {
  priority: 'urgent' | 'high' | 'medium' | 'low';
  action: string;
  deadline?: string;
  relatedContracts: string[];
}

interface AIReport {
  reportId: string;
  generatedAt: string;
  contractCount: number;
  executiveSummary: string;
  portfolioAnalysis: {
    totalValue: number;
    averageValue: number;
    riskDistribution: Record<string, number>;
    statusDistribution: Record<string, number>;
  };
  keyFindings: KeyFinding[];
  contractHighlights: ContractHighlight[];
  actionItems: ActionItem[];
  recommendations: string[];
}

interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractIds: string[];
  contractNames?: string[];
}

const findingTypeConfig = {
  risk: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  opportunity: { icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
  compliance: { icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  'action-needed': { icon: Zap, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
};

const severityConfig = {
  critical: { color: 'bg-red-600', text: 'Critical' },
  high: { color: 'bg-orange-500', text: 'High' },
  medium: { color: 'bg-yellow-500', text: 'Medium' },
  low: { color: 'bg-green-500', text: 'Low' },
};

const priorityConfig = {
  urgent: { color: 'bg-red-600', text: 'Urgent' },
  high: { color: 'bg-orange-500', text: 'High' },
  medium: { color: 'bg-yellow-500', text: 'Medium' },
  low: { color: 'bg-green-500', text: 'Low' },
};

export function AIReportModal({ isOpen, onClose, contractIds, contractNames }: AIReportModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<AIReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("summary");

  const generateReport = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/contracts/ai-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'demo',
        },
        body: JSON.stringify({
          contractIds,
          reportType: 'comprehensive',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const data = await response.json();
      
      if (data.success && data.report) {
        setReport(data.report);
        toast.success('AI Report generated successfully');
      } else {
        throw new Error(data.error || 'Report generation failed');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate report';
      setError(errorMessage);
      toast.error('Failed to generate AI report');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!report) return;
    
    const reportText = `
AI Contract Portfolio Report
Generated: ${new Date(report.generatedAt).toLocaleString()}
Contracts Analyzed: ${report.contractCount}

EXECUTIVE SUMMARY
${report.executiveSummary}

PORTFOLIO ANALYSIS
- Total Value: $${report.portfolioAnalysis.totalValue.toLocaleString()}
- Average Value: $${Math.round(report.portfolioAnalysis.averageValue).toLocaleString()}

KEY FINDINGS
${report.keyFindings.map(f => `• [${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join('\n')}

ACTION ITEMS
${report.actionItems.map(a => `• [${a.priority.toUpperCase()}] ${a.action}${a.deadline ? ` (Due: ${a.deadline})` : ''}`).join('\n')}

RECOMMENDATIONS
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`.trim();

    await navigator.clipboard.writeText(reportText);
    toast.success('Report copied to clipboard');
  };

  const downloadReport = () => {
    if (!report) return;

    const reportData = {
      ...report,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-report-${report.reportId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  };

  const handleClose = () => {
    setReport(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white/95 backdrop-blur-xl border-slate-200/80 shadow-2xl rounded-2xl">
        <DialogHeader className="flex-shrink-0 pb-4 border-b border-slate-100">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-semibold text-slate-900">
                AI Contract Report
              </span>
              {report && (
                <Badge variant="outline" className="ml-3 border-blue-200 text-blue-700 bg-blue-50">
                  {report.contractCount} contracts analyzed
                </Badge>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {!report && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 px-4"
          >
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-6 border border-blue-100">
              <Brain className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-semibold mb-2 text-slate-900">
              Generate AI Report
            </h3>
            <p className="text-slate-600 text-center mb-6 max-w-md">
              Analyze {contractIds.length} selected contract{contractIds.length !== 1 ? 's' : ''} 
              to generate insights, identify risks, and get actionable recommendations.
            </p>
            {contractNames && contractNames.length > 0 && (
              <div className="mb-6 w-full max-w-md">
                <p className="text-sm text-slate-500 mb-2 font-medium">Selected contracts:</p>
                <div className="flex flex-wrap gap-2">
                  {contractNames.slice(0, 5).map((name, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-white rounded-full border-slate-200 shadow-sm">
                      <FileText className="h-3 w-3 mr-1 text-slate-400" />
                      {name.length > 25 ? name.slice(0, 25) + '...' : name}
                    </Badge>
                  ))}
                  {contractNames.length > 5 && (
                    <Badge className="text-xs bg-slate-100 text-slate-600 border-0 rounded-full">
                      +{contractNames.length - 5} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
                <AlertCircle className="h-5 w-5 text-red-500" />
                {error}
              </div>
            )}
            <Button 
              onClick={generateReport} 
              size="lg" 
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 text-base"
            >
              <Brain className="h-5 w-5" />
              Generate AI Report
            </Button>
          </motion.div>
        )}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-blue-100" />
              <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            </div>
            <p className="mt-8 text-lg font-medium text-slate-700">
              Analyzing contracts...
            </p>
            <p className="text-slate-500 text-sm mt-2">This may take a moment</p>
          </motion.div>
        )}

        {report && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 overflow-hidden flex flex-col min-h-0"
          >
            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pb-4 flex-shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyToClipboard}
                className="rounded-lg border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <Copy className="h-4 w-4 mr-2 text-slate-500" />
                Copy
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={downloadReport}
                className="rounded-lg border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid grid-cols-4 flex-shrink-0 bg-slate-100/80 p-1 rounded-xl">
                <TabsTrigger value="summary" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">Summary</TabsTrigger>
                <TabsTrigger value="findings" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">Findings</TabsTrigger>
                <TabsTrigger value="actions" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">Actions</TabsTrigger>
                <TabsTrigger value="details" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md">Details</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-4">
                <TabsContent value="summary" className="mt-0 space-y-4">
                  {/* Portfolio Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-100/50 shadow-sm">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-green-100 rounded-lg">
                            <DollarSign className="h-4 w-4 text-green-600" />
                          </div>
                          <span className="text-xs font-medium text-green-700">Total Value</span>
                        </div>
                        <p className="text-xl font-bold mt-2 text-green-900">
                          ${report.portfolioAnalysis.totalValue.toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100/50 shadow-sm">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-100 rounded-lg">
                            <FileText className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="text-xs font-medium text-blue-700">Contracts</span>
                        </div>
                        <p className="text-xl font-bold mt-2 text-blue-900">{report.contractCount}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-100/50 shadow-sm">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-orange-100 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                          </div>
                          <span className="text-xs font-medium text-orange-700">Findings</span>
                        </div>
                        <p className="text-xl font-bold mt-2 text-orange-900">{report.keyFindings.length}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100/50 shadow-sm">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-purple-100 rounded-lg">
                            <Target className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="text-xs font-medium text-purple-700">Action Items</span>
                        </div>
                        <p className="text-xl font-bold mt-2 text-purple-900">{report.actionItems.length}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Executive Summary */}
                  <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="pb-2 bg-slate-50 border-b border-slate-100">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-lg">
                          <Brain className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-semibold text-slate-800">Executive Summary</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                        {report.executiveSummary}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Recommendations */}
                  <Card className="bg-gradient-to-br from-yellow-50/50 to-amber-50/50 border-yellow-200/50 shadow-sm overflow-hidden">
                    <CardHeader className="pb-2 bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-100">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="p-1.5 bg-yellow-100 rounded-lg">
                          <Lightbulb className="h-4 w-4 text-yellow-600" />
                        </div>
                        <span className="font-semibold text-slate-800">Key Recommendations</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ul className="space-y-3">
                        {report.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <div className="p-1 bg-green-100 rounded-full mt-0.5 flex-shrink-0">
                              <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                            </div>
                            <span className="text-slate-700">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="findings" className="mt-0 space-y-3">
                  {report.keyFindings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No significant findings identified</p>
                    </div>
                  ) : (
                    report.keyFindings.map((finding, i) => {
                      const config = findingTypeConfig[finding.type];
                      const Icon = config.icon;
                      const severity = severityConfig[finding.severity];
                      
                      return (
                        <Card key={i} className={config.bg}>
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg bg-white dark:bg-gray-800`}>
                                <Icon className={`h-5 w-5 ${config.color}`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-sm">{finding.title}</h4>
                                  <Badge className={`${severity.color} text-white text-xs`}>
                                    {severity.text}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  {finding.description}
                                </p>
                                {finding.affectedContracts.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {finding.affectedContracts.map((contract, j) => (
                                      <Badge key={j} variant="outline" className="text-xs">
                                        {contract}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="actions" className="mt-0 space-y-3">
                  {report.actionItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No action items identified</p>
                    </div>
                  ) : (
                    report.actionItems.map((item, i) => {
                      const priority = priorityConfig[item.priority];
                      
                      return (
                        <Card key={i}>
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-3">
                              <Badge className={`${priority.color} text-white text-xs flex-shrink-0`}>
                                {priority.text}
                              </Badge>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.action}</p>
                                {item.deadline && (
                                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                    <Clock className="h-3 w-3" />
                                    Deadline: {item.deadline}
                                  </div>
                                )}
                                {item.relatedContracts.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {item.relatedContracts.map((contract, j) => (
                                      <Badge key={j} variant="outline" className="text-xs">
                                        {contract}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="details" className="mt-0 space-y-3">
                  {report.contractHighlights.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No detailed highlights available</p>
                    </div>
                  ) : (
                    report.contractHighlights.map((highlight, i) => (
                      <Card key={i}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                {highlight.contractName}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {highlight.summary}
                              </p>
                              
                              {highlight.keyRisks.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs font-medium text-gray-500 mb-1">Key Risks:</p>
                                  <ul className="space-y-1">
                                    {highlight.keyRisks.map((risk, j) => (
                                      <li key={j} className="flex items-center gap-2 text-xs text-red-600">
                                        <AlertTriangle className="h-3 w-3" />
                                        {risk}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {highlight.recommendations.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs font-medium text-gray-500 mb-1">Recommendations:</p>
                                  <ul className="space-y-1">
                                    {highlight.recommendations.map((rec, j) => (
                                      <li key={j} className="flex items-center gap-2 text-xs text-green-600">
                                        <CheckCircle className="h-3 w-3" />
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
