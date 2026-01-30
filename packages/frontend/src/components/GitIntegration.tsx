/**
 * Git Integration UI Component
 * Provides source control features for workflows
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface GitRepository {
  id: string;
  name: string;
  url: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure';
  branch: string;
  isDefault: boolean;
  syncEnabled: boolean;
  lastSyncAt?: string;
  status: 'connected' | 'disconnected' | 'error';
}

interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  branch: string;
}

interface GitBranch {
  name: string;
  isDefault: boolean;
  isProtected: boolean;
  lastCommit?: string;
}

interface GitDiff {
  workflowId: string;
  workflowName: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  localVersion?: string;
  remoteVersion?: string;
}

interface GitIntegrationProps {
  workflowId?: string;
  onSync?: () => void;
}

export const GitIntegration: React.FC<GitIntegrationProps> = ({ workflowId, onSync }) => {
  const [activeTab, setActiveTab] = useState<'repository' | 'branches' | 'history' | 'sync'>('repository');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch repository info
  const { data: repository, isLoading: repoLoading } = useQuery<GitRepository>({
    queryKey: ['git-repository'],
    queryFn: async () => {
      const res = await fetch('/api/v1/source-control/repository');
      if (!res.ok) throw new Error('Failed to fetch repository');
      return res.json();
    },
  });

  // Fetch branches
  const { data: branches } = useQuery<GitBranch[]>({
    queryKey: ['git-branches'],
    queryFn: async () => {
      const res = await fetch('/api/v1/source-control/branches');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!repository,
  });

  // Fetch commit history
  const { data: commits } = useQuery<GitCommit[]>({
    queryKey: ['git-commits', selectedBranch],
    queryFn: async () => {
      const branch = selectedBranch || repository?.branch || 'main';
      const res = await fetch(`/api/v1/source-control/commits?branch=${branch}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!repository,
  });

  // Fetch sync status
  const { data: syncStatus, refetch: refetchSyncStatus } = useQuery<GitDiff[]>({
    queryKey: ['git-sync-status'],
    queryFn: async () => {
      const res = await fetch('/api/v1/source-control/status');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!repository,
  });

  // Connect repository mutation
  const connectMutation = useMutation({
    mutationFn: async (data: { provider: string; url: string; branch: string; token: string }) => {
      const res = await fetch('/api/v1/source-control/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to connect repository');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-repository'] });
      setShowConnectModal(false);
    },
  });

  // Push changes mutation
  const pushMutation = useMutation({
    mutationFn: async (data: { message: string; workflowIds?: string[] }) => {
      const res = await fetch('/api/v1/source-control/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to push changes');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-commits'] });
      queryClient.invalidateQueries({ queryKey: ['git-sync-status'] });
      setShowCommitModal(false);
      onSync?.();
    },
  });

  // Pull changes mutation
  const pullMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/source-control/pull', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to pull changes');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-sync-status'] });
      onSync?.();
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/source-control/disconnect', {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['git-repository'] });
    },
  });

  useEffect(() => {
    if (repository?.branch) {
      setSelectedBranch(repository.branch);
    }
  }, [repository]);

  const pendingChanges = syncStatus?.filter(s => s.status !== 'unchanged') || [];

  if (repoLoading) {
    return (
      <div className="git-integration loading">
        <div className="spinner" />
        <p>Loading source control...</p>
      </div>
    );
  }

  return (
    <div className="git-integration">
      <div className="git-header">
        <h2>Source Control</h2>
        {repository ? (
          <div className="repo-status">
            <span className={`status-badge ${repository.status}`}>
              {repository.status}
            </span>
            <span className="repo-name">{repository.name}</span>
          </div>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => setShowConnectModal(true)}
          >
            Connect Repository
          </button>
        )}
      </div>

      {repository && (
        <>
          <div className="git-tabs">
            <button
              className={`tab ${activeTab === 'repository' ? 'active' : ''}`}
              onClick={() => setActiveTab('repository')}
            >
              Repository
            </button>
            <button
              className={`tab ${activeTab === 'branches' ? 'active' : ''}`}
              onClick={() => setActiveTab('branches')}
            >
              Branches
            </button>
            <button
              className={`tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              History
            </button>
            <button
              className={`tab ${activeTab === 'sync' ? 'active' : ''}`}
              onClick={() => setActiveTab('sync')}
            >
              Sync
              {pendingChanges.length > 0 && (
                <span className="badge">{pendingChanges.length}</span>
              )}
            </button>
          </div>

          <div className="git-content">
            {activeTab === 'repository' && (
              <RepositoryTab
                repository={repository}
                onDisconnect={() => disconnectMutation.mutate()}
              />
            )}

            {activeTab === 'branches' && (
              <BranchesTab
                branches={branches || []}
                currentBranch={repository.branch}
                onSelectBranch={setSelectedBranch}
              />
            )}

            {activeTab === 'history' && (
              <HistoryTab
                commits={commits || []}
                selectedBranch={selectedBranch}
                branches={branches || []}
                onBranchChange={setSelectedBranch}
              />
            )}

            {activeTab === 'sync' && (
              <SyncTab
                syncStatus={syncStatus || []}
                onPush={() => setShowCommitModal(true)}
                onPull={() => pullMutation.mutate()}
                isPulling={pullMutation.isPending}
                onRefresh={() => refetchSyncStatus()}
              />
            )}
          </div>
        </>
      )}

      {showConnectModal && (
        <ConnectRepositoryModal
          onClose={() => setShowConnectModal(false)}
          onConnect={(data) => connectMutation.mutate(data)}
          isConnecting={connectMutation.isPending}
          error={connectMutation.error?.message}
        />
      )}

      {showCommitModal && (
        <CommitModal
          pendingChanges={pendingChanges}
          onClose={() => setShowCommitModal(false)}
          onCommit={(message, workflowIds) => pushMutation.mutate({ message, workflowIds })}
          isCommitting={pushMutation.isPending}
        />
      )}

      <style>{`
        .git-integration {
          padding: 20px;
          background: var(--bg-secondary, #f8f9fa);
          border-radius: 8px;
          min-height: 400px;
        }

        .git-integration.loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .git-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .git-header h2 {
          margin: 0;
          font-size: 18px;
        }

        .repo-status {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.connected {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.disconnected {
          background: #f8d7da;
          color: #721c24;
        }

        .status-badge.error {
          background: #fff3cd;
          color: #856404;
        }

        .git-tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          margin-bottom: 20px;
        }

        .tab {
          padding: 10px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 14px;
          color: var(--text-secondary, #666);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .tab:hover {
          color: var(--text-primary, #333);
        }

        .tab.active {
          color: var(--primary-color, #5046e5);
          border-bottom-color: var(--primary-color, #5046e5);
        }

        .tab .badge {
          background: var(--primary-color, #5046e5);
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 11px;
        }

        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-primary {
          background: var(--primary-color, #5046e5);
          color: white;
        }

        .btn-primary:hover {
          opacity: 0.9;
        }

        .btn-secondary {
          background: var(--bg-tertiary, #e9ecef);
          color: var(--text-primary, #333);
        }

        .btn-danger {
          background: #dc3545;
          color: white;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid var(--border-color, #e0e0e0);
          border-top-color: var(--primary-color, #5046e5);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Repository Tab Component
const RepositoryTab: React.FC<{
  repository: GitRepository;
  onDisconnect: () => void;
}> = ({ repository, onDisconnect }) => {
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  const providerIcons: Record<string, string> = {
    github: '🐙',
    gitlab: '🦊',
    bitbucket: '🪣',
    azure: '☁️',
  };

  return (
    <div className="repository-tab">
      <div className="repo-info">
        <div className="info-row">
          <span className="label">Provider</span>
          <span className="value">
            {providerIcons[repository.provider]} {repository.provider.charAt(0).toUpperCase() + repository.provider.slice(1)}
          </span>
        </div>
        <div className="info-row">
          <span className="label">Repository URL</span>
          <span className="value">
            <a href={repository.url} target="_blank" rel="noopener noreferrer">
              {repository.url}
            </a>
          </span>
        </div>
        <div className="info-row">
          <span className="label">Default Branch</span>
          <span className="value">{repository.branch}</span>
        </div>
        <div className="info-row">
          <span className="label">Auto Sync</span>
          <span className="value">
            {repository.syncEnabled ? '✓ Enabled' : '✗ Disabled'}
          </span>
        </div>
        {repository.lastSyncAt && (
          <div className="info-row">
            <span className="label">Last Synced</span>
            <span className="value">
              {new Date(repository.lastSyncAt).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      <div className="repo-actions">
        <button
          className="btn btn-danger"
          onClick={() => setShowConfirmDisconnect(true)}
        >
          Disconnect Repository
        </button>
      </div>

      {showConfirmDisconnect && (
        <div className="confirm-dialog">
          <p>Are you sure you want to disconnect this repository?</p>
          <p className="warning">This will not delete your workflows, but source control features will be disabled.</p>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setShowConfirmDisconnect(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      )}

      <style>{`
        .repository-tab {
          padding: 10px 0;
        }

        .repo-info {
          background: white;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .info-row {
          display: flex;
          padding: 12px 0;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-row .label {
          width: 150px;
          color: var(--text-secondary, #666);
          font-size: 14px;
        }

        .info-row .value {
          flex: 1;
          font-size: 14px;
        }

        .info-row a {
          color: var(--primary-color, #5046e5);
          text-decoration: none;
        }

        .repo-actions {
          display: flex;
          gap: 10px;
        }

        .confirm-dialog {
          background: white;
          border: 1px solid #dc3545;
          border-radius: 8px;
          padding: 20px;
          margin-top: 20px;
        }

        .confirm-dialog .warning {
          color: #856404;
          font-size: 13px;
        }

        .dialog-actions {
          display: flex;
          gap: 10px;
          margin-top: 15px;
        }
      `}</style>
    </div>
  );
};

// Branches Tab Component
const BranchesTab: React.FC<{
  branches: GitBranch[];
  currentBranch: string;
  onSelectBranch: (branch: string) => void;
}> = ({ branches, currentBranch, onSelectBranch }) => {
  return (
    <div className="branches-tab">
      <div className="branches-list">
        {branches.map(branch => (
          <div
            key={branch.name}
            className={`branch-item ${branch.name === currentBranch ? 'current' : ''}`}
            onClick={() => onSelectBranch(branch.name)}
          >
            <div className="branch-info">
              <span className="branch-name">
                {branch.name}
                {branch.isDefault && <span className="default-badge">default</span>}
                {branch.isProtected && <span className="protected-badge">protected</span>}
              </span>
              {branch.lastCommit && (
                <span className="last-commit">{branch.lastCommit}</span>
              )}
            </div>
            {branch.name === currentBranch && (
              <span className="current-indicator">Current</span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .branches-tab {
          padding: 10px 0;
        }

        .branches-list {
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .branch-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          cursor: pointer;
          transition: background 0.2s;
        }

        .branch-item:last-child {
          border-bottom: none;
        }

        .branch-item:hover {
          background: var(--bg-secondary, #f8f9fa);
        }

        .branch-item.current {
          background: var(--bg-highlight, #e8f4ff);
        }

        .branch-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .branch-name {
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .default-badge, .protected-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: normal;
        }

        .default-badge {
          background: #d4edda;
          color: #155724;
        }

        .protected-badge {
          background: #fff3cd;
          color: #856404;
        }

        .last-commit {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }

        .current-indicator {
          font-size: 12px;
          color: var(--primary-color, #5046e5);
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

// History Tab Component
const HistoryTab: React.FC<{
  commits: GitCommit[];
  selectedBranch: string;
  branches: GitBranch[];
  onBranchChange: (branch: string) => void;
}> = ({ commits, selectedBranch, branches, onBranchChange }) => {
  return (
    <div className="history-tab">
      <div className="history-header">
        <select
          value={selectedBranch}
          onChange={(e) => onBranchChange(e.target.value)}
          className="branch-select"
        >
          {branches.map(b => (
            <option key={b.name} value={b.name}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="commits-list">
        {commits.length === 0 ? (
          <div className="empty-state">No commits found</div>
        ) : (
          commits.map(commit => (
            <div key={commit.sha} className="commit-item">
              <div className="commit-info">
                <span className="commit-message">{commit.message}</span>
                <div className="commit-meta">
                  <span className="commit-author">{commit.author}</span>
                  <span className="commit-date">
                    {new Date(commit.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <span className="commit-sha">{commit.sha.substring(0, 7)}</span>
            </div>
          ))
        )}
      </div>

      <style>{`
        .history-tab {
          padding: 10px 0;
        }

        .history-header {
          margin-bottom: 15px;
        }

        .branch-select {
          padding: 8px 12px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
          font-size: 14px;
          min-width: 200px;
        }

        .commits-list {
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .commit-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .commit-item:last-child {
          border-bottom: none;
        }

        .commit-info {
          flex: 1;
        }

        .commit-message {
          font-size: 14px;
          font-weight: 500;
          display: block;
          margin-bottom: 4px;
        }

        .commit-meta {
          font-size: 12px;
          color: var(--text-secondary, #666);
          display: flex;
          gap: 12px;
        }

        .commit-sha {
          font-family: monospace;
          font-size: 12px;
          color: var(--text-secondary, #666);
          background: var(--bg-secondary, #f8f9fa);
          padding: 4px 8px;
          border-radius: 4px;
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: var(--text-secondary, #666);
        }
      `}</style>
    </div>
  );
};

// Sync Tab Component
const SyncTab: React.FC<{
  syncStatus: GitDiff[];
  onPush: () => void;
  onPull: () => void;
  isPulling: boolean;
  onRefresh: () => void;
}> = ({ syncStatus, onPush, onPull, isPulling, onRefresh }) => {
  const localChanges = syncStatus.filter(s => s.status === 'modified' || s.status === 'added');
  const remoteChanges = syncStatus.filter(s => s.remoteVersion && s.remoteVersion !== s.localVersion);

  return (
    <div className="sync-tab">
      <div className="sync-actions">
        <button className="btn btn-secondary" onClick={onRefresh}>
          Refresh Status
        </button>
        <button
          className="btn btn-primary"
          onClick={onPush}
          disabled={localChanges.length === 0}
        >
          Push Changes ({localChanges.length})
        </button>
        <button
          className="btn btn-secondary"
          onClick={onPull}
          disabled={isPulling || remoteChanges.length === 0}
        >
          {isPulling ? 'Pulling...' : `Pull Changes (${remoteChanges.length})`}
        </button>
      </div>

      {localChanges.length > 0 && (
        <div className="changes-section">
          <h3>Local Changes</h3>
          <div className="changes-list">
            {localChanges.map(change => (
              <div key={change.workflowId} className={`change-item ${change.status}`}>
                <span className="status-icon">
                  {change.status === 'added' ? '+' : change.status === 'modified' ? '~' : '-'}
                </span>
                <span className="workflow-name">{change.workflowName}</span>
                <span className="change-status">{change.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {remoteChanges.length > 0 && (
        <div className="changes-section">
          <h3>Remote Changes</h3>
          <div className="changes-list">
            {remoteChanges.map(change => (
              <div key={change.workflowId} className="change-item remote">
                <span className="status-icon">↓</span>
                <span className="workflow-name">{change.workflowName}</span>
                <span className="change-status">updated remotely</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {localChanges.length === 0 && remoteChanges.length === 0 && (
        <div className="sync-status-ok">
          <span className="checkmark">✓</span>
          <p>Everything is up to date</p>
        </div>
      )}

      <style>{`
        .sync-tab {
          padding: 10px 0;
        }

        .sync-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
        }

        .changes-section {
          margin-bottom: 20px;
        }

        .changes-section h3 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .changes-list {
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }

        .change-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          gap: 12px;
        }

        .change-item:last-child {
          border-bottom: none;
        }

        .status-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          font-weight: bold;
          font-size: 14px;
        }

        .change-item.added .status-icon {
          background: #d4edda;
          color: #155724;
        }

        .change-item.modified .status-icon {
          background: #fff3cd;
          color: #856404;
        }

        .change-item.deleted .status-icon {
          background: #f8d7da;
          color: #721c24;
        }

        .change-item.remote .status-icon {
          background: #cce5ff;
          color: #004085;
        }

        .workflow-name {
          flex: 1;
          font-size: 14px;
        }

        .change-status {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }

        .sync-status-ok {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 8px;
        }

        .sync-status-ok .checkmark {
          display: block;
          font-size: 48px;
          color: #28a745;
          margin-bottom: 10px;
        }

        .sync-status-ok p {
          color: var(--text-secondary, #666);
          margin: 0;
        }
      `}</style>
    </div>
  );
};

// Connect Repository Modal
const ConnectRepositoryModal: React.FC<{
  onClose: () => void;
  onConnect: (data: { provider: string; url: string; branch: string; token: string }) => void;
  isConnecting: boolean;
  error?: string;
}> = ({ onClose, onConnect, isConnecting, error }) => {
  const [provider, setProvider] = useState('github');
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect({ provider, url, branch, token });
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Connect Repository</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Provider</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
              <option value="bitbucket">Bitbucket</option>
              <option value="azure">Azure DevOps</option>
            </select>
          </div>

          <div className="form-group">
            <label>Repository URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/username/repo.git"
              required
            />
          </div>

          <div className="form-group">
            <label>Default Branch</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
            />
          </div>

          <div className="form-group">
            <label>Access Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Personal access token"
              required
            />
            <span className="help-text">
              Generate a token with repo permissions from your Git provider
            </span>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-secondary, #666);
        }

        form {
          padding: 20px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
          font-size: 14px;
        }

        .help-text {
          display: block;
          margin-top: 4px;
          font-size: 12px;
          color: var(--text-secondary, #666);
        }

        .error-message {
          background: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 15px;
          font-size: 14px;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--border-color, #e0e0e0);
        }
      `}</style>
    </div>
  );
};

// Commit Modal
const CommitModal: React.FC<{
  pendingChanges: GitDiff[];
  onClose: () => void;
  onCommit: (message: string, workflowIds?: string[]) => void;
  isCommitting: boolean;
}> = ({ pendingChanges, onClose, onCommit, isCommitting }) => {
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(pendingChanges.map(c => c.workflowId))
  );

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCommit(message, Array.from(selectedIds));
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Push Changes</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Commit Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your changes..."
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label>Changes to Include ({selectedIds.size} selected)</label>
            <div className="changes-checklist">
              {pendingChanges.map(change => (
                <label key={change.workflowId} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(change.workflowId)}
                    onChange={() => toggleSelection(change.workflowId)}
                  />
                  <span className={`status-badge ${change.status}`}>
                    {change.status === 'added' ? '+' : '~'}
                  </span>
                  {change.workflowName}
                </label>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isCommitting || selectedIds.size === 0 || !message}
            >
              {isCommitting ? 'Pushing...' : 'Push Changes'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
        }

        .changes-checklist {
          max-height: 200px;
          overflow-y: auto;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }

        .checkbox-item:last-child {
          border-bottom: none;
        }

        .checkbox-item:hover {
          background: var(--bg-secondary, #f8f9fa);
        }

        .checkbox-item input {
          width: auto;
        }

        .status-badge {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .status-badge.added {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.modified {
          background: #fff3cd;
          color: #856404;
        }
      `}</style>
    </div>
  );
};

export default GitIntegration;
