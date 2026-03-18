'use client'

import React, { memo, Suspense, lazy, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, History, Activity } from 'lucide-react'
import { SectionErrorBoundary } from './SectionErrorBoundary'
import type { ContractNote } from '../types'

// Lazy-load heavy tab components — only fetched when the tab is first activated
const VersionManager = lazy(() =>
  import('@/components/contracts/VersionManager').then(m => ({ default: m.VersionManager }))
)
const ContractAuditLog = lazy(() =>
  import('@/components/contracts').then(m => ({ default: m.ContractAuditLog }))
)
const ActivityTab = lazy(() =>
  import('@/components/contracts/detail/ActivityTab').then(m => ({ default: m.ActivityTab }))
)

// Inline import for ContractNotes — it's small and always needed when this tab mounts
import { ContractNotes } from './ContractNotes'

function TabSkeleton({ label }: { label: string }) {
  return (
    <Card className="border-slate-200">
      <CardContent className="py-12">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading {label}...</span>
        </div>
      </CardContent>
    </Card>
  )
}

interface ActivityTabContentProps {
  contractId: string
  contractTitle: string
  notes: ContractNote[]
  currentUserId: string
  onAddNote: (content: string) => Promise<void>
  onEditNote: (id: string, content: string) => Promise<void>
  onDeleteNote: (id: string) => Promise<void>
  onPinNote: (id: string, pinned: boolean) => Promise<void>
  onVersionChange: () => void
}

export const LazyActivityTabContent = memo(function LazyActivityTabContent(props: ActivityTabContentProps) {
  return (
    <div className="space-y-4">
      <SectionErrorBoundary sectionName="Version History">
        <Suspense fallback={<TabSkeleton label="version history" />}>
          <VersionManager
            contractId={props.contractId}
            contractTitle={props.contractTitle}
            onVersionChange={props.onVersionChange}
          />
        </Suspense>
      </SectionErrorBoundary>

      <ContractNotes
        contractId={props.contractId}
        notes={props.notes}
        currentUserId={props.currentUserId}
        onAddNote={props.onAddNote}
        onEditNote={props.onEditNote}
        onDeleteNote={props.onDeleteNote}
        onPinNote={props.onPinNote}
      />

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-500" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TabSkeleton label="activity" />}>
            <ActivityTab contractId={props.contractId} />
          </Suspense>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<TabSkeleton label="audit log" />}>
            <ContractAuditLog contractId={props.contractId} maxHeight="300px" />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
})

// ============================================================================
// Lazy-load gate: only render children after the tab has been activated once
// ============================================================================

export function LazyTab({
  active,
  children,
}: {
  active: boolean
  children: React.ReactNode
}) {
  const [hasBeenActive, setHasBeenActive] = useState(active)

  useEffect(() => {
    if (active && !hasBeenActive) setHasBeenActive(true)
  }, [active, hasBeenActive])

  if (!hasBeenActive) return null
  return <>{children}</>
}
