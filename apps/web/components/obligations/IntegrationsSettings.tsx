'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  Slack,
  MessageSquare,
  Settings,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  Calendar,
  Bell,
} from 'lucide-react';

interface IntegrationSettings {
  slack: {
    configured: boolean;
    webhookUrl?: string;
    channel?: string;
  };
  teams: {
    configured: boolean;
    webhookUrl?: string;
    channel?: string;
  };
  enabled: boolean;
}

interface IntegrationsSettingsProps {
  compact?: boolean;
  onSettingsChange?: () => void;
}

export function IntegrationsSettings({ compact = false, onSettingsChange }: IntegrationsSettingsProps) {
  const [settings, setSettings] = useState<IntegrationSettings>({
    slack: { configured: false },
    teams: { configured: false },
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  // Form state
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [slackChannel, setSlackChannel] = useState('');
  const [teamsChannel, setTeamsChannel] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Load current settings
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/obligations/integrations');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(data.data);
          setNotificationsEnabled(data.data.enabled);
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/obligations/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'configure',
          slackWebhookUrl: slackWebhookUrl || undefined,
          teamsWebhookUrl: teamsWebhookUrl || undefined,
          slackChannel,
          teamsChannel,
          enabled: notificationsEnabled,
        }),
      });

      if (response.ok) {
        toast.success('Integration settings saved');
        fetchSettings();
        onSettingsChange?.();
        setShowDialog(false);
      } else {
        toast.error('Failed to save settings');
      }
    } catch (_error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (platform: 'slack' | 'teams') => {
    const webhookUrl = platform === 'slack' ? slackWebhookUrl : teamsWebhookUrl;
    if (!webhookUrl) {
      toast.error(`Please enter a ${platform} webhook URL first`);
      return;
    }

    setTesting(platform);
    try {
      const response = await fetch('/api/obligations/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          platform,
          webhookUrl,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Test message sent to ${platform}!`);
      } else {
        toast.error(`Failed to send test message: ${data.message || 'Unknown error'}`);
      }
    } catch (_error) {
      toast.error(`Failed to send test message`);
    } finally {
      setTesting(null);
    }
  };

  const handleSendDigest = async (platform: 'slack' | 'teams') => {
    setTesting(platform + '_digest');
    try {
      const response = await fetch('/api/obligations/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify_digest',
          platform,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Digest sent! (${data.overdue} overdue, ${data.upcoming} upcoming)`);
      } else {
        toast.error('Failed to send digest');
      }
    } catch (_error) {
      toast.error('Failed to send digest');
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  // Compact view
  if (compact) {
    return (
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Integrations
            {(settings.slack.configured || settings.teams.configured) && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {[settings.slack.configured && 'Slack', settings.teams.configured && 'Teams']
                  .filter(Boolean)
                  .join(', ')}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              Slack & Teams Integration
            </DialogTitle>
            <DialogDescription>
              Get obligation notifications in your team chat
            </DialogDescription>
          </DialogHeader>

          <IntegrationContent
            settings={settings}
            slackWebhookUrl={slackWebhookUrl}
            setSlackWebhookUrl={setSlackWebhookUrl}
            teamsWebhookUrl={teamsWebhookUrl}
            setTeamsWebhookUrl={setTeamsWebhookUrl}
            slackChannel={slackChannel}
            setSlackChannel={setSlackChannel}
            teamsChannel={teamsChannel}
            setTeamsChannel={setTeamsChannel}
            notificationsEnabled={notificationsEnabled}
            setNotificationsEnabled={setNotificationsEnabled}
            testing={testing}
            onTest={handleTest}
            onSendDigest={handleSendDigest}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Full card view
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-600" />
          Slack & Teams Integration
        </CardTitle>
        <CardDescription>
          Receive obligation notifications and reminders in your team chat
        </CardDescription>
      </CardHeader>
      <CardContent>
        <IntegrationContent
          settings={settings}
          slackWebhookUrl={slackWebhookUrl}
          setSlackWebhookUrl={setSlackWebhookUrl}
          teamsWebhookUrl={teamsWebhookUrl}
          setTeamsWebhookUrl={setTeamsWebhookUrl}
          slackChannel={slackChannel}
          setSlackChannel={setSlackChannel}
          teamsChannel={teamsChannel}
          setTeamsChannel={setTeamsChannel}
          notificationsEnabled={notificationsEnabled}
          setNotificationsEnabled={setNotificationsEnabled}
          testing={testing}
          onTest={handleTest}
          onSendDigest={handleSendDigest}
        />

        <div className="flex justify-end mt-6 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Save Integration Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Extracted content component
function IntegrationContent({
  settings,
  slackWebhookUrl,
  setSlackWebhookUrl,
  teamsWebhookUrl,
  setTeamsWebhookUrl,
  slackChannel,
  setSlackChannel,
  teamsChannel,
  setTeamsChannel,
  notificationsEnabled,
  setNotificationsEnabled,
  testing,
  onTest,
  onSendDigest,
}: {
  settings: IntegrationSettings;
  slackWebhookUrl: string;
  setSlackWebhookUrl: (v: string) => void;
  teamsWebhookUrl: string;
  setTeamsWebhookUrl: (v: string) => void;
  slackChannel: string;
  setSlackChannel: (v: string) => void;
  teamsChannel: string;
  setTeamsChannel: (v: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (v: boolean) => void;
  testing: string | null;
  onTest: (platform: 'slack' | 'teams') => void;
  onSendDigest: (platform: 'slack' | 'teams') => void;
}) {
  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-purple-600" />
          <div>
            <p className="font-medium">Enable Notifications</p>
            <p className="text-sm text-slate-500">
              Send obligation reminders to Slack/Teams
            </p>
          </div>
        </div>
        <Switch
          checked={notificationsEnabled}
          onCheckedChange={setNotificationsEnabled}
        />
      </div>

      <Tabs defaultValue="slack" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="slack" className="gap-2">
            <Slack className="h-4 w-4" />
            Slack
            {settings.slack.configured && (
              <CheckCircle2 className="h-3 w-3 text-green-600" />
            )}
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Teams
            {settings.teams.configured && (
              <CheckCircle2 className="h-3 w-3 text-green-600" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Slack Tab */}
        <TabsContent value="slack" className="space-y-4 mt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Setup Instructions</AlertTitle>
            <AlertDescription className="text-sm">
              1. Go to your Slack workspace settings<br />
              2. Create a new Incoming Webhook app<br />
              3. Copy the Webhook URL and paste it below
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-purple-600 hover:underline ml-2"
              >
                Learn more <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              type="url"
              placeholder="https://hooks.slack.com/services/..."
              value={slackWebhookUrl}
              onChange={(e) => setSlackWebhookUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Channel (optional)</Label>
            <Input
              placeholder="#obligations"
              value={slackChannel}
              onChange={(e) => setSlackChannel(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Leave empty to use the default channel from webhook
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest('slack')}
              disabled={!slackWebhookUrl || testing === 'slack'}
            >
              {testing === 'slack' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            {settings.slack.configured && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSendDigest('slack')}
                disabled={testing === 'slack_digest'}
              >
                {testing === 'slack_digest' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                Send Digest Now
              </Button>
            )}
          </div>
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams" className="space-y-4 mt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Setup Instructions</AlertTitle>
            <AlertDescription className="text-sm">
              1. In Teams, go to the channel where you want notifications<br />
              2. Click ⋯ → Connectors → Incoming Webhook<br />
              3. Configure and copy the Webhook URL
              <a
                href="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-purple-600 hover:underline ml-2"
              >
                Learn more <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <Input
              type="url"
              placeholder="https://outlook.office.com/webhook/..."
              value={teamsWebhookUrl}
              onChange={(e) => setTeamsWebhookUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Channel Name (for reference)</Label>
            <Input
              placeholder="General"
              value={teamsChannel}
              onChange={(e) => setTeamsChannel(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTest('teams')}
              disabled={!teamsWebhookUrl || testing === 'teams'}
            >
              {testing === 'teams' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            {settings.teams.configured && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSendDigest('teams')}
                disabled={testing === 'teams_digest'}
              >
                {testing === 'teams_digest' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="h-4 w-4 mr-2" />
                )}
                Send Digest Now
              </Button>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Notification Types */}
      <div className="space-y-3 pt-4 border-t">
        <h4 className="font-medium">Notification Types</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm">Overdue Alerts</span>
            </div>
            <Badge variant="secondary" className="text-xs">Automatic</Badge>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Due Soon</span>
            </div>
            <Badge variant="secondary" className="text-xs">Automatic</Badge>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Completions</span>
            </div>
            <Badge variant="secondary" className="text-xs">Automatic</Badge>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Daily Digest</span>
            </div>
            <Badge variant="secondary" className="text-xs">8:00 AM</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntegrationsSettings;
