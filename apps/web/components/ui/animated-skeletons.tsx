'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from './card';
import { cn } from '@/lib/utils';

interface AnimatedSkeletonProps {
  className?: string;
}

export function AnimatedSkeleton({ className }: AnimatedSkeletonProps) {
  return (
    <motion.div
      className={cn(
        "bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg",
        className
      )}
      animate={{
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      style={{
        backgroundSize: "200% 100%",
      }}
    />
  );
}

interface ContractCardSkeletonProps {
  index?: number;
}

export function ContractCardSkeleton({ index = 0 }: ContractCardSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <AnimatedSkeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <AnimatedSkeleton className="h-5 w-48" />
                  <AnimatedSkeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1">
                    <AnimatedSkeleton className="h-3 w-16" />
                    <AnimatedSkeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
            <AnimatedSkeleton className="h-9 w-20 rounded-md" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ContractsListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3, 4].map((index) => (
        <ContractCardSkeleton key={index} index={index} />
      ))}
    </div>
  );
}

export function StatsCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <AnimatedSkeleton className="h-4 w-24" />
              <AnimatedSkeleton className="h-8 w-16" />
            </div>
            <AnimatedSkeleton className="h-12 w-12 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <AnimatedSkeleton className="h-8 w-64" />
          <AnimatedSkeleton className="h-4 w-96" />
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((index) => (
            <StatsCardSkeleton key={index} index={index} />
          ))}
        </div>
        
        {/* Search */}
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6">
            <AnimatedSkeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        
        {/* List */}
        <ContractsListSkeleton />
      </div>
    </div>
  );
}

export function ContractDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button & Title */}
        <div className="flex items-center gap-4">
          <AnimatedSkeleton className="h-10 w-24" />
          <div className="space-y-2 flex-1">
            <AnimatedSkeleton className="h-8 w-96" />
            <div className="flex gap-2">
              <AnimatedSkeleton className="h-6 w-24" />
              <AnimatedSkeleton className="h-6 w-32" />
            </div>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map((index) => (
            <StatsCardSkeleton key={index} index={index} />
          ))}
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <AnimatedSkeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between">
                    <AnimatedSkeleton className="h-4 w-32" />
                    <AnimatedSkeleton className="h-4 w-48" />
                  </div>
                ))}
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <AnimatedSkeleton className="h-6 w-56" />
              </CardHeader>
              <CardContent>
                <AnimatedSkeleton className="h-64 w-full rounded-xl" />
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <AnimatedSkeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <AnimatedSkeleton key={i} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArtifactViewerSkeleton() {
  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <AnimatedSkeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      
      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-0 shadow-md">
            <CardContent className="pt-6 space-y-3">
              <AnimatedSkeleton className="h-5 w-32" />
              <AnimatedSkeleton className="h-4 w-full" />
              <AnimatedSkeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
