'use client'

/**
 * AI Draft Page
 * 
 * A dedicated page for AI-assisted contract drafting.
 * Uses the AIDraftAssistant component for conversational contract creation.
 */

import React from 'react'
import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with the chat component
const AIDraftAssistant = dynamic(
  () => import('@/components/contracts/AIDraftAssistant'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <p className="text-slate-600">Loading AI Assistant...</p>
        </div>
      </div>
    )
  }
)

export default function AIDraftPage() {
  return <AIDraftAssistant />
}
