'use client'

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardLayout } from '@/components/layout/AppLayout'
import { ProfessionalDashboard } from '@/components/dashboard/ProfessionalDashboard'
import { LazyEnhancedDashboard as EnhancedDashboard } from '@/components/lazy'
import { TrendingUp, Brain } from 'lucide-react'

export default function DashboardPage() {
  return (
    <DashboardLayout
      title="Dashboard"
      description="Portfolio intelligence and analytics"
    >
      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="intelligence" className="space-y-4">
          <TabsList
            aria-label="Dashboard sections"
            className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex"
          >
            <TabsTrigger value="intelligence" className="gap-2">
              <Brain className="h-4 w-4" />
              <span className="truncate">Intelligence</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="truncate">Analytics</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="intelligence" className="mt-4">
            <ProfessionalDashboard />
          </TabsContent>
          
          <TabsContent value="analytics" className="mt-4">
            <EnhancedDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}