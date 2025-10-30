/**
 * UX Demo Page
 * Demonstrates all user experience improvements working together
 */

'use client';

import React from 'react';
import { FeedbackProvider } from '@/components/feedback/FeedbackSystem';
import { GlobalKeyboardShortcuts } from '@/components/keyboard/GlobalKeyboardShortcuts';
import { SkipLinks } from '@/components/accessibility/AccessibleComponents';
import { ResponsiveContainer } from '@/components/layout/ResponsiveLayout';

// Import all example components
import { ButtonLoadingExample, PageLoadingExample, SkeletonExample, OperationProgressExample, MultiOperationExample, OverlayLoadingExample } from '@/components/ui/loading-examples';
import { FeedbackExamples } from '@/components/feedback/FeedbackExamples';
import { KeyboardShortcutsExample } from '@/components/keyboard/KeyboardShortcutsExample';
import { ResponsiveExamples } from '@/components/layout/ResponsiveExamples';
import { AccessibilityExamples } from '@/components/accessibility/AccessibilityExamples';

export default function UXDemoPage() {
  const [activeTab, setActiveTab] = React.useState<'loading' | 'feedback' | 'keyboard' | 'responsive' | 'accessibility'>('loading');

  return (
    <FeedbackProvider>
      <GlobalKeyboardShortcuts>
        <div className="min-h-screen bg-gray-50">
          <SkipLinks />

          {/* Header */}
          <header className="bg-white border-b shadow-sm sticky top-0 z-40">
            <ResponsiveContainer>
              <div className="py-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  User Experience Demo
                </h1>
                <p className="text-gray-600">
                  Comprehensive demonstration of all UX improvements
                </p>
              </div>

              {/* Tab Navigation */}
              <nav className="flex gap-2 overflow-x-auto pb-4" role="tablist">
                <TabButton
                  active={activeTab === 'loading'}
                  onClick={() => setActiveTab('loading')}
                >
                  Loading States
                </TabButton>
                <TabButton
                  active={activeTab === 'feedback'}
                  onClick={() => setActiveTab('feedback')}
                >
                  User Feedback
                </TabButton>
                <TabButton
                  active={activeTab === 'keyboard'}
                  onClick={() => setActiveTab('keyboard')}
                >
                  Keyboard Shortcuts
                </TabButton>
                <TabButton
                  active={activeTab === 'responsive'}
                  onClick={() => setActiveTab('responsive')}
                >
                  Responsive Design
                </TabButton>
                <TabButton
                  active={activeTab === 'accessibility'}
                  onClick={() => setActiveTab('accessibility')}
                >
                  Accessibility
                </TabButton>
              </nav>
            </ResponsiveContainer>
          </header>

          {/* Main Content */}
          <main id="main-content" className="py-8">
            <ResponsiveContainer>
              {activeTab === 'loading' && (
                <div className="space-y-8">
                  <Section title="Button Loading States">
                    <ButtonLoadingExample />
                  </Section>

                  <Section title="Page Loading with Progress">
                    <PageLoadingExample />
                  </Section>

                  <Section title="Skeleton Screens">
                    <SkeletonExample />
                  </Section>

                  <Section title="Operation Progress">
                    <OperationProgressExample />
                  </Section>

                  <Section title="Multi-Operation Loading">
                    <MultiOperationExample />
                  </Section>

                  <Section title="Overlay Loading">
                    <OverlayLoadingExample />
                  </Section>
                </div>
              )}

              {activeTab === 'feedback' && <FeedbackExamples />}
              {activeTab === 'keyboard' && <KeyboardShortcutsExample />}
              {activeTab === 'responsive' && <ResponsiveExamples />}
              {activeTab === 'accessibility' && <AccessibilityExamples />}
            </ResponsiveContainer>
          </main>

          {/* Footer */}
          <footer className="bg-white border-t mt-16">
            <ResponsiveContainer>
              <div className="py-8 text-center text-gray-600">
                <p className="mb-2">
                  Press <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">?</kbd> to see all keyboard shortcuts
                </p>
                <p className="text-sm">
                  All features are WCAG 2.1 Level AA compliant and fully responsive
                </p>
              </div>
            </ResponsiveContainer>
          </footer>
        </div>
      </GlobalKeyboardShortcuts>
    </FeedbackProvider>
  );
}

// Helper Components
function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean; 
  onClick: () => void; 
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`
        px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${active 
          ? 'bg-blue-600 text-white' 
          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
        }
      `}
    >
      {children}
    </button>
  );
}

function Section({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg p-6 shadow-sm">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}
