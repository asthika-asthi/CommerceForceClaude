"use client"
import { create } from "zustand"
import { api } from "@/lib/api"
import type { Cart } from "@/lib/types"

interface CartState {
  cart: Cart | null
  isLoading: boolean
  fetch: () => Promise<void>
  addItem: (product_id: string, quantity?: number) => Promise<void>
  updateItem: (item_id: string, quantity: number) => Promise<void>
  removeItem: (item_id: string) => Promise<void>
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
    await api.post("/api/cart/items", { product_id, quantity })
    await get().fetch()
  },

  updateItem: async (item_id, quantity) => {
    await api.put(`/api/cart/items/${item_id}`, { quantity })
    await get().fetch()
  },

  removeItem: async (item_id) => {
    await api.del(`/api/cart/items/${item_id}`)
    await get().fetch()
  },

  clear: () => set({ cart: null }),
}))
