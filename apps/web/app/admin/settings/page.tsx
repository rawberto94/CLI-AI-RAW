/**
 * Admin Settings Page
 * Comprehensive admin dashboard for system management
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Key, 
  Webhook, 
  ClipboardList,
  Download,
  Shield as _Shield,
  Database as _Database,
  Activity as _Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiKeysManager, WebhooksManager } from '@/components/settings';
import { AuditLogViewer } from '@/components/audit';
import { ExportManager } from '@/components/export';



const tabs = [
  { id: 'api-keys', label: 'API Keys', icon: Key, gradient: 'from-violet-500 to-purple-500' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, gradient: 'from-violet-500 to-pink-500' },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList, gradient: 'from-amber-500 to-orange-500' },
  { id: 'export', label: 'Export', icon: Download, gradient: 'from-violet-500 to-purple-500' },
];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('api-keys');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-[1600px] mx-auto py-8 px-4 max-w-[1600px]">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div 
                className="p-4 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-purple-600 text-white shadow-xl shadow-violet-500/30"
                whileHover={{ scale: 1.05, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Settings className="h-8 w-8" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Admin Settings
                </h1>
                <p className="text-slate-500 mt-1">
                  Manage system configuration, auditability, and integrations
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/users">Manage Users</Link>
            </Button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-4 gap-2 h-auto p-2 bg-white/80 backdrop-blur-sm shadow-sm">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={cn(
                      'flex items-center gap-2 py-3 transition-all',
                      isActive 
                        ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg` 
                        : 'hover:bg-slate-100'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="api-keys" className="mt-6">
              <ApiKeysManager />
            </TabsContent>

            <TabsContent value="webhooks" className="mt-6">
              <WebhooksManager />
            </TabsContent>
            <TabsContent value="audit" className="mt-6">
              <AuditLogViewer />
            </TabsContent>

            <TabsContent value="export" className="mt-6">
              <ExportManager />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
