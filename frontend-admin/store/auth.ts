"use client"
import { create } from "zustand"
import { api, setToken, clearToken } from "@/lib/api"
import type { User, LoginResponse } from "@/lib/types"

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  // Set while a 2FA-enabled account is mid-login (between password and code).
  pendingToken: string | null
  // Resolves true when a code step is required, false when login completed.
  login: (email: string, password: string) => Promise<boolean>
  verifyTwoFactor: (code: string) => Promise<void>
  resendTwoFactor: () => Promise<void>
  logout: () => Promise<void>
  init: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  pendingToken: null,

  login: async (email, password) => {
    const data = await api.post<LoginResponse>("/api/auth/login", { email, password })
    if (data.two_factor_required) {
      set({ pendingToken: data.pending_token ?? null })
      return true
    }
    setToken(data.access_token!)
    set({ user: data.user!, token: data.access_token!, pendingToken: null, isLoading: false })
    return false
  },

  verifyTwoFactor: async (code) => {
    const pending = get().pendingToken
    if (!pending) throw new Error("Your verification session expired — please sign in again")
    const data = await api.post<{ access_token: string; user: User }>(
      "/api/auth/login/verify-2fa",
      { pending_token: pending, code },
    )
    setToken(data.access_token)
    set({ user: data.user, token: data.access_token, pendingToken: null, isLoading: false })
  },

  resendTwoFactor: async () => {
    const pending = get().pendingToken
    if (!pending) throw new Error("Your verification session expired — please sign in again")
    await api.post("/api/auth/login/resend-2fa", { pending_token: pending })
  },

  logout: async () => {
    await api.post("/api/auth/logout").catch(() => {})
    clearToken()
    set({ user: null, token: null, pendingToken: null })
  },

  init: async () => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("cf_access_token") : null
    if (!stored) {
      set({ isLoading: false })
      return
    }
    try {
      const user = await api.get<User>("/api/auth/me")
      set({ user, token: stored, isLoading: false })
    } catch {
      clearToken()
      set({ user: null, token: null, isLoading: false })
    }
  },

  setUser: (user) => set({ user }),
}))
