'use client'

import React from 'react'
import { DeadlineDashboard } from '@/components/contracts/DeadlineDashboard'

export default function DeadlinesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-purple-50/30 p-6">
      <div className="max-w-[1600px] mx-auto">
        <DeadlineDashboard />
      </div>
    </div>
  )
}
