import { invoke } from '@tauri-apps/api/core';

export interface BackendInfo {
  port: number;
  token: string;
}

// Tauri v2 sets this global in the webview
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Resolves backend connection details from one of two sources:
 *  1. URL params  ?port=PORT&token=TOKEN  — for browser-based development
 *  2. Tauri IPC   invoke('get_backend_info') — normal desktop runtime
 *
 * Browser dev workflow:
 *   cd node-backend && npm run dev
 *   # copy the "Browser dev URL" line printed to stderr
 *   # paste it in the browser
 */
export async function getBackendInfo(): Promise<BackendInfo> {
  const params = new URLSearchParams(window.location.search);
  const port = params.get('port');
  const token = params.get('token');
  if (port && token) {
    return { port: Number(port), token };
  }

  if (!isTauri()) {
    throw new Error(
      'Running in browser without backend params.\n' +
      'Start node-backend and open the "Browser dev URL" it prints.'
    );
  }

  return invoke<BackendInfo>('get_backend_info');
}

export function apiUrl(path: string, info: BackendInfo): string {
  return `http://127.0.0.1:${info.port}${path}`;
}

export function authHeaders(info: BackendInfo): Record<string, string> {
  return { 'x-session-token': info.token, 'Content-Type': 'application/json' };
}
