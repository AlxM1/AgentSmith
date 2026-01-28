import { useState } from 'react';
import {
  Search,
  Workflow as WorkflowIcon,
  Play,
  Pause,
  Trash2,
  Eye,
  MoreVertical,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { useWorkflows, useToggleWorkflowActive, useDeleteWorkflow } from '../hooks/useApi';

export function Workflows() {
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useWorkflows({
    page,
    limit: 20,
    search: search || undefined,
    active: activeFilter === 'all' ? undefined : activeFilter === 'active',
  });

  const toggleActive = useToggleWorkflowActive();
  const deleteWorkflow = useDeleteWorkflow();

  const workflows = data?.data || [];
  const totalPages = data?.totalPages || 1;

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await toggleActive.mutateAsync({ id, active: !currentActive });
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      try {
        await deleteWorkflow.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete workflow:', error);
      }
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <p className="text-gray-600 mt-1">Manage all workflows across users</p>
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
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Workflows</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Workflows Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading workflows...</div>
        ) : workflows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <WorkflowIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No workflows found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workflow
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nodes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Executions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Run
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {workflows.map((workflow) => (
                <tr key={workflow.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <WorkflowIcon className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{workflow.name}</div>
                        {workflow.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {workflow.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{workflow.userEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${
                        workflow.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {workflow.active ? (
                        <>
                          <Play className="w-3 h-3" /> Active
                        </>
                      ) : (
                        <>
                          <Pause className="w-3 h-3" /> Inactive
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {workflow.nodeCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {workflow.executionCount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {workflow.lastExecutedAt
                      ? new Date(workflow.lastExecutedAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleActive(workflow.id, workflow.active)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title={workflow.active ? 'Deactivate' : 'Activate'}
                      >
                        {workflow.active ? (
                          <Pause className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <Play className="w-4 h-4 text-green-500" />
                        )}
                      </button>
                      <button className="p-2 hover:bg-gray-100 rounded-lg" title="View">
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(workflow.id, workflow.name)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
    </div>
  );
}
