/**
 * Persistent storage for server connection settings and chat history.
 * Uses AsyncStorage (works on all platforms including web).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  SERVER_URL: 'pocketbot_server_url',
  BOOTSTRAP_SECRET: 'pocketbot_bootstrap_secret',
  CHAT_HISTORY: 'pocketbot_chat_history',
};

/** Maximum number of messages to persist (keeps storage bounded). */
const MAX_HISTORY = 200;

export interface ServerConnection {
  url: string;      // gateway base URL, e.g. "http://192.168.1.50:8765"
  secret: string;   // bootstrap secret (empty = localhost-only access)
}

const DEFAULT: ServerConnection = {
  url: '',
  secret: '',
};

export async function loadConnection(): Promise<ServerConnection> {
  try {
    const url = await AsyncStorage.getItem(KEYS.SERVER_URL);
    const secret = await AsyncStorage.getItem(KEYS.BOOTSTRAP_SECRET);
    return {
      url: url ?? DEFAULT.url,
      secret: secret ?? DEFAULT.secret,
    };
  } catch {
    return DEFAULT;
  }
}

export async function saveConnection(conn: ServerConnection): Promise<void> {
  await AsyncStorage.setItem(KEYS.SERVER_URL, conn.url);
  await AsyncStorage.setItem(KEYS.BOOTSTRAP_SECRET, conn.secret);
}

export async function clearConnection(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.SERVER_URL);
  await AsyncStorage.removeItem(KEYS.BOOTSTRAP_SECRET);
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
