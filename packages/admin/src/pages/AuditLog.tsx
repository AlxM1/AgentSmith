import { useState } from 'react';
import {
  Search,
  Shield,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Globe,
} from 'lucide-react';
import { useAuditLogs } from '../hooks/useApi';

const actionColors: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-yellow-100 text-yellow-800',
  DELETE: 'bg-red-100 text-red-800',
  EXECUTE: 'bg-purple-100 text-purple-800',
  EXPORT: 'bg-indigo-100 text-indigo-800',
  default: 'bg-gray-100 text-gray-800',
};

export function AuditLog() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useAuditLogs({
    page,
    limit: 50,
    action: actionFilter === 'all' ? undefined : actionFilter,
    resource: resourceFilter === 'all' ? undefined : resourceFilter,
  });

  const logs = data?.data || [];
  const totalPages = data?.totalPages || 1;

  const getActionColor = (action: string) => {
    const prefix = action.split('_')[0];
    return actionColors[prefix] || actionColors.default;
  };

  const handleExport = () => {
    // Export audit logs as CSV
    const csv = [
      ['Timestamp', 'User', 'Action', 'Resource', 'Resource ID', 'Status', 'IP Address'].join(','),
      ...logs.map((log) =>
        [
          log.createdAt,
          log.userEmail,
          log.action,
          log.resource,
          log.resourceId || '',
          log.status,
          log.ipAddress,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-600 mt-1">Track all system activities and user actions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Actions</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="EXECUTE">Execute</option>
          </select>
          <select
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Resources</option>
            <option value="user">Users</option>
            <option value="workflow">Workflows</option>
            <option value="execution">Executions</option>
            <option value="credential">Credentials</option>
            <option value="settings">Settings</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading audit logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{log.userEmail}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getActionColor(
                        log.action
                      )}`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <span className="text-sm text-gray-900 capitalize">{log.resource}</span>
                      {log.resourceId && (
                        <div className="text-xs text-gray-500 font-mono">
                          {log.resourceId.slice(0, 8)}...
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.status === 'success' ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                        <XCircle className="w-4 h-4" />
                        Failure
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Globe className="w-4 h-4" />
                      {log.ipAddress}
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
