'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useMemo, lazy, Suspense } from 'react'
const AnalyticsHub = lazy(() => import('@/components/analytics/AnalyticsHub').then(m => ({ default: m.AnalyticsHub })));
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent } from '@/components/ui/card'
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
  FileText,
  Grid3X3,
} from 'lucide-react'
import { useRealTimeEvents } from '@/contexts/RealTimeContext'
import { useTranslations } from 'next-intl'

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

// `key` resolves to messages/{locale}.json under analytics.modules.<key>.{title,description}
const analyticsPagesConfig = [
  { key: 'documents', icon: FileText, href: '/analytics/documents', gradient: 'from-violet-500 to-violet-500', shadowColor: 'shadow-violet-500/20' },
  { key: 'artifacts', icon: FileBarChart, href: '/analytics/artifacts', gradient: 'from-violet-500 to-purple-500', shadowColor: 'shadow-violet-500/20' },
  { key: 'savings', icon: DollarSign, href: '/analytics/savings', gradient: 'from-violet-500 to-purple-500', shadowColor: 'shadow-violet-500/20' },
  { key: 'renewals', icon: Calendar, href: '/analytics/renewals', gradient: 'from-violet-500 to-purple-500', shadowColor: 'shadow-violet-500/20' },
  { key: 'suppliers', icon: Users, href: '/analytics/suppliers', gradient: 'from-orange-500 to-amber-500', shadowColor: 'shadow-orange-500/20' },
  { key: 'negotiation', icon: TrendingUp, href: '/analytics/negotiation', gradient: 'from-rose-500 to-red-500', shadowColor: 'shadow-rose-500/20' },
  { key: 'procurement', icon: Briefcase, href: '/analytics/procurement', gradient: 'from-violet-500 to-purple-500', shadowColor: 'shadow-violet-500/20' },
  { key: 'portfolio', icon: Grid3X3, href: '/analytics/portfolio', gradient: 'from-teal-500 to-emerald-500', shadowColor: 'shadow-teal-500/20' },
];

export default function ImprovedAnalyticsPage() {
  const t = useTranslations('analytics');
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

  const analyticsPages = useMemo(
    () => analyticsPagesConfig.map(({ key, ...rest }) => ({
      ...rest,
      key,
      title: t(`modules.${key}.title`),
      description: t(`modules.${key}.description`),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  return (
    <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6 space-y-6">
      <PageBreadcrumb />
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-4"
      >
        <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 text-white shadow-xl shadow-violet-500/30">
          <BarChart3 className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t('subtitle')}
          </p>
        </div>
      </motion.div>
      
      {/* Main Analytics Hub */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Suspense fallback={<div className="h-64 bg-slate-100 rounded-lg animate-pulse" />}>
          <AnalyticsHub key={refreshKey} />
        </Suspense>
      </motion.div>

      {/* Detailed Analytics Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-6">
          <h3 className="text-2xl font-bold">{t('detailedAnalytics')}</h3>
          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-muted-foreground">
            {t('modulesCount', { count: analyticsPages.length })}
          </span>
        </div>
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {analyticsPages.map((page) => {
            const PageIcon = page.icon;
            return (
            <motion.div key={page.key} variants={itemVariants}>
              <Link href={page.href}>
                <motion.div
                  whileHover={{ scale: 1.02, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card className={`group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl ${page.shadowColor} transition-all duration-300 cursor-pointer h-full`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-slate-100/50 dark:to-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <CardContent className="p-5 relative">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <motion.div 
                            className={`p-3 rounded-xl bg-gradient-to-br ${page.gradient} text-white shadow-lg w-fit`}
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 300 }}
                          >
                            <PageIcon className="h-5 w-5" />
                          </motion.div>
                          <h4 className="font-semibold text-lg group-hover:text-violet-600 transition-colors">{page.title}</h4>
                          <p className="text-sm text-muted-foreground">{page.description}</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-violet-600 group-hover:translate-x-1 transition-all" />
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
