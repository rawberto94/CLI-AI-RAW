/**
 * UploadDropZone — Drag-and-drop file upload area
 */

'use client';

import React from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, FileUp, CloudUpload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadDropZoneProps {
  onDrop: (files: File[]) => void;
  disabled?: boolean;
  uploadPurpose?: 'store' | 'review';
}

export function UploadDropZone({ onDrop, disabled = false, uploadPurpose = 'store' }: UploadDropZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/html': ['.html', '.htm'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    multiple: true,
    maxSize: 50 * 1024 * 1024,
    disabled,
  });

  return (
    <Card className="shadow-xl border-0 dark:border dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
      <CardContent className="p-8">
        <motion.div
          whileHover={!disabled ? { scale: 1.01 } : undefined}
          whileTap={!disabled ? { scale: 0.99 } : undefined}
          className="motion-reduce:transform-none"
        >
          <div
            {...getRootProps()}
            className={cn(
              'relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 overflow-hidden motion-reduce:transition-none',
              isDragActive
                ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/30 scale-[1.02]'
                : 'border-gray-300 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-gradient-to-br hover:from-gray-50 hover:to-purple-50/30 dark:hover:from-slate-800 dark:hover:to-violet-900/20',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <input {...getInputProps()} disabled={disabled} aria-label="Upload contract documents" data-testid="contract-upload-input" />

            <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))] opacity-50" aria-hidden="true" />

            <div className="relative z-10">
              <motion.div
                className={cn(
                  'mx-auto mb-6 p-6 rounded-full w-fit motion-reduce:animate-none',
                  isDragActive
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-xl'
                    : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600',
                )}
                animate={isDragActive ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                {isDragActive ? (
                  <CloudUpload className="h-12 w-12 text-white" aria-hidden="true" />
                ) : (
                  <FileUp className="h-12 w-12 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                )}
              </motion.div>

              {isDragActive ? (
                <>
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mb-2">
                    {uploadPurpose === 'review' ? 'Drop your documents here!' : 'Drop your contracts here!'}
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    {uploadPurpose === 'review' ? 'Release to start AI-powered review' : 'Release to start the AI analysis'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                    {uploadPurpose === 'review' ? 'Drag & drop documents for review' : 'Drag & drop contracts here'}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">
                    {uploadPurpose === 'review' ? 'AI will analyze for redlining, risks, and recommendations' : 'or click to browse your files'}
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                    {['PDF', 'DOC', 'DOCX', 'TXT', 'PNG', 'JPG'].map(format => (
                      <Badge key={format} variant="outline" className="text-sm px-3 py-1.5 dark:border-slate-600 dark:text-slate-300">
                        <FileText className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                        {format}
                      </Badge>
                    ))}
                  </div>

                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Maximum file size: 50MB per file &bull; Upload multiple files at once
                  </p>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}

export default UploadDropZone;
