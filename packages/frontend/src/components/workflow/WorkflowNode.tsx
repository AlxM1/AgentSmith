import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Play,
  Webhook,
  Clock,
  GitBranch,
  Shuffle,
  GitMerge,
  Repeat,
  Edit,
  Code,
  Globe,
  Bot,
  Link,
  Pause,
  Minus,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const nodeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'agentsmith.manualTrigger': Play,
  'agentsmith.webhookTrigger': Webhook,
  'agentsmith.scheduleTrigger': Clock,
  'agentsmith.if': GitBranch,
  'agentsmith.switch': Shuffle,
  'agentsmith.merge': GitMerge,
  'agentsmith.loop': Repeat,
  'agentsmith.set': Edit,
  'agentsmith.code': Code,
  'agentsmith.httpRequest': Globe,
  'agentsmith.aiAgent': Bot,
  'agentsmith.aiChain': Link,
  'agentsmith.wait': Pause,
  'agentsmith.noOp': Minus,
};

const nodeColors: Record<string, string> = {
  trigger: 'border-green-500 bg-green-50 dark:bg-green-950',
  flow: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
  transform: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950',
  action: 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950',
  ai: 'border-pink-500 bg-pink-50 dark:bg-pink-950',
  utility: 'border-slate-500 bg-slate-50 dark:bg-slate-950',
};

function getNodeCategory(nodeType: string): string {
  if (nodeType.includes('Trigger')) return 'trigger';
  if (['if', 'switch', 'merge', 'loop'].some(t => nodeType.includes(t))) return 'flow';
  if (['set', 'code', 'function'].some(t => nodeType.includes(t))) return 'transform';
  if (['ai', 'agent', 'chain'].some(t => nodeType.toLowerCase().includes(t))) return 'ai';
  if (['wait', 'noOp'].some(t => nodeType.includes(t))) return 'utility';
  return 'action';
}

interface NodeData {
  label: string;
  nodeType: string;
  disabled?: boolean;
}

function WorkflowNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const Icon = nodeIcons[data.nodeType] || Play;
  const category = getNodeCategory(data.nodeType);
  const isTrigger = category === 'trigger';

  return (
    <div
      className={cn(
        'px-4 py-3 min-w-[160px] rounded-lg border-2 transition-all',
        nodeColors[category],
        selected && 'ring-2 ring-primary ring-offset-2',
        data.disabled && 'opacity-50'
      )}
    >
      {/* Input handle (not for triggers) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
        />
      )}

      {/* Node content */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-white/10 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{data.label}</div>
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
      />
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
