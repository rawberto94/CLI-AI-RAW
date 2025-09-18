"use client";

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Brain, 
  DollarSign, 
  Shield, 
  TrendingUp,
  Zap,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface AnalysisStage {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  duration?: number;
  estimatedTime?: number;
  insights?: string[];
}

interface ContractAnalysis {
  contractId: string;
  contractName: string;
  uploadedAt: string;
  totalProgress: number;
  stages: AnalysisStage[];
  overallStatus: 'processing' | 'completed' | 'failed';
}

export function RealTimeProgressTracker({ contractId }: { contractId?: string }) {
  const [analyses, setAnalyses] = useState<ContractAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);

  useEffect(() => {
    // Simulate real-time analysis updates
    const mockAnalysis: ContractAnalysis = {
      contractId: contractId || 'demo-contract-1',
      contractName: 'MSA-TechCorp-2024.pdf',
      uploadedAt: new Date().toISOString(),
      totalProgress: 0,
      overallStatus: 'processing',
      stages: [
        {
          id: 'ingestion',
          name: 'Document Ingestion',
          description: 'Extracting text and metadata from document',
          icon: <FileText className="w-5 h-5" />,
          status: 'completed',
          progress: 100,
          duration: 2300,
          insights: ['PDF successfully parsed', '47 pages processed', 'High OCR confidence: 98%']
        },
        {
          id: 'template',
          name: 'Template Analysis',
          description: 'AI-powered template detection and compliance checking',
          icon: <Brain className="w-5 h-5" />,
          status: 'completed',
          progress: 100,
          duration: 8500,
          insights: ['Master Service Agreement detected', 'Template compliance: 94%', '3 deviations identified']
        },
        {
          id: 'financial',
          name: 'Financial Analysis',
          description: 'Extracting rates, terms, and financial obligations',
          icon: <DollarSign className="w-5 h-5" />,
          status: 'processing',
          progress: 75,
          estimatedTime: 3000,
          insights: ['12 rate structures found', 'Payment terms: Net 30', 'Total contract value: $2.4M']
        },
        {
          id: 'risk',
          name: 'Risk Assessment',
          description: 'Identifying potential risks and compliance issues',
          icon: <Shield className="w-5 h-5" />,
          status: 'pending',
          progress: 0,
          estimatedTime: 5000
        },
        {
          id: 'compliance',
          name: 'Compliance Check',
          description: 'Validating against regulatory requirements',
          icon: <CheckCircle className="w-5 h-5" />,
          status: 'pending',
          progress: 0,
          estimatedTime: 4000
        },
        {
          id: 'insights',
          name: 'AI Insights Generation',
          description: 'Generating recommendations and best practices',
          icon: <TrendingUp className="w-5 h-5" />,
          status: 'pending',
          progress: 0,
          estimatedTime: 6000
        }
      ]
    };

    setAnalyses([mockAnalysis]);
    setSelectedAnalysis(mockAnalysis.contractId);

    // Simulate progress updates
    const interval = setInterval(() => {
      setAnalyses(prev => prev.map(analysis => {
        const updatedStages = analysis.stages.map(stage => {
          if (stage.status === 'processing' && stage.progress < 100) {
            const newProgress = Math.min(100, stage.progress + Math.random() * 15);
            return {
              ...stage,
              progress: newProgress,
              status: newProgress >= 100 ? 'completed' : 'processing'
            };
          }
          
          // Start next stage when current completes
          if (stage.status === 'pending') {
            const prevStageIndex = analysis.stages.findIndex(s => s.id === stage.id) - 1;
            const prevStage = analysis.stages[prevStageIndex];
            if (!prevStage || prevStage.status === 'completed') {
              return {
                ...stage,
                status: 'processing',
                progress: Math.random() * 20
              };
            }
          }
          
          return stage;
        });

        const completedStages = updatedStages.filter(s => s.status === 'completed').length;
        const totalProgress = (completedStages / updatedStages.length) * 100;
        const overallStatus = totalProgress >= 100 ? 'completed' : 'processing';

        return {
          ...analysis,
          stages: updatedStages,
          totalProgress,
          overallStatus
        };
      }));
    }, 1500);

    return () => clearInterval(interval);
  }, [contractId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-50 border-green-200';
      case 'processing': return 'bg-blue-50 border-blue-200';
      case 'failed': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const selectedAnalysisData = analyses.find(a => a.contractId === selectedAnalysis);

  return (
    <div className="space-y-6">
      {/* Analysis Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            Real-Time Analysis Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedAnalysisData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{selectedAnalysisData.contractName}</h3>
                  <p className="text-sm text-gray-500">
                    Started {new Date(selectedAnalysisData.uploadedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {Math.round(selectedAnalysisData.totalProgress)}%
                  </div>
                  <Badge className={
                    selectedAnalysisData.overallStatus === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }>
                    {selectedAnalysisData.overallStatus}
                  </Badge>
                </div>
              </div>
              
              <Progress value={selectedAnalysisData.totalProgress} className="h-3" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Stages */}
      <div className="grid gap-4">
        {selectedAnalysisData?.stages.map((stage, index) => (
          <Card key={stage.id} className={`transition-all duration-300 ${getStatusColor(stage.status)}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-2 bg-white rounded-lg shadow-sm">
                  {stage.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{stage.name}</h3>
                    <div className="flex items-center gap-2">
                      {stage.duration && (
                        <span className="text-xs text-gray-500">
                          {formatDuration(stage.duration)}
                        </span>
                      )}
                      {getStatusIcon(stage.status)}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{stage.description}</p>
                  
                  {stage.status !== 'pending' && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(stage.progress)}%</span>
                      </div>
                      <Progress value={stage.progress} className="h-2" />
                    </div>
                  )}
                  
                  {stage.estimatedTime && stage.status === 'processing' && (
                    <div className="text-xs text-blue-600 mb-2">
                      <Clock className="w-3 h-3 inline mr-1" />
                      ~{formatDuration(stage.estimatedTime)} remaining
                    </div>
                  )}
                  
                  {stage.insights && stage.insights.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-xs font-medium text-gray-700">Key Insights:</h4>
                      {stage.insights.map((insight, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                          {insight}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Processing Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-purple-600" />
            Processing Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analyses.map((analysis) => (
              <div 
                key={analysis.contractId}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedAnalysis === analysis.contractId 
                    ? 'border-blue-300 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedAnalysis(analysis.contractId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900">{analysis.contractName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(analysis.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">
                      {Math.round(analysis.totalProgress)}%
                    </div>
                    <div className="w-16">
                      <Progress value={analysis.totalProgress} className="h-2" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}