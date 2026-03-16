/**
 * Contract Relationship Graph Component
 * 
 * Interactive visualization of contract hierarchies using D3.js
 * Supports tree, timeline, cluster, and minimap views
 * 
 * @version 2.0.0
 */

'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  GitBranch,
  Clock,
  Layers,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Filter,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  DollarSign,
  MoreHorizontal,
  Link2,
  Unlink,
  Edit3,
  Trash2,
  Eye,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface RelationshipGraphProps {
  contractId: string;
  tenantId: string;
  view?: 'tree' | 'timeline' | 'cluster' | 'minimap';
  orientation?: 'vertical' | 'horizontal' | 'radial';
  height?: number;
  showControls?: boolean;
  showBreadcrumbs?: boolean;
  showStats?: boolean;
  enableInteractions?: boolean;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  className?: string;
}

interface GraphNode {
  id: string;
  title: string;
  type: string;
  status: string;
  level: number;
  value?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  party?: string;
  children: GraphNode[];
  siblings: GraphNode[];
  parentId?: string;
  metadata: {
    isRoot: boolean;
    isLeaf: boolean;
    branchCount: number;
    depth: number;
    riskScore?: number;
    healthScore?: number;
  };
  visual: {
    color: string;
    icon: string;
    size: 'small' | 'medium' | 'large';
    badges: string[];
  };
  x?: number;
  y?: number;
  _children?: GraphNode[]; // For D3 collapse/expand
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

interface TreeStats {
  totalNodes: number;
  maxDepth: number;
  totalValue: number;
  rootCount: number;
  leafCount: number;
  avgBranchingFactor: number;
  contractsByType: Record<string, number>;
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface BreadcrumbItem {
  id: string;
  title: string;
  type: string;
  relationship?: string;
  isActive: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RelationshipGraph({
  contractId,
  tenantId,
  view: initialView = 'tree',
  orientation: initialOrientation = 'vertical',
  height = 600,
  showControls = true,
  showBreadcrumbs = true,
  showStats = true,
  enableInteractions = true,
  onNodeClick,
  onNodeHover,
  className,
}: RelationshipGraphProps) {
  // State
  const [view, setView] = useState<'tree' | 'timeline' | 'cluster' | 'minimap'>(initialView);
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal' | 'radial'>(initialOrientation);
  const [data, setData] = useState<GraphNode | null>(null);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([contractId]));
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [showAmendmentDialog, setShowAmendmentDialog] = useState(false);

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<Element, unknown> | null>(null);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/contracts/${contractId}/hierarchy?action=ui-data&view=${view}&expandLevel=3&orientation=${orientation}`,
        {
          headers: { 'X-Tenant-ID': tenantId },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch hierarchy data');

      const result = await response.json();

      if (result.data?.data) {
        setData(result.data.data.root || result.data.data);
        setStats(result.data.stats || null);
      }

      // Fetch breadcrumbs separately
      const breadcrumbResponse = await fetch(
        `/api/contracts/${contractId}/hierarchy?action=breadcrumb`,
        { headers: { 'X-Tenant-ID': tenantId } }
      );

      if (breadcrumbResponse.ok) {
        const breadcrumbResult = await breadcrumbResponse.json();
        setBreadcrumbs(breadcrumbResult.breadcrumbs || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [contractId, tenantId, view, orientation]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==========================================================================
  // D3 VISUALIZATION
  // ==========================================================================

  useEffect(() => {
    if (!data || !svgRef.current || loading) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };

    if (view === 'tree') {
      renderTreeView(svg, data, width, height, margin);
    } else if (view === 'timeline') {
      renderTimelineView(svg, data, width, height, margin);
    } else if (view === 'cluster') {
      renderClusterView(svg, data, width, height, margin);
    } else if (view === 'minimap') {
      renderMinimapView(svg, data, width, height);
    }
  }, [data, view, orientation, zoom, filter, expandedNodes, height, loading]);

  // ==========================================================================
  // VIEW RENDERERS
  // ==========================================================================

  function renderTreeView(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    rootData: GraphNode,
    width: number,
    height: number,
    margin: { top: number; right: number; bottom: number; left: number }
  ) {
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create hierarchy
    const root = d3.hierarchy<GraphNode>(rootData, d => {
      // Only show children if node is expanded
      if (expandedNodes.has(d.id)) {
        return d.children;
      }
      return [];
    });

    // Tree layout
    const treeLayout = d3.tree<GraphNode>().size([innerWidth, innerHeight]);
    
    if (orientation === 'horizontal') {
      treeLayout.size([innerHeight, innerWidth]);
    }

    treeLayout(root);

    // Links
    const linkGenerator = orientation === 'horizontal'
      ? d3.linkHorizontal<d3.HierarchyPointLink<GraphNode>, d3.HierarchyPointNode<GraphNode>>()
          .x(d => d.y)
          .y(d => d.x)
      : d3.linkVertical<d3.HierarchyPointLink<GraphNode>, d3.HierarchyPointNode<GraphNode>>()
          .x(d => d.x)
          .y(d => d.y);

    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', linkGenerator as any)
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 2)
      .attr('opacity', 0.6);

    // Nodes
    const nodes = g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => {
        if (orientation === 'horizontal') {
          return `translate(${d.y},${d.x})`;
        }
        return `translate(${d.x},${d.y})`;
      })
      .style('cursor', enableInteractions ? 'pointer' : 'default')
      .on('click', (event, d) => handleNodeClick(d.data))
      .on('mouseover', (event, d) => {
        setHoveredNode(d.data.id);
        onNodeHover?.(d.data);
      })
      .on('mouseout', () => {
        setHoveredNode(null);
        onNodeHover?.(null);
      });

    // Node rectangles
    const nodeWidth = 200;
    const nodeHeight = 80;

    nodes.append('rect')
      .attr('x', -nodeWidth / 2)
      .attr('y', -nodeHeight / 2)
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('rx', 8)
      .attr('fill', d => d.data.visual.color)
      .attr('stroke', d => d.data.id === contractId ? '#3b82f6' : '#e2e8f0')
      .attr('stroke-width', d => d.data.id === contractId ? 3 : 1)
      .style('filter', d => d.data.id === hoveredNode ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : 'none');

    // Node content
    nodes.append('text')
      .attr('x', -nodeWidth / 2 + 10)
      .attr('y', -nodeHeight / 2 + 20)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#1e293b')
      .text(d => truncateText(d.data.title, 22));

    nodes.append('text')
      .attr('x', -nodeWidth / 2 + 10)
      .attr('y', -nodeHeight / 2 + 38)
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .text(d => d.data.type);

    // Status badge
    nodes.append('rect')
      .attr('x', nodeWidth / 2 - 50)
      .attr('y', -nodeHeight / 2 + 10)
      .attr('width', 40)
      .attr('height', 16)
      .attr('rx', 4)
      .attr('fill', d => getStatusColor(d.data.status));

    nodes.append('text')
      .attr('x', nodeWidth / 2 - 30)
      .attr('y', -nodeHeight / 2 + 21)
      .attr('font-size', '8px')
      .attr('fill', 'white')
      .attr('text-anchor', 'middle')
      .text(d => d.data.status.substring(0, 6));

    // Expand/collapse indicator
    nodes.filter(d => d.data.children && d.data.children.length > 0)
      .append('circle')
      .attr('cx', orientation === 'horizontal' ? 0 : 0)
      .attr('cy', orientation === 'horizontal' ? nodeHeight / 2 + 8 : nodeHeight / 2 + 8)
      .attr('r', 6)
      .attr('fill', '#3b82f6')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        toggleNodeExpansion(d.data.id);
      });

    nodes.filter(d => d.data.children && d.data.children.length > 0)
      .append('text')
      .attr('x', orientation === 'horizontal' ? 0 : 0)
      .attr('y', orientation === 'horizontal' ? nodeHeight / 2 + 11 : nodeHeight / 2 + 11)
      .attr('font-size', '10px')
      .attr('fill', 'white')
      .attr('text-anchor', 'middle')
      .text(d => expandedNodes.has(d.data.id) ? '−' : '+');

    // Zoom
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior as any);
    zoomRef.current = zoomBehavior;
  }

  function renderTimelineView(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    data: GraphNode,
    width: number,
    height: number,
    margin: { top: number; right: number; bottom: number; left: number }
  ) {
    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Timeline axis
    const timeScale = d3.scaleTime()
      .domain([
        d3.min([data, ...data.children || []], d => d.startDate ? new Date(d.startDate) : new Date()) || new Date(),
        d3.max([data, ...data.children || []], d => d.endDate ? new Date(d.endDate) : new Date()) || new Date(),
      ])
      .range([0, width - margin.left - margin.right]);

    const axis = d3.axisBottom(timeScale);
    g.append('g')
      .attr('transform', `translate(0,${height - margin.top - margin.bottom})`)
      .call(axis);

    // Contract bars
    const contracts = [data, ...(data.children || [])];
    const rowHeight = 40;

    const bars = g.selectAll('.contract-bar')
      .data(contracts)
      .enter()
      .append('g')
      .attr('class', 'contract-bar')
      .attr('transform', (d, i) => `translate(0,${i * rowHeight})`);

    bars.append('rect')
      .attr('x', d => timeScale(d.startDate ? new Date(d.startDate) : new Date()))
      .attr('y', 0)
      .attr('width', d => {
        const start = d.startDate ? new Date(d.startDate).getTime() : Date.now();
        const end = d.endDate ? new Date(d.endDate).getTime() : Date.now() + 365 * 24 * 60 * 60 * 1000;
        return Math.max(timeScale(new Date(end)) - timeScale(new Date(start)), 20);
      })
      .attr('height', 30)
      .attr('rx', 4)
      .attr('fill', d => d.visual.color)
      .attr('stroke', d => d.id === contractId ? '#3b82f6' : '#e2e8f0')
      .attr('stroke-width', d => d.id === contractId ? 3 : 1);

    bars.append('text')
      .attr('x', d => timeScale(d.startDate ? new Date(d.startDate) : new Date()) + 5)
      .attr('y', 20)
      .attr('font-size', '10px')
      .attr('fill', '#1e293b')
      .text(d => truncateText(d.title, 20));
  }

  function renderClusterView(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    data: GraphNode,
    width: number,
    height: number,
    margin: { top: number; right: number; bottom: number; left: number }
  ) {
    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Flatten hierarchy for pack layout
    const root = d3.hierarchy<GraphNode>(data)
      .sum(d => d.value || 100)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3.pack<GraphNode>()
      .size([Math.min(width, height) - 100, Math.min(width, height) - 100])
      .padding(5);

    pack(root);

    const packRoot = root as d3.HierarchyCircularNode<GraphNode>;
    const nodes = g.selectAll('.node')
      .data(packRoot.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .on('click', (event, d) => handleNodeClick(d.data));

    nodes.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => d.data.visual.color)
      .attr('stroke', d => d.data.id === contractId ? '#3b82f6' : '#e2e8f0')
      .attr('stroke-width', d => d.data.id === contractId ? 3 : 1)
      .attr('opacity', d => d.depth === 0 ? 0.3 : 0.8);

    nodes.filter(d => d.r > 20)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('font-size', d => Math.min(d.r / 3, 12))
      .attr('fill', '#1e293b')
      .text(d => truncateText(d.data.title, d.r > 40 ? 15 : 8));
  }

  function renderMinimapView(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    data: GraphNode,
    width: number,
    height: number
  ) {
    svg.attr('width', width).attr('height', height);

    // Simplified minimap using a grid
    const contracts = flattenHierarchy(data);
    const cols = Math.ceil(Math.sqrt(contracts.length));
    const cellSize = Math.min(width / cols, height / Math.ceil(contracts.length / cols)) - 4;

    const g = svg.append('g').attr('transform', 'translate(2,2)');

    g.selectAll('.minimap-cell')
      .data(contracts)
      .enter()
      .append('rect')
      .attr('class', 'minimap-cell')
      .attr('x', (d, i) => (i % cols) * (cellSize + 2))
      .attr('y', (d, i) => Math.floor(i / cols) * (cellSize + 2))
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('rx', 4)
      .attr('fill', d => {
        if (d.metadata.riskScore && d.metadata.riskScore >= 70) return '#fee2e2';
        if (d.metadata.riskScore && d.metadata.riskScore >= 50) return '#fef3c7';
        return d.visual.color;
      })
      .attr('stroke', d => d.id === contractId ? '#3b82f6' : 'transparent')
      .attr('stroke-width', d => d.id === contractId ? 3 : 0)
      .on('click', (event, d) => handleNodeClick(d));
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  function handleNodeClick(node: GraphNode) {
    setSelectedNode(node);
    onNodeClick?.(node);
  }

  function toggleNodeExpansion(nodeId: string) {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }

  function flattenHierarchy(node: GraphNode): GraphNode[] {
    const result = [node];
    if (node.children) {
      for (const child of node.children) {
        result.push(...flattenHierarchy(child));
      }
    }
    return result;
  }

  function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'ACTIVE': '#22c55e',
      'DRAFT': '#f59e0b',
      'PENDING': '#3b82f6',
      'EXPIRED': '#6b7280',
      'TERMINATED': '#ef4444',
    };
    return colors[status] || '#6b7280';
  }

  function handleZoomIn() {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy as any, 1.3);
    }
  }

  function handleZoomOut() {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.scaleBy as any, 0.7);
    }
  }

  function handleReset() {
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomRef.current.transform as any, d3.zoomIdentity);
      setZoom(1);
    }
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-50 rounded-lg', className)} style={{ height }}>
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="text-sm text-gray-500">Loading contract hierarchy...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center bg-red-50 rounded-lg', className)} style={{ height }}>
        <div className="flex flex-col items-center gap-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={cn('flex flex-col bg-white rounded-lg border border-gray-200', className)}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Contract Relationships</h3>
            {stats && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Badge variant="secondary">{stats.totalNodes} contracts</Badge>
                <Badge variant="secondary">{stats.maxDepth} levels</Badge>
                {stats.totalValue > 0 && (
                  <Badge variant="secondary">${(stats.totalValue / 1000000).toFixed(1)}M value</Badge>
                )}
              </div>
            )}
          </div>

          {showControls && (
            <div className="flex items-center gap-2">
              {/* View selector */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={view === 'tree' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setView('tree')}
                    >
                      <Network className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Tree View</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={view === 'timeline' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setView('timeline')}
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Timeline</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={view === 'cluster' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setView('cluster')}
                    >
                      <Layers className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cluster View</TooltipContent>
                </Tooltip>
              </div>

              <Separator orientation="vertical" className="h-6" />

              {/* Orientation toggle */}
              {view === 'tree' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOrientation(prev => 
                        prev === 'vertical' ? 'horizontal' : 'vertical'
                      )}
                    >
                      <GitBranch className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle Orientation</TooltipContent>
                </Tooltip>
              )}

              <Separator orientation="vertical" className="h-6" />

              {/* Zoom controls */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset View</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Breadcrumbs */}
        {showBreadcrumbs && breadcrumbs.length > 0 && (
          <div className="flex items-center gap-1 px-4 py-2 bg-gray-50 text-sm border-b border-gray-100">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
                <button
                  onClick={() => handleNodeClick({ id: crumb.id, title: crumb.title, type: crumb.type, status: '', level: 0, children: [], siblings: [], metadata: { isRoot: false, isLeaf: false, branchCount: 0, depth: 0 }, visual: { color: '#f1f5f9', icon: 'document', size: 'small', badges: [] } })}
                  className={cn(
                    'hover:text-blue-600 transition-colors',
                    crumb.isActive ? 'text-blue-600 font-medium' : 'text-gray-600'
                  )}
                >
                  {truncateText(crumb.title, 20)}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Graph */}
        <div ref={containerRef} className="relative flex-1 overflow-hidden">
          <svg ref={svgRef} className="w-full h-full" />

          {/* Node details panel */}
          <AnimatePresence>
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-4 right-4 w-72 bg-white rounded-lg shadow-lg border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{selectedNode.title}</h4>
                    <p className="text-sm text-gray-500">{selectedNode.type}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
                    ×
                  </Button>
                </div>

                <div className="space-y-2 text-sm">
                  {selectedNode.value !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Value:</span>
                      <span className="font-medium">
                        {selectedNode.currency || '$'}
                        {(selectedNode.value / 1000).toFixed(1)}k
                      </span>
                    </div>
                  )}
                  {selectedNode.party && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Party:</span>
                      <span className="font-medium">{truncateText(selectedNode.party, 20)}</span>
                    </div>
                  )}
                  {selectedNode.startDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Period:</span>
                      <span className="font-medium">
                        {new Date(selectedNode.startDate).toLocaleDateString()} -
                        {selectedNode.endDate
                          ? new Date(selectedNode.endDate).toLocaleDateString()
                          : 'Ongoing'}
                      </span>
                    </div>
                  )}
                  {selectedNode.metadata.healthScore !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Health:</span>
                      <span className={cn(
                        'font-medium',
                        selectedNode.metadata.healthScore >= 70 ? 'text-green-600' :
                        selectedNode.metadata.healthScore >= 50 ? 'text-yellow-600' : 'text-red-600'
                      )}>
                        {selectedNode.metadata.healthScore}/100
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {selectedNode.visual.badges.map(badge => (
                    <Badge key={badge} variant="secondary" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-2 mt-4">
                  <Button size="sm" className="flex-1" onClick={() => window.location.href = `/contracts/${selectedNode.id}`}>
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowAmendmentDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Amendment
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link2 className="h-4 w-4 mr-2" />
                        Link Contract
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">
                        <Unlink className="h-4 w-4 mr-2" />
                        Unlink
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Stats footer */}
        {showStats && stats && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100 text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>{stats.riskDistribution.critical} Critical</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span>{stats.riskDistribution.high} High</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>{stats.riskDistribution.medium} Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>{stats.riskDistribution.low} Low</span>
              </div>
            </div>
            <div className="text-gray-500">
              {stats.leafCount} leaf contracts · {stats.avgBranchingFactor.toFixed(1)} avg branches
            </div>
          </div>
        )}

        {/* Amendment Dialog */}
        <Dialog open={showAmendmentDialog} onOpenChange={setShowAmendmentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Amendment</DialogTitle>
              <DialogDescription>
                Create a new amendment version for {selectedNode?.title}
              </DialogDescription>
            </DialogHeader>
            {/* Amendment form would go here */}
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Amendment form coming soon...</p>
              <Button onClick={() => setShowAmendmentDialog(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// STANDALONE COMPONENTS
// ============================================================================

interface AmendmentTimelineProps {
  contractId: string;
  tenantId: string;
  className?: string;
}

export function AmendmentTimeline({ contractId, tenantId, className }: AmendmentTimelineProps) {
  const [chain, setChain] = useState<AmendmentChain | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/hierarchy?action=amendments`, {
      headers: { 'X-Tenant-ID': tenantId },
    })
      .then(r => r.json())
      .then(data => {
        setChain(data.chain);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [contractId, tenantId]);

  if (loading) return <div className="animate-pulse h-20 bg-gray-100 rounded-lg" />;
  if (!chain || chain.versions.length <= 1) return null;

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">Version History</h4>
        <Badge variant={chain.isLatest ? 'default' : 'secondary'}>
          v{chain.currentVersion} of {chain.versions.length}
        </Badge>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        {/* Versions */}
        <div className="space-y-4">
          {chain.versions.map((version, idx) => (
            <div key={version.contractId} className="relative flex items-start gap-4">
              {/* Timeline dot */}
              <div className={cn(
                'relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                idx + 1 === chain.currentVersion
                  ? 'bg-blue-600 text-white'
                  : idx + 1 < chain.currentVersion
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
              )}>
                {idx + 1}
              </div>

              {/* Version info */}
              <div className="flex-1 bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{version.title}</span>
                  <Badge variant="outline">{version.status}</Badge>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {new Date(version.date).toLocaleDateString()}
                  {version.value !== undefined && (
                    <span className="ml-2">· {(version.value / 1000).toFixed(0)}k</span>
                  )}
                </div>
                {version.changes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {version.changes.map((change, cidx) => (
                      <div key={cidx} className="text-xs text-gray-600">
                        <span className={cn(
                          'inline-block w-2 h-2 rounded-full mr-2',
                          change.significance === 'critical' ? 'bg-red-500' :
                          change.significance === 'major' ? 'bg-yellow-500' : 'bg-blue-500'
                        )} />
                        {change.field}: {change.oldValue} → {change.newValue}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ImpactAnalysisPanelProps {
  contractId: string;
  tenantId: string;
  operation: 'terminate' | 'renew' | 'amend' | 'expire';
  className?: string;
}

export function ImpactAnalysisPanel({ contractId, tenantId, operation, className }: ImpactAnalysisPanelProps) {
  const [impact, setImpact] = useState<ImpactAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/hierarchy?action=impact&operation=${operation}`, {
      headers: { 'X-Tenant-ID': tenantId },
    })
      .then(r => r.json())
      .then(data => {
        setImpact(data.impact);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [contractId, tenantId, operation]);

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-lg" />;
  if (!impact) return null;

  const operationLabels: Record<string, string> = {
    terminate: 'Termination Impact',
    renew: 'Renewal Impact',
    amend: 'Amendment Impact',
    expire: 'Expiry Impact',
  };

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">{operationLabels[operation]}</h4>
        <Badge className={cn(
          impact.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
          impact.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
          impact.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-green-100 text-green-800'
        )}>
          {impact.riskLevel} risk
        </Badge>
      </div>

      {impact.directImpacts.length > 0 ? (
        <div className="space-y-3">
          {impact.directImpacts.map((di, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <AlertTriangle className={cn(
                'h-5 w-5 flex-shrink-0',
                di.impact === 'critical' ? 'text-red-500' :
                di.impact === 'high' ? 'text-orange-500' :
                'text-yellow-500'
              )} />
              <div>
                <p className="font-medium text-gray-900">{di.targetTitle}</p>
                <p className="text-sm text-gray-600">{di.description}</p>
                {di.mitigation && (
                  <p className="text-sm text-blue-600 mt-1">💡 {di.mitigation}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <span>No direct impacts detected</span>
        </div>
      )}

      {impact.recommendations.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="font-medium text-blue-900 mb-2">Recommendations</p>
          <ul className="space-y-1">
            {impact.recommendations.map((rec, idx) => (
              <li key={idx} className="text-sm text-blue-800">• {rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface BreadcrumbNavProps {
  contractId: string;
  tenantId: string;
  className?: string;
}

export function BreadcrumbNav({ contractId, tenantId, className }: BreadcrumbNavProps) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  useEffect(() => {
    fetch(`/api/contracts/${contractId}/hierarchy?action=breadcrumb`, {
      headers: { 'X-Tenant-ID': tenantId },
    })
      .then(r => r.json())
      .then(data => setBreadcrumbs(data.breadcrumbs || []));
  }, [contractId, tenantId]);

  if (breadcrumbs.length <= 1) return null;

  return (
    <nav className={cn('flex items-center gap-2 text-sm', className)}>
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.id}>
          {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
          {crumb.isActive ? (
            <span className="font-medium text-gray-900">{crumb.title}</span>
          ) : (
            <a
              href={`/contracts/${crumb.id}`}
              className="text-gray-500 hover:text-blue-600 hover:underline"
            >
              {crumb.title}
            </a>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

// Type for amendment chain
interface AmendmentChain {
  contractId: string;
  versions: Array<{
    version: number;
    contractId: string;
    title: string;
    date: Date;
    status: 'draft' | 'pending' | 'executed' | 'superseded';
    value?: number;
    changes: Array<{
      field: string;
      oldValue: string;
      newValue: string;
      type: 'added' | 'modified' | 'removed';
      significance: 'critical' | 'major' | 'minor';
    }>;
  }>;
  currentVersion: number;
  isLatest: boolean;
}

// Type for impact analysis
interface ImpactAnalysis {
  contractId: string;
  operation: 'terminate' | 'renew' | 'amend' | 'expire';
  directImpacts: Array<{
    targetId: string;
    targetTitle: string;
    relationshipType: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    mitigation?: string;
  }>;
  recommendations: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}
