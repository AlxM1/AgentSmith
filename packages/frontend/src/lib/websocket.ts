// WebSocket Client for Real-time Updates
import { create } from 'zustand';

interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: unknown;
}

interface ExecutionUpdate {
  executionId: string;
  workflowId: string;
  workflowName?: string;
  status: string;
  nodeName?: string;
  error?: string;
}

interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  subscriptions: Set<string>;
  executionUpdates: Map<string, ExecutionUpdate>;

  connect: (token: string) => void;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  getExecutionStatus: (executionId: string) => ExecutionUpdate | undefined;
  clearExecutionUpdate: (executionId: string) => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  isAuthenticated: false,
  subscriptions: new Set(),
  executionUpdates: new Map(),

  connect: (token: string) => {
    const { socket } = get();

    // Don't reconnect if already connected
    if (socket?.readyState === WebSocket.OPEN) {
      return;
    }

    // Close existing socket if any
    if (socket) {
      socket.close();
    }

    const wsUrl = import.meta.env.VITE_WS_URL ||
      `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

    const ws = new WebSocket(`${wsUrl}?token=${token}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      set({ isConnected: true });
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleMessage(message, set, get);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      set({ isConnected: false, isAuthenticated: false });

      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        const { socket: currentSocket } = get();
        if (!currentSocket || currentSocket.readyState === WebSocket.CLOSED) {
          get().connect(token);
        }
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    set({ socket: ws });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null, isConnected: false, isAuthenticated: false });
    }
  },

  subscribe: (channel: string) => {
    const { socket, subscriptions } = get();
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'subscribe', channel }));
      subscriptions.add(channel);
      set({ subscriptions: new Set(subscriptions) });
    }
  },

  unsubscribe: (channel: string) => {
    const { socket, subscriptions } = get();
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'unsubscribe', channel }));
      subscriptions.delete(channel);
      set({ subscriptions: new Set(subscriptions) });
    }
  },

  getExecutionStatus: (executionId: string) => {
    return get().executionUpdates.get(executionId);
  },

  clearExecutionUpdate: (executionId: string) => {
    const { executionUpdates } = get();
    executionUpdates.delete(executionId);
    set({ executionUpdates: new Map(executionUpdates) });
  },
}));

// Handle incoming WebSocket messages
function handleMessage(
  message: WebSocketMessage,
  set: (state: Partial<WebSocketState>) => void,
  get: () => WebSocketState
) {
  switch (message.type) {
    case 'authenticated':
      set({ isAuthenticated: true });
      break;

    case 'execution:started':
    case 'execution:progress':
    case 'execution:completed': {
      const data = message.data as ExecutionUpdate;
      const { executionUpdates } = get();
      executionUpdates.set(data.executionId, data);
      set({ executionUpdates: new Map(executionUpdates) });

      // Dispatch custom event for components to listen
      window.dispatchEvent(new CustomEvent('execution-update', { detail: data }));
      break;
    }

    case 'workflow:updated': {
      window.dispatchEvent(new CustomEvent('workflow-updated', { detail: message.data }));
      break;
    }

    case 'system:notification': {
      window.dispatchEvent(new CustomEvent('system-notification', { detail: message.data }));
      break;
    }

    case 'subscribed':
    case 'unsubscribed':
      // Acknowledgment messages, no action needed
      break;

    case 'pong':
      // Heartbeat response
      break;

    case 'error':
      console.error('WebSocket error:', message.data);
      break;

    default:
      console.log('Unknown WebSocket message:', message);
  }
}

// React hook for using WebSocket in components
export function useWebSocket() {
  const store = useWebSocketStore();
  return {
    isConnected: store.isConnected,
    isAuthenticated: store.isAuthenticated,
    connect: store.connect,
    disconnect: store.disconnect,
    subscribe: store.subscribe,
    unsubscribe: store.unsubscribe,
  };
}

// React hook for execution updates
export function useExecutionUpdates(executionId?: string) {
  const store = useWebSocketStore();

  if (executionId) {
    return store.getExecutionStatus(executionId);
  }

  return store.executionUpdates;
}
