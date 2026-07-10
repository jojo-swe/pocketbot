/**
 * File helpers — converts local files to base64 data URLs for inline
 * media in gateway WebSocket message frames.
 */

import { ServerConnection } from './storage';

export interface PendingAttachment {
  /** Local URI (file:// or content://) */
  localUri: string;
  /** Display name */
  name: string;
  /** MIME type */
  mimeType: string;
  /** Base64 data URL after conversion, null while processing */
  serverUrl: string | null;
  /** True if processing is in progress */
  uploading: boolean;
  /** Error message if conversion failed */
  error: string | null;
}

/**
 * Read a local file and convert it to a base64 data URL.
 * Uses expo-file-system on native, fetch on web.
 */
export async function fileToDataUrl(
  localUri: string,
  mimeType: string,
): Promise<string> {
  // On web, fetch + FileReader
  if (localUri.startsWith('blob:') || localUri.startsWith('data:')) {
    return localUri;
  }
  try {
    const FileSystem = await import('expo-file-system');
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${mimeType};base64,${base64}`;
  } catch {
    // Fallback: fetch + blob (works on web)
    const res = await fetch(localUri);
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

/**
 * Build the full URL for a media file served by the pocketbot server.
 */
export function mediaUrl(conn: ServerConnection, path: string): string {
  const base = conn.url.replace(/\/+$/, '');
  return path.startsWith('http') ? path : `${base}${path}`;
}
