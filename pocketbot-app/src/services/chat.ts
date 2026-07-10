/**
 * WebSocket chat service — uses the gateway multiplexed WS protocol.
 *
 * Inbound events: ready, attached, delta, stream_end, turn_end, message, error
 * Outbound types: new_chat, attach, message (with chat_id, content, media)
 */

import { ServerConnection } from './storage';
import type { BootstrapResult } from './api';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** True while assistant text is still streaming (delta events arriving). */
  streaming?: boolean;
}

export interface OutboundMedia {
  data_url: string;
  name?: string;
}

export interface ChatCallbacks {
  onStateChange: (state: ConnectionState) => void;
  onMessage: (msg: ChatMessage) => void;
  /** Update an existing streaming message by id (delta accumulation). */
  onStreamDelta: (id: string, text: string) => void;
  /** Finalize a streaming message by id (stream_end / turn_end). */
  onStreamEnd: (id: string, fullText?: string) => void;
  onTyping: (isTyping: boolean) => void;
  onError: (error: string) => void;
  onReady: (chatId: string, clientId: string) => void;
}

const RECONNECT_BASE_MS = 1000;
const MAX_RECONNECT = 8;

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let callbacks: ChatCallbacks | null = null;
let currentBootstrap: BootstrapResult | null = null;
let currentConn: ServerConnection | null = null;
let msgCounter = 0;
let chatId: string | null = null;
let clientId: string | null = null;
/** ID of the assistant message currently being streamed. */
let streamingMsgId: string | null = null;
let intentionallyClosed = false;

function makeId(): string {
  msgCounter += 1;
  return `msg_${Date.now()}_${msgCounter}`;
}

function wsUrl(conn: ServerConnection, bootstrap: BootstrapResult): string {
  const base = conn.url.replace(/\/+$/, '');
  const proto = base.startsWith('https') ? 'wss' : 'ws';
  const host = base.replace(/^https?:\/\//, '');
  const wsPath = bootstrap.ws_path || '/';
  const tokenParam = `?token=${encodeURIComponent(bootstrap.token)}`;
  return `${proto}://${host}${wsPath}${tokenParam}`;
}

export function connect(
  conn: ServerConnection,
  bootstrap: BootstrapResult,
  cb: ChatCallbacks,
): void {
  disconnect();
  currentConn = conn;
  currentBootstrap = bootstrap;
  callbacks = cb;
  reconnectAttempts = 0;
  intentionallyClosed = false;
  _connect();
}

function _connect(): void {
  if (!currentConn || !currentBootstrap || !callbacks) return;

  callbacks.onStateChange('connecting');

  try {
    ws = new WebSocket(wsUrl(currentConn, currentBootstrap));
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
      const ev = JSON.parse(event.data);
      handleInboundEvent(ev);
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = (event) => {
    ws = null;
    if (event.code === 4001 || event.code === 1008) {
      callbacks?.onError('Unauthorized — check your bootstrap secret');
      callbacks?.onStateChange('error');
      return;
    }
    if (intentionallyClosed) return;
    callbacks?.onStateChange('disconnected');
    if (event.code === 1001) {
      _connect();
    } else {
      scheduleReconnect();
    }
  };

  ws.onerror = () => {
    callbacks?.onStateChange('error');
  };
}

function handleInboundEvent(ev: Record<string, unknown>): void {
  const eventType = ev.event as string | undefined;

  switch (eventType) {
    case 'ready': {
      chatId = (ev.chat_id as string) || null;
      clientId = (ev.client_id as string) || null;
      if (chatId) callbacks?.onReady(chatId, clientId ?? '');
      break;
    }

    case 'attached': {
      // Re-attach confirmation — no action needed for single-chat mobile app
      break;
    }

    case 'delta': {
      const text = (ev.text as string) || '';
      if (!streamingMsgId) {
        // Start a new streaming assistant message
        streamingMsgId = makeId();
        callbacks?.onMessage({
          id: streamingMsgId,
          role: 'assistant',
          content: text,
          timestamp: new Date().toISOString(),
          streaming: true,
        });
        callbacks?.onTyping(true);
      } else {
        callbacks?.onStreamDelta(streamingMsgId, text);
      }
      break;
    }

    case 'stream_end': {
      if (streamingMsgId) {
        const finalText = ev.text as string | undefined;
        callbacks?.onStreamEnd(streamingMsgId, finalText);
        callbacks?.onTyping(false);
        streamingMsgId = null;
      }
      break;
    }

    case 'turn_end': {
      if (streamingMsgId) {
        callbacks?.onStreamEnd(streamingMsgId);
        callbacks?.onTyping(false);
        streamingMsgId = null;
      }
      break;
    }

    case 'message': {
      // Non-streaming full assistant message (e.g. tool hints, proactive)
      const text = (ev.text as string) || '';
      const kind = (ev.kind as string) || undefined;
      // Skip trace/breadcrumb messages — only show conversational replies
      if (kind === 'tool_hint' || kind === 'progress' || kind === 'reasoning') {
        break;
      }
      callbacks?.onMessage({
        id: makeId(),
        role: 'assistant',
        content: text,
        timestamp: new Date().toISOString(),
      });
      break;
    }

    case 'error': {
      const detail = (ev.detail as string) || 'Unknown error';
      const reason = ev.reason as string | undefined;
      callbacks?.onError(reason ? `${detail}: ${reason}` : detail);
      break;
    }

    case 'goal_status': {
      const status = (ev.status as string) || 'idle';
      callbacks?.onTyping(status === 'running');
      break;
    }

    default:
      break;
  }
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
  intentionallyClosed = true;
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

export function sendMessage(
  content: string,
  media?: OutboundMedia[],
): ChatMessage {
  const msg: ChatMessage = {
    id: makeId(),
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
  if (ws?.readyState === WebSocket.OPEN && chatId) {
    const frame: Record<string, unknown> = {
      type: 'message',
      chat_id: chatId,
      content,
      webui: true,
    };
    if (media && media.length > 0) {
      frame.media = media;
    }
    ws.send(JSON.stringify(frame));
  }
  return msg;
}

export function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

export function getChatId(): string | null {
  return chatId;
}
