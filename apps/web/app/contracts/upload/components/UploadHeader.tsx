/**
 * UploadHeader — Hero header with status badges
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CloudUpload, Sparkles, Brain, Loader2, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface UploadHeaderProps {
  dataMode: string;
  aiModel: string;
  isUploading: boolean;
  processingCount: number;
}

function getModelLabel(model: string): string {
  switch (model) {
    case 'azure-ch': return 'Azure GPT-4o (CH)';
    case 'mistral': return 'Mistral Large (EU)';
    case 'auto': return 'Auto Select';
    default: return 'Azure GPT-4o (CH)';
  }
}

export function UploadHeader({ dataMode, aiModel, isUploading, processingCount }: UploadHeaderProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 dark:from-violet-800 dark:via-purple-800 dark:to-purple-900 shadow-2xl">
      <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))]" aria-hidden="true" />

      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div
          className="absolute top-10 right-10 w-64 h-64 bg-white/10 rounded-full blur-3xl motion-reduce:animate-none"
          animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-10 left-10 w-48 h-48 bg-violet-400/20 rounded-full blur-3xl motion-reduce:animate-none"
          animate={{ scale: [1, 1.3, 1], x: [0, -20, 0], y: [0, 20, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
      </div>

      <div className="relative px-6 py-10 md:px-12 md:py-14 max-w-7xl mx-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <motion.div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg" whileHover={{ scale: 1.05, rotate: 5 }}>
              <CloudUpload className="h-10 w-10 text-white" />
            </motion.div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Upload Contracts</h1>
              <p className="text-violet-100 text-lg">AI-powered contract analysis in seconds</p>
            </div>
          </div>

          <Link href="/contracts">
            <Button variant="secondary" className="gap-2">
              View All Contracts
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Badge className="bg-white/20 text-white border-white/30 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <Sparkles className="h-4 w-4 mr-2" />
            {dataMode} mode
          </Badge>
          <Badge className="bg-white/20 text-white border-white/30 px-4 py-2 text-sm font-medium backdrop-blur-sm">
            <Brain className="h-4 w-4 mr-2" />
            {getModelLabel(aiModel)}
          </Badge>
          {isUploading && (
            <Badge className="bg-green-500/30 text-green-100 border-green-300/30 px-4 py-2 text-sm backdrop-blur-sm motion-safe:animate-pulse">
              <Loader2 className="h-4 w-4 mr-2 motion-safe:animate-spin" aria-hidden="true" />
              Processing {processingCount} file{processingCount !== 1 ? 's' : ''}...
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export default UploadHeader;
