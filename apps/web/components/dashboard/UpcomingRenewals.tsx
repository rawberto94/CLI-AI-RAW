/**
 * Contracts Dashboard - Upcoming Renewals Component
 * Displays contracts that are expiring soon with priority indicators
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, AlertCircle, Clock, ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";

interface Renewal {
  id: string;
  name: string;
  type: string;
  endDate: string;
  daysUntilExpiry: number;
  priority: 'urgent' | 'high' | 'medium';
}

interface UpcomingRenewalsProps {
  renewals: Renewal[];
}

const priorityConfig = {
  urgent: {
    icon: AlertCircle,
    label: 'Urgent',
    gradient: 'from-rose-500 to-red-500',
    bgGradient: 'from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30',
    borderColor: 'border-rose-200 dark:border-rose-800/50',
    textColor: 'text-rose-600 dark:text-rose-400',
    shadowColor: 'shadow-rose-500/10',
    badgeClass: 'bg-gradient-to-r from-rose-500 to-red-500 text-white border-0'
  },
  high: {
    icon: Clock,
    label: 'High Priority',
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
    textColor: 'text-amber-600 dark:text-amber-400',
    shadowColor: 'shadow-amber-500/10',
    badgeClass: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0'
  },
  medium: {
    icon: Calendar,
    label: 'Medium Priority',
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
    textColor: 'text-blue-600 dark:text-blue-400',
    shadowColor: 'shadow-blue-500/10',
    badgeClass: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0'
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
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3 }
  }
};

export function UpcomingRenewals({ renewals }: UpcomingRenewalsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="h-full relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30">
                <CalendarClock className="h-4 w-4" />
              </div>
              Upcoming Renewals
            </CardTitle>
            <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-0 font-medium">
              {renewals.length} contracts
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Contracts expiring in the next 90 days
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {renewals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-fit mx-auto mb-3">
                <Calendar className="h-12 w-12 opacity-40" />
              </div>
              <p className="font-medium">No upcoming renewals</p>
              <p className="text-sm">All contracts are in good standing</p>
            </div>
          ) : (
            <>
              <motion.div 
                className="space-y-3"
                variants={listVariants}
                initial="hidden"
                animate="visible"
              >
                <AnimatePresence>
                  {renewals.map((renewal) => {
                    const config = priorityConfig[renewal.priority];
                    const Icon = config.icon;
                    
                    return (
                      <motion.div
                        key={renewal.id}
                        variants={itemVariants}
                        whileHover={{ scale: 1.01, x: 4 }}
                        className={`p-4 rounded-xl border ${config.borderColor} bg-gradient-to-r ${config.bgGradient} hover:shadow-lg ${config.shadowColor} transition-all duration-300 cursor-pointer`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${config.gradient} text-white shadow-sm`}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <Link 
                                href={`/contracts/${renewal.id}`}
                                className="font-medium text-sm truncate hover:underline hover:text-blue-600"
                              >
                                {renewal.name}
                              </Link>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 ml-8">{renewal.type}</p>
                            <div className="flex items-center gap-3 text-xs ml-8">
                              <span className="text-muted-foreground">
                                Expires: {new Date(renewal.endDate).toLocaleDateString()}
                              </span>
                              <Badge className={`${config.badgeClass} text-xs shadow-sm`}>
                                {renewal.daysUntilExpiry} days left
                              </Badge>
                            </div>
                          </div>
                          <Link 
                            href={`/contracts/${renewal.id}`}
                            className={`${config.textColor} hover:scale-110 flex-shrink-0 mt-1 transition-transform`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/60 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 rounded-xl" 
                  asChild
                >
                  <Link href="/contracts?filter=expiring">
                    View All Renewals
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </motion.div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
