"use client"
import { useEffect, useState } from "react"
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
  /** Branding "Variant options" setting ("dropdown" | "buttons"). */
  variantDisplay?: string
  /** Product-level stock; the ceiling for the quantity box (a selected option's own stock wins). */
  stockQuantity?: number
}

export function AddToCartButton({
  productId: _productId,
  inStock,
  defaultVariantId,
  optionTypes = [],
  variants = [],
  selectedVariantId,
  onVariantSelect,
  variantDisplay,
  stockQuantity,
}: AddToCartButtonProps) {
  const addItem = useCartStore((s) => s.addItem)
  // The box holds text so it can be cleared while typing; `qty` is the validated number.
  const [qtyText, setQtyText] = useState("1")
  const [qtyNotice, setQtyNotice] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "added" | "error">("idle")

  const hasOptions = optionTypes.length > 0
  const isVariantRequired = hasOptions && !selectedVariantId
  const selectedVariant = variants.find(v => v.id === selectedVariantId)
  const selectedVariantInactive = !!selectedVariantId && selectedVariant?.is_active === false
  const selectedVariantOutOfStock =
    !!selectedVariantId && selectedVariant?.is_active !== false && (selectedVariant?.stock_quantity ?? 0) <= 0
  const selectedVariantUnavailable = selectedVariantInactive || selectedVariantOutOfStock

  // Most the customer can buy: the chosen option's own stock (real variants only), else the
  // product's. Infinity when the stock figure isn't known, so nothing is wrongly capped.
  const maxQty =
    selectedVariant && selectedVariant.option_values.length > 0
      ? selectedVariant.stock_quantity
      : stockQuantity ?? Infinity
  const parsedQty = parseInt(qtyText, 10)
  const qty = Number.isFinite(parsedQty) && parsedQty >= 1 ? Math.min(parsedQty, Math.max(1, maxQty)) : 1

  // Switching option can lower the ceiling below what's already typed — pull it back down.
  useEffect(() => {
    if (Number.isFinite(maxQty) && parseInt(qtyText, 10) > Math.max(1, maxQty)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp to the new stock ceiling when the option changes
      setQtyText(String(Math.max(1, maxQty)))
      setQtyNotice(`Only ${maxQty} available`)
    }
  }, [maxQty, qtyText])

  function handleQtyInput(raw: string) {
    // Digits only: strips letters, "-", "+", "e", "." and spaces, including from pasted text.
    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "")
    if (digits === "") { setQtyText(""); setQtyNotice(null); return }
    const n = parseInt(digits, 10)
    if (Number.isFinite(maxQty) && n > maxQty) {
      setQtyText(String(Math.max(1, maxQty)))
      setQtyNotice(`Only ${maxQty} available`)
      return
    }
    setQtyText(String(n))
    setQtyNotice(raw !== digits && /[^\d\s]/.test(raw) ? "Enter a whole number of 1 or more" : null)
  }

  function stepQty(delta: number) {
    const next = Math.min(Math.max(1, qty + delta), Math.max(1, maxQty))
    setQtyText(String(next))
    setQtyNotice(delta > 0 && qty >= maxQty ? `Only ${maxQty} available` : null)
  }

  async function handleAdd() {
    const variantId = selectedVariantId ?? defaultVariantId
    setQtyText(String(qty)) // normalise an empty / out-of-range box to what is actually added
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
          variantDisplay={variantDisplay}
        />
      )}
      <div className="flex gap-3">
        <div className="flex items-center border border-slate-200 rounded-xl">
          <button type="button" aria-label="Decrease quantity" disabled={qty <= 1}
            onClick={() => stepQty(-1)}
            className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-l-xl disabled:opacity-40 disabled:cursor-not-allowed">−</button>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
            aria-label="Quantity"
            value={qtyText}
            onChange={(e) => handleQtyInput(e.target.value)}
            onBlur={() => { if (qtyText === "" || parseInt(qtyText, 10) < 1) { setQtyText("1"); setQtyNotice(null) } }}
            className="w-14 h-10 text-center text-sm font-medium bg-transparent border-x border-slate-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-dark"
          />
          <button type="button" aria-label="Increase quantity" disabled={qty >= maxQty}
            onClick={() => stepQty(1)}
            className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-50 rounded-r-xl disabled:opacity-40 disabled:cursor-not-allowed">+</button>
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
      <p role="status" aria-live="polite" className="text-xs text-amber-700 mt-1.5 min-h-[1rem]">{qtyNotice}</p>
    </div>
  )
}
