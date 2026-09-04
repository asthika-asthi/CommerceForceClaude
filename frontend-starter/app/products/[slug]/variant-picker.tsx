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
}

export function VariantPicker({ optionTypes, variants, onSelect }: VariantPickerProps) {
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
              <label
                htmlFor={`opt-${optionType.id}`}
                className="block text-sm font-semibold text-fg mb-1.5"
              >
                {optionType.name}
              </label>
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
