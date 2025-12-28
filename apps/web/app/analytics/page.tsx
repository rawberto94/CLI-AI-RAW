'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useMemo } from 'react'
import { AnalyticsHub } from '@/components/analytics/AnalyticsHub'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  FileBarChart,
  DollarSign,
  Calendar,
  Users,
  TrendingUp,
  Briefcase,
  ArrowRight,
  BarChart3,
} from 'lucide-react'
import { useRealTimeEvents } from '@/contexts/RealTimeContext'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.3 }
  }
};

export default function ImprovedAnalyticsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  // Real-time updates for analytics
  const eventHandlers = useMemo(() => ({
    'contract:completed': () => {
      setRefreshKey(prev => prev + 1); // Trigger refresh
    },
    'artifact:generated': () => {
      setRefreshKey(prev => prev + 1);
    },
    'ratecard:created': () => {
      setRefreshKey(prev => prev + 1);
    },
    'ratecard:updated': () => {
      setRefreshKey(prev => prev + 1);
    },
  }), []);

  useRealTimeEvents(eventHandlers);

  const getPageIcon = (title: string) => {
    const icons: Record<string, any> = {
      'Artifacts': FileBarChart,
      'Cost Savings': DollarSign,
      'Renewals': Calendar,
      'Suppliers': Users,
      'Negotiation': TrendingUp,
      'Procurement': Briefcase,
    };
    return icons[title] || FileBarChart;
  };

  const analyticsPages = [
    {
      title: 'Artifacts',
      description: 'Artifact extraction analytics',
      href: '/analytics/artifacts',
      gradient: 'from-blue-500 to-cyan-500',
      shadowColor: 'shadow-blue-500/20'
    },
    {
      title: 'Cost Savings',
      description: 'Savings opportunities',
      href: '/analytics/savings',
      gradient: 'from-emerald-500 to-green-500',
      shadowColor: 'shadow-emerald-500/20'
    },
    {
      title: 'Renewals',
      description: 'Contract renewals',
      href: '/analytics/renewals',
      gradient: 'from-purple-500 to-violet-500',
      shadowColor: 'shadow-purple-500/20'
    },
    {
      title: 'Suppliers',
      description: 'Supplier analytics',
      href: '/analytics/suppliers',
      gradient: 'from-orange-500 to-amber-500',
      shadowColor: 'shadow-orange-500/20'
    },
    {
      title: 'Negotiation',
      description: 'Negotiation prep',
      href: '/analytics/negotiation',
      gradient: 'from-rose-500 to-red-500',
      shadowColor: 'shadow-rose-500/20'
    },
    {
      title: 'Procurement',
      description: 'Procurement intelligence',
      href: '/analytics/procurement',
      gradient: 'from-indigo-500 to-blue-500',
      shadowColor: 'shadow-indigo-500/20'
    }
  ]

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-8">
      <PageBreadcrumb />
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-4"
      >
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl shadow-purple-500/30">
          <BarChart3 className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Analytics Hub
          </h1>
          <p className="text-muted-foreground text-lg">
            Comprehensive insights into your contract portfolio
          </p>
        </div>
      </motion.div>
      
      {/* Main Analytics Hub */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <AnalyticsHub key={refreshKey} />
      </motion.div>

      {/* Detailed Analytics Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <h3 className="text-2xl font-bold">Detailed Analytics</h3>
          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-muted-foreground">
            {analyticsPages.length} modules
          </span>
        </div>
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {analyticsPages.map((page) => {
            const PageIcon = getPageIcon(page.title);
            return (
            <motion.div key={page.href} variants={itemVariants}>
              <Link href={page.href}>
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card className={`group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl ${page.shadowColor} transition-all duration-300 cursor-pointer h-full`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-slate-100/50 dark:to-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <CardContent className="pt-6 relative">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <motion.div 
                            className={`p-3 rounded-xl bg-gradient-to-br ${page.gradient} text-white shadow-lg w-fit`}
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 300 }}
                          >
                            <PageIcon className="h-6 w-6" />
                          </motion.div>
                          <h4 className="font-semibold text-lg group-hover:text-blue-600 transition-colors">{page.title}</h4>
                          <p className="text-sm text-muted-foreground">{page.description}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </Link>
            </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  )
}
