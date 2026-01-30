/**
 * Roles & Permissions Management Page
 *
 * Admin interface for RBAC configuration:
 * - View and manage roles
 * - Assign permissions to roles
 * - Assign roles to users
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: string;
}

interface UserRole {
  userId: string;
  userEmail: string;
  roleId: string;
  roleName: string;
  assignedAt: string;
}

// Permission categories for organization
const PERMISSION_CATEGORIES = [
  { id: 'workflow', name: 'Workflows', icon: '⚡' },
  { id: 'credential', name: 'Credentials', icon: '🔑' },
  { id: 'execution', name: 'Executions', icon: '▶️' },
  { id: 'user', name: 'Users', icon: '👤' },
  { id: 'admin', name: 'Administration', icon: '⚙️' },
  { id: 'project', name: 'Projects', icon: '📁' },
  { id: 'environment', name: 'Environments', icon: '🌍' },
];

// All available permissions
const ALL_PERMISSIONS: Permission[] = [
  // Workflow
  { id: 'workflow:create', name: 'Create Workflows', description: 'Create new workflows', category: 'workflow' },
  { id: 'workflow:read', name: 'View Workflows', description: 'View workflow details', category: 'workflow' },
  { id: 'workflow:update', name: 'Edit Workflows', description: 'Modify existing workflows', category: 'workflow' },
  { id: 'workflow:delete', name: 'Delete Workflows', description: 'Delete workflows', category: 'workflow' },
  { id: 'workflow:execute', name: 'Execute Workflows', description: 'Run workflows manually', category: 'workflow' },
  { id: 'workflow:share', name: 'Share Workflows', description: 'Share workflows with other users', category: 'workflow' },
  { id: 'workflow:export', name: 'Export Workflows', description: 'Export workflows to files', category: 'workflow' },
  { id: 'workflow:import', name: 'Import Workflows', description: 'Import workflows from files', category: 'workflow' },
  // Credential
  { id: 'credential:create', name: 'Create Credentials', description: 'Create new credentials', category: 'credential' },
  { id: 'credential:read', name: 'View Credentials', description: 'View credential details', category: 'credential' },
  { id: 'credential:update', name: 'Edit Credentials', description: 'Modify credentials', category: 'credential' },
  { id: 'credential:delete', name: 'Delete Credentials', description: 'Delete credentials', category: 'credential' },
  { id: 'credential:share', name: 'Share Credentials', description: 'Share credentials with users', category: 'credential' },
  { id: 'credential:use', name: 'Use Credentials', description: 'Use credentials in workflows', category: 'credential' },
  // Execution
  { id: 'execution:read', name: 'View Executions', description: 'View execution history', category: 'execution' },
  { id: 'execution:delete', name: 'Delete Executions', description: 'Delete execution records', category: 'execution' },
  { id: 'execution:retry', name: 'Retry Executions', description: 'Retry failed executions', category: 'execution' },
  { id: 'execution:stop', name: 'Stop Executions', description: 'Stop running executions', category: 'execution' },
  // User
  { id: 'user:create', name: 'Create Users', description: 'Create new users', category: 'user' },
  { id: 'user:read', name: 'View Users', description: 'View user information', category: 'user' },
  { id: 'user:update', name: 'Edit Users', description: 'Modify user details', category: 'user' },
  { id: 'user:delete', name: 'Delete Users', description: 'Delete user accounts', category: 'user' },
  { id: 'user:invite', name: 'Invite Users', description: 'Send user invitations', category: 'user' },
  // Admin
  { id: 'admin:settings', name: 'System Settings', description: 'Manage system settings', category: 'admin' },
  { id: 'admin:audit', name: 'View Audit Logs', description: 'Access audit logs', category: 'admin' },
  { id: 'admin:license', name: 'Manage License', description: 'Manage software license', category: 'admin' },
  { id: 'admin:backup', name: 'Backup & Restore', description: 'Backup and restore data', category: 'admin' },
  // Project
  { id: 'project:create', name: 'Create Projects', description: 'Create new projects', category: 'project' },
  { id: 'project:read', name: 'View Projects', description: 'View project details', category: 'project' },
  { id: 'project:update', name: 'Edit Projects', description: 'Modify projects', category: 'project' },
  { id: 'project:delete', name: 'Delete Projects', description: 'Delete projects', category: 'project' },
  { id: 'project:manage_members', name: 'Manage Members', description: 'Add/remove project members', category: 'project' },
  // Environment
  { id: 'environment:read', name: 'View Environments', description: 'View deployment environments', category: 'environment' },
  { id: 'environment:promote', name: 'Promote Workflows', description: 'Promote workflows between environments', category: 'environment' },
  { id: 'environment:rollback', name: 'Rollback Deployments', description: 'Rollback environment deployments', category: 'environment' },
];

export function RolesManagement() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] as string[] });
  const [activeTab, setActiveTab] = useState<'roles' | 'assignments'>('roles');

  // Fetch roles
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const res = await fetch('/api/admin/roles');
      if (!res.ok) throw new Error('Failed to fetch roles');
      return res.json();
    },
  });

  // Fetch user role assignments
  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['admin', 'role-assignments'],
    queryFn: async () => {
      const res = await fetch('/api/admin/role-assignments');
      if (!res.ok) throw new Error('Failed to fetch assignments');
      return res.json();
    },
  });

  // Create role mutation
  const createRole = useMutation({
    mutationFn: async (data: typeof newRole) => {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setIsCreateModalOpen(false);
      setNewRole({ name: '', description: '', permissions: [] });
    },
  });

  // Update role mutation
  const updateRole = useMutation({
    mutationFn: async ({ id, permissions }: { id: string; permissions: string[] }) => {
      const res = await fetch(`/api/admin/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    },
  });

  // Delete role mutation
  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/roles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete role');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setSelectedRole(null);
    },
  });

  const togglePermission = (permissionId: string) => {
    if (!selectedRole || selectedRole.isSystem) return;

    const newPermissions = selectedRole.permissions.includes(permissionId)
      ? selectedRole.permissions.filter(p => p !== permissionId)
      : [...selectedRole.permissions, permissionId];

    updateRole.mutate({ id: selectedRole.id, permissions: newPermissions });
    setSelectedRole({ ...selectedRole, permissions: newPermissions });
  };

  const toggleNewRolePermission = (permissionId: string) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Roles & Permissions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage user roles and their permissions
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Role
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('roles')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'roles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Roles
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'assignments'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            User Assignments
          </button>
        </nav>
      </div>

      {activeTab === 'roles' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Role List */}
          <div className="col-span-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Roles</h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {rolesLoading ? (
                <div className="p-4 text-gray-500">Loading...</div>
              ) : (
                (roles?.roles || []).map((role: Role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedRole?.id === role.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {role.name}
                          {role.isSystem && (
                            <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                              System
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{role.description}</div>
                      </div>
                      <div className="text-sm text-gray-400">
                        {role.userCount} users
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Permission Matrix */}
          <div className="col-span-8 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {selectedRole ? `Permissions for ${selectedRole.name}` : 'Select a role'}
              </h3>
              {selectedRole && !selectedRole.isSystem && (
                <button
                  onClick={() => {
                    if (confirm('Delete this role?')) {
                      deleteRole.mutate(selectedRole.id);
                    }
                  }}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Delete Role
                </button>
              )}
            </div>
            {selectedRole ? (
              <div className="p-4 space-y-6 max-h-[600px] overflow-y-auto">
                {PERMISSION_CATEGORIES.map(category => {
                  const categoryPermissions = ALL_PERMISSIONS.filter(
                    p => p.category === category.id
                  );
                  return (
                    <div key={category.id}>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                        <span className="mr-2">{category.icon}</span>
                        {category.name}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {categoryPermissions.map(permission => (
                          <label
                            key={permission.id}
                            className={`flex items-center p-3 rounded-lg border ${
                              selectedRole.permissions.includes(permission.id)
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-700'
                            } ${selectedRole.isSystem ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRole.permissions.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              disabled={selectedRole.isSystem}
                              className="mr-3"
                            />
                            <div>
                              <div className="font-medium text-sm text-gray-900 dark:text-white">
                                {permission.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {permission.description}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {selectedRole.isSystem && (
                  <div className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                    System roles cannot be modified. Create a custom role to customize permissions.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                Select a role from the list to view and edit permissions
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Assigned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {assignmentsLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  (assignments?.assignments || []).map((assignment: UserRole) => (
                    <tr key={`${assignment.userId}-${assignment.roleId}`}>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {assignment.userEmail}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                          {assignment.roleName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(assignment.assignedAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button className="text-blue-600 hover:text-blue-700 mr-3">
                          Change
                        </button>
                        <button className="text-red-600 hover:text-red-700">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create New Role
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role Name
                </label>
                <input
                  type="text"
                  value={newRole.name}
                  onChange={e => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Project Manager"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newRole.description}
                  onChange={e => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Brief description of this role"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Permissions
                </label>
                {PERMISSION_CATEGORIES.map(category => {
                  const categoryPermissions = ALL_PERMISSIONS.filter(
                    p => p.category === category.id
                  );
                  return (
                    <div key={category.id} className="mb-4">
                      <h5 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {category.icon} {category.name}
                      </h5>
                      <div className="grid grid-cols-2 gap-2">
                        {categoryPermissions.map(permission => (
                          <label
                            key={permission.id}
                            className="flex items-center p-2 rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <input
                              type="checkbox"
                              checked={newRole.permissions.includes(permission.id)}
                              onChange={() => toggleNewRolePermission(permission.id)}
                              className="mr-2"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {permission.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => createRole.mutate(newRole)}
                disabled={!newRole.name || createRole.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createRole.isPending ? 'Creating...' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
