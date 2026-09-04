"use client"
import { Plus, Trash2 } from "lucide-react"
import type { ProductSpec } from "@/lib/types"

const input =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

interface Props {
  value: ProductSpec[]
  onChange: (rows: ProductSpec[]) => void
}

/**
 * Repeatable label/value rows shown on the storefront product page's
 * "Additional information" tab, alongside auto-derived rows (weight, options, SKU).
 */
export function SpecificationsEditor({ value, onChange }: Props) {
  function update(i: number, patch: Partial<ProductSpec>) {
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...value, { label: "", value: "" }])
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Specifications</label>
      <p className="text-xs text-slate-500 mb-2">
        Extra rows shown in the product page&apos;s &ldquo;Additional information&rdquo; tab. Blank rows are dropped on save.
      </p>
      {value.length > 0 && (
        <div className="space-y-2 mb-2">
          {value.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={row.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className={`${input} w-1/3`}
                placeholder="Label (e.g. Material)"
              />
              <input
                value={row.value}
                onChange={(e) => update(i, { value: e.target.value })}
                className={`${input} flex-1`}
                placeholder="Value (e.g. Heavy duty woven cotton)"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 flex-shrink-0"
                title="Remove row"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
      >
        <Plus size={14} /> Add row
      </button>
    </div>
  )
}
