'use client'

import React from 'react'
import WorkflowAutomation from '@/components/automation/WorkflowAutomation'
import { Zap } from 'lucide-react'

export default function AutomationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Workflow Automation</h1>
              <p className="text-gray-600">
                Automate your contract intelligence processes with AI-powered workflows
              </p>
            </div>
          </div>
        </div>

        <WorkflowAutomation />
      </div>
    </div>
  )
}