// Execution Comparison Tool
import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  X,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  Search
} from 'lucide-react';
import { api } from '../lib/api';

interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  mode: string;
  data: {
    resultData?: {
      runData?: Record<string, Array<{
        data: { main: Array<Array<{ json: unknown }>> };
        executionTime?: number;
        error?: { message: string };
      }>>;
    };
  };
  startedAt: string;
  finishedAt: string;
}

interface ExecutionComparisonProps {
  workflowId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface NodeDiff {
  nodeName: string;
  leftStatus: 'success' | 'error' | 'missing';
  rightStatus: 'success' | 'error' | 'missing';
  leftData: unknown;
  rightData: unknown;
  leftTime?: number;
  rightTime?: number;
  differences: string[];
}

export const ExecutionComparison: React.FC<ExecutionComparisonProps> = ({
  workflowId,
  isOpen,
  onClose
}) => {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [leftExecution, setLeftExecution] = useState<Execution | null>(null);
  const [rightExecution, setRightExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [nodeDiffs, setNodeDiffs] = useState<NodeDiff[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && workflowId) {
      fetchExecutions();
    }
  }, [isOpen, workflowId]);

  const fetchExecutions = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/executions?workflowId=${workflowId}&perPage=50`);
      if (response.data.success) {
        setExecutions(response.data.data?.executions || []);
      }
    } catch (error) {
      console.error('Failed to fetch executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutionDetails = async (id: string): Promise<Execution | null> => {
    try {
      const response = await api.get(`/executions/${id}`);
      if (response.data.success) {
        return response.data.data;
      }
    } catch (error) {
      console.error('Failed to fetch execution:', error);
    }
    return null;
  };

  const handleSelectLeft = async (execution: Execution) => {
    const detailed = await fetchExecutionDetails(execution.id);
    setLeftExecution(detailed);
    if (detailed && rightExecution) {
      compareExecutions(detailed, rightExecution);
    }
  };

  const handleSelectRight = async (execution: Execution) => {
    const detailed = await fetchExecutionDetails(execution.id);
    setRightExecution(detailed);
    if (leftExecution && detailed) {
      compareExecutions(leftExecution, detailed);
    }
  };

  const compareExecutions = (left: Execution, right: Execution) => {
    setComparing(true);

    const leftRunData = left.data?.resultData?.runData || {};
    const rightRunData = right.data?.resultData?.runData || {};

    // Get all unique node names
    const allNodes = new Set([
      ...Object.keys(leftRunData),
      ...Object.keys(rightRunData)
    ]);

    const diffs: NodeDiff[] = [];

    allNodes.forEach(nodeName => {
      const leftNode = leftRunData[nodeName]?.[0];
      const rightNode = rightRunData[nodeName]?.[0];

      const leftStatus = leftNode
        ? (leftNode.error ? 'error' : 'success')
        : 'missing';
      const rightStatus = rightNode
        ? (rightNode.error ? 'error' : 'success')
        : 'missing';

      const leftData = leftNode?.data?.main?.[0]?.[0]?.json || null;
      const rightData = rightNode?.data?.main?.[0]?.[0]?.json || null;

      const differences: string[] = [];

      // Compare statuses
      if (leftStatus !== rightStatus) {
        differences.push(`Status changed: ${leftStatus} → ${rightStatus}`);
      }

      // Compare execution times
      if (leftNode?.executionTime && rightNode?.executionTime) {
        const timeDiff = rightNode.executionTime - leftNode.executionTime;
        const percentChange = ((timeDiff / leftNode.executionTime) * 100).toFixed(1);
        if (Math.abs(Number(percentChange)) > 10) {
          differences.push(`Execution time: ${leftNode.executionTime}ms → ${rightNode.executionTime}ms (${timeDiff > 0 ? '+' : ''}${percentChange}%)`);
        }
      }

      // Compare output data
      if (JSON.stringify(leftData) !== JSON.stringify(rightData)) {
        differences.push('Output data changed');
      }

      diffs.push({
        nodeName,
        leftStatus: leftStatus as 'success' | 'error' | 'missing',
        rightStatus: rightStatus as 'success' | 'error' | 'missing',
        leftData,
        rightData,
        leftTime: leftNode?.executionTime,
        rightTime: rightNode?.executionTime,
        differences
      });
    });

    // Sort by nodes with differences first
    diffs.sort((a, b) => b.differences.length - a.differences.length);

    setNodeDiffs(diffs);
    setComparing(false);
  };

  const toggleNode = (nodeName: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeName)) {
      newExpanded.delete(nodeName);
    } else {
      newExpanded.add(nodeName);
    }
    setExpandedNodes(newExpanded);
  };

  const filteredDiffs = nodeDiffs.filter(diff =>
    diff.nodeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'missing':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="absolute inset-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitCompare className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Compare Executions
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Execution Selectors */}
        <div className="grid grid-cols-2 gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
          {/* Left Execution */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Base Execution
            </label>
            <select
              value={leftExecution?.id || ''}
              onChange={(e) => {
                const exec = executions.find(x => x.id === e.target.value);
                if (exec) handleSelectLeft(exec);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value="">Select an execution...</option>
              {executions.map(exec => (
                <option key={exec.id} value={exec.id}>
                  {formatDate(exec.startedAt)} - {exec.status}
                </option>
              ))}
            </select>
            {leftExecution && (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                <div className="flex items-center gap-2">
                  {leftExecution.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-gray-700 dark:text-gray-300">
                    {leftExecution.status} - {leftExecution.mode}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right Execution */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Compare With
            </label>
            <select
              value={rightExecution?.id || ''}
              onChange={(e) => {
                const exec = executions.find(x => x.id === e.target.value);
                if (exec) handleSelectRight(exec);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value="">Select an execution...</option>
              {executions.filter(e => e.id !== leftExecution?.id).map(exec => (
                <option key={exec.id} value={exec.id}>
                  {formatDate(exec.startedAt)} - {exec.status}
                </option>
              ))}
            </select>
            {rightExecution && (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm">
                <div className="flex items-center gap-2">
                  {rightExecution.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-gray-700 dark:text-gray-300">
                    {rightExecution.status} - {rightExecution.mode}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comparison Results */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {leftExecution && rightExecution ? (
            <>
              {/* Search */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search nodes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>

                <div className="mt-2 flex gap-4 text-sm text-gray-500">
                  <span>{nodeDiffs.length} nodes compared</span>
                  <span className="text-red-500">
                    {nodeDiffs.filter(d => d.differences.length > 0).length} with changes
                  </span>
                </div>
              </div>

              {/* Node Comparison List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredDiffs.map(diff => (
                  <div
                    key={diff.nodeName}
                    className={`border rounded-lg overflow-hidden ${
                      diff.differences.length > 0
                        ? 'border-yellow-200 dark:border-yellow-800'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {/* Node Header */}
                    <button
                      onClick={() => toggleNode(diff.nodeName)}
                      className={`w-full px-4 py-3 flex items-center justify-between ${
                        diff.differences.length > 0
                          ? 'bg-yellow-50 dark:bg-yellow-900/20'
                          : 'bg-gray-50 dark:bg-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {expandedNodes.has(diff.nodeName) ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {diff.nodeName}
                        </span>
                        {diff.differences.length > 0 && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                            {diff.differences.length} changes
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(diff.leftStatus)}
                          {diff.leftTime && (
                            <span className="text-xs text-gray-500">{diff.leftTime}ms</span>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <div className="flex items-center gap-2">
                          {getStatusIcon(diff.rightStatus)}
                          {diff.rightTime && (
                            <span className="text-xs text-gray-500">{diff.rightTime}ms</span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Node Details */}
                    {expandedNodes.has(diff.nodeName) && (
                      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                        {/* Differences */}
                        {diff.differences.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Changes
                            </h4>
                            <ul className="space-y-1">
                              {diff.differences.map((d, i) => (
                                <li key={i} className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                                  <AlertTriangle className="w-3 h-3" />
                                  {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Data Comparison */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Base Output
                            </h4>
                            <pre className="p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-48">
                              {JSON.stringify(diff.leftData, null, 2) || 'No data'}
                            </pre>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Compare Output
                            </h4>
                            <pre className="p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-48">
                              {JSON.stringify(diff.rightData, null, 2) || 'No data'}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <GitCompare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select two executions to compare</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExecutionComparison;
