/**
 * AgentSmith WebSocket Hook
 * React hook for real-time updates
 */

import { useEffect, useRef, useCallback, useState } from 'react';

interface WSMessage {
  type: string;
  payload?: any;
  channel?: string;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WSMessage | null;
  sendMessage: (message: WSMessage) => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(
  token: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    autoConnect = true,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_URL || window.location.host;
    return `${protocol}//${host}/ws${token ? `?token=${token}` : ''}`;
  }, [token]);

  const connect = useCallback(() => {
    if (!token) {
      console.warn('[WebSocket] No token provided, skipping connection');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    try {
      const url = getWebSocketUrl();
      console.log('[WebSocket] Connecting to', url);

      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      wsRef.current.onclose = (event) => {
        console.log('[WebSocket] Disconnected', event.code, event.reason);
        setIsConnected(false);

        // Attempt reconnection
        if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(
            `[WebSocket] Reconnecting... (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          );
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Handle specific message types
          switch (message.type) {
            case 'auth:success':
              console.log('[WebSocket] Authenticated');
              break;
            case 'auth:failed':
              console.error('[WebSocket] Authentication failed');
              wsRef.current?.close();
              break;
            case 'pong':
              // Heartbeat response
              break;
            default:
              // Emit custom event for other components to listen to
              window.dispatchEvent(
                new CustomEvent('ws:message', { detail: message })
              );
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
    }
  }, [token, getWebSocketUrl, reconnect, maxReconnectAttempts, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message, not connected');
    }
  }, []);

  const subscribe = useCallback(
    (channel: string) => {
      sendMessage({ type: 'subscribe', channel });
    },
    [sendMessage]
  );

  const unsubscribe = useCallback(
    (channel: string) => {
      sendMessage({ type: 'unsubscribe', channel });
    },
    [sendMessage]
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, token, connect, disconnect]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const heartbeat = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 25000);

    return () => clearInterval(heartbeat);
  }, [isConnected, sendMessage]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

// Hook for listening to specific message types
export function useWebSocketEvent(
  eventType: string,
  callback: (payload: any) => void
) {
  useEffect(() => {
    const handler = (event: CustomEvent) => {
      if (event.detail?.type === eventType) {
        callback(event.detail.payload);
      }
    };

    window.addEventListener('ws:message', handler as EventListener);
    return () => {
      window.removeEventListener('ws:message', handler as EventListener);
    };
  }, [eventType, callback]);
}

// Hook for execution updates
export function useExecutionUpdates(
  executionId: string | null,
  onUpdate: (data: any) => void
) {
  const { subscribe, unsubscribe } = useWebSocket(null, { autoConnect: false });

  useEffect(() => {
    if (!executionId) return;

    const channel = `execution:${executionId}`;
    subscribe(channel);

    return () => {
      unsubscribe(channel);
    };
  }, [executionId, subscribe, unsubscribe]);

  useWebSocketEvent('execution:update', (payload) => {
    if (payload?.executionId === executionId) {
      onUpdate(payload);
    }
  });
}

export default useWebSocket;
