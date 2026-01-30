/**
 * Undo/Redo Hook for Workflow Editor
 * Provides history management with keyboard shortcuts
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export interface HistoryEntry<T> {
  state: T;
  timestamp: number;
  description?: string;
}

export interface UndoRedoOptions<T> {
  maxHistorySize?: number;
  debounceMs?: number;
  onUndo?: (state: T, description?: string) => void;
  onRedo?: (state: T, description?: string) => void;
  onChange?: (state: T) => void;
  isEqual?: (a: T, b: T) => boolean;
}

export interface UndoRedoState<T> {
  current: T;
  canUndo: boolean;
  canRedo: boolean;
  historyIndex: number;
  historyLength: number;
  undoStack: HistoryEntry<T>[];
  redoStack: HistoryEntry<T>[];
}

export interface UndoRedoActions<T> {
  set: (state: T, description?: string) => void;
  undo: () => void;
  redo: () => void;
  reset: (state: T) => void;
  clear: () => void;
  jumpTo: (index: number) => void;
  batch: (fn: () => void) => void;
}

/**
 * Custom hook for undo/redo functionality
 */
export function useUndoRedo<T>(
  initialState: T,
  options: UndoRedoOptions<T> = {}
): [UndoRedoState<T>, UndoRedoActions<T>] {
  const {
    maxHistorySize = 100,
    debounceMs = 300,
    onUndo,
    onRedo,
    onChange,
    isEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  } = options;

  const [undoStack, setUndoStack] = useState<HistoryEntry<T>[]>([
    { state: initialState, timestamp: Date.now() },
  ]);
  const [redoStack, setRedoStack] = useState<HistoryEntry<T>[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isBatching, setIsBatching] = useState(false);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastState = useRef<T>(initialState);
  const batchedChanges = useRef<HistoryEntry<T>[]>([]);

  const current = undoStack[historyIndex]?.state ?? initialState;
  const canUndo = historyIndex > 0;
  const canRedo = redoStack.length > 0;

  /**
   * Set new state with history tracking
   */
  const set = useCallback(
    (newState: T, description?: string) => {
      // Clear any pending debounced update
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Skip if state hasn't changed
      if (isEqual(newState, lastState.current)) {
        return;
      }

      const entry: HistoryEntry<T> = {
        state: newState,
        timestamp: Date.now(),
        description,
      };

      if (isBatching) {
        batchedChanges.current.push(entry);
        lastState.current = newState;
        return;
      }

      // Debounce rapid changes
      debounceTimer.current = setTimeout(() => {
        setUndoStack((prev) => {
          // Remove any future states if we're not at the latest
          const newStack = prev.slice(0, historyIndex + 1);

          // Add new state
          newStack.push(entry);

          // Limit history size
          if (newStack.length > maxHistorySize) {
            newStack.shift();
            return newStack;
          }

          return newStack;
        });

        setHistoryIndex((prev) => Math.min(prev + 1, maxHistorySize - 1));
        setRedoStack([]);
        lastState.current = newState;
        onChange?.(newState);
      }, debounceMs);
    },
    [historyIndex, maxHistorySize, debounceMs, isEqual, onChange, isBatching]
  );

  /**
   * Undo last change
   */
  const undo = useCallback(() => {
    if (!canUndo) return;

    const currentEntry = undoStack[historyIndex];
    const previousEntry = undoStack[historyIndex - 1];

    setRedoStack((prev) => [currentEntry, ...prev]);
    setHistoryIndex((prev) => prev - 1);
    lastState.current = previousEntry.state;
    onChange?.(previousEntry.state);
    onUndo?.(previousEntry.state, currentEntry.description);
  }, [canUndo, undoStack, historyIndex, onChange, onUndo]);

  /**
   * Redo last undone change
   */
  const redo = useCallback(() => {
    if (!canRedo) return;

    const nextEntry = redoStack[0];

    setUndoStack((prev) => [...prev, nextEntry]);
    setRedoStack((prev) => prev.slice(1));
    setHistoryIndex((prev) => prev + 1);
    lastState.current = nextEntry.state;
    onChange?.(nextEntry.state);
    onRedo?.(nextEntry.state, nextEntry.description);
  }, [canRedo, redoStack, onChange, onRedo]);

  /**
   * Reset to a specific state, clearing history
   */
  const reset = useCallback(
    (state: T) => {
      setUndoStack([{ state, timestamp: Date.now() }]);
      setRedoStack([]);
      setHistoryIndex(0);
      lastState.current = state;
      onChange?.(state);
    },
    [onChange]
  );

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    const currentState = undoStack[historyIndex]?.state ?? initialState;
    reset(currentState);
  }, [undoStack, historyIndex, initialState, reset]);

  /**
   * Jump to a specific point in history
   */
  const jumpTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= undoStack.length) return;

      const targetEntry = undoStack[index];

      // Move states to/from redo stack as needed
      if (index < historyIndex) {
        // Moving back
        const redoEntries = undoStack.slice(index + 1, historyIndex + 1);
        setRedoStack((prev) => [...redoEntries.reverse(), ...prev]);
      } else if (index > historyIndex) {
        // Moving forward
        const entriesToRestore = redoStack.slice(0, index - historyIndex);
        setRedoStack((prev) => prev.slice(index - historyIndex));
        setUndoStack((prev) => [...prev, ...entriesToRestore]);
      }

      setHistoryIndex(index);
      lastState.current = targetEntry.state;
      onChange?.(targetEntry.state);
    },
    [undoStack, redoStack, historyIndex, onChange]
  );

  /**
   * Batch multiple changes into a single undo step
   */
  const batch = useCallback(
    (fn: () => void) => {
      setIsBatching(true);
      batchedChanges.current = [];

      fn();

      setIsBatching(false);

      // Apply all batched changes as a single entry
      if (batchedChanges.current.length > 0) {
        const lastChange = batchedChanges.current[batchedChanges.current.length - 1];

        setUndoStack((prev) => {
          const newStack = prev.slice(0, historyIndex + 1);
          newStack.push({
            ...lastChange,
            description: `Batch: ${batchedChanges.current.length} changes`,
          });

          if (newStack.length > maxHistorySize) {
            newStack.shift();
          }

          return newStack;
        });

        setHistoryIndex((prev) => Math.min(prev + 1, maxHistorySize - 1));
        setRedoStack([]);
        onChange?.(lastChange.state);
      }
    },
    [historyIndex, maxHistorySize, onChange]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const state: UndoRedoState<T> = {
    current,
    canUndo,
    canRedo,
    historyIndex,
    historyLength: undoStack.length,
    undoStack,
    redoStack,
  };

  const actions: UndoRedoActions<T> = {
    set,
    undo,
    redo,
    reset,
    clear,
    jumpTo,
    batch,
  };

  return [state, actions];
}

/**
 * Hook to bind keyboard shortcuts for undo/redo
 */
export function useUndoRedoKeyboard(
  undo: () => void,
  redo: () => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      if (!cmdOrCtrl) return;

      // Ctrl/Cmd + Z = Undo
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
      if ((event.key === 'z' && event.shiftKey) || event.key === 'y') {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, enabled]);
}

export default useUndoRedo;
