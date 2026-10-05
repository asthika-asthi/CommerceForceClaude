import type { Product } from "@/lib/types"
import { formatMoney } from "@/lib/currency"

/** "£a – £b" for a variant product whose active variants differ in price (same format as
 *  the product page), else null. The list API only sets price_min/price_max in that case. */
export function formatPriceRange(product: Pick<Product, "price_min" | "price_max">): string | null {
  if (product.price_min == null || product.price_max == null) return null
  const min = parseFloat(product.price_min)
  const max = parseFloat(product.price_max)
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min <= 0.005) return null
  return `${formatMoney(min.toFixed(2))} – ${formatMoney(max.toFixed(2))}`
}
