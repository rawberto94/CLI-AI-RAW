'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitBranch,
  Plus,
  X,
  DollarSign,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Condition {
  id: string;
  field: string;
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'contains' | 'in';
  value: string | number | string[];
  logic?: 'AND' | 'OR';
}

interface Route {
  id: string;
  name: string;
  conditions: Condition[];
  targetStepId: string;
  priority: number;
  description?: string;
}

interface ConditionalRoutingPanelProps {
  routes: Route[];
  availableSteps: Array<{ id: string; name: string }>;
  onRoutesChange: (routes: Route[]) => void;
  className?: string;
}

const AVAILABLE_FIELDS = [
  { value: 'contractValue', label: 'Contract Value', type: 'number', icon: DollarSign },
  { value: 'contractType', label: 'Contract Type', type: 'string', icon: FileText },
  { value: 'department', label: 'Department', type: 'string', icon: FileText },
  { value: 'riskScore', label: 'Risk Score', type: 'number', icon: AlertTriangle },
  { value: 'complianceLevel', label: 'Compliance Level', type: 'string', icon: Shield },
  { value: 'vendor', label: 'Vendor', type: 'string', icon: FileText },
  { value: 'region', label: 'Region', type: 'string', icon: FileText },
  { value: 'duration', label: 'Contract Duration (months)', type: 'number', icon: FileText },
];

const OPERATORS = {
  number: [
    { value: 'equals', label: 'Equals (=)' },
    { value: 'notEquals', label: 'Not Equals (≠)' },
    { value: 'greaterThan', label: 'Greater Than (>)' },
    { value: 'lessThan', label: 'Less Than (<)' },
    { value: 'greaterThanOrEqual', label: 'Greater or Equal (≥)' },
    { value: 'lessThanOrEqual', label: 'Less or Equal (≤)' },
  ],
  string: [
    { value: 'equals', label: 'Equals' },
    { value: 'notEquals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'in', label: 'In List' },
  ],
};

export function ConditionalRoutingPanel({
  routes,
  availableSteps,
  onRoutesChange,
  className,
}: ConditionalRoutingPanelProps) {
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  const addRoute = () => {
    const newRoute: Route = {
      id: `route-${Date.now()}`,
      name: `Route ${routes.length + 1}`,
      conditions: [],
      targetStepId: availableSteps[0]?.id || '',
      priority: routes.length + 1,
    };
    onRoutesChange([...routes, newRoute]);
    setEditingRoute(newRoute);
  };

  const deleteRoute = (routeId: string) => {
    onRoutesChange(routes.filter((r) => r.id !== routeId));
  };

  const updateRoute = (routeId: string, updates: Partial<Route>) => {
    onRoutesChange(routes.map((r) => (r.id === routeId ? { ...r, ...updates } : r)));
  };

  const addCondition = (routeId: string) => {
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;

    const newCondition: Condition = {
      id: `cond-${Date.now()}`,
      field: 'contractValue',
      operator: 'greaterThan',
      value: 10000,
      logic: route.conditions.length > 0 ? 'AND' : undefined,
    };

    updateRoute(routeId, {
      conditions: [...route.conditions, newCondition],
    });
  };

  const deleteCondition = (routeId: string, conditionId: string) => {
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;

    const updatedConditions = route.conditions.filter((c) => c.id !== conditionId);
    // Reset logic for first condition
    if (updatedConditions.length > 0 && updatedConditions[0]) {
      updatedConditions[0].logic = undefined;
    }

    updateRoute(routeId, { conditions: updatedConditions });
  };

  const updateCondition = (routeId: string, conditionId: string, updates: Partial<Condition>) => {
    const route = routes.find((r) => r.id === routeId);
    if (!route) return;

    updateRoute(routeId, {
      conditions: route.conditions.map((c) => (c.id === conditionId ? { ...c, ...updates } : c)),
    });
  };

  const getFieldType = (fieldValue: string) => {
    return AVAILABLE_FIELDS.find((f) => f.value === fieldValue)?.type || 'string';
  };

  const getFieldIcon = (fieldValue: string) => {
    const field = AVAILABLE_FIELDS.find((f) => f.value === fieldValue);
    return field?.icon || FileText;
  };

  const moveRoute = (routeId: string, direction: 'up' | 'down') => {
    const index = routes.findIndex((r) => r.id === routeId);
    if (index === -1) return;
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === routes.length - 1) return;
    
    const newRoutes = [...routes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    [newRoutes[index], newRoutes[targetIndex]] = [newRoutes[targetIndex], newRoutes[index]];
    
    // Update priorities
    onRoutesChange(newRoutes.map((r, idx) => ({ ...r, priority: idx + 1 })));
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-600" />
            Conditional Routing
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Define rules to route workflow to different steps based on conditions
          </p>
        </div>
        <Button size="sm" onClick={addRoute} className="gap-2 hover:scale-105 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" aria-label="Add new routing rule">
          <Plus className="w-4 h-4" />
          Add Route
        </Button>
      </div>

      {routes.length > 0 ? (
        <div className="space-y-4">
          {routes.map((route, index) => {
            const isEditing = editingRoute?.id === route.id;
            const targetStep = availableSteps.find((s) => s.id === route.targetStepId);

            return (
              <Card key={route.id} className={cn('transition-all duration-200 hover:shadow-md dark:hover:shadow-slate-900/50', isEditing && 'ring-2 ring-indigo-300 dark:ring-purple-600 shadow-lg')}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-indigo-200 dark:bg-purple-900/30 dark:text-indigo-300 dark:border-purple-700">
                          Priority {route.priority}
                        </Badge>
                        {isEditing ? (
                          <Input
                            value={route.name}
                            onChange={(e) => updateRoute(route.id, { name: e.target.value })}
                            className="h-7 text-sm font-semibold"
                            placeholder="Route name"
                          />
                        ) : (
                          <CardTitle className="text-base">{route.name}</CardTitle>
                        )}
                      </div>
                      {route.description && !isEditing && (
                        <CardDescription className="text-xs">{route.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {index > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => moveRoute(route.id, 'up')}
                        >
                          ↑
                        </Button>
                      )}
                      {index < routes.length - 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => moveRoute(route.id, 'down')}
                        >
                          ↓
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingRoute(isEditing ? null : route)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteRoute(route.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Conditions */}
                  {route.conditions.length > 0 ? (
                    <div className="space-y-2">
                      {route.conditions.map((condition, condIndex) => {
                        const FieldIcon = getFieldIcon(condition.field);
                        const fieldType = getFieldType(condition.field);
                        
                        return (
                          <div key={condition.id} className="space-y-2">
                            {condIndex > 0 && condition.logic && (
                              <div className="flex items-center gap-2">
                                <div className="h-px flex-1 bg-slate-200" />
                                <Select
                                  value={condition.logic}
                                  onValueChange={(value: 'AND' | 'OR') =>
                                    updateCondition(route.id, condition.id, { logic: value })
                                  }
                                  disabled={!isEditing}
                                >
                                  <SelectTrigger className="w-20 h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="AND">AND</SelectItem>
                                    <SelectItem value="OR">OR</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="h-px flex-1 bg-slate-200" />
                              </div>
                            )}

                            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <FieldIcon className="w-4 h-4 text-slate-600 flex-shrink-0" />
                              
                              {isEditing ? (
                                <div className="flex-1 grid grid-cols-3 gap-2">
                                  <Select
                                    value={condition.field}
                                    onValueChange={(value) =>
                                      updateCondition(route.id, condition.id, { field: value })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {AVAILABLE_FIELDS.map((field) => (
                                        <SelectItem key={field.value} value={field.value}>
                                          {field.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <Select
                                    value={condition.operator}
                                    onValueChange={(value: any) =>
                                      updateCondition(route.id, condition.id, { operator: value })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {OPERATORS[fieldType as keyof typeof OPERATORS].map((op) => (
                                        <SelectItem key={op.value} value={op.value}>
                                          {op.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  <Input
                                    type={fieldType === 'number' ? 'number' : 'text'}
                                    value={condition.value}
                                    onChange={(e) =>
                                      updateCondition(route.id, condition.id, {
                                        value: fieldType === 'number' ? Number(e.target.value) : e.target.value,
                                      })
                                    }
                                    className="h-8 text-xs"
                                    placeholder="Value"
                                  />
                                </div>
                              ) : (
                                <div className="flex-1 text-sm">
                                  <span className="font-medium">
                                    {AVAILABLE_FIELDS.find((f) => f.value === condition.field)?.label}
                                  </span>
                                  <span className="mx-2 text-slate-500">
                                    {OPERATORS[fieldType as keyof typeof OPERATORS].find(
                                      (o) => o.value === condition.operator
                                    )?.label || condition.operator}
                                  </span>
                                  <span className="font-semibold text-purple-600">{condition.value}</span>
                                </div>
                              )}

                              {isEditing && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                  onClick={() => deleteCondition(route.id, condition.id)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                      No conditions set - this route will always match
                    </div>
                  )}

                  {isEditing && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => addCondition(route.id)}
                    >
                      <Plus className="w-3 h-3" />
                      Add Condition
                    </Button>
                  )}

                  {/* Target Step */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                    <Label className="text-xs text-slate-600">Route to:</Label>
                    {isEditing ? (
                      <Select
                        value={route.targetStepId}
                        onValueChange={(value) => updateRoute(route.id, { targetStepId: value })}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSteps.map((step) => (
                            <SelectItem key={step.id} value={step.id}>
                              {step.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {targetStep?.name || 'Unknown Step'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <GitBranch className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h4 className="text-lg font-semibold text-slate-700 mb-2">No routing rules defined</h4>
            <p className="text-sm text-slate-500 mb-4">
              Add conditional routes to create dynamic workflow paths based on contract data
            </p>
            <Button onClick={addRoute} className="gap-2">
              <Plus className="w-4 h-4" />
              Create First Route
            </Button>
          </CardContent>
        </Card>
      )}

      {routes.length > 0 && (
        <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
            <div className="text-violet-900">
              <span className="font-medium">Routing Priority:</span> Routes are evaluated in order from top to
              bottom. The first matching route will be used.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
