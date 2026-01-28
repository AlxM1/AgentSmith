import { useState } from 'react';
import {
  Search,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RotateCcw,
  Square,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
} from 'lucide-react';
import { useExecutions, useCancelExecution, useRetryExecution } from '../hooks/useApi';

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Pending' },
  running: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Running' },
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Failed' },
  cancelled: { icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Cancelled' },
};

export function Executions() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useExecutions({
    page,
    limit: 25,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const cancelExecution = useCancelExecution();
  const retryExecution = useRetryExecution();

  const executions = data?.data || [];
  const totalPages = data?.totalPages || 1;

  const handleCancel = async (id: string) => {
    if (confirm('Are you sure you want to cancel this execution?')) {
      try {
        await cancelExecution.mutateAsync(id);
      } catch (error) {
        console.error('Failed to cancel execution:', error);
      }
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryExecution.mutateAsync(id);
    } catch (error) {
      console.error('Failed to retry execution:', error);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Executions</h1>
          <p className="text-gray-600 mt-1">Monitor and manage workflow executions</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by workflow name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Executions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading executions...</div>
        ) : executions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Play className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No executions found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Execution
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workflow
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {executions.map((execution) => {
                const status = statusConfig[execution.status] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <tr key={execution.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-mono text-sm text-gray-900">
                          {execution.id.slice(0, 8)}...
                        </div>
                        <div className="text-xs text-gray-500">{execution.userEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{execution.workflowName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${status.bg} ${status.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500 capitalize">{execution.mode}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Calendar className="w-3 h-3" />
                        {new Date(execution.startedAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {formatDuration(execution.duration)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-2 hover:bg-gray-100 rounded-lg" title="View Details">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        {execution.status === 'running' && (
                          <button
                            onClick={() => handleCancel(execution.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="Cancel"
                          >
                            <Square className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                        {execution.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(execution.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="Retry"
                          >
                            <RotateCcw className="w-4 h-4 text-green-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Error details for failed executions */}
      {executions.some((e) => e.status === 'failed' && e.error) && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-2">Recent Errors</h3>
          <div className="space-y-2">
            {executions
              .filter((e) => e.status === 'failed' && e.error)
              .slice(0, 3)
              .map((e) => (
                <div key={e.id} className="text-sm">
                  <span className="font-mono text-red-600">{e.id.slice(0, 8)}:</span>{' '}
                  <span className="text-red-700">{e.error}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
