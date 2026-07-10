/**
 * REST API client for the pocketbot gateway.
 * Uses bootstrap flow to obtain short-lived tokens for WS + REST access.
 */

import { ServerConnection } from './storage';

function baseUrl(conn: ServerConnection): string {
  return conn.url.replace(/\/+$/, '');
}

function bootstrapHeaders(conn: ServerConnection): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (conn.secret) {
    h['Authorization'] = `Bearer ${conn.secret}`;
  }
  return h;
}

// ── Bootstrap result ───────────────────────────────────────────────────────

export interface BootstrapResult {
  token: string;
  ws_path: string;
  ws_url: string;
  expires_in: number;
  api_token?: string;
  model_name: string;
  runtime_surface: string;
  runtime_capabilities?: Record<string, unknown>;
}

async function fetchJSON<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Bootstrap ───────────────────────────────────────────────────────────────

export function bootstrap(conn: ServerConnection): Promise<BootstrapResult> {
  return fetchJSON<BootstrapResult>(`${baseUrl(conn)}/webui/bootstrap`, {
    method: 'GET',
    headers: bootstrapHeaders(conn),
  });
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface SettingsResponse {
  model?: string;
  model_preset?: string | null;
  provider?: string;
  max_tokens?: number;
  temperature?: number;
  memory_window?: number;
  max_tool_iterations?: number;
  workspace?: string;
  web_host?: string;
  web_port?: number;
  auth_enabled?: boolean;
  [key: string]: unknown;
}

export interface SettingsUpdateResponse {
  updated: Record<string, unknown>;
  errors: Record<string, string>;
  restart_required: boolean;
}

function apiHeaders(bootstrap: BootstrapResult): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bootstrap.api_token) {
    h['Authorization'] = `Bearer ${bootstrap.api_token}`;
  }
  return h;
}

export function getSettings(
  conn: ServerConnection,
  bootstrap: BootstrapResult,
): Promise<SettingsResponse> {
  return fetchJSON<SettingsResponse>(`${baseUrl(conn)}/api/settings`, {
    headers: apiHeaders(bootstrap),
  });
}

export function updateSettings(
  conn: ServerConnection,
  bootstrap: BootstrapResult,
  update: Record<string, unknown>,
): Promise<SettingsUpdateResponse> {
  return fetchJSON<SettingsUpdateResponse>(`${baseUrl(conn)}/api/settings/update`, {
    method: 'POST',
    headers: apiHeaders(bootstrap),
    body: JSON.stringify(update),
  });
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export interface SessionSummary {
  key: string;
  channel: string;
  chatId: string;
  createdAt: string | null;
  updatedAt: string | null;
  title?: string;
  preview: string;
}

export interface SessionsListResponse {
  sessions: SessionSummary[];
}

export function getSessions(
  conn: ServerConnection,
  bootstrap: BootstrapResult,
): Promise<SessionsListResponse> {
  return fetchJSON<SessionsListResponse>(`${baseUrl(conn)}/api/sessions`, {
    headers: apiHeaders(bootstrap),
  });
}

export function deleteSession(
  conn: ServerConnection,
  bootstrap: BootstrapResult,
  key: string,
): Promise<{ deleted: boolean }> {
  const encoded = encodeURIComponent(btoa(key));
  return fetchJSON<{ deleted: boolean }>(
    `${baseUrl(conn)}/api/sessions/${encoded}/delete`,
    { method: 'POST', headers: apiHeaders(bootstrap) },
  );
}

// ── Connectivity test ─────────────────────────────────────────────────────────

/**
 * Quick connectivity test — resolves true if bootstrap succeeds.
 */
export async function testConnection(conn: ServerConnection): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetchJSON<BootstrapResult>(`${baseUrl(conn)}/webui/bootstrap`, {
      method: 'GET',
      headers: bootstrapHeaders(conn),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}
