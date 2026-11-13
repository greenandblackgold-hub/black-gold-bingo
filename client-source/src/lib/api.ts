/**
 * src/lib/api.ts
 *
 * Talks to the Bingo API (see /server). When VITE_API_URL is set the whole app runs in
 * "server mode": real accounts, server-held wallets and cards, Chapa payments.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
/** Server mode = real accounts, wallets and payments. On when the site is served by the API itself, or VITE_API_URL is set. */
export const SERVER_MODE = import.meta.env.VITE_SERVER_MODE === 'true' || API_URL !== '';

const TOKEN_KEY = 'bgb.token';

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Fired when the server says the session is no longer valid. */
export const LOGOUT_EVENT = 'bgb:logout';

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', 'Network error');
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const e = (json ?? {}) as { error?: string; message?: string };
    if (res.status === 401 && token && path !== '/api/auth/login') window.dispatchEvent(new Event(LOGOUT_EVENT));
    throw new ApiError(res.status, e.error ?? 'error', e.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, body),
};

/* ───────────── response shapes ───────────── */

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  role: 'player' | 'admin';
  /** ETB */
  balance: number;
}

export interface ServerGameState {
  phase: 'waiting' | 'running' | 'ended';
  roundNumber: number;
  calledNumbers: number[];
  autoCall: boolean;
  callIntervalSec: number;
  nextCallAt: number | null;
  winner: { cardId: string; serial: string | number; at: number } | null;
  roomId: string;
  /** ETB */
  cardPrice: number;
  serverTime: number;
}

export interface ServerWithdrawal {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'paid' | 'rejected' | 'failed';
  at: number;
}
