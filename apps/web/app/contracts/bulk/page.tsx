'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Layers, ArrowLeft, Sparkles, Zap, FileStack, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { BulkOperations } from '@/components/contracts/BulkOperations'

export default function BulkOperationsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-amber-50/20">
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-600 shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))]" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-yellow-500/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-6xl mx-auto px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <Link href="/contracts">
                <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/20">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="h-8 w-px bg-white/20" />
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg">
                <Layers className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Bulk Operations</h1>
                <p className="text-orange-100 mt-1">Process multiple contracts at once with AI-powered automation</p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-3">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-4 py-2">
                <Zap className="w-4 h-4 mr-2" />
                Batch Processing
              </Badge>
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-4 py-2">
                <Sparkles className="w-4 h-4 mr-2" />
                AI-Powered
              </Badge>
            </div>
          </motion.div>
          
          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <FileStack className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-sm">Multi-select</p>
                  <p className="text-white font-bold">Unlimited</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-sm">Processing</p>
                  <p className="text-white font-bold">Parallel</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-sm">AI Analysis</p>
                  <p className="text-white font-bold">Enabled</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Settings2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-sm">Operations</p>
                  <p className="text-white font-bold">6 Types</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="max-w-6xl mx-auto px-6 py-8"
      >
        <BulkOperations />
      </motion.div>
    </div>
  )
}
