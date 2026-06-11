import { useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useState, useEffect } from 'react';

// Dagre would be better for auto-layout, but for MVP we will use a simple force-directed or manual layout
// We'll just scatter them a bit based on index for the MVP

const generateLayout = (nodes: any[]) => {
  return nodes.map((n, i) => ({
    ...n,
    position: { x: (i % 3) * 200 + 50, y: Math.floor(i / 3) * 150 + 50 }
  }));
};

const getColorForLabel = (label: string) => {
    switch(label) {
        case 'User': return '#3b82f6';
        case 'Project': return '#10b981';
        case 'Style': return '#8b5cf6';
        case 'Policy': return '#ef4444';
        case 'Team': return '#f59e0b';
        case 'Organization': return '#64748b';
        default: return '#ccc';
    }
}

export default function GraphView({ data }: { data: any }) {
  const [nodes, setNodes] = useState<any>([]);
  const [edges, setEdges] = useState<any>([]);

  useEffect(() => {
    if (data && data.nodes) {
        const formattedNodes = data.nodes.map((n: any) => ({
            id: n.id.toString(),
            data: { label: `${n.label}\n${n.properties.name || n.properties.role || n.properties.ruleText?.substring(0,20)+'...' || n.properties.formattingRules?.substring(0,20)+'...' || ''}` },
            style: { 
                background: getColorForLabel(n.label), 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                padding: '10px',
                fontSize: '12px',
                fontWeight: 'bold',
                width: 150,
                textAlign: 'center'
            }
        }));
        
        setNodes(generateLayout(formattedNodes));

        const formattedEdges = data.edges.map((e: any) => ({
            id: e.id.toString(),
            source: e.source.toString(),
            target: e.target.toString(),
            label: e.type,
            animated: e.properties?.status === 'Active'
        }));
        
        setEdges(formattedEdges);
    }
  }, [data]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds: any) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds: any) => applyEdgeChanges(changes, eds)),
    [],
  );

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
