/**
 * Environments Management Page
 *
 * Admin interface for deployment environments:
 * - View and manage environments (dev, staging, production)
 * - Manage environment variables
 * - View and approve promotions
 * - Configure protection rules
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Environment {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: 'development' | 'staging' | 'production' | 'custom';
  color: string;
  workflowCount: number;
  variableCount: number;
  protectionRules: ProtectionRule[];
  createdAt: string;
  updatedAt: string;
}

interface ProtectionRule {
  type: 'approval' | 'schedule' | 'branch';
  config: Record<string, any>;
}

interface EnvironmentVariable {
  key: string;
  value: string;
  isSecret: boolean;
  description?: string;
}

interface Promotion {
  id: string;
  workflowId: string;
  workflowName: string;
  sourceEnvId: string;
  sourceEnvName: string;
  targetEnvId: string;
  targetEnvName: string;
  status: 'pending' | 'approved' | 'rejected' | 'deployed' | 'failed';
  createdBy: string;
  createdAt: string;
  approvals: Approval[];
}

interface Approval {
  userId: string;
  userEmail: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  timestamp: string;
}

const ENV_COLORS: Record<string, string> = {
  development: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  staging: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  production: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  custom: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  rejected: 'bg-red-100 text-red-800',
  deployed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function Environments() {
  const queryClient = useQueryClient();
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'variables' | 'promotions' | 'protection'>('overview');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isVariableModalOpen, setIsVariableModalOpen] = useState(false);
  const [newVariable, setNewVariable] = useState({ key: '', value: '', isSecret: false, description: '' });

  // Fetch environments
  const { data: environments, isLoading: envsLoading } = useQuery({
    queryKey: ['admin', 'environments'],
    queryFn: async () => {
      const res = await fetch('/api/v1/environments');
      if (!res.ok) throw new Error('Failed to fetch environments');
      return res.json();
    },
  });

  // Fetch environment variables
  const { data: variables, isLoading: varsLoading } = useQuery({
    queryKey: ['admin', 'environment-variables', selectedEnv?.id],
    queryFn: async () => {
      if (!selectedEnv) return { variables: [] };
      const res = await fetch(`/api/v1/environments/${selectedEnv.id}/variables`);
      if (!res.ok) throw new Error('Failed to fetch variables');
      return res.json();
    },
    enabled: !!selectedEnv,
  });

  // Fetch pending promotions
  const { data: promotions, isLoading: promosLoading } = useQuery({
    queryKey: ['admin', 'promotions'],
    queryFn: async () => {
      const res = await fetch('/api/v1/environments/promotions');
      if (!res.ok) throw new Error('Failed to fetch promotions');
      return res.json();
    },
  });

  // Create environment mutation
  const createEnvironment = useMutation({
    mutationFn: async (data: Partial<Environment>) => {
      const res = await fetch('/api/v1/environments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create environment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'environments'] });
      setIsCreateModalOpen(false);
    },
  });

  // Add variable mutation
  const addVariable = useMutation({
    mutationFn: async (data: typeof newVariable) => {
      const res = await fetch(`/api/v1/environments/${selectedEnv?.id}/variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add variable');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'environment-variables', selectedEnv?.id] });
      setIsVariableModalOpen(false);
      setNewVariable({ key: '', value: '', isSecret: false, description: '' });
    },
  });

  // Delete variable mutation
  const deleteVariable = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/v1/environments/${selectedEnv?.id}/variables/${key}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete variable');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'environment-variables', selectedEnv?.id] });
    },
  });

  // Approve promotion mutation
  const approvePromotion = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const res = await fetch(`/api/v1/environments/promotions/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      if (!res.ok) throw new Error('Failed to approve promotion');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });
    },
  });

  // Reject promotion mutation
  const rejectPromotion = useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const res = await fetch(`/api/v1/environments/promotions/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
      if (!res.ok) throw new Error('Failed to reject promotion');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });
    },
  });

  const pendingPromotions = (promotions?.promotions || []).filter(
    (p: Promotion) => p.status === 'pending'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Environments
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage deployment environments and promotions
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create Environment
        </button>
      </div>

      {/* Pending Promotions Alert */}
      {pendingPromotions.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center">
            <span className="text-yellow-600 dark:text-yellow-400 mr-2">⚠️</span>
            <span className="text-yellow-800 dark:text-yellow-200 font-medium">
              {pendingPromotions.length} promotion(s) pending approval
            </span>
            <button
              onClick={() => setActiveTab('promotions')}
              className="ml-auto text-yellow-700 dark:text-yellow-300 hover:underline text-sm"
            >
              Review now →
            </button>
          </div>
        </div>
      )}

      {/* Environment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {envsLoading ? (
          <div className="col-span-3 text-center py-8 text-gray-500">Loading...</div>
        ) : (
          (environments?.environments || []).map((env: Environment) => (
            <button
              key={env.id}
              onClick={() => {
                setSelectedEnv(env);
                setActiveTab('overview');
              }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedEnv?.id === env.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${ENV_COLORS[env.type]}`}
                >
                  {env.type}
                </span>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: env.color }}
                />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{env.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {env.description || `${env.slug} environment`}
              </p>
              <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                <span>{env.workflowCount || 0} workflows</span>
                <span>{env.variableCount || 0} variables</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Selected Environment Details */}
      {selectedEnv && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-4">
              {(['overview', 'variables', 'promotions', 'protection'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-1 border-b-2 font-medium text-sm capitalize ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Name</label>
                    <div className="text-gray-900 dark:text-white">{selectedEnv.name}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Slug</label>
                    <div className="text-gray-900 dark:text-white font-mono">{selectedEnv.slug}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Type</label>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ENV_COLORS[selectedEnv.type]}`}>
                      {selectedEnv.type}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Created</label>
                    <div className="text-gray-900 dark:text-white">
                      {new Date(selectedEnv.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                {selectedEnv.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Description</label>
                    <div className="text-gray-900 dark:text-white">{selectedEnv.description}</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'variables' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900 dark:text-white">Environment Variables</h4>
                  <button
                    onClick={() => setIsVariableModalOpen(true)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Add Variable
                  </button>
                </div>
                {varsLoading ? (
                  <div className="text-gray-500">Loading...</div>
                ) : (
                  <div className="space-y-2">
                    {(variables?.variables || []).length === 0 ? (
                      <div className="text-gray-500 text-center py-4">No variables configured</div>
                    ) : (
                      (variables?.variables || []).map((v: EnvironmentVariable) => (
                        <div
                          key={v.key}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div>
                            <div className="font-mono text-sm text-gray-900 dark:text-white">
                              {v.key}
                              {v.isSecret && (
                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1 rounded">
                                  secret
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 font-mono">
                              {v.isSecret ? '••••••••' : v.value}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`Delete variable ${v.key}?`)) {
                                deleteVariable.mutate(v.key);
                              }
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'promotions' && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Promotion Requests</h4>
                {promosLoading ? (
                  <div className="text-gray-500">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    {(promotions?.promotions || []).length === 0 ? (
                      <div className="text-gray-500 text-center py-4">No promotions</div>
                    ) : (
                      (promotions?.promotions || []).map((promo: Promotion) => (
                        <div
                          key={promo.id}
                          className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {promo.workflowName}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[promo.status]}`}>
                              {promo.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mb-3">
                            {promo.sourceEnvName} → {promo.targetEnvName}
                          </div>
                          <div className="text-xs text-gray-400 mb-3">
                            Requested by {promo.createdBy} on {new Date(promo.createdAt).toLocaleString()}
                          </div>
                          {promo.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => approvePromotion.mutate({ id: promo.id })}
                                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => rejectPromotion.mutate({ id: promo.id })}
                                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'protection' && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Protection Rules</h4>
                <div className="space-y-3">
                  {(selectedEnv.protectionRules || []).length === 0 ? (
                    <div className="text-gray-500 text-center py-4">No protection rules configured</div>
                  ) : (
                    selectedEnv.protectionRules.map((rule, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="font-medium text-gray-900 dark:text-white capitalize">
                          {rule.type} Rule
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {rule.type === 'approval' && `Requires ${rule.config.requiredApprovers || 1} approver(s)`}
                          {rule.type === 'schedule' && `Allowed: ${rule.config.schedule || 'Not set'}`}
                          {rule.type === 'branch' && `Branch: ${rule.config.branch || 'Not set'}`}
                        </div>
                      </div>
                    ))
                  )}
                  <button className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600">
                    + Add Protection Rule
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Variable Modal */}
      {isVariableModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Environment Variable
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Key
                </label>
                <input
                  type="text"
                  value={newVariable.key}
                  onChange={e => setNewVariable(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                  placeholder="MY_VARIABLE"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Value
                </label>
                <input
                  type={newVariable.isSecret ? 'password' : 'text'}
                  value={newVariable.value}
                  onChange={e => setNewVariable(prev => ({ ...prev, value: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                  placeholder="value"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newVariable.description}
                  onChange={e => setNewVariable(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="What is this variable for?"
                />
              </div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={newVariable.isSecret}
                  onChange={e => setNewVariable(prev => ({ ...prev, isSecret: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Mark as secret (value will be encrypted)
                </span>
              </label>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => setIsVariableModalOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => addVariable.mutate(newVariable)}
                disabled={!newVariable.key || !newVariable.value || addVariable.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addVariable.isPending ? 'Adding...' : 'Add Variable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
