import { tokenStore } from "./tokenStore";
import type { TokenPair } from "../types/auth";

// .env.* is git-ignored, so a fresh clone has no VITE_API_BASE_URL. Fall back
// to the local backend in dev rather than silently fetching "undefined/...",
// but fail loudly in a production build - defaulting to localhost there would
// ship a broken app that looks fine until someone opens it.
const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.DEV
    ? "http://localhost:8000/api"
    : (() => {
        throw new Error("VITE_API_BASE_URL must be set for a production build");
      })());

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refresh_token = tokenStore.getRefresh();
  if (!refresh_token) return false;

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) {
    tokenStore.clear();
    return false;
  }
  const pair: TokenPair = await res.json();
  tokenStore.set(pair.access_token, pair.refresh_token);
  return true;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean; // default true
}

/** Core request helper: JSON in, JSON out, one automatic refresh-and-retry
 * on a 401 so a short-lived access token never surfaces as a login prompt
 * mid-session. */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;

  const doFetch = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) {
      const token = tokenStore.getAccess();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && auth) {
    if (!refreshInFlight) refreshInFlight = refreshTokens().finally(() => (refreshInFlight = null));
    const refreshed = await refreshInFlight;
    if (refreshed) res = await doFetch();
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, detail.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function get<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}
export function post<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body });
}
export function patch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PATCH", body });
}
