/**
 * Workflow Skeleton Loading States
 * Provides visual feedback while workflow components are loading
 */

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSkeletonClasses } from '@/lib/workflow-ui-enhancements';

// ============================================================================
// Workflow Canvas Skeleton
// ============================================================================

export function WorkflowCanvasSkeleton() {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={cn(getSkeletonClasses('base'), 'h-10 w-10 rounded-lg')}
              />
            ))}
          </div>
          <div className={cn(getSkeletonClasses('base'), 'h-10 w-24')} />
        </div>

        {/* Canvas skeleton */}
        <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/50 h-[600px] p-8">
          {/* Node skeletons */}
          <div className="absolute top-12 left-12">
            <WorkflowNodeSkeleton />
          </div>
          <div className="absolute top-12 right-12">
            <WorkflowNodeSkeleton />
          </div>
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
            <WorkflowNodeSkeleton />
          </div>

          {/* Connection lines skeleton */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
            <line
              x1="20%"
              y1="15%"
              x2="80%"
              y2="15%"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="8 8"
              className="text-slate-400 dark:text-slate-600"
            />
            <line
              x1="20%"
              y1="15%"
              x2="50%"
              y2="85%"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="8 8"
              className="text-slate-400 dark:text-slate-600"
            />
          </svg>

          {/* Loading overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground">Loading workflow...</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function WorkflowNodeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn(getSkeletonClasses('base'), 'h-16 w-32 rounded-lg')} />
      <div className={cn(getSkeletonClasses('base'), 'h-4 w-24')} />
    </div>
  );
}

// ============================================================================
// Step Config Editor Skeleton
// ============================================================================

export function StepConfigEditorSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Tabs skeleton */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(getSkeletonClasses('base'), 'h-10 w-24 rounded-t-lg')}
          />
        ))}
      </div>

      {/* Form fields skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-2">
            <div className={cn(getSkeletonClasses('base'), 'h-5 w-32')} />
            <div className={cn(getSkeletonClasses('base'), 'h-10 w-full rounded-md')} />
          </div>
        ))}
      </div>

      {/* Action buttons skeleton */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className={cn(getSkeletonClasses('base'), 'h-10 w-24 rounded-md')} />
        <div className={cn(getSkeletonClasses('base'), 'h-10 w-32 rounded-md')} />
      </div>
    </div>
  );
}

// ============================================================================
// Workflow Templates Gallery Skeleton
// ============================================================================

export function WorkflowTemplatesGallerySkeleton() {
  return (
    <div className="space-y-6">
      {/* Search and filters skeleton */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className={cn(getSkeletonClasses('base'), 'h-10 flex-1 rounded-lg')} />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(getSkeletonClasses('base'), 'h-10 w-24 rounded-lg')}
            />
          ))}
        </div>
      </div>

      {/* Template cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <WorkflowTemplateCardSkeleton key={i} delay={i * 50} />
        ))}
      </div>
    </div>
  );
}

function WorkflowTemplateCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card
      className="animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className={cn(getSkeletonClasses('base'), 'h-12 w-12 rounded-xl')} />
          <div className="flex-1 space-y-2">
            <div className={cn(getSkeletonClasses('heading'))} />
            <div className={cn(getSkeletonClasses('text'), 'w-full')} />
            <div className={cn(getSkeletonClasses('text'), 'w-2/3')} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step flow skeleton */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <div className={cn(getSkeletonClasses('base'), 'h-8 w-16 rounded')} />
              {i < 3 && (
                <div className={cn(getSkeletonClasses('base'), 'h-0.5 w-4')} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Metadata skeleton */}
        <div className="flex items-center justify-between">
          <div className={cn(getSkeletonClasses('base'), 'h-6 w-20 rounded-full')} />
          <div className={cn(getSkeletonClasses('base'), 'h-6 w-16 rounded-full')} />
        </div>

        {/* Action button skeleton */}
        <div className={cn(getSkeletonClasses('base'), 'h-10 w-full rounded-lg')} />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Workflow Execution Timeline Skeleton
// ============================================================================

export function WorkflowExecutionTimelineSkeleton() {
  return (
    <Card className="p-6 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className={cn(getSkeletonClasses('heading'))} />
        <div className={cn(getSkeletonClasses('text'), 'w-1/2')} />
      </div>

      {/* Progress bar skeleton */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <div className={cn(getSkeletonClasses('text'), 'w-24')} />
          <div className={cn(getSkeletonClasses('text'), 'w-16')} />
        </div>
        <div className={cn(getSkeletonClasses('base'), 'h-2 w-full rounded-full')} />
      </div>

      {/* Timeline steps skeleton */}
      <div className="relative space-y-8">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

        {[1, 2, 3, 4].map((i) => (
          <WorkflowTimelineStepSkeleton key={i} delay={i * 100} />
        ))}
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className={cn(getSkeletonClasses('text'), 'w-16')} />
            <div className={cn(getSkeletonClasses('base'), 'h-8 w-24')} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function WorkflowTimelineStepSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="flex gap-6 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Node skeleton */}
      <div className="relative z-10">
        <div className={cn(getSkeletonClasses('base'), 'h-12 w-12 rounded-full')} />
      </div>

      {/* Content skeleton */}
      <div className="flex-1 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className={cn(getSkeletonClasses('text'), 'w-32')} />
            <div className={cn(getSkeletonClasses('text'), 'w-24')} />
          </div>
          <div className={cn(getSkeletonClasses('base'), 'h-6 w-20 rounded-full')} />
        </div>

        <div className={cn(getSkeletonClasses('base'), 'h-16 w-full rounded-lg')} />
      </div>
    </div>
  );
}

// ============================================================================
// Conditional Routing Panel Skeleton
// ============================================================================

export function ConditionalRoutingPanelSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={cn(getSkeletonClasses('heading'), 'w-48')} />
          <div className={cn(getSkeletonClasses('text'), 'w-64')} />
        </div>
        <div className={cn(getSkeletonClasses('base'), 'h-10 w-32 rounded-lg')} />
      </div>

      {/* Routing rules skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-start gap-4">
              {/* Priority handle skeleton */}
              <div className={cn(getSkeletonClasses('base'), 'h-6 w-6 rounded')} />

              {/* Rule content skeleton */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className={cn(getSkeletonClasses('text'), 'w-32')} />
                  <div className={cn(getSkeletonClasses('base'), 'h-6 w-16 rounded-full')} />
                </div>

                {/* Conditions skeleton */}
                <div className="space-y-2">
                  {[1, 2].map((j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className={cn(getSkeletonClasses('base'), 'h-8 w-24 rounded')} />
                      <div className={cn(getSkeletonClasses('base'), 'h-8 w-20 rounded')} />
                      <div className={cn(getSkeletonClasses('base'), 'h-8 flex-1 rounded')} />
                    </div>
                  ))}
                </div>

                {/* Target step skeleton */}
                <div className="flex items-center gap-2">
                  <div className={cn(getSkeletonClasses('text'), 'w-20')} />
                  <div className={cn(getSkeletonClasses('base'), 'h-8 w-32 rounded')} />
                </div>
              </div>

              {/* Action buttons skeleton */}
              <div className="flex gap-2">
                <div className={cn(getSkeletonClasses('base'), 'h-8 w-8 rounded')} />
                <div className={cn(getSkeletonClasses('base'), 'h-8 w-8 rounded')} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Default route skeleton */}
      <Card className="p-4 border-dashed">
        <div className="flex items-center gap-4">
          <div className={cn(getSkeletonClasses('text'), 'w-32')} />
          <div className={cn(getSkeletonClasses('base'), 'h-8 flex-1 rounded')} />
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// General Workflow List Skeleton
// ============================================================================

export function WorkflowListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 animate-pulse" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className={cn(getSkeletonClasses('base'), 'h-10 w-10 rounded-lg')} />
              <div className="space-y-2 flex-1">
                <div className={cn(getSkeletonClasses('heading'), 'w-48')} />
                <div className={cn(getSkeletonClasses('text'), 'w-full max-w-md')} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={cn(getSkeletonClasses('base'), 'h-6 w-20 rounded-full')} />
              <div className={cn(getSkeletonClasses('base'), 'h-8 w-8 rounded')} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
