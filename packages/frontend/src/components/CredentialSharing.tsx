// Credential Sharing Component
import React, { useState, useEffect } from 'react';
import {
  Share2,
  User,
  X,
  Check,
  Search,
  Shield,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';

interface CredentialShare {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  permission: 'use' | 'edit' | 'admin';
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface CredentialSharingProps {
  credentialId: string;
  credentialName: string;
  isOwner: boolean;
  onClose: () => void;
}

const permissionLabels: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  use: {
    label: 'Use',
    description: 'Can use this credential in workflows',
    icon: <Eye className="w-4 h-4" />
  },
  edit: {
    label: 'Edit',
    description: 'Can use and modify credential data',
    icon: <Edit className="w-4 h-4" />
  },
  admin: {
    label: 'Admin',
    description: 'Full access including sharing',
    icon: <Shield className="w-4 h-4" />
  }
};

export const CredentialSharing: React.FC<CredentialSharingProps> = ({
  credentialId,
  credentialName,
  isOwner,
  onClose
}) => {
  const [shares, setShares] = useState<CredentialShare[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<'use' | 'edit' | 'admin'>('use');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchShares();
  }, [credentialId]);

  const fetchShares = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/credentials/${credentialId}/shares`);
      if (response.data.success) {
        setShares(response.data.data.shares || []);
      }
    } catch (error) {
      console.error('Failed to fetch shares:', error);
      setError('Failed to load sharing information');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await api.get(`/users?search=${encodeURIComponent(query)}&perPage=10`);
      if (response.data.success) {
        // Filter out users who already have access
        const existingUserIds = new Set(shares.map(s => s.userId));
        const filteredUsers = (response.data.data.users || []).filter(
          (user: User) => !existingUserIds.has(user.id)
        );
        setSearchResults(filteredUsers);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchUsers(query);
  };

  const handleAddShare = async () => {
    if (!selectedUser) return;

    setIsAdding(true);
    setError(null);

    try {
      const response = await api.post(`/credentials/${credentialId}/shares`, {
        userId: selectedUser.id,
        permission: selectedPermission
      });

      if (response.data.success) {
        fetchShares();
        setSelectedUser(null);
        setSearchQuery('');
        setSearchResults([]);
      } else {
        setError(response.data.message || 'Failed to add share');
      }
    } catch (error) {
      console.error('Failed to add share:', error);
      setError('Failed to add share');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdatePermission = async (shareId: string, permission: string) => {
    try {
      const response = await api.put(`/credentials/${credentialId}/shares/${shareId}`, {
        permission
      });

      if (response.data.success) {
        setShares(shares.map(s =>
          s.id === shareId ? { ...s, permission: permission as 'use' | 'edit' | 'admin' } : s
        ));
      }
    } catch (error) {
      console.error('Failed to update permission:', error);
      setError('Failed to update permission');
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const response = await api.delete(`/credentials/${credentialId}/shares/${shareId}`);

      if (response.data.success) {
        setShares(shares.filter(s => s.id !== shareId));
      }
    } catch (error) {
      console.error('Failed to remove share:', error);
      setError('Failed to remove share');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Share Credential
              </h2>
              <p className="text-sm text-gray-500">{credentialName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Add new share */}
          {isOwner && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add people
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />

                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {searchResults.map(user => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUser(user);
                            setSearchQuery(`${user.firstName} ${user.lastName} (${user.email})`);
                            setSearchResults([]);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <select
                  value={selectedPermission}
                  onChange={(e) => setSelectedPermission(e.target.value as 'use' | 'edit' | 'admin')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="use">Use</option>
                  <option value="edit">Edit</option>
                  <option value="admin">Admin</option>
                </select>

                <button
                  onClick={handleAddShare}
                  disabled={!selectedUser || isAdding}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Current shares */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              People with access
            </h3>

            {loading ? (
              <div className="py-8 text-center text-gray-500">
                Loading...
              </div>
            ) : shares.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Only you have access to this credential</p>
              </div>
            ) : (
              <div className="space-y-2">
                {shares.map(share => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {share.userName}
                        </p>
                        <p className="text-xs text-gray-500">{share.userEmail}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isOwner ? (
                        <>
                          <select
                            value={share.permission}
                            onChange={(e) => handleUpdatePermission(share.id, e.target.value)}
                            className="text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="use">Use</option>
                            <option value="edit">Edit</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            onClick={() => handleRemoveShare(share.id)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className="text-sm px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                          {permissionLabels[share.permission]?.label || share.permission}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Permission Legend */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Permission levels
            </h4>
            <div className="space-y-2">
              {Object.entries(permissionLabels).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="text-gray-400">{value.icon}</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300 w-16">
                    {value.label}
                  </span>
                  <span className="text-gray-500">{value.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CredentialSharing;
