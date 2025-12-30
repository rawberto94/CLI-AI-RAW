'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Play,
  Plus,
  Trash2,
  Edit2,
  Copy,
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  ArrowRight,
  Settings,
  Zap,
  AlertTriangle,
  Save,
} from 'lucide-react';

interface WorkflowNode {
  id: string;
  type: 'start' | 'step' | 'condition' | 'end';
  name: string;
  description?: string;
  stepType?: 'APPROVAL' | 'REVIEW' | 'NOTIFICATION' | 'TASK';
  assignee?: string;
  position: { x: number; y: number };
  config?: {
    approvalType?: 'any' | 'all' | 'majority';
    slaHours?: number;
    autoApprove?: boolean;
    conditions?: Array<{ field: string; operator: string; value: any }>;
  };
}

interface Connection {
  from: string;
  to: string;
  label?: string;
  condition?: boolean; // true/false for conditional branches
}

interface WorkflowCanvasProps {
  initialNodes?: WorkflowNode[];
  initialConnections?: Connection[];
  onSave?: (nodes: WorkflowNode[], connections: Connection[]) => void;
  onNodeSelect?: (nodeId: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function WorkflowCanvas({
  initialNodes = [],
  initialConnections = [],
  onSave,
  onNodeSelect,
  readOnly = false,
  className,
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>(
    initialNodes.length > 0
      ? initialNodes
      : [
          {
            id: 'start',
            type: 'start',
            name: 'Start',
            position: { x: 50, y: 50 },
          },
          {
            id: 'end',
            type: 'end',
            name: 'End',
            position: { x: 750, y: 50 },
          },
        ]
  );
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const addNode = useCallback(
    (type: 'step' | 'condition', x: number = 400, y: number = 200) => {
      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type,
        name: type === 'step' ? 'Approval Step' : 'Condition',
        stepType: type === 'step' ? 'APPROVAL' : undefined,
        assignee: type === 'step' ? 'Unassigned' : undefined,
        position: { x, y },
        config: {
          slaHours: 24,
          autoApprove: false,
        },
      };
      setNodes([...nodes, newNode]);
      setSelectedNode(newNode.id);
    },
    [nodes]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === 'start' || nodeId === 'end') return;
      setNodes(nodes.filter((n) => n.id !== nodeId));
      setConnections(connections.filter((c) => c.from !== nodeId && c.to !== nodeId));
      if (selectedNode === nodeId) setSelectedNode(null);
    },
    [nodes, connections, selectedNode]
  );

  const updateNode = useCallback(
    (nodeId: string, updates: Partial<WorkflowNode>) => {
      setNodes(nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)));
    },
    [nodes]
  );

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.type === 'start' || node.type === 'end') return;
      
      const newNode: WorkflowNode = {
        ...node,
        id: `node-${Date.now()}`,
        name: `${node.name} (Copy)`,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
      };
      setNodes([...nodes, newNode]);
    },
    [nodes]
  );

  const addConnection = useCallback(
    (from: string, to: string) => {
      // Prevent duplicate connections
      if (connections.some((c) => c.from === from && c.to === to)) return;
      // Prevent self-loops
      if (from === to) return;
      
      setConnections([...connections, { from, to }]);
      setConnectingFrom(null);
    },
    [connections]
  );

  const deleteConnection = useCallback(
    (from: string, to: string) => {
      setConnections(connections.filter((c) => !(c.from === from && c.to === to)));
    },
    [connections]
  );

  // Handle mouse down on node
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (readOnly) return;
      e.stopPropagation();
      
      if (e.shiftKey) {
        // Shift+Click for connections
        if (connectingFrom === null) {
          setConnectingFrom(nodeId);
        } else {
          addConnection(connectingFrom, nodeId);
        }
      } else {
        // Regular click for dragging
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        
        setDraggingNode(nodeId);
        setSelectedNode(nodeId);
        setDragOffset({
          x: e.clientX - node.position.x,
          y: e.clientY - node.position.y,
        });
      }
    },
    [readOnly, nodes, connectingFrom, addConnection]
  );

  // Handle mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingNode && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        updateNode(draggingNode, {
          position: {
            x: Math.max(0, Math.min((e.clientX - rect.left) / scale - dragOffset.x, 1200)),
            y: Math.max(0, Math.min((e.clientY - rect.top) / scale - dragOffset.y, 800)),
          },
        });
      }
    };

    const handleMouseUp = () => {
      setDraggingNode(null);
    };

    if (draggingNode) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingNode, dragOffset, scale, updateNode]);

  // Get node visual style
  const getNodeStyle = (node: WorkflowNode) => {
    switch (node.type) {
      case 'start':
        return 'bg-gradient-to-br from-green-500 to-emerald-600 text-white border-green-600 shadow-green-200 dark:shadow-green-900/50';
      case 'end':
        return 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-blue-600 shadow-blue-200 dark:shadow-blue-900/50';
      case 'condition':
        return 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-600 shadow-amber-200 dark:shadow-amber-900/50';
      case 'step':
        return node.stepType === 'APPROVAL'
          ? 'bg-white dark:bg-slate-800 border-indigo-300 dark:border-indigo-600 text-slate-900 dark:text-slate-100 shadow-indigo-100 dark:shadow-slate-900/50'
          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 dark:shadow-slate-900/50';
      default:
        return 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 dark:shadow-slate-900/50';
    }
  };

  const getNodeIcon = (node: WorkflowNode) => {
    switch (node.type) {
      case 'start':
        return <Play className="w-5 h-5" />;
      case 'end':
        return <CheckCircle className="w-5 h-5" />;
      case 'condition':
        return <GitBranch className="w-5 h-5" />;
      case 'step':
        return node.stepType === 'APPROVAL' ? (
          <CheckCircle className="w-5 h-5 text-indigo-600" />
        ) : (
          <Users className="w-5 h-5 text-slate-600" />
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn('relative w-full h-full min-h-[600px] bg-slate-50 rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="absolute top-4 left-4 z-20 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 hover:scale-105 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={() => addNode('step', 300, 200)}
            aria-label="Add workflow step"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Step
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg bg-white"
            onClick={() => addNode('condition', 300, 200)}
          >
            <GitBranch className="w-4 h-4 mr-1.5" />
            Add Condition
          </Button>
          {selectedNode && selectedNode !== 'start' && selectedNode !== 'end' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="shadow-lg bg-white"
                onClick={() => duplicateNode(selectedNode)}
              >
                <Copy className="w-4 h-4 mr-1.5" />
                Duplicate
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="shadow-lg"
                onClick={() => deleteNode(selectedNode)}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete
              </Button>
            </>
          )}
        </div>
      )}

      {/* Instructions */}
      {!readOnly && (
        <div className="absolute top-4 right-4 z-20">
          <Card className="shadow-lg bg-white/95 backdrop-blur-sm">
            <CardContent className="p-3 text-xs space-y-1">
              <div className="font-semibold text-slate-700">Controls:</div>
              <div className="text-slate-600">• Click to select node</div>
              <div className="text-slate-600">• Drag to move node</div>
              <div className="text-slate-600">• Shift+Click to connect nodes</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative w-full h-full"
        style={{
          transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: '0 0',
        }}
      >
        {/* Grid background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#e2e8f0" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {connections.map((conn, idx) => {
            const fromNode = nodes.find((n) => n.id === conn.from);
            const toNode = nodes.find((n) => n.id === conn.to);
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.position.x + 100; // node width / 2
            const y1 = fromNode.position.y + 60; // node height / 2
            const x2 = toNode.position.x + 100;
            const y2 = toNode.position.y + 60;

            // Bezier curve for smooth connections
            const midX = (x1 + x2) / 2;
            const curveControl = Math.abs(x2 - x1) / 3;

            return (
              <g key={`${conn.from}-${conn.to}-${idx}`}>
                <path
                  d={`M ${x1} ${y1} C ${x1 + curveControl} ${y1}, ${x2 - curveControl} ${y2}, ${x2} ${y2}`}
                  stroke="#94a3b8"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className="transition-all"
                />
                {conn.label && (
                  <text x={midX} y={(y1 + y2) / 2 - 10} className="text-xs fill-slate-600" textAnchor="middle">
                    {conn.label}
                  </text>
                )}
              </g>
            );
          })}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <div
            key={node.id}
            className={cn(
              'absolute cursor-move rounded-lg border-2 shadow-lg transition-all duration-200',
              'hover:shadow-xl hover:scale-[1.02]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
              getNodeStyle(node),
              selectedNode === node.id && 'ring-4 ring-indigo-300 dark:ring-indigo-600 ring-offset-2 scale-105',
              draggingNode === node.id && 'opacity-70 scale-110',
              connectingFrom === node.id && 'ring-4 ring-green-400 dark:ring-green-600 animate-pulse'
            )}
            style={{
              left: node.position.x,
              top: node.position.y,
              width: node.type === 'condition' ? '160px' : '200px',
              height: node.type === 'start' || node.type === 'end' ? '80px' : '120px',
            }}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            onClick={() => !draggingNode && onNodeSelect?.(node.id)}
            tabIndex={0}
            role="button"
            aria-label={`Workflow ${node.type}: ${node.name}`}
            aria-pressed={selectedNode === node.id}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNodeSelect?.(node.id);
              }
              if (e.key === 'Delete' && selectedNode === node.id && !readOnly && node.type !== 'start' && node.type !== 'end') {
                e.preventDefault();
                deleteNode(node.id);
              }
            }}
          >
            <div className="p-4 h-full flex flex-col">
              {/* Node header */}
              <div className="flex items-center gap-2 mb-2">
                {getNodeIcon(node)}
                <div className="font-semibold text-sm truncate">{node.name}</div>
              </div>

              {/* Node content */}
              {node.type === 'step' && (
                <div className="flex-1 space-y-1 text-xs">
                  {node.stepType && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-2">
                      {node.stepType}
                    </Badge>
                  )}
                  {node.assignee && (
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <Users className="w-3 h-3" />
                      <span className="truncate">{node.assignee}</span>
                    </div>
                  )}
                  {node.config?.slaHours && (
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{node.config.slaHours}h SLA</span>
                    </div>
                  )}
                </div>
              )}

              {node.type === 'condition' && (
                <div className="flex-1 text-xs text-white/90">
                  {node.config?.conditions?.length ? (
                    <div>{node.config.conditions.length} condition(s)</div>
                  ) : (
                    <div className="text-white/70">No conditions set</div>
                  )}
                </div>
              )}

              {/* Node actions (on hover) */}
              {!readOnly && node.type !== 'start' && node.type !== 'end' && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-200">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node.id);
                    }}
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Connecting line preview */}
        {connectingFrom && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="text-center text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-2 inline-block">
              Click on another node to create connection
            </div>
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      {!readOnly && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg bg-white"
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
          >
            Zoom Out
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg bg-white"
            onClick={() => setScale(1)}
          >
            Reset
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="shadow-lg bg-white"
            onClick={() => setScale(Math.min(1.5, scale + 0.1))}
          >
            Zoom In
          </Button>
          {onSave && (
            <Button
              size="sm"
              className="shadow-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 hover:shadow-xl hover:scale-105 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              onClick={() => onSave(nodes, connections)}
              aria-label="Save workflow changes"
            >
              <Save className="w-4 h-4 mr-1.5" />
              Save Workflow
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
