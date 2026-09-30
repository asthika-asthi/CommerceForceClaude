import { describeBands } from "@/lib/delivery-bands"
import type { DeliveryBands } from "@/lib/types"
import { dispatchCopy, type DispatchCopy } from "@/lib/dispatch"

const BASE_ITEMS = [
  { icon: "🏭", strong: "Direct Importing", sub: "Europe, India & Far East" },
  { icon: "💼", strong: "Trade Accounts", sub: "Wholesale prices available" },
  { icon: "📅", strong: "Est. 1995", sub: "30 years of reliable supply" },
]

export function TrustStrip({ delivery, dispatch = dispatchCopy() }: { delivery?: DeliveryBands; dispatch?: DispatchCopy }) {
  // Delivery message comes from the admin-set bands; omitted if the shipping plugin is off.
  const copy = delivery ? describeBands(delivery) : null
  // Dispatch promise is admin-editable (Branding → Shop); a blank headline hides it.
  const dispatchItem = dispatch.title ? [{ icon: "📦", strong: dispatch.title, sub: dispatch.subtitle }] : []
  const TRUST_ITEMS = [
    ...(copy ? [{ icon: "🚚", strong: copy.freeTitle, sub: copy.freeSub }] : []),
    ...dispatchItem,
    ...BASE_ITEMS,
  ]
  return (
    <div className="bg-white border-b border-border">
      <div className="max-w-[1280px] mx-auto px-10 py-[18px] flex justify-between items-center flex-wrap gap-3">
        {TRUST_ITEMS.map(({ icon, strong, sub }) => (
          <div key={strong} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-brand-tint flex items-center justify-center text-base flex-shrink-0">
              {icon}
            </div>
            <div>
              <strong className="block text-[13px] font-semibold text-brand-dark">{strong}</strong>
              {sub && <span className="text-[11px] text-muted">{sub}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
