const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("cf_token")
}

export function setToken(token: string) {
  localStorage.setItem("cf_token", token)
}

export function clearToken() {
  localStorage.removeItem("cf_token")
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: "include" })

  // Never run the refresh flow on auth endpoints (login/refresh/etc.) — they must surface
  // their own error (e.g. "Invalid credentials") rather than becoming "Session expired".
  const isAuthEndpoint = path.startsWith("/api/auth/")

  if (res.status === 401 && retry && !isAuthEndpoint) {
    const ref = await fetch(`${BASE}/api/auth/refresh`, { method: "POST", credentials: "include" })
    if (ref.ok) {
      const d = await ref.json()
      setToken(d.access_token)
      return request<T>(path, options, false)
    }
    clearToken()
    throw new Error("Session expired")
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? "Request failed")
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}

// Server-side fetch (no auth, for SSR/static)
export async function serverFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
