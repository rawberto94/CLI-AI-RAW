'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, FileText, Sparkles, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface UploadSuccessProps {
  contractId: string;
  fileName: string;
  status: string;
  onViewContract: () => void;
  onUploadAnother: () => void;
}

export function UploadSuccess({ 
  contractId, 
  fileName, 
  status,
  onViewContract,
  onUploadAnother
}: UploadSuccessProps) {
  const [progress, setProgress] = React.useState(0);
  const [currentStage, setCurrentStage] = React.useState('Extracting text...');

  React.useEffect(() => {
    const stages = [
      { progress: 20, stage: 'Extracting text...', delay: 500 },
      { progress: 40, stage: 'Analyzing structure...', delay: 1500 },
      { progress: 60, stage: 'Extracting artifacts...', delay: 2500 },
      { progress: 80, stage: 'Generating insights...', delay: 3500 },
      { progress: 100, stage: 'Complete!', delay: 4500 },
    ];

    stages.forEach(({ progress, stage, delay }) => {
      setTimeout(() => {
        setProgress(progress);
        setCurrentStage(stage);
      }, delay);
    });
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="space-y-6"
      >
        {/* Success Header */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full shadow-lg"
          >
            <CheckCircle2 className="w-12 h-12 text-white" />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-3xl font-bold text-gray-900">Upload Successful!</h2>
            <p className="text-gray-600 mt-2">
              Your contract is being analyzed with AI-powered intelligence
            </p>
          </motion.div>
        </div>

        {/* File Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{fileName}</p>
                  <p className="text-sm text-gray-600 mt-1">Contract ID: {contractId}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="bg-white">
                      <Clock className="w-3 h-3 mr-1" />
                      {status}
                    </Badge>
                    <Badge variant="outline" className="bg-white">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Analysis
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Processing Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">AI Processing</h3>
                <span className="text-sm font-medium text-blue-600">{progress}%</span>
              </div>
              
              <Progress value={progress} className="h-2" />
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <TrendingUp className="w-4 h-4 animate-pulse" />
                <span>{currentStage}</span>
              </div>

              {/* Processing Steps */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                {[
                  { label: 'Text Extraction', done: progress >= 20 },
                  { label: 'Structure Analysis', done: progress >= 40 },
                  { label: 'Artifact Extraction', done: progress >= 60 },
                  { label: 'Insight Generation', done: progress >= 80 },
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${step.done ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className={`text-sm ${step.done ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* What's Being Analyzed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                AI is Extracting
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  'Contract Overview',
                  'Key Terms',
                  'Financial Details',
                  'Rate Cards',
                  'Risk Analysis',
                  'Compliance Check',
                  'Important Clauses',
                  'Payment Schedule',
                  'Obligations'
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex gap-3"
        >
          <Button 
            onClick={onViewContract}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            size="lg"
          >
            View Contract Details
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button 
            onClick={onUploadAnother}
            variant="outline"
            size="lg"
          >
            Upload Another
          </Button>
        </motion.div>

        {/* Info Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-sm text-gray-500"
        >
          Analysis typically completes in 15-30 seconds. You can view the contract now and artifacts will appear as they&apos;re generated.
        </motion.p>
      </motion.div>
    </div>
  );
}
