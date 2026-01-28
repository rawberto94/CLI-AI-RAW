'use client'

import React, { memo, useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getTenantId } from '@/lib/tenant';
import {
  Search,
  X,
  ArrowUp,
  ArrowDown,
  FileText,
  Loader2,
} from 'lucide-react'

interface SearchResult {
  text: string
  context: string
  page?: number
  section?: string
  startIndex: number
  endIndex: number
}

interface ContractSearchProps {
  contractId: string
  onResultClick?: (result: SearchResult) => void
  className?: string
}

export const ContractSearch = memo(function ContractSearch({
  contractId,
  onResultClick,
  className,
}: ContractSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && !isOpen) {
        e.preventDefault()
        setIsOpen(true)
      }
      
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
        setResults([])
      }
      
      // Navigate results
      if (isOpen && results.length > 0) {
        if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) {
          e.preventDefault()
          setCurrentIndex(prev => (prev + 1) % results.length)
        }
        if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
          e.preventDefault()
          setCurrentIndex(prev => (prev - 1 + results.length) % results.length)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results.length])
  
  // Debounced search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([])
      return
    }
    
    setLoading(true)
    try {
      const response = await fetch(`/api/contracts/${contractId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': getTenantId() },
        body: JSON.stringify({ query: searchQuery })
      })
      
      if (!response.ok) throw new Error('Search failed')
      
      const data = await response.json()
      setResults(data.results || [])
      setCurrentIndex(0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [contractId])
  
  const handleQueryChange = (value: string) => {
    setQuery(value)
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }
  
  const handleResultClick = (result: SearchResult) => {
    onResultClick?.(result)
    // Keep search open to allow navigating between results
  }
  
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">{part}</mark>
      ) : part
    )
  }
  
  return (
    <>
      {/* Search Trigger Button */}
      {!isOpen && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className={cn("gap-2", className)}
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search contract</span>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-[10px] text-slate-600">
            ⌘F
          </kbd>
        </Button>
      )}
      
      {/* Search Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4"
          >
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Search within contract..."
                  className="border-0 p-0 h-auto text-sm focus-visible:ring-0 placeholder:text-slate-400"
                />
                {loading && <Loader2 className="h-4 w-4 text-slate-400 animate-spin shrink-0" />}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setIsOpen(false); setQuery(''); setResults([]) }}
                  className="h-7 w-7 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Results */}
              {query.trim().length >= 2 && (
                <div className="max-h-[300px] overflow-auto">
                  {results.length > 0 ? (
                    <>
                      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          {results.length} {results.length === 1 ? 'result' : 'results'}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurrentIndex(prev => (prev - 1 + results.length) % results.length)}
                            className="h-6 w-6"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-slate-500 min-w-[40px] text-center">
                            {currentIndex + 1}/{results.length}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurrentIndex(prev => (prev + 1) % results.length)}
                            className="h-6 w-6"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {results.map((result, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleResultClick(result)}
                            className={cn(
                              "w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors",
                              idx === currentIndex && "bg-violet-50"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-slate-800 line-clamp-2">
                                  {highlightMatch(result.context, query)}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {result.page && (
                                    <Badge variant="outline" className="text-[10px]">
                                      Page {result.page}
                                    </Badge>
                                  )}
                                  {result.section && (
                                    <span className="text-xs text-slate-400">{result.section}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : !loading ? (
                    <div className="px-4 py-8 text-center">
                      <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">No results found</p>
                      <p className="text-xs text-slate-400 mt-1">Try different keywords</p>
                    </div>
                  ) : null}
                </div>
              )}
              
              {/* Keyboard Hints */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">↵</kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white border rounded text-[10px]">esc</kbd>
                    close
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setIsOpen(false); setQuery(''); setResults([]) }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>
    </>
  )
})
