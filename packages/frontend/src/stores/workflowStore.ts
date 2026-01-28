import { create } from 'zustand';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect } from 'reactflow';
import { applyNodeChanges, applyEdgeChanges, addEdge } from 'reactflow';
import type { IWorkflow, INode, IConnection } from '@agentsmith/shared';
import { generateNodeId } from '@agentsmith/shared';

interface WorkflowState {
  // Current workflow
  workflow: IWorkflow | null;
  isDirty: boolean;

  // React Flow state
  nodes: Node[];
  edges: Edge[];

  // Selection
  selectedNodeId: string | null;

  // Actions
  setWorkflow: (workflow: IWorkflow) => void;
  clearWorkflow: () => void;
  updateWorkflowMeta: (data: Partial<IWorkflow>) => void;

  // Node/Edge manipulation
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (nodeType: string, position: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Record<string, unknown>) => void;

  // Selection
  setSelectedNode: (nodeId: string | null) => void;

  // Serialization
  getWorkflowData: () => { nodes: INode[]; connections: IConnection[] };
  markClean: () => void;
}

// Convert internal nodes to INode format
function convertToINodes(nodes: Node[]): INode[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.data.label || node.data.name || node.type || 'Node',
    type: node.data.nodeType || node.type || '',
    typeVersion: node.data.typeVersion || 1,
    position: { x: node.position.x, y: node.position.y },
    parameters: node.data.parameters || {},
    credentials: node.data.credentials,
    disabled: node.data.disabled,
    notes: node.data.notes,
  }));
}

// Convert internal edges to IConnection format
function convertToConnections(edges: Edge[]): IConnection[] {
  return edges.map((edge) => ({
    source: edge.source,
    sourceHandle: edge.sourceHandle || undefined,
    target: edge.target,
    targetHandle: edge.targetHandle || undefined,
    type: edge.type,
  }));
}

// Convert INode to React Flow Node
function convertFromINode(node: INode): Node {
  return {
    id: node.id,
    type: 'workflowNode',
    position: node.position,
    data: {
      label: node.name,
      name: node.name,
      nodeType: node.type,
      typeVersion: node.typeVersion,
      parameters: node.parameters,
      credentials: node.credentials,
      disabled: node.disabled,
      notes: node.notes,
    },
  };
}

// Convert IConnection to React Flow Edge
function convertFromConnection(conn: IConnection): Edge {
  return {
    id: `${conn.source}-${conn.target}`,
    source: conn.source,
    sourceHandle: conn.sourceHandle,
    target: conn.target,
    targetHandle: conn.targetHandle,
    type: 'smoothstep',
    animated: true,
  };
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflow: null,
  isDirty: false,
  nodes: [],
  edges: [],
  selectedNodeId: null,

  setWorkflow: (workflow) => {
    const nodes = workflow.nodes.map(convertFromINode);
    const edges = workflow.connections.map(convertFromConnection);
    set({ workflow, nodes, edges, isDirty: false, selectedNodeId: null });
  },

  clearWorkflow: () => {
    set({ workflow: null, nodes: [], edges: [], isDirty: false, selectedNodeId: null });
  },

  updateWorkflowMeta: (data) => {
    set((state) => ({
      workflow: state.workflow ? { ...state.workflow, ...data } : null,
      isDirty: true,
    }));
  },

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      isDirty: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      isDirty: true,
    }));
  },

  onConnect: (connection) => {
    set((state) => ({
      edges: addEdge(
        { ...connection, type: 'smoothstep', animated: true },
        state.edges
      ),
      isDirty: true,
    }));
  },

  addNode: (nodeType, position) => {
    const nodeId = generateNodeId();
    const nodeTypeInfo = getNodeTypeInfo(nodeType);

    const newNode: Node = {
      id: nodeId,
      type: 'workflowNode',
      position,
      data: {
        label: nodeTypeInfo.displayName,
        name: nodeTypeInfo.displayName,
        nodeType,
        typeVersion: 1,
        parameters: {},
      },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
      isDirty: true,
      selectedNodeId: nodeId,
    }));
  },

  deleteNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      isDirty: true,
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
    }));
  },

  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
      isDirty: true,
    }));
  },

  setSelectedNode: (nodeId) => {
    set({ selectedNodeId: nodeId });
  },

  getWorkflowData: () => {
    const state = get();
    return {
      nodes: convertToINodes(state.nodes),
      connections: convertToConnections(state.edges),
    };
  },

  markClean: () => {
    set({ isDirty: false });
  },
}));

// Helper to get node type display info
function getNodeTypeInfo(nodeType: string): { displayName: string } {
  const nodeTypes: Record<string, string> = {
    'agentsmith.manualTrigger': 'Manual Trigger',
    'agentsmith.webhookTrigger': 'Webhook',
    'agentsmith.scheduleTrigger': 'Schedule',
    'agentsmith.if': 'IF',
    'agentsmith.switch': 'Switch',
    'agentsmith.merge': 'Merge',
    'agentsmith.loop': 'Loop',
    'agentsmith.set': 'Set',
    'agentsmith.code': 'Code',
    'agentsmith.httpRequest': 'HTTP Request',
    'agentsmith.aiAgent': 'AI Agent',
    'agentsmith.aiChain': 'AI Chain',
    'agentsmith.wait': 'Wait',
    'agentsmith.noOp': 'No Op',
  };

  return { displayName: nodeTypes[nodeType] || 'Node' };
}
