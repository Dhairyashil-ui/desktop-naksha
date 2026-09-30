/**
 * Naksha 2.0 API & WebSocket Configuration
 * Ensures bulletproof connectivity in both Tauri desktop window and web browser,
 * supporting both local engine (127.0.0.1:8000) and remote Cloud backend (e.g. Render).
 */

export const OFFICIAL_RENDER_BACKEND = 'https://desktop-naksha.onrender.com';

const getInitialBackendUrl = (): string => {
  // 1. Allow runtime override from localStorage (e.g. user toggling to local or another server)
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('naksha_backend_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  // 2. Vite environment variable (set at build or via .env)
  if (import.meta.env.VITE_BACKEND_URL) {
    return (import.meta.env.VITE_BACKEND_URL as string).replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return (import.meta.env.VITE_API_URL as string).replace(/\/+$/, '');
  }
  // 3. Official Hardcoded Production Cloud Backend (Render)
  return OFFICIAL_RENDER_BACKEND;
};

export const BACKEND_URL = getInitialBackendUrl();
export const API_BASE = BACKEND_URL;

export const getWebSocketUrl = (baseUrl: string = BACKEND_URL): string => {
  if (baseUrl.startsWith('https://')) {
    return baseUrl.replace('https://', 'wss://');
  }
  return baseUrl.replace('http://', 'ws://');
};

export const WS_BASE = getWebSocketUrl(BACKEND_URL);

/** Helper to switch backend URL at runtime (e.g. connecting to Render backend) */
export const setBackendUrl = (url: string) => {
  if (typeof window !== 'undefined') {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem('naksha_backend_url', cleanUrl);
    window.location.reload();
  }
};

