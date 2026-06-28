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

  // Pre-compute which option values appear in at least one ACTIVE variant.
  // A value absent from this set is shown as out-of-stock (greyed, strikethrough).
  const availableValues = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const ot of optionTypes) {
      map.set(ot.name, new Set())
    }
    for (const v of variants) {
      if (v.is_active) {
        for (const ov of v.option_values) {
          map.get(ov.option_type_name)?.add(ov.option_value_label)
        }
      }
    }
    return map
  }, [optionTypes, variants])

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
                            : 'bg-slate-100 text-muted border-border line-through opacity-60 cursor-pointer',
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
