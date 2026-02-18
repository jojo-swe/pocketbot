/**
 * Persistent storage for server connection settings and chat history.
 * Uses AsyncStorage (works on all platforms including web).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SERVER_URL: 'pocketbot_server_url',
  AUTH_TOKEN: 'pocketbot_auth_token',
  CHAT_HISTORY: 'pocketbot_chat_history',
};

/** Maximum number of messages to persist (keeps storage bounded). */
const MAX_HISTORY = 200;

export interface ServerConnection {
  url: string;      // e.g. "http://192.168.1.50:8080"
  token: string;    // bearer token (empty = no auth)
}

const DEFAULT: ServerConnection = {
  url: '',
  token: '',
};

export async function loadConnection(): Promise<ServerConnection> {
  try {
    const url = await AsyncStorage.getItem(KEYS.SERVER_URL);
    const token = await AsyncStorage.getItem(KEYS.AUTH_TOKEN);
    return {
      url: url ?? DEFAULT.url,
      token: token ?? DEFAULT.token,
    };
  } catch {
    return DEFAULT;
  }
}

export async function saveConnection(conn: ServerConnection): Promise<void> {
  await AsyncStorage.setItem(KEYS.SERVER_URL, conn.url);
  await AsyncStorage.setItem(KEYS.AUTH_TOKEN, conn.token);
}

export async function clearConnection(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.SERVER_URL);
  await AsyncStorage.removeItem(KEYS.AUTH_TOKEN);
}

// ── Chat history ─────────────────────────────────────────────────────────────

export interface PersistedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export async function loadChatHistory(): Promise<PersistedMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.CHAT_HISTORY);
    if (!raw) return [];
    return JSON.parse(raw) as PersistedMessage[];
  } catch {
    return [];
  }
}

export async function saveChatHistory(
  messages: PersistedMessage[],
): Promise<void> {
  try {
    const trimmed = messages.slice(-MAX_HISTORY);
    await AsyncStorage.setItem(KEYS.CHAT_HISTORY, JSON.stringify(trimmed));
  } catch {
    // Non-fatal — history just won't persist this cycle
  }
}

export async function clearChatHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.CHAT_HISTORY);
}
