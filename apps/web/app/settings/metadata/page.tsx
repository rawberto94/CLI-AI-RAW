'use client';

/**
 * Settings - Metadata Configuration Page
 * 
 * Allows clients to customize their metadata fields for contracts.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { getTenantId } from '@/lib/tenant';
import { 
  Settings, 
  ChevronRight, 
  Database, 
  FileText, 
  Tags, 
  Shield,
  Users,
  Bell,
  Palette,
  Sparkles,
  Check,
} from 'lucide-react';
import { MetadataSchemaEditor } from '@/components/settings/MetadataSchemaEditor';

const SETTINGS_SECTIONS = [
  { 
    id: 'metadata', 
    label: 'Metadata Fields', 
    icon: Database, 
    description: 'Define custom fields for contracts',
    active: true,
  },
  { 
    id: 'templates', 
    label: 'Contract Templates', 
    icon: FileText, 
    description: 'Manage contract templates',
    active: false,
  },
  { 
    id: 'categories', 
    label: 'Categories & Tags', 
    icon: Tags, 
    description: 'Configure categorization',
    active: false,
  },
  { 
    id: 'ai', 
    label: 'AI Settings', 
    icon: Sparkles, 
    description: 'Configure AI extraction',
    active: false,
  },
  { 
    id: 'team', 
    label: 'Team & Permissions', 
    icon: Users, 
    description: 'Manage team access',
    active: false,
  },
  { 
    id: 'notifications', 
    label: 'Notifications', 
    icon: Bell, 
    description: 'Alert preferences',
    active: false,
  },
  { 
    id: 'security', 
    label: 'Security', 
    icon: Shield, 
    description: 'Security settings',
    active: false,
  },
  { 
    id: 'branding', 
    label: 'Branding', 
    icon: Palette, 
    description: 'Customize appearance',
    active: false,
  },
];

export default function MetadataSettingsPage() {
  const [activeSection, setActiveSection] = useState('metadata');
  const [schemaVersion, setSchemaVersion] = useState<number>(1);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link href="/settings" className="hover:text-gray-700">Settings</Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-gray-900 dark:text-white">Metadata Configuration</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <Settings className="h-7 w-7" />
                  Settings
                </h1>
                <p className="text-gray-500 mt-1">
                  Configure your contract management settings
                </p>
              </div>
              {schemaVersion > 1 && (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                  <Check className="h-4 w-4" />
                  Custom schema (v{schemaVersion})
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                
                return (
                  <button
                    key={section.id}
                    onClick={() => section.active && setActiveSection(section.id)}
                    disabled={!section.active}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors
                      ${isActive 
                        ? 'bg-violet-50 text-violet-700 border border-violet-200' 
                        : section.active
                          ? 'hover:bg-gray-100 text-gray-700'
                          : 'opacity-50 cursor-not-allowed text-gray-400'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <div>
                      <div className="font-medium">{section.label}</div>
                      <div className="text-xs text-gray-500">{section.description}</div>
                    </div>
                    {!section.active && (
                      <span className="ml-auto text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Stats */}
            <div className="mt-8 p-4 bg-white rounded-lg border">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Schema Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Categories</span>
                  <span className="font-medium">6</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Fields</span>
                  <span className="font-medium">18</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">AI-Enabled</span>
                  <span className="font-medium text-violet-600">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Required</span>
                  <span className="font-medium text-red-600">5</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Panel */}
          <div className="flex-1">
            {activeSection === 'metadata' && (
              <MetadataSchemaEditor
                tenantId={getTenantId()}
                onSchemaChange={(schema) => setSchemaVersion(schema.version)}
              />
            )}
            
            {activeSection !== 'metadata' && (
              <div className="bg-white rounded-xl border p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Section</h3>
                <p className="text-gray-500">
                  Choose a settings section from the sidebar to configure.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
