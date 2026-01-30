/**
 * AgentSmith WebSocket Server
 * Real-time updates for workflow execution, notifications, and more
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { logAuditEvent } from '../security/index.js';

// ============================================
// TYPES
// ============================================

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  userEmail?: string;
  isAlive: boolean;
  subscriptions: Set<string>;
}

interface WSMessage {
  type: string;
  payload?: unknown;
  channel?: string;
}

interface BroadcastOptions {
  channel?: string;
  excludeUserId?: string;
  onlyUserId?: string;
}

// ============================================
// WEBSOCKET SERVER
// ============================================

class AgentSmithWebSocket {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   */
  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      clientTracking: true,
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws as AuthenticatedWebSocket, req);
    });

    // Start heartbeat to detect dead connections
    this.heartbeatInterval = setInterval(() => {
      this.heartbeat();
    }, 30000);

    console.log('[WebSocket] Server initialized on /ws');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: AuthenticatedWebSocket, req: any): void {
    ws.isAlive = true;
    ws.subscriptions = new Set();

    // Authenticate via token in query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'your-secret-key'
        ) as { userId: string; email: string };

        ws.userId = decoded.userId;
        ws.userEmail = decoded.email;

        // Add to user's client set
        if (!this.clients.has(decoded.userId)) {
          this.clients.set(decoded.userId, new Set());
        }
        this.clients.get(decoded.userId)!.add(ws);

        // Send authentication success
        this.send(ws, {
          type: 'auth:success',
          payload: { userId: decoded.userId },
        });

        logAuditEvent({
          userId: decoded.userId,
          userEmail: decoded.email,
          action: 'WS_CONNECT',
          resource: 'websocket',
          ipAddress: req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          status: 'success',
        });
      } catch (error) {
        this.send(ws, {
          type: 'auth:failed',
          payload: { error: 'Invalid token' },
        });
        ws.close(4001, 'Unauthorized');
        return;
      }
    }

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });

    // Handle pong (heartbeat response)
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle close
    ws.on('close', () => {
      this.handleDisconnect(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
      this.handleDisconnect(ws);
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(ws: AuthenticatedWebSocket, data: any): void {
    try {
      const message: WSMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          if (message.channel) {
            ws.subscriptions.add(message.channel);
            this.send(ws, {
              type: 'subscribed',
              payload: { channel: message.channel },
            });
          }
          break;

        case 'unsubscribe':
          if (message.channel) {
            ws.subscriptions.delete(message.channel);
            this.send(ws, {
              type: 'unsubscribed',
              payload: { channel: message.channel },
            });
          }
          break;

        case 'ping':
          this.send(ws, { type: 'pong' });
          break;

        default:
          // Unknown message type
          this.send(ws, {
            type: 'error',
            payload: { message: 'Unknown message type' },
          });
      }
    } catch (error) {
      this.send(ws, {
        type: 'error',
        payload: { message: 'Invalid message format' },
      });
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(ws: AuthenticatedWebSocket): void {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(ws.userId);
        }
      }

      logAuditEvent({
        userId: ws.userId,
        userEmail: ws.userEmail,
        action: 'WS_DISCONNECT',
        resource: 'websocket',
        ipAddress: 'unknown',
        userAgent: 'unknown',
        status: 'success',
      });
    }
  }

  /**
   * Heartbeat to detect dead connections
   */
  private heartbeat(): void {
    if (!this.wss) return;

    this.wss.clients.forEach((ws) => {
      const client = ws as AuthenticatedWebSocket;
      if (!client.isAlive) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      client.ping();
    });
  }

  /**
   * Send message to a specific client
   */
  private send(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WSMessage, options?: BroadcastOptions): void {
    if (!this.wss) return;

    this.wss.clients.forEach((ws) => {
      const client = ws as AuthenticatedWebSocket;

      // Check if client is connected
      if (client.readyState !== WebSocket.OPEN) return;

      // Check channel subscription
      if (options?.channel && !client.subscriptions.has(options.channel)) {
        return;
      }

      // Check user exclusion
      if (options?.excludeUserId && client.userId === options.excludeUserId) {
        return;
      }

      // Check user inclusion
      if (options?.onlyUserId && client.userId !== options.onlyUserId) {
        return;
      }

      this.send(client, message);
    });
  }

  /**
   * Send message to a specific user (all their connected clients)
   */
  sendToUser(userId: string, message: WSMessage): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach((ws) => {
        this.send(ws, message);
      });
    }
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.wss?.clients.size || 0;
  }

  /**
   * Get connected user IDs
   */
  getConnectedUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }
}

// Singleton instance
export const wsServer = new AgentSmithWebSocket();

// ============================================
// HELPER FUNCTIONS FOR COMMON EVENTS
// ============================================

/**
 * Notify about workflow execution status change
 */
export function notifyExecutionUpdate(
  userId: string,
  executionId: string,
  status: string,
  data?: Record<string, unknown>
): void {
  wsServer.sendToUser(userId, {
    type: 'execution:update',
    payload: {
      executionId,
      status,
      ...data,
      timestamp: new Date().toISOString(),
    },
  });

  // Also broadcast to execution channel subscribers
  wsServer.broadcast(
    {
      type: 'execution:update',
      channel: `execution:${executionId}`,
      payload: {
        executionId,
        status,
        ...data,
        timestamp: new Date().toISOString(),
      },
    },
    { channel: `execution:${executionId}` }
  );
}

/**
 * Notify about workflow save/update
 */
export function notifyWorkflowUpdate(
  userId: string,
  workflowId: string,
  action: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated'
): void {
  wsServer.sendToUser(userId, {
    type: 'workflow:update',
    payload: {
      workflowId,
      action,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Notify about node execution progress
 */
export function notifyNodeProgress(
  userId: string,
  executionId: string,
  nodeId: string,
  status: 'running' | 'completed' | 'failed',
  data?: Record<string, unknown>
): void {
  wsServer.sendToUser(userId, {
    type: 'node:progress',
    payload: {
      executionId,
      nodeId,
      status,
      ...data,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send system notification to user
 */
export function sendNotification(
  userId: string,
  notification: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    link?: string;
  }
): void {
  wsServer.sendToUser(userId, {
    type: 'notification',
    payload: {
      ...notification,
      id: `notif_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Broadcast system-wide announcement
 */
export function broadcastAnnouncement(message: string, type: 'info' | 'warning'): void {
  wsServer.broadcast({
    type: 'announcement',
    payload: {
      message,
      type,
      timestamp: new Date().toISOString(),
    },
  });
}
