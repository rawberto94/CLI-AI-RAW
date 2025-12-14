'use client'

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardLayout } from '@/components/layout/AppLayout'
import { ProfessionalDashboard } from '@/components/dashboard/ProfessionalDashboard'
import { LazyEnhancedDashboard as EnhancedDashboard } from '@/components/lazy'
import { BarChart3, TrendingUp, Brain } from 'lucide-react'

export default function DashboardPage() {
  return (
    <DashboardLayout
      title="Dashboard"
      description="Portfolio intelligence and analytics"
    >
      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="intelligence" className="space-y-6">
          <TabsList className="bg-slate-100 border-0 p-1 rounded-lg">
            <TabsTrigger value="intelligence" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Brain className="h-4 w-4" />
              Intelligence Dashboard
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="intelligence" className="mt-6">
            <ProfessionalDashboard />
          </TabsContent>
          
          <TabsContent value="analytics" className="mt-6">
            <EnhancedDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}