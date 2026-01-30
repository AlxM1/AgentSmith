// Keyboard Shortcuts Hook for Workflow Editor
import { useEffect, useCallback } from 'react';
import { create } from 'zustand';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  category: string;
  action: () => void;
}

interface ShortcutsState {
  shortcuts: Map<string, Shortcut>;
  isModalOpen: boolean;
  registerShortcut: (id: string, shortcut: Shortcut) => void;
  unregisterShortcut: (id: string) => void;
  openModal: () => void;
  closeModal: () => void;
}

export const useShortcutsStore = create<ShortcutsState>((set, get) => ({
  shortcuts: new Map(),
  isModalOpen: false,

  registerShortcut: (id: string, shortcut: Shortcut) => {
    const { shortcuts } = get();
    shortcuts.set(id, shortcut);
    set({ shortcuts: new Map(shortcuts) });
  },

  unregisterShortcut: (id: string) => {
    const { shortcuts } = get();
    shortcuts.delete(id);
    set({ shortcuts: new Map(shortcuts) });
  },

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
}));

// Create a unique key for a keyboard event
function getShortcutKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  parts.push(e.key.toLowerCase());
  return parts.join('+');
}

// Create a unique key from a Shortcut config
function getShortcutKeyFromConfig(shortcut: Shortcut): string {
  const parts: string[] = [];
  if (shortcut.ctrl || shortcut.meta) parts.push('ctrl');
  if (shortcut.shift) parts.push('shift');
  if (shortcut.alt) parts.push('alt');
  parts.push(shortcut.key.toLowerCase());
  return parts.join('+');
}

// Global keyboard event handler
let isListenerAttached = false;

function attachGlobalListener() {
  if (isListenerAttached) return;
  isListenerAttached = true;

  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow Escape key even in inputs
      if (e.key !== 'Escape') return;
    }

    const shortcutKey = getShortcutKey(e);
    const { shortcuts } = useShortcutsStore.getState();

    for (const [id, shortcut] of shortcuts) {
      const configKey = getShortcutKeyFromConfig(shortcut);
      if (configKey === shortcutKey) {
        e.preventDefault();
        shortcut.action();
        break;
      }
    }
  });
}

// Initialize global listener
if (typeof window !== 'undefined') {
  attachGlobalListener();
}

// Hook to register shortcuts
export function useKeyboardShortcuts() {
  const store = useShortcutsStore();

  const register = useCallback((id: string, shortcut: Shortcut) => {
    store.registerShortcut(id, shortcut);
  }, [store]);

  const unregister = useCallback((id: string) => {
    store.unregisterShortcut(id);
  }, [store]);

  return {
    register,
    unregister,
    shortcuts: store.shortcuts,
    isModalOpen: store.isModalOpen,
    openModal: store.openModal,
    closeModal: store.closeModal,
  };
}

// Hook with default workflow editor shortcuts
export function useWorkflowEditorShortcuts(handlers: {
  onSave?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onCut?: () => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
  onDeselect?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onFitView?: () => void;
  onToggleGrid?: () => void;
  onToggleMinimap?: () => void;
  onExecute?: () => void;
  onAddNode?: () => void;
  onSearch?: () => void;
  onHelp?: () => void;
}) {
  const { register, unregister } = useKeyboardShortcuts();

  useEffect(() => {
    const shortcuts: [string, Shortcut][] = [
      // File operations
      ['save', { key: 's', ctrl: true, description: 'Save workflow', category: 'File', action: handlers.onSave || (() => {}) }],

      // Edit operations
      ['undo', { key: 'z', ctrl: true, description: 'Undo', category: 'Edit', action: handlers.onUndo || (() => {}) }],
      ['redo', { key: 'z', ctrl: true, shift: true, description: 'Redo', category: 'Edit', action: handlers.onRedo || (() => {}) }],
      ['copy', { key: 'c', ctrl: true, description: 'Copy selected nodes', category: 'Edit', action: handlers.onCopy || (() => {}) }],
      ['paste', { key: 'v', ctrl: true, description: 'Paste nodes', category: 'Edit', action: handlers.onPaste || (() => {}) }],
      ['cut', { key: 'x', ctrl: true, description: 'Cut selected nodes', category: 'Edit', action: handlers.onCut || (() => {}) }],
      ['delete', { key: 'Delete', description: 'Delete selected nodes', category: 'Edit', action: handlers.onDelete || (() => {}) }],
      ['delete-backspace', { key: 'Backspace', description: 'Delete selected nodes', category: 'Edit', action: handlers.onDelete || (() => {}) }],
      ['select-all', { key: 'a', ctrl: true, description: 'Select all nodes', category: 'Edit', action: handlers.onSelectAll || (() => {}) }],
      ['deselect', { key: 'Escape', description: 'Deselect all', category: 'Edit', action: handlers.onDeselect || (() => {}) }],

      // View operations
      ['zoom-in', { key: '=', ctrl: true, description: 'Zoom in', category: 'View', action: handlers.onZoomIn || (() => {}) }],
      ['zoom-out', { key: '-', ctrl: true, description: 'Zoom out', category: 'View', action: handlers.onZoomOut || (() => {}) }],
      ['zoom-reset', { key: '0', ctrl: true, description: 'Reset zoom', category: 'View', action: handlers.onZoomReset || (() => {}) }],
      ['fit-view', { key: '1', ctrl: true, description: 'Fit view', category: 'View', action: handlers.onFitView || (() => {}) }],
      ['toggle-grid', { key: 'g', ctrl: true, description: 'Toggle grid', category: 'View', action: handlers.onToggleGrid || (() => {}) }],
      ['toggle-minimap', { key: 'm', ctrl: true, description: 'Toggle minimap', category: 'View', action: handlers.onToggleMinimap || (() => {}) }],

      // Workflow operations
      ['execute', { key: 'Enter', ctrl: true, description: 'Execute workflow', category: 'Workflow', action: handlers.onExecute || (() => {}) }],
      ['add-node', { key: 'n', ctrl: true, description: 'Add new node', category: 'Workflow', action: handlers.onAddNode || (() => {}) }],
      ['search', { key: 'k', ctrl: true, description: 'Search nodes', category: 'Workflow', action: handlers.onSearch || (() => {}) }],

      // Help
      ['help', { key: '?', shift: true, description: 'Show shortcuts', category: 'Help', action: handlers.onHelp || (() => {}) }],
    ];

    // Register all shortcuts
    shortcuts.forEach(([id, shortcut]) => {
      if (shortcut.action) {
        register(id, shortcut);
      }
    });

    // Cleanup
    return () => {
      shortcuts.forEach(([id]) => {
        unregister(id);
      });
    };
  }, [register, unregister, handlers]);
}

// Format shortcut for display
export function formatShortcut(shortcut: Shortcut): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const parts: string[] = [];
  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // Format the key
  let keyDisplay = shortcut.key;
  const keyMap: Record<string, string> = {
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': '↵',
    'Escape': 'Esc',
    'Backspace': '⌫',
    'Delete': 'Del',
    ' ': 'Space',
  };
  if (keyMap[shortcut.key]) {
    keyDisplay = keyMap[shortcut.key];
  } else {
    keyDisplay = shortcut.key.toUpperCase();
  }

  parts.push(keyDisplay);

  return parts.join(isMac ? '' : '+');
}

export default useKeyboardShortcuts;
