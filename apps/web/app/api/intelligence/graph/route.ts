import { NextRequest, NextResponse } from 'next/server';

// Mock knowledge graph data
const mockNodes = [
  { id: 'c1', type: 'contract', label: 'Master Agreement - Acme Corp', data: { value: 1200000, status: 'active' } },
  { id: 'c2', type: 'contract', label: 'SLA - Cloud Services', data: { value: 450000, status: 'active' } },
  { id: 's1', type: 'supplier', label: 'Acme Corporation', data: { rating: 4.5, contracts: 3 } },
  { id: 'cl1', type: 'clause', label: 'Liability Limitation', data: { risk: 'medium' } },
  { id: 'r1', type: 'risk', label: 'Vendor Lock-in Risk', data: { severity: 'medium' } },
];

const mockEdges = [
  { id: 'e1', source: 'c1', target: 's1', type: 'supplies', strength: 0.9 },
  { id: 'e2', source: 'c2', target: 's1', type: 'supplies', strength: 0.7 },
  { id: 'e3', source: 'c1', target: 'cl1', type: 'contains', strength: 0.8 },
  { id: 'e4', source: 'c1', target: 'r1', type: 'relates', strength: 0.6 },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get('nodeId');
  const nodeType = searchParams.get('type');
  const depth = parseInt(searchParams.get('depth') || '2');

  let nodes = [...mockNodes];
  let edges = [...mockEdges];

  if (nodeType) {
    nodes = nodes.filter(n => n.type === nodeType);
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = edges.filter(e => nodeIds.has(e.source) || nodeIds.has(e.target));
  }

  if (nodeId) {
    // Get connected nodes up to specified depth
    const connectedIds = new Set<string>([nodeId]);
    for (let i = 0; i < depth; i++) {
      edges.forEach(e => {
        if (connectedIds.has(e.source)) connectedIds.add(e.target);
        if (connectedIds.has(e.target)) connectedIds.add(e.source);
      });
    }
    nodes = nodes.filter(n => connectedIds.has(n.id));
    edges = edges.filter(e => connectedIds.has(e.source) && connectedIds.has(e.target));
  }

  return NextResponse.json({
    success: true,
    data: {
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        nodeTypes: {
          contracts: nodes.filter(n => n.type === 'contract').length,
          suppliers: nodes.filter(n => n.type === 'supplier').length,
          clauses: nodes.filter(n => n.type === 'clause').length,
          risks: nodes.filter(n => n.type === 'risk').length,
        },
      },
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, nodeId, targetId, relationshipType: _relationshipType } = body;

    if (action === 'explore') {
      // Get node and its immediate connections
      const node = mockNodes.find(n => n.id === nodeId);
      if (!node) {
        return NextResponse.json(
          { success: false, error: 'Node not found' },
          { status: 404 }
        );
      }

      const connectedEdges = mockEdges.filter(e => e.source === nodeId || e.target === nodeId);
      const connectedNodeIds = new Set(
        connectedEdges.flatMap(e => [e.source, e.target]).filter(id => id !== nodeId)
      );
      const connectedNodes = mockNodes.filter(n => connectedNodeIds.has(n.id));

      return NextResponse.json({
        success: true,
        data: {
          node,
          connections: connectedNodes,
          edges: connectedEdges,
        },
      });
    }

    if (action === 'path') {
      // Find path between two nodes
      // Simplified implementation - in production use proper graph algorithms
      return NextResponse.json({
        success: true,
        data: {
          path: [nodeId, targetId],
          length: 1,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (_error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
