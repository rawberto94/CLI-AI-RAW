'use client'

import UseCasesSection from '@/components/pilot-demo/UseCasesSection'

export default function PilotDemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Pilot Demo</h1>
          <p className="text-muted-foreground text-lg">
            Explore AI-powered contract intelligence use cases
          </p>
        </div>
        <UseCasesSection />
      </div>
    </div>
  )
}
