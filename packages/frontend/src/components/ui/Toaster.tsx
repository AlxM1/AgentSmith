import { create } from 'zustand';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '../../lib/utils';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: `${Date.now()}-${Math.random()}` },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export function toast(toast: Omit<Toast, 'id'>) {
  useToastStore.getState().addToast(toast);
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 5000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  return (
    <div
      className={cn(
        'pointer-events-auto relative flex w-full max-w-sm rounded-lg border p-4 shadow-lg',
        {
          'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800': toast.type === 'success',
          'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800': toast.type === 'error',
          'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800': toast.type === 'info',
          'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800': toast.type === 'warning',
        }
      )}
    >
      <div className="flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onRemove}
        className="ml-4 inline-flex shrink-0 rounded-md p-1 hover:bg-black/5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
