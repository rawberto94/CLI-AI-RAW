'use client';

/**
 * Artifact Generation Tracker
 * 
 * Shows real-time progress of OCR → Artifact Generation pipeline
 * Connects upload flow directly to Enhanced Artifact Viewer
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, FileText, Brain, Sparkles, CheckCircle, 
  Loader2, AlertCircle, Eye, ArrowRight, Clock,
  Zap, Shield, Target, TrendingUp, Image
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';

interface ArtifactGenerationTrackerProps {
  contractId: string;
  fileName: string;
  onComplete?: () => void;
}

type ProcessingStage = 
  | 'uploading' 
  | 'ocr_processing' 
  | 'artifact_generation' 
  | 'complete' 
  | 'error';

interface ProcessingMetrics {
  ocrQuality?: 'fast' | 'balanced' | 'high';
  ocrConfidence?: number;
  artifactsGenerated?: number;
  totalArtifacts?: number;
  estimatedCompletion?: number;
}

export function ArtifactGenerationTracker({ 
  contractId, 
  fileName,
  onComplete 
}: ArtifactGenerationTrackerProps) {
  const router = useRouter();
  const [currentStage, setCurrentStage] = useState<ProcessingStage>('uploading');
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<ProcessingMetrics>({});
  const [error, setError] = useState<string | null>(null);
  const [artifactsReady, setArtifactsReady] = useState<string[]>([]);

  useEffect(() => {
    // Poll for contract status
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/contracts/${contractId}/status`, {
          headers: {
            'x-tenant-id': 'demo'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Update stage based on contract status
          if (data.status === 'PROCESSING') {
            if (data.currentStep === 'ocr') {
              setCurrentStage('ocr_processing');
              setProgress(40);
              setMetrics({
                ocrQuality: data.ocrQuality,
                ocrConfidence: data.ocrConfidence,
              });
            } else if (data.currentStep === 'artifacts') {
              setCurrentStage('artifact_generation');
              setProgress(70);
              setMetrics({
                ...metrics,
                artifactsGenerated: data.artifactsGenerated || 0,
                totalArtifacts: 5,
              });
            }
          } else if (data.status === 'ACTIVE' || data.status === 'COMPLETED') {
            setCurrentStage('complete');
            setProgress(100);
            setArtifactsReady(data.artifactTypes || ['overview', 'financial', 'risk', 'compliance', 'clauses']);
            clearInterval(pollInterval);
            onComplete?.();
          } else if (data.status === 'ERROR' || data.status === 'FAILED') {
            setCurrentStage('error');
            setError(data.error || 'Processing failed');
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('Failed to poll contract status:', error);
      }
    }, 2000); // Poll every 2 seconds

    // Smooth progress animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        let target = 10;
        if (currentStage === 'uploading') target = 25;
        if (currentStage === 'ocr_processing') target = 50;
        if (currentStage === 'artifact_generation') target = 85;
        if (currentStage === 'complete') target = 100;
        
        if (prev < target) {
          return Math.min(prev + 0.5, target);
        }
        return prev;
      });
    }, 100);

    return () => {
      clearInterval(pollInterval);
      clearInterval(progressInterval);
    };
  }, [contractId, currentStage, onComplete, metrics]);

  const handleViewArtifacts = () => {
    router.push(`/contracts/${contractId}`);
  };

  return (
    <Card className="border-2 shadow-xl overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500">
        <motion.div
          className="h-full bg-white/30"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      <CardContent className="p-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <motion.div
              animate={{ 
                scale: currentStage === 'complete' ? [1, 1.2, 1] : [1, 1.1, 1],
                rotate: currentStage === 'complete' ? [0, 360] : 0,
              }}
              transition={{ 
                scale: { duration: 2, repeat: currentStage !== 'complete' && currentStage !== 'error' ? Infinity : 0 },
                rotate: { duration: 1 }
              }}
              className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center relative overflow-hidden ${
                currentStage === 'error' 
                  ? 'bg-red-100' 
                  : currentStage === 'complete'
                  ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                  : 'bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500'
              }`}
            >
              <div className="absolute inset-0 bg-white/10" />
              {currentStage === 'uploading' && <Upload className="w-12 h-12 text-white relative z-10" />}
              {currentStage === 'ocr_processing' && <Image className="w-12 h-12 text-white relative z-10" />}
              {currentStage === 'artifact_generation' && <Brain className="w-12 h-12 text-white relative z-10" />}
              {currentStage === 'complete' && <CheckCircle className="w-12 h-12 text-white relative z-10" />}
              {currentStage === 'error' && <AlertCircle className="w-12 h-12 text-red-600" />}
            </motion.div>
            
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                {currentStage === 'uploading' && 'Uploading Contract'}
                {currentStage === 'ocr_processing' && 'AI-Powered OCR Processing'}
                {currentStage === 'artifact_generation' && 'Generating Artifacts'}
                {currentStage === 'complete' && 'Processing Complete! 🎉'}
                {currentStage === 'error' && 'Processing Failed'}
              </h3>
              <p className="text-gray-600 mt-1">
                {currentStage === 'uploading' && 'Securely uploading your contract file...'}
                {currentStage === 'ocr_processing' && 'Extracting text with GPT-4 Vision + AWS Textract'}
                {currentStage === 'artifact_generation' && 'Creating intelligent insights with GPT-4'}
                {currentStage === 'complete' && 'All artifacts generated and ready to view'}
                {currentStage === 'error' && (error || 'An unexpected error occurred')}
              </p>
              <p className="text-sm text-gray-500 font-mono mt-2">
                {fileName}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 font-medium">Overall Progress</span>
              <span className="font-bold text-gray-900">{Math.round(progress)}%</span>
            </div>
            <div className="relative">
              <Progress value={progress} className="h-4" />
              <motion.div
                className="absolute top-0 left-0 h-4 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 opacity-30 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Stage Details */}
          <div className="grid grid-cols-3 gap-3">
            {/* Upload Stage */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`p-4 rounded-xl border-2 transition-all ${
                currentStage === 'uploading'
                  ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg'
                  : progress >= 25
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentStage === 'uploading'
                    ? 'bg-blue-500'
                    : progress >= 25
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}>
                  {currentStage === 'uploading' ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : progress >= 25 ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <Upload className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Upload</p>
                  <p className="text-xs text-gray-500">Secure transfer</p>
                </div>
              </div>
            </motion.div>

            {/* OCR Stage */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`p-4 rounded-xl border-2 transition-all ${
                currentStage === 'ocr_processing'
                  ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100 shadow-lg'
                  : progress >= 50
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentStage === 'ocr_processing'
                    ? 'bg-purple-500'
                    : progress >= 50
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}>
                  {currentStage === 'ocr_processing' ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : progress >= 50 ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <Image className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">OCR</p>
                  <p className="text-xs text-gray-500">
                    {metrics.ocrQuality ? metrics.ocrQuality : 'AI extraction'}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Artifacts Stage */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`p-4 rounded-xl border-2 transition-all ${
                currentStage === 'artifact_generation' || currentStage === 'complete'
                  ? currentStage === 'complete'
                    ? 'border-green-500 bg-gradient-to-br from-green-50 to-emerald-100 shadow-lg'
                    : 'border-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-lg'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center gap-2 text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentStage === 'artifact_generation'
                    ? 'bg-green-500'
                    : currentStage === 'complete'
                    ? 'bg-green-600'
                    : 'bg-gray-300'
                }`}>
                  {currentStage === 'artifact_generation' ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : currentStage === 'complete' ? (
                    <CheckCircle className="w-6 h-6 text-white" />
                  ) : (
                    <Brain className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Artifacts</p>
                  <p className="text-xs text-gray-500">
                    {metrics.artifactsGenerated 
                      ? `${metrics.artifactsGenerated}/5`
                      : 'GPT-4 analysis'
                    }
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* OCR Processing Details */}
          {currentStage === 'ocr_processing' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-5 border-2 border-purple-200"
            >
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-purple-900 mb-2">
                    Hybrid OCR Processing
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full" />
                      <span className="text-purple-700">GPT-4 Vision</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-pink-500 rounded-full" />
                      <span className="text-purple-700">AWS Textract</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full" />
                      <span className="text-purple-700">Sharp Preprocessing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-pink-500 rounded-full" />
                      <span className="text-purple-700">Smart Routing</span>
                    </div>
                  </div>
                  {metrics.ocrConfidence && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs text-purple-700">OCR Confidence:</span>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800">
                        {(metrics.ocrConfidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Artifact Generation Details */}
          {currentStage === 'artifact_generation' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3"
            >
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200">
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-green-900 mb-2">
                      Generating AI Artifacts
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {['Overview', 'Financial', 'Risk', 'Compliance', 'Clauses'].map((artifact, idx) => (
                        <motion.div
                          key={artifact}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.15 }}
                          className="flex items-center gap-2 text-xs"
                        >
                          {idx < (metrics.artifactsGenerated || 0) ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-green-600 animate-spin" />
                          )}
                          <span className="text-green-800">{artifact}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Success State */}
          {currentStage === 'complete' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 rounded-xl p-6 border-2 border-green-300">
                <div className="flex items-start gap-4">
                  <CheckCircle className="w-10 h-10 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-green-900 mb-2">
                      All Artifacts Generated Successfully! 🎉
                    </h4>
                    <p className="text-green-700 mb-3">
                      Your contract has been fully analyzed with state-of-the-art AI
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {artifactsReady.map((artifact) => (
                        <Badge 
                          key={artifact} 
                          className="bg-green-600 text-white border-0"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {artifact.charAt(0).toUpperCase() + artifact.slice(1)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                  <Zap className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-blue-900">Smart OCR</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
                  <Brain className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-purple-900">GPT-4</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                  <Shield className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-green-900">Risk Check</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-center">
                  <Target className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-orange-900">Compliance</p>
                </div>
              </div>

              <Button 
                onClick={handleViewArtifacts}
                size="lg"
                className="w-full bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 text-white shadow-xl text-lg py-6"
              >
                <Eye className="w-5 h-5 mr-2" />
                View Enhanced Artifacts
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* Error State */}
          {currentStage === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6 border-2 border-red-200">
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-10 h-10 text-red-600 flex-shrink-0" />
                  <div>
                    <h4 className="text-lg font-bold text-red-900 mb-2">
                      Processing Failed
                    </h4>
                    <p className="text-red-700 mb-2">
                      {error || 'An error occurred during contract processing'}
                    </p>
                    <p className="text-sm text-red-600">
                      Please try again or contact support if the issue persists
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => window.location.reload()}
                  variant="outline"
                  className="flex-1"
                >
                  Try Again
                </Button>
                <Button 
                  onClick={handleViewArtifacts}
                  variant="outline"
                  className="flex-1"
                >
                  View Contract
                </Button>
              </div>
            </motion.div>
          )}

          {/* Processing Info */}
          {currentStage !== 'complete' && currentStage !== 'error' && (
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Typically completes in 30-60 seconds</span>
              </div>
              <p className="text-xs text-gray-500">
                You can safely navigate away and return later
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
