"use client";

import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Brain, 
  Zap, 
  CheckCircle, 
  Clock, 
  FileText, 
  Shield, 
  DollarSign, 
  AlertTriangle,
  Activity,
  Cpu,
  Database,
  Network,
  Eye,
  Download,
  Share,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  Award,
  Users,
  Calendar,
  Settings,
  ArrowRight,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface ProcessingStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  duration: number;
  icon: React.ReactNode;
  details?: string[];
}

interface WorkerActivity {
  id: string;
  name: string;
  type: 'llm' | 'analysis' | 'extraction' | 'validation';
  status: 'idle' | 'active' | 'completed';
  progress: number;
  tokensProcessed?: number;
  confidence?: number;
}

interface GeneratedArtifact {
  id: string;
  type: string;
  name: string;
  status: 'generating' | 'completed';
  confidence: number;
  size: string;
  preview?: string;
}

export function RealTimeProcessingDemo() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [stages, setStages] = useState<ProcessingStage[]>([]);
  const [workers, setWorkers] = useState<WorkerActivity[]>([]);
  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>([]);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [processingTime, setProcessingTime] = useState(0);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    initializeDemo();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      interval = setInterval(() => {
        setProcessingTime(prev => prev + 0.1);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const initializeDemo = () => {
    setStages([
      {
        id: '1',
        name: 'File Upload & Validation',
        description: 'Validating file format and extracting content',
        status: 'pending',
        progress: 0,
        duration: 0,
        icon: <Upload className="w-5 h-5" />,
        details: ['PDF structure validation', 'Content extraction', 'Security scan']
      },
      {
        id: '2',
        name: 'AI Content Analysis',
        description: 'GPT-4 analyzing contract structure and content',
        status: 'pending',
        progress: 0,
        duration: 0,
        icon: <Brain className="w-5 h-5" />,
        details: ['Natural language processing', 'Entity extraction', 'Clause identification']
      },
      {
        id: '3',
        name: 'Risk Assessment',
        description: 'Evaluating financial and legal risks',
        status: 'pending',
        progress: 0,
        duration: 0,
        icon: <Shield className="w-5 h-5" />,
        details: ['Financial risk analysis', 'Legal compliance check', 'Risk scoring']
      },
      {
        id: '4',
        name: 'Financial Analysis',
        description: 'Extracting and analyzing financial terms',
        status: 'pending',
        progress: 0,
        duration: 0,
        icon: <DollarSign className="w-5 h-5" />,
        details: ['Payment terms extraction', 'Cost analysis', 'Revenue impact']
      },
      {
        id: '5',
        name: 'Compliance Validation',
        description: 'Checking regulatory compliance requirements',
        status: 'pending',
        progress: 0,
        duration: 0,
        icon: <Award className="w-5 h-5" />,
        details: ['GDPR compliance', 'Industry standards', 'Legal requirements']
      },
      {
        id: '6',
        name: 'Artifact Generation',
        description: 'Creating searchable artifacts and insights',
        status: 'pending',
        progress: 0,
        duration: 0,
        icon: <FileText className="w-5 h-5" />,
        details: ['Overview generation', 'Clause extraction', 'Metadata creation']
      }
    ]);

    setWorkers([
      {
        id: '1',
        name: 'Template Analysis Worker',
        type: 'analysis',
        status: 'idle',
        progress: 0
      },
      {
        id: '2',
        name: 'Financial Analysis Worker',
        type: 'llm',
        status: 'idle',
        progress: 0,
        tokensProcessed: 0
      },
      {
        id: '3',
        name: 'Risk Assessment Worker',
        type: 'llm',
        status: 'idle',
        progress: 0,
        tokensProcessed: 0
      },
      {
        id: '4',
        name: 'Compliance Worker',
        type: 'validation',
        status: 'idle',
        progress: 0
      },
      {
        id: '5',
        name: 'Clause Extraction Worker',
        type: 'extraction',
        status: 'idle',
        progress: 0
      },
      {
        id: '6',
        name: 'Overview Generation Worker',
        type: 'llm',
        status: 'idle',
        progress: 0,
        tokensProcessed: 0
      }
    ]);

    setArtifacts([
      {
        id: '1',
        type: 'OVERVIEW',
        name: 'Contract Overview',
        status: 'generating',
        confidence: 0,
        size: '0 KB'
      },
      {
        id: '2',
        type: 'CLAUSES',
        name: 'Clause Analysis',
        status: 'generating',
        confidence: 0,
        size: '0 KB'
      },
      {
        id: '3',
        type: 'RISK',
        name: 'Risk Assessment',
        status: 'generating',
        confidence: 0,
        size: '0 KB'
      },
      {
        id: '4',
        type: 'FINANCIAL',
        name: 'Financial Analysis',
        status: 'generating',
        confidence: 0,
        size: '0 KB'
      },
      {
        id: '5',
        type: 'COMPLIANCE',
        name: 'Compliance Report',
        status: 'generating',
        confidence: 0,
        size: '0 KB'
      }
    ]);
  };

  const startProcessing = async () => {
    setIsProcessing(true);
    setProcessingTime(0);
    setShowResults(false);
    setUploadedFile('Master_Service_Agreement_TechCorp.pdf');

    // Simulate processing stages
    for (let i = 0; i < stages.length; i++) {
      await processStage(i);
    }

    setIsProcessing(false);
    setShowResults(true);
  };

  const processStage = async (stageIndex: number) => {
    setCurrentStage(stageIndex);
    
    // Update stage status to processing
    setStages(prev => prev.map((stage, index) => 
      index === stageIndex 
        ? { ...stage, status: 'processing' }
        : stage
    ));

    // Activate relevant workers
    const stageWorkerMap: { [key: number]: number[] } = {
      0: [0], // Upload - Template Analysis
      1: [1, 2, 5], // AI Analysis - Financial, Risk, Overview
      2: [2], // Risk Assessment
      3: [1], // Financial Analysis
      4: [3], // Compliance
      5: [4, 5] // Artifact Generation
    };

    const relevantWorkers = stageWorkerMap[stageIndex] || [];
    
    // Activate workers
    setWorkers(prev => prev.map((worker, index) => 
      relevantWorkers.includes(index)
        ? { ...worker, status: 'active' }
        : worker
    ));

    // Simulate progress
    const duration = 2000 + Math.random() * 3000; // 2-5 seconds
    const steps = 50;
    const stepDuration = duration / steps;

    for (let step = 0; step <= steps; step++) {
      const progress = (step / steps) * 100;
      
      // Update stage progress
      setStages(prev => prev.map((stage, index) => 
        index === stageIndex 
          ? { ...stage, progress, duration: (step * stepDuration) / 1000 }
          : stage
      ));

      // Update worker progress
      setWorkers(prev => prev.map((worker, index) => 
        relevantWorkers.includes(index)
          ? { 
              ...worker, 
              progress,
              tokensProcessed: worker.type === 'llm' ? Math.floor(progress * 50) : undefined,
              confidence: Math.min(85 + Math.random() * 10, 95)
            }
          : worker
      ));

      // Update artifacts
      if (stageIndex >= 1) {
        setArtifacts(prev => prev.map(artifact => ({
          ...artifact,
          confidence: Math.min(progress * 0.9, 90 + Math.random() * 8),
          size: `${Math.floor(progress * 0.5 + Math.random() * 10)} KB`
        })));
      }

      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }

    // Complete stage
    setStages(prev => prev.map((stage, index) => 
      index === stageIndex 
        ? { ...stage, status: 'completed', progress: 100 }
        : stage
    ));

    // Complete workers
    setWorkers(prev => prev.map((worker, index) => 
      relevantWorkers.includes(index)
        ? { ...worker, status: 'completed', progress: 100 }
        : worker
    ));

    // Complete artifacts for final stage
    if (stageIndex === stages.length - 1) {
      setArtifacts(prev => prev.map(artifact => ({
        ...artifact,
        status: 'completed',
        confidence: 90 + Math.random() * 8,
        preview: `AI-generated ${artifact.name.toLowerCase()} with comprehensive insights and recommendations.`
      })));
    }
  };

  const resetDemo = () => {
    setIsProcessing(false);
    setCurrentStage(0);
    setProcessingTime(0);
    setShowResults(false);
    setUploadedFile(null);
    initializeDemo();
  };

  const getWorkerIcon = (type: string) => {
    switch (type) {
      case 'llm': return <Brain className="w-4 h-4" />;
      case 'analysis': return <Activity className="w-4 h-4" />;
      case 'extraction': return <FileText className="w-4 h-4" />;
      case 'validation': return <CheckCircle className="w-4 h-4" />;
      default: return <Cpu className="w-4 h-4" />;
    }
  };

  const getWorkerColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-blue-600 bg-blue-50';
      case 'completed': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Demo Controls */}
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Zap className="w-6 h-6" />
                Real-Time AI Processing Demo
              </h2>
              <p className="text-blue-100">
                Watch our AI system analyze a contract in real-time with parallel processing
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!isProcessing && !showResults && (
                <Button 
                  onClick={startProcessing}
                  className="bg-white text-blue-600 hover:bg-blue-50"
                  size="lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Demo
                </Button>
              )}
              {showResults && (
                <Button 
                  onClick={resetDemo}
                  className="bg-white text-blue-600 hover:bg-blue-50"
                  size="lg"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Reset Demo
                </Button>
              )}
              {isProcessing && (
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing: {processingTime.toFixed(1)}s</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Pipeline */}
      {(isProcessing || showResults) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              AI Processing Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stages.map((stage, index) => (
                <div 
                  key={stage.id}
                  className={`p-4 rounded-lg border-2 transition-all duration-300 ${
                    stage.status === 'completed' ? 'border-green-200 bg-green-50' :
                    stage.status === 'processing' ? 'border-blue-200 bg-blue-50' :
                    stage.status === 'error' ? 'border-red-200 bg-red-50' :
                    'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        stage.status === 'completed' ? 'bg-green-100 text-green-600' :
                        stage.status === 'processing' ? 'bg-blue-100 text-blue-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {stage.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : stage.icon}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{stage.name}</h4>
                        <p className="text-sm text-gray-600">{stage.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={
                        stage.status === 'completed' ? 'bg-green-100 text-green-800' :
                        stage.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {stage.status === 'completed' ? 'Completed' :
                         stage.status === 'processing' ? 'Processing' :
                         'Pending'}
                      </Badge>
                      {stage.status === 'processing' && (
                        <div className="text-sm text-gray-500 mt-1">
                          {stage.duration.toFixed(1)}s
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Progress value={stage.progress} className="h-2 mb-3" />
                  
                  {stage.details && stage.status !== 'pending' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {stage.details.map((detail, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          {detail}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Worker Activity */}
      {(isProcessing || showResults) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-600" />
                AI Worker Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workers.map((worker) => (
                  <div key={worker.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getWorkerColor(worker.status)}`}>
                        {getWorkerIcon(worker.type)}
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-900">{worker.name}</h5>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Progress: {worker.progress.toFixed(0)}%</span>
                          {worker.tokensProcessed !== undefined && (
                            <span>Tokens: {worker.tokensProcessed}</span>
                          )}
                          {worker.confidence && (
                            <span>Confidence: {worker.confidence.toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="w-16">
                      <Progress value={worker.progress} className="h-1" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Generated Artifacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Generated Artifacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {artifacts.map((artifact) => (
                  <div key={artifact.id} className="p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-900">{artifact.name}</h5>
                      <Badge className={
                        artifact.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }>
                        {artifact.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Confidence: {artifact.confidence.toFixed(0)}%</span>
                      <span>Size: {artifact.size}</span>
                    </div>
                    <Progress value={artifact.confidence} className="h-1 mb-2" />
                    {artifact.preview && (
                      <p className="text-xs text-gray-500">{artifact.preview}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Summary */}
      {showResults && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Processing Complete!</h3>
              <p className="text-gray-600">
                Contract analyzed in {processingTime.toFixed(1)} seconds with 94% confidence
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-white rounded-lg">
                <Target className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">94%</div>
                <div className="text-sm text-gray-600">Analysis Confidence</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <Clock className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{processingTime.toFixed(1)}s</div>
                <div className="text-sm text-gray-600">Processing Time</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <FileText className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">5</div>
                <div className="text-sm text-gray-600">Artifacts Generated</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <Shield className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">Low</div>
                <div className="text-sm text-gray-600">Risk Level</div>
              </div>
            </div>
            
            <div className="flex justify-center gap-3">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Eye className="w-4 h-4 mr-2" />
                View Analysis
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline">
                <Share className="w-4 h-4 mr-2" />
                Share Results
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}