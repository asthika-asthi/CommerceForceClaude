"use client"
import { useState } from "react"
import { ShoppingCart, Check, X } from "lucide-react"
import { useCartStore } from "@/store/cart"
import { VariantPicker } from "./variant-picker"

interface OptionValue {
  id: string
  label: string
  sort_order: number
}

interface OptionType {
  id: string
  name: string
  sort_order: number
  values: OptionValue[]
}

interface Variant {
  id: string
  is_default: boolean
  is_active: boolean
  option_values: Array<{ option_type_name: string; option_value_label: string }>
  label: string
  stock_quantity: number
}

interface AddToCartButtonProps {
  productId: string
  inStock: boolean
  defaultVariantId: string
  optionTypes?: OptionType[]
  variants?: Variant[]
  selectedVariantId: string | null
  onVariantSelect: (id: string | null) => void
}

export function AddToCartButton({
  productId: _productId,
  inStock,
  defaultVariantId,
  optionTypes = [],
  variants = [],
  selectedVariantId,
  onVariantSelect,
}: AddToCartButtonProps) {
  const addItem = useCartStore((s) => s.addItem)
  const [qty, setQty] = useState(1)
  const [status, setStatus] = useState<"idle" | "added" | "error">("idle")

  const hasOptions = optionTypes.length > 0
  const isVariantRequired = hasOptions && !selectedVariantId
  const selectedVariant = variants.find(v => v.id === selectedVariantId)
  const selectedVariantInactive = !!selectedVariantId && selectedVariant?.is_active === false
  const selectedVariantOutOfStock =
    !!selectedVariantId && selectedVariant?.is_active !== false && (selectedVariant?.stock_quantity ?? 0) <= 0
  const selectedVariantUnavailable = selectedVariantInactive || selectedVariantOutOfStock

  async function handleAdd() {
    const variantId = selectedVariantId ?? defaultVariantId
    const ok = await addItem(variantId, qty)
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
    <div>
      {hasOptions && (
        <VariantPicker
          optionTypes={optionTypes}
          variants={variants}
          onSelect={onVariantSelect}
        />
      )}
      <div className="flex gap-3">
        <div className="flex items-center border border-slate-200 rounded-xl">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-l-xl">−</button>
          <span className="w-10 text-center text-sm font-medium">{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-r-xl">+</button>
        </div>
        <button
          onClick={handleAdd}
          disabled={status !== "idle" || isVariantRequired || selectedVariantUnavailable}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${
            status === "added" ? "bg-green-600 text-white"
            : status === "error" ? "bg-red-500 text-white"
            : (isVariantRequired || selectedVariantUnavailable) ? "bg-slate-100 text-slate-400"
            : "bg-brand hover:bg-brand-hover text-on-brand"
          }`}
        >
          {status === "added" ? <><Check size={18} /> Added!</>
           : status === "error" ? <><X size={18} /> Failed — try again</>
           : selectedVariantUnavailable ? <>Out of stock</>
           : isVariantRequired ? <>Select options above</>
           : <><ShoppingCart size={18} /> Add to cart</>}
        </button>
      </div>
    </div>
  )
}
