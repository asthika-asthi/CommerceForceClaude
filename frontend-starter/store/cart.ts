"use client"
import { create } from "zustand"
import { api } from "@/lib/api"
import type { Cart } from "@/lib/types"

interface CartState {
  cart: Cart | null
  isLoading: boolean
  fetch: () => Promise<void>
  addItem: (product_id: string, quantity?: number) => Promise<boolean>
  updateItem: (item_id: string, quantity: number) => Promise<boolean>
  removeItem: (item_id: string) => Promise<boolean>
  clear: () => void
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true })
    try {
      const cart = await api.get<Cart>("/api/cart")
      set({ cart })
    } catch {
      set({ cart: null })
    } finally {
      set({ isLoading: false })
    }
  },

  addItem: async (product_id, quantity = 1) => {
    try {
      await api.post("/api/cart/items", { product_id, quantity })
      await get().fetch()
      return true
    } catch {
      return false
    }
  },

  updateItem: async (item_id, quantity) => {
    try {
      await api.put(`/api/cart/items/${item_id}`, { quantity })
      await get().fetch()
      return true
    } catch {
      return false
    }
  },

  removeItem: async (item_id) => {
    try {
      await api.del(`/api/cart/items/${item_id}`)
      await get().fetch()
      return true
    } catch {
      return false
    }
  },

  clear: () => set({ cart: null }),
}))
