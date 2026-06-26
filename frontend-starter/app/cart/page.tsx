"use client"
import { useState, useEffect } from "react"
import { useCartStore } from "@/store/cart"
import Link from "next/link"
import { Trash2, Plus, Minus } from "lucide-react"

export default function CartPage() {
  const { cart, fetch, updateItem, removeItem, isLoading } = useCartStore()
  const [busyItems, setBusyItems] = useState<Set<string>>(new Set())

  useEffect(() => { fetch() }, [fetch])

  async function handleUpdate(variantId: string, quantity: number) {
    if (busyItems.has(variantId)) return
    setBusyItems((s) => new Set(s).add(variantId))
    try {
      await updateItem(variantId, quantity)
    } finally {
      setBusyItems((s) => { const n = new Set(s); n.delete(variantId); return n })
    }
  }

  async function handleRemove(variantId: string) {
    if (busyItems.has(variantId)) return
    setBusyItems((s) => new Set(s).add(variantId))
    try {
      await removeItem(variantId)
    } finally {
      setBusyItems((s) => { const n = new Set(s); n.delete(variantId); return n })
    }
  }

  if (isLoading) return <div className="flex justify-center py-20 text-slate-400">Loading cart…</div>

  const items = cart?.items ?? []
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.line_total), 0)

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-8">Your cart</h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-400 mb-4">Your cart is empty</p>
          <Link href="/products" className="inline-block bg-brand hover:bg-brand-hover text-white px-6 py-2.5 rounded-lg transition-colors">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => {
              const busy = busyItems.has(item.variant_id)
              return (
                <div key={item.id} className={`flex gap-4 bg-white border border-slate-100 rounded-xl p-4 transition-opacity ${busy ? "opacity-60" : ""}`}>
                  <div className="w-20 h-20 bg-slate-50 rounded-lg overflow-hidden flex-shrink-0">
                    {item.primary_image ? (
                      <img src={item.primary_image} alt={item.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200 text-2xl">📦</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">{item.product_name}</p>
                    {item.variant_label && (
                      <p className="text-sm text-muted">{item.variant_label}</p>
                    )}
                    <p className="text-slate-500 text-xs mt-0.5">&#163;{parseFloat(item.unit_price).toFixed(2)} each</p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => handleUpdate(item.variant_id, item.quantity - 1)}
                        disabled={busy || item.quantity <= 1}
                        className="w-7 h-7 border border-slate-200 rounded-lg flex items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdate(item.variant_id, item.quantity + 1)}
                        disabled={busy || item.quantity >= item.stock_quantity}
                        className="w-7 h-7 border border-slate-200 rounded-lg flex items-center justify-center hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => handleRemove(item.variant_id)}
                        disabled={busy}
                        className="ml-auto text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">&#163;{parseFloat(item.line_total).toFixed(2)}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-white border border-slate-100 rounded-xl p-6 h-fit">
            <h2 className="font-semibold text-slate-900 mb-4">Order summary</h2>
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span>Subtotal ({cart?.item_count ?? 0} items)</span>
              <span>&#163;{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-400 mb-4">
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="border-t border-slate-100 pt-4 flex justify-between font-semibold text-slate-900 mb-6">
              <span>Total</span>
              <span>&#163;{subtotal.toFixed(2)}</span>
            </div>
            <Link href="/checkout"
              className="block w-full text-center bg-brand hover:bg-brand-hover text-white font-semibold py-3 rounded-xl transition-colors">
              Proceed to checkout
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
