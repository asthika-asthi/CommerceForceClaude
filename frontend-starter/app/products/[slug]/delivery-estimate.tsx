import { Truck } from "lucide-react"
import type { BrandingConfig } from "@/lib/types"
import { estimateDelivery, formatDeliveryWindow } from "@/lib/delivery"

interface Props {
  branding: BrandingConfig | null
}

/**
 * "Estimated delivery dates: Sep 7, 2026 – Sep 9, 2026". Hidden when unconfigured.
 * Server-rendered (the page is 60s ISR), so the date is stable and there is no
 * client-side recompute to cause a hydration mismatch.
 */
export function DeliveryEstimate({ branding }: Props) {
  const window = estimateDelivery(branding)
  if (!window) return null

  return (
    <p className="flex items-center gap-2 text-sm text-fg mb-3">
      <Truck size={16} className="text-muted shrink-0" aria-hidden="true" />
      <span>
        <span className="text-muted">Estimated delivery dates:</span> {formatDeliveryWindow(window)}
      </span>
    </p>
  )
}
