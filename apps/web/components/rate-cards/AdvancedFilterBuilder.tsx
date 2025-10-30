'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Save, Loader2 } from 'lucide-react';

interface FilterCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'notIn';
  value: any;
}

interface FilterGroup {
  logic: 'AND' | 'OR' | 'NOT';
  conditions?: FilterCondition[];
  groups?: FilterGroup[];
}

interface AdvancedFilter {
  rootGroup: FilterGroup;
}

interface AdvancedFilterBuilderProps {
  onFilterChange: (filter: AdvancedFilter) => void;
  onSave?: (name: string, filter: AdvancedFilter) => void;
  matchCount?: number;
  isValidating?: boolean;
}

const FIELDS = [
  { value: 'role', label: 'Role' },
  { value: 'geography', label: 'Geography' },
  { value: 'seniority', label: 'Seniority' },
  { value: 'rate', label: 'Rate' },
  { value: 'currency', label: 'Currency' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'effectiveDate', label: 'Effective Date' },
  { value: 'expirationDate', label: 'Expiration Date' },
  { value: 'contractType', label: 'Contract Type' },
  { value: 'workModel', label: 'Work Model' },
];

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater than or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'in list' },
  { value: 'notIn', label: 'not in list' },
];

export function AdvancedFilterBuilder({
  onFilterChange,
  onSave,
  matchCount,
  isValidating,
}: AdvancedFilterBuilderProps) {
  const [filter, setFilter] = useState<AdvancedFilter>({
    rootGroup: {
      logic: 'AND',
      conditions: [],
      groups: [],
    },
  });

  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');

  useEffect(() => {
    onFilterChange(filter);
  }, [filter, onFilterChange]);

  const addCondition = (group: FilterGroup) => {
    const newCondition: FilterCondition = {
      field: 'role',
      operator: 'eq',
      value: '',
    };

    const updatedFilter = { ...filter };
    if (!group.conditions) {
      group.conditions = [];
    }
    group.conditions.push(newCondition);
    setFilter(updatedFilter);
  };

  const removeCondition = (group: FilterGroup, index: number) => {
    const updatedFilter = { ...filter };
    group.conditions?.splice(index, 1);
    setFilter(updatedFilter);
  };

  const updateCondition = (
    condition: FilterCondition,
    field: keyof FilterCondition,
    value: any
  ) => {
    const updatedFilter = { ...filter };
    condition[field] = value;
    setFilter(updatedFilter);
  };

  const addGroup = (parentGroup: FilterGroup) => {
    const newGroup: FilterGroup = {
      logic: 'AND',
      conditions: [],
      groups: [],
    };

    const updatedFilter = { ...filter };
    if (!parentGroup.groups) {
      parentGroup.groups = [];
    }
    parentGroup.groups.push(newGroup);
    setFilter(updatedFilter);
  };

  const removeGroup = (parentGroup: FilterGroup, index: number) => {
    const updatedFilter = { ...filter };
    parentGroup.groups?.splice(index, 1);
    setFilter(updatedFilter);
  };

  const updateGroupLogic = (group: FilterGroup, logic: 'AND' | 'OR' | 'NOT') => {
    const updatedFilter = { ...filter };
    group.logic = logic;
    setFilter(updatedFilter);
  };

  const handleSave = () => {
    if (filterName && onSave) {
      onSave(filterName, filter);
      setFilterName('');
      setShowSaveDialog(false);
    }
  };

  const renderGroup = (group: FilterGroup, depth: number = 0, parentGroup?: FilterGroup, groupIndex?: number): JSX.Element => {
    return (
      <div
        key={`group-${depth}-${groupIndex}`}
        className={`border rounded-lg p-4 space-y-3 ${depth > 0 ? 'ml-4 bg-muted/30' : 'bg-background'}`}
      >
        {/* Group Logic Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Match</Label>
            <Select
              value={group.logic}
              onValueChange={(value) => updateGroupLogic(group, value as 'AND' | 'OR' | 'NOT')}
            >
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
                <SelectItem value="NOT">NOT</SelectItem>
              </SelectContent>
            </Select>
            <Label className="text-sm text-muted-foreground">of the following:</Label>
          </div>

          {depth > 0 && parentGroup && groupIndex !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeGroup(parentGroup, groupIndex)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Conditions */}
        {group.conditions?.map((condition, index) => (
          <div key={`condition-${index}`} className="flex items-center gap-2">
            <Select
              value={condition.field}
              onValueChange={(value) => updateCondition(condition, 'field', value)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELDS.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={condition.operator}
              onValueChange={(value) => updateCondition(condition, 'operator', value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERATORS.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Value"
              value={condition.value}
              onChange={(e) => updateCondition(condition, 'value', e.target.value)}
              className="flex-1"
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeCondition(group, index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {/* Sub-groups */}
        {group.groups?.map((subGroup, index) => renderGroup(subGroup, depth + 1, group, index))}

        {/* Add Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addCondition(group)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Condition
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addGroup(group)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Group
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Advanced Filter Builder</CardTitle>
          <div className="flex items-center gap-2">
            {isValidating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Validating...
              </div>
            )}
            {matchCount !== undefined && !isValidating && (
              <Badge variant="secondary">{matchCount} matches</Badge>
            )}
            {onSave && (
              <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {renderGroup(filter.rootGroup)}
      </CardContent>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Save Filter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Filter Name</Label>
                <Input
                  placeholder="e.g., High-value EMEA contracts"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={!filterName}>
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}
