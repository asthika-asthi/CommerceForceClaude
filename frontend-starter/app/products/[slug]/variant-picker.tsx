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
  // When nothing is selected in other groups, no constraint is applied from those groups.
  const availableValues = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const ot of optionTypes) {
      const available = new Set<string>()
      for (const val of ot.values) {
        const hasMatch = variants.some(v => {
          if (!v.is_active) return false
          // Must have this value for the current option type
          const hasThisValue = v.option_values.some(
            ov => ov.option_type_name === ot.name && ov.option_value_label === val.label
          )
          if (!hasThisValue) return false
          // Must match every other currently selected option type
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
      v.option_values.every(ov => selections[ov.option_type_name] === ov.option_value_label)
    )
    // Pass the variant ID whether active or not.
    // add-to-cart-button.tsx checks is_active and shows "Out of stock" if inactive.
    onSelect(matched?.id ?? null)
  }, [selections, variants, optionTypes, onSelect])

  if (optionTypes.length === 0) return null

  return (
    <div className="space-y-5 my-4">
      {[...optionTypes]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(optionType => (
          <div key={optionType.id} role="group" aria-label={optionType.name}>
            <p className="text-sm font-semibold text-fg mb-2">
              {optionType.name}
              {selections[optionType.name] && (
                <span className="ml-2 font-normal text-muted">— {selections[optionType.name]}</span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {[...optionType.values]
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(val => {
                  const isSelected = selections[optionType.name] === val.label
                  const isAvailable = availableValues.get(optionType.name)?.has(val.label) ?? false

                  return (
                    <button
                      key={val.id}
                      aria-pressed={isSelected}
                      onClick={() =>
                        setSelections(prev => ({ ...prev, [optionType.name]: val.label }))
                      }
                      className={[
                        'px-4 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                        isSelected
                          ? 'bg-brand-dark text-white border-brand-dark'
                          : isAvailable
                            ? 'bg-bg text-fg border-border hover:border-brand-dark hover:text-brand-dark'
                            : 'bg-card-bg text-muted border-border line-through opacity-60 cursor-pointer',
                      ].join(' ')}
                    >
                      {val.label}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
    </div>
  )
}
