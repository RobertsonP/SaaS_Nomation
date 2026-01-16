import { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  ConnectionLineType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import SiteMapNode from './SiteMapNode';
import SiteMapLegend from './SiteMapLegend';

interface SiteMapNodeData {
  id: string;
  url: string;
  title: string;
  analyzed: boolean;
  verified: boolean;
  requiresAuth: boolean;
  pageType?: string;
  discovered: boolean;
  depth?: number;
}

interface SiteMapEdgeData {
  id: string;
  source: string;
  target: string;
  linkText?: string;
  linkType: string;
}

interface SiteMapGraphProps {
  nodes: SiteMapNodeData[];
  edges: SiteMapEdgeData[];
  selectedNodes?: string[];
  onNodeSelect?: (nodeId: string, selected: boolean) => void;
  selectable?: boolean;
  className?: string;
}

// Custom node types - typed as any to avoid complex generic issues with @xyflow/react
const nodeTypes = {
  siteMapNode: SiteMapNode,
} as const;

// Simple tree layout for hierarchical graph
function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = new Map<string, Node>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // Find root nodes (nodes with no incoming edges)
  const hasIncoming = new Set(edges.map(e => e.target));
  const rootNodes = nodes.filter(n => !hasIncoming.has(n.id));

  // If no clear root, use first node
  if (rootNodes.length === 0 && nodes.length > 0) {
    rootNodes.push(nodes[0]);
  }

  // BFS to assign positions
  const visited = new Set<string>();
  const positions = new Map<string, { x: number; y: number }>();
  const levelNodes = new Map<number, string[]>();

  const queue: { id: string; level: number }[] = rootNodes.map(n => ({ id: n.id, level: 0 }));

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    if (!levelNodes.has(level)) {
      levelNodes.set(level, []);
    }
    levelNodes.get(level)!.push(id);

    // Find children
    const children = edges
      .filter(e => e.source === id)
      .map(e => e.target)
      .filter(t => !visited.has(t));

    children.forEach(childId => {
      queue.push({ id: childId, level: level + 1 });
    });
  }

  // Calculate positions
  const horizontalSpacing = 280;
  const verticalSpacing = 150;

  levelNodes.forEach((nodeIds, level) => {
    const totalWidth = (nodeIds.length - 1) * horizontalSpacing;
    const startX = -totalWidth / 2;

    nodeIds.forEach((nodeId, index) => {
      positions.set(nodeId, {
        x: startX + index * horizontalSpacing,
        y: level * verticalSpacing,
      });
    });
  });

  // Handle unvisited nodes (disconnected)
  let disconnectedY = (levelNodes.size + 1) * verticalSpacing;
  let disconnectedX = 0;
  nodes.forEach(node => {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: disconnectedX, y: disconnectedY });
      disconnectedX += horizontalSpacing;
      if (disconnectedX > 1000) {
        disconnectedX = 0;
        disconnectedY += verticalSpacing;
      }
    }
  });

  // Apply positions
  const layoutedNodes = nodes.map(node => ({
    ...node,
    position: positions.get(node.id) || { x: 0, y: 0 },
  }));

  return { nodes: layoutedNodes, edges };
}

export function SiteMapGraph({
  nodes: inputNodes,
  edges: inputEdges,
  selectedNodes = [],
  onNodeSelect,
  selectable = false,
  className = '',
}: SiteMapGraphProps) {
  // Transform input data to ReactFlow format
  const initialNodes: Node[] = useMemo(() => {
    return inputNodes.map(node => ({
      id: node.id,
      type: 'siteMapNode',
      position: { x: 0, y: 0 },
      data: {
        ...node,
        selected: selectedNodes.includes(node.id),
        onSelect: selectable ? (id: string) => {
          const isSelected = selectedNodes.includes(id);
          onNodeSelect?.(id, !isSelected);
        } : undefined,
      },
    }));
  }, [inputNodes, selectedNodes, selectable, onNodeSelect]);

  const initialEdges: Edge[] = useMemo(() => {
    return inputEdges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.linkText?.substring(0, 20),
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: '#94a3b8',
      },
    }));
  }, [inputEdges]);

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    return getLayoutedElements(initialNodes, initialEdges);
  }, [initialNodes, initialEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes when selection changes
  useEffect(() => {
    setNodes(nds =>
      nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          selected: selectedNodes.includes(node.id),
        },
      }))
    );
  }, [selectedNodes, setNodes]);

  // Stats
  const stats = useMemo(() => ({
    total: inputNodes.length,
    analyzed: inputNodes.filter(n => n.analyzed).length,
    requiresAuth: inputNodes.filter(n => n.requiresAuth).length,
    discovered: inputNodes.filter(n => n.discovered).length,
  }), [inputNodes]);

  return (
    <div className={`relative ${className}`}>
      {/* Stats bar */}
      <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur rounded-lg shadow px-3 py-2 flex gap-4 text-sm">
        <span className="text-gray-600">
          <strong className="text-gray-900">{stats.total}</strong> pages
        </span>
        <span className="text-green-600">
          <strong>{stats.analyzed}</strong> analyzed
        </span>
        {stats.requiresAuth > 0 && (
          <span className="text-orange-600">
            <strong>{stats.requiresAuth}</strong> auth
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="absolute top-2 right-2 z-10">
        <SiteMapLegend />
      </div>

      {/* Graph */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls
          showZoom={true}
          showFitView={true}
          showInteractive={false}
          position="bottom-left"
        />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as Record<string, unknown>;
            if (data?.requiresAuth) return '#f97316';
            if (data?.analyzed) return '#22c55e';
            return '#94a3b8';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          position="bottom-right"
        />
      </ReactFlow>
    </div>
  );
}

export default SiteMapGraph;
