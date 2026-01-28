import { X, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useWorkflowStore } from '../../stores/workflowStore';

interface NodePropertiesPanelProps {
  nodeId: string;
  onClose: () => void;
}

export function NodePropertiesPanel({ nodeId, onClose }: NodePropertiesPanelProps) {
  const { nodes, updateNodeData, deleteNode } = useWorkflowStore();

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const handleNameChange = (name: string) => {
    updateNodeData(nodeId, { label: name, name });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this node?')) {
      deleteNode(nodeId);
      onClose();
    }
  };

  return (
    <div className="w-80 border-l bg-card flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Node Properties</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Node name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Name</label>
          <Input
            value={node.data.label || ''}
            onChange={(e) => handleNameChange(e.target.value)}
          />
        </div>

        {/* Node type info */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <div className="text-sm text-muted-foreground">
            {node.data.nodeType}
          </div>
        </div>

        {/* Parameters */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Parameters</label>
          <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
            <p className="mb-2">
              Configure this node's parameters in the JSON editor below:
            </p>
            <textarea
              className="w-full h-32 p-2 font-mono text-xs bg-background border rounded"
              value={JSON.stringify(node.data.parameters || {}, null, 2)}
              onChange={(e) => {
                try {
                  const params = JSON.parse(e.target.value);
                  updateNodeData(nodeId, { parameters: params });
                } catch {
                  // Invalid JSON, ignore
                }
              }}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            className="w-full h-24 p-2 text-sm bg-background border rounded resize-none"
            placeholder="Add notes about this node..."
            value={node.data.notes || ''}
            onChange={(e) => updateNodeData(nodeId, { notes: e.target.value })}
          />
        </div>
      </div>

      {/* Delete button */}
      <div className="p-4 border-t">
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleDelete}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Node
        </Button>
      </div>
    </div>
  );
}
