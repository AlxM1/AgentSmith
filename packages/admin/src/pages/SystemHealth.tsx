import { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Server,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Zap,
  Database,
} from 'lucide-react';
import { useSystemHealth } from '../hooks/useApi';

const statusConfig = {
  healthy: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-100',
    label: 'Healthy',
    border: 'border-green-200',
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-100',
    label: 'Degraded',
    border: 'border-yellow-200',
  },
  unhealthy: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-100',
    label: 'Unhealthy',
    border: 'border-red-200',
  },
};

export function SystemHealth() {
  const { data: health, isLoading, refetch } = useSystemHealth();
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => refetch(), 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusLevel = (value: number, thresholds: [number, number]) => {
    if (value < thresholds[0]) return 'healthy';
    if (value < thresholds[1]) return 'degraded';
    return 'unhealthy';
  };

  const MetricCard = ({
    icon: Icon,
    label,
    value,
    unit,
    status,
    subtext,
  }: {
    icon: typeof Cpu;
    label: string;
    value: number;
    unit: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    subtext?: string;
  }) => {
    const config = statusConfig[status];
    const StatusIcon = config.icon;

    return (
      <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${config.border}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-600">{label}</span>
          </div>
          <StatusIcon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="text-3xl font-bold text-gray-900">
          {value}
          <span className="text-lg font-normal text-gray-500">{unit}</span>
        </div>
        {subtext && <div className="text-sm text-gray-500 mt-1">{subtext}</div>}

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              status === 'healthy'
                ? 'bg-green-500'
                : status === 'degraded'
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(value, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  if (isLoading && !health) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const systemStatus = health?.status || 'healthy';
  const statusInfo = statusConfig[systemStatus];
  const StatusIcon = statusInfo.icon;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-600 mt-1">Real-time monitoring of system resources</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Auto-refresh (10s)
          </label>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div className={`${statusInfo.bg} rounded-lg p-6 mb-6 border ${statusInfo.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full ${statusInfo.bg} flex items-center justify-center`}>
              <StatusIcon className={`w-8 h-8 ${statusInfo.color}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                System Status: {statusInfo.label}
              </h2>
              <p className="text-gray-600">
                {health?.lastCheck
                  ? `Last checked: ${new Date(health.lastCheck).toLocaleString()}`
                  : 'Checking...'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Uptime: {health?.uptime ? formatUptime(health.uptime) : '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resource Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MetricCard
          icon={Cpu}
          label="CPU Usage"
          value={health?.cpu || 0}
          unit="%"
          status={getStatusLevel(health?.cpu || 0, [70, 90])}
          subtext="Processor utilization"
        />
        <MetricCard
          icon={MemoryStick}
          label="Memory Usage"
          value={health?.memory || 0}
          unit="%"
          status={getStatusLevel(health?.memory || 0, [75, 90])}
          subtext="RAM utilization"
        />
        <MetricCard
          icon={HardDrive}
          label="Storage Usage"
          value={health?.storage || 0}
          unit="%"
          status={getStatusLevel(health?.storage || 0, [70, 85])}
          subtext="Disk space used"
        />
        <MetricCard
          icon={Database}
          label="Queue Size"
          value={health?.queueSize || 0}
          unit=" jobs"
          status={getStatusLevel(health?.queueSize || 0, [100, 500])}
          subtext="Pending executions"
        />
      </div>

      {/* Additional Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workers Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Worker Status
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active Workers</span>
              <span className="text-xl font-bold text-gray-900">{health?.activeWorkers || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Queue Processing</span>
              <span className={`font-medium ${(health?.activeWorkers || 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {(health?.activeWorkers || 0) > 0 ? 'Active' : 'Idle'}
              </span>
            </div>
            <div className="pt-4 border-t">
              <div className="text-sm text-gray-500">
                Workers are responsible for executing workflows. If queue size grows while workers are active,
                consider scaling up worker instances.
              </div>
            </div>
          </div>
        </div>

        {/* Service Endpoints */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-500" />
            Service Endpoints
          </h3>
          <div className="space-y-3">
            {[
              { name: 'API Server', port: 4000, status: 'healthy' },
              { name: 'Frontend', port: 3000, status: 'healthy' },
              { name: 'Admin Panel', port: 3001, status: 'healthy' },
              { name: 'PostgreSQL', port: 5432, status: 'healthy' },
              { name: 'Redis', port: 6379, status: 'healthy' },
            ].map((service) => (
              <div key={service.name} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      service.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-gray-900">{service.name}</span>
                </div>
                <span className="text-sm font-mono text-gray-500">:{service.port}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {systemStatus !== 'healthy' && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="font-semibold text-amber-800 mb-3">Recommendations</h3>
          <ul className="space-y-2 text-sm text-amber-700">
            {(health?.cpu || 0) > 70 && (
              <li>High CPU usage detected. Consider optimizing workflows or scaling resources.</li>
            )}
            {(health?.memory || 0) > 75 && (
              <li>Memory usage is elevated. Review running workflows for memory leaks.</li>
            )}
            {(health?.storage || 0) > 70 && (
              <li>Storage is filling up. Consider pruning old execution data.</li>
            )}
            {(health?.queueSize || 0) > 100 && (
              <li>Large queue backlog. Add more workers or check for stuck executions.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
