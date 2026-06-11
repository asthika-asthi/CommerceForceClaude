"use client"
import { useState } from "react"
import { ShoppingCart, Check } from "lucide-react"
import { useCartStore } from "@/store/cart"

export function AddToCartButton({ productId, inStock }: { productId: string; inStock: boolean }) {
  const addItem = useCartStore((s) => s.addItem)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  async function handleAdd() {
    await addItem(productId, qty)
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (!inStock) {
    return (
      <button disabled className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 font-semibold cursor-not-allowed">
        Out of stock
      </button>
    )
  }

  return (
    <div className="flex gap-3">
      <div className="flex items-center border border-slate-200 rounded-xl">
        <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-l-xl">−</button>
        <span className="w-10 text-center text-sm font-medium">{qty}</span>
        <button onClick={() => setQty((q) => q + 1)} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-r-xl">+</button>
      </div>
      <button onClick={handleAdd}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors ${
          added ? "bg-green-600 text-white" : "bg-brand hover:bg-brand-hover text-white"
        }`}>
        {added ? <><Check size={18} /> Added!</> : <><ShoppingCart size={18} /> Add to cart</>}
      </button>
    </div>
  )
}
