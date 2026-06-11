"use client"
import { create } from "zustand"
import { api, setToken, clearToken } from "@/lib/api"
import type { User } from "@/lib/types"

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  init: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  login: async (email, password) => {
    const data = await api.post<{ access_token: string; user: User }>(
      "/api/auth/login",
      { email, password },
    )
    setToken(data.access_token)
    set({ user: data.user, token: data.access_token, isLoading: false })
  },

  logout: async () => {
    await api.post("/api/auth/logout").catch(() => {})
    clearToken()
    set({ user: null, token: null })
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
}))
