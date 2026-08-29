const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("cf_access_token")
}

export function setToken(token: string) {
  localStorage.setItem("cf_access_token", token)
}

export function clearToken() {
  localStorage.removeItem("cf_access_token")
}

// Shared in-flight refresh promise so concurrent 401s across requests await
// one /api/auth/refresh call instead of each racing the single-use rotating
// refresh cookie (the second racer would otherwise get "invalid refresh
// token" and be forced into a hard logout even though the session was fine).
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) {
        clearToken()
        if (typeof window !== "undefined") window.location.href = "/login"
        throw new Error("Session expired")
      }
      const data = await res.json()
      setToken(data.access_token)
      return data.access_token as string
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: "include" })

  // Auth endpoints (login, refresh, etc.) must surface their own errors — never run the
  // refresh-and-reload flow on them, or a failed login reloads the page and wipes the message.
  const isAuthEndpoint = path.startsWith("/api/auth/")

  if (res.status === 401 && retry && !isAuthEndpoint) {
    // Access token expired on a protected endpoint — try a one-time refresh.
    await refreshAccessToken()
    return request<T>(path, options, false)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    const error = new Error(err.detail ?? "Request failed") as Error & { status?: number }
    error.status = res.status
    throw error
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function uploadRequest<T>(path: string, body: FormData, retry = true): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  // Do NOT set Content-Type — browser sets it with the correct multipart boundary
  const res = await fetch(`${BASE}${path}`, { method: "POST", body, headers, credentials: "include" })

  if (res.status === 401 && retry) {
    await refreshAccessToken()
    return uploadRequest<T>(path, body, false)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? "Upload failed")
  }
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "DELETE", body: body !== undefined ? JSON.stringify(body) : undefined }),
  upload: <T>(path: string, body: FormData) => uploadRequest<T>(path, body),
}
