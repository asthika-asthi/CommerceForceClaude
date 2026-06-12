"use client"
import { create } from "zustand"
import { api, setToken, clearToken } from "@/lib/api"
import type { User } from "@/lib/types"

interface AuthState {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; password: string; first_name: string; last_name: string }) => Promise<void>
  logout: () => Promise<void>
  init: () => Promise<void>
  setUser: (user: User) => void
}

async function mergeCartAfterAuth() {
  try {
    const { useCartStore } = await import("@/store/cart")
    await useCartStore.getState().fetch()
    // attempt merge — if there's a guest cart it merges into the user cart
    try {
      await api.post("/api/cart/merge")
      await useCartStore.getState().fetch()
    } catch { /* no guest cart or not applicable */ }
  } catch { /* non-fatal */ }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  login: async (email, password) => {
    const data = await api.post<{ access_token: string; user: User }>("/api/auth/login", { email, password })
    setToken(data.access_token)
    set({ user: data.user })
    await mergeCartAfterAuth()
  },

  register: async (formData) => {
    const data = await api.post<{ access_token: string; user: User }>("/api/auth/register", formData)
    setToken(data.access_token)
    set({ user: data.user })
    await mergeCartAfterAuth()
  },

  logout: async () => {
    await api.post("/api/auth/logout").catch(() => {})
    clearToken()
    set({ user: null })
    try {
      const { useCartStore } = await import("@/store/cart")
      useCartStore.setState({ cart: null })
    } catch { /* ignore */ }
  },

  init: async () => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("cf_token") : null
    if (!stored) { set({ isLoading: false }); return }
    try {
      const user = await api.get<User>("/api/auth/me")
      set({ user, isLoading: false })
    } catch {
      clearToken()
      set({ user: null, isLoading: false })
    }
  },

  setUser: (user) => set({ user }),
}))
