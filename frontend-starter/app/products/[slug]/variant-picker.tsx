"use client"

import { useState, useEffect } from "react"

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

  useEffect(() => {
    // Find the matching variant for current selections
    const allSelected = optionTypes.every(ot => selections[ot.name])
    if (!allSelected) {
      onSelect(null)
      return
    }
    const matched = variants.find(v =>
      v.option_values.every(ov => selections[ov.option_type_name] === ov.option_value_label)
    )
    onSelect(matched?.is_active ? matched.id : null)
  }, [selections, variants, optionTypes, onSelect])

  if (optionTypes.length === 0) return null

  return (
    <div className="space-y-4 my-4">
      {optionTypes
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(optionType => (
          <div key={optionType.id}>
            <label className="block text-sm font-medium text-fg mb-1">
              {optionType.name}
            </label>
            <select
              className="w-full border border-border rounded-md px-3 py-2 text-sm text-fg bg-bg focus:outline-none focus:ring-2 focus:ring-brand-dark"
              value={selections[optionType.name] ?? ""}
              onChange={e =>
                setSelections(prev => ({ ...prev, [optionType.name]: e.target.value }))
              }
            >
              <option value="">Select {optionType.name}</option>
              {optionType.values
                .sort((a, b) => a.sort_order - b.sort_order)
                .map(val => (
                  <option key={val.id} value={val.label}>
                    {val.label}
                  </option>
                ))}
            </select>
          </div>
        ))}
    </div>
  )
}
