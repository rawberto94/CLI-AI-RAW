'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardLayout } from '@/components/layout/AppLayout'
import { ProfessionalDashboard } from '@/components/dashboard/ProfessionalDashboard'
import { LazyEnhancedDashboard as EnhancedDashboard } from '@/components/lazy'
import { TrendingUp, Brain, Sparkles, LayoutDashboard } from 'lucide-react'
import { Breadcrumbs } from '@/components/breadcrumbs'

export default function DashboardPage() {
  const breadcrumbItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
  ];

  return (
    <DashboardLayout
      title="Dashboard"
      description="Portfolio intelligence and analytics"
    >
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumbs */}
        <div className="mb-4">
          <Breadcrumbs items={breadcrumbItems} showHomeIcon />
        </div>

        {/* Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg shadow-indigo-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                Contract Intelligence Hub
              </h1>
              <p className="text-sm text-slate-500">Real-time insights across your entire portfolio</p>
            </div>
          </div>
        </motion.div>

        <Tabs defaultValue="intelligence" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <TabsList
              aria-label="Dashboard sections"
              className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex p-1.5 bg-slate-100/80 backdrop-blur-sm rounded-xl shadow-sm border border-slate-200/60"
            >
              <TabsTrigger 
                value="intelligence" 
                className="gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/50 transition-all duration-200"
              >
                <Brain className="h-4 w-4" />
                <span className="truncate font-medium">Intelligence</span>
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="gap-2 px-5 py-2.5 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:shadow-slate-200/50 transition-all duration-200"
              >
                <TrendingUp className="h-4 w-4" />
                <span className="truncate font-medium">Analytics</span>
              </TabsTrigger>
            </TabsList>
          </motion.div>
          
          <TabsContent value="intelligence" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <ProfessionalDashboard />
            </motion.div>
          </TabsContent>
          
          <TabsContent value="analytics" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <EnhancedDashboard />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}