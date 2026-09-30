import { serverFetch } from "@/lib/api"
import { formatMoney } from "@/lib/currency"
import type { DeliveryBands } from "@/lib/types"

/**
 * Order-value delivery bands, managed in admin under Settings → Shipping.
 * Every piece of delivery copy (home page, cart, terms, FAQ) is built from these
 * so it can never disagree with what checkout charges.
 *
 * Server-side fetch; null when the shipping plugin is off or the API is down —
 * callers then simply omit the delivery message.
 */
export async function getDeliveryBands(): Promise<DeliveryBands | null> {
  const bands = await serverFetch<DeliveryBands>("/api/shipping/bands")
  return bands && bands.bands.length > 0 ? bands : null
}

/** Band charge for an order value, mirroring the backend (highest min not above it). */
export function chargeFor(bands: DeliveryBands, orderValue: number): number {
  let charge = 0
  for (const b of bands.bands) {
    if (parseFloat(b.min_order_value) <= orderValue) charge = parseFloat(b.charge)
  }
  return charge
}

const money = (v: string | number) => formatMoney(v).replace(/\.00$/, "")

export interface DeliveryCopy {
  /** e.g. "Free delivery on orders of £500 or more ex VAT" — null if nothing is ever free. */
  headline: string | null
  /** Trust-strip / stat wording for the free tier. */
  freeTitle: string
  freeSub: string
  /** Per band, e.g. "Orders under £250: £9.95". */
  lines: string[]
  /** The free threshold as a display amount ("£500"), null if nothing is ever free. */
  freeThresholdLabel: string | null
}

export function describeBands(data: DeliveryBands): DeliveryCopy {
  const bands = data.bands
  const free = data.free_threshold != null ? parseFloat(data.free_threshold) : null
  const everyOrderFree = free === 0
  const charge = (c: string) => (parseFloat(c) === 0 ? "Free" : formatMoney(c))

  const lines = bands.map((b, i) => {
    const from = parseFloat(b.min_order_value)
    const next = bands[i + 1]
    if (!next) return `Orders of ${money(from)} or more: ${charge(b.charge)}`
    if (from === 0) return `Orders under ${money(next.min_order_value)}: ${charge(b.charge)}`
    return `Orders ${money(from)} – ${money(next.min_order_value)}: ${charge(b.charge)}`
  })

  const freeThresholdLabel = free != null && !everyOrderFree ? money(free) : null
  return {
    headline: everyOrderFree
      ? "Free delivery on all orders"
      : freeThresholdLabel
        ? `Free delivery on orders of ${freeThresholdLabel} or more ex VAT`
        : null,
    freeTitle: "Free Delivery",
    freeSub: everyOrderFree
      ? "On all orders"
      : freeThresholdLabel
        ? `On orders of ${freeThresholdLabel} or more ex VAT`
        : `Delivery from ${money(Math.min(...bands.map(b => parseFloat(b.charge))))}`,
    lines,
    freeThresholdLabel,
  }
}
