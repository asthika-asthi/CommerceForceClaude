"use client"
import { useState } from "react"
import { ShoppingCart, Check, X } from "lucide-react"
import { useCartStore } from "@/store/cart"

export function AddToCartButton({ productId, inStock }: { productId: string; inStock: boolean }) {
  const addItem = useCartStore((s) => s.addItem)
  const [qty, setQty] = useState(1)
  const [status, setStatus] = useState<"idle" | "added" | "error">("idle")

  async function handleAdd() {
    const ok = await addItem(productId, qty)
    setStatus(ok ? "added" : "error")
    setTimeout(() => setStatus("idle"), 2500)
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
      <button
        onClick={handleAdd}
        disabled={status !== "idle"}
        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${
          status === "added" ? "bg-green-600 text-white"
          : status === "error" ? "bg-red-500 text-white"
          : "bg-brand hover:bg-brand-hover text-white"
        }`}
      >
        {status === "added" ? <><Check size={18} /> Added!</>
         : status === "error" ? <><X size={18} /> Failed — try again</>
         : <><ShoppingCart size={18} /> Add to cart</>}
      </button>
    </div>
  )
}
