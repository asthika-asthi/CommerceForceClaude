"use client"
import { create } from "zustand"
import { api, setToken, clearToken } from "@/lib/api"
import type { User, LoginResponse } from "@/lib/types"

interface AuthState {
  user: User | null
  isLoading: boolean
  // Set while a 2FA-enabled account is mid-login (between password and code).
  pendingToken: string | null
  // Resolves true when a code step is required, false when login completed.
  login: (email: string, password: string) => Promise<boolean>
  verifyTwoFactor: (code: string) => Promise<void>
  resendTwoFactor: () => Promise<void>
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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  pendingToken: null,

  login: async (email, password) => {
    const data = await api.post<LoginResponse>("/api/auth/login", { email, password })
    if (data.two_factor_required) {
      set({ pendingToken: data.pending_token ?? null })
      return true
    }
    setToken(data.access_token!)
    set({ user: data.user!, pendingToken: null })
    await mergeCartAfterAuth()
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
    set({ user: data.user, pendingToken: null })
    await mergeCartAfterAuth()
  },

  resendTwoFactor: async () => {
    const pending = get().pendingToken
    if (!pending) throw new Error("Your verification session expired — please sign in again")
    await api.post("/api/auth/login/resend-2fa", { pending_token: pending })
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
    set({ user: null, pendingToken: null })
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
