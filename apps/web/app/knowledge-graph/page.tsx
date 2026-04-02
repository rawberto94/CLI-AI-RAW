'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface KnowledgeGraphNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, any>;
  contractIds: string[];
}

interface KnowledgeGraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  weight: number;
  properties: Record<string, any>;
}

export default function KnowledgeGraphPage() {
  const [loading, setLoading] = useState(false);
  const [graph, setGraph] = useState<{ nodes: KnowledgeGraphNode[]; edges: KnowledgeGraphEdge[] } | null>(null);
  const [entitySearch, setEntitySearch] = useState('');
  const [relatedContracts, setRelatedContracts] = useState<any[]>([]);
  const [entityNetwork, setEntityNetwork] = useState<any>(null);

  const handleBuildGraph = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge-graph?action=build');
      const data = await res.json();
      
      if (data.success) {
        setGraph(data.graph);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleSearchEntity = async () => {
    if (!entitySearch) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge-graph?action=find_related&entity=${encodeURIComponent(entitySearch)}`);
      const data = await res.json();
      
      if (data.success) {
        setRelatedContracts(data.contracts);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleGetNetwork = async () => {
    if (!entitySearch) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/knowledge-graph?action=entity_network&entity=${encodeURIComponent(entitySearch)}`);
      const data = await res.json();
      
      if (data.success) {
        setEntityNetwork(data.network);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Graph Explorer</h1>
          <p className="text-muted-foreground">Explore entities and relationships across your contracts</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Graph Overview</TabsTrigger>
          <TabsTrigger value="search">Entity Search</TabsTrigger>
          <TabsTrigger value="network">Entity Network</TabsTrigger>
        </TabsList>

        {/* Graph Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Graph</CardTitle>
              <CardDescription>
                Build and visualize the complete knowledge graph across all contracts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleBuildGraph} disabled={loading}>
                {loading ? 'Building...' : 'Build Knowledge Graph'}
              </Button>

              {graph && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{graph.nodes.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Total Edges</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{graph.edges.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Node Types</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{new Set(graph.nodes.map(n => n.type)).size}</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Node Types Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Entity Types</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Array.from(new Set(graph.nodes.map(n => n.type))).map(type => {
                          const count = graph.nodes.filter(n => n.type === type).length;
                          return (
                            <div key={type} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{type}</Badge>
                                <span className="text-sm text-muted-foreground">{count} entities</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Entities by Connections */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Most Connected Entities</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {graph.nodes
                          .sort((a, b) => b.contractIds.length - a.contractIds.length)
                          .slice(0, 10)
                          .map(node => (
                            <div key={node.id} className="flex items-center justify-between border-b pb-2">
                              <div>
                                <div className="font-medium">{node.label}</div>
                                <div className="text-sm text-muted-foreground">{node.type}</div>
                              </div>
                              <Badge>{node.contractIds.length} contracts</Badge>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entity Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Find Related Contracts</CardTitle>
              <CardDescription>
                Search for an entity and find all contracts that mention it
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="entity-search">Entity Name</Label>
                  <Input
                    id="entity-search"
                    placeholder="e.g. Company Name, Person, Location..."
                    value={entitySearch}
                    onChange={(e) => setEntitySearch(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleSearchEntity} disabled={loading || !entitySearch}>
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
              </div>

              {relatedContracts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Found {relatedContracts.length} Related Contracts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {relatedContracts.map(contract => (
                        <div key={contract.id} className="border-b pb-3 last:border-0">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="font-medium">{contract.contractTitle || contract.fileName}</div>
                              <div className="text-sm text-muted-foreground">
                                Supplier: {contract.supplierName || 'N/A'}
                              </div>
                              <div className="text-sm">
                                Value: ${contract.contractValue?.toLocaleString() || 'N/A'}
                              </div>
                            </div>
                            <Badge>{contract.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entity Network Tab */}
        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Entity Network Analysis</CardTitle>
              <CardDescription>
                Explore how entities are connected across your contracts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="network-entity">Entity Name</Label>
                  <Input
                    id="network-entity"
                    placeholder="e.g. Company Name"
                    value={entitySearch}
                    onChange={(e) => setEntitySearch(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleGetNetwork} disabled={loading || !entitySearch}>
                    {loading ? 'Analyzing...' : 'Analyze Network'}
                  </Button>
                </div>
              </div>

              {entityNetwork && (
                <Card>
                  <CardHeader>
                    <CardTitle>Related Entities for &ldquo;{entityNetwork.entity}&rdquo;</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {entityNetwork.relatedEntities.map((related: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <div>
                            <div className="font-medium">{related.entity}</div>
                            <div className="text-sm text-muted-foreground">{related.relationship}</div>
                          </div>
                          <Badge variant="secondary">{related.count} co-occurrences</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
