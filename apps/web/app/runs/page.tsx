"use client";

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, Activity, AlertCircle, ListChecks } from 'lucide-react';

const fetchRuns = async () => {
  const response = await fetch('/api/v2/runs');
  if (!response.ok) {
    throw new Error('Failed to fetch runs');
  }
  return response.json();
};

export default function RunsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['runs'],
    queryFn: fetchRuns,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const runs = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Runs</h1>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24"
        >
          <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/25 mb-6">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <p className="text-slate-600 font-medium">Loading runs...</p>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-rose-50/20 p-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg shadow-red-500/25">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Runs</h1>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/90 backdrop-blur-sm border border-white/50 shadow-lg rounded-xl p-8 max-w-md mx-auto border-l-4 border-l-red-500"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <p className="text-red-600 font-medium">Failed to load runs</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-6 space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25">
          <Activity className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Runs</h1>
          <p className="text-slate-600 mt-1">Monitor pipeline executions and processing runs</p>
        </div>
      </motion.div>
      
      {runs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/90 backdrop-blur-sm border border-white/50 shadow-lg rounded-xl p-12 text-center"
        >
          <div className="p-4 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl inline-block mb-4">
            <ListChecks className="w-12 h-12 text-slate-400" />
          </div>
          <p className="text-lg font-medium text-slate-700 mb-2">No runs found</p>
          <p className="text-slate-500 text-sm">Pipeline runs will appear here when processing starts</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-sm border border-white/50 shadow-lg rounded-xl overflow-hidden"
        >
          <ul className="divide-y divide-slate-100">
            {runs.map((r: any, index: number) => (
              <motion.li 
                key={r.runId} 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-slate-50/80 transition-colors"
              >
                <a href={`/runs/${r.runId}`} className="flex items-center justify-between">
                  <span className="text-blue-600 hover:text-blue-700 font-medium">{r.runId}</span>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    r.status === 'completed' ? 'bg-green-100 text-green-700' :
                    r.status === 'running' ? 'bg-blue-100 text-blue-700' :
                    r.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>{r.status}</span>
                </a>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
