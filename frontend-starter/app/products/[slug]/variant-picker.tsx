"use client"

import { useState, useEffect, useMemo } from "react"

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

interface VariantPickerProps {
  optionTypes: OptionType[]
  variants: Variant[]
  onSelect: (variantId: string | null) => void
  /** Branding "Variant options" setting; anything but "buttons" renders the drop-down. */
  variantDisplay?: string
}

export function VariantPicker({ optionTypes, variants, onSelect, variantDisplay }: VariantPickerProps) {
  const asButtons = variantDisplay === "buttons"
  const [selections, setSelections] = useState<Record<string, string>>({})

  // Per-combination availability: a value is available if there exists at least one
  // active variant that has this value AND matches every other currently selected value.
  const availableValues = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const ot of optionTypes) {
      const available = new Set<string>()
      for (const val of ot.values) {
        const hasMatch = variants.some(v => {
          if (!v.is_active || v.stock_quantity <= 0) return false
          const hasThisValue = v.option_values.some(
            ov => ov.option_type_name === ot.name && ov.option_value_label === val.label
          )
          if (!hasThisValue) return false
          for (const [selectedType, selectedLabel] of Object.entries(selections)) {
            if (selectedType === ot.name) continue
            const matchesOther = v.option_values.some(
              ov => ov.option_type_name === selectedType && ov.option_value_label === selectedLabel
            )
            if (!matchesOther) return false
          }
          return true
        })
        if (hasMatch) available.add(val.label)
      }
      map.set(ot.name, available)
    }
    return map
  }, [optionTypes, variants, selections])

  useEffect(() => {
    const allSelected = optionTypes.every(ot => selections[ot.name])
    if (!allSelected) {
      onSelect(null)
      return
    }
    const matched = variants.find(v =>
      v.option_values.length > 0 &&
      v.option_values.every(ov => selections[ov.option_type_name] === ov.option_value_label)
    )
    onSelect(matched?.id ?? null)
  }, [selections, variants, optionTypes, onSelect])

  if (optionTypes.length === 0) return null

  const hasSelection = Object.keys(selections).length > 0

  return (
    <div className="space-y-4 my-4">
      {[...optionTypes]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(optionType => {
          const available = availableValues.get(optionType.name)
          return (
            <div key={optionType.id}>
              {asButtons ? (
                <span id={`opt-label-${optionType.id}`} className="block text-sm font-semibold text-fg mb-1.5">
                  {optionType.name}
                </span>
              ) : (
                <label
                  htmlFor={`opt-${optionType.id}`}
                  className="block text-sm font-semibold text-fg mb-1.5"
                >
                  {optionType.name}
                </label>
              )}
              {asButtons ? (
                <div
                  role="group"
                  aria-labelledby={`opt-label-${optionType.id}`}
                  className="flex flex-wrap gap-2"
                >
                  {[...optionType.values]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map(val => {
                      const isAvailable = available?.has(val.label) ?? false
                      const isSelected = selections[optionType.name] === val.label
                      // Unavailable values stay clickable (same as the drop-down) but are
                      // dimmed and struck through; clicking the selected one deselects it.
                      return (
                        <button
                          key={val.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() =>
                            setSelections(prev => {
                              const next = { ...prev }
                              if (isSelected) delete next[optionType.name]
                              else next[optionType.name] = val.label
                              return next
                            })
                          }
                          // Raised "3D" keys with a dark-accent border and a solid ledge shadow.
                          // Selected keys are pushed in and filled dark; unavailable ones keep
                          // the dark border (still clearly a button) but are dimmed + struck.
                          className={`min-w-[3rem] px-4 py-2 rounded-lg border-2 border-brand-dark text-sm font-semibold transition-all duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-dark ${
                            isSelected
                              ? "bg-brand-dark text-on-dark-strong translate-y-[3px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)]"
                              : "bg-card-bg text-brand-dark shadow-[0_3px_0_0_var(--brand-dark)] hover:-translate-y-px hover:shadow-[0_4px_0_0_var(--brand-dark)] active:translate-y-[3px] active:shadow-none"
                          } ${isAvailable ? "" : "opacity-60 line-through"}`}
                        >
                          {val.label}
                          {!isAvailable && <span className="sr-only"> (unavailable)</span>}
                        </button>
                      )
                    })}
                </div>
              ) : (
              <select
                id={`opt-${optionType.id}`}
                value={selections[optionType.name] ?? ""}
                onChange={e =>
                  setSelections(prev => {
                    const next = { ...prev }
                    if (e.target.value) next[optionType.name] = e.target.value
                    else delete next[optionType.name]
                    return next
                  })
                }
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-bg text-fg focus:outline-none focus:ring-2 focus:ring-brand-dark"
              >
                <option value="">Choose an option</option>
                {[...optionType.values]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map(val => {
                    const isAvailable = available?.has(val.label) ?? false
                    return (
                      <option key={val.id} value={val.label}>
                        {val.label}{isAvailable ? "" : " — unavailable"}
                      </option>
                    )
                  })}
              </select>
              )}
            </div>
          )
        })}

      {hasSelection && (
        <button
          type="button"
          onClick={() => setSelections({})}
          className="text-xs text-muted hover:text-brand-dark underline transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
