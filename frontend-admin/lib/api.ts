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

  if (res.status === 401 && retry) {
    // Attempt refresh
    const refreshRes = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
    if (refreshRes.ok) {
      const data = await refreshRes.json()
      setToken(data.access_token)
      return request<T>(path, options, false)
    } else {
      clearToken()
      if (typeof window !== "undefined") window.location.href = "/login"
      throw new Error("Session expired")
    }
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
