'use client'

import React from 'react'
import { SmartSearch } from '@/components/search/SmartSearch'
import { PageBreadcrumb } from '@/components/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { Sparkles, Zap, Target, Search } from 'lucide-react'

import { ErrorBoundary } from "@/components/ui/error-boundary";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4 }
  }
};

function SearchPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <PageBreadcrumb />
      
      {/* Header */}
      <motion.div 
        className="space-y-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-violet-600 text-white shadow-xl shadow-violet-500/30">
            <Search className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600 bg-clip-text text-transparent">
              Smart Search
            </h1>
            <p className="text-muted-foreground text-lg mt-1">
              AI-powered semantic search across all contracts and artifacts
            </p>
          </div>
        </div>
      </motion.div>

      {/* Features */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="p-5 relative">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Semantic Search</h3>
                  <p className="text-sm text-muted-foreground">
                    Understands context and meaning
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="p-5 relative">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Instant Results</h3>
                  <p className="text-sm text-muted-foreground">
                    Fast, relevant search results
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="group relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-white/50 dark:border-slate-700/50 shadow-xl hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardContent className="p-5 relative">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Advanced Filters</h3>
                  <p className="text-sm text-muted-foreground">
                    Refine by date, value, status
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Search Component */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <SmartSearch />
      </motion.div>
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