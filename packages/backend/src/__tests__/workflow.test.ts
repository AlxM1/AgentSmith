// Workflow Tests
import { describe, it, expect, beforeEach } from 'vitest';

// Workflow validation helper
interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  parameters?: Record<string, unknown>;
}

interface WorkflowConnection {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

const validateWorkflow = (workflow: Partial<Workflow>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Name validation
  if (!workflow.name || workflow.name.trim().length === 0) {
    errors.push('Workflow name is required');
  } else if (workflow.name.length > 255) {
    errors.push('Workflow name must be less than 255 characters');
  }

  // Nodes validation
  if (!workflow.nodes) {
    errors.push('Workflow must have nodes array');
  } else {
    // Check for duplicate node IDs
    const nodeIds = workflow.nodes.map(n => n.id);
    const uniqueIds = new Set(nodeIds);
    if (nodeIds.length !== uniqueIds.size) {
      errors.push('Duplicate node IDs found');
    }

    // Validate each node
    workflow.nodes.forEach((node, index) => {
      if (!node.id) {
        errors.push(`Node at index ${index} missing id`);
      }
      if (!node.type) {
        errors.push(`Node ${node.id || index} missing type`);
      }
      if (!node.name) {
        errors.push(`Node ${node.id || index} missing name`);
      }
      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        errors.push(`Node ${node.id || index} has invalid position`);
      }
    });
  }

  // Connections validation
  if (workflow.connections && workflow.nodes) {
    const nodeIds = new Set(workflow.nodes.map(n => n.id));

    workflow.connections.forEach((conn, index) => {
      if (!nodeIds.has(conn.source)) {
        errors.push(`Connection ${index} references non-existent source node: ${conn.source}`);
      }
      if (!nodeIds.has(conn.target)) {
        errors.push(`Connection ${index} references non-existent target node: ${conn.target}`);
      }
      if (conn.source === conn.target) {
        errors.push(`Connection ${index} has same source and target node`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
};

// Check for cycles in workflow
const hasCycle = (nodes: WorkflowNode[], connections: WorkflowConnection[]): boolean => {
  const graph = new Map<string, string[]>();

  // Build adjacency list
  nodes.forEach(node => {
    graph.set(node.id, []);
  });

  connections.forEach(conn => {
    const neighbors = graph.get(conn.source) || [];
    neighbors.push(conn.target);
    graph.set(conn.source, neighbors);
  });

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
};

// Find trigger nodes
const findTriggerNodes = (nodes: WorkflowNode[]): WorkflowNode[] => {
  const triggerTypes = [
    'n8n-nodes-base.webhook',
    'n8n-nodes-base.scheduleTrigger',
    'n8n-nodes-base.manualTrigger',
    'n8n-nodes-base.emailTrigger'
  ];

  return nodes.filter(node => triggerTypes.includes(node.type));
};

describe('Workflow Validation', () => {
  describe('Basic Validation', () => {
    it('should validate a valid workflow', () => {
      const workflow: Partial<Workflow> = {
        name: 'Test Workflow',
        nodes: [
          { id: 'node_1', type: 'webhook', name: 'Trigger', position: { x: 0, y: 0 } },
          { id: 'node_2', type: 'http', name: 'HTTP Request', position: { x: 200, y: 0 } }
        ],
        connections: [
          { source: 'node_1', sourceHandle: 'main', target: 'node_2', targetHandle: 'main' }
        ]
      };

      const result = validateWorkflow(workflow);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject workflow without name', () => {
      const workflow: Partial<Workflow> = {
        name: '',
        nodes: [],
        connections: []
      };

      const result = validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow name is required');
    });

    it('should reject workflow with long name', () => {
      const workflow: Partial<Workflow> = {
        name: 'a'.repeat(300),
        nodes: [],
        connections: []
      };

      const result = validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow name must be less than 255 characters');
    });
  });

  describe('Node Validation', () => {
    it('should detect duplicate node IDs', () => {
      const workflow: Partial<Workflow> = {
        name: 'Test',
        nodes: [
          { id: 'node_1', type: 'webhook', name: 'Trigger', position: { x: 0, y: 0 } },
          { id: 'node_1', type: 'http', name: 'HTTP', position: { x: 200, y: 0 } }
        ],
        connections: []
      };

      const result = validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Duplicate node IDs found');
    });

    it('should require node type', () => {
      const workflow: Partial<Workflow> = {
        name: 'Test',
        nodes: [
          { id: 'node_1', type: '', name: 'Node', position: { x: 0, y: 0 } }
        ],
        connections: []
      };

      const result = validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing type'))).toBe(true);
    });

    it('should require valid position', () => {
      const workflow: Partial<Workflow> = {
        name: 'Test',
        nodes: [
          { id: 'node_1', type: 'webhook', name: 'Node', position: { x: 0 } as { x: number; y: number } }
        ],
        connections: []
      };

      const result = validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid position'))).toBe(true);
    });
  });

  describe('Connection Validation', () => {
    it('should detect invalid source node reference', () => {
      const workflow: Partial<Workflow> = {
        name: 'Test',
        nodes: [
          { id: 'node_1', type: 'webhook', name: 'Trigger', position: { x: 0, y: 0 } }
        ],
        connections: [
          { source: 'invalid', sourceHandle: 'main', target: 'node_1', targetHandle: 'main' }
        ]
      };

      const result = validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-existent source'))).toBe(true);
    });

    it('should detect self-referencing connections', () => {
      const workflow: Partial<Workflow> = {
        name: 'Test',
        nodes: [
          { id: 'node_1', type: 'webhook', name: 'Trigger', position: { x: 0, y: 0 } }
        ],
        connections: [
          { source: 'node_1', sourceHandle: 'main', target: 'node_1', targetHandle: 'main' }
        ]
      };

      const result = validateWorkflow(workflow);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('same source and target'))).toBe(true);
    });
  });

  describe('Cycle Detection', () => {
    it('should detect cycles in workflow', () => {
      const nodes: WorkflowNode[] = [
        { id: 'a', type: 'node', name: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'node', name: 'B', position: { x: 100, y: 0 } },
        { id: 'c', type: 'node', name: 'C', position: { x: 200, y: 0 } }
      ];

      const connections: WorkflowConnection[] = [
        { source: 'a', sourceHandle: 'main', target: 'b', targetHandle: 'main' },
        { source: 'b', sourceHandle: 'main', target: 'c', targetHandle: 'main' },
        { source: 'c', sourceHandle: 'main', target: 'a', targetHandle: 'main' } // Creates cycle
      ];

      expect(hasCycle(nodes, connections)).toBe(true);
    });

    it('should not detect cycle in valid DAG', () => {
      const nodes: WorkflowNode[] = [
        { id: 'a', type: 'node', name: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'node', name: 'B', position: { x: 100, y: 0 } },
        { id: 'c', type: 'node', name: 'C', position: { x: 200, y: 0 } }
      ];

      const connections: WorkflowConnection[] = [
        { source: 'a', sourceHandle: 'main', target: 'b', targetHandle: 'main' },
        { source: 'b', sourceHandle: 'main', target: 'c', targetHandle: 'main' }
      ];

      expect(hasCycle(nodes, connections)).toBe(false);
    });

    it('should handle disconnected components', () => {
      const nodes: WorkflowNode[] = [
        { id: 'a', type: 'node', name: 'A', position: { x: 0, y: 0 } },
        { id: 'b', type: 'node', name: 'B', position: { x: 100, y: 0 } },
        { id: 'c', type: 'node', name: 'C', position: { x: 0, y: 100 } },
        { id: 'd', type: 'node', name: 'D', position: { x: 100, y: 100 } }
      ];

      const connections: WorkflowConnection[] = [
        { source: 'a', sourceHandle: 'main', target: 'b', targetHandle: 'main' },
        { source: 'c', sourceHandle: 'main', target: 'd', targetHandle: 'main' }
      ];

      expect(hasCycle(nodes, connections)).toBe(false);
    });
  });

  describe('Trigger Detection', () => {
    it('should find trigger nodes', () => {
      const nodes: WorkflowNode[] = [
        { id: '1', type: 'n8n-nodes-base.webhook', name: 'Webhook', position: { x: 0, y: 0 } },
        { id: '2', type: 'n8n-nodes-base.httpRequest', name: 'HTTP', position: { x: 200, y: 0 } },
        { id: '3', type: 'n8n-nodes-base.scheduleTrigger', name: 'Schedule', position: { x: 0, y: 100 } }
      ];

      const triggers = findTriggerNodes(nodes);
      expect(triggers).toHaveLength(2);
      expect(triggers.map(t => t.id)).toContain('1');
      expect(triggers.map(t => t.id)).toContain('3');
    });

    it('should return empty array if no triggers', () => {
      const nodes: WorkflowNode[] = [
        { id: '1', type: 'n8n-nodes-base.httpRequest', name: 'HTTP', position: { x: 0, y: 0 } },
        { id: '2', type: 'n8n-nodes-base.set', name: 'Set', position: { x: 200, y: 0 } }
      ];

      const triggers = findTriggerNodes(nodes);
      expect(triggers).toHaveLength(0);
    });
  });
});
