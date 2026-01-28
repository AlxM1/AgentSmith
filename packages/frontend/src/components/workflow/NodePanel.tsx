import { useState } from 'react';
import { X, Search, Play, Webhook, Clock, GitBranch, Edit, Code, Globe, Bot, Pause } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { cn } from '../../lib/utils';

interface NodeType {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

const nodeTypes: NodeType[] = [
  // Triggers
  { type: 'agentsmith.manualTrigger', label: 'Manual Trigger', description: 'Start workflow manually', icon: Play, category: 'Triggers' },
  { type: 'agentsmith.webhookTrigger', label: 'Webhook', description: 'Trigger via HTTP request', icon: Webhook, category: 'Triggers' },
  { type: 'agentsmith.scheduleTrigger', label: 'Schedule', description: 'Trigger on schedule', icon: Clock, category: 'Triggers' },

  // Flow
  { type: 'agentsmith.if', label: 'IF', description: 'Conditional branching', icon: GitBranch, category: 'Flow' },
  { type: 'agentsmith.switch', label: 'Switch', description: 'Multiple conditions', icon: GitBranch, category: 'Flow' },
  { type: 'agentsmith.merge', label: 'Merge', description: 'Combine inputs', icon: GitBranch, category: 'Flow' },

  // Transform
  { type: 'agentsmith.set', label: 'Set', description: 'Set values', icon: Edit, category: 'Transform' },
  { type: 'agentsmith.code', label: 'Code', description: 'Execute JavaScript', icon: Code, category: 'Transform' },

  // Actions
  { type: 'agentsmith.httpRequest', label: 'HTTP Request', description: 'Make API calls', icon: Globe, category: 'Actions' },

  // AI
  { type: 'agentsmith.aiAgent', label: 'AI Agent', description: 'AI with tools', icon: Bot, category: 'AI' },
  { type: 'agentsmith.aiChain', label: 'AI Chain', description: 'Chain of prompts', icon: Bot, category: 'AI' },

  // Utility
  { type: 'agentsmith.wait', label: 'Wait', description: 'Pause execution', icon: Pause, category: 'Utility' },
];

interface NodePanelProps {
  onClose: () => void;
}

export function NodePanel({ onClose }: NodePanelProps) {
  const [search, setSearch] = useState('');

  const filteredNodes = nodeTypes.filter(
    (node) =>
      node.label.toLowerCase().includes(search.toLowerCase()) ||
      node.description.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(filteredNodes.map((n) => n.category))];

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 border-r bg-card flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Add Node</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {categories.map((category) => (
          <div key={category} className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {category}
            </h4>
            <div className="space-y-1">
              {filteredNodes
                .filter((n) => n.category === category)
                .map((node) => (
                  <div
                    key={node.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, node.type)}
                    className="flex items-center gap-3 p-2 rounded-lg border cursor-grab hover:bg-muted transition-colors"
                  >
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <node.icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{node.label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {node.description}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
