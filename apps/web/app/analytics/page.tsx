'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useMemo } from 'react'
import { AnalyticsHub } from '@/components/analytics/AnalyticsHub'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  FileBarChart,
  DollarSign,
  Calendar,
  Users,
  TrendingUp,
  Briefcase,
  ArrowRight
} from 'lucide-react'
import { useRealTimeEvents } from '@/contexts/RealTimeContext'

export default function ImprovedAnalyticsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  // Real-time updates for analytics
  const eventHandlers = useMemo(() => ({
    'contract:completed': (data: any) => {
      console.log('[Analytics] Contract completed, refreshing analytics:', data);
      setRefreshKey(prev => prev + 1); // Trigger refresh
    },
    'artifact:generated': (data: any) => {
      console.log('[Analytics] Artifact generated, refreshing analytics:', data);
      setRefreshKey(prev => prev + 1);
    },
    'ratecard:created': (data: any) => {
      console.log('[Analytics] Rate card created, refreshing analytics:', data);
      setRefreshKey(prev => prev + 1);
    },
    'ratecard:updated': (data: any) => {
      console.log('[Analytics] Rate card updated, refreshing analytics:', data);
      setRefreshKey(prev => prev + 1);
    },
  }), []);

  useRealTimeEvents(eventHandlers);

  const analyticsPages = [
    {
      title: 'Artifacts',
      description: 'Artifact extraction analytics',
      href: '/analytics/artifacts',
      icon: FileBarChart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Cost Savings',
      description: 'Savings opportunities',
      href: '/analytics/savings',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Renewals',
      description: 'Contract renewals',
      href: '/analytics/renewals',
      icon: Calendar,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Suppliers',
      description: 'Supplier analytics',
      href: '/analytics/suppliers',
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Negotiation',
      description: 'Negotiation prep',
      href: '/analytics/negotiation',
      icon: TrendingUp,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Procurement',
      description: 'Procurement intelligence',
      href: '/analytics/procurement',
      icon: Briefcase,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ]

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-8">
      <PageBreadcrumb />
      
      {/* Main Analytics Hub */}
      <AnalyticsHub key={refreshKey} />

      {/* Detailed Analytics Links */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Detailed Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyticsPages.map((page) => (
            <Link key={page.href} href={page.href}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className={`p-3 ${page.bgColor} rounded-lg w-fit`}>
                        <page.icon className={`h-6 w-6 ${page.color}`} />
                      </div>
                      <h4 className="font-semibold text-lg">{page.title}</h4>
                      <p className="text-sm text-gray-500">{page.description}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
