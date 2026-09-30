import { describeBands } from "@/lib/delivery-bands"
import type { DeliveryBands } from "@/lib/types"

const BASE_STATS = [
  { num: "30", suffix: "+", label: "Years supplying UK trade & retail" },
  { num: "79", suffix: "+", label: "Products across 4 categories" },
  { num: "3", suffix: "", label: "Sourcing continents — Europe, India, Far East" },
]

export function StatsBand({ delivery }: { delivery?: DeliveryBands }) {
  const threshold = delivery ? describeBands(delivery).freeThresholdLabel : null
  const STATS = threshold
    ? [...BASE_STATS, { num: threshold, suffix: "", label: "Free delivery threshold ex VAT" }]
    : BASE_STATS
  return (
    <div className="bg-brand-dark py-12 px-10">
      <div className="max-w-[1280px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-5">
        {STATS.map(({ num, suffix, label }) => (
          <div key={label} className="text-center p-2">
            <div className="text-[40px] font-bold text-white leading-none">
              {num}<em className="text-brand not-italic">{suffix}</em>
            </div>
            <div className="text-[13px] text-on-dark mt-2">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
