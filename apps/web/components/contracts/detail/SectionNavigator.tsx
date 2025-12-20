'use client';

import React, { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp,
  ChevronDown,
  List,
  X,
  FileText,
  Users,
  Calendar,
  AlertTriangle,
  Brain,
  DollarSign,
  Shield,
  Clock,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Section {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface SectionNavigatorProps {
  activeTab: string;
  className?: string;
}

// Define sections for each tab
const TAB_SECTIONS: Record<string, Section[]> = {
  overview: [
    { id: 'executive-summary', label: 'Executive Summary', icon: FileText },
    { id: 'parties', label: 'Contract Parties', icon: Users },
    { id: 'dates', label: 'Key Dates', icon: Calendar },
    { id: 'risks', label: 'Key Risks', icon: AlertTriangle },
    { id: 'ai-analysis', label: 'AI Analysis', icon: Brain },
  ],
  details: [
    { id: 'metadata', label: 'Contract Metadata', icon: FileText },
    { id: 'financial', label: 'Financial Terms', icon: DollarSign },
    { id: 'hierarchy', label: 'Contract Hierarchy', icon: List },
    { id: 'compliance', label: 'Compliance Checks', icon: Shield },
  ],
  activity: [
    { id: 'reminders', label: 'Reminders', icon: Clock },
    { id: 'recent-activity', label: 'Recent Activity', icon: History },
    { id: 'audit-log', label: 'Audit Log', icon: History },
  ],
};

export const SectionNavigator = memo(function SectionNavigator({
  activeTab,
  className = '',
}: SectionNavigatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const sections = TAB_SECTIONS[activeTab] || [];

  // Track scroll position and active section
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);

      // Find active section based on scroll position
      const sectionElements = sections
        .map(s => document.getElementById(s.id))
        .filter(Boolean);

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const el = sectionElements[i];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 150) {
            setActiveSection(sections[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100; // Account for sticky header
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
      setIsOpen(false);
    }
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }, []);

  if (sections.length === 0) return null;

  return (
    <div className={cn("fixed right-4 top-1/2 -translate-y-1/2 z-40", className)}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-12 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 min-w-[180px]"
          >
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 py-2">
              On this page
            </div>
            <div className="space-y-0.5">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors",
                      isActive
                        ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{section.label}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="w-1.5 h-1.5 rounded-full bg-violet-500 ml-auto"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigator Button Group */}
      <div className="flex flex-col items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5">
        {/* Scroll to Top */}
        <Button
          size="sm"
          variant="ghost"
          onClick={scrollToTop}
          className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>

        {/* Progress Indicator */}
        <div className="relative w-8 h-16 flex items-center justify-center">
          {/* Track */}
          <div className="absolute inset-x-3 top-1 bottom-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-violet-500 to-purple-500 rounded-full"
              animate={{ height: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          
          {/* Toggle Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "relative h-8 w-8 p-0 rounded-lg transition-colors z-10",
              isOpen
                ? "bg-violet-100 dark:bg-violet-900/50 text-violet-600"
                : "hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            {isOpen ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
        </div>

        {/* Scroll to Bottom */}
        <Button
          size="sm"
          variant="ghost"
          onClick={scrollToBottom}
          className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

export default SectionNavigator;
