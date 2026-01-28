import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';

// Layout
import { Layout } from './components/Layout';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Users } from './pages/Users';
import { Workflows } from './pages/Workflows';
import { Executions } from './pages/Executions';
import { AuditLog } from './pages/AuditLog';
import { Credentials } from './pages/Credentials';
import { SystemHealth } from './pages/SystemHealth';
import { SystemSettings } from './pages/SystemSettings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            {/* Main */}
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="workflows" element={<Workflows />} />
            <Route path="executions" element={<Executions />} />

            {/* Security */}
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="credentials" element={<Credentials />} />

            {/* System */}
            <Route path="health" element={<SystemHealth />} />
            <Route path="settings" element={<SystemSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
