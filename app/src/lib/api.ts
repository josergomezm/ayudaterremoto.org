// The ONLY place VITE_API_URL is read. Everything else calls apiFetch / adminFetch.

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV
    ? 'http://127.0.0.1:5001/demo-app/us-central1/api'   // emulator fallback in dev
    : 'https://us-central1-ayudaterremotovenezuela.cloudfunctions.net/api')

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number }

// Field-tier device token (set by the session store after Cédula verification).
let authToken: string | null = null
export function setAuthToken(token: string | null) { authToken = token }
export function getAuthToken(): string | null { return authToken }

/**
 * Low-level JSON request. Throws nothing — every failure surfaces in the return
 * value. `token` is sent as a Bearer credential (field device token OR admin
 * Firebase ID token, depending on caller).
 */
export async function request<T>(path: string, init: RequestInit, token: string | null): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) }
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
    const text = await res.text()
    const body = text ? JSON.parse(text) : null
    if (!res.ok) {
      const error = (body && (body.message || body.error)) || `HTTP ${res.status}`
      return { ok: false, error, status: res.status }
    }
    return { ok: true, data: body as T }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/** Field-tier call: uses the device token. */
export function apiFetch<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  return request<T>(path, init, authToken)
}
