/**
 * Webhook Management Component
 * Configure and manage webhooks for external integrations
 * 
 * Uses React Query for data fetching and optimistic mutations
 * for instant UI feedback.
 */

'use client';

import { memo, useState } from 'react';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Send,
  Loader2,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useWebhooksQuery, type WebhookConfig } from '@/hooks/use-settings-queries';
import { 
  useDeleteWebhook, 
  useToggleWebhook, 
  useCreateWebhook, 
  useUpdateWebhook,
  useTestWebhook 
} from '@/hooks/use-optimistic-mutations';
import { DataFreshnessIndicator } from '@/components/shared/DataFreshnessIndicator';

interface WebhooksManagerProps {
  tenantId?: string;
  className?: string;
}

const eventOptions = [
  { value: 'contract.created', label: 'Contract Created', description: 'When a new contract is uploaded' },
  { value: 'contract.processed', label: 'Contract Processed', description: 'When processing completes' },
  { value: 'contract.updated', label: 'Contract Updated', description: 'When contract metadata is updated' },
  { value: 'contract.deleted', label: 'Contract Deleted', description: 'When a contract is deleted' },
  { value: 'artifact.generated', label: 'Artifact Generated', description: 'When AI artifacts are created' },
  { value: 'alert.risk_detected', label: 'Risk Detected', description: 'When high-risk clauses are found' },
  { value: 'alert.deadline_approaching', label: 'Deadline Approaching', description: 'When a deadline is near' },
  { value: 'ocr.completed', label: 'OCR Completed', description: 'When OCR processing finishes successfully' },
];

export const WebhooksManager = memo(function WebhooksManager({
  tenantId = 'default',
  className,
}: WebhooksManagerProps) {
  // React Query hooks
  const { 
    data: webhooks = [], 
    isLoading: loading, 
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useWebhooksQuery();
  
  const deleteMutation = useDeleteWebhook();
  const toggleMutation = useToggleWebhook();
  const createMutation = useCreateWebhook();
  const updateMutation = useUpdateWebhook();
  const testMutation = useTestWebhook();

  // Local UI state
  const [showDialog, setShowDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
  });

  const openCreateDialog = () => {
    setEditingWebhook(null);
    setFormData({ name: '', url: '', events: [], secret: '' });
    setShowDialog(true);
  };

  const openEditDialog = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      secret: '',
    });
    setShowDialog(true);
  };

  const saveWebhook = async () => {
    if (!formData.name || !formData.url || formData.events.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate URL
    try {
      new URL(formData.url);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    try {
      if (editingWebhook) {
        await updateMutation.mutateAsync({
          webhookId: editingWebhook.id,
          ...formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setShowDialog(false);
    } catch (error) {
      // Error handling is done in the mutation hooks
    }
  };

  const deleteWebhook = async (webhookId: string) => {
    try {
      await deleteMutation.mutateAsync(webhookId);
    } catch (error) {
      // Error handling is done in the mutation hook
    }
    setDeleteWebhookId(null);
  };

  const toggleWebhook = async (webhookId: string, isActive: boolean) => {
    try {
      await toggleMutation.mutateAsync({ webhookId, isActive });
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const testWebhook = async (webhookId: string) => {
    try {
      await testMutation.mutateAsync(webhookId);
    } catch (error) {
      // Error handling is done in the mutation hook
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const testingWebhookId = testMutation.isPending ? testMutation.variables : null;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-violet-600" />
                Webhooks
              </CardTitle>
              <CardDescription className="mt-1">
                Send real-time notifications to external services
              </CardDescription>
              <DataFreshnessIndicator
                dataUpdatedAt={dataUpdatedAt}
                isFetching={isFetching}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={openCreateDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Webhook
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-12">
              <Webhook className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900">No Webhooks</h3>
              <p className="text-sm text-slate-500 mt-1">
                Add a webhook to receive real-time notifications
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className={cn(
                    'p-4 rounded-lg border transition-colors',
                    webhook.isActive 
                      ? 'bg-white border-slate-200' 
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{webhook.name}</h4>
                        {!webhook.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                        {webhook.failureCount > 0 && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {webhook.failureCount} failures
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="font-mono text-xs truncate max-w-md">
                          {webhook.url}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map(event => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        {webhook.lastTriggeredAt && (
                          <span className="flex items-center gap-1">
                            {webhook.lastStatus === 'success' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                            )}
                            Last triggered {formatTimeAgo(webhook.lastTriggeredAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testWebhook(webhook.id)}
                        disabled={testingWebhookId === webhook.id || !webhook.isActive}
                        className="gap-1.5"
                      >
                        {testingWebhookId === webhook.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(webhook)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={webhook.isActive}
                        onCheckedChange={(checked) => toggleWebhook(webhook.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteWebhookId(webhook.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
            </DialogTitle>
            <DialogDescription>
              Configure the webhook endpoint and events to listen for
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="e.g., Slack Notifications"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Webhook URL *</Label>
              <Input
                placeholder="https://..."
                value={formData.url}
                onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Secret (optional)</Label>
              <Input
                type="password"
                placeholder="Used to sign webhook payloads"
                value={formData.secret}
                onChange={(e) => setFormData(prev => ({ ...prev, secret: e.target.value }))}
              />
              <p className="text-xs text-slate-500">
                If provided, payloads will include a signature header for verification
              </p>
            </div>
            <div className="space-y-2">
              <Label>Events *</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {eventOptions.map(event => (
                  <label key={event.value} className="flex items-start gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                    <Checkbox
                      checked={formData.events.includes(event.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData(prev => ({
                            ...prev,
                            events: [...prev.events, event.value],
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            events: prev.events.filter(e => e !== event.value),
                          }));
                        }
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs text-slate-500">{event.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveWebhook} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingWebhook ? 'Save Changes' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteWebhookId} onOpenChange={() => setDeleteWebhookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this webhook? You will no longer receive
              notifications at this endpoint.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteWebhookId && deleteWebhook(deleteWebhookId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Webhook
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
