import { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Save,
  Play,
  ArrowLeft,
  Settings,
  Plus,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toaster';
import { workflowApi } from '../lib/api';
import { useWorkflowStore } from '../stores/workflowStore';
import { WorkflowNode } from '../components/workflow/WorkflowNode';
import { NodePanel } from '../components/workflow/NodePanel';
import { NodePropertiesPanel } from '../components/workflow/NodePropertiesPanel';

const nodeTypes = {
  workflowNode: WorkflowNode,
};

export function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();

  const [isNodePanelOpen, setIsNodePanelOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);

  const {
    workflow,
    nodes,
    edges,
    isDirty,
    selectedNodeId,
    setWorkflow,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    getWorkflowData,
    markClean,
  } = useWorkflowStore();

  // Load workflow
  const { isLoading } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowApi.get(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (id) {
      workflowApi.get(id).then((response) => {
        if (response.success && response.data) {
          setWorkflow(response.data as any);
        }
      });
    }
  }, [id, setWorkflow]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id || !workflow) return;
      const { nodes: workflowNodes, connections } = getWorkflowData();
      return workflowApi.update(id, {
        name: workflow.name,
        description: workflow.description,
        nodes: workflowNodes,
        connections,
        settings: workflow.settings,
        tags: workflow.tags,
      });
    },
    onSuccess: () => {
      markClean();
      toast({ title: 'Workflow saved', type: 'success' });
    },
    onError: () => {
      toast({ title: 'Failed to save workflow', type: 'error' });
    },
  });

  // Execute mutation
  const executeMutation = useMutation({
    mutationFn: () => workflowApi.execute(id!),
    onSuccess: (response) => {
      if (response.success) {
        toast({ title: 'Workflow execution started', type: 'success' });
      }
    },
    onError: () => {
      toast({ title: 'Failed to execute workflow', type: 'error' });
    },
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  const handleExecute = useCallback(() => {
    executeMutation.mutate();
  }, [executeMutation]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow');
      if (!nodeType) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(nodeType, position);
    },
    [reactFlowInstance, addNode]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNode(node.id);
      setIsPropertiesOpen(true);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setIsPropertiesOpen(false);
  }, [setSelectedNode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/workflows')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Input
            value={workflow?.name || ''}
            onChange={(e) =>
              useWorkflowStore.getState().updateWorkflowMeta({ name: e.target.value })
            }
            className="w-64 font-medium"
          />
          {isDirty && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsNodePanelOpen(!isNodePanelOpen)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Node
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saveMutation.isPending || !isDirty}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </Button>
          <Button onClick={handleExecute} disabled={executeMutation.isPending}>
            {executeMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Execute
          </Button>
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 flex">
        {/* Node panel */}
        {isNodePanelOpen && (
          <NodePanel onClose={() => setIsNodePanelOpen(false)} />
        )}

        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
          >
            <Background gap={15} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* Properties panel */}
        {isPropertiesOpen && selectedNodeId && (
          <NodePropertiesPanel
            nodeId={selectedNodeId}
            onClose={() => {
              setIsPropertiesOpen(false);
              setSelectedNode(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
