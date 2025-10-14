'use client'

import React from 'react'
import IntelligenceDashboard from '@/components/dashboard/IntelligenceDashboard'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <IntelligenceDashboard />
      </div>
    </div>
  )
}