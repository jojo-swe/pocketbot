/**
 * WebSocket chat service — mirrors the Web UI /ws/chat protocol.
 *
 * Server message types: connected, message, typing, error, pong
 * Client message types: { type: "message", content: "..." } | { type: "ping" }
 */

import { ServerConnection } from './storage';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onMessage: (msg: ChatMessage) => void;
  onTyping: (isTyping: boolean) => void;
  onError: (error: string) => void;
  onSessionId: (id: string) => void;
}

const RECONNECT_BASE_MS = 1000;
const MAX_RECONNECT = 8;

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let callbacks: ChatCallbacks | null = null;
let currentConn: ServerConnection | null = null;
let msgCounter = 0;

function makeId(): string {
  msgCounter += 1;
  return `msg_${Date.now()}_${msgCounter}`;
}

function wsUrl(conn: ServerConnection): string {
  const base = conn.url.replace(/\/+$/, '');
  const proto = base.startsWith('https') ? 'wss' : 'ws';
  const host = base.replace(/^https?:\/\//, '');
  const tokenParam = conn.token ? `?token=${encodeURIComponent(conn.token)}` : '';
  return `${proto}://${host}/ws/chat${tokenParam}`;
}

export function connect(conn: ServerConnection, cb: ChatCallbacks): void {
  disconnect();
  currentConn = conn;
  callbacks = cb;
  reconnectAttempts = 0;
  _connect();
}

function _connect(): void {
  if (!currentConn || !callbacks) return;

  callbacks.onStateChange('connecting');

  try {
    ws = new WebSocket(wsUrl(currentConn));
  } catch {
    callbacks.onStateChange('error');
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectAttempts = 0;
    callbacks?.onStateChange('connected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'connected':
          callbacks?.onSessionId(data.session_id);
          break;
        case 'message':
          callbacks?.onMessage({
            id: makeId(),
            role: data.role || 'assistant',
            content: data.content || '',
            timestamp: data.timestamp || new Date().toISOString(),
          });
          break;
        case 'typing':
          callbacks?.onTyping(!!data.status);
          break;
        case 'error':
          callbacks?.onError(data.content || 'Unknown error');
          break;
        case 'pong':
          break;
        default:
          break;
      }
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = (event) => {
    ws = null;
    if (event.code === 4001) {
      callbacks?.onError('Unauthorized — check your auth token');
      callbacks?.onStateChange('error');
      return;
    }
    callbacks?.onStateChange('disconnected');
    if (event.code === 1001) {
      // Server closed due to idle timeout — reconnect immediately (clean close)
      _connect();
    } else {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    callbacks?.onStateChange('error');
  };
}

function scheduleReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT) {
    callbacks?.onStateChange('error');
    return;
  }
  reconnectAttempts += 1;
  const delay = RECONNECT_BASE_MS * Math.pow(2, Math.min(reconnectAttempts - 1, 5));
  reconnectTimer = setTimeout(_connect, delay);
}

export function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.close();
    ws = null;
  }
  callbacks?.onStateChange('disconnected');
}

export function sendMessage(content: string): ChatMessage {
  const msg: ChatMessage = {
    id: makeId(),
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'message', content }));
  }
  return msg;
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}
