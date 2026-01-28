import { Key, Database, Cloud, MessageSquare, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
import { useCredentialTypes, useCredentialUsage } from '../hooks/useApi';

const categoryIcons: Record<string, typeof Key> = {
  database: Database,
  cloud: Cloud,
  communication: MessageSquare,
  payment: CreditCard,
  default: Key,
};

export function Credentials() {
  const { data: types, isLoading: typesLoading, refetch: refetchTypes } = useCredentialTypes();
  const { data: usage, isLoading: usageLoading, refetch: refetchUsage } = useCredentialUsage();

  const isLoading = typesLoading || usageLoading;

  const handleRefresh = () => {
    refetchTypes();
    refetchUsage();
  };

  const getIcon = (type: string) => {
    const category = type.toLowerCase().includes('db') || type.toLowerCase().includes('sql')
      ? 'database'
      : type.toLowerCase().includes('aws') || type.toLowerCase().includes('gcp') || type.toLowerCase().includes('azure')
      ? 'cloud'
      : type.toLowerCase().includes('slack') || type.toLowerCase().includes('email') || type.toLowerCase().includes('telegram')
      ? 'communication'
      : type.toLowerCase().includes('stripe') || type.toLowerCase().includes('payment')
      ? 'payment'
      : 'default';
    return categoryIcons[category];
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Credentials</h1>
          <p className="text-gray-600 mt-1">Overview of credential types and usage across workflows</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Security Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800">Security Notice</h3>
            <p className="text-sm text-amber-700 mt-1">
              Credential values are encrypted and cannot be viewed from the admin panel.
              This page shows only metadata and usage statistics for auditing purposes.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credential Types */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Available Credential Types</h2>
            <p className="text-sm text-gray-500">Types of credentials configured in the system</p>
          </div>
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : !types || types.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No credential types configured</p>
            </div>
          ) : (
            <div className="divide-y">
              {types.map((type) => {
                const Icon = getIcon(type.name);
                return (
                  <div key={type.name} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{type.displayName}</div>
                        <div className="text-sm text-gray-500">{type.description}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">{type.usageCount}</div>
                      <div className="text-xs text-gray-500">credentials</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Credential Usage */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Credential Usage</h2>
            <p className="text-sm text-gray-500">How credentials are being used in workflows</p>
          </div>
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : !usage || usage.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No credentials in use</p>
            </div>
          ) : (
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {usage.map((cred) => {
                const Icon = getIcon(cred.type);
                return (
                  <div key={cred.credentialId} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Icon className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{cred.credentialName}</div>
                        <div className="text-sm text-gray-500">{cred.type}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">
                        <span className="font-semibold text-gray-900">{cred.workflowCount}</span>
                        <span className="text-gray-500"> workflows</span>
                      </div>
                      {cred.lastUsed && (
                        <div className="text-xs text-gray-400">
                          Last used: {new Date(cred.lastUsed).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-gray-900">
            {types?.length || 0}
          </div>
          <div className="text-sm text-gray-500">Credential Types</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-gray-900">
            {types?.reduce((sum, t) => sum + t.usageCount, 0) || 0}
          </div>
          <div className="text-sm text-gray-500">Total Credentials</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-gray-900">
            {usage?.length || 0}
          </div>
          <div className="text-sm text-gray-500">Active Credentials</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-gray-900">
            {usage?.reduce((sum, u) => sum + u.workflowCount, 0) || 0}
          </div>
          <div className="text-sm text-gray-500">Workflow Connections</div>
        </div>
      </div>
    </div>
  );
}
