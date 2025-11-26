'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Upload, Search, Sparkles, ArrowRight, Lightbulb, CheckCircle } from 'lucide-react';
import { Button } from './button';
import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tips?: string[];
  variant?: 'default' | 'minimal' | 'illustrated';
}

const floatAnimation = {
  initial: { y: 0 },
  animate: { 
    y: [-5, 5, -5],
    transition: { 
      duration: 4, 
      repeat: Infinity, 
      ease: "easeInOut" 
    }
  }
};

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

export function EmptyState({ 
  title, 
  description, 
  icon, 
  action, 
  tips,
  variant = 'default' 
}: EmptyStateProps) {
  if (variant === 'minimal') {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        {icon && <div className="mb-3 text-gray-400">{icon}</div>}
        <h3 className="text-base font-medium text-gray-900 mb-1">{title}</h3>
        {description && <p className="text-sm text-gray-500 mb-3 max-w-xs">{description}</p>}
        {action && <div>{action}</div>}
      </div>
    );
  }

  return (
    <motion.div 
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
      initial="initial"
      animate="animate"
    >
      {icon && (
        <motion.div 
          className="mb-6"
          variants={floatAnimation}
        >
          <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full shadow-inner">
            {icon}
          </div>
        </motion.div>
      )}
      
      <motion.h3 
        className="text-xl font-bold text-gray-900 mb-2"
        variants={fadeInUp}
      >
        {title}
      </motion.h3>
      
      {description && (
        <motion.p 
          className="text-gray-600 mb-6 max-w-md"
          variants={fadeInUp}
          transition={{ delay: 0.1 }}
        >
          {description}
        </motion.p>
      )}
      
      {tips && tips.length > 0 && (
        <motion.div 
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 max-w-md w-full"
          variants={fadeInUp}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Quick Tips</span>
          </div>
          <ul className="space-y-1">
            {tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-amber-700">
                <CheckCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
      
      {action && (
        <motion.div 
          variants={fadeInUp}
          transition={{ delay: 0.3 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}

export function NoContracts({ onUpload }: { onUpload?: () => void } = {}) {
  return (
    <EmptyState
      title="No contracts yet"
      description="Upload your first contract to unlock AI-powered analysis, risk assessment, and insights."
      icon={<FileText className="h-12 w-12 text-blue-500" />}
      tips={[
        "Supports PDF, Word, and text documents",
        "AI extracts key terms and clauses automatically",
        "Get risk scores and compliance insights"
      ]}
      action={
        <Link href="/upload">
          <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg group">
            <Upload className="h-4 w-4 mr-2" />
            Upload Your First Contract
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      }
    />
  );
}

export function NoResults({ onClearFilters }: { onClearFilters?: () => void } = {}) {
  return (
    <EmptyState
      title="No matching contracts"
      description="We couldn't find any contracts matching your search criteria."
      icon={<Search className="h-12 w-12 text-gray-400" />}
      tips={[
        "Try using fewer or different keywords",
        "Check your spelling",
        "Clear filters to see all contracts"
      ]}
      action={
        onClearFilters ? (
          <Button variant="outline" onClick={onClearFilters}>
            Clear Filters
          </Button>
        ) : null
      }
    />
  );
}

export function NoArtifacts() {
  return (
    <EmptyState
      title="Artifacts generating..."
      description="Our AI is analyzing your contract. This usually takes 30-60 seconds."
      icon={<Sparkles className="h-12 w-12 text-purple-500" />}
      variant="minimal"
    />
  );
}

export function NoContractsEmptyState({ onUpload }: { onUpload?: () => void } = {}) {
  return <NoContracts onUpload={onUpload} />;
}

export function NoFilterResultsEmptyState({ onClearFilters }: { onClearFilters?: () => void } = {}) {
  return <NoResults onClearFilters={onClearFilters} />;
}
