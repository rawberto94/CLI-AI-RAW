"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";
import type { Contract } from "@/hooks/use-queries";

interface ProcessingContractTrackerProps {
  contracts: Contract[];
  onContractComplete?: (contractId: string) => void;
}

export const ProcessingContractTracker = memo(function ProcessingContractTracker({
  contracts,
  onContractComplete: _onContractComplete
}: ProcessingContractTrackerProps) {
  const processingContracts = contracts.filter(c => c.status === 'processing');
  
  if (processingContracts.length === 0) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-4"
    >
      <Card className="bg-slate-50 border-slate-200 shadow-sm overflow-hidden relative">
        <CardContent className="py-5 px-6 relative">
          <div className="flex items-center gap-4 mb-5">
            <div 
              className="relative w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center"
            >
              <Activity className="h-5 w-5 text-white" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-600 border-2 border-white"></span>
              </span>
            </div>
            <div>
              <span className="font-semibold text-slate-900 text-sm">
                Processing {processingContracts.length} contract{processingContracts.length > 1 ? 's' : ''}
              </span>
              <p className="text-xs text-slate-500 mt-0.5">AI is analyzing your documents...</p>
            </div>
          </div>
          <div className="space-y-2">
            {processingContracts.slice(0, 3).map((contract) => (
              <div key={contract.id} className="flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 truncate font-medium">{contract.title}</p>
                  <p className="text-xs text-slate-500">
                    {contract.processing?.currentStage || 'Initializing...'}
                  </p>
                </div>
                <div className="w-24">
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-slate-700 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${contract.processing?.progress || 0}%` }}
                      transition={{ duration: 0.5, ease: "easeInOut" }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 text-right mt-0.5">
                    {contract.processing?.progress || 0}%
                  </p>
                </div>
              </div>
            ))}
            {processingContracts.length > 3 && (
              <p className="text-xs text-slate-500 text-center">
                +{processingContracts.length - 3} more processing
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});
