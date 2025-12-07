/**
 * Admin Settings Page
 * Comprehensive admin dashboard for system management
 */

'use client';

import { useState } from 'react';
import { 
  Settings, 
  Key, 
  Webhook, 
  Users, 
  ClipboardList,
  HardDrive,
  Download,
  Shield,
  Database,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiKeysManager, WebhooksManager } from '@/components/settings';
import { UserManagement, BackupRestore } from '@/components/admin';
import { AuditLogViewer } from '@/components/audit';
import { ExportManager } from '@/components/export';

const tabs = [
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList },
  { id: 'backups', label: 'Backups', icon: HardDrive },
  { id: 'export', label: 'Export', icon: Download },
];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('api-keys');

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100">
            <Settings className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Settings</h1>
            <p className="text-slate-500">
              Manage system configuration, users, and integrations
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-6 gap-2 h-auto p-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  'flex items-center gap-2 py-3 data-[state=active]:bg-white data-[state=active]:shadow-sm'
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

        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogViewer />
        </TabsContent>

        <TabsContent value="backups" className="mt-6">
          <BackupRestore />
        </TabsContent>

        <TabsContent value="export" className="mt-6">
          <ExportManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
