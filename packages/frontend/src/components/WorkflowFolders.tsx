/**
 * Workflow Folders Component
 *
 * Hierarchical folder navigation for organizing workflows:
 * - Tree view with expand/collapse
 * - Drag and drop support
 * - Context menu for actions
 * - Search and filter
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  icon?: string;
  workflowCount: number;
  subfolderCount: number;
  path: string;
}

interface FolderTreeItem extends Folder {
  children: FolderTreeItem[];
  isExpanded?: boolean;
}

interface WorkflowFoldersProps {
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onWorkflowDrop?: (workflowId: string, folderId: string | null) => void;
}

export function WorkflowFolders({
  selectedFolderId,
  onFolderSelect,
  onWorkflowDrop,
}: WorkflowFoldersProps) {
  const queryClient = useQueryClient();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    folder: Folder;
  } | null>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Fetch folder tree
  const { data: foldersData, isLoading } = useQuery({
    queryKey: ['workflow-folders'],
    queryFn: async () => {
      const res = await fetch('/api/v1/workflows/folders');
      if (!res.ok) throw new Error('Failed to fetch folders');
      return res.json();
    },
  });

  // Create folder mutation
  const createFolder = useMutation({
    mutationFn: async (data: { name: string; parentId: string | null }) => {
      const res = await fetch('/api/v1/workflows/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create folder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-folders'] });
      setIsCreating(false);
      setNewFolderName('');
      setNewFolderParent(null);
    },
  });

  // Rename folder mutation
  const renameFolder = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/v1/workflows/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to rename folder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-folders'] });
      setEditingFolder(null);
    },
  });

  // Delete folder mutation
  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/workflows/folders/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete folder');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-folders'] });
      if (selectedFolderId === contextMenu?.folder.id) {
        onFolderSelect(null);
      }
      setContextMenu(null);
    },
  });

  // Move workflow mutation
  const moveWorkflow = useMutation({
    mutationFn: async ({ workflowId, folderId }: { workflowId: string; folderId: string | null }) => {
      const res = await fetch(`/api/v1/workflows/${workflowId}/folder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
      if (!res.ok) throw new Error('Failed to move workflow');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-folders'] });
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const toggleExpand = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, folder: Folder) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, folder });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverFolder(folderId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverFolder(null);

    const workflowId = e.dataTransfer.getData('workflowId');
    if (workflowId) {
      moveWorkflow.mutate({ workflowId, folderId });
      onWorkflowDrop?.(workflowId, folderId);
    }
  }, [moveWorkflow, onWorkflowDrop]);

  const handleDragLeave = useCallback(() => {
    setDragOverFolder(null);
  }, []);

  const renderFolder = (folder: FolderTreeItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const isDragOver = dragOverFolder === folder.id;
    const isEditing = editingFolder === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center px-2 py-1.5 rounded-md cursor-pointer group ${
            isSelected
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : isDragOver
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => !isEditing && onFolderSelect(folder.id)}
          onContextMenu={(e) => handleContextMenu(e, folder)}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDrop={(e) => handleDrop(e, folder.id)}
          onDragLeave={handleDragLeave}
        >
          {/* Expand/Collapse */}
          {folder.subfolderCount > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(folder.id);
              }}
              className="w-4 h-4 mr-1 flex items-center justify-center text-gray-500"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="w-4 h-4 mr-1" />
          )}

          {/* Folder Icon */}
          <span className="mr-2" style={{ color: folder.color || '#6B7280' }}>
            {folder.icon || '📁'}
          </span>

          {/* Folder Name */}
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                if (editName.trim() && editName !== folder.name) {
                  renameFolder.mutate({ id: folder.id, name: editName.trim() });
                } else {
                  setEditingFolder(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editName.trim() && editName !== folder.name) {
                    renameFolder.mutate({ id: folder.id, name: editName.trim() });
                  } else {
                    setEditingFolder(null);
                  }
                } else if (e.key === 'Escape') {
                  setEditingFolder(null);
                }
              }}
              className="flex-1 px-1 bg-white dark:bg-gray-700 border border-blue-500 rounded text-sm"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 text-sm truncate text-gray-700 dark:text-gray-300">
              {folder.name}
            </span>
          )}

          {/* Workflow Count */}
          {folder.workflowCount > 0 && (
            <span className="text-xs text-gray-400 ml-2">{folder.workflowCount}</span>
          )}

          {/* Actions (on hover) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setNewFolderParent(folder.id);
              setIsCreating(true);
            }}
            className="hidden group-hover:block ml-1 text-gray-400 hover:text-gray-600"
            title="Add subfolder"
          >
            +
          </button>
        </div>

        {/* Children */}
        {isExpanded && folder.children && folder.children.length > 0 && (
          <div>
            {folder.children.map((child) => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const folders: FolderTreeItem[] = foldersData?.folders || [];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">Folders</h3>
        <button
          onClick={() => {
            setNewFolderParent(null);
            setIsCreating(true);
          }}
          className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          title="Create folder"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Folder List */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* All Workflows */}
        <div
          className={`flex items-center px-2 py-1.5 rounded-md cursor-pointer ${
            selectedFolderId === null
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : dragOverFolder === 'root'
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          onClick={() => onFolderSelect(null)}
          onDragOver={(e) => handleDragOver(e, 'root')}
          onDrop={(e) => handleDrop(e, null)}
          onDragLeave={handleDragLeave}
        >
          <span className="mr-2">📋</span>
          <span className="text-sm text-gray-700 dark:text-gray-300">All Workflows</span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
        )}

        {/* Folders */}
        {folders.map((folder) => renderFolder(folder))}

        {/* Create New Folder Input */}
        {isCreating && (
          <div className="mt-2 px-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName.trim()) {
                  createFolder.mutate({ name: newFolderName.trim(), parentId: newFolderParent });
                } else if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewFolderName('');
                }
              }}
              onBlur={() => {
                if (!newFolderName.trim()) {
                  setIsCreating(false);
                }
              }}
            />
            <div className="flex justify-end mt-1 space-x-1">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewFolderName('');
                }}
                className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newFolderName.trim()) {
                    createFolder.mutate({ name: newFolderName.trim(), parentId: newFolderParent });
                  }
                }}
                disabled={!newFolderName.trim() || createFolder.isPending}
                className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                setEditingFolder(contextMenu.folder.id);
                setEditName(contextMenu.folder.name);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Rename
            </button>
            <button
              onClick={() => {
                setNewFolderParent(contextMenu.folder.id);
                setIsCreating(true);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Add Subfolder
            </button>
            <hr className="my-1 border-gray-200 dark:border-gray-700" />
            <button
              onClick={() => {
                if (confirm(`Delete folder "${contextMenu.folder.name}"?`)) {
                  deleteFolder.mutate(contextMenu.folder.id);
                }
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default WorkflowFolders;
