// WebSocket Service for Real-time Updates
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

interface WebSocketClient extends WebSocket {
  userId?: string;
  isAlive?: boolean;
  subscriptions?: Set<string>;
}

interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: unknown;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<WebSocketClient>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: Server): void {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      verifyClient: (info, callback) => {
        // Allow connection, authentication happens after
        callback(true);
      }
    });

    this.wss.on('connection', (ws: WebSocketClient, request) => {
      ws.isAlive = true;
      ws.subscriptions = new Set();

      // Extract token from query string
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const token = url.searchParams.get('token');

      if (token) {
        this.authenticateClient(ws, token);
      }

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        this.removeClient(ws);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
        this.removeClient(ws);
      });

      // Send welcome message
      this.send(ws, {
        type: 'connected',
        data: { message: 'Connected to AgentSmith WebSocket' }
      });
    });

    // Heartbeat to detect stale connections
    this.heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws: WebSocketClient) => {
        if (ws.isAlive === false) {
          this.removeClient(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    logger.info('WebSocket server initialized');
  }

  private authenticateClient(ws: WebSocketClient, token: string): void {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      ws.userId = decoded.userId;

      // Add to user's client set
      if (!this.clients.has(decoded.userId)) {
        this.clients.set(decoded.userId, new Set());
      }
      this.clients.get(decoded.userId)?.add(ws);

      this.send(ws, {
        type: 'authenticated',
        data: { userId: decoded.userId }
      });

      logger.debug(`WebSocket client authenticated: ${decoded.userId}`);
    } catch (error) {
      this.sendError(ws, 'Authentication failed');
    }
  }

  private handleMessage(ws: WebSocketClient, message: WebSocketMessage): void {
    switch (message.type) {
      case 'authenticate':
        if (typeof message.data === 'object' && message.data && 'token' in message.data) {
          this.authenticateClient(ws, (message.data as { token: string }).token);
        }
        break;

      case 'subscribe':
        if (message.channel) {
          ws.subscriptions?.add(message.channel);
          this.send(ws, {
            type: 'subscribed',
            channel: message.channel
          });
        }
        break;

      case 'unsubscribe':
        if (message.channel) {
          ws.subscriptions?.delete(message.channel);
          this.send(ws, {
            type: 'unsubscribed',
            channel: message.channel
          });
        }
        break;

      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      default:
        logger.debug(`Unknown WebSocket message type: ${message.type}`);
    }
  }

  private removeClient(ws: WebSocketClient): void {
    if (ws.userId) {
      const userClients = this.clients.get(ws.userId);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) {
          this.clients.delete(ws.userId);
        }
      }
    }
  }

  private send(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.send(ws, { type: 'error', data: { message: error } });
  }

  // Public methods for broadcasting

  /**
   * Send message to a specific user (all their connected clients)
   */
  sendToUser(userId: string, message: WebSocketMessage): void {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach(client => {
        this.send(client, message);
      });
    }
  }

  /**
   * Send message to all clients subscribed to a channel
   */
  broadcast(channel: string, message: WebSocketMessage): void {
    this.wss?.clients.forEach((ws: WebSocketClient) => {
      if (ws.subscriptions?.has(channel) && ws.readyState === WebSocket.OPEN) {
        this.send(ws, { ...message, channel });
      }
    });
  }

  /**
   * Send message to all authenticated clients
   */
  broadcastAll(message: WebSocketMessage): void {
    this.wss?.clients.forEach((ws: WebSocketClient) => {
      if (ws.userId && ws.readyState === WebSocket.OPEN) {
        this.send(ws, message);
      }
    });
  }

  // Execution events
  notifyExecutionStarted(userId: string, executionId: string, workflowId: string, workflowName: string): void {
    this.sendToUser(userId, {
      type: 'execution:started',
      data: { executionId, workflowId, workflowName, status: 'running' }
    });
    this.broadcast(`workflow:${workflowId}`, {
      type: 'execution:started',
      data: { executionId, workflowId, workflowName, status: 'running' }
    });
  }

  notifyExecutionProgress(userId: string, executionId: string, nodeName: string, status: string): void {
    this.sendToUser(userId, {
      type: 'execution:progress',
      data: { executionId, nodeName, status }
    });
  }

  notifyExecutionCompleted(userId: string, executionId: string, workflowId: string, status: string, error?: string): void {
    this.sendToUser(userId, {
      type: 'execution:completed',
      data: { executionId, workflowId, status, error }
    });
    this.broadcast(`workflow:${workflowId}`, {
      type: 'execution:completed',
      data: { executionId, workflowId, status, error }
    });
  }

  // Workflow events
  notifyWorkflowUpdated(workflowId: string, updatedBy: string): void {
    this.broadcast(`workflow:${workflowId}`, {
      type: 'workflow:updated',
      data: { workflowId, updatedBy, timestamp: new Date().toISOString() }
    });
  }

  // System events
  notifySystemEvent(event: string, data: unknown): void {
    this.broadcastAll({
      type: `system:${event}`,
      data
    });
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss?.close();
    logger.info('WebSocket server shut down');
  }
}

export const webSocketService = new WebSocketService();
