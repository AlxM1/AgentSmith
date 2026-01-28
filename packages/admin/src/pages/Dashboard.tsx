/**
 * AgentSmith Admin Dashboard
 * Comprehensive system monitoring and management
 */

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
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
  ResponsiveContainer,
} from 'recharts';
import { Workflow, Play, CheckCircle, XCircle, Users, Key, Server, Database, Cpu, HardDrive } from 'lucide-react';

// Mock data - in production, this would come from API
const mockStats = {
  totalUsers: 156,
  activeUsers: 42,
  totalWorkflows: 328,
  activeWorkflows: 89,
  executionsToday: 1247,
  executionsThisWeek: 8934,
  successRate: 94.7,
  avgExecutionTime: 2.3,
  storageUsed: 12.4,
  storageTotal: 50,
  cpuUsage: 34,
  memoryUsage: 56,
  queuedJobs: 12,
  runningJobs: 5,
  credentials: 45,
};

const executionTrend = [
  { name: 'Mon', success: 400, failed: 24 },
  { name: 'Tue', success: 380, failed: 18 },
  { name: 'Wed', success: 520, failed: 30 },
  { name: 'Thu', success: 490, failed: 22 },
  { name: 'Fri', success: 610, failed: 35 },
  { name: 'Sat', success: 280, failed: 12 },
  { name: 'Sun', success: 320, failed: 15 },
];

const nodeUsage = [
  { name: 'HTTP Request', count: 2340 },
  { name: 'OpenAI', count: 1890 },
  { name: 'Slack', count: 1456 },
  { name: 'PostgreSQL', count: 1234 },
  { name: 'Gmail', count: 987 },
  { name: 'Code', count: 876 },
];

const userActivity = [
  { name: 'Active', value: 42 },
  { name: 'Idle', value: 78 },
  { name: 'Offline', value: 36 },
];

const COLORS = ['#10B981', '#F59E0B', '#6B7280'];

export function Dashboard() {
  const [stats, setStats] = useState(mockStats);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('7d');

  const refreshStats = async () => {
    setRefreshing(true);
    // In production, fetch from API
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">System overview and monitoring</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={refreshStats}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          subtitle={`${stats.activeUsers} active now`}
          icon={Users}
          color="blue"
          trend="+12%"
          trendUp={true}
        />
        <StatCard
          title="Workflows"
          value={stats.totalWorkflows}
          subtitle={`${stats.activeWorkflows} active`}
          icon={Workflow}
          color="purple"
          trend="+8%"
          trendUp={true}
        />
        <StatCard
          title="Executions Today"
          value={stats.executionsToday.toLocaleString()}
          subtitle={`${stats.executionsThisWeek.toLocaleString()} this week`}
          icon={Play}
          color="green"
          trend="+23%"
          trendUp={true}
        />
        <StatCard
          title="Success Rate"
          value={`${stats.successRate}%`}
          subtitle={`${stats.avgExecutionTime}s avg time`}
          icon={CheckCircle}
          color="emerald"
          trend="+2.1%"
          trendUp={true}
        />
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HealthCard
          title="CPU Usage"
          value={stats.cpuUsage}
          max={100}
          unit="%"
          icon={Cpu}
          status={stats.cpuUsage > 80 ? 'critical' : stats.cpuUsage > 60 ? 'warning' : 'healthy'}
        />
        <HealthCard
          title="Memory Usage"
          value={stats.memoryUsage}
          max={100}
          unit="%"
          icon={Server}
          status={stats.memoryUsage > 80 ? 'critical' : stats.memoryUsage > 60 ? 'warning' : 'healthy'}
        />
        <HealthCard
          title="Storage"
          value={stats.storageUsed}
          max={stats.storageTotal}
          unit="GB"
          icon={HardDrive}
          status={stats.storageUsed / stats.storageTotal > 0.8 ? 'warning' : 'healthy'}
        />
        <HealthCard
          title="Queue"
          value={stats.queuedJobs}
          subtitle={`${stats.runningJobs} running`}
          icon={Database}
          status={stats.queuedJobs > 50 ? 'warning' : 'healthy'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Execution Trend */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Execution Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={executionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="success"
                stackId="1"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.6}
                name="Successful"
              />
              <Area
                type="monotone"
                dataKey="failed"
                stackId="1"
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.6}
                name="Failed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Most Used Nodes */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Most Used Nodes
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={nodeUsage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" stroke="#9CA3AF" />
              <YAxis type="category" dataKey="name" stroke="#9CA3AF" width={100} />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {[
              { icon: '🔄', text: "Workflow 'Daily Report' executed successfully", time: '2 min ago', status: 'success' },
              { icon: '👤', text: "New user 'john@example.com' registered", time: '15 min ago', status: 'info' },
              { icon: '⚠️', text: "Workflow 'Data Sync' failed - API timeout", time: '32 min ago', status: 'error' },
              { icon: '✅', text: 'System backup completed', time: '1 hour ago', status: 'success' },
              { icon: '🔧', text: "Credential 'Slack API' updated", time: '2 hours ago', status: 'info' },
            ].map((activity, i) => (
              <ActivityItem key={i} {...activity} />
            ))}
          </div>
        </div>

        {/* System Alerts */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            System Alerts
          </h3>
          <div className="space-y-3">
            <AlertItem
              severity="warning"
              title="High Memory Usage"
              message="Memory usage has exceeded 80% threshold"
              time="5 min ago"
            />
            <AlertItem
              severity="info"
              title="Scheduled Maintenance"
              message="System maintenance scheduled for Sunday 2:00 AM"
              time="1 hour ago"
            />
            <AlertItem
              severity="success"
              title="SSL Certificate Renewed"
              message="SSL certificate has been automatically renewed"
              time="1 day ago"
            />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionButton icon="👤" label="Add User" onClick={() => {}} />
          <QuickActionButton icon="🔧" label="System Settings" onClick={() => {}} />
          <QuickActionButton icon="📊" label="View Logs" onClick={() => {}} />
          <QuickActionButton icon="💾" label="Backup Now" onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  trendUp,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend: string;
  trendUp: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
    orange: 'bg-orange-500',
    pink: 'bg-pink-500',
  };

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-2">
        <div className={`${colors[color]} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <span
          className={`text-sm font-medium ${
            trendUp ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {trendUp ? '↑' : '↓'} {trend}
        </span>
      </div>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

function HealthCard({
  title,
  value,
  max,
  unit,
  subtitle,
  icon: Icon,
  status,
}: {
  title: string;
  value: number;
  max?: number;
  unit?: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'healthy' | 'warning' | 'critical';
}) {
  const percentage = max ? (value / max) * 100 : 0;
  const statusColors = {
    healthy: { bg: 'bg-green-500', text: 'text-green-600' },
    warning: { bg: 'bg-yellow-500', text: 'text-yellow-600' },
    critical: { bg: 'bg-red-500', text: 'text-red-600' },
  };

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">{title}</span>
        </div>
        <span className={`w-2 h-2 rounded-full ${statusColors[status].bg}`} />
      </div>
      <div className="text-xl font-bold text-gray-900">
        {value}
        {unit && <span className="text-sm font-normal text-gray-500"> {unit}</span>}
        {max && <span className="text-sm font-normal text-gray-400"> / {max}</span>}
      </div>
      {max && (
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${statusColors[status].bg}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function ActivityItem({
  icon,
  text,
  time,
  status,
}: {
  icon: string;
  text: string;
  time: string;
  status: string;
}) {
  const statusColors: Record<string, string> = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${statusColors[status] || statusColors.info}`}>
      <span className="text-lg">{icon}</span>
      <div className="flex-1">
        <p className="text-sm text-gray-700">{text}</p>
      </div>
      <span className="text-xs text-gray-400">{time}</span>
    </div>
  );
}

function AlertItem({
  severity,
  title,
  message,
  time,
}: {
  severity: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  time: string;
}) {
  const severityConfig = {
    success: { bg: 'bg-green-50', border: 'border-green-200', icon: '✅', text: 'text-green-800' },
    warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: '⚠️', text: 'text-yellow-800' },
    error: { bg: 'bg-red-50', border: 'border-red-200', icon: '❌', text: 'text-red-800' },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'ℹ️', text: 'text-blue-800' },
  };

  const config = severityConfig[severity];

  return (
    <div className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1">
          <h4 className={`font-medium ${config.text}`}>{title}</h4>
          <p className="text-sm text-gray-600 mt-1">{message}</p>
        </div>
        <span className="text-xs text-gray-400">{time}</span>
      </div>
    </div>
  );
}

function QuickActionButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
    >
      <span className="text-2xl">{icon}</span>
      <span className="font-medium text-gray-700">{label}</span>
    </button>
  );
}

export default Dashboard;
