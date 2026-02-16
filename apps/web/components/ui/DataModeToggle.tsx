'use client';

import React from 'react';
import { useDataMode } from '@/contexts/DataModeContext';
import { Database, Sparkles, ToggleLeft, ToggleRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DataModeToggleProps {
  variant?: 'compact' | 'full';
  showLabel?: boolean;
  className?: string;
}

export function DataModeToggle({ 
  variant = 'compact', 
  showLabel = true,
  className = '' 
}: DataModeToggleProps) {
  const { dataMode, setDataMode, isMockData } = useDataMode();

  const toggle = () => {
    setDataMode(isMockData ? 'real' : 'mock');
  };

  if (variant === 'compact') {
    return (
      <button
        onClick={toggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
          isMockData 
            ? 'bg-violet-100 text-violet-700 hover:bg-violet-200' 
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        } ${className}`}
        title={isMockData ? 'Using demo data - Click for real data' : 'Using real data - Click for demo data'}
      >
        <AnimatePresence mode="wait">
          {isMockData ? (
            <motion.div
              key="mock"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              {showLabel && <span className="text-xs font-medium">Demo</span>}
            </motion.div>
          ) : (
            <motion.div
              key="real"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              <Database className="w-4 h-4" />
              {showLabel && <span className="text-xs font-medium">Live</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isMockData ? 'bg-violet-100' : 'bg-violet-100'}`}>
            {isMockData ? (
              <Sparkles className="w-5 h-5 text-violet-600" />
            ) : (
              <Database className="w-5 h-5 text-violet-600" />
            )}
          </div>
          <div>
            <h4 className="font-medium text-slate-900">
              {isMockData ? 'Demo Mode' : 'Live Data'}
            </h4>
            <p className="text-xs text-slate-500">
              {isMockData 
                ? 'Showing sample data for demonstration' 
                : 'Connected to real database'}
            </p>
          </div>
        </div>
        
        <button
          onClick={toggle}
          className="relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
          style={{ backgroundColor: isMockData ? '#8b5cf6' : '#cbd5e1' }}
        >
          <motion.div
            className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md"
            animate={{ x: isMockData ? 28 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>
      
      {isMockData && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 pt-3 border-t border-slate-100"
        >
          <div className="flex items-center gap-2 text-xs text-violet-600 bg-violet-50 px-3 py-2 rounded-lg">
            <Sparkles className="w-3 h-3" />
            <span>All modules populated with rich demo data for showcasing</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Floating toggle for quick access
export function FloatingDataModeToggle() {
  const { isMockData, setDataMode } = useDataMode();

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setDataMode(isMockData ? 'real' : 'mock')}
      className={`fixed bottom-20 right-6 z-40 p-3 rounded-full shadow-lg transition-colors ${
        isMockData 
          ? 'bg-violet-500 text-white hover:bg-violet-600' 
          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
      }`}
      title={isMockData ? 'Demo Mode - Click for Live Data' : 'Live Data - Click for Demo Mode'}
    >
      {isMockData ? (
        <Sparkles className="w-5 h-5" />
      ) : (
        <Database className="w-5 h-5" />
      )}
    </motion.button>
  );
}

export default DataModeToggle;
