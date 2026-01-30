/**
 * Environment Selector Component
 *
 * Dropdown for selecting and switching between environments:
 * - Shows current environment
 * - Quick switch between environments
 * - Shows environment status
 * - Promote workflow action
 */

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Environment {
  id: string;
  name: string;
  slug: string;
  type: 'development' | 'staging' | 'production' | 'custom';
  color: string;
}

interface EnvironmentSelectorProps {
  currentEnvironmentId?: string;
  workflowId?: string;
  onEnvironmentChange?: (envId: string) => void;
  showPromoteAction?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ENV_ICONS: Record<string, string> = {
  development: '🔧',
  staging: '🧪',
  production: '🚀',
  custom: '⚙️',
};

export function EnvironmentSelector({
  currentEnvironmentId,
  workflowId,
  onEnvironmentChange,
  showPromoteAction = false,
  size = 'md',
}: EnvironmentSelectorProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [selectedTargetEnv, setSelectedTargetEnv] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch environments
  const { data: environments } = useQuery({
    queryKey: ['environments'],
    queryFn: async () => {
      const res = await fetch('/api/v1/environments');
      if (!res.ok) throw new Error('Failed to fetch environments');
      return res.json();
    },
  });

  // Promote mutation
  const promoteWorkflow = useMutation({
    mutationFn: async (targetEnvId: string) => {
      const res = await fetch('/api/v1/environments/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          targetEnvironmentId: targetEnvId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create promotion');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setShowPromoteModal(false);
      setSelectedTargetEnv('');
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const envList: Environment[] = environments?.environments || [];
  const currentEnv = envList.find((e) => e.id === currentEnvironmentId);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const getEnvColorClasses = (type: string) => {
    switch (type) {
      case 'development':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300';
      case 'staging':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300';
      case 'production':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300';
      default:
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-300';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center rounded-lg border ${sizeClasses[size]} ${
          currentEnv
            ? getEnvColorClasses(currentEnv.type)
            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-gray-300'
        } hover:opacity-90 transition-opacity`}
      >
        <span className="mr-1.5">{currentEnv ? ENV_ICONS[currentEnv.type] : '🌍'}</span>
        <span className="font-medium">{currentEnv?.name || 'Select Environment'}</span>
        <svg
          className={`ml-2 w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1">
              Switch Environment
            </div>
            {envList.map((env) => (
              <button
                key={env.id}
                onClick={() => {
                  onEnvironmentChange?.(env.id);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center px-2 py-2 rounded-md text-left ${
                  env.id === currentEnvironmentId
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="mr-2">{ENV_ICONS[env.type]}</span>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">
                    {env.name}
                  </div>
                  <div className="text-xs text-gray-500">{env.slug}</div>
                </div>
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: env.color }}
                />
                {env.id === currentEnvironmentId && (
                  <svg className="w-4 h-4 ml-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {showPromoteAction && workflowId && currentEnv && (
            <>
              <hr className="border-gray-200 dark:border-gray-700" />
              <div className="p-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setShowPromoteModal(true);
                  }}
                  className="w-full flex items-center px-2 py-2 rounded-md text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 11l5-5m0 0l5 5m-5-5v12"
                    />
                  </svg>
                  <span className="text-sm font-medium">Promote to...</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Promote Modal */}
      {showPromoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Promote Workflow
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Deploy this workflow to another environment
              </p>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Environment
                </label>
                <div className={`inline-flex items-center px-3 py-1.5 rounded-lg ${getEnvColorClasses(currentEnv?.type || 'custom')}`}>
                  <span className="mr-1.5">{ENV_ICONS[currentEnv?.type || 'custom']}</span>
                  <span className="font-medium">{currentEnv?.name}</span>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Environment
                </label>
                <div className="space-y-2">
                  {envList
                    .filter((e) => e.id !== currentEnvironmentId)
                    .map((env) => (
                      <label
                        key={env.id}
                        className={`flex items-center p-3 rounded-lg border cursor-pointer ${
                          selectedTargetEnv === env.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="targetEnv"
                          value={env.id}
                          checked={selectedTargetEnv === env.id}
                          onChange={(e) => setSelectedTargetEnv(e.target.value)}
                          className="sr-only"
                        />
                        <span className="mr-2">{ENV_ICONS[env.type]}</span>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {env.name}
                          </div>
                          <div className="text-xs text-gray-500">{env.type}</div>
                        </div>
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: env.color }}
                        />
                      </label>
                    ))}
                </div>
              </div>

              {selectedTargetEnv && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {envList.find((e) => e.id === selectedTargetEnv)?.type === 'production'
                      ? 'Production promotion may require approval before deployment.'
                      : 'Workflow will be deployed to the selected environment.'}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPromoteModal(false);
                  setSelectedTargetEnv('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => promoteWorkflow.mutate(selectedTargetEnv)}
                disabled={!selectedTargetEnv || promoteWorkflow.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {promoteWorkflow.isPending ? 'Promoting...' : 'Promote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnvironmentSelector;
