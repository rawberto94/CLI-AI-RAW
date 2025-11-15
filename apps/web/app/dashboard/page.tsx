'use client'

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import IntelligenceDashboard from '@/components/dashboard/IntelligenceDashboard'
import { LazyEnhancedDashboard as EnhancedDashboard } from '@/components/lazy'
import { BarChart3, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="bg-white border border-gray-200 p-1">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics Dashboard
            </TabsTrigger>
            <TabsTrigger value="intelligence" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Intelligence Dashboard
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="analytics" className="mt-6">
            <EnhancedDashboard />
          </TabsContent>
          
          <TabsContent value="intelligence" className="mt-6">
            <IntelligenceDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}