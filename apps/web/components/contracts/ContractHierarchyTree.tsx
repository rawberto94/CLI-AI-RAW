/**
 * Contract Hierarchy Tree Component
 * 
 * Visualizes parent-child contract relationships in a tree structure
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronRight, 
  ChevronDown, 
  FileText,
  Link as LinkIcon,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ContractCategoryBadge } from './ContractCategoryBadge';

interface HierarchyNode {
  id: string;
  fileName: string;
  contractCategoryId?: string;
  relationshipType?: string;
  children?: HierarchyNode[];
}

interface ContractHierarchyTreeProps {
  contractId: string;
  className?: string;
}

const RELATIONSHIP_LABELS: Record<string, string> = {
  SOW_UNDER_MSA: 'SOW under MSA',
  WORK_ORDER_UNDER_MSA: 'Work Order under MSA',
  TASK_ORDER_UNDER_MSA: 'Task Order under MSA',
  PO_UNDER_SUPPLY_AGREEMENT: 'PO under Supply Agreement',
  AMENDMENT: 'Amendment',
  ADDENDUM: 'Addendum',
  RENEWAL: 'Renewal',
  CHANGE_ORDER: 'Change Order',
  APPENDIX: 'Appendix',
  EXHIBIT: 'Exhibit',
  SCHEDULE: 'Schedule',
  SLA_UNDER_MSA: 'SLA under MSA',
  DPA_UNDER_MSA: 'DPA under MSA',
  RATE_CARD_UNDER_MSA: 'Rate Card under MSA',
  SUPERSEDES: 'Supersedes',
  RELATED: 'Related',
};

function TreeNode({ 
  node, 
  depth = 0 
}: { 
  node: HierarchyNode; 
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2); // Auto-expand first 2 levels

  const hasChildren = node.children && node.children.length > 0;
  const indent = depth * 24;

  return (
    <div className="space-y-1">
      <div 
        className={cn(
          "flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors",
          depth > 0 && "border-l-2 border-muted"
        )}
        style={{ marginLeft: `${indent}px` }}
      >
        {/* Expand/Collapse Button */}
        {hasChildren && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}
        
        {!hasChildren && <div className="w-6" />}

        {/* File Icon */}
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />

        {/* Contract Link */}
        <Link 
          href={`/contracts/${node.id}`}
          className="flex-1 hover:underline font-medium text-sm"
        >
          {node.fileName}
        </Link>

        {/* Category Badge */}
        {node.contractCategoryId && (
          <ContractCategoryBadge 
            categoryId={node.contractCategoryId}
            className="text-xs"
          />
        )}

        {/* Relationship Badge */}
        {node.relationshipType && (
          <Badge variant="outline" className="text-xs">
            <LinkIcon className="h-3 w-3 mr-1" />
            {RELATIONSHIP_LABELS[node.relationshipType] || node.relationshipType}
          </Badge>
        )}

        {/* Child Count */}
        {hasChildren && (
          <Badge variant="secondary" className="text-xs">
            {node.children!.length}
          </Badge>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="space-y-1">
          {node.children!.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ContractHierarchyTree({ 
  contractId, 
  className 
}: ContractHierarchyTreeProps) {
  const [hierarchy, setHierarchy] = useState<HierarchyNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHierarchy() {
      try {
        setLoading(true);
        setError(null);

        // Call API to get hierarchy
        const response = await fetch(`/api/contracts/${contractId}/hierarchy`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch hierarchy');
        }

        const data = await response.json();
        setHierarchy(data.hierarchy);
      } catch (err) {
        console.error('Error fetching hierarchy:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchHierarchy();
  }, [contractId]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Contract Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Contract Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Failed to load hierarchy</p>
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hierarchy) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Contract Hierarchy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hierarchy found</p>
            <p className="text-sm">This contract is standalone</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Contract Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <TreeNode node={hierarchy} />
        </div>
      </CardContent>
    </Card>
  );
}
