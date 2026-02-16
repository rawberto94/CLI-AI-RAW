'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Network,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Filter,
  Download,
  Building2,
  User,
  FileText,
  MapPin,
  DollarSign,
  Calendar,
  Scale,
  AlertTriangle,
  Link2,
  Eye,
  Loader2,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type EntityType = 
  | 'party' | 'person' | 'organization' | 'location' | 'date' 
  | 'amount' | 'obligation' | 'clause' | 'term' | 'condition' 
  | 'risk' | 'contract';

type RelationType = 
  | 'party_to' | 'signed_by' | 'governed_by' | 'located_in' 
  | 'effective_on' | 'expires_on' | 'obligated_to' | 'references' 
  | 'amends' | 'supersedes' | 'related_to' | 'depends_on'
  | 'contains' | 'triggers' | 'mitigates' | 'conflicts_with';

interface GraphEntity {
  id: string;
  type: EntityType;
  name: string;
  properties: Record<string, unknown>;
  contractId?: string;
  confidence: number;
  sourceLocation?: string;
  createdAt: Date;
}

interface GraphRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  strength: number;
  properties: Record<string, unknown>;
  bidirectional: boolean;
}

interface GraphStats {
  totalEntities: number;
  totalRelations: number;
  entityTypes: Record<EntityType, number>;
  relationTypes: Record<RelationType, number>;
  avgDegree: number;
  clusters: number;
}

interface ClusterInfo {
  id: string;
  name: string;
  entityCount: number;
  dominantType: EntityType;
  contracts: string[];
}

interface KnowledgeGraphVisualizationProps {
  tenantId: string;
  contractId?: string;
  className?: string;
}

// ============================================================================
// Entity Type Configuration
// ============================================================================

const ENTITY_TYPE_CONFIG: Record<EntityType, { 
  icon: React.ElementType; 
  color: string; 
  bgColor: string;
  label: string;
}> = {
  party: { icon: Building2, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Party' },
  person: { icon: User, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Person' },
  organization: { icon: Building2, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Organization' },
  location: { icon: MapPin, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Location' },
  date: { icon: Calendar, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Date' },
  amount: { icon: DollarSign, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Amount' },
  obligation: { icon: Scale, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Obligation' },
  clause: { icon: FileText, color: 'text-slate-600', bgColor: 'bg-slate-100', label: 'Clause' },
  term: { icon: FileText, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Term' },
  condition: { icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Condition' },
  risk: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Risk' },
  contract: { icon: FileText, color: 'text-violet-600', bgColor: 'bg-violet-100', label: 'Contract' },
};

const RELATION_TYPE_LABELS: Record<RelationType, string> = {
  party_to: 'Party To',
  signed_by: 'Signed By',
  governed_by: 'Governed By',
  located_in: 'Located In',
  effective_on: 'Effective On',
  expires_on: 'Expires On',
  obligated_to: 'Obligated To',
  references: 'References',
  amends: 'Amends',
  supersedes: 'Supersedes',
  related_to: 'Related To',
  depends_on: 'Depends On',
  contains: 'Contains',
  triggers: 'Triggers',
  mitigates: 'Mitigates',
  conflicts_with: 'Conflicts With',
};

// ============================================================================
// Graph Node Component
// ============================================================================

interface GraphNodeProps {
  entity: GraphEntity;
  x: number;
  y: number;
  selected: boolean;
  onSelect: () => void;
  scale: number;
}

function GraphNode({ entity, x, y, selected, onSelect, scale }: GraphNodeProps) {
  const config = ENTITY_TYPE_CONFIG[entity.type];
  const Icon = config.icon;
  const size = selected ? 48 : 40;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={onSelect}
      className="cursor-pointer"
      style={{ transition: 'transform 0.2s ease' }}
    >
      {/* Selection ring */}
      {selected && (
        <circle
          r={size / 2 + 6}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary animate-pulse"
        />
      )}
      
      {/* Node circle */}
      <circle
        r={size / 2}
        className={cn(config.bgColor, 'stroke-2')}
        fill="currentColor"
        stroke="white"
      />
      
      {/* Icon */}
      <foreignObject
        x={-size / 4}
        y={-size / 4}
        width={size / 2}
        height={size / 2}
      >
        <div className="w-full h-full flex items-center justify-center">
          <Icon className={cn('w-4 h-4', config.color)} />
        </div>
      </foreignObject>
      
      {/* Label */}
      {scale >= 0.7 && (
        <text
          y={size / 2 + 14}
          textAnchor="middle"
          className="text-[10px] font-medium fill-foreground"
        >
          {entity.name.length > 15 ? entity.name.slice(0, 12) + '...' : entity.name}
        </text>
      )}
    </g>
  );
}

// ============================================================================
// Entity Details Panel
// ============================================================================

interface EntityDetailsPanelProps {
  entity: GraphEntity;
  relations: GraphRelation[];
  entities: GraphEntity[];
  onClose: () => void;
  onNavigate: (entityId: string) => void;
}

function EntityDetailsPanel({ entity, relations, entities, onClose, onNavigate }: EntityDetailsPanelProps) {
  const config = ENTITY_TYPE_CONFIG[entity.type];
  const Icon = config.icon;

  const connectedRelations = relations.filter(
    r => r.sourceId === entity.id || r.targetId === entity.id
  );

  const getConnectedEntity = (relation: GraphRelation) => {
    const connectedId = relation.sourceId === entity.id ? relation.targetId : relation.sourceId;
    return entities.find(e => e.id === connectedId);
  };

  return (
    <Card className="absolute right-4 top-4 w-80 max-h-[calc(100%-2rem)] overflow-hidden shadow-xl z-10">
      <CardHeader className={cn('pb-3', config.bgColor)}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('p-2 rounded-lg bg-white/80', config.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">{entity.name}</CardTitle>
              <CardDescription className="capitalize">{config.label}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            ×
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 overflow-y-auto max-h-[400px]">
        {/* Properties */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Confidence</span>
            <Badge variant="outline" className={cn(
              entity.confidence >= 0.9 ? 'border-green-500 text-green-600' :
              entity.confidence >= 0.8 ? 'border-amber-500 text-amber-600' :
              'border-red-500 text-red-600'
            )}>
              {(entity.confidence * 100).toFixed(0)}%
            </Badge>
          </div>
          {entity.contractId && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Contract</span>
              <span className="font-medium">{entity.contractId}</span>
            </div>
          )}
          {entity.sourceLocation && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Source</span>
              <span className="font-medium">{entity.sourceLocation}</span>
            </div>
          )}
        </div>

        {/* Connected Entities */}
        {connectedRelations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Connections ({connectedRelations.length})
            </h4>
            <div className="space-y-2">
              {connectedRelations.slice(0, 5).map(relation => {
                const connected = getConnectedEntity(relation);
                if (!connected) return null;
                const connConfig = ENTITY_TYPE_CONFIG[connected.type];
                const ConnIcon = connConfig.icon;
                const isSource = relation.sourceId === entity.id;

                return (
                  <button
                    key={relation.id}
                    onClick={() => onNavigate(connected.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <div className={cn('p-1.5 rounded', connConfig.bgColor)}>
                      <ConnIcon className={cn('w-3 h-3', connConfig.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{connected.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {isSource ? '→' : '←'} {RELATION_TYPE_LABELS[relation.type]}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                );
              })}
              {connectedRelations.length > 5 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  +{connectedRelations.length - 5} more connections
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Stats Panel
// ============================================================================

function StatsPanel({ stats }: { stats: GraphStats }) {
  const topEntityTypes = Object.entries(stats.entityTypes)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100">
              <Network className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalEntities}</p>
              <p className="text-xs text-muted-foreground">Entities</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100">
              <Link2 className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalRelations}</p>
              <p className="text-xs text-muted-foreground">Relations</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <Sparkles className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.avgDegree.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Avg Connections</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Building2 className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.clusters}</p>
              <p className="text-xs text-muted-foreground">Clusters</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Cluster List
// ============================================================================

function ClusterList({ clusters, onSelect }: { clusters: ClusterInfo[]; onSelect: (cluster: ClusterInfo) => void }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Entity Clusters</CardTitle>
        <CardDescription>Groups of related entities across contracts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {clusters.map(cluster => {
            const config = ENTITY_TYPE_CONFIG[cluster.dominantType];
            const Icon = config.icon;
            return (
              <button
                key={cluster.id}
                onClick={() => onSelect(cluster)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className={cn('p-2 rounded-lg', config.bgColor)}>
                  <Icon className={cn('w-4 h-4', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{cluster.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cluster.entityCount} entities • {cluster.contracts.length} contracts
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function KnowledgeGraphVisualization({ tenantId, contractId, className }: KnowledgeGraphVisualizationProps) {
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState<GraphEntity[]>([]);
  const [relations, setRelations] = useState<GraphRelation[]>([]);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<GraphEntity | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [scale, setScale] = useState(1);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ action: 'build' });
        if (contractId) params.set('contractIds', contractId);
        const res = await fetch(`/api/knowledge-graph?${params}`);
        const json = await res.json();

        if (json.success && json.data) {
          const d = json.data;
          // Map API graph.nodes → entities, graph.edges → relations
          const graph = d.graph || d;
          const nodes: GraphEntity[] = (graph.nodes || []).map((n: Record<string, unknown>, idx: number) => ({
            id: (n.id as string) || `entity-${idx}`,
            type: (n.type as EntityType) || 'party',
            name: (n.name as string) || (n.label as string) || 'Entity',
            properties: (n.properties as Record<string, unknown>) || {},
            contractId: n.contractId as string | undefined,
            confidence: (n.confidence as number) ?? 0.85,
            sourceLocation: n.sourceLocation as string | undefined,
            createdAt: n.createdAt ? new Date(n.createdAt as string) : new Date(),
          }));
          const edges: GraphRelation[] = (graph.edges || []).map((e: Record<string, unknown>, idx: number) => ({
            id: (e.id as string) || `relation-${idx}`,
            sourceId: (e.source as string) || (e.sourceId as string) || '',
            targetId: (e.target as string) || (e.targetId as string) || '',
            type: (e.type as RelationType) || 'related_to',
            strength: (e.strength as number) || (e.weight as number) || 0.5,
            properties: (e.properties as Record<string, unknown>) || {},
            bidirectional: (e.bidirectional as boolean) || false,
          }));

          setEntities(nodes);
          setRelations(edges);

          // Derive stats from the data
          const entityTypes = nodes.reduce((acc, n) => {
            acc[n.type] = (acc[n.type] || 0) + 1;
            return acc;
          }, {} as Record<EntityType, number>);
          const relationTypes = edges.reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1;
            return acc;
          }, {} as Record<RelationType, number>);

          const apiStats = d.stats || {};
          setStats({
            totalEntities: (apiStats.nodes as number) || nodes.length,
            totalRelations: (apiStats.edges as number) || edges.length,
            entityTypes: { ...({} as Record<EntityType, number>), ...entityTypes, ...(apiStats.nodeTypes as Record<EntityType, number> || {}) },
            relationTypes: { ...({} as Record<RelationType, number>), ...relationTypes },
            avgDegree: nodes.length > 0 ? (edges.length * 2) / nodes.length : 0,
            clusters: (apiStats.clusters as number) || 0,
          });

          // Derive clusters from entity data
          const clusterMap = new Map<string, ClusterInfo>();
          nodes.forEach(n => {
            if (n.contractId) {
              const key = n.contractId;
              if (!clusterMap.has(key)) {
                clusterMap.set(key, { id: key, name: `Contract ${key}`, entityCount: 0, dominantType: n.type, contracts: [key] });
              }
              clusterMap.get(key)!.entityCount++;
            }
          });
          setClusters(Array.from(clusterMap.values()));
        } else {
          setEntities([]);
          setRelations([]);
          setStats(null);
          setClusters([]);
        }
      } catch {
        setEntities([]);
        setRelations([]);
        setStats(null);
        setClusters([]);
      }
      setLoading(false);
    };
    loadData();
  }, [tenantId, contractId]);

  // Calculate node positions using force-directed layout simulation
  const nodePositions = useCallback(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Simple circular layout with some randomization
    entities.forEach((entity, i) => {
      const angle = (i / entities.length) * 2 * Math.PI;
      const radius = 200 + Math.random() * 100;
      positions[entity.id] = {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    });
    
    return positions;
  }, [entities]);

  const positions = nodePositions();

  const filteredEntities = entities.filter(e => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return e.name.toLowerCase().includes(query) || e.type.includes(query);
    }
    return true;
  });

  const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 2));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.3));
  const handleReset = () => {
    setScale(1);
    setViewBox({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center min-h-[500px]', className)}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Building knowledge graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" />
            Contract Knowledge Graph
          </h1>
          <p className="text-muted-foreground text-sm">Visualize entities and relationships across contracts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Rebuild
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && <StatsPanel stats={stats} />}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Graph Visualization */}
        <Card className="lg:col-span-3 relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search entities..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[150px] h-9">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(ENTITY_TYPE_CONFIG).map(([type, config]) => (
                      <SelectItem key={type} value={type}>
                        <span className="capitalize">{config.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground w-12 text-center">{(scale * 100).toFixed(0)}%</span>
                <Button variant="ghost" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative h-[500px] bg-muted/30 overflow-hidden">
              <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`${viewBox.x} ${viewBox.y} ${800 / scale} ${500 / scale}`}
                className="cursor-grab active:cursor-grabbing"
              >
                {/* Edges */}
                <g>
                  {relations.map(relation => {
                    const source = positions[relation.sourceId];
                    const target = positions[relation.targetId];
                    if (!source || !target) return null;
                    
                    const sourceEntity = entities.find(e => e.id === relation.sourceId);
                    const targetEntity = entities.find(e => e.id === relation.targetId);
                    if (!sourceEntity || !targetEntity) return null;
                    
                    const isFiltered = filteredEntities.includes(sourceEntity) && filteredEntities.includes(targetEntity);
                    
                    return (
                      <line
                        key={relation.id}
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={isFiltered ? '#94a3b8' : '#e2e8f0'}
                        strokeWidth={relation.strength * 2}
                        strokeOpacity={isFiltered ? 0.6 : 0.2}
                        markerEnd={!relation.bidirectional ? 'url(#arrowhead)' : undefined}
                      />
                    );
                  })}
                </g>

                {/* Arrow marker definition */}
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="10"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                  </marker>
                </defs>

                {/* Nodes */}
                <g>
                  {filteredEntities.map(entity => {
                    const pos = positions[entity.id];
                    if (!pos) return null;
                    
                    return (
                      <GraphNode
                        key={entity.id}
                        entity={entity}
                        x={pos.x}
                        y={pos.y}
                        selected={selectedEntity?.id === entity.id}
                        onSelect={() => setSelectedEntity(entity)}
                        scale={scale}
                      />
                    );
                  })}
                </g>
              </svg>

              {/* Entity Details Panel */}
              {selectedEntity && (
                <EntityDetailsPanel
                  entity={selectedEntity}
                  relations={relations}
                  entities={entities}
                  onClose={() => setSelectedEntity(null)}
                  onNavigate={(id) => {
                    const entity = entities.find(e => e.id === id);
                    if (entity) setSelectedEntity(entity);
                  }}
                />
              )}

              {/* Legend */}
              <div className="absolute bottom-4 left-4 p-3 bg-background/90 backdrop-blur-sm rounded-lg border shadow-sm">
                <p className="text-xs font-medium mb-2">Entity Types</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(ENTITY_TYPE_CONFIG).slice(0, 6).map(([type, config]) => {
                    const Icon = config.icon;
                    return (
                      <div key={type} className="flex items-center gap-1.5">
                        <div className={cn('p-1 rounded', config.bgColor)}>
                          <Icon className={cn('w-3 h-3', config.color)} />
                        </div>
                        <span className="text-xs capitalize">{config.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Clusters Panel */}
        <div className="space-y-4">
          <ClusterList 
            clusters={clusters} 
            onSelect={() => { /* Cluster selection handler */ }} 
          />
        </div>
      </div>
    </div>
  );
}

export default KnowledgeGraphVisualization;
