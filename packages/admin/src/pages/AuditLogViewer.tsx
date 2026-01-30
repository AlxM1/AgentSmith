// Audit Log Viewer Component
import React, { useState, useEffect } from 'react';
import {
  Shield,
  User,
  Key,
  Workflow,
  Settings,
  AlertTriangle,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Monitor
} from 'lucide-react';
import { apiClient as adminApi } from '../api/client';

interface AuditLogEntry {
  id: string;
  userId: string | null;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const actionIcons: Record<string, React.ReactNode> = {
  'user.login': <User className="w-4 h-4 text-green-500" />,
  'user.logout': <User className="w-4 h-4 text-gray-500" />,
  'user.create': <User className="w-4 h-4 text-blue-500" />,
  'user.update': <User className="w-4 h-4 text-yellow-500" />,
  'user.delete': <User className="w-4 h-4 text-red-500" />,
  'user.2fa_enable': <Shield className="w-4 h-4 text-green-500" />,
  'user.2fa_disable': <Shield className="w-4 h-4 text-orange-500" />,
  'user.password_change': <Key className="w-4 h-4 text-blue-500" />,
  'workflow.create': <Workflow className="w-4 h-4 text-blue-500" />,
  'workflow.update': <Workflow className="w-4 h-4 text-yellow-500" />,
  'workflow.delete': <Workflow className="w-4 h-4 text-red-500" />,
  'workflow.activate': <Workflow className="w-4 h-4 text-green-500" />,
  'workflow.deactivate': <Workflow className="w-4 h-4 text-gray-500" />,
  'workflow.execute': <Workflow className="w-4 h-4 text-purple-500" />,
  'credential.create': <Key className="w-4 h-4 text-blue-500" />,
  'credential.update': <Key className="w-4 h-4 text-yellow-500" />,
  'credential.delete': <Key className="w-4 h-4 text-red-500" />,
  'settings.update': <Settings className="w-4 h-4 text-yellow-500" />,
  'api_key.create': <Key className="w-4 h-4 text-blue-500" />,
  'api_key.delete': <Key className="w-4 h-4 text-red-500" />,
};

const actionLabels: Record<string, string> = {
  'user.login': 'User Login',
  'user.logout': 'User Logout',
  'user.create': 'User Created',
  'user.update': 'User Updated',
  'user.delete': 'User Deleted',
  'user.2fa_enable': '2FA Enabled',
  'user.2fa_disable': '2FA Disabled',
  'user.password_change': 'Password Changed',
  'workflow.create': 'Workflow Created',
  'workflow.update': 'Workflow Updated',
  'workflow.delete': 'Workflow Deleted',
  'workflow.activate': 'Workflow Activated',
  'workflow.deactivate': 'Workflow Deactivated',
  'workflow.execute': 'Workflow Executed',
  'workflow.rollback': 'Workflow Rolled Back',
  'credential.create': 'Credential Created',
  'credential.update': 'Credential Updated',
  'credential.delete': 'Credential Deleted',
  'credential.share': 'Credential Shared',
  'settings.update': 'Settings Updated',
  'api_key.create': 'API Key Created',
  'api_key.delete': 'API Key Deleted',
};

const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const getSeverity = (action: string): 'info' | 'warning' | 'critical' => {
  if (action.includes('delete') || action.includes('2fa_disable')) return 'critical';
  if (action.includes('update') || action.includes('password')) return 'warning';
  return 'info';
};

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const perPage = 50;

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAuditLogs({
        page,
        perPage,
        action: actionFilter || undefined,
        search: searchQuery || undefined
      });

      if (response.success && response.data) {
        setLogs(response.data.logs || []);
        setTotalPages(Math.ceil((response.data.total || 0) / perPage));
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const handleExport = async () => {
    try {
      const response = await adminApi.getAuditLogs({
        page: 1,
        perPage: 10000,
        action: actionFilter || undefined,
        search: searchQuery || undefined
      });

      if (response.success && response.data) {
        const csv = convertToCSV(response.data.logs || []);
        downloadCSV(csv, `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  const convertToCSV = (data: AuditLogEntry[]) => {
    const headers = ['Timestamp', 'Action', 'User', 'Resource Type', 'Resource ID', 'IP Address', 'Details'];
    const rows = data.map(log => [
      new Date(log.createdAt).toISOString(),
      log.action,
      log.userEmail || log.userId || 'System',
      log.resourceType,
      log.resourceId || '',
      log.ipAddress || '',
      JSON.stringify(log.details)
    ]);

    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      relative: getRelativeTime(date)
    };
  };

  const getRelativeTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const uniqueActions = [...new Set(logs.map(log => log.action))];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Audit Logs
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs()}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] max-w-md relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by user, IP, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">All Actions</option>
            <optgroup label="User Actions">
              <option value="user.login">Login</option>
              <option value="user.logout">Logout</option>
              <option value="user.create">User Created</option>
              <option value="user.delete">User Deleted</option>
              <option value="user.password_change">Password Changed</option>
            </optgroup>
            <optgroup label="Workflow Actions">
              <option value="workflow.create">Workflow Created</option>
              <option value="workflow.update">Workflow Updated</option>
              <option value="workflow.delete">Workflow Deleted</option>
              <option value="workflow.execute">Workflow Executed</option>
            </optgroup>
            <optgroup label="Security Actions">
              <option value="user.2fa_enable">2FA Enabled</option>
              <option value="user.2fa_disable">2FA Disabled</option>
              <option value="api_key.create">API Key Created</option>
              <option value="api_key.delete">API Key Deleted</option>
            </optgroup>
          </select>

          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No audit logs found
            </h3>
            <p className="text-gray-500">
              Audit logs will appear here when actions are performed
            </p>
          </div>
        ) : (
          <>
            {/* Log Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {logs.map((log) => {
                    const timestamp = formatTimestamp(log.createdAt);
                    const severity = getSeverity(log.action);

                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-900 dark:text-white">
                                {timestamp.time}
                              </div>
                              <div className="text-xs text-gray-500">
                                {timestamp.relative}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {actionIcons[log.action] || <AlertTriangle className="w-4 h-4 text-gray-400" />}
                            <span className="text-sm text-gray-900 dark:text-white">
                              {actionLabels[log.action] || log.action}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {log.userEmail || log.userId || 'System'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm">
                            <span className="text-gray-500">{log.resourceType}</span>
                            {log.resourceId && (
                              <span className="text-gray-400 ml-1">
                                #{log.resourceId.slice(0, 8)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <MapPin className="w-3 h-3" />
                            {log.ipAddress || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${severityColors[severity]}`}>
                            {severity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detail Sidebar */}
      {selectedLog && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Log Details
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Action</label>
                <div className="flex items-center gap-2 mt-1">
                  {actionIcons[selectedLog.action]}
                  <span className="text-gray-900 dark:text-white">
                    {actionLabels[selectedLog.action] || selectedLog.action}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Timestamp</label>
                <p className="text-gray-900 dark:text-white mt-1">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">User</label>
                <p className="text-gray-900 dark:text-white mt-1">
                  {selectedLog.userEmail || selectedLog.userId || 'System'}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Resource</label>
                <p className="text-gray-900 dark:text-white mt-1">
                  {selectedLog.resourceType}
                  {selectedLog.resourceId && ` - ${selectedLog.resourceId}`}
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">IP Address</label>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900 dark:text-white">
                    {selectedLog.ipAddress || 'Unknown'}
                  </span>
                </div>
              </div>

              {selectedLog.userAgent && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">User Agent</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Monitor className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 break-all">
                      {selectedLog.userAgent}
                    </span>
                  </div>
                </div>
              )}

              {Object.keys(selectedLog.details || {}).length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Details</label>
                  <pre className="mt-1 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg text-xs text-gray-700 dark:text-gray-300 overflow-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
