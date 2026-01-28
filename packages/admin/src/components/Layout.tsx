import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Settings,
  Workflow,
  Play,
  Shield,
  Key,
  Activity,
  LogOut,
  ChevronDown,
  Server,
} from 'lucide-react';
import { useState } from 'react';

const mainNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Workflows', href: '/workflows', icon: Workflow },
  { name: 'Executions', href: '/executions', icon: Play },
];

const securityNavigation = [
  { name: 'Audit Log', href: '/audit-log', icon: Shield },
  { name: 'Credentials', href: '/credentials', icon: Key },
];

const systemNavigation = [
  { name: 'System Health', href: '/health', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Layout() {
  const navigate = useNavigate();
  const [securityOpen, setSecurityOpen] = useState(true);
  const [systemOpen, setSystemOpen] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
              <Server className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg block leading-tight">AgentSmith</span>
              <span className="text-xs text-gray-400">Admin Panel</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Main Navigation */}
          <div>
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Main
            </p>
            <div className="space-y-1">
              {mainNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-green-600 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>

          {/* Security Section */}
          <div>
            <button
              onClick={() => setSecurityOpen(!securityOpen)}
              className="w-full flex items-center justify-between px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-300"
            >
              <span>Security</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${securityOpen ? '' : '-rotate-90'}`}
              />
            </button>
            {securityOpen && (
              <div className="space-y-1">
                {securityNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-green-600 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* System Section */}
          <div>
            <button
              onClick={() => setSystemOpen(!systemOpen)}
              className="w-full flex items-center justify-between px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-300"
            >
              <span>System</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${systemOpen ? '' : '-rotate-90'}`}
              />
            </button>
            {systemOpen && (
              <div className="space-y-1">
                {systemNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-green-600 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
