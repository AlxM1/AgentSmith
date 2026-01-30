// Monitoring Dashboard - Real-time system metrics and analytics
import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { apiClient as adminApi } from '../api/client';

interface SystemMetrics {
  cpu: number;
  memory: { used: number; total: number; percentage: number };
  uptime: number;
  nodeVersion: string;
  platform: string;
}

interface ExecutionMetrics {
  total: number;
  success: number;
  failed: number;
  running: number;
  pending: number;
  avgDuration: number;
}

interface TimeSeriesData {
  timestamp: string;
  executions: number;
  success: number;
  failed: number;
}

interface WorkflowStats {
  name: string;
  executions: number;
  successRate: number;
}

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];

const MonitoringDashboard: React.FC = () => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [executionMetrics, setExecutionMetrics] = useState<ExecutionMetrics | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [topWorkflows, setTopWorkflows] = useState<WorkflowStats[]>([]);
  const [queueStats, setQueueStats] = useState<{ waiting: number; active: number; completed: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  const fetchMetrics = useCallback(async () => {
    try {
      const [healthRes, statsRes, executionsRes] = await Promise.all([
        adminApi.getSystemHealth() as Promise<any>,
        adminApi.getDashboardStats() as Promise<any>,
        adminApi.getExecutions({ limit: 100 }) as Promise<any>
      ]);

      // Handle health response (may be wrapped or direct)
      const healthData = healthRes?.data || healthRes;
      if (healthData) {
        setSystemMetrics({
          cpu: healthData.cpu || 0,
          memory: healthData.memory || { used: 0, total: 0, percentage: 0 },
          uptime: healthData.uptime || 0,
          nodeVersion: healthData.nodeVersion || 'N/A',
          platform: healthData.platform || 'N/A'
        });

        if (healthData.queue) {
          setQueueStats(healthData.queue);
        }
      }

      // Handle stats response (may be wrapped or direct)
      const statsData = statsRes?.data || statsRes;
      if (statsData) {
        // Process execution metrics
        const executions = statsData.executions || statsData || { total: 0, success: 0, failed: 0 };
        setExecutionMetrics({
          total: executions.total || executions.totalExecutions || 0,
          success: executions.success || executions.successfulExecutions || 0,
          failed: executions.failed || executions.failedExecutions || 0,
          running: executions.running || 0,
          pending: executions.pending || 0,
          avgDuration: executions.avgDuration || executions.averageExecutionTime || 0
        });

        // Process top workflows
        if (statsData.topWorkflows) {
          setTopWorkflows(statsData.topWorkflows);
        }
      }

      // Generate time series from executions (handle both wrapped and unwrapped)
      const executionsData = executionsRes?.data || executionsRes;
      const executionsList = Array.isArray(executionsData)
        ? executionsData
        : (executionsData?.executions || executionsData?.data || []);

      if (executionsList.length > 0) {
        const hourlyData: Record<string, { executions: number; success: number; failed: number }> = {};
        const now = new Date();

        // Initialize last 24 hours
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
          const key = hour.toISOString().slice(0, 13);
          hourlyData[key] = { executions: 0, success: 0, failed: 0 };
        }

        // Count executions per hour
        executionsList.forEach((exec: { startedAt: string; status: string }) => {
          const hourKey = new Date(exec.startedAt).toISOString().slice(0, 13);
          if (hourlyData[hourKey]) {
            hourlyData[hourKey].executions++;
            if (exec.status === 'success' || exec.status === 'completed') hourlyData[hourKey].success++;
            if (exec.status === 'failed') hourlyData[hourKey].failed++;
          }
        });

        setTimeSeriesData(
          Object.entries(hourlyData).map(([timestamp, data]) => ({
            timestamp: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit' }),
            ...data
          }))
        );
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, autoRefresh, refreshInterval]);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Monitoring Dashboard</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto-refresh
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="text-sm border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
            disabled={!autoRefresh}
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={300}>5m</option>
          </select>
          <button
            onClick={fetchMetrics}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            Refresh Now
          </button>
        </div>
      </div>

      {/* System Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">CPU Usage</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {systemMetrics?.cpu?.toFixed(1) || 0}%
          </div>
          <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${systemMetrics?.cpu || 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Memory Usage</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {systemMetrics?.memory?.percentage?.toFixed(1) || 0}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatBytes(systemMetrics?.memory?.used || 0)} / {formatBytes(systemMetrics?.memory?.total || 0)}
          </div>
          <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${systemMetrics?.memory?.percentage || 0}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Uptime</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatUptime(systemMetrics?.uptime || 0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Node {systemMetrics?.nodeVersion} on {systemMetrics?.platform}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Queue Status</div>
          <div className="flex gap-2 mt-1">
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
              Waiting: {queueStats?.waiting || 0}
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
              Active: {queueStats?.active || 0}
            </span>
          </div>
          <div className="flex gap-2 mt-1">
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
              Done: {queueStats?.completed || 0}
            </span>
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
              Failed: {queueStats?.failed || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Execution Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Executions Over Time */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Executions (Last 24h)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="success" stackId="1" stroke="#10B981" fill="#10B981" name="Success" />
              <Area type="monotone" dataKey="failed" stackId="1" stroke="#EF4444" fill="#EF4444" name="Failed" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Execution Status Pie */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Execution Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Success', value: executionMetrics?.success || 0 },
                  { name: 'Failed', value: executionMetrics?.failed || 0 },
                  { name: 'Running', value: executionMetrics?.running || 0 },
                  { name: 'Pending', value: executionMetrics?.pending || 0 }
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center mt-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {executionMetrics?.total || 0}
            </span>
            <span className="text-gray-500 dark:text-gray-400 ml-2">Total Executions</span>
          </div>
        </div>
      </div>

      {/* Top Workflows */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Top Workflows by Executions</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topWorkflows.slice(0, 10)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={150} />
            <Tooltip />
            <Legend />
            <Bar dataKey="executions" fill="#3B82F6" name="Executions" />
            <Bar dataKey="successRate" fill="#10B981" name="Success Rate %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Avg Execution Time</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {((executionMetrics?.avgDuration || 0) / 1000).toFixed(2)}s
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Success Rate</div>
          <div className="text-2xl font-bold text-green-600">
            {executionMetrics?.total
              ? ((executionMetrics.success / executionMetrics.total) * 100).toFixed(1)
              : 0}%
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Failure Rate</div>
          <div className="text-2xl font-bold text-red-600">
            {executionMetrics?.total
              ? ((executionMetrics.failed / executionMetrics.total) * 100).toFixed(1)
              : 0}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard;
