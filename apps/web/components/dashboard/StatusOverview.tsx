/**
 * Contracts Dashboard - Status Overview
 * Real-time view of contract processing status
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  FileText,
  Activity
} from "lucide-react";

interface StatusBreakdown {
  status: string;
  count: number;
}

interface StatusOverviewProps {
  data: StatusBreakdown[];
  totalContracts: number;
}

const statusConfig: Record<string, { 
  label: string; 
  icon: any; 
  gradient: string;
  bgGradient: string;
  borderColor: string;
  shadowColor: string;
  progressColor: string;
}> = {
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle,
    gradient: 'from-emerald-500 to-green-500',
    bgGradient: 'from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-800/50',
    shadowColor: 'shadow-emerald-500/10',
    progressColor: 'bg-gradient-to-r from-emerald-500 to-green-500'
  },
  PROCESSING: {
    label: 'Processing',
    icon: Activity,
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
    shadowColor: 'shadow-blue-500/10',
    progressColor: 'bg-gradient-to-r from-blue-500 to-cyan-500'
  },
  UPLOADED: {
    label: 'Uploaded',
    icon: Clock,
    gradient: 'from-amber-500 to-yellow-500',
    bgGradient: 'from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
    shadowColor: 'shadow-amber-500/10',
    progressColor: 'bg-gradient-to-r from-amber-500 to-yellow-500'
  },
  FAILED: {
    label: 'Failed',
    icon: AlertTriangle,
    gradient: 'from-rose-500 to-red-500',
    bgGradient: 'from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30',
    borderColor: 'border-rose-200 dark:border-rose-800/50',
    shadowColor: 'shadow-rose-500/10',
    progressColor: 'bg-gradient-to-r from-rose-500 to-red-500'
  }
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.3 }
  }
};

export function StatusOverview({ data, totalContracts }: StatusOverviewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card className="relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl">
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent rounded-full -translate-y-1/2 -translate-x-1/2" />
        <CardHeader className="pb-3 relative">
          <CardTitle className="flex items-center gap-2 text-base mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/30">
              <Activity className="h-4 w-4" />
            </div>
            Contract Status
          </CardTitle>
          <p className="text-sm text-muted-foreground">Real-time processing overview</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-fit mx-auto mb-3">
                <FileText className="h-12 w-12 opacity-40" />
              </div>
              <p className="font-medium">No contracts found</p>
            </div>
          ) : (
            <>
              <motion.div 
                className="space-y-3"
                variants={listVariants}
                initial="hidden"
                animate="visible"
              >
                {data.map((item, index) => {
                  const config = statusConfig[item.status] || {
                    label: item.status,
                    icon: FileText,
                    gradient: 'from-gray-500 to-slate-500',
                    bgGradient: 'from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30',
                    borderColor: 'border-gray-200 dark:border-gray-800/50',
                    shadowColor: 'shadow-gray-500/10',
                    progressColor: 'bg-gradient-to-r from-gray-500 to-slate-500'
                  };
                  const Icon = config.icon;
                  const percentage = totalContracts > 0 ? (item.count / totalContracts) * 100 : 0;
                  
                  return (
                    <motion.div 
                      key={item.status} 
                      variants={itemVariants}
                      whileHover={{ scale: 1.01, x: 2 }}
                      className={`p-4 rounded-xl border ${config.borderColor} bg-gradient-to-r ${config.bgGradient} hover:shadow-lg ${config.shadowColor} transition-all duration-300 cursor-pointer`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} text-white shadow-md`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{config.label}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                            {item.count}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {percentage.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="relative h-2.5 rounded-full bg-slate-200/50 dark:bg-slate-700/50 overflow-hidden">
                        <motion.div 
                          className={`absolute inset-y-0 left-0 rounded-full ${config.progressColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
              
              <motion.div 
                className="pt-4 border-t border-slate-200/50 dark:border-slate-700/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total Contracts</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                    {totalContracts.toLocaleString()}
                  </span>
                </div>
              </motion.div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
