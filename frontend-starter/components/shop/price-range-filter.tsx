"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useState } from "react"
import { CURRENCY_SYMBOL } from "@/lib/currency"

interface PriceRangeFilterProps {
  currentMin?: string
  currentMax?: string
}

export function PriceRangeFilter({ currentMin, currentMax }: PriceRangeFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [min, setMin] = useState(currentMin ?? "")
  const [max, setMax] = useState(currentMax ?? "")

  function apply() {
    const params = new URLSearchParams(searchParams.toString())
    if (min) {
      params.set("min_price", min)
    } else {
      params.delete("min_price")
    }
    if (max) {
      params.set("max_price", max)
    } else {
      params.delete("max_price")
    }
    // Reset to page 1 when price range changes
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  function clear() {
    setMin("")
    setMax("")
    const params = new URLSearchParams(searchParams.toString())
    params.delete("min_price")
    params.delete("max_price")
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`)
  }

  const isActive = !!(currentMin || currentMax)

  return (
    <div className="mt-6">
      <h2 className="font-semibold text-slate-900 mb-3">Price Range</h2>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{CURRENCY_SYMBOL}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
          />
        </div>
        <span className="text-slate-400 text-sm">–</span>
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{CURRENCY_SYMBOL}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={apply}
          className="flex-1 px-3 py-1.5 bg-brand hover:bg-brand-hover text-white text-sm rounded-lg transition-colors"
        >
          Apply
        </button>
        {isActive && (
          <button
            type="button"
            onClick={clear}
            className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:text-slate-900 text-sm rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      {isActive && (
        <p className="mt-1.5 text-xs text-brand-dark">
          {currentMin && currentMax
            ? `${CURRENCY_SYMBOL}${currentMin} – ${CURRENCY_SYMBOL}${currentMax}`
            : currentMin
            ? `From ${CURRENCY_SYMBOL}${currentMin}`
            : `Up to ${CURRENCY_SYMBOL}${currentMax}`}
        </p>
      )}
    </div>
  )
}
