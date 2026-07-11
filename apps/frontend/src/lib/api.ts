export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8090";
export const API_KEY_STORAGE = "dayz-aio.apiKey";

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) ?? "";
}

export function setApiKey(value: string) {
  if (value.trim()) localStorage.setItem(API_KEY_STORAGE, value.trim());
  else localStorage.removeItem(API_KEY_STORAGE);
}

export function getWebSocketUrl() {
  const url = new URL(API_BASE.replace(/^http/, "ws") + "/ws");
  const key = getApiKey();
  if (key) url.searchParams.set("apiKey", key);
  return url.toString();
}

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getApiKey();
  const headers = new Headers(init?.headers);
  if (key) headers.set("X-API-Key", key);
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    let message = res.statusText;
    try {
      if (contentType.includes("application/json")) {
        const payload = await res.json();
        message = payload.error ?? JSON.stringify(payload);
      } else {
        message = await res.text();
      }
    } catch {
      // keep statusText fallback
    }
    throw new ApiError(message || res.statusText, res.status, typeof message === "string" ? message : "");
  }
  if (!contentType.includes("application/json")) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> { return request<T>(path); }
export async function apiGetOrNull<T>(path: string, statuses = [404]): Promise<T | null> {
  try {
    return await request<T>(path);
  } catch (error) {
    if (error instanceof ApiError && statuses.includes(error.status)) return null;
    throw error;
  }
}
export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
}
export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PUT", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
}
export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "PATCH", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
}
export async function apiDelete<T>(path: string): Promise<T> { return request<T>(path, { method: "DELETE" }); }


export async function downloadApiFile(path: string) {
  const key = getApiKey();
  const headers = new Headers();
  if (key) headers.set("X-API-Key", key);
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) {
    const message = await res.text();
    throw new ApiError(message || res.statusText, res.status, typeof message === "string" ? message : "");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] ?? `dayz-aio-debug-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
