'use client';

import { RateCardBreadcrumbs } from '@/components/rate-cards/RateCardBreadcrumbs';
import { CSVImportModal } from '@/components/rate-cards/CSVImportModal';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';

export function RateCardUploadClientPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      <div className="container mx-auto p-6 space-y-6">
        <RateCardBreadcrumbs />
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25">
            <Upload className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              Upload Rate Cards
            </h1>
            <p className="text-slate-600">
              Bulk import rate cards using CSV file upload
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-4xl"
        >
          <CSVImportModal isOpen={true} onClose={() => {}} />
        </motion.div>
      </div>
    </div>
  );
}
