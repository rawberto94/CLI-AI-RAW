/**
 * Workflow Templates Hook
 * 
 * Fetches workflow templates from the backend API and provides
 * utilities for template management and smart routing.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Types matching backend WORKFLOW_TEMPLATES
export interface WorkflowTemplateStep {
  name: string;
  role: string;
  timeoutHours: number;
  order?: number;
  autoApprove?: boolean;
  isExternal?: boolean;
  conditional?: Record<string, unknown>;
  isRequired?: boolean;
}

export interface WorkflowTemplate {
  key: string;
  name: string;
  type: 'APPROVAL' | 'REVIEW' | 'NOTIFICATION' | 'CUSTOM';
  description: string;
  contractTypes?: string[];
  stepCount: number;
  totalDurationHours: number;
  steps: WorkflowTemplateStep[];
}

export interface WorkflowRouting {
  recommendedTemplate: string;
  templateName: string;
  reason: string;
  template: WorkflowTemplate;
}

// Query keys
export const workflowTemplateKeys = {
  all: ['workflowTemplates'] as const,
  list: () => [...workflowTemplateKeys.all, 'list'] as const,
  route: (params: Record<string, unknown>) => [...workflowTemplateKeys.all, 'route', params] as const,
};

/**
 * Fetch all available workflow templates
 */
export function useWorkflowTemplates() {
  return useQuery({
    queryKey: workflowTemplateKeys.list(),
    queryFn: async (): Promise<WorkflowTemplate[]> => {
      const response = await fetch('/api/workflows/templates?action=list');
      if (!response.ok) {
        throw new Error('Failed to fetch workflow templates');
      }
      const data = await response.json();
      return data.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - templates don't change often
  });
}

/**
 * Get smart workflow routing recommendation
 */
export function useWorkflowRouting(params: {
  contractType?: string;
  value?: number;
  riskLevel?: string;
  isAmendment?: boolean;
  isTermination?: boolean;
  isRenewalOptOut?: boolean;
  partyCount?: number;
  enabled?: boolean;
}) {
  const { enabled = true, ...routingParams } = params;
  
  return useQuery({
    queryKey: workflowTemplateKeys.route(routingParams),
    queryFn: async (): Promise<WorkflowRouting> => {
      const searchParams = new URLSearchParams();
      searchParams.set('action', 'route');
      
      if (routingParams.contractType) searchParams.set('contractType', routingParams.contractType);
      if (routingParams.value !== undefined) searchParams.set('value', String(routingParams.value));
      if (routingParams.riskLevel) searchParams.set('riskLevel', routingParams.riskLevel);
      if (routingParams.isAmendment) searchParams.set('isAmendment', 'true');
      if (routingParams.isTermination) searchParams.set('isTermination', 'true');
      if (routingParams.isRenewalOptOut) searchParams.set('isRenewalOptOut', 'true');
      if (routingParams.partyCount) searchParams.set('partyCount', String(routingParams.partyCount));
      
      const response = await fetch(`/api/workflows/templates?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to get workflow routing');
      }
      const data = await response.json();
      return data.data;
    },
    enabled,
  });
}

/**
 * Seed all workflow templates for tenant
 */
export function useSeedWorkflowTemplates() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/workflows/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to seed templates');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: workflowTemplateKeys.all });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      
      if (data.data?.created?.length > 0) {
        toast.success('Templates seeded', {
          description: `Created ${data.data.created.length} workflow templates`,
        });
      } else {
        toast.info('Templates already exist', {
          description: 'All workflow templates are already configured',
        });
      }
    },
    onError: () => {
      toast.error('Failed to seed workflow templates');
    },
  });
}

/**
 * Create workflow from a template
 */
export function useCreateFromTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      templateKey: string;
      customName?: string;
      setAsDefault?: boolean;
    }) => {
      const response = await fetch('/api/workflows/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_from_template',
          ...params,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create workflow from template');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast.success('Workflow created', {
        description: data.message || 'Workflow created from template',
      });
    },
    onError: () => {
      toast.error('Failed to create workflow');
    },
  });
}

/**
 * Route and optionally start workflow for a contract
 */
export function useRouteAndStartWorkflow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      contractId: string;
      contractType?: string;
      value?: number;
      riskLevel?: string;
      autoStart?: boolean;
    }) => {
      const response = await fetch('/api/workflows/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'route_and_start',
          ...params,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to route workflow');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflowExecutions'] });
      
      if (data.data?.started) {
        toast.success('Workflow started', {
          description: data.message,
        });
      } else {
        toast.info('Workflow recommended', {
          description: data.message,
        });
      }
    },
    onError: () => {
      toast.error('Failed to route workflow');
    },
  });
}

/**
 * Template icon and color mapping for UI
 */
export const TEMPLATE_UI_CONFIG: Record<string, { 
  color: string; 
  iconName: string;
  popular?: boolean;
}> = {
  standard: { color: 'bg-gradient-to-br from-violet-500 to-purple-600', iconName: 'CheckCircle', popular: true },
  express: { color: 'bg-gradient-to-br from-green-500 to-emerald-600', iconName: 'Zap' },
  legal_review: { color: 'bg-gradient-to-br from-slate-500 to-slate-700', iconName: 'FileText' },
  executive: { color: 'bg-gradient-to-br from-purple-500 to-fuchsia-600', iconName: 'GitBranch', popular: true },
  amendment: { color: 'bg-gradient-to-br from-amber-500 to-orange-600', iconName: 'Edit' },
  nda_fast_track: { color: 'bg-gradient-to-br from-cyan-500 to-violet-600', iconName: 'Zap' },
  vendor_onboarding: { color: 'bg-gradient-to-br from-teal-500 to-emerald-600', iconName: 'Activity' },
  termination: { color: 'bg-gradient-to-br from-red-500 to-rose-600', iconName: 'AlertTriangle' },
  renewal_opt_out: { color: 'bg-gradient-to-br from-orange-500 to-amber-600', iconName: 'RefreshCw' },
  risk_escalation: { color: 'bg-gradient-to-br from-rose-500 to-red-700', iconName: 'AlertTriangle' },
  multi_party: { color: 'bg-gradient-to-br from-violet-500 to-purple-700', iconName: 'GitBranch' },
  procurement: { color: 'bg-gradient-to-br from-indigo-500 to-violet-700', iconName: 'FileText' },
};

/**
 * Get template display config
 */
export function getTemplateUIConfig(templateKey: string) {
  return TEMPLATE_UI_CONFIG[templateKey] || {
    color: 'bg-gradient-to-br from-gray-500 to-gray-700',
    iconName: 'FileText',
  };
}
