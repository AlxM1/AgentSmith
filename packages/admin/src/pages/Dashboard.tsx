import { useQuery } from '@tanstack/react-query';
import { Workflow, Play, CheckCircle, XCircle, Users, Key } from 'lucide-react';

export function Dashboard() {
  // Mock data for now
  const stats = {
    workflows: 12,
    executions: 1547,
    successRate: 94.2,
    users: 5,
    credentials: 8,
    activeWorkflows: 7,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Workflows"
          value={stats.workflows}
          icon={Workflow}
          color="blue"
        />
        <StatCard
          title="Active Workflows"
          value={stats.activeWorkflows}
          icon={Play}
          color="green"
        />
        <StatCard
          title="Total Executions"
          value={stats.executions}
          icon={CheckCircle}
          color="purple"
        />
        <StatCard
          title="Success Rate"
          value={`${stats.successRate}%`}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Total Users"
          value={stats.users}
          icon={Users}
          color="orange"
        />
        <StatCard
          title="Credentials"
          value={stats.credentials}
          icon={Key}
          color="pink"
        />
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[
            { action: 'Workflow executed', workflow: 'Email Automation', status: 'success', time: '2 minutes ago' },
            { action: 'Workflow executed', workflow: 'Data Sync', status: 'success', time: '5 minutes ago' },
            { action: 'Workflow executed', workflow: 'API Integration', status: 'failed', time: '12 minutes ago' },
            { action: 'User created', workflow: 'john@example.com', status: 'info', time: '1 hour ago' },
            { action: 'Workflow activated', workflow: 'Slack Notifications', status: 'success', time: '2 hours ago' },
          ].map((activity, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                {activity.status === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                {activity.status === 'failed' && <XCircle className="w-5 h-5 text-red-500" />}
                {activity.status === 'info' && <Users className="w-5 h-5 text-blue-500" />}
                <div>
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-sm text-gray-500">{activity.workflow}</p>
                </div>
              </div>
              <span className="text-sm text-gray-400">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`${colors[color]} p-3 rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
