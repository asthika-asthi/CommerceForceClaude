import type { Product } from "@/lib/types"

interface Row {
  label: string
  value: string
}

/**
 * Builds the "Additional information" rows: the product's own specification rows
 * first, then auto-derived rows (weight, each variant option type, SKU, barcode).
 * Returns `[]` when there is nothing to show — callers hide the tab in that case.
 */
export function buildAdditionalInfoRows(product: Product): Row[] {
  const rows: Row[] = []

  for (const spec of product.specifications ?? []) {
    const label = (spec.label ?? "").trim()
    const value = (spec.value ?? "").trim()
    if (label || value) rows.push({ label: label || "—", value })
  }

  const weight = product.weight ? parseFloat(product.weight) : NaN
  if (!Number.isNaN(weight) && weight > 0) {
    rows.push({ label: "Weight", value: `${weight} kg` })
  }

  for (const ot of product.option_types ?? []) {
    const values = ot.values.map((v) => v.label).filter(Boolean).join(", ")
    if (values) rows.push({ label: ot.name, value: values })
  }

  if (product.sku) rows.push({ label: "SKU", value: product.sku })
  if (product.barcode) rows.push({ label: "Barcode", value: product.barcode })

  return rows
}

export function AdditionalInfoTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
      <tbody>
        {rows.map((row, i) => (
          <tr key={`${row.label}-${i}`} className="odd:bg-surface-alt">
            <th scope="row" className="text-left align-top font-medium text-fg px-4 py-2.5 w-1/3">
              {row.label}
            </th>
            <td className="text-muted px-4 py-2.5 whitespace-pre-line">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
