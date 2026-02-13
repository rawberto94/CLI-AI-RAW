'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useDataMode } from '@/contexts/DataModeContext';
import {
  Share2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Search,
  X,
  FileText,
  Building2,
  AlertTriangle,
  Link2,
  Calendar,
  DollarSign,
  Shield,
  Users,
  ChevronRight,
  Download,
  Layers,
  Eye,
  EyeOff,
  RefreshCw,
  Info,
  TrendingUp,
  Package,
  Handshake,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface GraphNode {
  id: string;
  type: 'contract' | 'supplier' | 'clause' | 'risk' | 'obligation' | 'category' | 'department';
  label: string;
  data: Record<string, unknown>;
  x?: number;
  y?: number;
  connections: string[];
  size?: 'small' | 'medium' | 'large';
  status?: 'active' | 'warning' | 'critical' | 'inactive';
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'supplies' | 'relates' | 'depends' | 'triggers' | 'governs';
  strength: number; // 0-1
  label?: string;
}

interface GraphCluster {
  id: string;
  name: string;
  nodes: string[];
  color: string;
}

// ============================================================================
// Mock Data - Knowledge Graph
// ============================================================================

const mockNodes: GraphNode[] = [
  // Contracts
  { id: 'c1', type: 'contract', label: 'Master Agreement - Acme Corp', data: { value: 1200000, status: 'active', renewalDate: '2024-06-15' }, connections: ['s1', 'cl1', 'cl2', 'r1', 'o1', 'cat1'], size: 'large', status: 'active' },
  { id: 'c2', type: 'contract', label: 'SLA - Cloud Services', data: { value: 450000, status: 'active', renewalDate: '2024-08-20' }, connections: ['s1', 'cl3', 'r2', 'o2', 'cat2'], size: 'medium', status: 'active' },
  { id: 'c3', type: 'contract', label: 'NDA - TechFlow Inc', data: { value: 0, status: 'active', expiryDate: '2025-01-10' }, connections: ['s2', 'cl4', 'cat3'], size: 'small', status: 'active' },
  { id: 'c4', type: 'contract', label: 'Procurement Agreement - GlobalSupply', data: { value: 780000, status: 'warning', renewalDate: '2024-04-01' }, connections: ['s3', 'cl1', 'cl5', 'r3', 'o3', 'cat1'], size: 'large', status: 'warning' },
  { id: 'c5', type: 'contract', label: 'Maintenance Contract - Acme Corp', data: { value: 120000, status: 'active', renewalDate: '2024-09-30' }, connections: ['s1', 'cl6', 'o4', 'cat4'], size: 'small', status: 'active' },
  
  // Suppliers
  { id: 's1', type: 'supplier', label: 'Acme Corporation', data: { rating: 4.5, contracts: 3, totalValue: 1770000 }, connections: ['c1', 'c2', 'c5'], size: 'large', status: 'active' },
  { id: 's2', type: 'supplier', label: 'TechFlow Inc', data: { rating: 4.2, contracts: 1, totalValue: 0 }, connections: ['c3'], size: 'small', status: 'active' },
  { id: 's3', type: 'supplier', label: 'GlobalSupply Ltd', data: { rating: 3.8, contracts: 1, totalValue: 780000 }, connections: ['c4'], size: 'medium', status: 'warning' },
  
  // Clauses
  { id: 'cl1', type: 'clause', label: 'Liability Limitation', data: { risk: 'medium', frequency: 3 }, connections: ['c1', 'c4'], size: 'medium', status: 'warning' },
  { id: 'cl2', type: 'clause', label: 'Termination for Convenience', data: { risk: 'low', frequency: 1 }, connections: ['c1'], size: 'small', status: 'active' },
  { id: 'cl3', type: 'clause', label: 'SLA Penalties', data: { risk: 'high', frequency: 1 }, connections: ['c2'], size: 'medium', status: 'critical' },
  { id: 'cl4', type: 'clause', label: 'Confidentiality', data: { risk: 'low', frequency: 1 }, connections: ['c3'], size: 'small', status: 'active' },
  { id: 'cl5', type: 'clause', label: 'Auto-Renewal', data: { risk: 'high', frequency: 1 }, connections: ['c4'], size: 'medium', status: 'critical' },
  { id: 'cl6', type: 'clause', label: 'Support Hours', data: { risk: 'low', frequency: 1 }, connections: ['c5'], size: 'small', status: 'active' },
  
  // Risks
  { id: 'r1', type: 'risk', label: 'Vendor Lock-in Risk', data: { severity: 'medium', mitigated: true }, connections: ['c1'], size: 'small', status: 'warning' },
  { id: 'r2', type: 'risk', label: 'SLA Breach Exposure', data: { severity: 'high', mitigated: false }, connections: ['c2'], size: 'medium', status: 'critical' },
  { id: 'r3', type: 'risk', label: 'Auto-Renewal Trap', data: { severity: 'high', mitigated: false }, connections: ['c4'], size: 'medium', status: 'critical' },
  
  // Obligations
  { id: 'o1', type: 'obligation', label: 'Quarterly Business Review', data: { nextDue: '2024-03-31', frequency: 'quarterly' }, connections: ['c1'], size: 'small', status: 'active' },
  { id: 'o2', type: 'obligation', label: '99.9% Uptime Guarantee', data: { nextDue: 'ongoing', frequency: 'continuous' }, connections: ['c2'], size: 'small', status: 'active' },
  { id: 'o3', type: 'obligation', label: 'Monthly Delivery Schedule', data: { nextDue: '2024-03-15', frequency: 'monthly' }, connections: ['c4'], size: 'small', status: 'warning' },
  { id: 'o4', type: 'obligation', label: '24/7 Support Availability', data: { nextDue: 'ongoing', frequency: 'continuous' }, connections: ['c5'], size: 'small', status: 'active' },
  
  // Categories
  { id: 'cat1', type: 'category', label: 'Procurement', data: { contractCount: 2 }, connections: ['c1', 'c4'], size: 'medium', status: 'active' },
  { id: 'cat2', type: 'category', label: 'IT Services', data: { contractCount: 1 }, connections: ['c2'], size: 'small', status: 'active' },
  { id: 'cat3', type: 'category', label: 'Legal', data: { contractCount: 1 }, connections: ['c3'], size: 'small', status: 'active' },
  { id: 'cat4', type: 'category', label: 'Maintenance', data: { contractCount: 1 }, connections: ['c5'], size: 'small', status: 'active' },
];

const mockEdges: GraphEdge[] = [
  // Contract-Supplier
  { id: 'e1', source: 'c1', target: 's1', type: 'supplies', strength: 0.9, label: 'Primary' },
  { id: 'e2', source: 'c2', target: 's1', type: 'supplies', strength: 0.7 },
  { id: 'e3', source: 'c3', target: 's2', type: 'supplies', strength: 0.5 },
  { id: 'e4', source: 'c4', target: 's3', type: 'supplies', strength: 0.8, label: 'At Risk' },
  { id: 'e5', source: 'c5', target: 's1', type: 'supplies', strength: 0.6 },
  
  // Contract-Clause
  { id: 'e6', source: 'c1', target: 'cl1', type: 'contains', strength: 0.8 },
  { id: 'e7', source: 'c1', target: 'cl2', type: 'contains', strength: 0.6 },
  { id: 'e8', source: 'c2', target: 'cl3', type: 'contains', strength: 0.9 },
  { id: 'e9', source: 'c3', target: 'cl4', type: 'contains', strength: 0.7 },
  { id: 'e10', source: 'c4', target: 'cl1', type: 'contains', strength: 0.8 },
  { id: 'e11', source: 'c4', target: 'cl5', type: 'contains', strength: 0.9 },
  { id: 'e12', source: 'c5', target: 'cl6', type: 'contains', strength: 0.5 },
  
  // Contract-Risk
  { id: 'e13', source: 'c1', target: 'r1', type: 'relates', strength: 0.6 },
  { id: 'e14', source: 'c2', target: 'r2', type: 'relates', strength: 0.9 },
  { id: 'e15', source: 'c4', target: 'r3', type: 'relates', strength: 0.95 },
  
  // Contract-Obligation
  { id: 'e16', source: 'c1', target: 'o1', type: 'governs', strength: 0.7 },
  { id: 'e17', source: 'c2', target: 'o2', type: 'governs', strength: 0.9 },
  { id: 'e18', source: 'c4', target: 'o3', type: 'governs', strength: 0.8 },
  { id: 'e19', source: 'c5', target: 'o4', type: 'governs', strength: 0.6 },
  
  // Contract-Category
  { id: 'e20', source: 'c1', target: 'cat1', type: 'relates', strength: 0.5 },
  { id: 'e21', source: 'c2', target: 'cat2', type: 'relates', strength: 0.5 },
  { id: 'e22', source: 'c3', target: 'cat3', type: 'relates', strength: 0.5 },
  { id: 'e23', source: 'c4', target: 'cat1', type: 'relates', strength: 0.5 },
  { id: 'e24', source: 'c5', target: 'cat4', type: 'relates', strength: 0.5 },
  
  // Cross-contract relationships
  { id: 'e25', source: 'c1', target: 'c5', type: 'depends', strength: 0.7, label: 'Amendment' },
  { id: 'e26', source: 'c2', target: 'c1', type: 'depends', strength: 0.6, label: 'References' },
];

const mockClusters: GraphCluster[] = [
  { id: 'cluster1', name: 'Acme Relationship', nodes: ['c1', 'c2', 'c5', 's1'], color: '#3B82F6' },
  { id: 'cluster2', name: 'High Risk Contracts', nodes: ['c4', 'r3', 'cl5', 's3'], color: '#EF4444' },
  { id: 'cluster3', name: 'SLA Compliance', nodes: ['c2', 'cl3', 'r2', 'o2'], color: '#F59E0B' },
];

// ============================================================================
// Node Icons
// ============================================================================

const getNodeIcon = (type: GraphNode['type']) => {
  switch (type) {
    case 'contract': return FileText;
    case 'supplier': return Building2;
    case 'clause': return Shield;
    case 'risk': return AlertTriangle;
    case 'obligation': return Calendar;
    case 'category': return Package;
    case 'department': return Users;
    default: return FileText;
  }
};

const getNodeColor = (type: GraphNode['type'], status?: GraphNode['status']) => {
  if (status === 'critical') return { bg: 'bg-red-500', border: 'border-red-600', text: 'text-white' };
  if (status === 'warning') return { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-white' };
  
  switch (type) {
    case 'contract': return { bg: 'bg-violet-500', border: 'border-violet-600', text: 'text-white' };
    case 'supplier': return { bg: 'bg-violet-500', border: 'border-violet-600', text: 'text-white' };
    case 'clause': return { bg: 'bg-green-500', border: 'border-green-600', text: 'text-white' };
    case 'risk': return { bg: 'bg-red-500', border: 'border-red-600', text: 'text-white' };
    case 'obligation': return { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-white' };
    case 'category': return { bg: 'bg-slate-500', border: 'border-slate-600', text: 'text-white' };
    case 'department': return { bg: 'bg-violet-500', border: 'border-violet-600', text: 'text-white' };
    default: return { bg: 'bg-slate-400', border: 'border-slate-500', text: 'text-white' };
  }
};

const getNodeSize = (size: GraphNode['size']) => {
  switch (size) {
    case 'large': return { node: 56, icon: 24 };
    case 'medium': return { node: 44, icon: 20 };
    case 'small': return { node: 36, icon: 16 };
    default: return { node: 44, icon: 20 };
  }
};

// ============================================================================
// Force-Directed Layout Simulation
// ============================================================================

const useForceLayout = (nodes: GraphNode[], edges: GraphEdge[], containerRef: React.RefObject<HTMLDivElement | null>) => {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    // Initialize positions in a circle
    const initialPositions: Record<string, { x: number; y: number }> = {};
    const angleStep = (2 * Math.PI) / nodes.length;
    const radius = Math.min(width, height) * 0.35;

    nodes.forEach((node, i) => {
      const angle = i * angleStep;
      initialPositions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });

    // Simple force simulation
    const simulate = () => {
      const newPositions = { ...initialPositions };
      const iterations = 100;
      const repulsion = 5000;
      const attraction = 0.05;
      const damping = 0.85;

      for (let iter = 0; iter < iterations; iter++) {
        const forces: Record<string, { fx: number; fy: number }> = {};
        nodes.forEach(node => {
          forces[node.id] = { fx: 0, fy: 0 };
        });

        // Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const nodeA = nodes[i];
            const nodeB = nodes[j];
            if (!nodeA || !nodeB) continue;
            const posA = newPositions[nodeA.id];
            const posB = newPositions[nodeB.id];
            if (!posA || !posB) continue;

            const dx = posB.x - posA.x;
            const dy = posB.y - posA.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = repulsion / (dist * dist);

            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            const forceA = forces[nodeA.id];
            const forceB = forces[nodeB.id];
            if (forceA && forceB) {
              forceA.fx -= fx;
              forceA.fy -= fy;
              forceB.fx += fx;
              forceB.fy += fy;
            }
          }
        }

        // Attraction along edges
        edges.forEach(edge => {
          const posSource = newPositions[edge.source];
          const posTarget = newPositions[edge.target];
          if (!posSource || !posTarget) return;

          const dx = posTarget.x - posSource.x;
          const dy = posTarget.y - posSource.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return;

          const force = dist * attraction * edge.strength;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          const forceSource = forces[edge.source];
          const forceTarget = forces[edge.target];
          if (forceSource && forceTarget) {
            forceSource.fx += fx;
            forceSource.fy += fy;
            forceTarget.fx -= fx;
            forceTarget.fy -= fy;
          }
        });

        // Apply forces with damping
        nodes.forEach(node => {
          const pos = newPositions[node.id];
          const force = forces[node.id];
          if (pos && force) {
            pos.x = Math.max(50, Math.min(width - 50, pos.x + force.fx * damping));
            pos.y = Math.max(50, Math.min(height - 50, pos.y + force.fy * damping));
          }
        });
      }

      setPositions(newPositions);
    };

    simulate();
  }, [nodes, edges, containerRef]);

  return positions;
};

// ============================================================================
// Node Detail Panel
// ============================================================================

interface NodeDetailPanelProps {
  node: GraphNode | null;
  onClose: () => void;
  relatedNodes: GraphNode[];
  relatedEdges: GraphEdge[];
  onViewDetails: () => void;
  onExplorePath: () => void;
}

const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ node, onClose, relatedNodes, relatedEdges, onViewDetails, onExplorePath }) => {
  if (!node) return null;

  const Icon = getNodeIcon(node.type);
  const colors = getNodeColor(node.type, node.status);

  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      className="absolute top-0 right-0 w-80 h-full bg-white border-l border-slate-200 shadow-xl z-20 overflow-y-auto"
    >
      <div className={`p-4 ${colors.bg} ${colors.text}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            <span className="text-xs font-medium uppercase opacity-80">{node.type}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <h3 className="mt-2 text-lg font-semibold">{node.label}</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Node Data */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-900 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Details
          </h4>
          <div className="space-y-1">
            {Object.entries(node.data).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <span className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="font-medium text-slate-900">
                  {typeof value === 'number' && key.toLowerCase().includes('value')
                    ? `$${value.toLocaleString()}`
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Connections */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-900 flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Connections ({relatedEdges.length})
          </h4>
          <div className="space-y-1">
            {relatedNodes.slice(0, 8).map(related => {
              const RelatedIcon = getNodeIcon(related.type);
              const relatedColors = getNodeColor(related.type, related.status);
              return (
                <div
                  key={related.id}
                  className="flex items-center gap-2 p-2 bg-slate-50 rounded text-sm"
                >
                  <div className={`w-6 h-6 rounded-full ${relatedColors.bg} flex items-center justify-center`}>
                    <RelatedIcon className={`w-3 h-3 ${relatedColors.text}`} />
                  </div>
                  <span className="flex-1 truncate">{related.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              );
            })}
            {relatedNodes.length > 8 && (
              <p className="text-xs text-slate-500 text-center py-1">
                +{relatedNodes.length - 8} more connections
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-900">Quick Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onViewDetails} className="px-3 py-2 text-xs font-medium bg-violet-50 text-violet-700 rounded hover:bg-violet-100 transition-colors">
              View Details
            </button>
            <button onClick={onExplorePath} className="px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition-colors">
              Explore Path
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ContractKnowledgeGraph: React.FC = () => {
  const { isMockData } = useDataMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleTypes, setVisibleTypes] = useState<Set<GraphNode['type']>>(
    new Set(['contract', 'supplier', 'clause', 'risk', 'obligation', 'category'])
  );
  const [highlightCluster, setHighlightCluster] = useState<string | null>(null);

  // Live data state
  const [liveNodes, setLiveNodes] = useState<GraphNode[]>([]);
  const [liveEdges, setLiveEdges] = useState<GraphEdge[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  // Fetch live data from API when not in mock mode
  useEffect(() => {
    if (isMockData) return;
    let cancelled = false;
    setLiveLoading(true);
    fetch('/api/intelligence/graph')
      .then(r => r.json())
      .then(json => {
        if (cancelled) return;
        if (json.success && json.data) {
          // Map API response to component types
          const apiNodes: GraphNode[] = (json.data.nodes || []).map((n: any) => ({
            id: n.id,
            type: n.type || 'contract',
            label: n.label,
            data: n.metadata || {},
            connections: [],
            size: n.weight > 3 ? 'large' : n.weight > 1 ? 'medium' : 'small',
            status: n.metadata?.risk === 'CRITICAL' ? 'critical' : n.metadata?.risk === 'HIGH' ? 'warning' : 'active',
          }));
          // Build connections from edges
          const apiEdges: GraphEdge[] = (json.data.edges || []).map((e: any, i: number) => ({
            id: e.id || `e-${i}`,
            source: e.source,
            target: e.target,
            type: e.type === 'party_to' ? 'supplies' : e.type === 'has_risk' ? 'relates' : e.type === 'parent_of' ? 'depends' : 'relates',
            strength: e.weight ? Math.min(e.weight / 3, 1) : 0.5,
            label: e.label,
          }));
          // Populate connections
          const connectionMap = new Map<string, string[]>();
          for (const e of apiEdges) {
            connectionMap.set(e.source, [...(connectionMap.get(e.source) || []), e.target]);
            connectionMap.set(e.target, [...(connectionMap.get(e.target) || []), e.source]);
          }
          for (const node of apiNodes) {
            node.connections = connectionMap.get(node.id) || [];
          }
          setLiveNodes(apiNodes);
          setLiveEdges(apiEdges);
        }
      })
      .catch(() => { /* Fall back to mock data on error */ })
      .finally(() => { if (!cancelled) setLiveLoading(false); });
    return () => { cancelled = true; };
  }, [isMockData]);

  // Choose data source
  const activeNodes = isMockData ? mockNodes : (liveNodes.length > 0 ? liveNodes : mockNodes);
  const activeEdges = isMockData ? mockEdges : (liveEdges.length > 0 ? liveEdges : mockEdges);

  // Filter nodes based on visibility and search
  const filteredNodes = useMemo(() => {
    return activeNodes.filter(node => {
      if (!visibleTypes.has(node.type)) return false;
      if (searchQuery && !node.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [activeNodes, visibleTypes, searchQuery]);

  // Filter edges based on visible nodes
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return activeEdges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  }, [activeEdges, filteredNodes]);

  // Calculate positions
  const positions = useForceLayout(filteredNodes, filteredEdges, containerRef);

  // Get related nodes for selected node
  const relatedNodes = useMemo(() => {
    if (!selectedNode) return [];
    const relatedIds = new Set<string>();
    activeEdges.forEach(edge => {
      if (edge.source === selectedNode.id) relatedIds.add(edge.target);
      if (edge.target === selectedNode.id) relatedIds.add(edge.source);
    });
    return activeNodes.filter(n => relatedIds.has(n.id));
  }, [selectedNode, activeNodes, activeEdges]);

  const relatedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return activeEdges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id);
  }, [selectedNode, activeEdges]);

  // Toggle node type visibility
  const toggleType = (type: GraphNode['type']) => {
    setVisibleTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Check if node is in highlighted cluster
  // Build clusters dynamically from active data or fall back to mock
  const activeClusters = useMemo(() => {
    if (isMockData || liveNodes.length === 0) return mockClusters;
    // Auto-generate clusters from supplier groups
    const supplierClusters: GraphCluster[] = [];
    const suppliers = activeNodes.filter(n => n.type === 'supplier');
    const colors = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];
    suppliers.forEach((s, i) => {
      const connected = activeEdges
        .filter(e => e.source === s.id || e.target === s.id)
        .map(e => e.source === s.id ? e.target : e.source);
      if (connected.length > 0) {
        supplierClusters.push({
          id: `cluster-${s.id}`,
          name: s.label,
          nodes: [s.id, ...connected],
          color: colors[i % colors.length],
        });
      }
    });
    return supplierClusters.length > 0 ? supplierClusters : mockClusters;
  }, [isMockData, liveNodes, activeNodes, activeEdges]);

  const isInHighlightedCluster = useCallback((nodeId: string) => {
    if (!highlightCluster) return true;
    const cluster = activeClusters.find(c => c.id === highlightCluster);
    return cluster?.nodes.includes(nodeId) ?? false;
  }, [highlightCluster, activeClusters]);

  // Stats
  const stats = useMemo(() => ({
    contracts: filteredNodes.filter(n => n.type === 'contract').length,
    suppliers: filteredNodes.filter(n => n.type === 'supplier').length,
    risks: filteredNodes.filter(n => n.type === 'risk').length,
    connections: filteredEdges.length,
  }), [filteredNodes, filteredEdges]);

  // Handle fullscreen toggle
  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      toast.success('Entered fullscreen mode');
    } else {
      document.exitFullscreen();
      toast.success('Exited fullscreen mode');
    }
  }, []);

  // Handle graph export
  const handleExportGraph = useCallback(() => {
    try {
      const exportData = {
        generatedAt: new Date().toISOString(),
        stats,
        nodes: filteredNodes.map(n => ({ id: n.id, label: n.label, type: n.type })),
        edges: filteredEdges.map(e => ({ source: e.source, target: e.target, type: e.type })),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `knowledge-graph-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      toast.success('Graph data exported successfully');
    } catch (error) {
      toast.error('Failed to export graph data');
    }
  }, [stats, filteredNodes, filteredEdges]);

  // Handle view node details
  const handleViewDetails = useCallback(() => {
    if (selectedNode) {
      toast.info(`Viewing details for: ${selectedNode.label}`);
      // In a real app, this would open a modal or navigate to a details page
    }
  }, [selectedNode]);

  // Handle explore path
  const handleExplorePath = useCallback(() => {
    if (selectedNode) {
      toast.info(`Exploring connections from: ${selectedNode.label}`);
      // Highlight connected nodes
    }
  }, [selectedNode]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="flex-none p-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-violet-500" />
              Contract Knowledge Graph
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Explore relationships between contracts, suppliers, clauses, and risks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(z => Math.min(2, z + 0.1))}
              className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
              className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleFullscreen} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
              <Maximize2 className="w-4 h-4" />
            </button>
            <button onClick={handleExportGraph} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-sm text-slate-600">{stats.contracts} Contracts</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <span className="text-sm text-slate-600">{stats.suppliers} Suppliers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm text-slate-600">{stats.risks} Risks</span>
          </div>
          <div className="flex items-center gap-2">
            <Link2 className="w-3 h-3 text-slate-400" />
            <span className="text-sm text-slate-600">{stats.connections} Connections</span>
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div key="filters"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-none bg-white border-b border-slate-200 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search nodes..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>

              {/* Node Type Toggles */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Node Types</label>
                <div className="flex flex-wrap gap-2">
                  {(['contract', 'supplier', 'clause', 'risk', 'obligation', 'category'] as const).map(type => {
                    const Icon = getNodeIcon(type);
                    const colors = getNodeColor(type);
                    const isVisible = visibleTypes.has(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleType(type)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                          isVisible
                            ? `${colors.bg} ${colors.text}`
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <Icon className="w-3 h-3" />
                        <span className="capitalize">{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cluster Highlight */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase mb-2 block">Highlight Cluster</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setHighlightCluster(null)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      highlightCluster === null ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {activeClusters.map(cluster => (
                    <button
                      key={cluster.id}
                      onClick={() => setHighlightCluster(highlightCluster === cluster.id ? null : cluster.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all`}
                      style={{
                        backgroundColor: highlightCluster === cluster.id ? cluster.color : undefined,
                        color: highlightCluster === cluster.id ? 'white' : cluster.color,
                        border: `2px solid ${cluster.color}`,
                      }}
                    >
                      {cluster.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Graph Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          {/* Edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {filteredEdges.map(edge => {
              const sourcePos = positions[edge.source];
              const targetPos = positions[edge.target];
              if (!sourcePos || !targetPos) return null;

              const isHighlighted =
                hoveredNode === edge.source ||
                hoveredNode === edge.target ||
                selectedNode?.id === edge.source ||
                selectedNode?.id === edge.target;

              const isInCluster = isInHighlightedCluster(edge.source) && isInHighlightedCluster(edge.target);

              return (
                <g key={edge.id}>
                  <line
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={isHighlighted ? '#3B82F6' : '#CBD5E1'}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeOpacity={highlightCluster && !isInCluster ? 0.1 : isHighlighted ? 1 : 0.5}
                    strokeDasharray={edge.type === 'depends' ? '4 2' : undefined}
                  />
                  {edge.label && isHighlighted && (
                    <text
                      x={(sourcePos.x + targetPos.x) / 2}
                      y={(sourcePos.y + targetPos.y) / 2 - 8}
                      textAnchor="middle"
                      className="fill-violet-600 text-xs font-medium"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {filteredNodes.map(node => {
            const pos = positions[node.id];
            if (!pos) return null;

            const Icon = getNodeIcon(node.type);
            const colors = getNodeColor(node.type, node.status);
            const sizes = getNodeSize(node.size);
            const isSelected = selectedNode?.id === node.id;
            const isHovered = hoveredNode === node.id;
            const isRelated = selectedNode && relatedNodes.some(n => n.id === node.id);
            const isInCluster = isInHighlightedCluster(node.id);

            return (
              <motion.div
                key={node.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: highlightCluster && !isInCluster ? 0.2 : 1,
                  x: pos.x - sizes.node / 2,
                  y: pos.y - sizes.node / 2,
                }}
                whileHover={{ scale: 1.1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className={`absolute cursor-pointer ${
                  isSelected ? 'z-10' : isHovered || isRelated ? 'z-5' : 'z-1'
                }`}
                style={{ width: sizes.node, height: sizes.node }}
                onClick={() => setSelectedNode(isSelected ? null : node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <div
                  className={`w-full h-full rounded-full ${colors.bg} ${colors.border} border-2 flex items-center justify-center shadow-lg transition-all ${
                    isSelected ? 'ring-4 ring-violet-300 ring-opacity-50' : ''
                  } ${isRelated ? 'ring-2 ring-violet-200' : ''}`}
                >
                  <Icon className={`${colors.text}`} style={{ width: sizes.icon, height: sizes.icon }} />
                </div>

                {/* Node Label on Hover/Select */}
                <AnimatePresence>
                  {(isHovered || isSelected) && (
                    <motion.div key="ContractKnowledgeGraph-ap-1"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap"
                    >
                      <div className="px-2 py-1 bg-slate-900 text-white text-xs rounded shadow-lg">
                        {node.label}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 space-y-2">
          <h4 className="text-xs font-medium text-slate-500 uppercase">Legend</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {([
              { type: 'contract', label: 'Contract' },
              { type: 'supplier', label: 'Supplier' },
              { type: 'clause', label: 'Clause' },
              { type: 'risk', label: 'Risk' },
              { type: 'obligation', label: 'Obligation' },
              { type: 'category', label: 'Category' },
            ] as const).map(({ type, label }) => {
              const Icon = getNodeIcon(type);
              const colors = getNodeColor(type);
              return (
                <div key={type} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${colors.bg} flex items-center justify-center`}>
                    <Icon className={`w-2.5 h-2.5 ${colors.text}`} />
                  </div>
                  <span className="text-xs text-slate-600">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Help Overlay */}
        <div className="absolute top-4 left-4 bg-violet-50 text-violet-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
          <Info className="w-4 h-4" />
          <span>Click nodes to explore • Hover to see connections</span>
        </div>
      </div>

      {/* Node Detail Panel */}
      <AnimatePresence>
        {selectedNode && (
          <NodeDetailPanel key="selected-node"
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            relatedNodes={relatedNodes}
            relatedEdges={relatedEdges}
            onViewDetails={handleViewDetails}
            onExplorePath={handleExplorePath}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContractKnowledgeGraph;
