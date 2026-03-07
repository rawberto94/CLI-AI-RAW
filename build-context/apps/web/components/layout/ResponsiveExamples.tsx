/**
 * Responsive Design Examples
 * Demonstrates responsive components and patterns
 */

'use client';

import React from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveStack,
  ResponsiveShow,
  ResponsiveHide,
  ResponsiveTable,
  ResponsiveNav,
} from './ResponsiveLayout';
import { useResponsive, useIsMobile, useIsTablet } from '@/hooks/useResponsive';
import { Home, FileText, BarChart, Settings, User } from 'lucide-react';

export function ResponsiveExamples() {
  const responsive = useResponsive();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Responsive Navigation Example */}
      <ResponsiveNav
        logo={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-600 rounded-lg" />
            <span className="font-bold text-xl">Logo</span>
          </div>
        }
        desktopNav={
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-gray-700 hover:text-violet-600">
              <Home className="w-4 h-4" />
              Home
            </Link>
            <Link href="/contracts" className="flex items-center gap-2 text-gray-700 hover:text-violet-600">
              <FileText className="w-4 h-4" />
              Contracts
            </Link>
            <Link href="/analytics" className="flex items-center gap-2 text-gray-700 hover:text-violet-600">
              <BarChart className="w-4 h-4" />
              Analytics
            </Link>
            <Link href="/settings" className="flex items-center gap-2 text-gray-700 hover:text-violet-600">
              <Settings className="w-4 h-4" />
              Settings
            </Link>
          </div>
        }
        mobileNav={
          <div className="space-y-2">
            <Link href="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100">
              <Home className="w-5 h-5" />
              <span>Home</span>
            </Link>
            <Link href="/contracts" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100">
              <FileText className="w-5 h-5" />
              <span>Contracts</span>
            </Link>
            <Link href="/analytics" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100">
              <BarChart className="w-5 h-5" />
              <span>Analytics</span>
            </Link>
            <Link href="/settings" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100">
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </Link>
          </div>
        }
      />

      <ResponsiveContainer className="py-8">
        {/* Device Info */}
        <div className="bg-white rounded-lg p-6 mb-8 shadow-sm">
          <h2 className="text-2xl font-bold mb-4">Current Device Info</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCard label="Breakpoint" value={responsive.breakpoint} />
            <InfoCard label="Width" value={`${responsive.width}px`} />
            <InfoCard label="Height" value={`${responsive.height}px`} />
            <InfoCard label="Orientation" value={responsive.orientation} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {responsive.isMobile && <Badge color="blue">Mobile</Badge>}
            {responsive.isTablet && <Badge color="green">Tablet</Badge>}
            {responsive.isDesktop && <Badge color="purple">Desktop</Badge>}
            {responsive.isLargeDesktop && <Badge color="orange">Large Desktop</Badge>}
          </div>
        </div>

        {/* Responsive Grid Example */}
        <section className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Responsive Grid</h3>
          <ResponsiveGrid
            cols={{ xs: 1, sm: 2, md: 3, lg: 4 }}
            gap={4}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm border">
                <div className="w-12 h-12 bg-violet-100 rounded-lg mb-3" />
                <h4 className="font-semibold mb-2">Card {i + 1}</h4>
                <p className="text-sm text-gray-600">
                  This grid adapts to different screen sizes
                </p>
              </div>
            ))}
          </ResponsiveGrid>
        </section>

        {/* Responsive Stack Example */}
        <section className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Responsive Stack</h3>
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <ResponsiveStack direction="horizontal" breakpoint="md" gap={4}>
              <div className="flex-1 p-4 bg-violet-50 rounded-lg">
                <h4 className="font-semibold mb-2">Section 1</h4>
                <p className="text-sm text-gray-600">
                  Stacks vertically on mobile, horizontally on desktop
                </p>
              </div>
              <div className="flex-1 p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold mb-2">Section 2</h4>
                <p className="text-sm text-gray-600">
                  Responsive layout without media queries
                </p>
              </div>
              <div className="flex-1 p-4 bg-violet-50 rounded-lg">
                <h4 className="font-semibold mb-2">Section 3</h4>
                <p className="text-sm text-gray-600">
                  Automatically adjusts based on screen size
                </p>
              </div>
            </ResponsiveStack>
          </div>
        </section>

        {/* Show/Hide Example */}
        <section className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Conditional Rendering</h3>
          <div className="space-y-4">
            <ResponsiveShow on="mobile">
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                <p className="text-violet-900 font-medium">
                  📱 This content is only visible on mobile devices
                </p>
              </div>
            </ResponsiveShow>

            <ResponsiveShow on="tablet">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-900 font-medium">
                  📱 This content is only visible on tablets
                </p>
              </div>
            </ResponsiveShow>

            <ResponsiveShow on="desktop">
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                <p className="text-violet-900 font-medium">
                  🖥️ This content is only visible on desktop
                </p>
              </div>
            </ResponsiveShow>
          </div>
        </section>

        {/* Responsive Table Example */}
        <section className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Responsive Table</h3>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <ResponsiveTable
              headers={['Name', 'Email', 'Role', 'Status']}
              rows={[
                ['Roberto Ostojic', 'roberto@example.com', 'Admin', 'Active'],
                ['Jane Smith', 'jane@example.com', 'User', 'Active'],
                ['Bob Johnson', 'bob@example.com', 'User', 'Inactive'],
              ]}
              mobileCardRenderer={(row, index) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{row[0]}</span>
                    <Badge color={row[3] === 'Active' ? 'green' : 'gray'}>
                      {row[3]}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{row[1]}</p>
                  <p className="text-sm text-gray-500">{row[2]}</p>
                </div>
              )}
            />
          </div>
        </section>

        {/* Responsive Typography */}
        <section className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Responsive Typography</h3>
          <div className="bg-white rounded-lg p-6 shadow-sm space-y-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">
              Responsive Heading
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-gray-600">
              This text scales appropriately across different screen sizes for optimal readability.
            </p>
          </div>
        </section>

        {/* Responsive Spacing */}
        <section className="mb-8">
          <h3 className="text-xl font-semibold mb-4">Responsive Spacing</h3>
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 sm:p-6 md:p-8 lg:p-10">
              <p className="text-gray-600">
                The padding of this container increases as the screen size grows:
                <br />
                Mobile: 1rem, Tablet: 1.5rem, Desktop: 2rem, Large: 2.5rem
              </p>
            </div>
          </div>
        </section>
      </ResponsiveContainer>
    </div>
  );
}

// Helper Components
function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  const colors = {
    blue: 'bg-violet-100 text-violet-800',
    green: 'bg-green-100 text-green-800',
    purple: 'bg-violet-100 text-violet-800',
    orange: 'bg-orange-100 text-orange-800',
    gray: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color as keyof typeof colors]}`}>
      {children}
    </span>
  );
}
