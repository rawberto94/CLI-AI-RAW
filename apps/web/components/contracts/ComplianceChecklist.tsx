'use client';

import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  Circle, 
  AlertTriangle,
  Calendar,
  User,
  FileText,
  Shield,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ComplianceChecklist {
  id: string;
  name: string;
  description: string;
  framework: ComplianceFramework;
  items: ComplianceItem[];
  dueDate?: Date | string;
  assignee?: string;
  status: ChecklistStatus;
  lastUpdated: Date | string;
}

interface ComplianceItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  required: boolean;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date | string;
  evidence?: string;
  notes?: string;
}

type ComplianceFramework = 
  | 'gdpr' 
  | 'hipaa' 
  | 'soc2' 
  | 'iso27001' 
  | 'pci-dss' 
  | 'ccpa'
  | 'internal'
  | 'custom';

type ChecklistStatus = 'pending' | 'in-progress' | 'completed' | 'overdue';

interface ComplianceChecklistProps {
  contractId: string;
  className?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockChecklists: ComplianceChecklist[] = [
  {
    id: 'cl-1',
    name: 'GDPR Compliance Review',
    description: 'Ensure contract meets EU data protection requirements',
    framework: 'gdpr',
    status: 'in-progress',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    assignee: 'Legal Team',
    lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    items: [
      {
        id: 'item-1',
        title: 'Data Processing Agreement (DPA)',
        description: 'Verify DPA is included and properly executed',
        category: 'Legal',
        required: true,
        completed: true,
        completedBy: 'Sarah Johnson',
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'item-2',
        title: 'Data Subject Rights Provisions',
        description: 'Check provisions for handling data subject requests',
        category: 'Legal',
        required: true,
        completed: true,
        completedBy: 'Mike Chen',
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'item-3',
        title: 'Data Breach Notification Clause',
        description: 'Verify 72-hour notification requirement is included',
        category: 'Security',
        required: true,
        completed: false,
      },
      {
        id: 'item-4',
        title: 'Sub-Processor List',
        description: 'Review and approve list of sub-processors',
        category: 'Vendor',
        required: true,
        completed: false,
      },
      {
        id: 'item-5',
        title: 'Data Transfer Mechanism',
        description: 'Confirm SCCs or other transfer mechanism in place',
        category: 'Legal',
        required: true,
        completed: false,
      },
      {
        id: 'item-6',
        title: 'Data Retention Policy',
        description: 'Verify data retention terms are defined',
        category: 'Data',
        required: true,
        completed: true,
        completedBy: 'Emily Davis',
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
  },
  {
    id: 'cl-2',
    name: 'Internal Contract Checklist',
    description: 'Standard internal review requirements',
    framework: 'internal',
    status: 'completed',
    lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    items: [
      {
        id: 'item-7',
        title: 'Terms and Conditions Review',
        category: 'Legal',
        required: true,
        completed: true,
        completedBy: 'Legal Team',
        completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'item-8',
        title: 'Pricing Verification',
        category: 'Finance',
        required: true,
        completed: true,
        completedBy: 'Finance Team',
        completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'item-9',
        title: 'Signatory Authority Check',
        category: 'Governance',
        required: true,
        completed: true,
        completedBy: 'Operations',
        completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    ],
  },
];

// ============================================================================
// Framework Config
// ============================================================================

const frameworkConfig: Record<ComplianceFramework, { 
  label: string; 
  color: string; 
  icon?: React.ReactNode;
}> = {
  gdpr: { 
    label: 'GDPR', 
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    icon: <Shield className="h-3 w-3" />
  },
  hipaa: { 
    label: 'HIPAA', 
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: <Shield className="h-3 w-3" />
  },
  soc2: { 
    label: 'SOC 2', 
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    icon: <Shield className="h-3 w-3" />
  },
  iso27001: { 
    label: 'ISO 27001', 
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    icon: <Shield className="h-3 w-3" />
  },
  'pci-dss': { 
    label: 'PCI-DSS', 
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    icon: <Shield className="h-3 w-3" />
  },
  ccpa: { 
    label: 'CCPA', 
    color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    icon: <Shield className="h-3 w-3" />
  },
  internal: { 
    label: 'Internal', 
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
    icon: <FileText className="h-3 w-3" />
  },
  custom: { 
    label: 'Custom', 
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    icon: <ClipboardCheck className="h-3 w-3" />
  },
};

const statusConfig: Record<ChecklistStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-slate-100 text-slate-700' },
  'in-progress': { label: 'In Progress', color: 'bg-violet-100 text-violet-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700' },
};

// ============================================================================
// Main Component
// ============================================================================

export function ComplianceChecklist({ contractId, className }: ComplianceChecklistProps) {
  const [checklists, setChecklists] = useState<ComplianceChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set(['cl-1']));

  useEffect(() => {
    fetchChecklists();
  }, [contractId]);

  const fetchChecklists = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setChecklists(mockChecklists);
    setLoading(false);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedChecklists);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedChecklists(newExpanded);
  };

  const toggleItem = (checklistId: string, itemId: string) => {
    setChecklists(prev => prev.map(cl => {
      if (cl.id !== checklistId) return cl;
      
      const updatedItems = cl.items.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          completed: !item.completed,
          completedBy: !item.completed ? 'Current User' : undefined,
          completedAt: !item.completed ? new Date() : undefined,
        };
      });

      const completedCount = updatedItems.filter(i => i.completed).length;
      let status: ChecklistStatus = 'pending';
      if (completedCount === updatedItems.length) {
        status = 'completed';
      } else if (completedCount > 0) {
        status = 'in-progress';
      }

      return {
        ...cl,
        items: updatedItems,
        status,
        lastUpdated: new Date(),
      };
    }));
  };

  const getProgress = (checklist: ComplianceChecklist) => {
    const completed = checklist.items.filter(i => i.completed).length;
    return Math.round((completed / checklist.items.length) * 100);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate overall compliance stats
  const totalItems = checklists.reduce((acc, cl) => acc + cl.items.length, 0);
  const completedItems = checklists.reduce(
    (acc, cl) => acc + cl.items.filter(i => i.completed).length, 
    0
  );
  const overallProgress = totalItems > 0 
    ? Math.round((completedItems / totalItems) * 100) 
    : 0;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Compliance Checklist
            </CardTitle>
            <CardDescription>
              Track regulatory and internal compliance requirements
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchChecklists}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Checklist
            </Button>
          </div>
        </div>

        {/* Overall Progress */}
        <div className="mt-4 bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Overall Compliance Progress</span>
            <span className="text-lg font-bold">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-3" />
          <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
            <span>{completedItems} of {totalItems} items completed</span>
            <span>{checklists.filter(c => c.status === 'completed').length} of {checklists.length} checklists done</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : checklists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No compliance checklists</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add checklists to track compliance requirements
            </p>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Create Checklist
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {checklists.map((checklist) => {
              const progress = getProgress(checklist);
              const isExpanded = expandedChecklists.has(checklist.id);
              const framework = frameworkConfig[checklist.framework];
              const status = statusConfig[checklist.status];
              
              return (
                <div
                  key={checklist.id}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Checklist Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleExpanded(checklist.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{checklist.name}</span>
                          <Badge 
                            variant="secondary"
                            className={cn("text-xs", framework.color)}
                          >
                            {framework.icon}
                            <span className="ml-1">{framework.label}</span>
                          </Badge>
                          <Badge 
                            variant="secondary"
                            className={cn("text-xs", status.color)}
                          >
                            {status.label}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {checklist.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {checklist.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {formatDate(checklist.dueDate)}
                            </span>
                          )}
                          {checklist.assignee && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {checklist.assignee}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Updated: {formatDate(checklist.lastUpdated)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-bold">{progress}%</div>
                          <div className="text-xs text-muted-foreground">
                            {checklist.items.filter(i => i.completed).length}/{checklist.items.length}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    
                    <Progress value={progress} className="h-2 mt-3" />
                  </div>

                  {/* Checklist Items */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20">
                      {checklist.items.map((item, index) => (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors",
                            index !== checklist.items.length - 1 && "border-b"
                          )}
                        >
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => toggleItem(checklist.id, item.id)}
                            className="mt-0.5"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-medium",
                                item.completed && "line-through text-muted-foreground"
                              )}>
                                {item.title}
                              </span>
                              {item.required && (
                                <Badge variant="outline" className="text-xs">
                                  Required
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                {item.category}
                              </Badge>
                            </div>
                            
                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {item.description}
                              </p>
                            )}
                            
                            {item.completed && item.completedBy && (
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                Completed by {item.completedBy}
                                {item.completedAt && ` on ${formatDate(item.completedAt)}`}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ComplianceChecklist;
