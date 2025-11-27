'use client'

import React from 'react'
import { SmartSearch } from '@/components/search/SmartSearch'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Zap, Target } from 'lucide-react'

import { ErrorBoundary } from "@/components/ui/error-boundary";

function SearchPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <PageBreadcrumb />
      
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Smart Search</h1>
        <p className="text-gray-500">
          AI-powered semantic search across all contracts and artifacts
        </p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium mb-1">Semantic Search</h3>
                <p className="text-sm text-gray-500">
                  Understands context and meaning
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium mb-1">Instant Results</h3>
                <p className="text-sm text-gray-500">
                  Fast, relevant search results
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Target className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-medium mb-1">Advanced Filters</h3>
                <p className="text-sm text-gray-500">
                  Refine by date, value, status
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Component */}
      <SmartSearch />
    </div>
  )
}

export default function SearchPageWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <SearchPage />
    </ErrorBoundary>
  );
}